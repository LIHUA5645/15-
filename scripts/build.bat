@echo off
rem 版权声明：肖沐樑  QQ：3387432690  完成时间：2026，09，18
rem 构建 Web 产物（dist/）
call npm install
call npm run build
echo 构建完成，dist/ 已生成
