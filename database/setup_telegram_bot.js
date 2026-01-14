// Setup Telegram Bot for Test Business
// Connect Telegram bot to test@zakaa.com business

require('dotenv').config();
const { queryMySQL, getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

const TEST_BUSINESS_EMAIL = 'test@zakaa.com';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8151262879:AAGkBFDar5LZnVdod7U8URJDYUzHdk4ku50';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'Testingzakaabot';

async function setupTelegramBot() {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('🔧 Setting up Telegram bot for test business...\n');
    
    // Find the test business
    const [businesses] = await connection.query(
      'SELECT * FROM users WHERE email = ? AND user_type = ? AND deleted_at IS NULL',
      [TEST_BUSINESS_EMAIL, 'business']
    );
    
    if (businesses.length === 0) {
      console.error('❌ Test business not found:', TEST_BUSINESS_EMAIL);
      console.log('\n💡 Creating test business first...');
      
      // Create test business if it doesn't exist
      const bcrypt = require('bcryptjs');
      const { generateUUID } = require('../src/utils/uuid');
      const businessId = generateUUID();
      const hashedPassword = await bcrypt.hash('12345678', 10);
      
      // Create location
      const locationId = generateUUID();
      await connection.query(`
        INSERT INTO locations (id, city, street, building, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [locationId, 'Beirut', 'Test Street', 'Test Building']);
      
      // Create business
      await connection.query(`
        INSERT INTO users (
          id, user_type, email, contact_phone_number, 
          password_hash, is_active, business_name, business_type, 
          default_language, timezone, whatsapp_phone_number_id,
          subscription_type, subscription_price, subscription_status,
          allow_scheduled_orders, allow_delivery, allow_takeaway, allow_on_site,
          location_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        businessId,
        'business',
        TEST_BUSINESS_EMAIL,
        '+9611234567',
        hashedPassword,
        true,
        'Test Restaurant',
        'other',
        'arabic',
        'Asia/Beirut',
        null, // No WhatsApp for Telegram bot
        'standard',
        0,
        'active',
        true,
        true,
        true,
        true,
        locationId
      ]);
      
      console.log('✅ Test business created:', businessId);
      
      // Update with Telegram bot info
      await connection.query(`
        UPDATE users 
        SET whatsapp_phone_number_id = ?
        WHERE id = ?
      `, [`telegram:${TELEGRAM_BOT_USERNAME}`, businessId]);
      
      console.log('✅ Telegram bot connected to business');
    } else {
      const business = businesses[0];
      console.log(`✅ Found test business: ${business.id}`);
      
      // Update with Telegram bot info (store bot username as identifier)
      // We'll use whatsapp_phone_number_id field to store Telegram bot identifier
      await connection.query(`
        UPDATE users 
        SET whatsapp_phone_number_id = ?
        WHERE id = ?
      `, [`telegram:${TELEGRAM_BOT_USERNAME}`, business.id]);
      
      console.log('✅ Telegram bot connected to business');
    }
    
    await connection.commit();
    
    console.log('\n📋 Telegram Bot Setup:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🤖 Bot Username: @${TELEGRAM_BOT_USERNAME}`);
    console.log(`🔑 Bot Token:    ${TELEGRAM_BOT_TOKEN.substring(0, 20)}...`);
    console.log(`📧 Business:     ${TEST_BUSINESS_EMAIL}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 Next steps:');
    console.log('  1. Set TELEGRAM_BOT_TOKEN in your .env file');
    console.log('  2. Restart your server');
    console.log('  3. Set webhook URL: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_NGROK_URL>/webhook/telegram');
    console.log('  4. Test the bot by sending a message to @' + TELEGRAM_BOT_USERNAME);
    console.log('');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error setting up Telegram bot:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if executed directly
if (require.main === module) {
  setupTelegramBot()
    .then(() => {
      console.log('✨ Done! Telegram bot is now connected to test business.\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
}

module.exports = { setupTelegramBot };
