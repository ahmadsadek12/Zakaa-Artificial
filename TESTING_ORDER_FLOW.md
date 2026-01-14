# Order Flow Testing Checklist

## Prerequisites
- Server running (`npm start`)
- MongoDB running (for conversation history)
- Ngrok running (for Telegram testing)
- Test business configured in database

## 1. Language Selection Flow
- [ ] Send first message to bot
- [ ] Verify welcome message with 4 language options appears
- [ ] Reply with "3" (Lebanese)
- [ ] Verify confirmation in Lebanese: "Ktir mnih! Ra7 se3dak bil lebneniye. Kifak, shu baddak?"
- [ ] Verify language persists in subsequent messages

## 2. Menu and Item Selection
- [ ] Ask "show me the menu" or "shu 3andak?"
- [ ] Verify bot calls `get_menu_items()` and displays items
- [ ] Request items: "baddi burger w fries"
- [ ] Verify bot calls `add_item_to_cart()` for each item
- [ ] Verify cart summary is shown

## 3. Delivery Type Selection
- [ ] Bot should ask for delivery type (delivery/takeaway/on-site)
- [ ] Select "delivery"
- [ ] Verify bot calls `update_delivery_type()`
- [ ] Verify bot prompts for address

## 4. Address Capture (Lebanese Format)
- [ ] Provide Lebanese address: "Salim Salam, Abraj Beirut, Block B2, 21, 7ad LIU"
- [ ] Verify bot calls `set_delivery_address()` with EXACT text
- [ ] Check database: `notes` field should contain "Delivery Address: Salim Salam, Abraj Beirut, Block B2, 21, 7ad LIU"
- [ ] Verify no translation or parsing of Lebanese words (7ad, 3ad, etc.)

## 5. Order Confirmation
- [ ] Bot should ask to confirm order
- [ ] Reply "yes" or "confirm"
- [ ] Verify bot calls `confirm_order()`
- [ ] Check database:
  - [ ] Cart (`notes='__cart__'`) is removed
  - [ ] Order exists with `status='pending'`
  - [ ] Order has correct `customer_phone_number`
  - [ ] Order has correct `delivery_type`
  - [ ] Order `notes` contains delivery address
  - [ ] `order_items` table has correct items with quantities
  - [ ] `order_status_history` has entry with status='pending'

## 6. Frontend Order Display
- [ ] Login to frontend (http://localhost:5173)
- [ ] Navigate to Orders page
- [ ] Verify new order appears in list
- [ ] Click on order to open detail modal
- [ ] Verify modal shows:
  - [ ] Customer phone number
  - [ ] Order status badge
  - [ ] Delivery type
  - [ ] Delivery address (if delivery)
  - [ ] List of items with quantities and prices
  - [ ] Subtotal, delivery price, total
  - [ ] Timestamps (created_at, updated_at)

## 7. Restaurant-Specific: Closed Business
- [ ] Manually set business hours to make restaurant closed (or test outside hours)
- [ ] Send message to bot
- [ ] Verify bot says "We're currently closed"
- [ ] Verify bot offers to schedule order
- [ ] Provide scheduled time: "tomorrow at 7pm"
- [ ] Verify bot calls `set_scheduled_time()`
- [ ] Verify bot parses and confirms the scheduled time
- [ ] Check database: `scheduled_for` field should have correct datetime

## 8. Scheduled Order Parsing
Test various natural language inputs:
- [ ] "tomorrow at 7pm" → Should parse to tomorrow 19:00
- [ ] "Friday 6:30" → Should parse to next Friday 18:30
- [ ] "in 2 hours" → Should parse to current time + 2 hours
- [ ] "Monday evening" → Should parse to next Monday ~18:00
- [ ] Invalid time (outside hours): "tomorrow at 3am" → Should reject with error

## 9. Cart Timeout System
- [ ] Create cart with items and delivery details
- [ ] Do NOT confirm order
- [ ] Wait 5+ minutes without sending messages
- [ ] Check logs for "Cart converted to incomplete order"
- [ ] Check database:
  - [ ] Order `status` changed from cart to 'incomplete'
  - [ ] Order `notes` contains "Customer did not respond to order confirmation"
  - [ ] `order_status_history` has entry with status='incomplete', changed_by='system_timeout'
- [ ] Verify order appears in frontend with 'incomplete' badge

## 10. Conversation History
- [ ] Send multiple messages
- [ ] Verify bot remembers context from previous messages
- [ ] Check MongoDB `message_logs` collection:
  - [ ] Inbound messages have `direction='inbound'`
  - [ ] Outbound messages have `direction='outbound'`
  - [ ] All messages have correct `business_id`, `branch_id`, `customer_phone_number`
  - [ ] Messages within last hour are retrieved

## 11. Edge Cases
- [ ] Try to confirm empty cart → Should show error
- [ ] Try to confirm cart without delivery type → Should prompt for delivery type
- [ ] Try to confirm delivery order without address → Should prompt for address
- [ ] Send gibberish for scheduled time → Should ask for clarification
- [ ] Change language mid-conversation → Should switch immediately

## Database Verification Queries

```sql
-- Check recent orders
SELECT id, customer_phone_number, status, delivery_type, notes, scheduled_for, total, created_at 
FROM orders 
WHERE customer_phone_number LIKE 'telegram:%' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check order items
SELECT o.id as order_id, o.customer_phone_number, oi.name_at_time, oi.quantity, oi.price_at_time
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.customer_phone_number LIKE 'telegram:%'
ORDER BY o.created_at DESC;

-- Check order status history
SELECT osh.order_id, osh.status, osh.changed_by, osh.changed_at, o.customer_phone_number
FROM order_status_history osh
JOIN orders o ON osh.order_id = o.id
WHERE o.customer_phone_number LIKE 'telegram:%'
ORDER BY osh.changed_at DESC;

-- Check incomplete orders
SELECT id, customer_phone_number, status, notes, updated_at
FROM orders
WHERE status = 'incomplete'
ORDER BY updated_at DESC;

-- Check message logs (MongoDB)
db.message_logs.find({
  customer_phone_number: /telegram:/
}).sort({ timestamp: -1 }).limit(20)
```

## Success Criteria
✅ All checklist items pass
✅ Orders appear correctly in database
✅ Orders display correctly in frontend
✅ Cart timeout converts to incomplete after 5 minutes
✅ Scheduled orders work for closed restaurants
✅ Lebanese addresses captured exactly as provided
✅ Conversation history persists across messages
