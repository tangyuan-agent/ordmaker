#!/bin/bash
# 定时抢购脚本 - 在 18:00:00 UTC 准时执行
# 使用方法: ./schedule-mint.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

TARGET_TIME="18:00:00"
QUANTITY=4

echo "⏰ WhoAmI Ordinals 定时抢购"
echo "=============================="
echo ""
echo "目标时间: 2026-02-09 ${TARGET_TIME} UTC"
echo "铸造数量: ${QUANTITY}"
echo "当前时间: $(date -u +%H:%M:%S) UTC"
echo ""

# 时间同步（重要！）
echo "🔄 同步系统时间..."
if command -v ntpdate >/dev/null 2>&1; then
    sudo ntpdate -u time.google.com 2>/dev/null || echo "  ⚠️  无法同步时间（继续）"
elif command -v chronyc >/dev/null 2>&1; then
    sudo chronyc -a makestep 2>/dev/null || echo "  ⚠️  无法同步时间（继续）"
fi

echo "  当前时间: $(date -u +%H:%M:%S.%N | cut -c1-12) UTC"
echo ""

# 计算等待时间
current_hour=$(date -u +%H)
current_min=$(date -u +%M)
current_sec=$(date -u +%S)

target_hour=18
target_min=0
target_sec=0

# 提前2秒开始（减少延迟影响）
target_sec=$((target_sec - 2))
if [ $target_sec -lt 0 ]; then
    target_sec=$((60 + target_sec))
    target_min=$((target_min - 1))
fi

current_total=$((current_hour * 3600 + current_min * 60 + current_sec))
target_total=$((target_hour * 3600 + target_min * 60 + target_sec))

wait_seconds=$((target_total - current_total))

if [ $wait_seconds -lt 0 ]; then
    # 如果目标时间已过，计算明天的时间
    wait_seconds=$((86400 + wait_seconds))
fi

echo "⏳ 等待 ${wait_seconds} 秒..."
echo "   将在 $(date -u -d "+${wait_seconds} seconds" +%H:%M:%S) UTC 启动"
echo ""

# 倒计时（最后60秒显示）
while [ $wait_seconds -gt 60 ]; do
    sleep 30
    wait_seconds=$((wait_seconds - 30))
    echo "  ⏳ 还剩 ${wait_seconds} 秒..."
done

# 最后60秒精确倒计时
echo ""
echo "🔥 进入最后60秒倒计时..."
for i in $(seq $wait_seconds -1 1); do
    if [ $i -le 10 ] || [ $((i % 10)) -eq 0 ]; then
        echo "  $i..."
    fi
    sleep 1
done

echo ""
echo "🚀 启动铸造！"
echo ""

# 执行高速脚本
node scripts/mint-fast.js ${QUANTITY}

exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo "✅ 铸造成功！"
else
    echo "❌ 铸造失败"
    echo ""
    echo "🔄 尝试备用方案（quantity=1）..."
    node scripts/mint-fast.js 1
fi
