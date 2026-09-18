@echo off
chcp 65001 >nul
setlocal

echo ========== 1/3 生成图标 ==========
if not exist logo.ico (
  powershell -ExecutionPolicy Bypass -File scripts\make-icon.ps1
)

echo ========== 2/3 编译后端 ==========
py -m PyInstaller --noconfirm --clean --onefile --name server ^
  --distpath build_pyi\dist --workpath build_pyi\work --specpath build_pyi ^
  --add-data "web;web" ^
  --hidden-import uvicorn.logging --hidden-import uvicorn.loops.auto ^
  --hidden-import uvicorn.protocols.http.auto ^
  --hidden-import uvicorn.protocols.websockets.auto server.py
if errorlevel 1 goto :fail
copy /Y build_pyi\dist\server.exe server.exe >nul
rmdir /S /Q build_pyi 2>nul
del /Q server.spec 2>nul

echo ========== 3/3 打包桌面版 ==========
taskkill /F /IM server.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul
set NODE_OPTIONS=
set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
call npx electron-builder --win nsis zip
if errorlevel 1 goto :fail

echo ========== 完成，产物在 release\ ==========
dir release\*.exe release\*.zip
pause
exit /b 0

:fail
echo !!! 打包失败，看上面的报错
pause
exit /b 1
