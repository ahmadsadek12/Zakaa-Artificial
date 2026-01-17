#!/bin/bash
# Script to restart backend on EC2

echo "🔄 Restarting backend server..."

# Navigate to project directory (update this path if different)
PROJECT_DIR="/home/ubuntu/apps/zakaa"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "⚠️  Project directory not found at $PROJECT_DIR"
    echo "Please update PROJECT_DIR in this script or navigate manually"
    exit 1
fi

cd "$PROJECT_DIR"

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Restart PM2 process
echo "🔄 Restarting PM2 process 'zakaa-api'..."
pm2 restart zakaa-api

# Show status
echo ""
echo "✅ Restart complete! Status:"
pm2 status

echo ""
echo "📋 Recent logs:"
pm2 logs zakaa-api --lines 20 --nostream
