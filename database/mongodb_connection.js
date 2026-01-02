// MongoDB Connection Utility
// Manages MongoDB client connection with retry logic

const { MongoClient } = require('mongodb');
require('dotenv').config();

let client = null;
let db = null;

const MONGODB_URI = `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}`;
const DB_NAME = process.env.MONGODB_DATABASE || 'zakaa_db';

async function connect() {
  if (client && client.topology && client.topology.isConnected()) {
    return { client, db };
  }
  
  try {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    
    console.log('MongoDB connected successfully');
    return { client, db };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    client = null;
    db = null;
    throw error;
  }
}

async function getDb() {
  if (!db || !client || !client.topology || !client.topology.isConnected()) {
    await connect();
  }
  return db;
}

async function getClient() {
  if (!client || !client.topology || !client.topology.isConnected()) {
    await connect();
  }
  return client;
}

async function testConnection() {
  try {
    const { client: testClient } = await connect();
    await testClient.db(DB_NAME).admin().ping();
    return true;
  } catch (error) {
    console.error('MongoDB connection test failed:', error);
    return false;
  }
}

async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

// Get collection helper
async function getCollection(collectionName) {
  const database = await getDb();
  return database.collection(collectionName);
}

module.exports = {
  connect,
  getDb,
  getClient,
  getCollection,
  testConnection,
  closeConnection
};

