#!/bin/bash
# Zakaa Health Check Script
# Run this to verify all services are working

echo "🏥 Zakaa Health Check"
echo "===================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_URL="http://localhost:3000"

# Check PM2 status
echo "📊 Checking PM2..."
if pm2 list | grep -q "zakaa-api.*online"; then
    echo -e "${GREEN}✓${NC} PM2 app is running"
else
    echo -e "${RED}✗${NC} PM2 app is NOT running"
fi

# Check Node.js process
echo ""
echo "🔍 Checking Node.js process..."
if pgrep -f "node.*server.js" > /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js process found"
    MEMORY=$(ps aux | grep "node.*server.js" | grep -v grep | awk '{print $6}')
    CPU=$(ps aux | grep "node.*server.js" | grep -v grep | awk '{print $3}')
    echo "   Memory: ${MEMORY}KB, CPU: ${CPU}%"
else
    echo -e "${RED}✗${NC} Node.js process NOT found"
fi

# Check API health endpoint
echo ""
echo "🌐 Checking API endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${APP_URL}/health)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} API is responding (HTTP $HTTP_CODE)"
else
    echo -e "${RED}✗${NC} API is NOT responding (HTTP $HTTP_CODE)"
fi

# Check Nginx
echo ""
echo "🔧 Checking Nginx..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx is running"
else
    echo -e "${RED}✗${NC} Nginx is NOT running"
fi

# Check disk space
echo ""
echo "💾 Checking disk space..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Disk usage: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Disk usage: ${DISK_USAGE}% (WARNING)"
else
    echo -e "${RED}✗${NC} Disk usage: ${DISK_USAGE}% (CRITICAL)"
fi

# Check memory
echo ""
echo "🧠 Checking memory..."
MEMORY_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3*100/$2}')
if [ "$MEMORY_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Memory usage: ${MEMORY_USAGE}%"
elif [ "$MEMORY_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Memory usage: ${MEMORY_USAGE}% (WARNING)"
else
    echo -e "${RED}✗${NC} Memory usage: ${MEMORY_USAGE}% (CRITICAL)"
fi

# Check MySQL connection (if mysql client is installed)
echo ""
echo "🗄️  Checking database connection..."
if command -v mysql &> /dev/null; then
    if [ -f ".env" ]; then
        # Try to extract DB credentials from .env
        MYSQL_HOST=$(grep MYSQL_HOST .env | cut -d '=' -f2)
        MYSQL_USER=$(grep MYSQL_USER .env | cut -d '=' -f2)
        MYSQL_PASS=$(grep MYSQL_PASSWORD .env | cut -d '=' -f2)
        
        if mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASS" -e "SELECT 1" &> /dev/null; then
            echo -e "${GREEN}✓${NC} MySQL connection successful"
        else
            echo -e "${RED}✗${NC} MySQL connection failed"
        fi
    else
        echo -e "${YELLOW}⚠${NC} .env file not found, skipping DB check"
    fi
else
    echo -e "${YELLOW}⚠${NC} MySQL client not installed, skipping DB check"
fi

# Check logs for errors
echo ""
echo "📝 Recent errors in logs..."
if pm2 logs zakaa-api --lines 50 --nostream --err 2>/dev/null | grep -i "error" > /dev/null; then
    echo -e "${YELLOW}⚠${NC} Errors found in recent logs"
    echo "   Run: pm2 logs zakaa-api --err"
else
    echo -e "${GREEN}✓${NC} No recent errors in logs"
fi

echo ""
echo "===================="
echo "Health check complete!"
