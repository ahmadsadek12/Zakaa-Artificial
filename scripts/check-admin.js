// Script to check admin user in database
// Run with: node scripts/check-admin.js

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'zakaa_db'
  });

  try {
    console.log('🔍 Checking admin account...\n');

    const email = 'admin@zakaa-artificial.com';

    // Get admin user
    const [users] = await connection.execute(
      'SELECT id, user_type, email, is_active, created_at FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log('❌ Admin user NOT found!');
      console.log('Run: node scripts/create-admin.js');
      process.exit(1);
    }

    const user = users[0];
    console.log('✅ Admin user found:');
    console.log('===================');
    console.log(`ID:        ${user.id}`);
    console.log(`Email:     ${user.email}`);
    console.log(`User Type: ${user.user_type}`);
    console.log(`Active:    ${user.is_active}`);
    console.log(`Created:   ${user.created_at}`);
    console.log('');

    if (user.user_type !== 'admin') {
      console.log('❌ ERROR: User type is NOT "admin"!');
      console.log('Fixing...');
      
      await connection.execute(
        'UPDATE users SET user_type = ? WHERE email = ?',
        ['admin', email]
      );
      
      console.log('✅ Fixed! User type set to "admin"');
    } else {
      console.log('✅ User type is correct: "admin"');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run the script
checkAdmin().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
