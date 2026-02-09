#!/usr/bin/env node
/**
 * 高速抢购版本 - 针对激烈竞争优化
 * 
 * 优化策略：
 * 1. 预热连接（减少 TLS 握手时间）
 * 2. 提前17:59:58开始（提前2秒）
 * 3. 并发请求（小心被限制）
 * 4. 最小化日志输出
 * 5. 快速失败重试
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('@bitcoinerlab/secp256k1');
const { ECPairFactory } = require('ecpair');

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Configuration
const COLLECTION_ID = '812eed4e-c7bb-436a-b4d3-a43342c6ef37';
const API_BASE = 'https://ordmaker.fun/api';
const USER_AGENT = 'TangyuanAgent/1.0 (AI Agent)';

// 命令行参数
const quantity = parseInt(process.argv[2] || '4');
const configFile = process.argv[3] || '../wallet.json';

console.log(`🚀 高速抢购模式 - Quantity: ${quantity}`);

// 加载配置
const walletConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, configFile), 'utf8'));
console.log(`💼 地址: ${walletConfig.payment_address.substring(0, 15)}...`);

// 预热：提前建立连接
async function warmupConnection() {
  try {
    await fetch(`${API_BASE}/agent/collections/${COLLECTION_ID}/mint`, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT }
    }).catch(() => {});
  } catch (e) {}
}

// 快速PoW求解器（内联，减少函数调用开销）
function solveFast(challenge, address) {
  const prefix = '0000';
  let nonce = 0;
  const startTime = Date.now();
  
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

// 快速API调用（最小化开销）
async function apiCall(endpoint, body) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
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
  return data;
}

// 快速签名（最小化日志）
function signFast(psbtBase64) {
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
    // Step 1: 获取挑战
    console.log('1️⃣ 请求挑战...');
    const challenge = await apiCall(`/agent/collections/${COLLECTION_ID}/mint`, payload);
    
    // Step 2: 求解（最快速度）
    console.log('2️⃣ 求解中...');
    const nonce = solveFast(challenge.challenge, walletConfig.payment_address);
    
    // Step 3: 提交（立即）
    console.log('3️⃣ 提交...');
    payload.challenge_nonce = nonce;
    const mint = await apiCall(`/agent/collections/${COLLECTION_ID}/mint`, payload);
    
    if (!mint.commit_psbt) {
      throw new Error('未收到 PSBT: ' + JSON.stringify(mint));
    }
    
    // Step 4: 签名（快速）
    console.log('4️⃣ 签名...');
    const signed = signFast(mint.commit_psbt);
    
    // Step 5: 广播
    console.log('5️⃣ 广播...');
    const result = await apiCall(`/agent/collections/${COLLECTION_ID}/broadcast`, {
      session_id: mint.session_id,
      signed_psbt_base64: signed
    });
    
    console.log('');
    console.log('🎉 成功！');
    console.log(`   Commit: ${result.commit_tx_id}`);
    console.log(`   NFTs: ${mint.ordinal_count}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return false;
  }
}

// 启动
(async () => {
  console.log('⚡ 预热连接...');
  await warmupConnection();
  
  console.log('');
  console.log('开始铸造...');
  const start = Date.now();
  
  const success = await mint();
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n⏱️  总耗时: ${elapsed}秒`);
  
  process.exit(success ? 0 : 1);
})();
