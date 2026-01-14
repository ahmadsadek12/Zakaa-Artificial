const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function checkBranches() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Check branches table
    const [branches] = await connection.query('SELECT id, business_id FROM branches LIMIT 5');
    console.log('\n=== BRANCHES TABLE ===');
    console.log('Count:', branches.length);
    console.log('Branches:', branches);

    // Check users who are businesses or branches
    const [users] = await connection.query(`
      SELECT id, user_type, business_name, parent_user_id 
      FROM users 
      WHERE user_type IN ('business', 'branch') 
      LIMIT 5
    `);
    console.log('\n=== USERS (BUSINESS/BRANCH) ===');
    console.log('Count:', users.length);
    console.log('Users:', users);

  } catch (error) {
    logger.error('Error checking branches:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

checkBranches();
