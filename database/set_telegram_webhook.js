// Set Telegram Webhook URL
// Helper script to configure Telegram bot webhook

require('dotenv').config();
const axios = require('axios');
const CONSTANTS = require('../src/config/constants');

// Read token directly from env first, then from CONSTANTS, then use fallback
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || CONSTANTS.TELEGRAM_BOT_TOKEN || '8151262879:AAGkBFDar5LZnVdod7U8URJDYUzHdk4ku50';
const WEBHOOK_URL = process.argv[2] || process.env.TELEGRAM_WEBHOOK_URL || null;

async function setTelegramWebhook() {
  if (!WEBHOOK_URL) {
    console.error('❌ Error: Webhook URL is required');
    console.log('\nUsage:');
    console.log('  node database/set_telegram_webhook.js <WEBHOOK_URL>');
    console.log('\nExample:');
    console.log('  node database/set_telegram_webhook.js https://abc123.ngrok-free.app/webhook/telegram');
    console.log('\nOr set TELEGRAM_WEBHOOK_URL in .env file');
    process.exit(1);
  }
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: Telegram bot token is not configured');
    console.log('\nPlease set TELEGRAM_BOT_TOKEN in your .env file');
    process.exit(1);
  }
  
  // Debug: Show token being used (first 20 chars only for security)
  console.log(`🔑 Using bot token: ${TELEGRAM_BOT_TOKEN.substring(0, 20)}...`);
  console.log(`📝 Token length: ${TELEGRAM_BOT_TOKEN.length} characters\n`);
  
  // First, verify the token is valid by getting bot info
  try {
    console.log('🔍 Verifying bot token...');
    const getMeUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
    const getMeResponse = await axios.get(getMeUrl);
    
    if (getMeResponse.data.ok) {
      const botInfo = getMeResponse.data.result;
      console.log(`✅ Bot token verified!`);
      console.log(`   Bot ID: ${botInfo.id}`);
      console.log(`   Bot Username: @${botInfo.username}`);
      console.log(`   Bot Name: ${botInfo.first_name}\n`);
    } else {
      console.error('❌ Invalid bot token:', getMeResponse.data.description);
      console.log('\n💡 Please verify your TELEGRAM_BOT_TOKEN in .env file');
      console.log('   It should be in format: <bot_id>:<token>');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error verifying bot token:', error.response?.data || error.message);
    console.log('\n💡 The bot token might be invalid. Please check:');
    console.log('   1. Is TELEGRAM_BOT_TOKEN set in your .env file?');
    console.log('   2. Is the token correct? (format: <bot_id>:<token>)');
    process.exit(1);
  }
  
  const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
  
  try {
    console.log('🔧 Setting Telegram webhook...\n');
    console.log(`📡 Webhook URL: ${WEBHOOK_URL}\n`);
    
    const response = await axios.post(apiUrl, {
      url: WEBHOOK_URL,
      allowed_updates: ['message', 'callback_query']
    });
    
    if (response.data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`\n📋 Webhook Info:`);
      console.log(`   URL: ${response.data.result.url}`);
      console.log(`   Has custom certificate: ${response.data.result.has_custom_certificate || false}`);
      console.log(`   Pending update count: ${response.data.result.pending_update_count || 0}`);
      console.log('\n✅ Telegram bot is now ready to receive messages!');
      console.log(`\n💬 Test it by sending a message to @Testingzakaabot`);
    } else {
      console.error('❌ Failed to set webhook:', response.data.description);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.response?.data || error.message);
    process.exit(1);
  }
}

setTelegramWebhook();
