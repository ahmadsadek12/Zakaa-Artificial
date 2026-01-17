const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addDeliveryPriceToUsers() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check if delivery_price column exists
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'delivery_price'
    `);

    if (rows[0].count === 0) {
      logger.info('Adding delivery_price column to users table...');
      
      try {
        // Try to add the column directly
        await connection.query(`
          ALTER TABLE users
          ADD COLUMN delivery_price DECIMAL(10,2) DEFAULT 0.00 AFTER delivery_radius_km;
        `);
        logger.info('✅ Successfully added delivery_price column to users table!');
      } catch (error) {
        // If it fails due to foreign key constraint, temporarily disable FK checks
        if (error.code === 'ER_FK_INCOMPATIBLE_COLUMNS' || error.errno === 3780) {
          logger.warn('Foreign key constraint issue detected. Temporarily disabling foreign key checks...');
          
          // Disable foreign key checks temporarily
          await connection.query('SET FOREIGN_KEY_CHECKS = 0');
          logger.info('Foreign key checks disabled');
          
          try {
            // Now add the column (without AFTER clause to avoid position issues)
            await connection.query(`
              ALTER TABLE users
              ADD COLUMN delivery_price DECIMAL(10,2) DEFAULT 0.00
            `);
            logger.info('✅ Successfully added delivery_price column to users table!');
          } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
              logger.info('Column already exists, skipping...');
            } else {
              throw e;
            }
          } finally {
            // Re-enable foreign key checks
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
            logger.info('Foreign key checks re-enabled');
          }
        } else {
          throw error; // Re-throw if it's a different error
        }
      }
      
      // Set default delivery price of 0 for existing users
      await connection.query(`
        UPDATE users 
        SET delivery_price = 0.00
        WHERE delivery_price IS NULL;
      `);
      logger.info('✅ Set default delivery price of 0.00 for all existing users');
      
      logger.info('Users can now set their delivery price in settings, and the chatbot will use it when calculating order totals.');
    } else {
      logger.info('✓ delivery_price column already exists in users table.');
    }

    logger.info('Done!');
  } catch (error) {
    logger.error('Error adding delivery_price to users table:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

addDeliveryPriceToUsers();
