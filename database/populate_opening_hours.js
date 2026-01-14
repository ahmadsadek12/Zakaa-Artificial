const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');
const { generateUUID } = require('../src/utils/uuid');

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

async function populateOpeningHours() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Get all businesses
    const [businesses] = await connection.query(`
      SELECT id, business_name, business_type 
      FROM users 
      WHERE user_type = 'business' AND deleted_at IS NULL
    `);

    logger.info(`Found ${businesses.length} businesses`);

    for (const business of businesses) {
      // Check if opening hours already exist
      const [existingHours] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM opening_hours 
        WHERE owner_type = 'business' AND owner_id = ?
      `, [business.id]);

      if (existingHours[0].count > 0) {
        logger.info(`  - ${business.business_name}: Already has opening hours (${existingHours[0].count} days)`);
        continue;
      }

      // Determine hours based on business type
      let openTime, closeTime;
      if (business.business_type === 'food and beverage') {
        openTime = '11:00:00';
        closeTime = '23:00:00'; // 11 PM
      } else {
        openTime = '09:00:00';
        closeTime = '22:00:00'; // 10 PM
      }

      // Insert opening hours for all days
      for (const day of DAYS_OF_WEEK) {
        const id = generateUUID();
        await connection.query(`
          INSERT INTO opening_hours (id, owner_type, owner_id, day_of_week, open_time, close_time, is_closed)
          VALUES (?, 'business', ?, ?, ?, ?, false)
        `, [id, business.id, day, openTime, closeTime]);
      }

      logger.info(`  ✅ ${business.business_name} (${business.business_type}): ${openTime.substring(0, 5)} - ${closeTime.substring(0, 5)}`);
    }

    logger.info('\n✅ Opening hours populated successfully!');
    logger.info('Summary:');
    logger.info('  - Restaurants: 11:00 AM - 11:00 PM daily');
    logger.info('  - Other businesses: 9:00 AM - 10:00 PM daily');
    
  } catch (error) {
    logger.error('Error populating opening hours:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

populateOpeningHours();
