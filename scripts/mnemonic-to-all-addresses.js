#!/usr/bin/env node
/**
 * 从助记词推导所有网络的 Taproot 地址
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

if (!mnemonic || mnemonic.split(' ').length !== 12) {
    console.error('Usage: node mnemonic-to-all-addresses.js word1 word2 ... word12');
    process.exit(1);
}

// 验证助记词
if (!bip39.validateMnemonic(mnemonic)) {
    console.error('❌ 无效的助记词');
    process.exit(1);
}

console.log('🔑 从助记词推导所有网络地址');
console.log('='.repeat(70));
console.log('');
console.log('助记词:', mnemonic.split(' ').slice(0, 3).join(' ') + ' ... ' + mnemonic.split(' ').slice(-2).join(' '));
console.log('');

// 生成种子
const seed = bip39.mnemonicToSeedSync(mnemonic);

// 定义网络配置
const networks = {
    mainnet: {
        name: 'Bitcoin Mainnet',
        network: bitcoin.networks.bitcoin,
        coinType: 0,
        addressPrefix: 'bc1p'
    },
    testnet: {
        name: 'Bitcoin Testnet',
        network: bitcoin.networks.testnet,
        coinType: 1,
        addressPrefix: 'tb1p'
    },
    signet: {
        name: 'Bitcoin Signet',
        network: {
            messagePrefix: '\x18Bitcoin Signed Message:\n',
            bech32: 'tb',
            bip32: {
                public: 0x043587cf,
                private: 0x04358394,
            },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef,
        },
        coinType: 1,
        addressPrefix: 'tb1p'
    }
};

function deriveAddress(seed, network, coinType) {
    // 生成根密钥
    const root = bip32.fromSeed(seed, network);
    
    // BIP86 路径 (Taproot): m/86'/coinType'/0'/0/0
    const path = `m/86'/${coinType}'/0'/0/0`;
    
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
    
    return {
        path,
        address: p2tr.address,
        publicKey: publicKey.toString('hex'),
        privateKey: wif
    };
}

// 推导所有网络的地址
for (const [key, config] of Object.entries(networks)) {
    console.log(`📍 ${config.name}`);
    console.log('='.repeat(70));
    
    const result = deriveAddress(seed, config.network, config.coinType);
    
    console.log('');
    console.log(`推导路径: ${result.path}`);
    console.log('');
    console.log('Taproot 地址:');
    console.log(`  ${result.address}`);
    console.log('');
    console.log('公钥 (Hex):');
    console.log(`  ${result.publicKey}`);
    console.log('');
    console.log('私钥 (WIF):');
    console.log(`  ${result.privateKey}`);
    console.log('');
    
    // wallet.json 配置
    console.log(`wallet.json (${key}):`)
    const walletConfig = {
        payment_address: result.address,
        payment_pubkey: result.publicKey,
        receiving_address: result.address,
        private_key_wif: result.privateKey
    };
    console.log(JSON.stringify(walletConfig, null, 2));
    console.log('');
    console.log('');
}

console.log('✅ 所有地址已生成！');
console.log('');
console.log('💡 提示:');
console.log('  - Mainnet 用于实际铸造 (18:00-20:00 UTC)');
console.log('  - Testnet/Signet 用于测试（如果 API 支持）');
console.log('  - 请妥善保管私钥，不要泄露！');
