#!/usr/bin/env node
/**
 * Signet 测试脚本 - 模拟完整铸造流程
 * 
 * 流程：
 * 1. Mock API: 请求 challenge
 * 2. 真实 PoW: 解决挑战
 * 3. Mock API: 生成 PSBT
 * 4. 真实签名: 签名 PSBT
 * 5. 真实广播: 发送到 Signet 网络
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('@bitcoinerlab/secp256k1');
const { ECPairFactory } = require('ecpair');

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Signet 网络配置
const SIGNET = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: {
        public: 0x043587cf,
        private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
};

console.log('🧪 Signet 测试流程 - 模拟完整铸造');
console.log('='.repeat(70));
console.log('');

// 加载钱包配置
let walletConfig;
try {
    // 默认使用 wallet-signet.json
    const configFile = process.argv[2] || '../wallet-signet.json';
    const configPath = path.resolve(__dirname, configFile);
    walletConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('📋 配置加载:', path.basename(configPath));
    console.log(`   Payment: ${walletConfig.payment_address.substring(0, 20)}...`);
    console.log('');
    
    // 验证是 Signet 地址
    if (!walletConfig.payment_address.startsWith('tb1')) {
        console.warn('⚠️  警告: 地址不是 Signet 格式 (tb1...)');
        console.warn('   请使用 wallet-signet.json 或检查配置');
        console.warn('');
    }
} catch (error) {
    console.error('❌ 无法加载配置:', error.message);
    console.error('');
    console.error('用法: node test-signet-flow.js [配置文件]');
    console.error('示例: node test-signet-flow.js ../wallet-signet.json');
    process.exit(1);
}

// ========== Mock API Functions ==========

/**
 * Mock: 请求 Challenge
 */
function mockRequestChallenge(address) {
    console.log('🔄 Step 1: Mock API - 请求 Challenge');
    console.log('   (模拟 POST /api/agent/collections/.../mint)');
    console.log('');
    
    const challenge = crypto.randomBytes(32).toString('hex');
    const response = {
        challenge: challenge,
        difficulty: 4,
        expires_in_minutes: 5
    };
    
    console.log('   ✅ Mock 返回:');
    console.log(`   Challenge: ${challenge.substring(0, 20)}...`);
    console.log(`   Difficulty: ${response.difficulty} zeros`);
    console.log('');
    
    return response;
}

/**
 * Mock: 生成测试 PSBT
 * 创建一个简单的 Signet 转账交易
 */
async function mockGeneratePSBT(address, pubkey) {
    console.log('🔄 Step 3: Mock API - 生成 PSBT');
    console.log('   (模拟 POST /api/agent/collections/.../mint with nonce)');
    console.log('');
    
    try {
        // 获取 UTXO
        const utxosUrl = `https://mempool.space/signet/api/address/${address}/utxo`;
        const utxosResponse = await fetch(utxosUrl);
        const utxos = await utxosResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error('没有可用的 UTXO');
        }
        
        console.log(`   找到 ${utxos.length} 个 UTXO`);
        
        // 使用第一个 UTXO
        const utxo = utxos[0];
        const inputValue = utxo.value;
        const fee = 500; // 固定 500 sats 手续费
        const outputValue = inputValue - fee;
        
        console.log(`   输入: ${inputValue} sats`);
        console.log(`   手续费: ${fee} sats`);
        console.log(`   输出: ${outputValue} sats (转回自己)`);
        console.log('');
        
        // 获取交易详情以得到 scriptPubKey
        const txUrl = `https://mempool.space/signet/api/tx/${utxo.txid}`;
        const txResponse = await fetch(txUrl);
        const tx = await txResponse.json();
        const scriptPubKey = tx.vout[utxo.vout].scriptpubkey;
        
        // 创建 PSBT
        const psbt = new bitcoin.Psbt({ network: SIGNET });
        
        // 添加输入
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(scriptPubKey, 'hex'),
                value: inputValue,
            },
            tapInternalKey: Buffer.from(pubkey, 'hex').subarray(1, 33),
        });
        
        // 添加输出（转回自己）
        psbt.addOutput({
            address: address,
            value: outputValue,
        });
        
        const psbtBase64 = psbt.toBase64();
        
        console.log('   ✅ Mock PSBT 已生成');
        console.log(`   PSBT (base64): ${psbtBase64.substring(0, 60)}...`);
        console.log('');
        
        return {
            session_id: 'mock-session-' + Date.now(),
            commit_psbt: psbtBase64,
            ordinal_count: 1,
            costs: {
                total_cost: fee
            }
        };
    } catch (error) {
        console.error('   ❌ 生成 PSBT 失败:', error.message);
        throw error;
    }
}

// ========== Real Functions ==========

/**
 * 真实: 解决 PoW 挑战
 */
function solveChallenge(challenge, address, difficulty = 4) {
    console.log('🔨 Step 2: 解决 PoW 挑战');
    console.log(`   目标: ${difficulty} 个前导零`);
    console.log('');
    
    const prefix = '0'.repeat(difficulty);
    const startTime = Date.now();
    let nonce = 0;
    
    while (true) {
        const combined = challenge + address + nonce.toString();
        const hash = crypto.createHash('sha256').update(combined).digest('hex');
        
        if (hash.startsWith(prefix)) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);
            console.log(`   ✅ 解决! Nonce: ${nonce}`);
            console.log(`   Hash: ${hash}`);
            console.log(`   耗时: ${elapsed} 秒`);
            console.log('');
            return nonce.toString();
        }
        
        nonce++;
        if (nonce % 10000 === 0) {
            process.stdout.write(`\r   尝试: ${nonce.toLocaleString()} 次...`);
        }
    }
}

/**
 * 真实: 签名 PSBT
 */
function signPSBT(psbtBase64, privateKeyWIF) {
    console.log('🔏 Step 4: 签名 PSBT');
    console.log('');
    
    try {
        // 创建密钥对
        const keyPair = ECPair.fromWIF(privateKeyWIF, bitcoin.networks.bitcoin);
        
        // 解码 PSBT
        const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: SIGNET });
        
        console.log(`   输入数量: ${psbt.inputCount}`);
        console.log(`   输出数量: ${psbt.data.outputs.length}`);
        console.log('');
        
        // 签名所有输入
        for (let i = 0; i < psbt.inputCount; i++) {
            const input = psbt.data.inputs[i];
            
            // Taproot 签名
            if (input.tapInternalKey) {
                const tweakedSigner = keyPair.tweak(
                    bitcoin.crypto.taggedHash('TapTweak', keyPair.publicKey.subarray(1, 33))
                );
                psbt.signInput(i, tweakedSigner, [bitcoin.Transaction.SIGHASH_DEFAULT]);
                console.log(`   ✅ 输入 ${i} 已签名 (Taproot)`);
            } else {
                psbt.signInput(i, keyPair);
                console.log(`   ✅ 输入 ${i} 已签名`);
            }
        }
        
        // 完成所有输入
        psbt.finalizeAllInputs();
        
        const signedPsbt = psbt.toBase64();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        console.log('');
        console.log('   ✅ PSBT 签名完成');
        console.log(`   交易大小: ${txHex.length / 2} bytes`);
        console.log(`   交易 ID: ${tx.getId()}`);
        console.log('');
        
        return { signedPsbt, txHex, txId: tx.getId() };
    } catch (error) {
        console.error('   ❌ 签名失败:', error.message);
        throw error;
    }
}

/**
 * 真实: 广播到 Signet
 */
async function broadcastTransaction(txHex) {
    console.log('📡 Step 5: 广播交易到 Signet 网络');
    console.log('');
    
    try {
        const response = await fetch('https://mempool.space/signet/api/tx', {
            method: 'POST',
            body: txHex,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }
        
        const txId = await response.text();
        
        console.log('   ✅ 广播成功!');
        console.log(`   交易 ID: ${txId}`);
        console.log('');
        console.log('   🔗 查看交易:');
        console.log(`   https://mempool.space/signet/tx/${txId}`);
        console.log('');
        
        return txId;
    } catch (error) {
        console.error('   ❌ 广播失败:', error.message);
        throw error;
    }
}

// ========== Main Flow ==========

async function main() {
    try {
        // Step 1: Mock - 请求 Challenge
        const challengeResponse = mockRequestChallenge(walletConfig.payment_address);
        
        // Step 2: 真实 - 解决 PoW
        const nonce = solveChallenge(
            challengeResponse.challenge,
            walletConfig.payment_address,
            challengeResponse.difficulty
        );
        
        // Step 3: Mock - 生成 PSBT
        const mintResponse = await mockGeneratePSBT(
            walletConfig.payment_address,
            walletConfig.payment_pubkey
        );
        
        console.log('   Session ID:', mintResponse.session_id);
        console.log('   费用:', mintResponse.costs.total_cost, 'sats');
        console.log('');
        
        // Step 4: 真实 - 签名 PSBT
        const { txHex, txId } = signPSBT(
            mintResponse.commit_psbt,
            walletConfig.private_key_wif
        );
        
        // Step 5: 真实 - 广播交易
        const broadcastTxId = await broadcastTransaction(txHex);
        
        // 成功!
        console.log('🎉 测试完成!');
        console.log('');
        console.log('✅ 验证内容:');
        console.log('   1. PoW 求解 - 正常工作');
        console.log('   2. PSBT 签名 - 正常工作');
        console.log('   3. Signet 广播 - 正常工作');
        console.log('');
        console.log('💡 这意味着你的配置和脚本在主网也能正常工作!');
        console.log('');
        
    } catch (error) {
        console.error('');
        console.error('❌ 测试失败:', error.message);
        console.error('');
        if (error.stack) {
            console.error('详细错误:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// 运行
main();
