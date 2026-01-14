# Zakaa - Start Full Application Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Zakaa - Starting Full Application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    $backendRunning = $true
    Write-Host "[Backend] Already running on port 3000" -ForegroundColor Green
} catch {
    Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; node server.js" -WindowStyle Normal
    Start-Sleep -Seconds 3
    Write-Host "[Backend] Started on http://localhost:3000" -ForegroundColor Green
}

Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Yellow
$frontendPath = Join-Path $PWD "frontend"
if (Test-Path (Join-Path $frontendPath "node_modules")) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal
    Write-Host "[Frontend] Starting on http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "[Frontend] Installing dependencies first..." -ForegroundColor Yellow
    Set-Location $frontendPath
    npm install
    if ($LASTEXITCODE -eq 0) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal
        Write-Host "[Frontend] Started on http://localhost:5173" -ForegroundColor Green
    } else {
        Write-Host "[Frontend] Failed to install dependencies. Please run 'npm install' in the frontend folder manually." -ForegroundColor Red
    }
    Set-Location $PWD
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Application Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Login credentials:" -ForegroundColor Cyan
Write-Host "  Email: burgerking@example.com" -ForegroundColor White
Write-Host "  Password: password123" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
