#!/usr/bin/env node
/**
 * Standalone PoW Challenge Solver
 * Finds nonce where SHA256(challenge + address + nonce) starts with N zeros
 */

const crypto = require('crypto');

// Parse arguments
const args = process.argv.slice(2);
const challenge = args.find(a => a.startsWith('--challenge='))?.split('=')[1];
const address = args.find(a => a.startsWith('--address='))?.split('=')[1];
const difficulty = parseInt(args.find(a => a.startsWith('--difficulty='))?.split('=')[1] || '4');

if (!challenge || !address) {
    console.error('Usage: node solve-challenge.js --challenge=<challenge> --address=<address> [--difficulty=4]');
    process.exit(1);
}

console.log('🔨 PoW Challenge Solver');
console.log('='.repeat(50));
console.log(`Challenge: ${challenge}`);
console.log(`Address: ${address}`);
console.log(`Difficulty: ${difficulty} zeros`);
console.log('');

const prefix = '0'.repeat(difficulty);
let nonce = 0;
const startTime = Date.now();

console.log('Solving...');

while (true) {
    const combined = challenge + address + nonce.toString();
    const hash = crypto.createHash('sha256').update(combined).digest('hex');

    if (hash.startsWith(prefix)) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('');
        console.log('✅ Solution found!');
        console.log(`   Nonce: ${nonce}`);
        console.log(`   Hash: ${hash}`);
        console.log(`   Attempts: ${nonce.toLocaleString()}`);
        console.log(`   Time: ${elapsed}s`);
        console.log(`   Rate: ${Math.round(nonce / elapsed).toLocaleString()} hashes/sec`);
        console.log('');
        process.exit(0);
    }

    nonce++;
    if (nonce % 10000 === 0) {
        process.stdout.write(`\rTried ${nonce.toLocaleString()} nonces...`);
    }
}
