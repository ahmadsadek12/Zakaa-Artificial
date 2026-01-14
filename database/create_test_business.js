// Create Test Business with Twilio Number
// Quick script to create/update a test business for Twilio WhatsApp testing

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getMySQLConnection } = require('../src/config/database');
const { generateUUID } = require('../src/utils/uuid');

const TEST_BUSINESS_EMAIL = 'test@zakaa.com';
const TEST_PASSWORD = '12345678';
const TWILIO_NUMBER = '+14155238886'; // Remove 'whatsapp:' prefix for database

async function createOrUpdateTestBusiness() {
  const connection = await getMySQLConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('🔧 Creating/Updating test business...\n');
    
    // Check if business already exists
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE email = ? AND user_type = ? AND deleted_at IS NULL',
      [TEST_BUSINESS_EMAIL, 'business']
    );
    
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
    const businessId = existing.length > 0 ? existing[0].id : generateUUID();
    
    if (existing.length > 0) {
      // Update existing business
      console.log(`✅ Found existing business: ${businessId}`);
      console.log('   Updating with Twilio number and password...\n');
      
      await connection.query(`
        UPDATE users 
        SET 
          password_hash = ?,
          whatsapp_phone_number_id = ?,
          business_name = COALESCE(business_name, 'Test Restaurant'),
          business_type = COALESCE(business_type, 'food and beverage'),
          subscription_type = 'standard',
          subscription_status = 'active',
          is_active = true,
          updated_at = NOW()
        WHERE id = ?
      `, [hashedPassword, TWILIO_NUMBER, businessId]);
      
      console.log('✅ Business updated successfully!');
    } else {
      // Create new business
      console.log('   Creating new test business...\n');
      
      // Create a simple location
      const locationId = generateUUID();
      await connection.query(`
        INSERT INTO locations (id, city, street, building, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [locationId, 'Beirut', 'Test Street', 'Test Building']);
      
      // Insert using only columns that exist in the database (no user_role, no parent_user_id)
      // Columns: 19, Values: 19
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
        'other', // Use 'other' as a safe default - adjust if needed
        'arabic',
        'Asia/Beirut',
        TWILIO_NUMBER,
        'standard',
        0,
        'active',
        true,
        true,
        true,
        true,
        locationId
      ]);
      
      console.log('✅ Business created successfully!');
    }
    
    await connection.commit();
    
    console.log('\n📋 Test Business Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email:        ${TEST_BUSINESS_EMAIL}`);
    console.log(`🔑 Password:     ${TEST_PASSWORD}`);
    console.log(`📱 WhatsApp:     ${TWILIO_NUMBER}`);
    console.log(`🆔 Business ID:  ${businessId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return {
      id: businessId,
      email: TEST_BUSINESS_EMAIL,
      password: TEST_PASSWORD,
      whatsappPhoneNumber: TWILIO_NUMBER
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error creating/updating business:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if executed directly
if (require.main === module) {
  createOrUpdateTestBusiness()
    .then(() => {
      console.log('✨ Done! You can now start the server and test with Twilio.\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
}

module.exports = { createOrUpdateTestBusiness };
