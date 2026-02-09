#!/usr/bin/env node
/**
 * 从私钥推导地址和公钥信息
 */

const bitcoin = require('bitcoinjs-lib');
const ecc = require('@bitcoinerlab/secp256k1');
const { ECPairFactory } = require('ecpair');

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// 从命令行获取参数
const wif = process.argv[2];
const networkArg = process.argv[3] || 'mainnet';

if (!wif) {
    console.error('Usage: node derive-address.js <WIF> [network]');
    console.error('  network: mainnet, testnet, signet (default: mainnet)');
    process.exit(1);
}

// 选择网络
let network;
if (networkArg === 'signet') {
    // Signet 网络参数
    network = {
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
} else if (networkArg === 'testnet') {
    network = bitcoin.networks.testnet;
} else {
    network = bitcoin.networks.bitcoin;
}

try {
    // 从 WIF 创建密钥对
    // 注意：如果 WIF 是主网格式(L/K开头)，先用主网解码，再在目标网络上使用
    let keyPair;
    try {
        keyPair = ECPair.fromWIF(wif, network);
    } catch (e) {
        // 如果失败，尝试用主网解码（处理主网WIF在测试网使用的情况）
        console.log('⚠️  WIF 格式为主网，将密钥用于', networkArg);
        const mainnetKeyPair = ECPair.fromWIF(wif, bitcoin.networks.bitcoin);
        // 重建为目标网络的密钥对
        keyPair = ECPair.fromPrivateKey(mainnetKeyPair.privateKey, { network, compressed: true });
    }
    
    console.log('🔑 密钥信息');
    console.log('='.repeat(70));
    console.log('');
    
    // 公钥
    const publicKey = keyPair.publicKey.toString('hex');
    console.log('公钥 (Hex):');
    console.log(`  ${publicKey}`);
    console.log('');
    
    // P2WPKH (Native SegWit - bc1q...)
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network });
    console.log('P2WPKH (Native SegWit):');
    console.log(`  地址: ${p2wpkh.address}`);
    console.log('');
    
    // P2TR (Taproot - bc1p...)
    const internalPubkey = keyPair.publicKey.subarray(1, 33);
    const p2tr = bitcoin.payments.p2tr({ 
        internalPubkey: internalPubkey,
        network 
    });
    console.log('P2TR (Taproot):');
    console.log(`  地址: ${p2tr.address}`);
    console.log('');
    
    // 生成 wallet.json 配置
    console.log('📋 wallet.json 配置:');
    console.log('='.repeat(70));
    const config = {
        payment_address: p2tr.address,
        payment_pubkey: publicKey,
        receiving_address: p2tr.address,
        private_key_wif: wif
    };
    console.log(JSON.stringify(config, null, 2));
    console.log('');
    
    console.log('💡 提示:');
    console.log(`  网络: ${networkArg}`);
    console.log(`  Payment 地址: ${p2tr.address}`);
    console.log(`  Receiving 地址: ${p2tr.address}`);
    
} catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
}
