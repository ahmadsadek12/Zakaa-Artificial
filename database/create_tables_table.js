// Quick script to create the tables table
require('dotenv').config();
const mysql = require('mysql2/promise');

async function createTablesTable() {
  let connection;
  
  try {
    // Connect to MySQL
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'zakaa_db'
    });
    
    console.log('Connected to MySQL database');
    
    // Create tables table
    console.log('Creating tables table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        seats INT NOT NULL,
        number VARCHAR(50) NOT NULL,
        reserved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_reserved (reserved)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tables table created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating tables table:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('   The users table must exist first. Please run the database initialization.');
    } else if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('✅ Tables table already exists');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createTablesTable()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
