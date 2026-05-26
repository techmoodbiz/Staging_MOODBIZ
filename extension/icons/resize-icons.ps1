Add-Type -AssemblyName System.Drawing

$src = "$PSScriptRoot\logo.png"
if (-not (Test-Path $src)) { Write-Host "Không tìm thấy logo.png! Hãy đặt file vào thư mục icons\" -ForegroundColor Red; exit }

$sizes = @(16, 32, 48, 128)

foreach ($size in $sizes) {
    $original = [System.Drawing.Image]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($original, 0, 0, $size, $size)
    $outPath = "$PSScriptRoot\icon$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $original.Dispose()
    Write-Host "Đã tạo: icon$size.png" -ForegroundColor Green
}

Write-Host "`nXong! Reload extension tại chrome://extensions/" -ForegroundColor Cyan
