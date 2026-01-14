# Monthly Cost Estimate for Chatbot Service

## Your Usage
- **Orders per day**: 100
- **Messages per order**: ~10
- **Total messages per day**: 1,000
- **Total messages per month**: 30,000

---

## Token Usage Breakdown (per message)

### Input Tokens (what you send to OpenAI)
1. **System prompt**: ~1,200 tokens
   - Business info, menu items, cart state, instructions
   - Menu items: ~20-30 items × 50 tokens each = ~1,000 tokens
   - Instructions + context: ~200 tokens

2. **Conversation history**: ~100-300 tokens
   - Last 5-10 messages in context

3. **Current user message**: ~20-50 tokens
   - Average customer message length

4. **Function call overhead**: ~50-100 tokens
   - Function definitions + results

**Total Input per message**: ~1,400-1,650 tokens

### Output Tokens (AI response)
- **Text response**: ~80-150 tokens average
- **Function calls**: ~30-50 tokens per function call
- Average 1-2 function calls per message = ~40-100 tokens

**Total Output per message**: ~120-250 tokens

### Average per message:
- **Input**: ~1,500 tokens
- **Output**: ~180 tokens
- **Total**: ~1,680 tokens per message

---

## Pricing (gpt-4o-mini - Current as of 2024/2025)
- **Input**: $0.15 per 1M tokens
- **Output**: $0.60 per 1M tokens

---

## Monthly Cost Calculation

### For 30,000 messages/month:

**Input tokens:**
- 30,000 messages × 1,500 tokens = 45,000,000 tokens
- Cost: 45M × $0.15 / 1M = **$6.75/month**

**Output tokens:**
- 30,000 messages × 180 tokens = 5,400,000 tokens
- Cost: 5.4M × $0.60 / 1M = **$3.24/month**

**Total Monthly Cost: $6.75 + $3.24 = ~$10/month**

---

## Alternative Models (if you want to reduce costs)

### gpt-3.5-turbo (cheaper, less capable)
- Input: $0.50 per 1M tokens
- Output: $1.50 per 1M tokens
- **Cost**: ~$29/month
- ❌ More expensive! (don't use)

### gpt-4o (faster, better quality, slightly more expensive)
- Input: $2.50 per 1M tokens  
- Output: $10.00 per 1M tokens
- **Cost**: ~$157/month
- ⚠️ Much more expensive

### gpt-4o-mini (current - BEST VALUE)
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- **Cost**: ~$10/month ✅ RECOMMENDED

---

## Cost Optimization Tips

1. **Cache menu items** (already implemented) - Reduces prompt size
2. **Limit conversation history** - Only last 5-10 messages
3. **Use function calling efficiently** - Batch multiple items in one call
4. **Reduce max_tokens** - Your current 1000 is fine, could go to 500 for simple responses
5. **Monitor actual usage** - Use OpenAI dashboard to track real costs

---

## Cost Breakdown by Scenario

| Scenario | Messages/Month | Input Tokens | Output Tokens | Monthly Cost |
|----------|----------------|--------------|---------------|--------------|
| **Conservative** (shorter prompts) | 30,000 | 30M | 4M | **$6.90** |
| **Average** (current estimate) | 30,000 | 45M | 5.4M | **$10.00** |
| **Heavy** (long menus, lots of context) | 30,000 | 60M | 7M | **$13.20** |

---

## Growth Projections

| Orders/Day | Messages/Month | Estimated Cost |
|------------|----------------|----------------|
| 50 | 15,000 | **$5/month** |
| 100 | 30,000 | **$10/month** |
| 200 | 60,000 | **$20/month** |
| 500 | 150,000 | **$50/month** |
| 1,000 | 300,000 | **$100/month** |

---

## Summary

**For 100 orders/day (30,000 messages/month):**
- **Estimated cost: ~$10-15/month**
- **Cost per order: ~$0.003-0.005**
- **Cost per message: ~$0.0003-0.0005**

This is very affordable! The main cost driver is the system prompt (menu items, business info). You're using the most cost-effective model (gpt-4o-mini).
