// Check which account is connected to Twilio phone number
require('dotenv').config();
const { queryMySQL } = require('../src/config/database');

const TWILIO_NUMBER = '+14155238886';

async function checkTwilioAccount() {
  try {
    console.log(`🔍 Checking which account is connected to Twilio number: ${TWILIO_NUMBER}\n`);
    
    // Check businesses (and any user with this WhatsApp number)
    const accounts = await queryMySQL(
      `SELECT id, email, business_name, user_type, whatsapp_phone_number_id, subscription_type, subscription_status, created_at
       FROM users 
       WHERE whatsapp_phone_number_id = ? AND deleted_at IS NULL`,
      [TWILIO_NUMBER]
    );
    
    console.log('═'.repeat(60));
    console.log('RESULTS');
    console.log('═'.repeat(60));
    
    if (accounts.length > 0) {
      console.log(`\n✅ FOUND ${accounts.length} ACCOUNT(S) with Twilio number:\n`);
      accounts.forEach((acc, idx) => {
        console.log(`  [${idx + 1}] ${acc.user_type.toUpperCase()} Account:`);
        console.log(`      ID:          ${acc.id}`);
        console.log(`      Email:       ${acc.email || 'N/A'}`);
        console.log(`      Name:        ${acc.business_name || 'N/A'}`);
        console.log(`      Type:        ${acc.user_type}`);
        console.log(`      WhatsApp:    ${acc.whatsapp_phone_number_id}`);
        if (acc.subscription_type) {
          console.log(`      Plan:        ${acc.subscription_type} (${acc.subscription_status || 'N/A'})`);
        }
        console.log(`      Created:     ${acc.created_at}`);
        console.log('');
      });
    }
    
    if (accounts.length === 0) {
      console.log('\n⚠️  No account found with Twilio number:', TWILIO_NUMBER);
      console.log('\n📋 Checking all accounts with WhatsApp numbers...\n');
      
      const allAccounts = await queryMySQL(
        `SELECT id, email, business_name, user_type, whatsapp_phone_number_id, created_at
         FROM users 
         WHERE whatsapp_phone_number_id IS NOT NULL AND deleted_at IS NULL 
         ORDER BY created_at DESC
         LIMIT 20`
      );
      
      if (allAccounts.length > 0) {
        console.log(`Found ${allAccounts.length} account(s) with WhatsApp numbers:\n`);
        allAccounts.forEach((acc, idx) => {
          console.log(`  [${idx + 1}] ${acc.user_type.toUpperCase()}`);
          console.log(`      Email:    ${acc.email || 'N/A'}`);
          console.log(`      Name:     ${acc.business_name || 'N/A'}`);
          console.log(`      WhatsApp: ${acc.whatsapp_phone_number_id}`);
          console.log(`      Created:  ${acc.created_at}`);
          console.log('');
        });
      } else {
        console.log('  No accounts with WhatsApp numbers found in database.');
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking Twilio account:', error);
    process.exit(1);
  }
}

checkTwilioAccount();
