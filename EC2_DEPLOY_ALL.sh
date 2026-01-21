#!/bin/bash
# EC2 Deployment Script
# Pulls latest changes, installs dependencies, builds frontend, and restarts services

set -e  # Exit on error

echo "=== Starting EC2 Deployment ==="
echo ""

# Navigate to project directory
cd ~/zakaa || { echo "Error: ~/zakaa directory not found"; exit 1; }

echo "=== Pulling latest changes from GitHub ==="
git pull origin main

echo ""
echo "=== Installing backend dependencies ==="
npm install

echo ""
echo "=== Installing frontend dependencies ==="
cd frontend
npm install

echo ""
echo "=== Building frontend ==="
npm run build

echo ""
echo "=== Returning to project root ==="
cd ..

echo ""
echo "=== Restarting PM2 ==="
pm2 restart zakaa || pm2 start server.js --name zakaa

echo ""
echo "=== Reloading Nginx ==="
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "Checking PM2 status:"
pm2 list

echo ""
echo "To view logs, run: pm2 logs zakaa --lines 50"
