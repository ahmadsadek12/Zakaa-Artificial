// Update all business passwords to 12345678
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'zakaa_db'
};

async function updateAllPasswords() {
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  
  try {
    const hashed = await bcrypt.hash('12345678', 10);
    const [result] = await conn.query(
      'UPDATE users SET password_hash = ? WHERE user_type = ? AND deleted_at IS NULL',
      [hashed, 'business']
    );
    
    console.log(`✅ Updated ${result.affectedRows} business(es) password to 12345678\n`);
    
    const [businesses] = await conn.query(
      'SELECT id, email, business_name, whatsapp_phone_number_id FROM users WHERE user_type = ? AND deleted_at IS NULL',
      ['business']
    );
    
    console.log('📋 All Businesses:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    businesses.forEach(b => {
      console.log(`📧 Email: ${b.email}`);
      console.log(`   Name: ${b.business_name || 'N/A'}`);
      console.log(`   ID: ${b.id}`);
      console.log(`   WhatsApp: ${b.whatsapp_phone_number_id || 'Not set'}`);
      console.log('');
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

updateAllPasswords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
