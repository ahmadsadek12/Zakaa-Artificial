// Quick script to verify passwords are hashed
require('dotenv').config();
const { queryMySQL } = require('../src/config/database');

(async () => {
  try {
    const users = await queryMySQL(`
      SELECT email, LEFT(password_hash, 30) as hash_preview, LENGTH(password_hash) as hash_length
      FROM users 
      WHERE email LIKE '%@example.com' 
      LIMIT 3
    `);
    
    console.log('Password Hash Verification:');
    console.log('============================\n');
    
    users.forEach(u => {
      console.log(`Email: ${u.email}`);
      console.log(`Hash preview: ${u.hash_preview}...`);
      console.log(`Hash length: ${u.hash_length} characters`);
      console.log(`Format: ${u.hash_preview.startsWith('$2') ? 'bcrypt (✓)' : 'Unknown'}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
