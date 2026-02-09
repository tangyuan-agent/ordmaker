#!/usr/bin/env node
/**
 * WhoAmI Ordinals Minting Script
 * Mints Bitcoin Ordinals inscriptions with PoW challenge solving and PSBT signing
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const COLLECTION_ID = '812eed4e-c7bb-436a-b4d3-a43342c6ef37';
const API_BASE = 'https://ordmaker.fun/api';
const USER_AGENT = 'TangyuanAgent/1.0 (AI Agent)';

// Parse command line arguments
const args = process.argv.slice(2);
const quantity = parseInt(args.find(a => a.startsWith('--quantity='))?.split('=')[1] || '3');
const feeRate = args.find(a => a.startsWith('--fee-rate='))?.split('=')[1];
const configFile = args.find(a => a.startsWith('--config='))?.split('=')[1] || '../wallet.json';

console.log('🚀 WhoAmI Ordinals Minting Script');
console.log('='.repeat(50));
console.log('');

// Load wallet configuration
let walletConfig;
try {
  const configPath = path.resolve(__dirname, configFile);
  walletConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('📋 Configuration loaded:');
  console.log(`   Payment: ${walletConfig.payment_address.substring(0, 10)}...`);
  console.log(`   Receiving: ${walletConfig.receiving_address.substring(0, 10)}...`);
  console.log(`   Quantity: ${quantity}`);
  console.log('');
} catch (error) {
  console.error('❌ Failed to load wallet config:', error.message);
  console.error('');
  console.error('Please create wallet.json with:');
  console.error(JSON.stringify({
    payment_address: 'bc1p...',
    payment_pubkey: '02abc123...',
    receiving_address: 'bc1p...',
    private_key_wif: 'L...'
  }, null, 2));
  process.exit(1);
}

// Utility: HTTP fetch
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();
  
  // 特殊处理：403 + challenge_required 是正常的第一步响应
  if (!response.ok && !data.challenge_required) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// Step 0: Solve PoW Challenge
async function solveChallenge(challenge, paymentAddress, difficulty = 4) {
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;

  console.log(`🔨 Solving PoW challenge (${difficulty} zeros)...`);
  const startTime = Date.now();

  while (true) {
    const combined = challenge + paymentAddress + nonce.toString();
    const hash = crypto.createHash('sha256').update(combined).digest('hex');

    if (hash.startsWith(prefix)) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`   ✅ Solution found! Nonce: ${nonce}`);
      console.log(`   Hash: ${hash}`);
      console.log(`   Time: ${elapsed}s`);
      console.log('');
      return nonce.toString();
    }

    nonce++;
    if (nonce % 10000 === 0) {
      process.stdout.write(`\r   Tried ${nonce.toLocaleString()} nonces...`);
    }
  }
}

// Step 1: Request Challenge
async function requestChallenge() {
  console.log('⏱️  Step 1: Requesting challenge...');

  const payload = {
    payment_address: walletConfig.payment_address,
    payment_pubkey: walletConfig.payment_pubkey,
    receiving_address: walletConfig.receiving_address,
    quantity: quantity
  };

  if (feeRate) {
    payload.fee_rate = parseFloat(feeRate);
  }

  const response = await fetchAPI(`/agent/collections/${COLLECTION_ID}/mint`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  console.log('   ✅ Challenge received');
  console.log(`   Difficulty: ${response.difficulty} zeros (avg ${Math.pow(16, response.difficulty).toLocaleString()} attempts)`);
  console.log(`   Expires: ${response.expires_in_minutes} minutes`);
  console.log('');

  return response;
}

// Step 2: Request Mint with Solution
async function requestMint(challengeNonce) {
  console.log('📝 Step 2: Requesting mint with solution...');

  const payload = {
    payment_address: walletConfig.payment_address,
    payment_pubkey: walletConfig.payment_pubkey,
    receiving_address: walletConfig.receiving_address,
    quantity: quantity,
    challenge_nonce: challengeNonce
  };

  if (feeRate) {
    payload.fee_rate = parseFloat(feeRate);
  }

  const response = await fetchAPI(`/agent/collections/${COLLECTION_ID}/mint`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  console.log('   ✅ Mint reserved!');
  console.log(`   Session ID: ${response.session_id}`);
  console.log(`   Ordinals: ${response.ordinal_count}`);
  console.log(`   Total Cost: ${response.costs.total_cost.toLocaleString()} sats`);
  console.log('');

  return response;
}

// Step 3: Sign PSBT
async function signPSBT(commitPsbt) {
  console.log('🔏 Step 3: Signing PSBT locally...');

  // Require bitcoinjs-lib
  const bitcoin = require('bitcoinjs-lib');
  const ecc = require('@bitcoinerlab/secp256k1');
  const { ECPairFactory } = require('ecpair');

  bitcoin.initEccLib(ecc);
  const ECPair = ECPairFactory(ecc);

  // Create keypair from WIF
  const keyPair = ECPair.fromWIF(walletConfig.private_key_wif, bitcoin.networks.bitcoin);

  // Decode PSBT
  const psbt = bitcoin.Psbt.fromBase64(commitPsbt);

  // Sign all inputs
  for (let i = 0; i < psbt.inputCount; i++) {
    const input = psbt.data.inputs[i];
    const isTaproot = input.tapInternalKey !== undefined;

    if (isTaproot) {
      // Taproot signing
      const tweakedSigner = keyPair.tweak(
        bitcoin.crypto.taggedHash('TapTweak', keyPair.publicKey.subarray(1, 33))
      );
      psbt.signInput(i, tweakedSigner, [bitcoin.Transaction.SIGHASH_DEFAULT]);
    } else {
      // Standard signing
      psbt.signInput(i, keyPair);
    }
  }

  // Finalize
  psbt.finalizeAllInputs();

  const signedPsbt = psbt.toBase64();
  console.log('   ✅ PSBT signed');
  console.log('');

  return signedPsbt;
}

// Step 4: Broadcast
async function broadcast(sessionId, signedPsbt) {
  console.log('📡 Step 4: Broadcasting transaction...');

  const response = await fetchAPI(`/agent/collections/${COLLECTION_ID}/broadcast`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      signed_psbt_base64: signedPsbt
    })
  });

  console.log('   ✅ Broadcast successful!');
  console.log(`   Commit TX: ${response.commit_tx_id}`);
  if (response.reveal_tx_ids && response.reveal_tx_ids.length > 0) {
    console.log(`   Reveal TX: ${response.reveal_tx_ids[0]}`);
  }
  console.log('');

  return response;
}

// Main execution
async function main() {
  try {
    // Step 1: Request challenge
    const challengeResponse = await requestChallenge();

    // Solve the challenge
    const challengeNonce = await solveChallenge(
      challengeResponse.challenge,
      walletConfig.payment_address,
      challengeResponse.difficulty
    );

    // Step 2: Request mint with solution
    const mintResponse = await requestMint(challengeNonce);

    // Step 3: Sign PSBT
    const signedPsbt = await signPSBT(mintResponse.commit_psbt);

    // Step 4: Broadcast
    const broadcastResponse = await broadcast(mintResponse.session_id, signedPsbt);

    // Success!
    console.log('🎉 Minting complete!');
    console.log('');
    console.log('📍 Track your transactions:');
    if (broadcastResponse.mempool_urls) {
      console.log(`   Commit: ${broadcastResponse.mempool_urls.commit}`);
      if (broadcastResponse.mempool_urls.reveals) {
        broadcastResponse.mempool_urls.reveals.forEach((url, i) => {
          console.log(`   Reveal ${i + 1}: ${url}`);
        });
      }
    }
    if (broadcastResponse.ordinals_urls) {
      console.log('');
      console.log('🖼️  View your Ordinals:');
      broadcastResponse.ordinals_urls.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
    }
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Run
main();
