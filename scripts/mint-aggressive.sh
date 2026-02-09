#!/bin/bash
# 激进策略：17:59:57 启动（提前 3 秒）
# 风险：可能被拒绝（太早）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

TARGET_TIME="17:59:57"  # 提前 3 秒
QUANTITY=${1:-4}

echo "⚡ 激进抢购模式"
echo "========================"
echo ""
echo "启动时间: $TARGET_TIME UTC"
echo "铸造数量: $QUANTITY"
echo ""

# 同步时间
if command -v ntpdate >/dev/null 2>&1; then
    sudo ntpdate -u time.google.com 2>/dev/null
fi

current=$(date -u +%s)
target=$(date -u -d "2026-02-09 $TARGET_TIME" +%s)
wait=$((target - current))

if [ $wait -gt 0 ]; then
    echo "⏳ 等待 $wait 秒..."
    sleep $wait
fi

echo "🚀 启动！"
node scripts/mint-fast.js $QUANTITY
