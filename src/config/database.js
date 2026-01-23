// Database Configuration
// Centralized database connections for MySQL and MongoDB

const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// MySQL Connection Pool
let mysqlPool = null;

function createMySQLPool() {
  if (mysqlPool) {
    return mysqlPool;
  }
  
  mysqlPool = mysql.createPool({
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
  
  return mysqlPool;
}

async function getMySQLConnection() {
  if (!mysqlPool) {
    createMySQLPool();
  }
  
  try {
    const connection = await mysqlPool.getConnection();
    return connection;
  } catch (error) {
    console.error('Error getting MySQL connection:', error);
    throw error;
  }
}

async function queryMySQL(sql, params = []) {
  if (!mysqlPool) {
    createMySQLPool();
  }
  
  try {
    const [results] = await mysqlPool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('MySQL query error:', error);
    throw error;
  }
}

async function testMySQL() {
  try {
    const connection = await getMySQLConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('MySQL connection test failed:', error);
    return false;
  }
}

// MongoDB Connection
let mongoClient = null;
let mongoDb = null;

// Support multiple connection string formats:
// 1. Full connection string (MongoDB Atlas): mongodb+srv://user:pass@host/db?options
// 2. Full connection string (standard): mongodb://user:pass@host:port/db?options
// 3. Individual components: MONGODB_HOST, MONGODB_PORT, etc.
let MONGODB_URI = null;
if (process.env.MONGO_URI) {
  // Use full connection string if provided (supports mongodb+srv:// for Atlas)
  MONGODB_URI = process.env.MONGO_URI;
} else if (process.env.MONGODB_HOST) {
  // Build connection string from individual components
  const host = process.env.MONGODB_HOST;
  const port = process.env.MONGODB_PORT || '27017';
  const user = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  const auth = (user && password) ? `${user}:${password}@` : '';
  MONGODB_URI = `mongodb://${auth}${host}:${port}`;
} else {
  // Default to localhost
  MONGODB_URI = 'mongodb://127.0.0.1:27017';
}

const MONGODB_DB_NAME = process.env.MONGODB_DATABASE || process.env.MONGO_DB_NAME || 'zakaa_db';

// Track if MongoDB is known to be unavailable to skip connection attempts
let mongoUnavailable = false;

async function connectMongoDB() {
  // Skip connection attempt if MongoDB is known to be unavailable
  if (mongoUnavailable) {
    return null;
  }
  
  if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
    return { client: mongoClient, db: mongoDb };
  }
  
  try {
    // For MongoDB Atlas (mongodb+srv://), use longer timeout
    const isAtlas = MONGODB_URI.startsWith('mongodb+srv://');
    const timeout = isAtlas ? 10000 : 1000; // 10s for Atlas, 1s for local
    
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: timeout,
      connectTimeoutMS: timeout,
      // For Atlas, add TLS options
      ...(isAtlas && {
        tls: true,
        tlsAllowInvalidCertificates: false
      })
    });
    
    await mongoClient.connect();
    
    // Extract database name from connection string if provided, otherwise use env var
    let dbName = MONGODB_DB_NAME;
    if (MONGODB_URI.includes('/')) {
      const uriParts = MONGODB_URI.split('/');
      if (uriParts.length > 1) {
        const dbPart = uriParts[uriParts.length - 1].split('?')[0];
        if (dbPart && dbPart.length > 0) {
          dbName = dbPart;
        }
      }
    }
    
    mongoDb = mongoClient.db(dbName);
    mongoUnavailable = false; // Reset flag on successful connection
    
    console.log(`MongoDB connected successfully to ${isAtlas ? 'Atlas' : 'local'} database: ${dbName}`);
    return { client: mongoClient, db: mongoDb };
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    mongoClient = null;
    mongoDb = null;
    mongoUnavailable = true; // Mark as unavailable to skip future attempts
    return null; // Don't throw - just return null
  }
}

async function getMongoDB() {
  // Skip connection attempt if MongoDB is known to be unavailable
  if (mongoUnavailable) {
    return null;
  }
  
  if (!mongoDb || !mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) {
    try {
      const result = await connectMongoDB();
      if (!result) {
        return null;
      }
    } catch (error) {
      // MongoDB not available - reset to null and return null
      // This allows services to gracefully handle MongoDB unavailability
      mongoClient = null;
      mongoDb = null;
      mongoUnavailable = true;
      return null;
    }
  }
  return mongoDb;
}

async function getMongoCollection(collectionName) {
  try {
    const db = await getMongoDB();
    if (!db) {
      // MongoDB not available - return null instead of throwing
      // This allows callers to check and handle gracefully
      return null;
    }
    return db.collection(collectionName);
  } catch (error) {
    // Connection failed - return null for graceful degradation
    // Errors are already logged by connectMongoDB()
    return null;
  }
}

async function testMongoDB() {
  try {
    const { client } = await connectMongoDB();
    await client.db(MONGODB_DB_NAME).admin().ping();
    return true;
  } catch (error) {
    console.error('MongoDB connection test failed:', error);
    return false;
  }
}

// Initialize connections
createMySQLPool();
connectMongoDB().catch(err => console.error('MongoDB initial connection failed:', err));

module.exports = {
  // MySQL
  getMySQLConnection,
  queryMySQL,
  testMySQL,
  getMySQLPool: () => mysqlPool,
  
  // MongoDB
  connectMongoDB,
  getMongoDB,
  getMongoCollection,
  testMongoDB,
  
  // Cleanup
  async closeConnections() {
    if (mysqlPool) {
      await mysqlPool.end();
      mysqlPool = null;
    }
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
      mongoDb = null;
    }
  }
};
