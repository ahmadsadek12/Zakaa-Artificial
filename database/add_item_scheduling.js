const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addItemScheduling() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check if item_type column exists
    const [itemTypeCol] = await connection.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'items' AND column_name = 'item_type'
    `);

    if (itemTypeCol[0].count === 0) {
      logger.info('Adding item_type column to items table...');
      await connection.query(`
        ALTER TABLE items
        ADD COLUMN item_type ENUM('service', 'good') DEFAULT 'good' AFTER description
      `);
      logger.info('✅ Added item_type column');
    } else {
      logger.info('✓ item_type column already exists');
    }

    // Check if is_schedulable column exists
    const [schedulableCol] = await connection.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'items' AND column_name = 'is_schedulable'
    `);

    if (schedulableCol[0].count === 0) {
      logger.info('Adding is_schedulable column to items table...');
      await connection.query(`
        ALTER TABLE items
        ADD COLUMN is_schedulable BOOLEAN DEFAULT false AFTER item_type
      `);
      logger.info('✅ Added is_schedulable column');
    } else {
      logger.info('✓ is_schedulable column already exists');
    }

    // Check if min_schedule_hours column exists
    const [minScheduleCol] = await connection.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'items' AND column_name = 'min_schedule_hours'
    `);

    if (minScheduleCol[0].count === 0) {
      logger.info('Adding min_schedule_hours column to items table...');
      await connection.query(`
        ALTER TABLE items
        ADD COLUMN min_schedule_hours INT DEFAULT 0 AFTER is_schedulable
      `);
      logger.info('✅ Added min_schedule_hours column');
    } else {
      logger.info('✓ min_schedule_hours column already exists');
    }

    logger.info('\n✅ Item scheduling fields added successfully!');
    logger.info('New fields:');
    logger.info('  - item_type: ENUM("service", "good") - Type of item');
    logger.info('  - is_schedulable: BOOLEAN - Can be scheduled for future time');
    logger.info('  - min_schedule_hours: INT - Minimum hours in advance (0 = immediate allowed)');
    
  } catch (error) {
    logger.error('Error adding item scheduling fields:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

addItemScheduling();
