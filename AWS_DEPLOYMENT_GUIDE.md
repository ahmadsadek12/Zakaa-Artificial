# AWS Deployment Guide for Zakaa

## 📋 Overview

This guide will help you deploy Zakaa to AWS with the following architecture:
- **EC2**: Node.js backend + Nginx reverse proxy
- **RDS MySQL**: Main database
- **MongoDB Atlas**: Conversation logs (free tier available)
- **S3**: File storage for images
- **Elastic IP**: Static IP for WhatsApp/Telegram webhooks

**Estimated Monthly Cost**: $30-50 (t3.small EC2 + db.t3.micro RDS)

---

## 🎯 Step 1: AWS Account Setup

### Create AWS Account
1. Go to https://aws.amazon.com
2. Click "Create an AWS Account"
3. Complete registration (requires credit card)
4. Enable MFA for security

### Install AWS CLI
```bash
# Windows (via installer)
# Download from: https://awscli.amazonaws.com/AWSCLIV2.msi

# Verify installation
aws --version
```

### Configure AWS CLI
```bash
# Create IAM user with AdministratorAccess
# Get Access Key ID and Secret Access Key from AWS Console

aws configure
# AWS Access Key ID: YOUR_KEY
# AWS Secret Access Key: YOUR_SECRET
# Default region: us-east-1  (or your preferred region)
# Default output format: json
```

---

## 🗄️ Step 2: Create RDS MySQL Database

### Via AWS Console:
1. Go to **RDS** → **Create database**
2. Choose:
   - **Engine**: MySQL 8.0
   - **Template**: Free tier (or Dev/Test)
   - **DB instance identifier**: zakaa-mysql
   - **Master username**: admin
   - **Master password**: (create strong password)
   - **DB instance class**: db.t3.micro (1GB RAM, 2 vCPU)
   - **Storage**: 20 GB SSD
   - **Public access**: Yes (for initial setup, restrict later)
   - **VPC security group**: Create new → zakaa-mysql-sg
   - **Inbound rule**: MySQL/Aurora (3306) from Anywhere (0.0.0.0/0) - temporary

3. Click **Create database** (takes 5-10 minutes)

### Save these values:
```
RDS_HOST=zakaa-mysql.xxxxx.us-east-1.rds.amazonaws.com
RDS_PORT=3306
RDS_USER=admin
RDS_PASSWORD=your_password
RDS_DATABASE=zakaa
```

### Initialize Database:
```bash
# Connect from your local machine
mysql -h zakaa-mysql.xxxxx.us-east-1.rds.amazonaws.com -u admin -p

# Create database
CREATE DATABASE zakaa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE zakaa;

# Run your schema (upload schema.sql)
SOURCE database/schema.sql;
```

---

## 🍃 Step 3: Setup MongoDB Atlas (Free)

### Create MongoDB Atlas Account:
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create free account
3. Create cluster:
   - **Provider**: AWS
   - **Region**: Same as your EC2 (e.g., us-east-1)
   - **Tier**: M0 (Free)
   - **Cluster Name**: zakaa-mongo

4. Create database user:
   - Username: zakaa_user
   - Password: (generate strong password)

5. Whitelist IP:
   - Click **Network Access** → **Add IP Address**
   - Choose **Allow access from anywhere** (0.0.0.0/0)
   - (Later: restrict to your EC2 IP only)

6. Get connection string:
   - Click **Connect** → **Connect your application**
   - Copy connection string:
   ```
   mongodb+srv://zakaa_user:PASSWORD@zakaa-mongo.xxxxx.mongodb.net/zakaa?retryWrites=true&w=majority
   ```

---

## 📦 Step 4: Setup S3 Bucket for Images

### Via AWS Console:
1. Go to **S3** → **Create bucket**
2. Settings:
   - **Bucket name**: zakaa-uploads-prod (must be globally unique)
   - **Region**: us-east-1 (same as EC2)
   - **Block all public access**: OFF (we need public read for images)
   - **Bucket versioning**: Disabled
   - **Tags**: app=zakaa

3. Configure bucket policy for public read:
   - Go to bucket → **Permissions** → **Bucket policy**
   - Add this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::zakaa-uploads-prod/*"
    }
  ]
}
```

4. Configure CORS:
   - Go to **Permissions** → **CORS**
   - Add:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Create IAM User for S3 Access:
1. Go to **IAM** → **Users** → **Add user**
2. **Username**: zakaa-s3-user
3. **Access type**: Programmatic access
4. **Permissions**: Attach policy **AmazonS3FullAccess** (or create custom policy for zakaa-uploads-prod only)
5. Save **Access Key ID** and **Secret Access Key**

---

## 🖥️ Step 5: Launch EC2 Instance

### Via AWS Console:
1. Go to **EC2** → **Launch Instance**
2. Settings:
   - **Name**: zakaa-backend
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance type**: t3.small (2 vCPU, 2GB RAM) - recommended
     - Or t3.micro (1 vCPU, 1GB RAM) for testing
   - **Key pair**: Create new → zakaa-key.pem (download and save securely!)
   - **Network settings**:
     - VPC: default
     - **Security group**: Create new → zakaa-sg
     - Inbound rules:
       - SSH (22) - Your IP only
       - HTTP (80) - Anywhere
       - HTTPS (443) - Anywhere
       - Custom TCP (3000) - Anywhere (for direct API access)
   - **Storage**: 20 GB gp3
   - **Advanced details** → **User data** (optional, for auto-setup):

```bash
#!/bin/bash
apt-get update
apt-get install -y git curl
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
npm install -g pm2
```

3. Click **Launch instance**

### Allocate Elastic IP:
1. Go to **EC2** → **Elastic IPs** → **Allocate Elastic IP address**
2. Click **Allocate**
3. Select the new IP → **Actions** → **Associate Elastic IP address**
4. Choose your zakaa-backend instance
5. **Note down this IP** - you'll use it for webhooks!

---

## 🔧 Step 6: Connect to EC2 and Install Dependencies

### Connect via SSH:
```bash
# Windows (PowerShell)
ssh -i "zakaa-key.pem" ubuntu@YOUR_ELASTIC_IP

# If permission error on Windows:
# Right-click zakaa-key.pem → Properties → Security → Advanced
# Disable inheritance → Remove all permissions → Add your user with Read permission
```

### Install Node.js, PM2, and Nginx:
```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v18.x
npm --version

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt-get install -y nginx

# Install MySQL client (for database access)
sudo apt-get install -y mysql-client

# Install Git
sudo apt-get install -y git
```

---

## 📂 Step 7: Deploy Your Application

### Clone Repository:
```bash
# Create app directory
cd /home/ubuntu
mkdir -p apps
cd apps

# If using Git:
git clone YOUR_REPO_URL zakaa
cd zakaa

# Or upload via SCP from local machine:
# scp -i zakaa-key.pem -r C:\Users\96170\Desktop\Zakaa-Artificial ubuntu@YOUR_ELASTIC_IP:/home/ubuntu/apps/zakaa
```

### Create .env file:
```bash
cd /home/ubuntu/apps/zakaa
nano .env
```

Paste this configuration (replace with your actual values):

```bash
# Server
NODE_ENV=production
PORT=3000
API_URL=http://YOUR_ELASTIC_IP:3000

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_min_32_chars

# MySQL Database (RDS)
MYSQL_HOST=zakaa-mysql.xxxxx.us-east-1.rds.amazonaws.com
MYSQL_PORT=3306
MYSQL_USER=admin
MYSQL_PASSWORD=your_rds_password
MYSQL_DATABASE=zakaa

# MongoDB Atlas
MONGODB_URI=mongodb+srv://zakaa_user:PASSWORD@zakaa-mongo.xxxxx.mongodb.net/zakaa?retryWrites=true&w=majority

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_s3_access_key
AWS_SECRET_ACCESS_KEY=your_s3_secret_key
AWS_S3_BUCKET=zakaa-uploads-prod

# OpenAI
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_RPM=60
OPENAI_MAX_RETRIES=3

# WhatsApp (Meta Business)
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_API_VERSION=v21.0

# Telegram
TELEGRAM_WEBHOOK_SECRET=your_telegram_webhook_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
```

Save: `Ctrl+X` → `Y` → `Enter`

### Install Dependencies:
```bash
cd /home/ubuntu/apps/zakaa
npm install --production
```

### Initialize Database:
```bash
# Run migrations
npm run init
```

### Start Application with PM2:
```bash
# Start app
pm2 start server.js --name zakaa-api

# Save PM2 config (auto-restart on reboot)
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs zakaa-api
```

---

## 🌐 Step 8: Configure Nginx Reverse Proxy

### Create Nginx config:
```bash
sudo nano /etc/nginx/sites-available/zakaa
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name YOUR_ELASTIC_IP;

    # Increase body size for image uploads
    client_max_body_size 10M;

    # API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running requests (OpenAI)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Save and enable:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/zakaa /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable on boot
sudo systemctl enable nginx
```

---

## 🔒 Step 9: Setup SSL with Let's Encrypt (Optional but Recommended)

### If you have a domain name:

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

### Update Nginx config for SSL:
Certbot will automatically update your Nginx config to redirect HTTP to HTTPS.

---

## 📱 Step 10: Configure Webhooks

### WhatsApp Webhook:
1. Go to Meta for Developers: https://developers.facebook.com
2. Your App → WhatsApp → Configuration
3. **Webhook URL**: `http://YOUR_ELASTIC_IP/webhook/whatsapp`
4. **Verify Token**: (from your .env `WHATSAPP_VERIFY_TOKEN`)
5. Subscribe to: `messages`

### Telegram Webhook:
```bash
# Set webhook
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://YOUR_ELASTIC_IP/webhook/telegram", "secret_token": "YOUR_TELEGRAM_WEBHOOK_SECRET"}'
```

---

## 🎉 Step 11: Deploy Frontend (Optional - Static Hosting)

### Option A: S3 + CloudFront (Recommended)

1. Build frontend:
```bash
cd frontend
npm install
npm run build
```

2. Upload to S3:
```bash
# Create bucket for frontend
aws s3 mb s3://zakaa-frontend-prod

# Upload build files
aws s3 sync dist/ s3://zakaa-frontend-prod --acl public-read

# Configure as static website
aws s3 website s3://zakaa-frontend-prod --index-document index.html --error-document index.html
```

3. Setup CloudFront CDN (optional for HTTPS and speed)

### Option B: Serve from EC2 with Nginx

```bash
# Copy build files to EC2
scp -i zakaa-key.pem -r frontend/dist ubuntu@YOUR_ELASTIC_IP:/home/ubuntu/apps/zakaa-frontend

# Update Nginx config to serve frontend
sudo nano /etc/nginx/sites-available/zakaa
```

Add this location block:

```nginx
# Frontend
location / {
    root /home/ubuntu/apps/zakaa-frontend;
    try_files $uri $uri/ /index.html;
}

# API (move existing location to /api)
location /api {
    proxy_pass http://localhost:3000/api;
    # ... rest of proxy config
}
```

---

## 📊 Step 12: Monitoring & Maintenance

### PM2 Monitoring:
```bash
# View logs
pm2 logs zakaa-api

# Monitor resources
pm2 monit

# Restart app
pm2 restart zakaa-api

# View detailed info
pm2 info zakaa-api
```

### System Monitoring:
```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
top

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Automated Backups (RDS):
1. Go to **RDS** → Your database → **Maintenance & backups**
2. **Automated backups**: Enable
3. **Backup retention period**: 7 days
4. **Backup window**: Choose off-peak time

---

## 🔄 Step 13: Deployment Updates

### Deploy code updates:

```bash
# SSH to server
ssh -i zakaa-key.pem ubuntu@YOUR_ELASTIC_IP

# Go to app directory
cd /home/ubuntu/apps/zakaa

# Pull latest code
git pull

# Install new dependencies
npm install --production

# Run migrations if needed
npm run migrate

# Restart app
pm2 restart zakaa-api

# Check logs
pm2 logs zakaa-api --lines 50
```

---

## 🛡️ Security Checklist

- [ ] Changed all default passwords
- [ ] Restricted RDS security group to EC2 IP only
- [ ] Restricted MongoDB Atlas to EC2 IP only
- [ ] EC2 SSH restricted to your IP only
- [ ] Using Elastic IP (static) for webhooks
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Regular backups enabled
- [ ] CloudWatch alarms set up (optional)
- [ ] IAM users have minimal permissions
- [ ] `.env` file has secure secrets
- [ ] PM2 configured to restart on crash

---

## 💰 Cost Estimate (Monthly)

| Service | Configuration | Cost |
|---------|--------------|------|
| EC2 t3.small | 2 vCPU, 2GB RAM | ~$15 |
| RDS db.t3.micro | 1 vCPU, 1GB RAM | ~$15 |
| MongoDB Atlas M0 | Free tier | $0 |
| S3 Storage | ~10GB | ~$0.23 |
| Data Transfer | ~100GB | ~$9 |
| Elastic IP | 1 IP | $0 (when associated) |
| **Total** | | **~$40/month** |

Scale up as needed:
- EC2 t3.medium (4GB RAM): ~$30/month
- RDS db.t3.small (2GB RAM): ~$30/month

---

## 🆘 Troubleshooting

### App won't start:
```bash
pm2 logs zakaa-api --lines 100
# Check for errors in .env configuration
```

### Database connection errors:
```bash
# Test MySQL connection
mysql -h YOUR_RDS_HOST -u admin -p

# Check security group allows EC2 IP
```

### Webhook not receiving messages:
```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/access.log

# Test webhook endpoint
curl http://YOUR_ELASTIC_IP/webhook/whatsapp
```

### Out of memory:
```bash
# Check memory usage
free -h

# Increase EC2 instance size or add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📞 Support

- AWS Support: https://console.aws.amazon.com/support/
- MongoDB Atlas Support: https://www.mongodb.com/cloud/atlas/support
- PM2 Docs: https://pm2.keymetrics.io/docs/

---

## 🎯 Next Steps

1. Set up domain name (Route 53 or external registrar)
2. Configure CloudFront CDN for better performance
3. Set up CloudWatch alarms for monitoring
4. Configure automated deployments (GitHub Actions + AWS CodeDeploy)
5. Implement log aggregation (CloudWatch Logs or ELK stack)
6. Set up staging environment for testing

Good luck! 🚀
