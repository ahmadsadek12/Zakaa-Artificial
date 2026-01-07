# Database Schema Summary

## Answer to Your Question

### **Cart Table?** 
**NO** - Carts are stored in **MongoDB** (as a collection), not MySQL. This is intentional because:
- Carts are temporary/session-based data
- They're created when a customer starts chatting via WhatsApp
- They're deleted when the order is placed or abandoned
- MongoDB is better for this type of temporary, flexible data

**Location:** `MongoDB` → `carts` collection

---

### **Order Table?**
**YES** - There's an `orders` table in MySQL.

**Location:** `MySQL` → `orders` table

---

## Complete Database Structure

### MySQL Tables (Active/Transactional Data)

1. **`users`** - Business users, admins (multi-role table)
   - Contains business profiles, subscription info, WhatsApp credentials

2. **`locations`** - Reusable location data
   - City, street, building, floor, notes
   - Used by both businesses and branches

3. **`branches`** - Business branches
   - Branch name, address, location, WhatsApp info

4. **`menus`** - Menu definitions
   - Name, description, image, active status

5. **`branch_menus`** - Branch-Menu relationships (Many-to-Many)
   - Links branches to menus

6. **`items`** - Menu items/products
   - Name, description, price, image, availability
   - Can belong to a menu and/or branch

7. **`orders`** - Active orders (≤24-48 hours old)
   - Customer info, business, branch, status
   - Subtotal, delivery price, total
   - Payment method/status
   - Delivery type, scheduled time
   - **This is where orders are stored**

8. **`order_items`** - Order line items with price snapshots
   - Links orders to items
   - Stores quantity, price at time of order, name at time

9. **`order_status_history`** - Order status change tracking
   - Tracks when order status changes (pending → accepted → preparing → ready → completed)

10. **`opening_hours`** - Business/Branch opening hours
    - Day of week, open time, close time, closed status

11. **`policies`** - Business/Branch policies
    - Delivery, refund, cancellation, custom policies

12. **`item_ingredients`** - Optional item ingredients
    - Normalization table for item ingredients

---

### MongoDB Collections (Logs/History)

1. **`carts`** - Active shopping carts
   - Created when customer starts chatting
   - Contains items, quantities, totals, delivery info
   - Deleted when order is placed or abandoned
   - **This is where carts are stored** (NOT MySQL)

2. **`order_logs`** - Archived orders (after 24 hours)
   - Full order snapshots with items and status timeline
   - Used for analytics and history

3. **`message_logs`** - WhatsApp conversation history
   - All inbound and outbound messages
   - Used for conversation context and analytics

4. **`audit_logs`** - Dashboard action logs (optional)
   - Business user actions in dashboard

---

## Order Flow

### 1. **Cart Creation (MongoDB)**
```
Customer messages WhatsApp
  → Cart created in MongoDB `carts` collection
  → Cart stores items as customer adds them
```

### 2. **Order Creation (MySQL)**
```
Customer confirms order
  → Order created in MySQL `orders` table
  → Order items created in `order_items` table
  → Status history entry created in `order_status_history`
  → Cart deleted from MongoDB
```

### 3. **Order Completion (MySQL → MongoDB)**
```
Order completed (status = 'completed')
  → After 24 hours: Archive job runs
  → Order moved to MongoDB `order_logs` collection
  → Order deleted from MySQL `orders` table
  → Used for analytics
```

---

## Why Cart is in MongoDB, Not MySQL

1. **Temporary Data**: Carts are session-based, not permanent
2. **Flexible Schema**: MongoDB allows dynamic fields (easier for conversational ordering)
3. **Performance**: Faster to create/update/delete temporary data in MongoDB
4. **No Transactions Needed**: Cart operations don't need SQL transactions
5. **Order is Permanent**: Once order is created, it goes to MySQL (permanent, transactional)

---

## Summary Table

| Data Type | Storage | Table/Collection | Purpose |
|-----------|---------|------------------|---------|
| **Cart** | MongoDB | `carts` | Temporary shopping cart (during conversation) |
| **Order** | MySQL | `orders` | Active orders (≤24 hours) |
| **Order Items** | MySQL | `order_items` | Items in each order |
| **Order History** | MongoDB | `order_logs` | Archived orders (after 24 hours) |
| **Conversations** | MongoDB | `message_logs` | WhatsApp chat history |

---

## Quick Answer

**Cart:** NO SQL table → Stored in MongoDB `carts` collection

**Order:** YES SQL table → Stored in MySQL `orders` table

This is the correct architecture for your WhatsApp ordering system!
