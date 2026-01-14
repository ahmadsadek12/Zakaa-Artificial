#!/bin/bash
# Zakaa Deployment Script
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Zakaa Deployment Script"
echo "=========================="

# Configuration
APP_DIR="/home/ubuntu/apps/zakaa"
APP_NAME="zakaa-api"

echo "📂 Navigating to app directory..."
cd $APP_DIR

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm install --production

echo "🗄️ Running database migrations..."
npm run migrate || echo "⚠️  No migrations to run"

echo "🔄 Restarting application..."
pm2 restart $APP_NAME

echo "📊 Checking application status..."
pm2 status

echo "📝 Showing recent logs..."
pm2 logs $APP_NAME --lines 20 --nostream

echo ""
echo "✅ Deployment complete!"
echo "Run 'pm2 logs $APP_NAME' to view live logs"
