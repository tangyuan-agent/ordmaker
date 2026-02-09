#!/usr/bin/env node
/**
 * 双谜题预解答 + 饱和发送策略
 * 
 * 策略：
 * 1. 17:58:00 获取谜题1并解答
 * 2. 17:58:58 获取谜题2并解答
 * 3. 18:00:00 饱和式发送：两个解答各发10次（共20并发）
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
const SUBMIT_TIMEOUT = 500; // 500ms 超时
const PARALLEL_PER_SOLUTION = 10; // 每个解答发10次

const quantity = parseInt(process.argv[2] || '4');
const walletConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../wallet.json'), 'utf8'));

console.log('🎯 双谜题预解答策略');
console.log(`💼 地址: ${walletConfig.payment_address.substring(0, 15)}...`);
console.log(`📦 数量: ${quantity}`);
console.log('');

// API 调用（支持超时）
async function apiCall(endpoint, body, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(id);
    
    const data = await response.json();
    if (!response.ok && !data.challenge_required && !data.success) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Timeout');
    }
    throw error;
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
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`   ✓ 求解完成: ${elapsed}s (nonce: ${nonce})`);
      return nonce.toString();
    }
    nonce++;
  }
}

// 签名 PSBT
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
  return psbt.toBase64();
}

// 获取并求解谜题
async function fetchAndSolve(label) {
  console.log(`${label} 获取谜题...`);
  
  const payload = {
    payment_address: walletConfig.payment_address,
    payment_pubkey: walletConfig.payment_pubkey,
    receiving_address: walletConfig.receiving_address,
    quantity
  };
  
  try {
    const challenge = await apiCall(`/agent/collections/${COLLECTION_ID}/mint`, payload, 5000);
    
    if (!challenge.challenge) {
      throw new Error('未收到 challenge: ' + JSON.stringify(challenge));
    }
    
    console.log(`   ✓ 收到谜题 (难度: ${challenge.difficulty})`);
    console.log(`${label} 求解中...`);
    
    const nonce = solvePow(challenge.challenge, walletConfig.payment_address);
    
    return {
      payload: { ...payload, challenge_nonce: nonce },
      label
    };
  } catch (error) {
    console.error(`   ✗ 失败: ${error.message}`);
    return null;
  }
}

// 饱和式提交
async function saturatedSubmit(solutions) {
  console.log('');
  console.log('🚀 饱和式提交中...');
  console.log(`   并发请求数: ${solutions.length * PARALLEL_PER_SOLUTION}`);
  
  const requests = [];
  
  // 每个解答发送 10 次
  for (const solution of solutions) {
    for (let i = 0; i < PARALLEL_PER_SOLUTION; i++) {
      requests.push(
        apiCall(`/agent/collections/${COLLECTION_ID}/mint`, solution.payload, SUBMIT_TIMEOUT)
          .then(result => ({ result, solution: solution.label, attempt: i + 1 }))
          .catch(err => null)
      );
    }
  }
  
  // 并行发送所有请求
  const results = await Promise.all(requests);
  
  // 找第一个成功的
  const success = results.find(r => r && r.result && r.result.commit_psbt);
  
  if (!success) {
    const failures = results.filter(r => r === null).length;
    throw new Error(`所有 ${requests.length} 个请求都失败了 (${failures} 个超时)`);
  }
  
  console.log(`   ✅ 成功！(${success.solution} 的第 ${success.attempt} 次尝试)`);
  return success.result;
}

// 主流程
async function main() {
  const solutions = [];
  
  // Step 1: 17:58:00 获取谜题1
  console.log('1️⃣ 第一轮 (17:58:00)');
  const solution1 = await fetchAndSolve('   [谜题1]');
  if (solution1) {
    solutions.push(solution1);
  }
  console.log('');
  
  // Step 2: 17:58:58 获取谜题2
  console.log('2️⃣ 第二轮 (17:58:58)');
  const solution2 = await fetchAndSolve('   [谜题2]');
  if (solution2) {
    solutions.push(solution2);
  }
  console.log('');
  
  if (solutions.length === 0) {
    throw new Error('❌ 没有可用的解答！');
  }
  
  console.log(`✓ 准备完成！已准备 ${solutions.length} 个解答`);
  console.log('');
  
  // Step 3: 18:00:00 饱和式提交
  console.log('3️⃣ 饱和式提交 (18:00:00)');
  const mint = await saturatedSubmit(solutions);
  
  if (!mint.commit_psbt) {
    throw new Error('未收到 PSBT: ' + JSON.stringify(mint));
  }
  
  // Step 4: 签名
  console.log('');
  console.log('4️⃣ 签名 PSBT...');
  const signed = signPSBT(mint.commit_psbt);
  console.log('   ✓ 签名完成');
  
  // Step 5: 广播
  console.log('');
  console.log('5️⃣ 广播交易...');
  const result = await apiCall(`/agent/collections/${COLLECTION_ID}/broadcast`, {
    session_id: mint.session_id,
    signed_psbt_base64: signed
  }, 5000);
  
  console.log('');
  console.log('🎉 铸造成功！');
  console.log(`   Commit TX: ${result.commit_tx_id}`);
  console.log(`   NFTs: ${mint.ordinal_count}`);
  
  return true;
}

// 导出函数供外部调用
if (require.main === module) {
  // 直接运行
  (async () => {
    try {
      const start = Date.now();
      await main();
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`\n⏱️  总耗时: ${elapsed}秒`);
      process.exit(0);
    } catch (error) {
      console.error(`\n❌ 失败: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  // 作为模块导出
  module.exports = { fetchAndSolve, saturatedSubmit, signPSBT };
}
