# Telegram Bot Automatic Webhook Setup

## ✅ What's New

When you update the Telegram Bot Token in Settings, the system now **automatically**:
1. ✅ Validates the token with Telegram API
2. ✅ Sets up the webhook URL
3. ✅ Saves the token to database
4. ✅ Shows bot info (username, name) in success message

**No more manual webhook setup needed!** 🎉

---

## 🔧 EC2 Setup Requirements

For automatic webhook setup to work on EC2, you need to set the `API_BASE_URL` environment variable.

### Step 1: Add to .env file on EC2

SSH into your EC2 instance and edit the `.env` file:

```bash
# Connect to EC2
ssh -i "your-key.pem" ubuntu@YOUR-EC2-IP

# Navigate to project directory
cd zakaa

# Edit .env file
nano .env
```

Add this line (replace with your actual EC2 public IP):

```bash
API_BASE_URL=http://YOUR-EC2-PUBLIC-IP:3000
```

**Example:**
```bash
API_BASE_URL=http://18.206.123.45:3000
```

**For production with domain:**
```bash
API_BASE_URL=https://yourdomain.com
```

### Step 2: Restart the server

```bash
pm2 restart all
# or
npm start
```

---

## 🚀 How to Use

### For Each Business/Bot:

1. **Go to Settings** in your dashboard
2. **Go to Bot Configuration tab**
3. **Paste your Telegram Bot Token** (format: `123456789:ABCdefGHI...`)
4. **Click Save Changes**

The system will:
- Validate the token
- Set up the webhook automatically
- Show you a success message with bot info

**Example success message:**
```
✅ Settings saved!

Telegram Bot Connected:
• Bot: @YourBotUsername
• Name: Your Bot Name
• Webhook: http://18.206.123.45:3000/webhook/telegram

Your bot is ready to receive messages!
```

---

## ❌ Error Handling

If the token is invalid, you'll see an error like:

```
Telegram bot token is invalid or webhook setup failed
Details: Telegram API error: Unauthorized
```

**Common errors:**
- **Unauthorized**: Token is wrong or revoked
- **Bad Request**: Token format is invalid
- **Connection timeout**: Can't reach Telegram API (check internet)

---

## 🔍 Verify Webhook Setup

You can manually verify the webhook is set correctly:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

You should see your EC2 IP in the response:

```json
{
  "ok": true,
  "result": {
    "url": "http://18.206.123.45:3000/webhook/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 📝 Notes

### Multiple Businesses
- Each business can have their own Telegram bot token
- Webhooks are set up independently for each bot
- All bots point to the same EC2 server (different tokens, same endpoint)

### Security Group
Make sure your EC2 security group allows:
- **Port 3000** from anywhere (0.0.0.0/0) for Telegram webhooks
- Or use a reverse proxy (Nginx) on port 80/443

### HTTPS vs HTTP
- **HTTP is fine for testing** (Telegram accepts it)
- **For production, use HTTPS** with SSL certificate
  - Use Nginx with Let's Encrypt
  - Update API_BASE_URL to `https://yourdomain.com`

---

## 🐛 Troubleshooting

### Bot not responding after saving token

1. **Check API_BASE_URL is set correctly:**
   ```bash
   cat .env | grep API_BASE_URL
   ```

2. **Check server is running:**
   ```bash
   pm2 status
   # or
   curl http://localhost:3000/health
   ```

3. **Check webhook info:**
   ```bash
   curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"
   ```

4. **Check server logs:**
   ```bash
   pm2 logs
   ```

### Webhook shows wrong URL

If the webhook is still pointing to localhost or wrong IP:
- Update `API_BASE_URL` in `.env`
- Restart server: `pm2 restart all`
- Re-save the bot token in Settings

---

## 🎯 Quick Start Checklist

- [ ] Set `API_BASE_URL` in EC2 `.env` file
- [ ] Restart server on EC2
- [ ] Open Settings → Bot Configuration
- [ ] Paste Telegram Bot Token
- [ ] Click Save
- [ ] Look for success message with bot info
- [ ] Send test message to bot on Telegram
- [ ] Bot should respond!

---

## 🔧 Manual Override (if needed)

If you ever need to manually set a webhook (shouldn't be necessary now):

```bash
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -d "url=http://YOUR-EC2-IP:3000/webhook/telegram"
```

But you shouldn't need this anymore! 🎉
