// Setup Telegram Bot Token for Business
// Add telegram_bot_token column if missing and set it for test@zakaa.com

require('dotenv').config();
const { queryMySQL, getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

const TEST_BUSINESS_EMAIL = 'test@zakaa.com';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'Testingzakaabot';

async function setupTelegramForBusiness() {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('🔧 Setting up Telegram for business...\n');
    
    // Check if telegram_bot_token column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'telegram_bot_token'
    `);
    
    if (columns.length === 0) {
      console.log('📝 Adding telegram_bot_token column to users table...');
      // Temporarily disable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN telegram_bot_token VARCHAR(255) NULL 
        AFTER whatsapp_access_token_encrypted
      `);
      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ Column added successfully');
    } else {
      console.log('✅ telegram_bot_token column already exists');
    }
    
    // Check if whatsapp_business_account_id column exists (might be needed)
    const [wabaColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'whatsapp_business_account_id'
    `);
    
    if (wabaColumns.length === 0) {
      console.log('📝 Adding whatsapp_business_account_id column to users table...');
      // Temporarily disable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN whatsapp_business_account_id VARCHAR(255) NULL 
        AFTER whatsapp_phone_number_id
      `);
      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ Column added successfully');
    }
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('❌ Error: TELEGRAM_BOT_TOKEN is not set in .env file');
      console.log('\nPlease add these lines to your .env file:');
      console.log('TELEGRAM_BOT_TOKEN=your_bot_token_here');
      console.log('TELEGRAM_BOT_USERNAME=your_bot_username_here');
      await connection.rollback();
      process.exit(1);
    }
    
    // Find the test business
    const [businesses] = await connection.query(
      'SELECT * FROM users WHERE email = ? AND user_type = ? AND deleted_at IS NULL',
      [TEST_BUSINESS_EMAIL, 'business']
    );
    
    if (businesses.length === 0) {
      console.error('❌ Business not found:', TEST_BUSINESS_EMAIL);
      await connection.rollback();
      process.exit(1);
    }
    
    const business = businesses[0];
    console.log(`✅ Found business: ${business.business_name || business.email} (${business.id})`);
    
    // Update with Telegram bot info
    await connection.query(`
      UPDATE users 
      SET whatsapp_phone_number_id = ?,
          telegram_bot_token = ?
      WHERE id = ?
    `, [`telegram:${TELEGRAM_BOT_USERNAME}`, TELEGRAM_BOT_TOKEN, business.id]);
    
    await connection.commit();
    
    console.log('\n📋 Telegram Bot Setup Complete:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🤖 Bot Username: @${TELEGRAM_BOT_USERNAME}`);
    console.log(`🔑 Bot Token:    ${TELEGRAM_BOT_TOKEN.substring(0, 20)}...`);
    console.log(`📧 Business:     ${TEST_BUSINESS_EMAIL}`);
    console.log(`🆔 Business ID:   ${business.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 Next steps:');
    console.log('  1. Make sure your server is running');
    console.log(`  2. Set webhook URL: https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=http://52.28.59.163/webhook/telegram`);
    console.log(`  3. Test the bot by sending a message to @${TELEGRAM_BOT_USERNAME}`);
    console.log('');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error setting up Telegram:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if executed directly
if (require.main === module) {
  setupTelegramForBusiness()
    .then(() => {
      console.log('✨ Done! Telegram bot is now configured for the business.\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
}

module.exports = { setupTelegramForBusiness };
