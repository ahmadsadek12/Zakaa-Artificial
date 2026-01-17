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
        // If it fails due to foreign key constraint, temporarily drop and recreate it
        if (error.code === 'ER_FK_INCOMPATIBLE_COLUMNS' || error.errno === 3780) {
          logger.warn('Foreign key constraint issue detected. Fixing column type mismatches first...');
          
          // Get the type of users.id
          const [userIdType] = await connection.query(`
            SELECT COLUMN_TYPE 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'users' 
              AND COLUMN_NAME = 'id'
          `);
          
          const usersIdType = userIdType[0]?.COLUMN_TYPE || 'CHAR(36)';
          logger.info(`users.id type: ${usersIdType}`);
          
          // Find all foreign key constraints that reference users.id
          const [fkConstraints] = await connection.query(`
            SELECT 
              TABLE_NAME,
              CONSTRAINT_NAME,
              COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'users'
              AND REFERENCED_COLUMN_NAME = 'id'
              AND TABLE_SCHEMA = DATABASE()
          `);
          
          logger.info(`Found ${fkConstraints.length} foreign key constraints`);
          
          // First, fix column type mismatches in referencing tables
          const tablesToFix = new Set();
          for (const fk of fkConstraints) {
            tablesToFix.add(fk.TABLE_NAME);
          }
          
          for (const tableName of tablesToFix) {
            try {
              const [colInfo] = await connection.query(`
                SELECT COLUMN_NAME, COLUMN_TYPE 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = ? 
                  AND COLUMN_NAME IN ('user_id', 'business_user_id', 'parent_user_id')
              `, [tableName]);
              
              for (const col of colInfo) {
                if (col.COLUMN_TYPE !== usersIdType) {
                  logger.info(`Fixing ${tableName}.${col.COLUMN_NAME} type from ${col.COLUMN_TYPE} to ${usersIdType}`);
                  await connection.query(`
                    ALTER TABLE \`${tableName}\` 
                    MODIFY COLUMN \`${col.COLUMN_NAME}\` ${usersIdType}
                  `);
                  logger.info(`✅ Fixed ${tableName}.${col.COLUMN_NAME} type`);
                }
              }
            } catch (e) {
              logger.warn(`Could not fix columns in ${tableName}:`, e.message);
            }
          }
          
          // Now drop foreign key constraints
          logger.info('Dropping foreign key constraints...');
          const constraintsToRecreate = [];
          for (const fk of fkConstraints) {
            constraintsToRecreate.push({
              table: fk.TABLE_NAME,
              constraint: fk.CONSTRAINT_NAME,
              column: fk.COLUMN_NAME
            });
            
            try {
              await connection.query(`
                ALTER TABLE \`${fk.TABLE_NAME}\` 
                DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\`
              `);
              logger.info(`Dropped ${fk.CONSTRAINT_NAME} from ${fk.TABLE_NAME}`);
            } catch (e) {
              logger.warn(`Could not drop ${fk.CONSTRAINT_NAME} from ${fk.TABLE_NAME}:`, e.message);
            }
          }
          
          // Now add the column (try without AFTER clause to avoid position issues)
          try {
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
          }
          
          // Recreate foreign key constraints
          logger.info('Recreating foreign key constraints...');
          for (const fk of constraintsToRecreate) {
            try {
              // Determine ON DELETE action based on table and column
              let onDelete = 'CASCADE';
              if (fk.table === 'reservations' && fk.column === 'user_id') {
                onDelete = 'SET NULL';
              }
              if (fk.table === 'users' && fk.column === 'parent_user_id') {
                onDelete = 'CASCADE';
              }
              
              await connection.query(`
                ALTER TABLE \`${fk.table}\` 
                ADD CONSTRAINT \`${fk.constraint}\` 
                FOREIGN KEY (\`${fk.column}\`) 
                REFERENCES users(id) 
                ON DELETE ${onDelete}
              `);
              logger.info(`Recreated ${fk.constraint} on ${fk.table}`);
            } catch (e) {
              logger.warn(`Could not recreate ${fk.constraint} on ${fk.table}:`, e.message);
            }
          }
          
          // Recreate foreign key constraints
          for (const fk of constraintsToRecreate) {
            try {
              // Determine ON DELETE action based on table and column
              let onDelete = 'CASCADE';
              if (fk.table === 'reservations' && fk.column === 'user_id') {
                onDelete = 'SET NULL';
              }
              
              await connection.query(`
                ALTER TABLE \`${fk.table}\` 
                ADD CONSTRAINT \`${fk.constraint}\` 
                FOREIGN KEY (\`${fk.column}\`) 
                REFERENCES users(id) 
                ON DELETE ${onDelete}
              `);
              logger.info(`Recreated ${fk.constraint} on ${fk.table}`);
            } catch (e) {
              logger.warn(`Could not recreate ${fk.constraint} on ${fk.table}:`, e.message);
            }
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
