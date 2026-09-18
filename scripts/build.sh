#!/usr/bin/env bash
# 版权声明：肖沐樑  QQ：3387432690  完成时间：2026，09，18
# 一键安装并构建（Linux / macOS）
set -e
[ -d node_modules ] || npm install
npm run build
echo "构建完成，dist/ 已生成"
