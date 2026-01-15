#!/bin/bash
# Setup RDS Environment for EC2

echo "🔐 Setting up production .env with RDS..."

# Get RDS endpoint
echo ""
echo "Enter your RDS endpoint:"
read -p "(e.g., zakaa-mysql.xxxx.us-east-1.rds.amazonaws.com): " RDS_ENDPOINT

if [ -z "$RDS_ENDPOINT" ]; then
    echo "❌ RDS endpoint is required!"
    exit 1
fi

# Get RDS password
read -sp "Enter RDS password (default: Zaka2Art1fic1al*2026): " RDS_PASSWORD
RDS_PASSWORD=${RDS_PASSWORD:-Zaka2Art1fic1al*2026}
echo ""

# Create production .env
cat > .env << EOF
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=http://52.28.59.163,https://52.28.59.163

# RDS MySQL Configuration
MYSQL_HOST=${RDS_ENDPOINT}
MYSQL_PORT=3306
MYSQL_USER=admin
MYSQL_PASSWORD=${RDS_PASSWORD}
MYSQL_DATABASE=zakaa_db

# Security
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
ENCRYPTION_KEY=$(openssl rand -hex 32)

# WhatsApp
WHATSAPP_API_VERSION=v21.0
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_PROVIDER=twilio

# Add your API keys manually after this setup
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=

# OpenAI Settings
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=10000
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_RPM=60
OPENAI_MAX_RETRIES=3

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_SCHEDULED_ORDERS=true
CART_CLEANUP_AGE_HOURS=24
CART_CLEANUP_CRON=0 */6 * * *
LOG_LEVEL=info
EOF

echo ""
echo "✅ .env file created!"
echo ""
echo "Configuration:"
echo "  RDS: ${RDS_ENDPOINT}"
echo "  Database: zakaa_db"
echo ""

# Test connection
echo "Testing RDS connection..."
if command -v mysql &> /dev/null; then
    if mysql -h "${RDS_ENDPOINT}" -u admin -p"${RDS_PASSWORD}" -e "SELECT 1;" 2>/dev/null; then
        echo "✅ RDS connected!"
        echo ""
        echo "📋 Next: Run ./deploy-to-ec2.sh"
    else
        echo "⚠️  Connection failed - check security group allows port 3306"
    fi
else
    sudo apt install -y mysql-client
fi
