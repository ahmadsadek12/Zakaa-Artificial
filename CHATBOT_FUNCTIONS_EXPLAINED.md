# Chatbot Functions Explained

This document explains what each function in `chatbotFunctions.js` does. These are the functions that OpenAI can call directly to interact with your database and manage customer orders.

---

## 📦 Cart/Order Management Functions

### 1. `add_item_to_cart`
**What it does:** Adds an item to the customer's ongoing order (cart).

**How it works:**
- Searches for the item by name (fuzzy matching - handles "pizza", "Pizza", "I want pizza")
- Checks cache first for performance
- Validates item exists and is available
- Adds item to cart with quantity (default: 1)
- Returns success message with cart update
- Special handling: If item is "schedulable only", warns customer they need to schedule it

**When OpenAI uses it:** When customer says "I want pizza", "baddi burger", "give me 2 salads"

---

### 2. `remove_item_from_cart`
**What it does:** Removes an item from the customer's ongoing order.

**How it works:**
- Finds item in cart by name (fuzzy matching)
- Removes it completely
- Updates cart totals
- Returns confirmation message

**When OpenAI uses it:** When customer says "remove pizza", "take out burger", "I don't want that"

---

### 3. `update_item_quantity`
**What it does:** Changes the quantity of an item already in the cart.

**How it works:**
- Finds item in cart
- Updates quantity (must be > 0)
- If quantity = 0, automatically calls `remove_item_from_cart` instead
- Updates cart totals

**When OpenAI uses it:** When customer says "make it 3 pizzas", "change to 2", "I want 5 of those"

---

### 4. `get_cart`
**What it does:** Retrieves the current ongoing order contents and displays a summary.

**How it works:**
- Gets cart from database
- Formats it as a readable summary (items, quantities, prices, total)
- Includes delivery type, address, notes if set
- Returns formatted text for customer

**When OpenAI uses it:** When customer asks "what's in my order?", "show me my cart", "what did I order?"

---

### 5. `clear_cart`
**What it does:** Completely empties the ongoing order - removes all items and resets everything.

**How it works:**
- Removes all items from cart
- Resets delivery type, address, scheduled time, notes
- Sets all prices to 0
- Returns confirmation message

**When OpenAI uses it:** When customer says "clear everything", "start over", "empty my cart", "cancel my order"

---

## 🚚 Delivery & Location Functions

### 6. `update_delivery_type`
**What it does:** Sets how the customer wants to receive their order (takeaway, delivery, or dine-in).

**How it works:**
- Sets `delivery_type` to: `'takeaway'`, `'delivery'`, or `'on_site'`
- If delivery is chosen, automatically sets delivery price from business settings
- Returns confirmation message

**When OpenAI uses it:** When customer chooses "takeaway", "delivery", "dine-in", "pickup"

---

### 7. `set_delivery_address`
**What it does:** Saves the customer's delivery address (text-based, Lebanese format).

**How it works:**
- Takes the COMPLETE address text exactly as customer says it
- Stores it in `location_address` field
- Automatically sets `delivery_type` to `'delivery'`
- Sets delivery price if business has one configured
- Returns confirmation

**When OpenAI uses it:** When customer provides address like "Salim Salam, Abraj Beirut, Block B2, 21, 7ad LIU"

**Important:** This function captures the FULL address text - doesn't parse or clean it, just saves exactly what customer said.

---

### 8. `set_location`
**What it does:** Saves GPS coordinates when customer shares their location via WhatsApp/Telegram.

**How it works:**
- Takes latitude/longitude coordinates
- Validates coordinates are valid
- Checks if location is within delivery radius (if business has one set)
- Stores GPS coordinates + optional name/address text
- Returns confirmation with distance info

**When OpenAI uses it:** When customer shares location via WhatsApp/Telegram location button

**Special:** Rejects location if outside delivery radius (shows error message)

---

## ⏰ Scheduling Functions

### 9. `set_scheduled_time`
**What it does:** Schedules the order for a future date/time.

**How it works:**
- Parses natural language time: "tomorrow 7pm", "Friday evening", "in 2 hours"
- Validates the time is within opening hours
- Checks minimum schedule hours (if item requires advance booking)
- Validates item availability windows (available_from/available_to)
- Checks quantity limits (for rental items - prevents double-booking)
- Stores scheduled time in cart
- Returns formatted date/time confirmation

**When OpenAI uses it:** When customer says "tomorrow at 7", "schedule for Friday", "I want it in 3 hours"

**Complex validation:**
- Checks if business is open on that day
- Validates time is within opening hours
- For schedulable items: checks minimum advance booking time
- For rental items: checks if time slot is already booked
- Validates item-specific availability (e.g., "only available 9am-5pm")

---

### 10. `cancel_scheduled_order`
**What it does:** Cancels a scheduled order (only if more than 2 hours away).

**How it works:**
- Lists customer's scheduled orders if no orderId provided
- If orderId provided, finds and cancels that order
- Validates order is more than 2 hours in the future (can't cancel last-minute)
- Updates order status to 'rejected'
- Adds status history entry
- Returns confirmation

**When OpenAI uses it:** When customer says "cancel my scheduled order", "I don't want that order anymore"

**Restrictions:** Can only cancel orders scheduled more than 2 hours in the future

---

## 📋 Menu & Item Functions

### 11. `get_menu_items`
**What it does:** Gets the menu - prioritizes images/PDFs, falls back to text menu.

**How it works:**
- **Priority 1:** Checks for menu images → sends first 2 images
- **Priority 2:** Checks for menu PDF → sends PDF
- **Priority 3:** Checks for menu links → sends links in text
- **Priority 4:** Falls back to text-based menu (lists all items with prices)
- Caches text menu for 5 minutes (not images/PDFs - always fresh)

**When OpenAI uses it:** When customer asks "show menu", "what do you have?", "menu please", "what's available?"

**Returns:** Different formats based on what's available (images, PDF, links, or text)

---

### 12. `send_item_image`
**What it does:** Sends a picture of a specific item.

**How it works:**
- Finds item by name (fuzzy matching)
- Checks if item has an image URL
- Returns image URL for chatbot to send
- Returns error if item not found or no image available

**When OpenAI uses it:** When customer asks "show me pizza", "what does burger look like?", "picture of salad"

---

### 13. `send_menu_pdf`
**What it does:** Sends menu as PDF file (only when customer specifically asks for PDF).

**How it works:**
- Finds menu with PDF URL
- If no PDF, falls back to menu images
- Returns PDF URL for chatbot to send
- Returns error if no PDF/images available

**When OpenAI uses it:** ONLY when customer says "PDF", "download as PDF", "menu PDF file" - NOT for general "send menu" requests

**Important:** This is separate from `get_menu_items` - only used when customer explicitly wants PDF format

---

### 14. `send_menu_image`
**What it does:** Sends menu images (when customer wants visual menu).

**How it works:**
- Finds menu with images
- Parses `menu_image_urls` (JSON array)
- Returns all image URLs for chatbot to send
- Returns error if no images available

**When OpenAI uses it:** When customer asks "can I see the menu?", "menu images", "show me menu pictures"

---

## 🏢 Business Info Functions

### 15. `get_opening_hours`
**What it does:** Gets all opening hours for the week.

**How it works:**
- Fetches opening hours from database (business or branch level)
- Formats as readable text: "Monday: 9:00 - 22:00"
- Shows "Closed" for closed days
- Includes "last order" time if configured
- Returns formatted hours text

**When OpenAI uses it:** When customer asks "what are your hours?", "when are you open?", "opening hours"

---

### 16. `get_closing_time`
**What it does:** Checks if business is currently open/closed and shows closing time.

**How it works:**
- Gets current day of week in business timezone
- Checks opening hours for today
- Returns current status (open/closed) and closing time
- Includes "last order" time if configured
- Returns error if closed today

**When OpenAI uses it:** When customer asks "are you open?", "when do you close?", "are you closed?"

**Important:** This is the PRIMARY function for checking open/closed status - always queries database, never uses conversation history

---

### 17. `get_next_opening_time`
**What it does:** Shows when the business will open next (if currently closed).

**How it works:**
- Gets current day/time in business timezone
- Checks if business opens later today
- If not, finds next day when business is open
- Returns formatted message: "We open tomorrow (Monday) at 9:00"

**When OpenAI uses it:** When customer asks "when do you open next?", "when are you open next?", "next opening time"

---

## 📝 Order Notes Function

### 18. `set_order_notes`
**What it does:** Saves special instructions for the order (e.g., "no tomato", "extra spicy").

**How it works:**
- Takes customer's notes text
- Stores in `notes` field with format: `__cart__\nNOTES: {customer notes}`
- Preserves cart marker (`__cart__`) so system knows it's still a cart
- Returns confirmation message

**When OpenAI uses it:** When customer says "no tomato", "extra spicy", "no garlic", "make it mild", "without onions"

**Important:** This is called IMMEDIATELY when customer mentions ANY special instructions - don't wait!

---

## ✅ Order Confirmation Function

### 19. `confirm_order`
**What it does:** Validates and confirms the order (creates actual order in database).

**How it works:**
- **Validates cart has items**
- **Validates delivery type is set**
- **Validates address if delivery**
- **Checks if business is currently open** (queries database)
- **Validates schedulable items:**
  - If business is closed AND cart has schedulable items without scheduled time → requires scheduling
  - If business is open → allows immediate orders even for schedulable items
- **Validates scheduled time** (if order is scheduled):
  - Checks business is open on that day
  - Validates time is within opening hours
- **Blocks immediate orders when closed:**
  - If no scheduled time AND business is closed → BLOCKS order
- Returns `readyToConfirm: true` if all validations pass
- Main handler then creates the actual order

**When OpenAI uses it:** ONLY when customer explicitly says "CONFIRM" or "confirm" - NEVER automatically!

**Critical validations:**
1. Cart must have items
2. Delivery type must be set
3. Address required if delivery
4. Business must be open (or order must be scheduled)
5. Schedulable items must have scheduled time if business is closed

---

## 🔧 Technical Details

### Function Execution Flow
1. OpenAI decides which function(s) to call based on customer message
2. `executeFunction()` is called with function name and arguments
3. Function queries database, updates cart, or retrieves info
4. Function returns `{ success, message, cart?, ... }`
5. Result is sent back to OpenAI as function result
6. OpenAI generates final text response using function results

### Error Handling
- All functions return `{ success: false, error: 'message' }` on failure
- Errors are logged for debugging
- Customer-friendly error messages are returned

### Caching
- Menu items are cached for 5 minutes (reduces database queries)
- Cache is invalidated when cart changes (items might be out of stock)
- Images/PDFs are NOT cached (always fresh)

### Database Updates
- Cart operations update the `orders` table (status = 'cart')
- Order confirmation creates final order (status = 'accepted')
- All updates are transactional (rollback on error)

---

## Summary by Category

| Category | Functions | Purpose |
|----------|-----------|---------|
| **Cart Management** | `add_item_to_cart`, `remove_item_from_cart`, `update_item_quantity`, `get_cart`, `clear_cart` | Manage items in ongoing order |
| **Delivery** | `update_delivery_type`, `set_delivery_address`, `set_location` | Set delivery method and address |
| **Scheduling** | `set_scheduled_time`, `cancel_scheduled_order` | Schedule orders for future times |
| **Menu** | `get_menu_items`, `send_item_image`, `send_menu_pdf`, `send_menu_image` | Show menu and item images |
| **Business Info** | `get_opening_hours`, `get_closing_time`, `get_next_opening_time` | Show hours and status |
| **Order** | `set_order_notes`, `confirm_order` | Add notes and confirm order |

---

## Most Complex Functions

1. **`set_scheduled_time`** - Handles natural language parsing, timezone conversion, opening hours validation, item availability checks, and quantity/booking conflict detection
2. **`confirm_order`** - Validates entire order, checks business status, handles schedulable items, validates scheduled times
3. **`get_menu_items`** - Multi-priority system (images → PDF → links → text), caching logic

---

## Notes for Developers

- All functions use `cartManager` for cart operations (abstraction layer)
- Functions return updated `cart` object so OpenAI knows current state
- All database queries use parameterized queries (SQL injection protection)
- Functions are async and return promises
- Error messages are customer-friendly (not technical)
- Logging is extensive for debugging
