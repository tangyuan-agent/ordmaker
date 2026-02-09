#!/usr/bin/env node
/**
 * PoW Speed Test - 测试本地计算 4 个前导零需要多久
 * 使用与 WhoAmI Ordinals 相同的 SHA-256 算法
 */

const crypto = require('crypto');

// 模拟参数
const challenge = 'test_challenge_' + Date.now();
const address = 'bc1p' + 'x'.repeat(58); // 模拟 Taproot 地址
const difficulty = 4; // 4 个前导零

console.log('🔨 PoW Speed Test');
console.log('='.repeat(60));
console.log('');
console.log('参数:');
console.log(`  Challenge: ${challenge}`);
console.log(`  Address: ${address.substring(0, 20)}...`);
console.log(`  Difficulty: ${difficulty} zeros (0x${'0'.repeat(difficulty)}...)`);
console.log(`  Expected attempts: ${Math.pow(16, difficulty).toLocaleString()}`);
console.log('');

// 开始测试
const startTime = Date.now();
const prefix = '0'.repeat(difficulty);
let nonce = 0;
let found = false;

console.log('开始计算...');
console.log('');

while (!found) {
  const combined = challenge + address + nonce.toString();
  const hash = crypto.createHash('sha256').update(combined).digest('hex');

  if (hash.startsWith(prefix)) {
    found = true;
    const endTime = Date.now();
    const elapsed = (endTime - startTime) / 1000;
    const hashRate = Math.round(nonce / elapsed);

    console.log('✅ 找到解答！');
    console.log('');
    console.log('结果:');
    console.log(`  Nonce: ${nonce.toLocaleString()}`);
    console.log(`  Hash: ${hash}`);
    console.log('');
    console.log('性能:');
    console.log(`  尝试次数: ${nonce.toLocaleString()}`);
    console.log(`  耗时: ${elapsed.toFixed(3)} 秒`);
    console.log(`  Hash率: ${hashRate.toLocaleString()} H/s`);
    console.log('');

    // 验证结果
    console.log('验证:');
    const verify = crypto.createHash('sha256')
      .update(challenge + address + nonce.toString())
      .digest('hex');
    console.log(`  重新计算: ${verify}`);
    console.log(`  匹配: ${verify === hash ? '✅ 是' : '❌ 否'}`);
    console.log(`  前导零: ${verify.match(/^0*/)[0].length} 个`);
    console.log('');

    // 多次测试建议
    console.log('💡 提示:');
    console.log(`  单次测试完成时间: ${elapsed.toFixed(2)}秒`);
    console.log(`  估算抢购时所需时间: 0.5-2秒 (随机性较大)`);
    console.log(`  建议: 在 18:00 准时执行脚本，预留 5 秒缓冲`);
  } else {
    nonce++;

    // 每 10000 次输出进度
    if (nonce % 10000 === 0) {
      process.stdout.write(`\r  已尝试: ${nonce.toLocaleString()} 次...`);
    }
  }
}
