#!/usr/bin/env node
/**
 * 从助记词推导 Taproot 地址
 */

const bitcoin = require('bitcoinjs-lib');
const ecc = require('@bitcoinerlab/secp256k1');
const { ECPairFactory } = require('ecpair');
const BIP32Factory = require('bip32').default;
const bip39 = require('bip39');

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

// 助记词
const mnemonic = process.argv.slice(2).join(' ');
const networkArg = process.argv[process.argv.length - 1];

if (!mnemonic || mnemonic.split(' ').length < 12) {
    console.error('Usage: node mnemonic-to-address.js word1 word2 ... word12 [signet|testnet|mainnet]');
    process.exit(1);
}

// 检查最后一个参数是否是网络名
const words = mnemonic.split(' ');
let actualMnemonic = mnemonic;
let network;

if (['signet', 'testnet', 'mainnet'].includes(words[words.length - 1])) {
    actualMnemonic = words.slice(0, -1).join(' ');
    const netArg = words[words.length - 1];
    
    if (netArg === 'signet') {
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
    } else if (netArg === 'testnet') {
        network = bitcoin.networks.testnet;
    } else {
        network = bitcoin.networks.bitcoin;
    }
} else {
    network = bitcoin.networks.bitcoin;
}

try {
    // 验证助记词
    if (!bip39.validateMnemonic(actualMnemonic)) {
        console.error('❌ 无效的助记词');
        process.exit(1);
    }
    
    console.log('🔑 从助记词推导地址');
    console.log('='.repeat(70));
    console.log('');
    console.log('助记词:', actualMnemonic.split(' ').slice(0, 3).join(' ') + ' ... ' + actualMnemonic.split(' ').slice(-2).join(' '));
    console.log('');
    
    // 生成种子
    const seed = bip39.mnemonicToSeedSync(actualMnemonic);
    
    // 生成根密钥
    const root = bip32.fromSeed(seed, network);
    
    // BIP86 路径 (Taproot): m/86'/0'/0'/0/0
    // Signet 使用 testnet 的 coin type: m/86'/1'/0'/0/0
    const coinType = (network === bitcoin.networks.bitcoin) ? 0 : 1;
    const path = `m/86'/${coinType}'/0'/0/0`;
    
    console.log(`推导路径: ${path}`);
    console.log('');
    
    const child = root.derivePath(path);
    const privateKey = Buffer.from(child.privateKey);
    const publicKey = Buffer.from(child.publicKey);
    
    // 创建 Taproot 地址
    const internalPubkey = Buffer.from(publicKey.subarray(1, 33));
    const p2tr = bitcoin.payments.p2tr({ 
        internalPubkey: internalPubkey,
        network 
    });
    
    // 获取 WIF
    const keyPair = ECPair.fromPrivateKey(privateKey, { network, compressed: true });
    const wif = keyPair.toWIF();
    
    console.log('📍 生成的地址:');
    console.log('='.repeat(70));
    console.log('');
    console.log('Taproot (P2TR):');
    console.log(`  ${p2tr.address}`);
    console.log('');
    console.log('公钥 (Hex):');
    console.log(`  ${publicKey.toString('hex')}`);
    console.log('');
    console.log('私钥 (WIF):');
    console.log(`  ${wif}`);
    console.log('');
    
    // 生成 wallet.json
    console.log('📋 wallet.json 配置:');
    console.log('='.repeat(70));
    const config = {
        payment_address: p2tr.address,
        payment_pubkey: publicKey.toString('hex'),
        receiving_address: p2tr.address,
        private_key_wif: wif
    };
    console.log(JSON.stringify(config, null, 2));
    
} catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
}
