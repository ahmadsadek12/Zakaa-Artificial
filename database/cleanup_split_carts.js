const { getMySQLConnection } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function cleanupSplitCarts() {
  let connection;
  try {
    connection = await getMySQLConnection();
    logger.info('Connected to MySQL database');

    // Find customers with multiple carts (the bug case)
    const [duplicateCarts] = await connection.query(`
      SELECT customer_phone_number, COUNT(*) as cart_count
      FROM orders
      WHERE status = 'cart' AND notes = '__cart__'
      GROUP BY business_id, customer_phone_number
      HAVING cart_count > 1
    `);

    if (duplicateCarts.length === 0) {
      logger.info('No split carts found');
      return;
    }

    logger.info(`Found ${duplicateCarts.length} customer(s) with split carts`);

    for (const customer of duplicateCarts) {
      logger.info(`Processing ${customer.customer_phone_number} (${customer.cart_count} carts)`);

      // Get all carts for this customer
      const [carts] = await connection.query(`
        SELECT o.id, o.business_id, o.created_at,
               COUNT(oi.id) as item_count,
               o.delivery_type, o.location_address, o.scheduled_for
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.customer_phone_number = ?
          AND o.status = 'cart'
          AND o.notes = '__cart__'
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `, [customer.customer_phone_number]);

      if (carts.length < 2) continue;

      // Keep the cart with items, delete empty ones
      const cartWithItems = carts.find(c => c.item_count > 0) || carts[0];
      const cartsToDelete = carts.filter(c => c.id !== cartWithItems.id);

      logger.info(`  Keeping cart ${cartWithItems.id} (${cartWithItems.item_count} items)`);

      for (const cart of cartsToDelete) {
        // If this cart has delivery info that the main cart doesn't, copy it first
        if (cart.delivery_type && !cartWithItems.delivery_type) {
          await connection.query(`
            UPDATE orders
            SET delivery_type = ?,
                location_address = ?,
                scheduled_for = ?
            WHERE id = ?
          `, [cart.delivery_type, cart.location_address, cart.scheduled_for, cartWithItems.id]);
          logger.info(`  Copied delivery info from cart ${cart.id} to ${cartWithItems.id}`);
        }

        // Delete the duplicate cart
        await connection.query('DELETE FROM orders WHERE id = ?', [cart.id]);
        logger.info(`  Deleted empty cart ${cart.id}`);
      }
    }

    logger.info('\n✅ Split carts cleaned up successfully!');

  } catch (error) {
    logger.error('Error cleaning up split carts:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

cleanupSplitCarts();
