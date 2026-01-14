const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function migrateItemDefaults() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Step 1: Set defaults for items belonging to 'services' businesses
    logger.info('Step 1: Updating items for services businesses...');
    const [servicesResult] = await connection.query(`
      UPDATE items i
      JOIN users u ON i.business_id = u.id
      SET 
        i.item_type = 'service',
        i.is_schedulable = true,
        i.min_schedule_hours = 2
      WHERE u.business_type = 'services'
    `);
    logger.info(`  - Updated ${servicesResult.affectedRows} items: type=service, schedulable=true, min=2hrs`);

    // Step 2: Set defaults for items belonging to 'f & b' businesses
    logger.info('Step 2: Updating items for f & b businesses...');
    const [fbResult] = await connection.query(`
      UPDATE items i
      JOIN users u ON i.business_id = u.id
      SET 
        i.item_type = 'good',
        i.is_schedulable = false,
        i.min_schedule_hours = 0
      WHERE u.business_type = 'f & b'
    `);
    logger.info(`  - Updated ${fbResult.affectedRows} items: type=good, schedulable=false`);

    // Step 3: Set defaults for items belonging to 'products' businesses
    logger.info('Step 3: Updating items for products businesses...');
    const [productsResult] = await connection.query(`
      UPDATE items i
      JOIN users u ON i.business_id = u.id
      SET 
        i.item_type = 'good',
        i.is_schedulable = false,
        i.min_schedule_hours = 0
      WHERE u.business_type = 'products'
    `);
    logger.info(`  - Updated ${productsResult.affectedRows} items: type=good, schedulable=false`);

    // Step 4: Show summary
    const [summary] = await connection.query(`
      SELECT 
        u.business_type,
        i.item_type,
        i.is_schedulable,
        COUNT(*) as count
      FROM items i
      JOIN users u ON i.business_id = u.id
      WHERE i.deleted_at IS NULL
      GROUP BY u.business_type, i.item_type, i.is_schedulable
      ORDER BY u.business_type, i.item_type
    `);

    logger.info('\n✅ Item defaults migration completed!');
    logger.info('Summary by business type:');
    summary.forEach(row => {
      const schedulable = row.is_schedulable ? 'schedulable' : 'not schedulable';
      logger.info(`  - ${row.business_type}: ${row.count} ${row.item_type}(s) [${schedulable}]`);
    });

  } catch (error) {
    logger.error('Error migrating item defaults:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

migrateItemDefaults();
