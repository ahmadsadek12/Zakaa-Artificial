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
  // Menus belong to business - all branches of a business share all menus
  const menus = await queryMySQL(
    `SELECT * FROM menus 
     WHERE business_id = ? AND is_active = true`,
    [business.id]
  );
  
  // Get items for business
  // For now, get all items for the business (can filter by branch later if needed)
  // Items can be associated with specific branch via branch_id, or be available to all branches (branch_id IS NULL)
  let itemsQuery = `
    SELECT i.*, m.name as menu_name FROM items i
    LEFT JOIN menus m ON i.menu_id = m.id
    WHERE i.business_id = ? AND i.availability = 'available' AND i.deleted_at IS NULL
  `;
  const itemsParams = [business.id];
  
  // Try to filter by branch if branch exists
  if (branch?.id) {
    // Branch is now a user with user_type='branch', branch.id is the user ID
    // Include items that belong to this branch or have no specific branch
    itemsQuery += ` AND (i.branch_id = ? OR i.branch_id IS NULL)`;
    itemsParams.push(branch.id);
  }
  // If no branch specified - show all items for business (branch_id IS NULL or any)
  
  itemsQuery += ` ORDER BY m.name, i.name`;
  
  const items = await queryMySQL(itemsQuery, itemsParams);
  
  // Get cart if exists (branch?.id is actually userId)
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
  
  // Determine business type context
  const isFoodAndBeverage = business.business_type === 'f & b';
  const isServices = business.business_type === 'services';
  const isProducts = business.business_type === 'products';
  const businessTypeContext = isFoodAndBeverage ? 'restaurant' : (isServices ? 'service business' : (isProducts ? 'product business' : 'business'));
  
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
  
  // Determine response language - use detected language, not default
  // This ensures the AI responds in the same language the customer is using
  const responseLanguage = language || business.default_language || 'english';
  
  // Build language-specific greeting templates
  const languageGreetings = {
    arabic: 'مرحباً',
    arabizi: 'Marhaba',  // Lebanese arabizi greeting
    english: 'Hello',
    french: 'Bonjour'
  };
  
  // Build business-specific context
  let businessContext = `You are a helpful AI assistant for ${business.business_name}, a ${businessTypeContext}.`;
  
  // Add business-type-specific context
  if (isFoodAndBeverage) {
    if (openStatus.isOpen) {
      businessContext += ` We're currently open.`;
    } else {
      businessContext += ` We're currently closed (${openStatus.reason}). You can still take orders for scheduled delivery/pickup.`;
    }
    
    if (business.allow_scheduled_orders) {
      businessContext += ` We accept scheduled orders - customers can order for a future time.`;
    }
  } else if (isServices) {
    businessContext += ` We offer services that can be scheduled.`;
    businessContext += ` Status: ${openStatus.isOpen ? 'Open' : `Closed (${openStatus.reason})`}`;
  } else {
    businessContext += ` Status: ${openStatus.isOpen ? 'Open' : `Closed (${openStatus.reason})`}`;
  }
  
  // Language instruction map (only English and Arabic)
  const languageInstructions = {
    'arabic': 'You MUST respond ONLY in Arabic (عربي). Use Arabic script for all responses.',
    'english': 'You MUST respond ONLY in English.'
  };

  // Concise prompt - keep it short to preserve conversation history context
  const systemPrompt = `${businessContext}

**CRITICAL: LANGUAGE INSTRUCTION**
${languageInstructions[responseLanguage] || languageInstructions['english']}
DO NOT mix languages. ALL text must be in ${responseLanguage}.
If customer asks to change language, tell them only English and Arabic are available.

Cart: ${cartSummary}

${!openStatus.isOpen && isFoodAndBeverage ? `
IMPORTANT - We're Closed:
- Inform customer we're currently closed
- Offer to schedule order for when we open (use set_scheduled_time function)
- Accept natural language time like "tomorrow 7pm" or "Friday evening"
- Opening hours:
${hoursText}
` : ''}

${isServices ? `
Service Scheduling:
- Services can be scheduled for future times
- Some services require minimum advance booking (check item min_schedule_hours)
- Use set_scheduled_time() to schedule services
- Opening hours:
${hoursText}
` : ''}

Address Format (Lebanese):
Lebanese addresses: "Street, Building, Block/Apt, Floor, Landmark"
Examples: "Salim Salam, Abraj Beirut, Block B2, 21, 7ad LIU"
Common words: "7ad/3ad" (next to), "faw2" (above), "ta7et" (below), "3al" (on/at)
Save FULL address exactly as provided with set_delivery_address().

Rules:
- Use get_menu_items() to show menu/catalog
- Use add_item_to_cart() when customer wants items/services
- Use set_delivery_address() for delivery addresses
${(isFoodAndBeverage && business.allow_scheduled_orders) || isServices ? '- Use set_scheduled_time() when customer wants to schedule (parse natural language)\n' : ''}- Use confirm_order() only when: cart has items + delivery type set + address (if delivery)${(isFoodAndBeverage && business.allow_scheduled_orders) || isServices ? ' + scheduled time (if scheduling)' : ''}
- Keep responses short and friendly`;

  const userPrompt = `Customer: "${message}"`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

module.exports = {
  buildPrompt
};
