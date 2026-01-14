const { getMySQLConnection } = require('../src/config/database');

async function checkChangedBy() {
  let connection;
  try {
    connection = await getMySQLConnection();
    
    const [cols] = await connection.query('SHOW COLUMNS FROM order_status_history LIKE "changed_by"');
    console.log('\nchanged_by column:');
    console.log(cols[0]);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

checkChangedBy();
