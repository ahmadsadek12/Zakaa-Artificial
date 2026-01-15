#!/bin/bash
# Setup Production Environment for EC2

echo "🔐 Setting up production .env file..."

# Get RDS endpoint from user
echo ""
echo "Enter your RDS endpoint (e.g., zakaa-mysql.xxxx.us-east-1.rds.amazonaws.com):"
read RDS_ENDPOINT

if [ -z "$RDS_ENDPOINT" ]; then
    echo "❌ RDS endpoint is required!"
    exit 1
fi

# EC2 IP
EC2_IP="52.28.59.163"

# Create production .env
cat > .env << EOF
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
API_BASE_URL=http://${EC2_IP}
CORS_ORIGIN=http://${EC2_IP},https://${EC2_IP}

# RDS MySQL Configuration
MYSQL_HOST=${RDS_ENDPOINT}
MYSQL_PORT=3306
MYSQL_USER=admin
MYSQL_PASSWORD=Zaka2Art1fic1al*2026
MYSQL_DATABASE=zakaa_db

# MongoDB (Optional - comment out if not using)
# MONGODB_HOST=localhost
# MONGODB_PORT=27017
# MONGODB_DATABASE=zakaa_db

# Security - Auto-generated
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
ENCRYPTION_KEY=$(openssl rand -hex 32)

# WhatsApp Business API
WHATSAPP_API_VERSION=v21.0
WHATSAPP_VERIFY_TOKEN=

# WhatsApp Provider (add your credentials after deployment)
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=

# OpenAI (add your key after deployment)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=10000
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_RPM=60
OPENAI_MAX_RETRIES=3

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_SCHEDULED_ORDERS=true

# Cart Cleanup
CART_CLEANUP_AGE_HOURS=24
CART_CLEANUP_CRON=0 */6 * * *

# Logging
LOG_LEVEL=info
EOF

echo ""
echo "✅ Production .env created!"
echo ""
echo "Configuration:"
echo "  RDS Host: ${RDS_ENDPOINT}"
echo "  MySQL User: admin"
echo "  MySQL DB: zakaa_db"
echo ""

# Test RDS connection
echo "Testing RDS connection..."
if command -v mysql &> /dev/null; then
    if mysql -h "${RDS_ENDPOINT}" -u admin -p'Zaka2Art1fic1al*2026' -e "SELECT 1;" 2>/dev/null; then
        echo "✅ RDS connection successful!"
    else
        echo "⚠️  RDS connection failed - check endpoint and security group"
        echo "   Make sure RDS security group allows port 3306 from this EC2"
    fi
else
    echo "⚠️  MySQL client not installed - skipping connection test"
    echo "   Install with: sudo apt install mysql-client"
fi

echo ""
echo "📋 Next steps:"
echo "  1. Initialize database: npm run init"
echo "  2. Create admin: node scripts/create-admin.js"
echo "  3. Deploy: ./deploy-to-ec2.sh"
