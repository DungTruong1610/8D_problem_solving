# Launch full-stack CAP Backend + React Frontend concurrently
Write-Host "Cleaning up old port bindings..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 4004, 4008, 5544 -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.OwningProcess -and $_.OwningProcess -ne 0) {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1

Write-Host "Starting CNMA Proresolve (CAP Backend + React Frontend)..." -ForegroundColor Cyan
Write-Host "Starting 8D_Hackathon (CAP Backend + React Frontend)..." -ForegroundColor Cyan
npm run dev
