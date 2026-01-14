const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function updateBusinessLanguages() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Update all businesses to have all 4 languages available
    const allLanguages = JSON.stringify(['english', 'arabic', 'arabizi', 'french']);
    
    await connection.query(`
      UPDATE users 
      SET languages = ?
      WHERE user_type = 'business'
    `, [allLanguages]);
    
    logger.info('✅ Updated all businesses to have all 4 languages available');
    logger.info('Languages: English, عربي (Arabic), Lebanese (Arabizi), Français (French)');
    
    // Show current business languages
    const [businesses] = await connection.query(`
      SELECT business_name, languages 
      FROM users 
      WHERE user_type = 'business' AND deleted_at IS NULL
    `);
    
    logger.info('Current businesses:');
    businesses.forEach(b => {
      logger.info(`  - ${b.business_name}: ${b.languages}`);
    });
    
    logger.info('Done!');
  } catch (error) {
    logger.error('Error updating business languages:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

updateBusinessLanguages();
