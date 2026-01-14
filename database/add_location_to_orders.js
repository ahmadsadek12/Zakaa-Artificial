const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addLocationToOrders() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check if location_latitude column exists
    const [latCol] = await connection.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'location_latitude'
    `);

    if (latCol[0].count === 0) {
      logger.info('Adding location fields to orders table...');
      
      await connection.query(`
        ALTER TABLE orders
        ADD COLUMN location_latitude DECIMAL(10, 8) NULL AFTER notes,
        ADD COLUMN location_longitude DECIMAL(11, 8) NULL AFTER location_latitude,
        ADD COLUMN location_name VARCHAR(255) NULL AFTER location_longitude,
        ADD COLUMN location_address TEXT NULL AFTER location_name
      `);
      
      logger.info('✅ Added location fields:');
      logger.info('  - location_latitude (DECIMAL 10,8)');
      logger.info('  - location_longitude (DECIMAL 11,8)');
      logger.info('  - location_name (VARCHAR 255)');
      logger.info('  - location_address (TEXT)');
    } else {
      logger.info('✓ Location fields already exist in orders table');
    }

    logger.info('\n✅ Location fields migration completed!');
    logger.info('Orders can now store:');
    logger.info('  - GPS coordinates (latitude/longitude)');
    logger.info('  - Location name (from WhatsApp)');
    logger.info('  - Location address (from WhatsApp or reverse geocoding)');
    
  } catch (error) {
    logger.error('Error adding location fields:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

addLocationToOrders();
