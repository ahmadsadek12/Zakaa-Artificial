# Connect to EC2 Instance
# Usage: Run this script from PowerShell

$keyPath = "D:\Zakaa Artificial\zakaa-key.pem"
$ec2IP = "52.28.59.163"

Write-Host "🔌 Connecting to EC2 Instance..." -ForegroundColor Green
Write-Host "IP: $ec2IP" -ForegroundColor Yellow
Write-Host ""

# Check if key exists
if (-not (Test-Path $keyPath)) {
    Write-Host "❌ Key file not found: $keyPath" -ForegroundColor Red
    Write-Host "Please verify the path to your zakaa-key.pem file" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Key file found" -ForegroundColor Green
Write-Host ""
Write-Host "Connecting via SSH..." -ForegroundColor Cyan
Write-Host "If this is your first connection, type 'yes' when prompted." -ForegroundColor Yellow
Write-Host ""

# Connect via SSH
ssh -i $keyPath ubuntu@$ec2IP
