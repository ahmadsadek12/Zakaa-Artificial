# Twilio WhatsApp Testing Guide

## 🎯 Quick Start Testing

### Current Setup Status

✅ **Business Account**: `test@zakaa.com` (Test Restaurant)
✅ **Twilio Number**: `+14155238886`  
✅ **Business ID**: `ae2796e3-698e-4c98-ad21-99517b96c18e`
✅ **Menu Items**: 8 items configured (Burgers, Fries, Drinks, etc.)
✅ **Server**: Running on `http://localhost:3000`
✅ **Webhook Endpoint**: `http://localhost:3000/webhook/whatsapp`

---

## 📋 Prerequisites Checklist

Before testing, make sure you have:

### 1. Environment Variables (.env file)
```env
# Required
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC5ff69f2bff8b5b15733a3ddbdbbaf60d
TWILIO_AUTH_TOKEN=your-actual-twilio-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Critical for AI Chatbot
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

### 2. Server Running
```bash
npm start
# Server should be on http://localhost:3000
```

### 3. Public Webhook URL (for Twilio to reach your server)

**Option A: Using ngrok (Recommended for Local Testing)**
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

**Option B: Deploy to a public server**
- Deploy your server to a platform like Heroku, Railway, or AWS
- Use the public URL for webhook configuration

---

## 🔧 Twilio Console Setup

### Step 1: Configure Webhook in Twilio Console

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Click on **Sandbox Settings** (or go to [Twilio Sandbox](https://console.twilio.com/us1/develop/sms/sandbox))
4. Under **"When a message comes in"**, set:
   - **URL**: `https://your-ngrok-url.ngrok.io/webhook/whatsapp` (or your public server URL)
   - **Method**: `POST`
5. Save the configuration

### Step 2: Join Twilio Sandbox

**Important**: Before you can receive messages, you must join the sandbox first!

1. From your WhatsApp, send a message to: `+1 415 523 8886`
2. Send the join code provided in your Twilio Console (format: `join <code>`)
3. You'll receive a confirmation message
4. Now you can send messages and receive responses!

---

## 🧪 Testing Steps

### Test 1: Basic Conversation

1. **Send a greeting:**
   ```
   Hello
   ```
   
   **Expected Response**: The AI chatbot should greet you and ask what you'd like to order.

2. **Ask about the menu:**
   ```
   What do you have?
   ```
   or
   ```
   Show me the menu
   ```

   **Expected Response**: The chatbot should list available items (8 items configured).

### Test 2: Ordering Items

1. **Add items to cart:**
   ```
   I want a Classic Burger
   ```
   
   **Expected Response**: Chatbot confirms item added and shows cart summary.

2. **Add more items:**
   ```
   Add French Fries and a Soft Drink
   ```
   
   **Expected Response**: Cart updated with all items and total.

3. **Check cart:**
   ```
   What's in my cart?
   ```
   or
   ```
   Show my order
   ```

### Test 3: Completing Order

1. **Place order:**
   ```
   I'm ready to order
   ```
   or
   ```
   Complete my order
   ```

   **Expected Response**: 
   - Order created in database
   - Order confirmation with order ID
   - Cart cleared

### Test 4: Scheduling (if enabled)

```
Can I schedule this order for tomorrow at 2 PM?
```

**Expected Response**: Chatbot should ask for confirmation and schedule the order.

---

## 🔍 Monitoring & Debugging

### Check Server Logs

Watch your server console for:
- ✅ `Received Twilio WhatsApp message` - Message received
- ✅ `Processing Twilio webhook` - Webhook processing started
- ✅ `LLM response generated` - AI response created
- ✅ `Message sent via Twilio` - Response sent

### Check Database

```bash
# Check orders created
node -e "
require('dotenv').config();
const { queryMySQL } = require('./src/config/database');
(async () => {
  const orders = await queryMySQL('SELECT id, customer_phone_number, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT 5');
  console.log(JSON.stringify(orders, null, 2));
})();
"
```

### Check Twilio Logs

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Monitor** → **Logs** → **Debugger**
3. Look for webhook delivery status:
   - ✅ Green: Success (200 OK)
   - ❌ Red: Error (check error message)

### Test Webhook Locally (Manual)

You can test the webhook endpoint directly:

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+96176891114&Body=Hello&MessageSid=SM123&AccountSid=AC5ff69f2bff8b5b15733a3ddbdbbaf60d&To=whatsapp:+14155238886"
```

---

## 🐛 Troubleshooting

### Issue: "Could not resolve context for Twilio message"

**Solution**: The business account doesn't have the Twilio number configured.
```bash
# Verify business has the number
node database/check_twilio_account.js
```

### Issue: "OpenAI API key not configured"

**Solution**: Add `OPENAI_API_KEY` to your `.env` file.
```env
OPENAI_API_KEY=sk-your-key-here
```

### Issue: Webhook not receiving messages

**Solutions**:
1. ✅ Verify webhook URL is accessible (test with curl)
2. ✅ Check ngrok is running and URL is correct
3. ✅ Verify webhook URL in Twilio Console matches your ngrok URL
4. ✅ Check Twilio Debugger logs for delivery errors

### Issue: Messages sent but no response

**Solutions**:
1. ✅ Check server logs for errors
2. ✅ Verify OpenAI API key is valid and has credits
3. ✅ Check MongoDB connection (messages are logged there)
4. ✅ Verify Twilio credentials in `.env` are correct

### Issue: "Cannot find module" or other startup errors

**Solution**: 
```bash
npm install
# Make sure all dependencies are installed
```

---

## 📊 Test Scenarios Checklist

- [ ] Basic greeting and menu inquiry
- [ ] Adding single item to cart
- [ ] Adding multiple items to cart
- [ ] Viewing cart contents
- [ ] Removing items from cart
- [ ] Completing an order
- [ ] Order confirmation received
- [ ] Order appears in database
- [ ] Scheduling an order (if enabled)
- [ ] Asking about item details
- [ ] Asking about delivery options
- [ ] Error handling (requesting non-existent item)

---

## 🚀 Next Steps

Once basic testing works:

1. **Add more menu items**:
   ```bash
   node database/setup_test_business_items.js
   ```

2. **Test with multiple customers**:
   - Use different phone numbers to simulate multiple customers
   - Each customer gets their own cart and conversation

3. **Test branch functionality**:
   - Create a branch user
   - Configure branch with its own phone number
   - Test that messages route to correct branch

4. **Monitor performance**:
   - Check OpenAI token usage
   - Monitor response times
   - Review order completion rates

---

## 📝 Quick Reference

**Test Business**: `test@zakaa.com`
**Password**: `12345678` (for admin login)
**Twilio Sandbox Number**: `+14155238886`
**Webhook URL**: `http://localhost:3000/webhook/whatsapp`
**Health Check**: `http://localhost:3000/health`

**Test Phone Numbers**:
- Use your real WhatsApp number (must join sandbox first)
- Or use any number format: `whatsapp:+96176891114`

**Useful Commands**:
```bash
# Check which account has Twilio number
node database/check_twilio_account.js

# Setup test items
node database/setup_test_business_items.js

# Check server health
curl http://localhost:3000/health

# Test webhook directly
curl -X POST http://localhost:3000/webhook/whatsapp -H "Content-Type: application/x-www-form-urlencoded" -d "From=whatsapp:+96176891114&Body=Hello&To=whatsapp:+14155238886"
```

---

## 💡 Tips

1. **Start Simple**: Test with basic messages first before complex orders
2. **Check Logs**: Server logs provide detailed debugging information
3. **Use ngrok**: Essential for local testing with Twilio
4. **Save Webhook URL**: Keep your ngrok URL handy - it changes each time you restart ngrok (unless you have a paid account)
5. **Monitor Costs**: OpenAI API calls cost money - monitor your usage
6. **Test Edge Cases**: Try invalid inputs, incomplete orders, etc.

---

**Happy Testing! 🎉**

If you encounter any issues, check the server logs first and refer to the troubleshooting section above.
