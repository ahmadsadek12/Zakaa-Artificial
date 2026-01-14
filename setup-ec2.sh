#!/bin/bash
# EC2 Initial Setup Script
# Run this script after first SSH into your EC2 instance
# Usage: bash setup-ec2.sh

set -e

echo "🔧 Setting up EC2 instance for Zakaa..."
echo "========================================"

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node installation
echo "✅ Node.js version:"
node --version
echo "✅ npm version:"
npm --version

# Install PM2
echo "📦 Installing PM2 (process manager)..."
sudo npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
sudo apt-get install -y nginx

# Install MySQL client
echo "📦 Installing MySQL client..."
sudo apt-get install -y mysql-client

# Install Git
echo "📦 Installing Git..."
sudo apt-get install -y git

# Create app directory
echo "📂 Creating app directory..."
mkdir -p /home/ubuntu/apps

# Install useful utilities
echo "📦 Installing utilities..."
sudo apt-get install -y htop curl wget unzip

echo ""
echo "✅ EC2 setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Clone your repository to /home/ubuntu/apps/zakaa"
echo "2. Create .env file with your configuration"
echo "3. Run: cd /home/ubuntu/apps/zakaa && npm install"
echo "4. Run: pm2 start server.js --name zakaa-api"
echo "5. Configure Nginx (see AWS_DEPLOYMENT_GUIDE.md)"
