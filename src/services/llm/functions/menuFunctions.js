// Menu Functions
// Functions for retrieving menus, services, and sending menu images/PDFs

const logger = require('../../../utils/logger');
const { queryMySQL } = require('../../../config/database');
const cache = require('../../../utils/cache');

/**
 * Get menu function definitions for OpenAI
 */
function getMenuFunctionDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'get_services',
        description: 'Get all available menu items, menu images, or menu PDFs. ⚠️ ONLY use this when customer\'s CURRENT message EXPLICITLY asks to see the menu, wants to browse items, asks "what do you have?", "show me the menu", or requests the menu in any format. DO NOT use this for greetings ("Hello", "Hi", "Hey") - just greet back. DO NOT use this when customer is trying to order specific items (e.g., "I want pizza" - use add_item_to_cart instead). If menu was already shown in recent messages, do NOT call this again unless CURRENT message explicitly asks for menu again. This function automatically handles PDFs, images, and text-based menus based on what\'s available.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_service_image',
        description: 'Send an item image to the customer. Use this when customer asks to see a picture of an item, wants to see what an item looks like, or requests a photo/image of a specific item.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'The name of the item to send the image for'
            }
          },
          required: ['itemName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_menu_pdf',
        description: 'Send a menu PDF to the customer. ONLY use this when customer specifically says "PDF" or "download as PDF" or "menu PDF file". NEVER use this for general requests like "send menu", "show menu", "menu please" - for those, ALWAYS use get_menu_items instead. If no PDF is available, this function will fall back to sending menu images.',
        parameters: {
          type: 'object',
          properties: {
            menuName: {
              type: 'string',
              description: 'The name of the menu to send the PDF for. If not specified or "all", send the first available menu PDF.'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_menu_images',
        description: 'Send menu images to the customer. Use this when customer asks to see menu images, wants to see pictures of the menu, requests menu photos, or asks "can I see the menu?" (when they want visual menu).',
        parameters: {
          type: 'object',
          properties: {
            menuName: {
              type: 'string',
              description: 'The name of the menu to send images for. If not specified or "all", send images from the first available menu.'
            }
          },
          required: []
        }
      }
    }
  ];
}

/**
 * Execute menu function
 */
async function executeMenuFunction(functionName, args, context) {
  const { business, branch } = context;
  const branchId = branch?.id || business.id;
  
  // Handle backward-compatible aliases
  if (functionName === 'get_menu_items') {
    functionName = 'get_services';
  } else if (functionName === 'send_item_image') {
    functionName = 'send_service_image';
  } else if (functionName === 'send_menu_image') {
    functionName = 'send_menu_images';
  }
  
  switch (functionName) {
    case 'get_services': {
      // Check cache first (menu items don't change often)
      const cacheKey = `menu_items_${business.id}`;
      const cached = cache.get(cacheKey);
      
      if (cached) {
        logger.debug('Menu items served from cache', { businessId: business.id });
        return cached;
      }
      
      // Get all active menus
      const allMenus = await queryMySQL(
        `SELECT * FROM menus 
         WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
         ORDER BY name`,
        [business.id]
      );
      
      // STEP 1: Check for images first (highest priority)
      const menusWithImages = [];
      const allImageUrls = [];
      
      for (const menu of allMenus) {
        if (menu.menu_image_urls) {
          try {
            const menuImageUrls = typeof menu.menu_image_urls === 'string' 
              ? JSON.parse(menu.menu_image_urls) 
              : menu.menu_image_urls;
            if (Array.isArray(menuImageUrls) && menuImageUrls.length > 0) {
              menusWithImages.push({
                menu: menu,
                imageUrls: menuImageUrls
              });
              // Store images with menu name for grouping
              for (const imageUrl of menuImageUrls) {
                allImageUrls.push({
                  url: imageUrl,
                  menuName: menu.name
                });
              }
            }
          } catch (e) {
            logger.warn('Failed to parse menu_image_urls', { menuId: menu.id, error: e.message });
          }
        }
      }
      
      if (allImageUrls.length > 0) {
        // Limit to first 2 images only
        const limitedImageUrls = allImageUrls.slice(0, 2);
        
        // Build message - if multiple menus, include menu names
        let message = '📋 Here are our menus:';
        if (menusWithImages.length > 1) {
          // Multiple menus - list menu names
          message += '\n\n';
          for (const { menu, imageUrls } of menusWithImages) {
            message += `**${menu.name}** (${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''})\n`;
          }
        }
        
        const result = {
          success: true,
          message: message,
          // Return only first 2 images with menu names for better captions
          imageUrls: limitedImageUrls.map(img => img.url),
          imageUrlsWithMenu: limitedImageUrls, // Include full objects with menu names
          shouldSendImages: true,
          items: []
        };
        
        // Don't cache images - always fetch fresh
        return result;
      }
      
      // STEP 2: No images - check for PDF
      const menusWithPdf = allMenus.filter(menu => menu.menu_pdf_url);
      if (menusWithPdf.length > 0) {
        const pdfUrls = menusWithPdf.map(menu => menu.menu_pdf_url);
        
        let message = '📋 Here are our menus:';
        if (menusWithPdf.length > 1) {
          message += '\n\n';
          for (const menu of menusWithPdf) {
            message += `**${menu.name}**\n`;
          }
        }
        
        const result = {
          success: true,
          message: message,
          pdfUrls: pdfUrls,
          shouldSendPdf: true,
          items: []
        };
        
        // Don't cache PDFs - always fetch fresh
        return result;
      }
      
      // STEP 3: No PDF - check for links
      const menusWithLink = allMenus.filter(menu => menu.menu_link);
      if (menusWithLink.length > 0) {
        let message = '📋 Here are our menus:\n\n';
        for (const menu of menusWithLink) {
          message += `**${menu.name}**\n🔗 Menu link: ${menu.menu_link}\n\n`;
        }
        
        const result = {
          success: true,
          message: message,
          items: []
        };
        
        // Cache links for 5 minutes
        cache.set(cacheKey, result, 5 * 60 * 1000);
        return result;
      }
      
      // STEP 4: Final fallback - text-based menu from items
      const items = await queryMySQL(
        `SELECT i.*, m.name as menu_name FROM items i
         LEFT JOIN menus m ON i.menu_id = m.id
         WHERE i.business_id = ? AND i.availability = 'available' AND i.deleted_at IS NULL
         ORDER BY m.name, i.name`,
        [business.id]
      );
      
      if (items.length === 0) {
        const result = {
          success: true,
          message: 'No items available at the moment.',
          items: []
        };
        cache.set(cacheKey, result, 2 * 60 * 1000); // Cache empty results for 2 minutes
        return result;
      }
      
      // Format items by menu
      const itemsByMenu = {};
      for (const item of items) {
        const menuName = item.menu_name || 'All Items';
        if (!itemsByMenu[menuName]) {
          itemsByMenu[menuName] = [];
        }
        itemsByMenu[menuName].push({
          name: item.name,
          price: parseFloat(item.price),
          description: item.description
        });
      }
      
      let menuText = '📋 **Available Menu:**\n\n';
      for (const [menuName, menuItems] of Object.entries(itemsByMenu)) {
        menuText += `**${menuName}:**\n`;
        for (const item of menuItems) {
          menuText += `  • ${item.name} - $${item.price.toFixed(2)}`;
          if (item.description) {
            menuText += `\n    ${item.description}`;
          }
          menuText += '\n';
        }
        menuText += '\n';
      }
      
      const result = {
        success: true,
        message: menuText,
        items: items
      };
      
      // Cache for 5 minutes (menu items don't change often)
      cache.set(cacheKey, result, 5 * 60 * 1000);
      
      return result;
    }
    
    case 'send_service_image': {
      const { itemName } = args;
      
      // Find the item
      const items = await queryMySQL(
        `SELECT * FROM items 
         WHERE business_id = ? AND availability = 'available' AND deleted_at IS NULL
         AND (LOWER(name) LIKE ? OR LOWER(name) LIKE ? OR LOWER(name) = ?)
         ORDER BY CASE WHEN LOWER(name) = ? THEN 1 WHEN LOWER(name) LIKE ? THEN 2 ELSE 3 END
         LIMIT 1`,
        [
          business.id,
          `%${itemName.toLowerCase()}%`,
          `${itemName.toLowerCase().split(' ')[0]}%`,
          itemName.toLowerCase(),
          itemName.toLowerCase(),
          `${itemName.toLowerCase()}%`
        ]
      );
      
      if (items.length === 0) {
        return {
          success: false,
          error: `Item "${itemName}" not found. Please check the menu for available items.`,
          imageUrl: null
        };
      }
      
      const item = items[0];
      
      if (!item.item_image_url) {
        return {
          success: false,
          error: `Sorry, there's no image available for "${item.name}" at the moment.`,
          imageUrl: null
        };
      }
      
      // Return the image URL - the chatbot will send it
      return {
        success: true,
        message: `Here's the image for ${item.name}:`,
        imageUrl: item.item_image_url,
        itemName: item.name,
        shouldSendImage: true
      };
    }
    
    case 'send_menu_pdf': {
      const { menuName } = args;
      
      // Find menus with PDFs first
      let menus;
      if (menuName) {
        menus = await queryMySQL(
          `SELECT * FROM menus 
           WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
           AND menu_pdf_url IS NOT NULL
           AND (LOWER(name) LIKE ? OR LOWER(name) = ?)
           ORDER BY CASE WHEN LOWER(name) = ? THEN 1 ELSE 2 END
           LIMIT 1`,
          [
            business.id,
            `%${menuName.toLowerCase()}%`,
            menuName.toLowerCase(),
            menuName.toLowerCase()
          ]
        );
      } else {
        // Get first menu with PDF
        menus = await queryMySQL(
          `SELECT * FROM menus 
           WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
           AND menu_pdf_url IS NOT NULL
           ORDER BY name
           LIMIT 1`,
          [business.id]
        );
      }
      
      // If no PDF found, fall back to images if available (check ALL menus, not just one)
      if (menus.length === 0) {
        // Get ALL active menus with images (like get_menu_items does)
        const allMenusWithImages = await queryMySQL(
          `SELECT * FROM menus 
           WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
           AND menu_image_urls IS NOT NULL
           ORDER BY name`,
          [business.id]
        );
        
        // Collect all images from all menus
        const allImageUrls = [];
        const menusWithImages = [];
        
        for (const menu of allMenusWithImages) {
          try {
            const menuImageUrls = typeof menu.menu_image_urls === 'string' 
              ? JSON.parse(menu.menu_image_urls) 
              : menu.menu_image_urls;
            if (Array.isArray(menuImageUrls) && menuImageUrls.length > 0) {
              menusWithImages.push({ menu, imageUrls: menuImageUrls });
              for (const imageUrl of menuImageUrls) {
                allImageUrls.push({
                  url: imageUrl,
                  menuName: menu.name
                });
              }
            }
          } catch (e) {
            logger.warn('Failed to parse menu_image_urls', { menuId: menu.id, error: e.message });
          }
        }
        
        // If we found images, return them (similar to get_menu_items)
        // Limit to first 2 images only
        if (allImageUrls.length > 0) {
          const limitedImageUrls = allImageUrls.slice(0, 2);
          
          let message = '📋 Here are our menus:';
          if (menusWithImages.length > 1) {
            message += '\n\n';
            for (const { menu, imageUrls } of menusWithImages) {
              message += `**${menu.name}** (${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''})\n`;
            }
          }
          
          return {
            success: true,
            message: message,
            imageUrls: limitedImageUrls.map(img => img.url),
            imageUrlsWithMenu: limitedImageUrls, // Include full objects with menu names
            shouldSendImages: true,
            items: []
          };
        }
        
        // No PDF or images available
        return {
          success: false,
          error: menuName 
            ? `Sorry, there's no PDF available for menu "${menuName}" at the moment.`
            : `Sorry, there's no menu PDF available at the moment.`,
          pdfUrl: null
        };
      }
      
      const menu = menus[0];
      
      // Return the PDF URL - the chatbot will send it
      return {
        success: true,
        message: `Here's the PDF menu for ${menu.name}:`,
        pdfUrl: menu.menu_pdf_url,
        menuName: menu.name,
        shouldSendPdf: true
      };
    }
    
    case 'send_menu_images': {
      const { menuName } = args;
      
      // Find menus with images
      let menus;
      if (menuName) {
        menus = await queryMySQL(
          `SELECT * FROM menus 
           WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
           AND menu_image_urls IS NOT NULL
           AND (LOWER(name) LIKE ? OR LOWER(name) = ?)
           ORDER BY CASE WHEN LOWER(name) = ? THEN 1 ELSE 2 END
           LIMIT 1`,
          [
            business.id,
            `%${menuName.toLowerCase()}%`,
            menuName.toLowerCase(),
            menuName.toLowerCase()
          ]
        );
      } else {
        // Get first menu with images
        menus = await queryMySQL(
          `SELECT * FROM menus 
           WHERE business_id = ? AND is_active = true AND deleted_at IS NULL
           AND menu_image_urls IS NOT NULL
           ORDER BY name
           LIMIT 1`,
          [business.id]
        );
      }
      
      if (menus.length === 0) {
        return {
          success: false,
          error: menuName 
            ? `Sorry, there are no images available for menu "${menuName}" at the moment.`
            : `Sorry, there are no menu images available at the moment.`,
          imageUrls: []
        };
      }
      
      const menu = menus[0];
      
      // Parse menu_image_urls (stored as JSON string)
      let menuImageUrls = [];
      if (menu.menu_image_urls) {
        try {
          menuImageUrls = typeof menu.menu_image_urls === 'string' 
            ? JSON.parse(menu.menu_image_urls) 
            : menu.menu_image_urls;
          if (!Array.isArray(menuImageUrls)) {
            menuImageUrls = [];
          }
        } catch (e) {
          logger.warn('Failed to parse menu_image_urls', { menuId: menu.id, error: e.message });
          menuImageUrls = [];
        }
      }
      
      if (menuImageUrls.length === 0) {
        return {
          success: false,
          error: menuName 
            ? `Sorry, there are no images available for menu "${menu.name}" at the moment.`
            : `Sorry, there are no menu images available at the moment.`,
          imageUrls: []
        };
      }
      
      // Return the image URLs - the chatbot will send them
      return {
        success: true,
        message: `Here are the menu images for ${menu.name}:`,
        imageUrls: menuImageUrls,
        menuName: menu.name,
        shouldSendImages: true
      };
    }
    
    default:
      return null; // Not handled by this module
  }
}

module.exports = {
  getMenuFunctionDefinitions,
  executeMenuFunction
};
