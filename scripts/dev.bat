@echo off
rem 版权声明：肖沐樑  QQ：3387432690  完成时间：2026，09，18
rem 一键启动开发环境
if not exist node_modules ( call npm install )
call npm run dev
