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
const SUBMIT_TIMEOUT = 10000; // 10秒超时
const REQUESTS_PER_SOLUTION = 50; // 每个解答发50次
const INTERVAL_MS = 10; // 每10ms发一次

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

// 饱和式提交（间隔发送）
async function saturatedSubmit(solutions) {
  const totalRequests = solutions.length * REQUESTS_PER_SOLUTION;
  console.log(`📨 饱和式发送: ${solutions.length} 个解答 × ${REQUESTS_PER_SOLUTION} 次 = ${totalRequests} 请求`);
  console.log(`⏱️  间隔: ${INTERVAL_MS}ms, 持续时间: ${(totalRequests * INTERVAL_MS / 1000).toFixed(1)}秒`);
  console.log('');
  
  const results = [];
  let successResult = null;
  let requestCount = 0;
  
  // 创建请求队列
  const queue = [];
  for (const solution of solutions) {
    for (let i = 0; i < REQUESTS_PER_SOLUTION; i++) {
      queue.push({ solution, attempt: i + 1 });
    }
  }
  
  // 间隔发送
  const startTime = Date.now();
  
  for (const item of queue) {
    requestCount++;
    
    // 发送请求（不等待）
    apiCall(`/agent/collections/${COLLECTION_ID}/mint`, item.solution.payload, SUBMIT_TIMEOUT)
      .then(result => {
        if (result.commit_psbt && !successResult) {
          successResult = { result, solution: item.solution.label, attempt: item.attempt };
          console.log(`\n✅ 第 ${requestCount}/${totalRequests} 个请求成功！(${item.solution.label}#${item.attempt})`);
        }
        results.push({ result, solution: item.solution.label, attempt: item.attempt });
      })
      .catch(err => {
        results.push({ error: err.message, solution: item.solution.label, attempt: item.attempt });
      });
    
    // 每10ms发一次
    if (requestCount < totalRequests) {
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
    }
    
    // 进度显示（每10个）
    if (requestCount % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      process.stdout.write(`\r  已发送: ${requestCount}/${totalRequests} (${elapsed}s)`);
    }
  }
  
  console.log(''); // 换行
  console.log(`\n⏳ 等待所有请求完成...`);
  
  // 等待所有请求完成（最多等5秒）
  const maxWait = Date.now() + 5000;
  while (results.length < totalRequests && Date.now() < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const successes = results.filter(r => r.result && r.result.commit_psbt);
  const errors = results.filter(r => r.error);
  
  console.log(`\n📊 结果: ${successes.length} 成功, ${errors.length} 失败, ${totalRequests - results.length} 未完成`);
  
  if (successes.length === 0) {
    console.error('\n失败详情（全部）:');
    errors.forEach(e => {
      console.error(`  - [${e.solution}#${e.attempt}] ${e.error}`);
    });
    throw new Error('所有请求都失败了');
  }
  
  console.log(`✅ 使用 ${successResult.solution} 的第 ${successResult.attempt} 次尝试`);
  console.log('');
  
  return successResult.result;
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
