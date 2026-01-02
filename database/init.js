// Database Initialization Script
// Initializes both MySQL and MongoDB databases

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { initializeMongoDB } = require('./mongodb_init');
require('dotenv').config();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  multipleStatements: true
};

const DB_NAME = process.env.MYSQL_DATABASE || 'zakaa_db';

async function initializeMySQL() {
  let connection;
  
  try {
    // Connect without database first
    connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL server');
    
    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    console.log(`Database '${DB_NAME}' created or already exists`);
    
    // Use the database
    await connection.query(`USE \`${DB_NAME}\``);
    
    // Read and execute schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Remove comments and split by semicolons
    const statements = schema
      .replace(/--.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filter out empty statements and CREATE DATABASE/USE statements (already handled)
        return s.length > 0 && 
               !s.match(/^CREATE\s+DATABASE/i) && 
               !s.match(/^USE\s+/i);
      });
    
    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          await connection.query(statement);
        } catch (error) {
          // Ignore "already exists" errors
          if (!error.message.includes('already exists') && 
              !error.message.includes('Duplicate key name')) {
            console.warn('Schema execution warning:', error.message);
          }
        }
      }
    }
    
    console.log('MySQL schema executed successfully');
    
    // Verify tables were created
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`Created ${tables.length} tables:`, tables.map(t => Object.values(t)[0]).join(', '));
    
    await connection.end();
    return true;
    
  } catch (error) {
    console.error('MySQL initialization error:', error);
    if (connection) {
      await connection.end();
    }
    throw error;
  }
}

async function main() {
  console.log('Starting database initialization...\n');
  
  // Check environment variables
  if (!process.env.MYSQL_PASSWORD) {
    console.error('Error: MYSQL_PASSWORD is not set in .env file');
    process.exit(1);
  }
  
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.includes('change-this')) {
    console.warn('Warning: ENCRYPTION_KEY is not set or using default value. Please set a secure key in .env');
  }
  
  try {
    // Initialize MySQL
    console.log('=== Initializing MySQL ===');
    await initializeMySQL();
    console.log('MySQL initialization completed successfully\n');
    
    // Initialize MongoDB
    console.log('=== Initializing MongoDB ===');
    await initializeMongoDB();
    console.log('MongoDB initialization completed successfully\n');
    
    console.log('✅ Database initialization completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update ENCRYPTION_KEY in .env with a secure 32-byte hex key');
    console.log('2. Test database connections using the connection utilities');
    console.log('3. Implement the archive job to move completed orders to MongoDB');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { initializeMySQL, main };

