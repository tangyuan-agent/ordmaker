#!/usr/bin/env node
/**
 * Step 1: 获取并求解谜题（保存到文件）
 * 用法: node mint-presolve-step1.js <quantity> <solutions_file> <label>
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COLLECTION_ID = '812eed4e-c7bb-436a-b4d3-a43342c6ef37';
const API_BASE = 'https://ordmaker.fun/api';
const USER_AGENT = 'TangyuanAgent/1.0 (AI Agent)';

const quantity = parseInt(process.argv[2] || '4');
const solutionsFile = process.argv[3] || path.resolve(__dirname, '../whoami-solutions.json');
const label = process.argv[4] || 'Solution';

const walletConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../wallet.json'), 'utf8'));

// API 调用
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
      console.log(`  ✓ 求解: ${elapsed}s (nonce: ${nonce})`);
      return nonce.toString();
    }
    nonce++;
  }
}

// 主流程
(async () => {
  try {
    console.log(`  📥 获取谜题...`);
    
    const payload = {
      payment_address: walletConfig.payment_address,
      payment_pubkey: walletConfig.payment_pubkey,
      receiving_address: walletConfig.receiving_address,
      quantity
    };
    
    const challenge = await apiCall(`/agent/collections/${COLLECTION_ID}/mint`, payload);
    
    if (!challenge.challenge) {
      throw new Error('未收到 challenge');
    }
    
    console.log(`  ✓ 收到谜题 (难度: ${challenge.difficulty}, 有效期: ${challenge.expires_in_minutes}min)`);
    console.log(`  🔨 求解中...`);
    
    const nonce = solvePow(challenge.challenge, walletConfig.payment_address);
    
    // 保存解答到文件
    const solution = {
      label,
      payload: {
        ...payload,
        challenge_nonce: nonce
      },
      timestamp: Date.now()
    };
    
    // 读取现有解答
    let data = { solutions: [] };
    if (fs.existsSync(solutionsFile)) {
      data = JSON.parse(fs.readFileSync(solutionsFile, 'utf8'));
    }
    
    // 添加新解答
    data.solutions.push(solution);
    
    // 写回文件
    fs.writeFileSync(solutionsFile, JSON.stringify(data, null, 2));
    
    console.log(`  ✅ 解答已保存 (共 ${data.solutions.length} 个)`);
    process.exit(0);
    
  } catch (error) {
    console.error(`  ❌ 失败: ${error.message}`);
    process.exit(1);
  }
})();
