# Open Local Dashboard Script
Set-Location -Path $PSScriptRoot

$portActive = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($portActive) {
    Write-Host "Local server is already running on http://localhost:3000." -ForegroundColor Green
    Start-Process "http://localhost:3000"
} else {
    Write-Host "Starting GapAnchor Local Dev Server..." -ForegroundColor Yellow
    Start-Process "http://localhost:3000"
    cmd /c "npm run dev"
}
