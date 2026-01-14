# Telegram Bot Testing Guide

## ✅ Step 1: Verify OpenAI API Key

Your OpenAI API key is **valid and working**! ✅

The test script confirmed:
- ✅ API key is valid
- ✅ Account has access to 111 models
- ✅ Ready to use

## 📋 Step 2: Check Telegram Bot Configuration

### Check if Telegram Bot Token is set:

1. Make sure `TELEGRAM_BOT_TOKEN` is in your `.env` file
2. The format should be: `<bot_id>:<token>` (e.g., `8151262879:AAGkBFDar5LZnVdod7U8URJDYUzHdk4ku50`)

### Check if bot is connected to a business:

```bash
node database/setup_telegram_bot.js
```

This will connect the Telegram bot to the test business (`test@zakaa.com`).

## 🚀 Step 3: Start the Server

Make sure your backend server is running:

```bash
npm start
# or
npm run dev
```

The server should be running on `http://localhost:3000`

## 🌐 Step 4: Set Up Webhook (Using ngrok)

Telegram needs a public URL to send messages to your bot. For local testing, use ngrok:

### Option A: Using ngrok (Recommended for Testing)

1. **Start ngrok** (in a separate terminal):
   ```bash
   ngrok http 3000
   ```
   
   Or use the PowerShell script:
   ```powershell
   .\start_ngrok.ps1
   ```

2. **Copy the HTTPS URL** from ngrok (e.g., `https://abc123.ngrok-free.app`)

3. **Set the webhook**:
   ```bash
   node database/set_telegram_webhook.js https://YOUR-NGROK-URL.ngrok-free.app/webhook/telegram
   ```
   
   Replace `YOUR-NGROK-URL` with your actual ngrok URL.

### Option B: Using Deployed Server

If you have a deployed server, use that URL instead:
```bash
node database/set_telegram_webhook.js https://yourdomain.com/webhook/telegram
```

## 🧪 Step 5: Test the Bot

1. **Open Telegram** on your phone or desktop
2. **Search for your bot** by username (default: `@Testingzakaabot`)
3. **Start a conversation** by clicking "Start" or sending `/start`
4. **Send a test message**:
   - `Hello`
   - `What's on the menu?`
   - `Show me your items`

## 🔍 Step 6: Monitor Logs

Watch your server console for:
- ✅ `Received Telegram message` - Message received
- ✅ `Processing Telegram update` - Update being processed
- ✅ `LLM response generated` - AI response created
- ✅ `Message sent via Telegram` - Response sent

## 🐛 Troubleshooting

### Bot not responding?

1. **Check server logs** - Look for errors
2. **Verify webhook is set**:
   - Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo`
   - Should show your webhook URL
3. **Check if server is accessible**:
   - ngrok URL should be accessible from the internet
   - Test: Visit `https://YOUR-NGROK-URL.ngrok-free.app/health`

### Webhook not receiving messages?

1. **Check webhook info**:
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
   ```
2. **Re-set webhook**:
   ```bash
   node database/set_telegram_webhook.js https://YOUR-NGROK-URL.ngrok-free.app/webhook/telegram
   ```

### OpenAI errors?

- Check server logs for OpenAI API errors
- Verify `OPENAI_API_KEY` is correct in `.env`
- Make sure you have credits/quota in your OpenAI account

## 📝 Quick Reference

**Test Business**: `test@zakaa.com`  
**Default Bot Username**: `@Testingzakaabot`  
**Webhook Endpoint**: `/webhook/telegram`  
**Health Check**: `http://localhost:3000/health`

**Useful Commands**:
```bash
# Test OpenAI key
node scripts/test-openai-key.js

# Setup Telegram bot
node database/setup_telegram_bot.js

# Set webhook
node database/set_telegram_webhook.js <WEBHOOK_URL>

# Check webhook info
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

## ✅ Checklist

- [ ] OpenAI API key is set in `.env` (✅ Verified working)
- [ ] Telegram bot token is set in `.env`
- [ ] Bot is connected to business (`node database/setup_telegram_bot.js`)
- [ ] Server is running (`npm start`)
- [ ] ngrok is running (if testing locally)
- [ ] Webhook is set (`node database/set_telegram_webhook.js`)
- [ ] Bot responds to messages
