# Zakaa - Start ngrok Tunnel Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting ngrok Tunnel for Twilio" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if ngrok is installed via npm/node_modules
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue

if (-not $ngrokPath) {
    Write-Host "Checking for ngrok in node_modules..." -ForegroundColor Yellow
    $localNgrok = Join-Path $PSScriptRoot "node_modules\.bin\ngrok.cmd"
    if (Test-Path $localNgrok) {
        $ngrokPath = $localNgrok
        Write-Host "Found ngrok in node_modules" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] ngrok not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "To install ngrok:" -ForegroundColor Yellow
        Write-Host "  1. Download from: https://ngrok.com/download" -ForegroundColor White
        Write-Host "  2. Extract ngrok.exe to a folder in your PATH" -ForegroundColor White
        Write-Host "  3. OR install via npm: npm install -g ngrok" -ForegroundColor White
        Write-Host "  4. OR use npx: npx ngrok http 3000" -ForegroundColor White
        Write-Host ""
        Write-Host "Then authenticate with:" -ForegroundColor Yellow
        Write-Host "  ngrok config add-authtoken YOUR_AUTH_TOKEN" -ForegroundColor White
        Write-Host ""
        exit 1
    }
}

Write-Host "[INFO] Starting ngrok tunnel on port 3000..." -ForegroundColor Yellow
Write-Host "[INFO] Your ngrok URL will appear below" -ForegroundColor Yellow
Write-Host "[INFO] Copy the HTTPS URL and configure it in Twilio" -ForegroundColor Yellow
Write-Host ""
Write-Host "Twilio webhook URL format:" -ForegroundColor Cyan
Write-Host "  https://YOUR-NGROK-URL.ngrok-free.app/webhook/whatsapp" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop ngrok" -ForegroundColor Gray
Write-Host ""

# Start ngrok
if ($ngrokPath -is [System.Management.Automation.ApplicationInfo]) {
    & ngrok http 3000
} else {
    & $ngrokPath http 3000
}