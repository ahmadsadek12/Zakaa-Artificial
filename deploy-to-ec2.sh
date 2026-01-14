#!/bin/bash
# Complete EC2 Deployment Script for Zakaa

set -e

echo "🚀 Deploying Zakaa to EC2..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EC2_IP="52.28.59.163"

# Auto-detect project directory
if [ -d "$HOME/zakaa" ]; then
    PROJECT_DIR="$HOME/zakaa"
elif [ -d "$HOME/apps/zakaa" ]; then
    PROJECT_DIR="$HOME/apps/zakaa"
elif [ -d "$HOME/Zakaa-Artificial" ]; then
    PROJECT_DIR="$HOME/Zakaa-Artificial"
else
    PROJECT_DIR="$(pwd)"
fi

echo -e "${YELLOW}📂 Project directory: ${PROJECT_DIR}${NC}"
cd $PROJECT_DIR

# Step 1: Check environment variables
echo -e "${YELLOW}🔐 Checking environment variables...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Creating .env file with default values..."
    
    cat > .env << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CORS Configuration
CORS_ORIGIN=http://52.28.59.163,https://52.28.59.163

# Database Configuration
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=zakaa_db

# MongoDB Configuration
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=zakaa_db

# Security - MUST CHANGE THESE!
JWT_SECRET=CHANGE_ME_$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
ENCRYPTION_KEY=$(openssl rand -hex 32)

# OpenAI Configuration
OPENAI_API_KEY=

# WhatsApp Configuration
WHATSAPP_API_VERSION=v18.0
WHATSAPP_VERIFY_TOKEN=

# Logging
LOG_LEVEL=info
EOF
    
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env file and add your database password and API keys${NC}"
    echo "Press Enter to continue after editing .env..."
    read
fi

# Step 2: Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
npm install --production

# Step 3: Initialize database
echo -e "${YELLOW}🗄️ Initializing database...${NC}"
npm run init || echo "Database might already be initialized"

# Step 4: Create admin account
echo -e "${YELLOW}👤 Creating admin account...${NC}"
node scripts/create-admin.js || echo "Admin account might already exist"

# Step 5: Build frontend
echo -e "${YELLOW}🏗️ Building frontend...${NC}"
cd frontend

# Install frontend dependencies
npm install

# Create frontend .env
echo -e "${YELLOW}Creating frontend environment config...${NC}"
cat > .env << EOF
VITE_API_URL=http://${EC2_IP}
EOF

# Build frontend
npm run build

cd ..

# Step 6: Configure Nginx
echo -e "${YELLOW}⚙️ Configuring Nginx...${NC}"

# Create nginx config
sudo tee /etc/nginx/sites-available/zakaa > /dev/null << EOF
# Zakaa Application Configuration
server {
    listen 80;
    server_name ${EC2_IP};

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Increase body size
    client_max_body_size 10M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;

    # Frontend
    location / {
        root ${PROJECT_DIR}/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Webhooks
    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Health check
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/health;
    }

    access_log /var/log/nginx/zakaa-access.log;
    error_log /var/log/nginx/zakaa-error.log;
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/zakaa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config
if sudo nginx -t; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
    sudo systemctl reload nginx
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi

# Step 7: Start backend with PM2
echo -e "${YELLOW}🔄 Starting backend with PM2...${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    sudo npm install -g pm2
fi

# Stop existing process if running
pm2 delete zakaa-api 2>/dev/null || true

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 startup (only if not already done)
pm2 startup systemd -u $USER --hp $HOME || true

# Step 8: Verify deployment
echo -e "${YELLOW}✅ Verifying deployment...${NC}"
sleep 5

# Check backend health
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    echo "Backend logs:"
    pm2 logs zakaa-api --lines 20 --nostream
    exit 1
fi

# Final output
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Access your application at:"
echo -e "${GREEN}➜  http://${EC2_IP}/${NC}"
echo ""
echo "Admin Credentials:"
echo "  Email:    admin@zakaa-artificial.com"
echo "  Password: Z@ka2@dm1n*"
echo ""
echo -e "${YELLOW}⚠️  Important: Change the admin password after first login!${NC}"
echo ""
echo "Useful commands:"
echo "  pm2 logs zakaa-api              # View backend logs"
echo "  pm2 status                      # Check PM2 status"
echo "  pm2 restart zakaa-api           # Restart backend"
echo "  sudo systemctl status nginx     # Check Nginx"
echo "  sudo tail -f /var/log/nginx/zakaa-error.log  # Nginx errors"
echo ""
echo -e "${GREEN}Happy managing! 🚀${NC}"
