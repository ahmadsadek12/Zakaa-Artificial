# Customer Chatbot Functions - Complete Guide

## Overview
This document lists all functions available to customers through the Zakaa AI chatbot. Customers can interact with these features naturally through conversation in English or Arabic.

---

## 📋 Menu & Items Functions

### 1. `get_menu`
**Description:** Get the complete menu with categories and items  
**When to use:** Customer asks to see the menu, browse items, or what's available  
**Example phrases:**
- "Show me the menu"
- "What do you have?"
- "Can I see what you offer?"

**Returns:** Full menu organized by categories with item names, descriptions, and prices

---

### 2. `get_menu_items_by_category`
**Description:** Get items from a specific category  
**Parameters:**
- `categoryName` (required): Name of the category

**When to use:** Customer wants to browse a specific category  
**Example phrases:**
- "Show me your desserts"
- "What pizzas do you have?"
- "I want to see the drinks menu"

**Returns:** All items in the requested category with details

---

### 3. `search_items`
**Description:** Search for items by name or keyword  
**Parameters:**
- `query` (required): Search term

**When to use:** Customer is looking for a specific item or type of item  
**Example phrases:**
- "Do you have cheesecake?"
- "I'm looking for something with chocolate"
- "Search for pasta"

**Returns:** List of matching items with details

---

### 4. `check_item_availability`
**Description:** Check if a specific item is available and get its details  
**Parameters:**
- `itemName` (required): Name of the item to check

**When to use:** Customer asks about a specific item  
**Example phrases:**
- "Do you have pepsi?"
- "Is the chicken burger available?"
- "Can I get a latte?"

**Returns:** 
- If available: Item details, price, and options to add to cart
- If not available: Suggests viewing the menu
- **Note:** Bot uses the EXACT message from this function without rephrasing

---

## 🛒 Cart Management Functions

### 5. `add_service_to_cart`
**Description:** Add an item to the customer's cart  
**Parameters:**
- `itemName` (required): Name of the item
- `quantity` (optional): Quantity (default: 1)
- `notes` (optional): Special instructions or customizations

**When to use:** Customer wants to add an item to their order  
**Example phrases:**
- "I want 2 burgers"
- "Add a large pizza to my cart"
- "I'll have the pasta, no mushrooms please"

**Business Rules:**
- Checks if business is open
- Warns if approaching closing time or last order time
- Validates item availability
- Items are directly added (no "add or replace" confirmation)

**Returns:** Updated cart with the new item

---

### 6. `remove_service_from_cart`
**Description:** Remove an item from the cart  
**Parameters:**
- `itemName` (required): Name of the item to remove

**When to use:** Customer wants to remove something they added  
**Example phrases:**
- "Remove the burger from my order"
- "Take out the fries"
- "Cancel the dessert"

**Returns:** Updated cart without the removed item

---

### 7. `update_service_quantity`
**Description:** Change the quantity of an item in the cart  
**Parameters:**
- `itemName` (required): Name of the item
- `newQuantity` (required): New quantity

**When to use:** Customer wants to adjust quantities  
**Example phrases:**
- "Make that 3 burgers instead"
- "Change the pizza quantity to 2"
- "I only need 1 drink"

**Returns:** Updated cart with new quantities

---

### 8. `clear_cart`
**Description:** Remove all items from the cart  
**When to use:** Customer wants to start over  
**Example phrases:**
- "Clear my cart"
- "Start over"
- "Remove everything"
- "Cancel my order"

**Returns:** Empty cart confirmation

---

### 9. `get_cart`
**Description:** View current cart contents  
**When to use:** Customer wants to review their order  
**Example phrases:**
- "What's in my cart?"
- "Show me my order"
- "What have I ordered so far?"

**Returns:** Detailed cart summary including:
- All items with quantities and prices
- Delivery type and address (if set)
- Scheduled time (if set)
- Order notes (if any)
- Subtotal, delivery fee, and total

---

## 🚚 Delivery & Scheduling Functions

### 10. `update_delivery_type`
**Description:** Change the delivery method  
**Parameters:**
- `deliveryType` (required): 'delivery', 'takeaway', or 'on_site'

**When to use:** Customer changes their mind about how to receive the order  
**Example phrases:**
- "I want delivery instead"
- "Change to takeaway"
- "I'll dine in"

**Business Rules:**
- If switching TO delivery: Bot asks for address
- If switching FROM delivery: Previous address is kept but delivery fee removed
- If switching TO on_site: Bot asks for date/time and table preference
- If switching TO takeaway: Bot asks for pickup date/time

**Returns:** Updated delivery type confirmation

---

### 11. `set_delivery_address`
**Description:** Set or update delivery address  
**Parameters:**
- `address` (required): Full delivery address

**When to use:** Customer provides their address (only for delivery orders)  
**Example phrases:**
- "Deliver to 123 Main Street"
- "My address is..."
- "Send it to the office at..."

**Returns:** Address confirmation with delivery fee added

---

### 12. `set_scheduled_time`
**Description:** Schedule the order for a specific date and time  
**Parameters:**
- `scheduledDate` (required): Date in YYYY-MM-DD format
- `scheduledTime` (required): Time in HH:MM format (24-hour)

**When to use:** Customer wants to schedule their order  
**Example phrases:**
- "I want it tomorrow at 7pm"
- "Schedule for January 30th at 12:30"
- "Deliver on Friday at 6pm"

**Business Rules:**
- Validates against business opening hours
- Checks closing time and last order time
- Warns if scheduling near closing

**Returns:** Scheduled time confirmation

---

### 13. `set_order_notes`
**Description:** Add special instructions or notes to the order  
**Parameters:**
- `notes` (required): Order notes or instructions

**When to use:** Customer has special requests  
**Example phrases:**
- "Extra napkins please"
- "Ring the doorbell twice"
- "Make the burger well done"

**Returns:** Notes added confirmation

---

## ✅ Order Confirmation & Management

### 14. `confirm_order`
**Description:** Finalize and submit the order  
**When to use:** Customer is ready to place their order  
**Example phrases:**
- "Confirm my order"
- "Place the order"
- "I'm ready to order"
- "Submit"

**Business Rules:**
- Validates cart is not empty
- Checks delivery type is set
- For delivery: Validates address is provided
- For on_site: Validates reservation details
- For takeaway: Validates pickup time
- Checks business is open (or scheduled for open hours)

**Returns:** Order confirmation with order number and estimated time

---

### 15. `get_my_orders`
**Description:** View all customer's orders  
**Parameters:**
- `status` (optional): Filter by status ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')

**When to use:** Customer wants to check their order history or current orders  
**Example phrases:**
- "Show me my orders"
- "What's my order status?"
- "Do I have any pending orders?"

**Returns:** List of orders with:
- Order number
- Status
- Items
- Total amount
- Date/time
- Delivery details

---

### 16. `cancel_scheduled_order`
**Description:** Cancel an order that's scheduled for later  
**Parameters:**
- `orderId` (required): The order ID to cancel

**When to use:** Customer wants to cancel a scheduled order  
**Example phrases:**
- "Cancel order #12345"
- "I want to cancel my order"
- "Remove my scheduled order"

**Business Rules:**
- Only scheduled orders can be cancelled
- Checks cancellation deadline based on:
  - Item-level `cancelable_before_hours` (if set on item)
  - Business-level `default_cancelable_before_hours` (fallback, default: 2 hours)
- Must be cancelled before the deadline

**Returns:** 
- Success: Cancellation confirmation
- Too late: Message explaining the deadline has passed

---

### 17. `cancel_accepted_order`
**Description:** Request cancellation of an accepted/preparing order  
**Parameters:**
- `orderId` (required): The order ID to cancel

**When to use:** Customer wants to cancel an order that's already being prepared  
**Example phrases:**
- "Cancel my current order"
- "I need to cancel order #12345"

**Business Rules:**
- Same cancellation rules as `cancel_scheduled_order`
- For scheduled orders: Checks hours before scheduled time
- For immediate orders: Business may need to approve

**Returns:** Cancellation request confirmation

---

## 🪑 Table Reservation Functions

### 18. `get_tables`
**Description:** View available tables  
**Parameters:**
- `reservationDate` (required): Date in YYYY-MM-DD
- `reservationTime` (required): Time in HH:MM
- `numberOfGuests` (required): Party size

**When to use:** Customer wants to see table options  
**Example phrases:**
- "Show me available tables for 4 people tomorrow at 7pm"
- "What tables do you have?"

**Returns:** List of available tables with capacity and position

---

### 19. `create_table_reservation`
**Description:** Reserve a table  
**Parameters:**
- `reservationDate` (required): Date in YYYY-MM-DD
- `reservationTime` (required): Time in HH:MM
- `numberOfGuests` (required): Party size
- `customerName` (required): Customer's name
- `tableNumber` (optional): Specific table number
- `positionPreference` (optional): 'window', 'outdoor', 'indoor', 'private'

**When to use:** Customer wants to reserve a table  
**Example phrases:**
- "Reserve a table for 5 people on January 29th at 7pm"
- "Book a window table for 2 tomorrow at 8pm"
- "I want to reserve table 3 for Friday night"

**Business Rules:**
- Only for F&B businesses with table_reservations addon enabled
- Bot MUST ask for customer name
- If tableNumber provided: Assigns that specific table
- If positionPreference provided: Finds best matching table
- Otherwise: Auto-selects best available table
- Validates table capacity vs. party size
- Checks for conflicts with existing reservations

**Returns:** 
- Confirmation with reservation number
- Table details
- Date/time
- Number of guests
- **Format:** "Your reservation #[NUMBER] is confirmed..."

**Reminder System:**
- Reminder sent on reservation date when restaurant first opens (8:00 AM default)
- Includes reservation details and table information

---

### 20. `cancel_table_reservation`
**Description:** Cancel a table reservation  
**Parameters:**
- `reservationId` (required): The reservation ID to cancel

**When to use:** Customer wants to cancel their table reservation  
**Example phrases:**
- "Cancel my reservation"
- "I need to cancel my table for tomorrow"

**Returns:** Cancellation confirmation

---

### 21. `add_item_to_reservation`
**Description:** Pre-order items for the reservation (optional)  
**Parameters:**
- `reservationId` (required): The reservation ID
- `itemName` (required): Name of item
- `quantity` (optional): Quantity (default: 1)

**When to use:** Customer wants to pre-order food/drinks for their reservation  
**Example phrases:**
- "Add 2 bottles of wine to my reservation"
- "I want to pre-order appetizers"

**Returns:** Updated reservation with items

---

### 22. `remove_item_from_reservation`
**Description:** Remove pre-ordered items from reservation  
**Parameters:**
- `reservationId` (required): The reservation ID
- `itemName` (required): Name of item to remove

**When to use:** Customer wants to remove pre-ordered items  
**Example phrases:**
- "Remove the wine from my reservation"

**Returns:** Updated reservation

---

### 23. `get_reservation_items`
**Description:** View pre-ordered items for a reservation  
**Parameters:**
- `reservationId` (required): The reservation ID

**When to use:** Customer wants to see what they've pre-ordered  
**Example phrases:**
- "What have I ordered for my reservation?"
- "Show me the items for my booking"

**Returns:** List of pre-ordered items with quantities and prices

---

## 🕐 Business Hours & Availability

### 24. Opening Hours Check (Automatic)
**Description:** Automatically checks business hours before processing orders  
**Business Rules:**
- Bot knows current business hours
- Warns if business is closed
- Notifies if approaching closing time
- Checks `last_order_before_closing` minutes setting
- Informs customer of last order time proactively

**Example Messages:**
- "We're currently closed. We open at 9:00 AM."
- "Please note: We close in 30 minutes. Last orders at 10:30 PM."
- "We stop taking orders 30 minutes before closing."

---

## 💡 Conversation Guidelines

### General Rules
1. **Natural Language:** All functions work with natural conversation - customers don't need to know function names
2. **Language Support:** Full support for English and Arabic
3. **Context Awareness:** Bot remembers conversation context and cart state
4. **Error Handling:** Clear error messages if something goes wrong
5. **Confirmation Messages:** All actions provide clear confirmation

### Cart Flow
1. Customer browses menu or searches for items
2. Bot checks availability and closing times
3. Items added directly to cart (no confirmation needed)
4. Customer can modify cart anytime
5. Set delivery type → address/time based on type
6. Add any special notes
7. Confirm order

### Table Reservation Flow
1. Customer requests table reservation
2. Bot asks for: date, time, number of guests, name
3. Bot may ask for table preference (window, outdoor, etc.)
4. Bot confirms table selection or auto-picks best option
5. Optional: Customer can pre-order items
6. Reservation confirmed with reservation number
7. Reminder sent on reservation day when restaurant opens

### Cancellation Policy
- **Item-Level:** Some items have specific cancellation deadlines (hours before scheduled time)
- **Business-Level:** Default cancellation deadline (typically 2 hours before)
- **Validation:** Bot checks which deadline applies and enforces it
- **Clear Messaging:** Bot explains if cancellation deadline has passed

---

## 🔧 Technical Notes

### Database Tables Involved
- `items` - Menu items with availability and cancellation policies
- `categories` - Menu organization
- `carts` - Customer shopping carts (MongoDB)
- `orders` - Confirmed orders with status tracking
- `order_items` - Individual items in orders
- `reservations` - Table bookings with reminder tracking
- `reservation_items` - Pre-ordered items for reservations
- `tables` - Restaurant table inventory
- `users` - Business settings and policies
- `branches` - Multi-location support
- `user_addons` & `business_addons` - Feature enablement

### Function Execution
- All functions use OpenAI function calling
- Direct database interaction for real-time data
- Comprehensive error handling and logging
- Multi-language prompt engineering
- Context-aware responses

### Security & Validation
- Customer phone number used as identifier
- Business and branch ID validation
- Addon eligibility checks for premium features
- Time zone handling for scheduling
- Inventory checks for availability

---

## 📊 Feature Availability by Business Type

| Feature | F&B | Retail | Service | Requires Addon |
|---------|-----|--------|---------|----------------|
| Menu/Items | ✅ | ✅ | ✅ | No |
| Cart Management | ✅ | ✅ | ✅ | No |
| Orders | ✅ | ✅ | ✅ | No |
| Delivery | ✅ | ✅ | ✅ | No |
| Table Reservations | ✅ | ❌ | ❌ | Yes (table_reservations) |
| Pre-order for Reservations | ✅ | ❌ | ❌ | Yes (table_reservations) |

---

## 🚀 Future Enhancements
- Payment integration
- Loyalty points tracking
- Order rating and reviews
- Real-time order tracking
- Group ordering for reservations
- Dietary preference filtering
- Multi-language menu translations

---

**Last Updated:** January 27, 2026  
**Version:** 2.0  
**System:** Zakaa Artificial - AI Business Assistant
