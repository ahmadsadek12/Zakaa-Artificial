// Test OpenAI API Key and Account Status
// Run: node scripts/test-openai-key.js

require('dotenv').config();
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

console.log('🔑 API Key:', apiKey.substring(0, 7) + '...' + apiKey.substring(apiKey.length - 4));
console.log('📊 Testing API key...\n');

const client = new OpenAI({ apiKey });

(async () => {
  try {
    // Test 1: List models (requires valid key)
    console.log('1️⃣ Testing API key validity...');
    const models = await client.models.list();
    console.log('   ✅ API key is valid');
    console.log(`   📋 Available models: ${models.data.length} models\n`);

    // Test 2: Make a simple completion request
    console.log('2️⃣ Testing API call (simple completion)...');
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "Hello" in one word.' }],
      max_tokens: 10
    });
    
    console.log('   ✅ API call successful!');
    console.log(`   💬 Response: ${completion.choices[0].message.content}`);
    console.log(`   💰 Tokens used: ${completion.usage.total_tokens}`);
    console.log(`   📊 Cost: ~$${(completion.usage.total_tokens * 0.00000015).toFixed(6)} (estimate)\n`);
    
    console.log('✅ All tests passed! Your OpenAI account is active and working.\n');
    console.log('💡 If you see quota errors, make sure:');
    console.log('   1. Payment method is added at https://platform.openai.com/account/billing');
    console.log('   2. Credits are added to your account');
    console.log('   3. Account status shows as "Active"');
    
  } catch (error) {
    console.error('\n❌ Error testing API key:\n');
    
    if (error.status === 401) {
      console.error('   🔴 Invalid API Key');
      console.error('   → Check your .env file - the API key is wrong or expired');
    } else if (error.status === 429) {
      if (error.message?.includes('quota') || error.message?.includes('insufficient')) {
        console.error('   🔴 Quota/Billing Error');
        console.error('   → Account has no credits or billing not set up');
        console.error('   → Go to: https://platform.openai.com/account/billing');
        console.error('   → Add payment method and credits');
      } else {
        console.error('   🟡 Rate Limit Error');
        console.error('   → Too many requests - wait a moment and try again');
      }
    } else if (error.message?.includes('connect') || error.message?.includes('network')) {
      console.error('   🔴 Network Error');
      console.error('   → Check your internet connection');
    } else {
      console.error('   🔴 Unknown Error');
      console.error(`   → Status: ${error.status || 'N/A'}`);
      console.error(`   → Message: ${error.message}`);
    }
    
    console.error('\n📋 Full error details:');
    console.error(error);
    
    process.exit(1);
  }
})();
