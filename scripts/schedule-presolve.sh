#!/bin/bash
# 双谜题预解答定时脚本
# 17:58:00 → 获取谜题1
# 17:58:58 → 获取谜题2
# 18:00:00 → 饱和发送

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

QUANTITY=${1:-4}
SOLVE_SCRIPT="$SCRIPT_DIR/solve-challenge.js"
SUBMIT_SCRIPT="$SCRIPT_DIR/submit-presolve.js"
SOLUTIONS_FILE="$SCRIPT_DIR/../whoami-solutions.json"

echo "🎯 双谜题预解答策略"
echo "=========================="
echo ""
echo "数量: $QUANTITY"
echo "当前时间: $(date -u +%H:%M:%S) UTC"
echo ""

# 时间同步
echo "🔄 同步系统时间..."
if command -v ntpdate >/dev/null 2>&1; then
    sudo ntpdate -u time.google.com 2>/dev/null || echo "  ⚠️  无法同步"
elif command -v chronyc >/dev/null 2>&1; then
    sudo chronyc -a makestep 2>/dev/null || echo "  ⚠️  无法同步"
fi
echo "  当前时间: $(date -u +%H:%M:%S.%N | cut -c1-12) UTC"
echo ""

# 初始化解答文件
echo '{"solutions":[]}' > "$SOLUTIONS_FILE"

# 等待到 17:58:00
function wait_until() {
    local target_time=$1
    local label=$2
    
    local target_hour=$(echo "$target_time" | cut -d: -f1)
    local target_min=$(echo "$target_time" | cut -d: -f2)
    local target_sec=$(echo "$target_time" | cut -d: -f3)
    
    local current_hour=$(date -u +%H)
    local current_min=$(date -u +%M)
    local current_sec=$(date -u +%S)
    
    local current_total=$((10#$current_hour * 3600 + 10#$current_min * 60 + 10#$current_sec))
    local target_total=$((10#$target_hour * 3600 + 10#$target_min * 60 + 10#$target_sec))
    
    local wait_seconds=$((target_total - current_total))
    
    if [ $wait_seconds -lt 0 ]; then
        wait_seconds=$((86400 + wait_seconds))
    fi
    
    if [ $wait_seconds -gt 0 ]; then
        echo "⏳ [$label] 等待 $wait_seconds 秒..."
        
        # 粗略等待
        if [ $wait_seconds -gt 2 ]; then
            coarse_wait=$((wait_seconds - 2))
            sleep $coarse_wait
            wait_seconds=2
        fi
        
        # 精确等待最后 2 秒
        if [ $wait_seconds -gt 0 ]; then
            remaining_ms=$((wait_seconds * 1000))
            while [ $remaining_ms -gt 0 ]; do
                sleep 0.02
                remaining_ms=$((remaining_ms - 20))
            done
        fi
    fi
}

# 获取并求解谜题
function fetch_and_solve() {
    local label=$1
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$label $(date -u +%H:%M:%S) UTC"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    node "$SCRIPT_DIR/mint-presolve-step1.js" "$QUANTITY" "$SOLUTIONS_FILE" "$label"
    
    if [ $? -eq 0 ]; then
        echo "  ✅ 解答已保存"
    else
        echo "  ⚠️  解答失败（继续）"
    fi
}

# Step 1: 17:58:00 获取谜题1
wait_until "17:58:00" "谜题1"
fetch_and_solve "1️⃣ 谜题1"

# Step 2: 17:58:58 获取谜题2
wait_until "17:58:58" "谜题2"
fetch_and_solve "2️⃣ 谜题2"

# Step 3: 18:00:00 饱和式提交
wait_until "18:00:00" "提交"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣ 饱和式提交 $(date -u +%H:%M:%S) UTC"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

node "$SCRIPT_DIR/mint-presolve-step2.js" "$SOLUTIONS_FILE"

exit_code=$?

# 清理临时文件
rm -f "$SOLUTIONS_FILE"

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "🎉 铸造成功！"
    exit 0
else
    echo ""
    echo "❌ 铸造失败"
    exit 1
fi
