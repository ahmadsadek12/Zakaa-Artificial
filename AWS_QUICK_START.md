# AWS Quick Start Guide (15 Minutes)

## ⚡ Fast Track Deployment

This is a condensed version for experienced users. See `AWS_DEPLOYMENT_GUIDE.md` for detailed instructions.

### Prerequisites
- AWS account with billing enabled
- Domain name (optional but recommended)
- OpenAI API key
- WhatsApp/Telegram bot tokens

---

## 🚀 Quick Steps

### 1. RDS MySQL (5 min)
```bash
# Via AWS Console
RDS → Create Database
- MySQL 8.0, db.t3.micro
- Public access: Yes
- Security group: 0.0.0.0/0:3306

# Initialize
mysql -h RDS_HOST -u admin -p
CREATE DATABASE zakaa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. MongoDB Atlas (3 min)
```bash
# Visit mongodb.com/cloud/atlas
- Create M0 (free) cluster
- Allow access from anywhere (0.0.0.0/0)
- Get connection string
```

### 3. S3 Bucket (2 min)
```bash
aws s3 mb s3://zakaa-uploads-prod
aws s3api put-bucket-policy --bucket zakaa-uploads-prod --policy file://s3-policy.json

# s3-policy.json:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::zakaa-uploads-prod/*"
  }]
}
```

### 4. EC2 Instance (5 min)
```bash
# Launch instance
EC2 → Launch Instance
- Ubuntu 22.04, t3.small
- Key pair: zakaa-key.pem
- Security group: 22, 80, 443, 3000

# Allocate Elastic IP
EC2 → Elastic IPs → Allocate → Associate with instance
```

### 5. Setup EC2 (5 min)
```bash
# SSH to server
ssh -i zakaa-key.pem ubuntu@ELASTIC_IP

# Run setup script
curl -O https://raw.githubusercontent.com/YOUR_REPO/setup-ec2.sh
bash setup-ec2.sh

# Clone & configure
cd /home/ubuntu/apps
git clone YOUR_REPO zakaa
cd zakaa
nano .env  # Paste your config (see template below)
npm install --production

# Start app
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure Nginx
sudo cp nginx.conf /etc/nginx/sites-available/zakaa
sudo ln -s /etc/nginx/sites-available/zakaa /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📝 .env Template

```bash
# Server
NODE_ENV=production
PORT=3000
API_URL=http://YOUR_ELASTIC_IP

# JWT
JWT_SECRET=GENERATE_RANDOM_32_CHAR_STRING

# MySQL (RDS)
MYSQL_HOST=zakaa-mysql.xxxxx.rds.amazonaws.com
MYSQL_PORT=3306
MYSQL_USER=admin
MYSQL_PASSWORD=YOUR_PASSWORD
MYSQL_DATABASE=zakaa

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/zakaa

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET=zakaa-uploads-prod

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_RPM=60

# WhatsApp
WHATSAPP_VERIFY_TOKEN=YOUR_VERIFY_TOKEN

# Telegram
TELEGRAM_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

---

## 🔗 Configure Webhooks

### WhatsApp
```
URL: http://YOUR_ELASTIC_IP/webhook/whatsapp
Verify Token: YOUR_VERIFY_TOKEN
```

### Telegram
```bash
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -d "url=http://YOUR_ELASTIC_IP/webhook/telegram" \
  -d "secret_token=YOUR_WEBHOOK_SECRET"
```

---

## ✅ Verify Deployment

```bash
# Check app status
pm2 status
pm2 logs zakaa-api

# Test API
curl http://YOUR_ELASTIC_IP/health

# Test webhook
curl -X POST http://YOUR_ELASTIC_IP/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## 🔄 Deploy Updates

```bash
ssh -i zakaa-key.pem ubuntu@ELASTIC_IP
cd /home/ubuntu/apps/zakaa
./deploy.sh
```

---

## 💰 Monthly Cost: ~$40

- EC2 t3.small: $15
- RDS db.t3.micro: $15
- MongoDB Atlas M0: Free
- S3: ~$10
- **Total: ~$40/month**

---

## 🆘 Troubleshooting

```bash
# Check logs
pm2 logs zakaa-api
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart zakaa-api
sudo systemctl restart nginx

# Check connections
mysql -h RDS_HOST -u admin -p
```

---

## 🔒 Security (Do After Setup!)

```bash
# Restrict RDS to EC2 IP only
RDS Security Group → Edit Inbound Rules
Remove 0.0.0.0/0, add EC2_ELASTIC_IP/32

# Restrict SSH to your IP only
EC2 Security Group → Edit Inbound Rules
Port 22: YOUR_IP/32 (not 0.0.0.0/0)

# Setup SSL (if you have a domain)
sudo certbot --nginx -d api.yourdomain.com
```

---

## 📚 Full Guide

See `AWS_DEPLOYMENT_GUIDE.md` for comprehensive documentation.

**Done! Your app is now live on AWS! 🎉**
