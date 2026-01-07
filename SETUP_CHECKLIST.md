# Zakaa API - Setup Checklist

## ✅ Already Complete

- ✅ Database schema (MySQL & MongoDB)
- ✅ Project structure
- ✅ All routes implemented
- ✅ Authentication system
- ✅ WhatsApp webhook handler
- ✅ LLM chatbot integration
- ✅ Order management
- ✅ Archive service
- ✅ Analytics (Premium)
- ✅ All repositories and services

## 🔧 Required Configuration

### 1. Environment Variables (.env)

You need to update these values in your `.env` file:

#### **Critical (Required for Basic Functionality):**

```env
# JWT Secret (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-here-change-this
# Generate with: openssl rand -hex 32

# Encryption Key for WhatsApp Tokens (REQUIRED)
ENCRYPTION_KEY=your-32-byte-hex-encryption-key-here
# Generate with: openssl rand -hex 32

# OpenAI API Key (REQUIRED for LLM chatbot)
OPENAI_API_KEY=sk-your-openai-api-key-here
# Get from: https://platform.openai.com/api-keys
```

#### **WhatsApp Integration (Required if using WhatsApp):**

```env
# WhatsApp Webhook Verification Token
WHATSAPP_VERIFY_TOKEN=your-secure-webhook-verify-token
# Generate a random string (used for webhook verification)

# WhatsApp Webhook Secret (optional, for signature verification)
WHATSAPP_WEBHOOK_SECRET=your-webhook-secret
```

#### **AWS S3 (Required if using image uploads):**

```env
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key

# S3 Bucket
S3_BUCKET_NAME=zakaa-images
# Create bucket in AWS S3 and update name here

S3_BASE_URL=https://zakaa-images.s3.amazonaws.com
# Update with your actual bucket URL
```

#### **Already Configured (You can keep these):**

```env
# Database (Already set)
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=A76891114s*
MYSQL_DATABASE=zakaa_db

MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=zakaa_db

# Server
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# JWT (keep defaults or customize)
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# WhatsApp API
WHATSAPP_API_VERSION=v21.0

# OpenAI (keep defaults or customize)
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7

# Archival
ARCHIVE_JOB_CRON=0 2 * * *
ARCHIVE_ORDER_AGE_HOURS=24

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_SCHEDULED_ORDERS=true
```

### 2. Generate Required Secrets

Run these commands to generate secure keys:

```bash
# Generate JWT Secret
openssl rand -hex 32

# Generate Encryption Key
openssl rand -hex 32

# Generate WhatsApp Verify Token
openssl rand -hex 16
```

Copy the outputs and update your `.env` file.

### 3. External Service Setup

#### **A. OpenAI API (Required)**
1. Go to https://platform.openai.com/api-keys
2. Create an account (if needed)
3. Generate a new API key
4. Copy the key and add to `.env` as `OPENAI_API_KEY`

#### **B. WhatsApp Business API (Required for WhatsApp)**
1. Set up Meta Business Account
2. Create WhatsApp Business App
3. Get Phone Number ID and Access Token
4. Configure webhook:
   - Webhook URL: `https://yourdomain.com/webhook/whatsapp`
   - Verify Token: Use `WHATSAPP_VERIFY_TOKEN` from `.env`
   - Subscribe to `messages` events

#### **C. AWS S3 (Required for image uploads)**
1. Create AWS account
2. Create S3 bucket (e.g., `zakaa-images`)
3. Enable public read access for images
4. Create IAM user with S3 access
5. Get Access Key ID and Secret Access Key
6. Update `.env` with credentials

#### **D. MySQL & MongoDB (Already Configured)**
- MySQL: Running on 127.0.0.1:3306
- MongoDB: Running on localhost:27017

### 4. Database Initialization

Run these commands:

```bash
# Install dependencies (if not done)
npm install

# Initialize databases
npm run init

# Run full schema migration
node database/migration_full_schema.js
```

### 5. Test the Application

```bash
# Start the server
npm start

# Or in development mode with auto-reload
npm run dev
```

Then test:
- `GET http://localhost:3000/health` - Health check
- `GET http://localhost:3000/health/db` - Database health

## 📋 Quick Setup Steps

1. **Generate Secrets:**
   ```bash
   # Generate JWT secret
   openssl rand -hex 32 > jwt_secret.txt
   
   # Generate encryption key
   openssl rand -hex 32 > encryption_key.txt
   ```

2. **Update .env file:**
   - Copy generated secrets to `.env`
   - Add OpenAI API key
   - Add AWS S3 credentials (if using images)
   - Add WhatsApp credentials (if using WhatsApp)

3. **Initialize Databases:**
   ```bash
   npm run init
   node database/migration_full_schema.js
   ```

4. **Start Server:**
   ```bash
   npm start
   ```

5. **Test Endpoints:**
   - Health: `curl http://localhost:3000/health`
   - Register: `POST http://localhost:3000/api/auth/register`

## 🔍 What You Need to Provide

### Minimum Required:
1. ✅ **JWT_SECRET** - Generate secure key
2. ✅ **ENCRYPTION_KEY** - Generate secure key  
3. ✅ **OPENAI_API_KEY** - Get from OpenAI

### Optional (but recommended):
4. ⚠️ **AWS S3 Credentials** - For image uploads
5. ⚠️ **WhatsApp Credentials** - For WhatsApp integration

### Already Configured:
- ✅ MySQL database credentials
- ✅ MongoDB connection
- ✅ Database schema

## 🚀 Ready to Run

Once you've:
1. Updated `.env` with required secrets
2. Installed dependencies (`npm install`)
3. Initialized databases (`npm run init`)

You can start the server with:
```bash
npm start
```

## 📝 Notes

- The application will work without AWS S3 (but image uploads won't work)
- The application will work without WhatsApp setup (but WhatsApp features won't work)
- OpenAI API key is **required** for the LLM chatbot to function
- JWT_SECRET and ENCRYPTION_KEY are **critical** for security

## 🔐 Security Reminders

- Never commit `.env` file to git (already in `.gitignore`)
- Use strong, randomly generated secrets
- Rotate secrets regularly in production
- Keep API keys secure and don't share them
