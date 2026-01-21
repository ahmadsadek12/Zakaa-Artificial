// Seed Subscriptions Table
// Run with: node database/seed_subscriptions.js

const mysql = require('mysql2/promise');
const { generateUUID } = require('../src/utils/uuid');
require('dotenv').config();

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

const subscriptions = [
  {
    name: "Instagram Messaging",
    price: 15,
    description: "Zakaa now works on your instagram Direct Messages!",
    sale: 0
  },
  {
    name: "Data and Analytics",
    price: 20,
    description: "You can get all the data regarding your items, orders, and customers, including analytics",
    sale: 0
  },
  {
    name: "Tables",
    price: 15,
    description: "You now have access to reserving tables, and the choice of having Zakaa automatically reserve them for you!",
    sale: 0
  }
];

async function seedSubscriptions() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: MYSQL_HOST || '127.0.0.1',
      port: MYSQL_PORT || 3306,
      user: MYSQL_USER || 'root',
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE || 'zakaa_db'
    });

    console.log('✅ Connected to MySQL database');

    for (const sub of subscriptions) {
      // Check if subscription already exists
      const [existing] = await connection.query(
        'SELECT id FROM subscriptions WHERE name = ? AND deleted_at IS NULL',
        [sub.name]
      );

      if (existing.length > 0) {
        console.log(`⚠️  Subscription "${sub.name}" already exists. Skipping.`);
        continue;
      }

      const id = generateUUID();
      await connection.query(
        `INSERT INTO subscriptions (id, name, price, description, sale) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, sub.name, sub.price, sub.description, sub.sale]
      );

      console.log(`✅ Created subscription: ${sub.name}`);
    }

    console.log('✅ All subscriptions seeded successfully');

  } catch (error) {
    console.error('❌ Error seeding subscriptions:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

seedSubscriptions()
  .then(() => {
    console.log('✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
