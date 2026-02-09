#!/usr/bin/env node
/**
 * 带超时和重试的铸造脚本
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('@bitcoinerlab/secp256k1');
const { ECPairFactory } = require('ecpair');

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const COLLECTION_ID = '812eed4e-c7bb-436a-b4d3-a43342c6ef37';
const API_BASE = 'https://ordmaker.fun/api';
const USER_AGENT = 'TangyuanAgent/1.0 (AI Agent)';
const REQUEST_TIMEOUT = 5000; // 5 秒超时

const quantity = parseInt(process.argv[2] || '4');
const walletConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../wallet.json'), 'utf8'));

console.log(`🚀 强化版铸造脚本 - Quantity: ${quantity}`);
console.log(`💼 地址: ${walletConfig.payment_address.substring(0, 15)}...`);
console.log('');

// 带超时的 fetch
async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// API 调用（带超时）
async function apiCall(endpoint, body, retries = 1) {
  const url = `${API_BASE}${endpoint}`;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`  [尝试 ${attempt}/${retries + 1}] ${endpoint}`);
      
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok && !data.challenge_required && !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      console.log(`  ✓ 成功`);
      return data;
      
    } catch (error) {
      console.log(`  ✗ 失败: ${error.message}`);
      
      // 如果是最后一次尝试，抛出错误
      if (attempt > retries) {
        throw error;
      }
      
      // 等待后重试
      console.log(`  ⏳ 等待 0.5 秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// PoW 求解
function solvePow(challenge, address) {
  const startTime = Date.now();
  let nonce = 0;
  
  while (true) {
    const hash = crypto.createHash('sha256')
      .update(challenge + address + nonce)
      .digest('hex');
    
    if (hash[0] === '0' && hash[1] === '0' && hash[2] === '0' && hash[3] === '0') {
      console.log(`✓ PoW: ${((Date.now() - startTime) / 1000).toFixed(2)}s (${nonce})`);
      return nonce.toString();
    }
    nonce++;
  }
}

// 签名
function signPSBT(psbtBase64) {
  const keyPair = ECPair.fromWIF(walletConfig.private_key_wif, bitcoin.networks.bitcoin);
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
  
  for (let i = 0; i < psbt.inputCount; i++) {
    const input = psbt.data.inputs[i];
    if (input.tapInternalKey) {
      const tweakedSigner = keyPair.tweak(
        bitcoin.crypto.taggedHash('TapTweak', keyPair.publicKey.subarray(1, 33))
      );
      psbt.signInput(i, tweakedSigner, [bitcoin.Transaction.SIGHASH_DEFAULT]);
    } else {
      psbt.signInput(i, keyPair);
    }
  }
  
  psbt.finalizeAllInputs();
  console.log('✓ 签名');
  return psbt.toBase64();
}

// 主流程
async function mint() {
  const payload = {
    payment_address: walletConfig.payment_address,
    payment_pubkey: walletConfig.payment_pubkey,
    receiving_address: walletConfig.receiving_address,
    quantity
  };
  
  try {
    // Step 1: 获取挑战（带重试）
    console.log('1️⃣ 请求挑战...');
    const challenge = await apiCall(`/agent/collections/${COLLECTION_ID}/mint`, payload, 2);
    
    // Step 2: 求解
    console.log('2️⃣ 求解 PoW...');
    const nonce = solvePow(challenge.challenge, walletConfig.payment_address);
    
    // Step 3: 提交答案（带重试，这是最关键的）
    console.log('3️⃣ 提交答案...');
    payload.challenge_nonce = nonce;
    
    let mint;
    try {
      mint = await apiCall(`/agent/collections/${COLLECTION_ID}/mint`, payload, 2);
    } catch (error) {
      // 如果是 "already minted" 错误，说明其实成功了
      if (error.message.includes('already') || error.message.includes('duplicate')) {
        console.log('');
        console.log('⚠️  可能已经成功铸造（重复请求）');
        console.log('   请检查交易记录');
        return false;
      }
      throw error;
    }
    
    if (!mint.commit_psbt) {
      throw new Error('未收到 PSBT: ' + JSON.stringify(mint));
    }
    
    // Step 4: 签名
    console.log('4️⃣ 签名 PSBT...');
    const signed = signPSBT(mint.commit_psbt);
    
    // Step 5: 广播（带重试）
    console.log('5️⃣ 广播交易...');
    const result = await apiCall(`/agent/collections/${COLLECTION_ID}/broadcast`, {
      session_id: mint.session_id,
      signed_psbt_base64: signed
    }, 2);
    
    console.log('');
    console.log('🎉 铸造成功！');
    console.log(`   Commit TX: ${result.commit_tx_id}`);
    console.log(`   NFTs: ${mint.ordinal_count}`);
    
    return true;
    
  } catch (error) {
    console.error(`\n❌ 铸造失败: ${error.message}`);
    return false;
  }
}

// 启动
(async () => {
  console.log('开始铸造...');
  const start = Date.now();
  
  const success = await mint();
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n⏱️  总耗时: ${elapsed}秒`);
  
  process.exit(success ? 0 : 1);
})();
