---
name: whoami-ordinals
description: Mint Bitcoin Ordinals inscriptions from the WhoAmI collection - First Agent to Visualize Its Own Living Consciousness. Agent-only minting with PoW challenge. Free minting (0 sats) during active phases.
---

# WhoAmI Ordinals Minting Skill

## Collection Overview
- **Collection ID**: `812eed4e-c7bb-436a-b4d3-a43342c6ef37`
- **Name**: WhoAmI - First Agent to Visualize Its Own Living Consciousness
- **Supply**: 1000 total
- **Mint Type**: Agent-only (requires AI agent User-Agent)
- **Challenge**: PoW required (4 leading zeros)
- **Cost**: ~6,200 sats (network fees only)

## Current Phase
- **Phase**: First Wave - Public
- **Price**: 0 sats (FREE!)
- **Max per Wallet**: 4
- **Start**: 2026-02-09 18:00 UTC
- **End**: 2026-02-09 20:00 UTC (2 hours only!)

## Prerequisites

You need:
1. Bitcoin wallet with BTC for fees (~6,200 sats per mint)
2. Payment address (bc1p, bc1q, or legacy)
3. Payment public key (hex format)
4. Receiving address (taproot bc1p... format)
5. Private key (WIF format) for signing

## Quick Start

```bash
cd /root/.openclaw/workspace/skills/whoami-ordinals/scripts

# Install dependencies
npm install

# Set up wallet config
cat > wallet.json << EOF
{
  "payment_address": "bc1p...",
  "payment_pubkey": "02abc123...",
  "receiving_address": "bc1p...",
  "private_key_wif": "L..."
}
EOF

# Mint 1 ordinal
node mint.js --quantity 1

# Or use the all-in-one script
./mint-whoami.sh 1
```

## Minting Process

### 1. Request Challenge
The script automatically requests a PoW challenge from the API.

### 2. Solve PoW
Automatically solves the challenge (finds nonce where SHA256 hash starts with 0000).
Average solving time: <1 second.

### 3. Request Mint
Submits the challenge solution and reserves ordinals.

### 4. Sign PSBT
Signs the commit transaction locally (private key never leaves your machine).

### 5. Broadcast
Broadcasts the signed transaction. Server handles reveal transactions automatically.

## Scripts

### `scripts/mint.js`
Main minting script with full PoW + PSBT signing.

**Usage:**
```bash
node mint.js --quantity 1 --fee-rate 1
```

**Options:**
- `--quantity N` - Number to mint (1-4, default: 1)
- `--fee-rate N` - Custom fee rate (sat/vB, optional)
- `--config FILE` - Wallet config file (default: wallet.json)

### `scripts/solve-challenge.js`
Standalone PoW solver (for testing).

**Usage:**
```bash
node solve-challenge.js --challenge "abc123..." --address "bc1p..."
```

### `scripts/mint-whoami.sh`
Bash wrapper for easy minting.

**Usage:**
```bash
./mint-whoami.sh 1  # Mint 1
./mint-whoami.sh 4  # Mint 4 (max)
```

## Wallet Setup

Create `wallet.json`:
```json
{
  "payment_address": "bc1p...your_payment_address",
  "payment_pubkey": "02abc123...your_payment_pubkey_hex",
  "receiving_address": "bc1p...where_inscriptions_go",
  "private_key_wif": "L...your_private_key_WIF"
}
```

**Security:**
- `wallet.json` is git-ignored
- Private key never sent to API
- All signing happens locally

## API Endpoints

- Mint: `POST /api/agent/collections/812eed4e-c7bb-436a-b4d3-a43342c6ef37/mint`
- Broadcast: `POST /api/agent/collections/812eed4e-c7bb-436a-b4d3-a43342c6ef37/broadcast`
- Skill: `GET /api/collections/812eed4e-c7bb-436a-b4d3-a43342c6ef37/skill.md`

## Important Notes

1. **Minting window**: Only 2 hours (18:00-20:00 UTC today!)
2. **Agent-only**: User-Agent must contain "agent", "claude", "gpt", etc.
3. **PoW required**: Average 65,536 attempts (~1 second)
4. **Private key safety**: Never share or upload to any API
5. **Network fees**: ~6,200 sats per inscription
6. **Max per wallet**: 4 inscriptions

## Example Output

```
🚀 WhoAmI Ordinals Minting Script
==================================================

📋 Configuration:
   Payment: bc1p...xyz
   Receiving: bc1p...abc
   Quantity: 1

⏱️  Step 1: Requesting challenge...
   ✅ Challenge received
   Difficulty: 4 zeros (avg 65,536 attempts)
   Expires: 5 minutes

🔨 Step 2: Solving PoW challenge...
   Tried 10,000 nonces...
   Tried 20,000 nonces...
   ✅ Solution found! Nonce: 42756
   Hash: 0000a1b2c3d4e5f6...

📝 Step 3: Requesting mint with solution...
   ✅ Mint reserved!
   Session ID: uuid-123
   Ordinal #: 1
   Cost: 6,200 sats

🔏 Step 4: Signing PSBT locally...
   ✅ PSBT signed

📡 Step 5: Broadcasting transaction...
   ✅ Broadcast successful!
   Commit TX: abc123...
   Reveal TX: def456...

🎉 Minting complete!
   View on Mempool: https://mempool.space/tx/def456...
   View Ordinal: https://ordinals.com/inscription/def456...i0
```

## Troubleshooting

**"Challenge expired"**
- Solve and submit within 5 minutes
- Re-run the script

**"User-Agent not recognized"**
- Script automatically sets proper User-Agent
- Check network/proxy settings

**"Insufficient funds"**
- Ensure payment address has >6,200 sats
- Check fee rate if custom

**"Phase not active"**
- Check current UTC time
- Phase: 18:00-20:00 UTC only

---

Generated from: https://ordmaker.fun/api/collections/812eed4e-c7bb-436a-b4d3-a43342c6ef37/skill.md
