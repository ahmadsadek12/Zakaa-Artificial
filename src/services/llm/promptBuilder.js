// Prompt Builder
// Build structured prompts from database data

const { queryMySQL } = require('../../config/database');

/**
 * Build prompt with business context
 */
async function buildPrompt({ business, branch, customerPhoneNumber, message, language }) {
  // Fetch business context (menus, items, policies, hours)
  const menus = await queryMySQL(
    `SELECT m.* FROM menus m 
     JOIN branch_menus bm ON m.id = bm.menu_id 
     WHERE bm.branch_id = ? AND m.is_active = true`,
    [branch?.id || business.id]
  );
  
  const items = await queryMySQL(
    `SELECT * FROM items 
     WHERE business_id = ? AND availability = 'available' AND deleted_at IS NULL
     ORDER BY name`,
    [business.id]
  );
  
  // Build system prompt
  const systemPrompt = `You are a helpful assistant for ${business.business_name}${branch ? ` - ${branch.branch_name}` : ''}.
Your role is to help customers place orders via WhatsApp.

Business Information:
- Name: ${business.business_name}
- Type: ${business.business_type}
- Default Language: ${business.default_language || 'arabic'}

${branch ? `Branch: ${branch.branch_name}` : ''}

Available Items:
${items.map(item => `- ${item.name}: ${item.price} (${item.description || 'No description'})`).join('\n')}

Rules:
1. Only offer items that exist in the menu
2. Never invent prices or items
3. Ask clarifying questions if uncertain
4. Help customers build their order
5. Respond in ${language || business.default_language || 'arabic'} language

Current conversation language detected: ${language || 'unknown'}`;

  const userPrompt = `Customer (${customerPhoneNumber}) says: ${message}

Please respond helpfully to assist with their order.`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

module.exports = {
  buildPrompt
};
