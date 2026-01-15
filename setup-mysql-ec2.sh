#!/bin/bash
# MySQL Setup Script for EC2

set -e

echo "🗄️ Setting up MySQL on EC2..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Update package list
echo -e "${YELLOW}📦 Updating package list...${NC}"
sudo apt update

# Install MySQL
echo -e "${YELLOW}📥 Installing MySQL Server...${NC}"
sudo apt install mysql-server -y

# Start MySQL
echo -e "${YELLOW}🚀 Starting MySQL...${NC}"
sudo systemctl start mysql
sudo systemctl enable mysql

# Wait a moment for MySQL to fully start
sleep 3

# Set root password
MYSQL_PASS="Zakaa2024!"
echo -e "${YELLOW}🔐 Setting MySQL root password...${NC}"
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_PASS}'; FLUSH PRIVILEGES;"

# Create database
echo -e "${YELLOW}💾 Creating zakaa_db database...${NC}"
sudo mysql -u root -p"${MYSQL_PASS}" -e "CREATE DATABASE IF NOT EXISTS zakaa_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Verify
echo -e "${YELLOW}✅ Verifying MySQL setup...${NC}"
if sudo systemctl is-active --quiet mysql; then
    echo -e "${GREEN}✅ MySQL is running${NC}"
else
    echo -e "${RED}❌ MySQL failed to start${NC}"
    exit 1
fi

# Test connection
if mysql -u root -p"${MYSQL_PASS}" -e "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MySQL connection successful${NC}"
else
    echo -e "${RED}❌ MySQL connection failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 MySQL Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "MySQL Credentials:"
echo "  Host:     127.0.0.1"
echo "  Port:     3306"
echo "  User:     root"
echo "  Password: ${MYSQL_PASS}"
echo "  Database: zakaa_db"
echo ""
echo "Your .env file will be updated automatically."
echo ""
