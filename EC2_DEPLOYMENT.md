# EC2 Deployment Guide - Zakaa Admin Dashboard

## Quick Deploy to: https://52.28.59.163/

This guide will help you deploy the complete Zakaa application with admin dashboard to your EC2 instance.

---

## Prerequisites

Your EC2 instance should have:
- ✅ Ubuntu 20.04+ / Amazon Linux 2
- ✅ Node.js v14+ installed
- ✅ MySQL running
- ✅ MongoDB running (optional, for logs)
- ✅ Nginx installed
- ✅ PM2 installed globally

---

## Step 1: Prepare Environment Variables

Create `.env` file in the project root:

```bash
cat > .env << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CORS Configuration - Allow access from EC2 public IP
CORS_ORIGIN=http://52.28.59.163,https://52.28.59.163

# Database Configuration
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=zakaa_db

# MongoDB Configuration (optional)
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=zakaa_db

# Security - GENERATE THESE!
JWT_SECRET=REPLACE_WITH_GENERATED_SECRET
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
ENCRYPTION_KEY=REPLACE_WITH_GENERATED_KEY

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key_here

# WhatsApp Configuration (Meta)
WHATSAPP_API_VERSION=v18.0
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token

# Logging
LOG_LEVEL=info
EOF
```

**Generate Strong Secrets:**
```bash
# Generate JWT Secret
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')"

# Generate Encryption Key
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Copy the generated values and update your `.env` file.

---

## Step 2: Initialize Database

```bash
# Initialize MySQL database
npm run init

# Create admin account
node scripts/create-admin.js
```

**Admin Credentials:**
- Email: `admin@zakaa-artificial.com`
- Password: `Z@ka2@dm1n*`

---

## Step 3: Build Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create production .env
cat > .env << 'EOF'
VITE_API_URL=http://52.28.59.163
EOF

# Build for production
npm run build

# Go back to root
cd ..
```

The build will create `frontend/dist` folder.

---

## Step 4: Configure Nginx

Create nginx configuration:

```bash
sudo tee /etc/nginx/sites-available/zakaa << 'EOF'
# Zakaa Application Configuration
# Backend API + Frontend Static Files

server {
    listen 80;
    server_name 52.28.59.163;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Increase body size for uploads
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/x-javascript;

    # Frontend - React App
    location / {
        root /home/ubuntu/Zakaa-Artificial/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running requests (OpenAI API calls)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Webhooks
    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Keep raw body for signature verification
        proxy_set_header Content-Type $content_type;
        proxy_pass_request_body on;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/health;
    }

    # Logging
    access_log /var/log/nginx/zakaa-access.log;
    error_log /var/log/nginx/zakaa-error.log;
}
EOF
```

**Enable the configuration:**
```bash
# Create symlink
sudo ln -sf /etc/nginx/sites-available/zakaa /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Step 5: Start Backend with PM2

```bash
# Install dependencies
npm install --production

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 startup on boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status

# View logs
pm2 logs zakaa-api
```

---

## Step 6: Verify Deployment

### Test Backend
```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Test from Browser
1. Open: `http://52.28.59.163/`
2. You should see the Zakaa login page
3. Login with admin credentials
4. You'll be redirected to admin dashboard

---

## Step 7: Configure Security Groups (AWS)

Ensure your EC2 security group allows:

**Inbound Rules:**
- Type: HTTP
- Protocol: TCP
- Port: 80
- Source: 0.0.0.0/0 (or your IP)

- Type: HTTPS
- Protocol: TCP
- Port: 443
- Source: 0.0.0.0/0 (or your IP)

- Type: Custom TCP
- Protocol: TCP
- Port: 3000
- Source: 127.0.0.1/32 (localhost only)

---

## Step 8: Setup SSL (Optional - Requires Domain)

**Note:** SSL certificates from Let's Encrypt require a domain name. For IP-only access, you can:

### Option A: Self-Signed Certificate (For Testing)

```bash
# Generate self-signed certificate
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/zakaa.key \
  -out /etc/nginx/ssl/zakaa.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=52.28.59.163"
```

Update nginx config:
```bash
sudo tee -a /etc/nginx/sites-available/zakaa << 'EOF'

# HTTPS with Self-Signed Certificate
server {
    listen 443 ssl http2;
    server_name 52.28.59.163;

    ssl_certificate /etc/nginx/ssl/zakaa.crt;
    ssl_certificate_key /etc/nginx/ssl/zakaa.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # Same configuration as HTTP server above
    # ... (copy all location blocks)
}
EOF

# Reload nginx
sudo systemctl reload nginx
```

**Note:** Browsers will show a security warning for self-signed certificates.

### Option B: Use a Domain (Recommended)

1. Get a domain name (e.g., zakaa.yourdomain.com)
2. Point A record to: 52.28.59.163
3. Install certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   ```
4. Get certificate:
   ```bash
   sudo certbot --nginx -d zakaa.yourdomain.com
   ```

---

## Step 9: Post-Deployment Checks

### 1. Check Services
```bash
# Backend status
pm2 status

# Nginx status
sudo systemctl status nginx

# MySQL status
sudo systemctl status mysql

# MongoDB status (if using)
sudo systemctl status mongod
```

### 2. Check Logs
```bash
# Application logs
pm2 logs zakaa-api --lines 50

# Nginx logs
sudo tail -f /var/log/nginx/zakaa-access.log
sudo tail -f /var/log/nginx/zakaa-error.log
```

### 3. Test Admin Dashboard
1. Navigate to: `http://52.28.59.163/`
2. Login: `admin@zakaa-artificial.com` / `Z@ka2@dm1n*`
3. Check admin dashboard loads
4. Test creating a business
5. Test adding a branch
6. Verify statistics display

---

## Complete Deployment Script

Create `deploy-to-ec2.sh`:

```bash
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
PROJECT_DIR="$HOME/Zakaa-Artificial"
EC2_IP="52.28.59.163"

cd $PROJECT_DIR

# Step 1: Pull latest code (if using git)
echo -e "${YELLOW}📥 Pulling latest code...${NC}"
# git pull origin main

# Step 2: Check environment variables
echo -e "${YELLOW}🔐 Checking environment variables...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create .env file first (see Step 1 in documentation)"
    exit 1
fi

# Step 3: Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
npm install --production

# Step 4: Initialize database
echo -e "${YELLOW}🗄️ Initializing database...${NC}"
npm run init || echo "Database already initialized"

# Step 5: Create admin account
echo -e "${YELLOW}👤 Creating admin account...${NC}"
node scripts/create-admin.js || echo "Admin account already exists"

# Step 6: Build frontend
echo -e "${YELLOW}🏗️ Building frontend...${NC}"
cd frontend
npm install

# Create frontend .env
cat > .env << EOF
VITE_API_URL=http://${EC2_IP}
EOF

npm run build
cd ..

# Step 7: Configure Nginx (requires sudo)
echo -e "${YELLOW}⚙️ Configuring Nginx...${NC}"
echo "You may need to enter your password for sudo commands"

# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/zakaa

# Update server_name with EC2 IP
sudo sed -i "s/YOUR_ELASTIC_IP/${EC2_IP}/g" /etc/nginx/sites-available/zakaa

# Enable site
sudo ln -sf /etc/nginx/sites-available/zakaa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Step 8: Start/Restart backend with PM2
echo -e "${YELLOW}🔄 Starting backend with PM2...${NC}"
pm2 delete zakaa-api || true
pm2 start ecosystem.config.js
pm2 save

# Step 9: Verify deployment
echo -e "${YELLOW}✅ Verifying deployment...${NC}"
sleep 3

# Check backend health
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    pm2 logs zakaa-api --lines 20
    exit 1
fi

# Check nginx
if sudo nginx -t > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Access your application at:"
echo -e "${GREEN}http://${EC2_IP}/${NC}"
echo ""
echo "Admin Credentials:"
echo "  Email: admin@zakaa-artificial.com"
echo "  Password: Z@ka2@dm1n*"
echo ""
echo "Useful commands:"
echo "  pm2 logs zakaa-api     # View backend logs"
echo "  pm2 status             # Check PM2 status"
echo "  sudo systemctl status nginx  # Check Nginx status"
echo ""
```

Make it executable and run:
```bash
chmod +x deploy-to-ec2.sh
./deploy-to-ec2.sh
```

---

## Troubleshooting

### Backend not starting
```bash
# Check logs
pm2 logs zakaa-api

# Common issues:
# 1. Port 3000 already in use
sudo lsof -i :3000
# Kill process: sudo kill -9 <PID>

# 2. Database connection failed
# Check MySQL is running
sudo systemctl status mysql

# 3. Environment variables missing
# Verify .env file exists and has all required variables
cat .env
```

### Frontend not loading
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/zakaa-error.log

# Verify build folder exists
ls -la frontend/dist/

# Rebuild if necessary
cd frontend && npm run build && cd ..
```

### Cannot access from browser
```bash
# Check nginx is running
sudo systemctl status nginx

# Check nginx config
sudo nginx -t

# Check EC2 security group allows port 80/443

# Test locally first
curl http://localhost/
curl http://localhost/api/health
```

### Database connection issues
```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u root -p -e "SHOW DATABASES;"

# Check .env has correct credentials
```

---

## Monitoring & Maintenance

### View Logs
```bash
# Backend logs
pm2 logs zakaa-api --lines 100

# Nginx access logs
sudo tail -f /var/log/nginx/zakaa-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/zakaa-error.log

# System logs
sudo journalctl -u nginx -f
```

### Restart Services
```bash
# Restart backend
pm2 restart zakaa-api

# Restart nginx
sudo systemctl restart nginx

# Restart all
pm2 restart all && sudo systemctl restart nginx
```

### Update Deployment
```bash
# Run the deployment script again
./deploy-to-ec2.sh

# Or manually:
cd frontend && npm run build && cd ..
pm2 restart zakaa-api
sudo systemctl reload nginx
```

---

## Security Checklist

- [x] Changed default admin password
- [ ] Generated strong JWT_SECRET
- [ ] Generated strong ENCRYPTION_KEY
- [ ] Configured CORS_ORIGIN properly
- [ ] EC2 security group properly configured
- [ ] Nginx security headers enabled
- [ ] Rate limiting configured
- [ ] Regular backups scheduled
- [ ] SSL certificate installed (if using domain)
- [ ] Firewall configured (ufw)
- [ ] Database user permissions restricted

---

## Next Steps

1. **Run the deployment script**
   ```bash
   ./deploy-to-ec2.sh
   ```

2. **Access your application**
   - Navigate to: `http://52.28.59.163/`
   - Login with admin credentials

3. **Change admin password**
   - Go to `/admin/profile`
   - Change to a secure password

4. **Test all features**
   - Create a test business
   - Add a test branch
   - Verify statistics work

5. **Set up monitoring**
   - Configure CloudWatch
   - Set up alerts
   - Schedule backups

---

## Support

For issues or questions:
- Check logs: `pm2 logs zakaa-api`
- Review nginx logs: `sudo tail -f /var/log/nginx/zakaa-error.log`
- Check documentation: See other MD files in project root

---

**Status**: Ready to deploy! 🚀

Run: `./deploy-to-ec2.sh`
