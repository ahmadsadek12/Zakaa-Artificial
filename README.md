# Zakaa Database Setup

This project implements a hybrid SQL/NoSQL database architecture for the Zakaa application.

## Architecture

- **MySQL** (127.0.0.1:3306): Users, branches, items, active orders (≤24-48 hours)
- **MongoDB** (localhost:27017): Order logs, audit trails, WhatsApp message logs

## Prerequisites

- Node.js (v14 or higher)
- MySQL Server running on 127.0.0.1:3306
- MongoDB running on localhost:27017

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
   - MySQL credentials are already set
   - MongoDB connection is configured
   - **Important**: Generate a secure encryption key for WhatsApp tokens:
     ```bash
     openssl rand -hex 32
     ```
     Update `ENCRYPTION_KEY` in `.env` with the generated key

## Database Initialization

Run the initialization script to create the database schema:

```bash
npm run init
```

This will:
- Create the MySQL database if it doesn't exist
- Create all tables (users, branches, items, orders, order_items, item_ingredients)
- Set up MongoDB indexes and validation
- Verify both database connections

## Project Structure

```
.
├── .env                    # Database credentials & config
├── database/
│   ├── schema.sql          # MySQL schema with all tables
│   ├── mongodb_init.js     # MongoDB collection setup
│   ├── mysql_connection.js # MySQL connection utility
│   ├── mongodb_connection.js # MongoDB connection utility
│   └── init.js             # Database initialization script
└── utils/
    └── encryption.js       # Token encryption utilities
```

## Database Schema

### MySQL Tables

- **users**: Multi-role table (admin, business, customer) with UUID primary keys
- **branches**: Business branches with location data and WhatsApp configuration
- **items**: Products/services with optional branch association
- **item_ingredients**: Optional normalization table for item ingredients
- **orders**: Active orders with status tracking (lifecycle ≤24-48 hours)
- **order_items**: Many-to-many relationship with price snapshots

### MongoDB Collections

- **order_logs**: Immutable documents with full order snapshots, status timeline, and archived timestamps

## Usage

### MySQL Connection

```javascript
const { query, getConnection } = require('./database/mysql_connection');

// Execute a query
const users = await query('SELECT * FROM users WHERE user_type = ?', ['business']);

// Get a connection for transactions
const conn = await getConnection();
await conn.beginTransaction();
// ... your queries
await conn.commit();
conn.release();
```

### MongoDB Connection

```javascript
const { getCollection } = require('./database/mongodb_connection');

// Get a collection
const orderLogs = await getCollection('order_logs');

// Insert a document
await orderLogs.insertOne({
  order_id: 'uuid',
  business_id: 'uuid',
  // ... other fields
});
```

### Encryption Utility

```javascript
const { encryptToken, decryptToken } = require('./utils/encryption');

// Encrypt a WhatsApp token
const encrypted = encryptToken('your-token-here');

// Decrypt a token
const decrypted = decryptToken(encrypted);
```

## Security

- WhatsApp tokens are encrypted using AES-256-GCM
- Encryption key is stored in `.env` (never commit to version control)
- Foreign key constraints enforce data integrity
- UUIDs used for multi-tenant safety

## Next Steps

1. Implement the archive job to move completed orders (>24h) from MySQL to MongoDB
2. Set up connection testing utilities
3. Create migration scripts if needed

