# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
# 生成 logo.ico：.NET 缩成 256x256 PNG，再用 png-to-ico 转 ico

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('assets\logo.png')
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 256, 256)
$g.Dispose()
$bmp.Save('assets\logo-256.png', [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose(); $bmp.Dispose()

$mod = (Get-Content -Raw -Path node_modules\png-to-ico\package.json) # 触发依赖检查，无则下方 require 会报错
$js = @'
const fs = require('fs');
const mod = require('png-to-ico');
const pngToIco = mod && mod.default ? mod.default : mod;
pngToIco('assets/logo-256.png').then((buf) => fs.writeFileSync('logo.ico', buf));
'@
Set-Content -Path scripts\_ico.js -Value $js -Encoding UTF8
node scripts\_ico.js
Remove-Item -Force scripts\_ico.js
echo "logo.ico 生成完毕"
