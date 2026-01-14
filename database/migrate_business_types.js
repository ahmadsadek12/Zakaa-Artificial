const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function migrateBusinessTypes() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Step 1: Check current enum
    const [columns] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'business_type'
    `);

    const currentEnum = columns[0]?.COLUMN_TYPE;
    logger.info(`Current business_type enum: ${currentEnum}`);

    if (currentEnum && currentEnum.includes("'f & b'")) {
      logger.info('✓ Business types already migrated');
      process.exit(0);
    }

    // Step 2: Add new values to enum (temporary - includes both old and new)
    logger.info('Step 1: Adding new business types to enum...');
    await connection.query(`
      ALTER TABLE users 
      MODIFY business_type ENUM('restaurant', 'sports_court', 'salon', 'other', 'f & b', 'services', 'products')
    `);
    logger.info('  ✓ New values added to enum');

    // Step 3: Migrate data
    logger.info('Step 2: Migrating business type data...');
    
    // Migrate 'restaurant' to 'f & b'
    const [fbResult] = await connection.query(`
      UPDATE users 
      SET business_type = 'f & b' 
      WHERE business_type = 'restaurant'
    `);
    logger.info(`  - Migrated ${fbResult.affectedRows} 'restaurant' → 'f & b'`);

    // Migrate sports_court, salon to 'services'
    const [servicesResult] = await connection.query(`
      UPDATE users 
      SET business_type = 'services' 
      WHERE business_type IN ('sports_court', 'salon')
    `);
    logger.info(`  - Migrated ${servicesResult.affectedRows} sports_court/salon → 'services'`);

    // Migrate other to 'products'
    const [productsResult] = await connection.query(`
      UPDATE users 
      SET business_type = 'products' 
      WHERE business_type = 'other'
    `);
    logger.info(`  - Migrated ${productsResult.affectedRows} other → 'products'`);

    // Step 4: Remove old values from enum
    logger.info('Step 3: Removing old business types from enum...');
    await connection.query(`
      ALTER TABLE users 
      MODIFY business_type ENUM('f & b', 'services', 'products')
    `);
    logger.info('  ✓ Old values removed');

    // Step 5: Show final counts
    const [counts] = await connection.query(`
      SELECT business_type, COUNT(*) as count 
      FROM users 
      WHERE user_type = 'business' 
      GROUP BY business_type
    `);

    logger.info('\n✅ Business type migration completed!');
    logger.info('Final counts:');
    counts.forEach(row => {
      logger.info(`  - ${row.business_type}: ${row.count} business(es)`);
    });
    
  } catch (error) {
    logger.error('Error migrating business types:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

migrateBusinessTypes();
