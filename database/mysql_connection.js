// MySQL Connection Utility
// Manages MySQL connection pool with retry logic

const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

function createPool() {
  if (pool) {
    return pool;
  }
  
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'zakaa_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });
  
  return pool;
}

async function getConnection() {
  if (!pool) {
    createPool();
  }
  
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('Error getting MySQL connection:', error);
    throw error;
  }
}

async function query(sql, params = []) {
  if (!pool) {
    createPool();
  }
  
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('MySQL query error:', error);
    throw error;
  }
}

async function testConnection() {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('MySQL connection test failed:', error);
    return false;
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Initialize pool on module load
createPool();

module.exports = {
  getConnection,
  query,
  testConnection,
  closePool,
  pool: () => pool
};

