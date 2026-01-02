// MongoDB Initialization Script
// Sets up order_logs collection with indexes and validation

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}`;
const DB_NAME = process.env.MONGODB_DATABASE || 'zakaa_db';

async function initializeMongoDB() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('order_logs');
    
    // Create indexes for better query performance
    await collection.createIndex({ order_id: 1 }, { unique: true });
    await collection.createIndex({ business_id: 1 });
    await collection.createIndex({ customer_id: 1 });
    await collection.createIndex({ archived_at: 1 });
    await collection.createIndex({ 'status_timeline.status': 1 });
    await collection.createIndex({ created_at: 1 });
    
    console.log('MongoDB indexes created successfully');
    
    // Optional: Create validation schema (MongoDB 3.6+)
    try {
      await db.command({
        collMod: 'order_logs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['_id', 'order_id', 'business_id', 'customer_id', 'final_status', 'items', 'total', 'created_at', 'archived_at'],
            properties: {
              _id: { bsonType: 'string' },
              order_id: { bsonType: 'string' },
              business_id: { bsonType: 'string' },
              branch_id: { bsonType: 'string' },
              customer_id: { bsonType: 'string' },
              delivery_type: { 
                bsonType: 'string',
                enum: ['takeaway', 'delivery', 'on_site']
              },
              final_status: {
                bsonType: 'string',
                enum: ['pending', 'accepted', 'preparing', 'completed', 'cancelled']
              },
              items: {
                bsonType: 'array',
                items: {
                  bsonType: 'object',
                  required: ['item_id', 'name', 'quantity', 'price'],
                  properties: {
                    item_id: { bsonType: 'string' },
                    name: { bsonType: 'string' },
                    quantity: { bsonType: 'int' },
                    price: { bsonType: 'decimal' }
                  }
                }
              },
              subtotal: { bsonType: 'decimal' },
              delivery_price: { bsonType: 'decimal' },
              total: { bsonType: 'decimal' },
              status_timeline: {
                bsonType: 'array',
                items: {
                  bsonType: 'object',
                  required: ['status', 'at'],
                  properties: {
                    status: { bsonType: 'string' },
                    at: { bsonType: 'date' }
                  }
                }
              },
              created_at: { bsonType: 'date' },
              archived_at: { bsonType: 'date' }
            }
          }
        },
        validationLevel: 'strict',
        validationAction: 'error'
      });
      console.log('MongoDB validation schema applied');
    } catch (error) {
      console.warn('Could not apply validation schema (may require MongoDB 3.6+):', error.message);
    }
    
    console.log('MongoDB initialization completed successfully');
    
  } catch (error) {
    console.error('Error initializing MongoDB:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  initializeMongoDB()
    .then(() => {
      console.log('MongoDB setup complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('MongoDB setup failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeMongoDB };

