# Twilio WhatsApp Sandbox Setup Guide

## Quick Setup for Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# WhatsApp Provider
WHATSAPP_PROVIDER=twilio

# Twilio Configuration
TWILIO_ACCOUNT_SID=AC5ff69f2bff8b5b15733a3ddbdbbaf60d
TWILIO_AUTH_TOKEN=your-actual-auth-token-here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### 3. Configure Twilio Webhook

In your Twilio Console → Sandbox Settings:
- **"When a message comes in"**: `https://your-server.com/webhook/whatsapp`
- **Method**: POST

### 4. Database Setup

For Twilio to work, you need to create a business or branch in your database with the Twilio phone number stored in the `whatsapp_phone_number_id` field.

**Option A: Using SQL directly**
```sql
-- Example: Create a test business with Twilio number
INSERT INTO users (
  id, email, password_hash, business_name, user_type, user_role,
  whatsapp_phone_number_id, subscription_type, subscription_status, created_at
) VALUES (
  UUID(), 
  'test@example.com', 
  '$2a$10$hashedpassword', 
  'Test Restaurant', 
  'business', 
  'business',
  '+14155238886',  -- Twilio sandbox number (without whatsapp: prefix)
  'standard',
  'active',
  NOW()
);
```

**Option B: Using the API (recommended)**
1. Register a business via `/api/auth/register`
2. Update the business to set `whatsapp_phone_number_id` to `+14155238886`

```bash
curl -X PUT http://localhost:3000/api/businesses/your-business-id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"whatsapp_phone_number_id": "+14155238886"}'
```

### 5. Testing

1. **Start your server:**
   ```bash
   npm start
   # or
   npm run dev
   ```

2. **Send a message to Twilio sandbox:**
   - Join the Twilio sandbox by sending "join [your-sandbox-code]" to `+1 415 523 8886`
   - Then send messages to `whatsapp:+14155238886`

3. **Check logs:**
   - Server logs will show incoming webhook processing
   - Check MongoDB for message logs

### 6. Troubleshooting

**Issue: "Could not resolve context for Twilio message"**
- Make sure you have a business/branch with `whatsapp_phone_number_id = '+14155238886'` (or your Twilio number without `whatsapp:` prefix)

**Issue: "Twilio Account SID and Auth Token must be configured"**
- Check that `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set in your `.env` file

**Issue: Messages not being received**
- Verify webhook URL is accessible from the internet (use ngrok for local testing)
- Check Twilio console → Logs → Debugger for webhook delivery status
- Ensure webhook is set to POST method

### 7. Using ngrok for Local Testing

If testing locally, use ngrok to expose your local server:

#### Step-by-step ngrok setup:

1. **Make sure your server is running:**
   ```bash
   npm start
   # or
   npm run dev
   ```
   Verify it's running on port 3000 (default)

2. **Start ngrok in a new terminal window:**
   ```bash
   ngrok http 3000
   ```
   
   You'll see output like:
   ```
   Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
   ```

3. **Copy the HTTPS URL** (not HTTP - Twilio requires HTTPS):
   - Look for the line starting with `Forwarding  https://`
   - Copy the full URL (e.g., `https://abc123.ngrok-free.app`)
   - **Important:** Use the HTTPS URL, not HTTP

4. **Configure Twilio Webhook:**
   
   Go to Twilio Console → Messaging → Settings → WhatsApp Sandbox Settings
   
   In the "When a message comes in" field, enter:
   ```
   https://your-ngrok-url.ngrok-free.app/webhook/whatsapp
   ```
   
   Make sure:
   - Method is set to **POST**
   - URL uses **HTTPS** (not HTTP)
   - URL ends with `/webhook/whatsapp`

5. **Verify webhook is working:**
   - Send a test message to your Twilio WhatsApp number
   - Check your server logs for incoming webhook requests
   - Check the Twilio Console → Monitor → Logs → Errors for any delivery issues

#### Notes:
- **ngrok free tier:** URLs change every time you restart ngrok. You'll need to update Twilio webhook URL each time.
- **ngrok paid tier:** Can get a static domain that doesn't change.
- **Keep ngrok running:** The ngrok tunnel must stay active while testing. If you close it, webhooks will stop working.
- **Alternative:** You can also use other tunneling services like `localtunnel` or deploy to a cloud server for permanent URLs.

## Notes

- Twilio sandbox number: `+14155238886` (format: `whatsapp:+14155238886` when sending)
- Customer must join sandbox first before receiving messages
- The system automatically detects Twilio vs Meta format based on request content
- Twilio sends form-encoded data, Meta sends JSON - both are handled automatically
