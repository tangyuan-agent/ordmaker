# WhoAmI Ordinals Minting Tool

Bitcoin Ordinals 自动铸造工具 - 支持 PoW 挑战求解和 PSBT 签名

## 🎯 项目简介

用于铸造 WhoAmI Ordinals NFT 的自动化工具。包含：
- PoW 挑战自动求解（SHA-256, 4个前导零）
- PSBT 本地签名（私钥永不上传）
- 批量铸造支持（1-4个）
- 完整的地址推导工具

## 📦 安装依赖

```bash
npm install
```

## 🔑 配置钱包

```bash
cp scripts/wallet.json.example wallet.json
# 编辑 wallet.json，填入你的钱包信息
```

**wallet.json 格式：**
```json
{
  "payment_address": "bc1p...",
  "payment_pubkey": "02abc123...",
  "receiving_address": "bc1p...",
  "private_key_wif": "L..."
}
```

⚠️ **重要：wallet.json 已在 .gitignore 中，不会被提交**

## 🚀 使用方法

### 铸造 NFT

```bash
cd scripts

# 铸造 1 个
./mint-whoami.sh 1

# 铸造 4 个（最大）
./mint-whoami.sh 4
```

### 从私钥生成地址

```bash
node derive-address.js <WIF私钥> mainnet
node derive-address.js <WIF私钥> testnet
```

### 从助记词生成地址

```bash
node mnemonic-to-all-addresses.js word1 word2 ... word12
```

### 测试 PoW 性能

```bash
node test-pow-speed.js
```

## ⏰ 铸造时间

```
Phase: First Wave - Public
Start: 2026-02-09 18:00 UTC
End:   2026-02-09 20:00 UTC
Window: 2 小时
```

## 💰 费用

```
单个 NFT: ~6,200 sats
4 个 NFT:  ~25,000 sats
建议余额: 30,000 sats
```

## 📊 性能数据

基于 20 次测试：
- 平均时间：0.271 秒
- 标准差：0.232 秒
- 95% 概率：<0.73 秒
- Hash 率：~181,665 H/s

## 🛡️ 安全说明

- ✅ 私钥本地签名，永不上传
- ✅ wallet.json 已在 .gitignore
- ✅ 所有敏感文件自动忽略
- ⚠️ 不要将私钥提交到 Git

## 📁 项目结构

```
whoami-ordinals/
├── SKILL.md                    # 技能文档
├── README.md                   # 本文件
├── .gitignore                  # Git 忽略规则
└── scripts/
    ├── mint.js                 # 主铸造脚本
    ├── mint-whoami.sh          # Bash 包装器
    ├── solve-challenge.js      # PoW 求解器
    ├── derive-address.js       # 地址推导工具
    ├── mnemonic-to-all-addresses.js  # 助记词工具
    ├── test-pow-speed.js       # 性能测试
    ├── wallet.json.example     # 配置模板
    ├── wallet.json             # 你的配置（不提交）
    └── package.json            # 依赖管理
```

## 🔗 相关链接

- Collection: https://ordmaker.fun/collections/812eed4e-c7bb-436a-b4d3-a43342c6ef37
- API Docs: https://ordmaker.fun/api

## 📝 License

Private - Not for public distribution
