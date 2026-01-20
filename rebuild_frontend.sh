#!/bin/bash
# Rebuild frontend on EC2
cd ~/zakaa

echo "=== Step 1: Pull latest changes ==="
git pull origin main

echo ""
echo "=== Step 2: Navigate to frontend ==="
cd frontend

echo ""
echo "=== Step 3: Install frontend dependencies ==="
npm install

echo ""
echo "=== Step 4: Build frontend ==="
npm run build

echo ""
echo "=== Step 5: Go back to root ==="
cd ..

echo ""
echo "=== Step 6: Reload nginx ==="
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ Frontend rebuild complete!"
echo "Frontend is now available at http://52.28.59.163"
