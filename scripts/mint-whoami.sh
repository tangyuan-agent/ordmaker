#!/bin/bash
# WhoAmI Ordinals Minting Wrapper Script

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Get quantity from argument (default: 3)
QUANTITY=${1:-3}

# Validate quantity
if [ "$QUANTITY" -lt 1 ] || [ "$QUANTITY" -gt 3 ]; then
    echo "❌ Error: Quantity must be between 1 and 3"
    echo "Usage: $0 [quantity]"
    echo "Example: $0 1"
    exit 1
fi

# Check if wallet.json exists
if [ ! -f "wallet.json" ]; then
    echo "❌ Error: wallet.json not found!"
    echo ""
    echo "Please create wallet.json with your Bitcoin wallet info:"
    echo ""
    cat << 'EOF'
{
  "payment_address": "bc1p...your_payment_address",
  "payment_pubkey": "02abc123...your_payment_pubkey_hex",
  "receiving_address": "bc1p...where_inscriptions_go",
  "private_key_wif": "L...your_private_key_WIF"
}
EOF
    echo ""
    exit 1
fi

# Run minting script
node scripts/mint.js --quantity="$QUANTITY"
