#!/bin/bash
# Zakaa Server Setup Script
# Run this after SSH'ing into your EC2 instance

set -e

echo "🚀 Setting up Zakaa Server..."
echo "=============================="
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18.x
echo ""
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node installation
echo ""
echo "✅ Node.js installed:"
node --version
npm --version

# Install PM2
echo ""
echo "📦 Installing PM2 (process manager)..."
sudo npm install -g pm2

# Install Nginx
echo ""
echo "📦 Installing Nginx..."
sudo apt-get install -y nginx

# Install MySQL client
echo ""
echo "📦 Installing MySQL client..."
sudo apt-get install -y mysql-client

# Install Git
echo ""
echo "📦 Installing Git..."
sudo apt-get install -y git

# Install utilities
echo ""
echo "📦 Installing utilities..."
sudo apt-get install -y htop curl wget unzip

# Create app directory
echo ""
echo "📂 Creating app directory..."
mkdir -p /home/ubuntu/apps

echo ""
echo "✅ Server setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Clone your repository: cd /home/ubuntu/apps && git clone YOUR_REPO"
echo "2. Or upload your code via SCP from local machine"
echo "3. Create .env file with your configuration"
echo "4. Install dependencies: npm install --production"
echo "5. Initialize database"
echo "6. Start app with PM2"
echo ""
echo "Stay connected to run the next commands!"
