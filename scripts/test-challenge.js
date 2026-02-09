#!/usr/bin/env node
/**
 * Test Challenge Request & Solving (without actual minting)
 * Safe to run - doesn't require wallet or private key
 */

const crypto = require('crypto');

const COLLECTION_ID = '812eed4e-c7bb-436a-b4d3-a43342c6ef37';
const API_BASE = 'https://ordmaker.fun/api';
const USER_AGENT = 'TangyuanAgent/1.0 (AI Agent)';

// Dummy test address (won't actually mint)
const TEST_ADDRESS = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const TEST_PUBKEY = '020000000000000000000000000000000000000000000000000000000000000001';

console.log('🧪 WhoAmI Challenge Test');
console.log('='.repeat(50));
console.log('This test will:');
console.log('1. Request a challenge from the API');
console.log('2. Solve the PoW challenge');
console.log('3. NOT actually mint (no wallet required)');
console.log('');

async function requestChallenge() {
    console.log('⏱️  Requesting challenge...');
    
    const response = await fetch(`${API_BASE}/agent/collections/${COLLECTION_ID}/mint`, {
        method: 'POST',
        headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            payment_address: TEST_ADDRESS,
            payment_pubkey: TEST_PUBKEY,
            receiving_address: TEST_ADDRESS,
            quantity: 1
        })
    });

    const data = await response.json();
    
    console.log('   ✅ Challenge received');
    console.log(`   Challenge: ${data.challenge}`);
    console.log(`   Difficulty: ${data.difficulty} zeros`);
    console.log(`   Expires: ${data.expires_in_minutes} minutes`);
    console.log('');

    return data;
}

async function solveChallenge(challenge, address, difficulty) {
    const prefix = '0'.repeat(difficulty);
    let nonce = 0;
    
    console.log(`🔨 Solving PoW challenge...`);
    const startTime = Date.now();

    while (true) {
        const combined = challenge + address + nonce.toString();
        const hash = crypto.createHash('sha256').update(combined).digest('hex');

        if (hash.startsWith(prefix)) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`   ✅ Solution found!`);
            console.log(`   Nonce: ${nonce}`);
            console.log(`   Hash: ${hash}`);
            console.log(`   Attempts: ${nonce.toLocaleString()}`);
            console.log(`   Time: ${elapsed}s`);
            console.log(`   Hash Rate: ${Math.round(nonce / elapsed).toLocaleString()} H/s`);
            console.log('');
            return nonce.toString();
        }

        nonce++;
        if (nonce % 10000 === 0) {
            process.stdout.write(`\r   Tried ${nonce.toLocaleString()} nonces...`);
        }
    }
}

async function main() {
    try {
        // Request challenge
        const challengeData = await requestChallenge();

        // Solve it
        const solution = await solveChallenge(
            challengeData.challenge,
            TEST_ADDRESS,
            challengeData.difficulty
        );

        console.log('✅ Test complete!');
        console.log('');
        console.log('To actually mint, you need to:');
        console.log('1. Create wallet.json with your real wallet info');
        console.log('2. Run: node mint.js --quantity=1');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Error:', error.message);
        console.error('');
        process.exit(1);
    }
}

main();
