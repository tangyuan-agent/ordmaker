#!/usr/bin/env node
/**
 * Step 2: 读取所有解答，饱和式提交并完成铸造
 * 用法: node mint-presolve-step2.js <solutions_file>
 */

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
const SUBMIT_TIMEOUT = 500; // 500ms
const PARALLEL_PER_SOLUTION = 10; // 每个解答发10次

const solutionsFile = process.argv[2] || path.resolve(__dirname, '../whoami-solutions.json');
const walletConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../wallet.json'), 'utf8'));

// API 调用（带计时）
async function apiCall(endpoint, body, timeout = 5000) {
  const startTime = Date.now();
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
    const elapsed = Date.now() - startTime;
    if (error.name === 'AbortError') {
      throw new Error(`Timeout (${elapsed}ms)`);
    }
    throw new Error(`${error.message} (${elapsed}ms)`);
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

// 饱和式提交
async function saturatedSubmit(solutions) {
  console.log(`📨 饱和式发送: ${solutions.length} 个解答 × ${PARALLEL_PER_SOLUTION} 次 = ${solutions.length * PARALLEL_PER_SOLUTION} 并发`);
  console.log('');
  
  const requests = [];
  
  // 每个解答发送 10 次
  for (const solution of solutions) {
    for (let i = 0; i < PARALLEL_PER_SOLUTION; i++) {
      requests.push(
        apiCall(`/agent/collections/${COLLECTION_ID}/mint`, solution.payload, SUBMIT_TIMEOUT)
          .then(result => ({ result, solution: solution.label, attempt: i + 1 }))
          .catch(err => ({ error: err.message, solution: solution.label, attempt: i + 1 }))
      );
    }
  }
  
  // 并行发送所有请求
  const results = await Promise.all(requests);
  
  // 统计结果
  const successes = results.filter(r => r.result && r.result.commit_psbt);
  const errors = results.filter(r => r.error);
  
  console.log(`结果: ${successes.length} 成功, ${errors.length} 失败`);
  
  if (successes.length === 0) {
    console.error('');
    console.error('失败详情（全部）:');
    errors.forEach(e => {
      console.error(`  - [${e.solution}#${e.attempt}] ${e.error}`);
    });
    throw new Error('所有请求都失败了');
  }
  
  const success = successes[0];
  console.log(`✅ 使用 ${success.solution} 的第 ${success.attempt} 次尝试`);
  console.log('');
  
  return success.result;
}

// 主流程
(async () => {
  try {
    // 读取解答
    if (!fs.existsSync(solutionsFile)) {
      throw new Error('解答文件不存在: ' + solutionsFile);
    }
    
    const data = JSON.parse(fs.readFileSync(solutionsFile, 'utf8'));
    
    if (!data.solutions || data.solutions.length === 0) {
      throw new Error('没有可用的解答');
    }
    
    console.log(`📂 已加载 ${data.solutions.length} 个解答:`);
    data.solutions.forEach(s => {
      const age = ((Date.now() - s.timestamp) / 1000).toFixed(0);
      console.log(`   - ${s.label} (${age}秒前)`);
    });
    console.log('');
    
    // 饱和式提交
    const mint = await saturatedSubmit(data.solutions);
    
    if (!mint.commit_psbt) {
      throw new Error('未收到 PSBT');
    }
    
    // 签名
    console.log('🔏 签名 PSBT...');
    const signed = signPSBT(mint.commit_psbt);
    console.log('  ✓ 签名完成');
    console.log('');
    
    // 广播
    console.log('📡 广播交易...');
    const result = await apiCall(`/agent/collections/${COLLECTION_ID}/broadcast`, {
      session_id: mint.session_id,
      signed_psbt_base64: signed
    }, 5000);
    
    console.log('');
    console.log('🎉 铸造成功！');
    console.log(`   Commit TX: ${result.commit_tx_id}`);
    if (result.reveal_tx_ids && result.reveal_tx_ids.length > 0) {
      console.log(`   Reveal TX: ${result.reveal_tx_ids[0]}`);
    }
    console.log(`   NFTs: ${mint.ordinal_count}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('');
    console.error(`❌ 失败: ${error.message}`);
    process.exit(1);
  }
})();
