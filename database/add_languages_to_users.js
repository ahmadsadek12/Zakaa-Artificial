const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function addLanguagesToUsers() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check if languages column exists
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'languages'
    `);

    if (rows[0].count === 0) {
      logger.info('Adding languages column to users table...');
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN languages JSON AFTER default_language;
      `);
      logger.info('✅ Successfully added languages column to users table!');
      
      // Update existing users to have default languages
      await connection.query(`
        UPDATE users 
        SET languages = '["english"]'
      `);
      logger.info('✅ Set default languages ["english"] for all users');
      
      logger.info('Available languages: Lebanese (arabizi), English, French, عربي (arabic)');
      logger.info('Users can select which languages their bot is allowed to speak');
    } else {
      logger.info('✓ languages column already exists in users table.');
    }

    logger.info('Done!');
  } catch (error) {
    logger.error('Error adding languages to users table:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

addLanguagesToUsers();
