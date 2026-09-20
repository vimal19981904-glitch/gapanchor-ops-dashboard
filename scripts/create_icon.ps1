Add-Type -AssemblyName System.Drawing

$icoPath = "C:\Users\ARUL XAVIER\OneDrive - gapanchor\dashboard\gapanchor.ico"
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background gradient (Dark Slate to Electric Teal/Cyan)
$rect = New-Object System.Drawing.Rectangle 0, 0, 256, 256
$c1 = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)    # Slate 900
$c2 = [System.Drawing.Color]::FromArgb(255, 14, 165, 233)   # Sky 500
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45
$g.FillEllipse($brush, 12, 12, 232, 232)

# Glowing cyan outer ring
$ringPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 56, 189, 248)), 6
$g.DrawEllipse($ringPen, 16, 16, 224, 224)

# Draw bold white 'G' emblem in center
$font = New-Object System.Drawing.Font "Segoe UI", 115, [System.Drawing.FontStyle]::Bold
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

$g.DrawString("G", $font, $textBrush, $rect, $sf)

# Save as .ico
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream $icoPath, [System.IO.FileMode]::Create
$icon.Save($fs)
$fs.Close()
$g.Dispose()
$bmp.Dispose()

Write-Host "Icon created successfully at $icoPath" -ForegroundColor Green

# Update Desktop Shortcuts with the new Icon
$desktopPath = "C:\Users\ARUL XAVIER\OneDrive - gapanchor\Desktop"
$wsh = New-Object -ComObject WScript.Shell

$sc1Path = Join-Path $desktopPath "Start GapAnchor Local Dashboard.lnk"
if (Test-Path $sc1Path) {
    $sc1 = $wsh.CreateShortcut($sc1Path)
    $sc1.IconLocation = "$icoPath,0"
    $sc1.Save()
    Write-Host "Updated icon for standard shortcut" -ForegroundColor Green
}

$sc2Path = Join-Path $desktopPath "Start GapAnchor Local Dashboard (Silent).lnk"
if (Test-Path $sc2Path) {
    $sc2 = $wsh.CreateShortcut($sc2Path)
    $sc2.IconLocation = "$icoPath,0"
    $sc2.Save()
    Write-Host "Updated icon for silent shortcut" -ForegroundColor Green
}

$sc3Path = Join-Path $desktopPath "Start_Local_Dashboard.lnk"
if (Test-Path $sc3Path) {
    $sc3 = $wsh.CreateShortcut($sc3Path)
    $sc3.IconLocation = "$icoPath,0"
    $sc3.Save()
    Write-Host "Updated icon for Start_Local_Dashboard shortcut" -ForegroundColor Green
}
