// Script to create an admin user
// Run with: node scripts/create-admin.js

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'zakaa_db'
  });

  try {
    console.log('Connected to MySQL database');

    // Get admin details from command line or use defaults
    const email = process.argv[2] || 'admin@zakaa-artificial.com';
    const password = process.argv[3] || 'Z@ka2@dm1n*';

    // Check if admin already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      console.log(`❌ User with email ${email} already exists`);
      process.exit(1);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create admin user
    const adminId = uuidv4();
    await connection.execute(
      `INSERT INTO users (
        id, user_type, email, password_hash, is_active, created_at
      ) VALUES (?, 'admin', ?, ?, true, NOW())`,
      [adminId, email, password_hash]
    );

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('Admin Credentials:');
    console.log('==================');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('');
    console.log('You can now login at: http://localhost:5173/login');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run the script
createAdmin().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
