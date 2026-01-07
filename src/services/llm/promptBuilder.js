// Prompt Builder
// Build structured prompts from database data

const { queryMySQL } = require('../../config/database');
const cartManager = require('./cartManager');
const conversationManager = require('./conversationManager');
const logger = require('../../utils/logger');

/**
 * Build prompt with business context and conversation state
 */
async function buildPrompt({ business, branch, customerPhoneNumber, message, language, messageHistory = [] }) {
  // Fetch business context (menus, items, policies, hours)
  const menus = await queryMySQL(
    `SELECT m.* FROM menus m 
     JOIN branch_menus bm ON m.id = bm.menu_id 
     WHERE bm.branch_id = ? AND m.is_active = true`,
    [branch?.id || business.id]
  );
  
  const items = await queryMySQL(
    `SELECT i.*, m.name as menu_name FROM items i
     LEFT JOIN menus m ON i.menu_id = m.id
     WHERE i.business_id = ? AND i.availability = 'available' AND i.deleted_at IS NULL
     ORDER BY m.name, i.name`,
    [business.id]
  );
  
  // Get cart if exists
  const cart = await cartManager.getCart(business.id, branch?.id || business.id, customerPhoneNumber);
  
  // Get opening hours
  const openingHours = await queryMySQL(`
    SELECT * FROM opening_hours 
    WHERE owner_type = ? AND owner_id = ? 
    ORDER BY 
      CASE day_of_week
        WHEN 'monday' THEN 1
        WHEN 'tuesday' THEN 2
        WHEN 'wednesday' THEN 3
        WHEN 'thursday' THEN 4
        WHEN 'friday' THEN 5
        WHEN 'saturday' THEN 6
        WHEN 'sunday' THEN 7
      END
  `, ['branch', branch?.id || business.id]);
  
  if (openingHours.length === 0) {
    const businessHours = await queryMySQL(`
      SELECT * FROM opening_hours 
      WHERE owner_type = ? AND owner_id = ? 
      ORDER BY 
        CASE day_of_week
          WHEN 'monday' THEN 1
          WHEN 'tuesday' THEN 2
          WHEN 'wednesday' THEN 3
          WHEN 'thursday' THEN 4
          WHEN 'friday' THEN 5
          WHEN 'saturday' THEN 6
          WHEN 'sunday' THEN 7
        END
    `, ['business', business.id]);
    openingHours.push(...businessHours);
  }
  
  // Get policies
  const policies = await queryMySQL(`
    SELECT * FROM policies 
    WHERE owner_type = ? AND owner_id = ?
    ORDER BY created_at DESC
  `, ['branch', branch?.id || business.id]);
  
  if (policies.length === 0) {
    const businessPolicies = await queryMySQL(`
      SELECT * FROM policies 
      WHERE owner_type = ? AND owner_id = ?
      ORDER BY created_at DESC
    `, ['business', business.id]);
    policies.push(...businessPolicies);
  }
  
  // Check if open now
  const openStatus = await conversationManager.isOpenNow(business.id, branch?.id || business.id);
  
  // Build opening hours text
  const hoursText = openingHours.length > 0 
    ? openingHours.map(h => {
        if (h.is_closed) {
          return `${h.day_of_week}: Closed`;
        }
        return `${h.day_of_week}: ${h.open_time ? h.open_time.substring(0, 5) : 'Open'} - ${h.close_time ? h.close_time.substring(0, 5) : 'Close'}`;
      }).join('\n')
    : 'Opening hours not specified';
  
  // Build items text (grouped by menu if applicable)
  let itemsText = '';
  if (items.length > 0) {
    const itemsByMenu = {};
    for (const item of items) {
      const menuName = item.menu_name || 'All Items';
      if (!itemsByMenu[menuName]) {
        itemsByMenu[menuName] = [];
      }
      itemsByMenu[menuName].push(item);
    }
    
    itemsText = Object.entries(itemsByMenu).map(([menuName, menuItems]) => {
      return `**${menuName}:**\n${menuItems.map(item => 
        `  • ${item.name} - ${item.price}${item.description ? `\n    ${item.description}` : ''}`
      ).join('\n')}`;
    }).join('\n\n');
  } else {
    itemsText = 'No items available at the moment.';
  }
  
  // Build cart summary if items exist
  const cartSummary = cart.items && cart.items.length > 0 
    ? cartManager.getCartSummary(cart)
    : 'Cart is empty';
  
  // Build conversation history context
  const conversationContext = messageHistory.length > 0
    ? `\n\nRecent conversation:\n${messageHistory.slice(-5).map(m => 
        `${m.role === 'customer' ? 'Customer' : 'You'}: ${m.text}`
      ).join('\n')}`
    : '';
  
  // Build system prompt
  const systemPrompt = `You are a friendly and helpful AI assistant for ${business.business_name}${branch ? ` - ${branch.branch_name}` : ''}.
You handle customer service and order taking via WhatsApp.

**Your Role:**
- Greet customers warmly and naturally
- Answer questions about the menu, items, prices, and policies
- Help customers build their order (add items, modify quantities, remove items)
- Handle date/time selection for scheduled orders
- Provide information about opening hours and availability
- Confirm orders when customer is ready
- Respond naturally and conversationally

**Business Information:**
- Name: ${business.business_name}
- Type: ${business.business_type}
- Default Language: ${business.default_language || 'arabic'}
${branch ? `- Branch: ${branch.branch_name}` : ''}

**Current Status:**
- Open Now: ${openStatus.isOpen ? 'Yes' : `No (${openStatus.reason})`}

**Opening Hours:**
${hoursText}

**Menu & Items:**
${itemsText}

**Policies:**
${policies.length > 0 
  ? policies.map(p => `- ${p.policy_type}: ${p.description}`).join('\n')
  : 'No specific policies listed'}

**Current Cart:**
${cartSummary}

**Important Rules:**
1. ONLY offer items that exist in the menu above
2. NEVER invent items, prices, or information
3. If asked about something not in the menu, politely say it's not available
4. Help customers add items to cart by name (match items from menu above)
5. For quantities, ask if not specified
6. For scheduled orders, check availability and suggest available times
7. For delivery, ask for delivery address if needed
8. When customer confirms order, say "Order confirmed! Your order #ORDER_ID has been placed."
9. Respond naturally in ${language || business.default_language || 'arabic'} language
10. Be friendly, helpful, and conversational

**Order Actions You Can Take:**
- To add item: Say "Adding [item name] to your cart"
- To show cart: Display current cart items and total
- To remove item: Say "Removed [item name] from cart"
- To confirm order: Say "Order confirmed! Your order #ORDER_ID has been placed."
- To schedule: Ask for date and time, then suggest available slots

**Current conversation language:** ${language || 'unknown'}${conversationContext}`;

  const userPrompt = `Customer (${customerPhoneNumber}) says: "${message}"

Based on the context above, respond naturally and helpfully. If this is a greeting, greet them warmly and offer to help. If they're asking about items, explain what's available. If they want to order, help them add items to cart. If they're ready to checkout, confirm the order.`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

module.exports = {
  buildPrompt
};
