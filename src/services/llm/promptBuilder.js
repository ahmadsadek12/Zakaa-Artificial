// Prompt Builder
// Build structured prompts from database data

const { queryMySQL } = require('../../config/database');
const cartManager = require('./cartManager');
const conversationManager = require('./conversationManager');
const logger = require('../../utils/logger');

/**
 * Build prompt with business context and conversation state
 */
async function buildPrompt({ business, branch, customerPhoneNumber, message, language, messageHistory = [], isFirstMessage = false, shouldGreet = false }) {
  const ownerId = branch?.id || business.id;
  
  // Run independent database queries in parallel for better performance
  const [
    menus,
    items,
    cart,
    branchOpeningHours,
    businessOpeningHours,
    branchPolicies,
    businessPolicies,
    openStatus
  ] = await Promise.all([
    // Fetch menus
    queryMySQL(
      `SELECT * FROM menus 
       WHERE business_id = ? AND is_active = true`,
      [business.id]
    ),
    
    // Get items for business
    (async () => {
      let itemsQuery = `
        SELECT i.*, m.name as menu_name FROM items i
        LEFT JOIN menus m ON i.menu_id = m.id
        WHERE i.business_id = ? AND i.availability = 'available' AND i.deleted_at IS NULL
      `;
      const itemsParams = [business.id];
      
      if (branch?.id) {
        itemsQuery += ` AND (i.branch_id = ? OR i.branch_id IS NULL)`;
        itemsParams.push(branch.id);
      }
      
      itemsQuery += ` ORDER BY m.name, i.name`;
      return await queryMySQL(itemsQuery, itemsParams);
    })(),
    
    // Get cart
    cartManager.getCart(business.id, ownerId, customerPhoneNumber),
    
    // Get branch opening hours
    queryMySQL(`
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
    `, ['branch', ownerId]),
    
    // Get business opening hours (in parallel, will use if branch is empty)
    queryMySQL(`
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
    `, ['business', business.id]),
    
    // Get branch policies
    queryMySQL(`
      SELECT * FROM policies 
      WHERE owner_type = ? AND owner_id = ?
      ORDER BY created_at DESC
    `, ['branch', ownerId]),
    
    // Get business policies (in parallel, will use if branch is empty)
    queryMySQL(`
      SELECT * FROM policies 
      WHERE owner_type = ? AND owner_id = ?
      ORDER BY created_at DESC
    `, ['business', business.id]),
    
    // Check if open now
    conversationManager.isOpenNow(business.id, ownerId)
  ]);
  
  // Use branch data if available, otherwise fall back to business data
  const openingHours = branchOpeningHours.length > 0 ? branchOpeningHours : businessOpeningHours;
  const policies = branchPolicies.length > 0 ? branchPolicies : businessPolicies;
  
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
  
  // Build menus text with PDF and image information
  let menusText = '';
  if (menus.length > 0) {
    menusText = menus.map(menu => {
      let menuInfo = `**${menu.name}**`;
      if (menu.description) {
        menuInfo += `: ${menu.description}`;
      }
      if (menu.menu_pdf_url) {
        menuInfo += `\n  [PDF Menu available: ${menu.menu_pdf_url}]`;
      }
      // Parse menu_image_urls (stored as JSON string)
      let menuImageUrls = [];
      if (menu.menu_image_urls) {
        try {
          menuImageUrls = typeof menu.menu_image_urls === 'string' 
            ? JSON.parse(menu.menu_image_urls) 
            : menu.menu_image_urls;
          if (Array.isArray(menuImageUrls) && menuImageUrls.length > 0) {
            menuInfo += `\n  [Menu images available: ${menuImageUrls.length} image(s)]`;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (menu.menu_link) {
        menuInfo += `\n  [External link: ${menu.menu_link}]`;
      }
      return menuInfo;
    }).join('\n\n');
  }
  
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
        `  • ${item.name} - ${item.price}${item.description ? `\n    ${item.description}` : ''}${item.item_image_url ? `\n    [Image available: ${item.item_image_url}]` : ''}`
      ).join('\n')}`;
    }).join('\n\n');
  } else {
    itemsText = 'No items available at the moment.';
  }
  
  // Build cart summary if items exist
  const cartSummary = cart.items && cart.items.length > 0 
    ? cartManager.getCartSummary(cart)
    : 'Ongoing order is empty';
  
  // Build conversation history context (limited - DO NOT rely on this for business data)
  // Conversation history is ONLY for conversational context, NOT for business status, menu, prices, etc.
  const conversationContext = messageHistory.length > 0
    ? `\n\nRecent conversation (FOR CONTEXT ONLY - DO NOT use for business status/menu/prices):\n${messageHistory.slice(-3).map(m => 
        `${m.role === 'customer' ? 'Customer' : 'You'}: ${m.text}`
      ).join('\n')}`
    : '';
  
  // Determine response language - use detected language from message
  // Respond in Arabic only if Arabic script was detected, otherwise English
  const responseLanguage = language || 'english';
  
  // Build language-specific greeting templates
  const languageGreetings = {
    arabic: 'مرحباً',
    arabizi: 'Marhaba',  // Lebanese arabizi greeting
    english: 'Hello',
    french: 'Bonjour'
  };
  
  // Get current date and time in business timezone
  const businessTimezone = business.timezone || 'Asia/Beirut';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: businessTimezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const currentDateTime = formatter.format(now);
  
  // Build business-specific context with welcoming tone
  let businessContext = `You are a friendly and helpful AI assistant for ${business.business_name}, a ${businessTypeContext}.`;
  
  // Add current date/time context
  businessContext += `\n\n**CURRENT DATE AND TIME (${businessTimezone}):** ${currentDateTime}`;
  businessContext += `\nUse this as the reference for "today", "tomorrow", "now", and scheduling.`;
  
  // Add business-type-specific context - BE VERY EXPLICIT ABOUT OPEN STATUS
  if (isFoodAndBeverage) {
    if (openStatus.isOpen) {
      businessContext += `\n\n**IMPORTANT: We are CURRENTLY OPEN and accepting orders RIGHT NOW.**`;
      businessContext += `\nCustomers can place orders for immediate fulfillment.`;
    } else {
      businessContext += `\n\n**NOTE: We are currently closed (${openStatus.reason}), but customers can still place orders for scheduled delivery/pickup.**`;
    }
    
    if (business.allow_scheduled_orders) {
      businessContext += ` We're happy to accept scheduled orders for any future time that works for you.`;
    }
  } else if (isServices) {
    businessContext += ` We offer services that can be scheduled at your convenience.`;
    if (openStatus.isOpen) {
      businessContext += `\n\n**IMPORTANT: We are CURRENTLY OPEN and accepting bookings RIGHT NOW.**`;
    } else {
      businessContext += `\n**NOTE: Status: Closed (${openStatus.reason})**`;
    }
  } else {
    if (openStatus.isOpen) {
      businessContext += `\n\n**IMPORTANT: We are CURRENTLY OPEN and ready to help.**`;
    } else {
      businessContext += `\n**NOTE: Status: Closed (${openStatus.reason})**`;
    }
  }
  
  // Language instruction map
  const languageInstructions = {
    'arabic': 'You MUST respond ONLY in Arabic (عربي). Use Arabic script for all responses.',
    'english': 'You MUST respond ONLY in English.'
  };

  // Simple, natural conversation-focused prompt
  const systemPrompt = `${businessContext}

**CONVERSATION FLOW - MANDATORY RULES:**
1. ${shouldGreet ? `⚠️ START YOUR RESPONSE WITH: "Hello! Welcome to ${business.business_name}! How can I help you today?" (or equivalent in ${responseLanguage})` : 'DO NOT greet the customer unless they greet you first. Just answer their question directly.'}
2. Answer whatever the customer asks (menu, hours, prices, etc.) - be helpful and friendly
3. ⚠️ MENU HANDLING: Only show menu when customer's CURRENT message EXPLICITLY asks for menu ("show menu", "what do you have?", "menu please"). DO NOT show menu for greetings like "Hello", "Hi", "Hey" - just greet back. If customer says "I want pizza" or "give me burger", they're ORDERING - use add_item_to_cart(), NOT get_menu_items(). If menu was already shown in recent messages, don't show it again unless CURRENT message explicitly asks for menu.
4. ONLY when customer wants to ORDER, then follow the order process

**ORDER PROCESS - MANDATORY STEPS (ONLY when customer wants to order):**
- Step 1: Check if restaurant is open using get_closing_time() or confirm_order()
- Step 2: If OPEN: Take the order (items, notes)
- Step 3: ⚠️ CRITICAL - DELIVERY TYPE: When order items are decided (after adding items), you MUST ALWAYS ask: "Would you like this delivered, for dine-in, or takeaway?" UNLESS the customer has ALREADY mentioned their preference in the current or recent message. NEVER assume delivery type - ALWAYS ask if not explicitly mentioned.
- Step 4: If delivery chosen, ask for delivery address using set_delivery_address()
- Step 5: If CLOSED: Tell customer we're closed, show opening hours using get_opening_hours(), offer to schedule using set_scheduled_time()
- Step 6: ⚠️ CRITICAL - ORDER CONFIRMATION: You MUST NEVER automatically confirm an order. You MUST ALWAYS wait for the customer to explicitly say "CONFIRM" or "confirm" before calling confirm_order(). After all details are set (items, delivery type, address if delivery), show the order summary and ask: "Please type 'CONFIRM' to place your order." DO NOT call confirm_order() unless customer explicitly says "CONFIRM".

**PERSONALITY & TONE:**
- Be warm, friendly, and conversational - like a real person at the restaurant
- Answer questions directly - if they ask "are you open?", just answer that (use get_closing_time())
- Don't mention the ongoing order unless customer asks about their order
- Keep it simple and natural - chat like a human would

**CRITICAL: LANGUAGE INSTRUCTION**
You understand all languages including Lebanese Arabic (both Arabic script and written in English/Latin letters). 
You can communicate with customers in Lebanese dialect, English, or any language they use.
${languageInstructions[responseLanguage] || languageInstructions['english']}
DO NOT mix languages. ALL text in your response must be in ${responseLanguage}.


${!openStatus.isOpen && isFoodAndBeverage ? `
IMPORTANT - We're Closed:
- Inform customer we're currently closed in a friendly way
- Offer to schedule their order for when we open (use set_scheduled_time function)
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

**IMPORTANT - Item Scheduling Rules:**
- Some items are marked as "schedulable" (is_schedulable = true) - these CAN be scheduled for future times
- When business is OPEN: Schedulable items can be ordered immediately OR scheduled for later
- When business is CLOSED: Schedulable items MUST be scheduled for when business is open
- When customer adds a schedulable item while closed, inform them they need to schedule it using set_scheduled_time()
- When confirming order while closed, if ongoing order contains schedulable items without scheduled_for, require scheduling first

Available Menus:
${menusText || 'No menus available'}

**CRITICAL - IGNORE CONVERSATION HISTORY FOR BUSINESS DATA:**
- ⚠️ CONVERSATION HISTORY IS OUTDATED AND UNRELIABLE FOR BUSINESS DATA ⚠️
- NEVER mention business status (open/closed) from conversation history - it may be outdated
- NEVER mention menu items, prices, or availability from conversation history
- ⚠️ get_menu_items() - ONLY call when customer EXPLICITLY asks for menu ("show menu", "what do you have?", "menu please"). DO NOT call it when customer is trying to order items (e.g., "I want pizza" - use add_item_to_cart instead). If menu was already shown in recent messages, DO NOT show it again unless customer explicitly asks.
- ALWAYS call add_item_to_cart() when adding items - queries database for current data
- ALWAYS call get_closing_time() when asked about closing time
- ALWAYS call confirm_order() to check current business status - NEVER assume based on history
- THE DATABASE IS THE ONLY SOURCE OF TRUTH - conversation history is only for conversational flow

**TABLE RESERVATIONS (F&B Businesses Only):**
${isFoodAndBeverage ? `
- Table reservations are available for this business
- When customer wants to reserve a table, use create_table_reservation() function
- Only ask for: date + time (required), number of guests (recommended), name (optional), preferences like "terrace" or "inside" (optional)
- NO duration or end time needed - reservations are for a specific date and time only
- If customer doesn't specify a table number, system will automatically select the best available table based on number of guests and preferences
- After booking, confirm the reservation details but DO NOT say "Here is our menu" - handle reservation flow cleanly
- Use get_tables() to show available tables if customer asks
- Use cancel_table_reservation() if customer wants to cancel
- If table reservations are not enabled, reply: "Table reservations are not enabled for this business."
` : ''}

**AVAILABLE FUNCTIONS - USE AS NEEDED:**
- get_menu_items() - ⚠️ ONLY use when customer EXPLICITLY asks for menu ("show menu", "what do you have?", "menu please"). DO NOT use when customer is ordering items - use add_item_to_cart() instead. If menu was already shown, don't show again unless explicitly requested.
- get_closing_time() - Check closing time when customer asks "are you open?" or "when do you close?"
- get_opening_hours() - Show all opening hours when customer asks
- get_next_opening_time() - Show when you open next when currently closed
- send_menu_pdf() / send_menu_image() / send_item_image() - Send menu/item images when requested
- add_item_to_cart() - Add items when customer wants to order something
- set_order_notes() - Save special instructions when customer mentions modifications (e.g., "no tomato", "extra spicy")
- set_delivery_address() - Set address when customer provides delivery location (auto-sets delivery type)
- set_scheduled_time() - Schedule order when customer wants future delivery/time
- confirm_order() - ⚠️ CRITICAL: Confirm order ONLY when customer explicitly says "CONFIRM". NEVER call this automatically. After showing order summary, ask customer to type "CONFIRM", and ONLY call this when they say "CONFIRM". Everything must be ready (items, delivery type, address if delivery, scheduled time if closed)
- get_cart() - Get customer's current ongoing order (always accessible from database)
- get_my_orders() - Show customer's accepted orders when they ask "my orders", "show my orders", or want to check order status
- cancel_scheduled_order() - Show and cancel scheduled orders (always accessible from database)
- cancel_accepted_order() - Cancel an accepted scheduled order (only works for scheduled orders more than 2 hours away)
${isFoodAndBeverage ? `
- get_tables() - Show available tables when customer asks about table availability
- create_table_reservation() - Create table reservation when customer wants to reserve a table (date + time required, guests and preferences optional)
- cancel_table_reservation() - Cancel a table reservation when customer wants to cancel
` : ''}

**IMPORTANT - ORDERS ARE ALWAYS ACCESSIBLE:**
- Previous orders, ongoing orders, and scheduled orders are stored in the database
- These are ALWAYS accessible via functions (get_cart, cancel_scheduled_order) regardless of conversation history
- Conversation history may reset after 3 hours or when customer requests fresh start, but orders remain in database
- You can always check their ongoing order or scheduled orders by calling the appropriate functions

**REMEMBER:**
- Chat naturally - answer questions directly without always mentioning the ongoing order
- If they ask "are you open?", just check and tell them - don't bring up ordering
- Only go through order process when they actually want to order
- Keep it simple and friendly`;

  const userPrompt = `Customer: "${message}"`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

module.exports = {
  buildPrompt
};
