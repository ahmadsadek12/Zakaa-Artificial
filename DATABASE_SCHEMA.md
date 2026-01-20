# Zakaa Database Schema - Complete Documentation

## Overview

The Zakaa system uses MySQL as the primary database for all transactional and active data. The schema follows a multi-tenant architecture where businesses are completely isolated from each other.

**Database Name:** `zakaa_db`  
**Engine:** InnoDB  
**Character Set:** utf8mb4  
**Collation:** utf8mb4_0900_ai_ci (or utf8mb4_unicode_ci for some tables)

---

## Table Structure

### 1. `locations` Table

Shared location data used by both users and branches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `city` | VARCHAR(100) | NOT NULL | City name |
| `street` | VARCHAR(255) | NOT NULL | Street address |
| `building` | VARCHAR(100) | NULL | Building name/number |
| `floor` | VARCHAR(50) | NULL | Floor number |
| `notes` | TEXT | NULL | Additional location notes |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_city` on `city`

**Relationships:**
- Referenced by: `users.location_id`, `orders.delivery_address_location_id`

---

### 2. `users` Table

Multi-role table storing admins, businesses, branches, and customers. Uses single-table inheritance pattern.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `user_type` | ENUM('admin', 'business', 'branch', 'customer') | NOT NULL | Type of user |
| `user_role` | ENUM('business', 'branch') | NULL | Role (for business/branch types) |
| `parent_user_id` | CHAR(36) | NULL, FK → users.id | Parent business ID (for branches) |
| `email` | VARCHAR(255) | UNIQUE | Email address |
| `contact_phone_number` | VARCHAR(20) | NULL | Contact phone number |
| `password_hash` | VARCHAR(255) | NULL | Bcrypt hashed password |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update timestamp |

**Business/Branch-only fields (nullable):**
| Column | Type | Description |
|--------|------|-------------|
| `business_name` | VARCHAR(255) | Business name |
| `business_type` | ENUM('food and beverage', 'entertainment', 'sports', 'salons', 'clinics', 'rentals', 'other') | Type of business |
| `business_description` | TEXT | Business description |
| `whatsapp_phone_number` | VARCHAR(20) | WhatsApp phone number |
| `whatsapp_phone_number_id` | VARCHAR(255) | WhatsApp Business API phone number ID |
| `whatsapp_access_token_encrypted` | TEXT | Encrypted WhatsApp access token |
| `default_language` | ENUM('arabic', 'arabizi', 'english', 'french') | DEFAULT 'arabic' | Default chatbot language |
| `timezone` | VARCHAR(50) | DEFAULT 'Asia/Beirut' | Business timezone |
| `allow_scheduled_orders` | BOOLEAN | DEFAULT true | Allow scheduled orders |
| `allow_delivery` | BOOLEAN | DEFAULT true | Allow delivery orders |
| `allow_takeaway` | BOOLEAN | DEFAULT true | Allow takeaway orders |
| `allow_on_site` | BOOLEAN | DEFAULT true | Allow on-site orders |
| `chatbot_enabled` | BOOLEAN | DEFAULT true | Enable AI chatbot |
| `last_order_before_closing_minutes` | INT | NULL | Minutes before closing when last order is accepted |

**Customer-only fields (nullable):**
| Column | Type | Description |
|--------|------|-------------|
| `first_name` | VARCHAR(100) | Customer first name |
| `last_name` | VARCHAR(100) | Customer last name |

**Subscription fields (for businesses):**
| Column | Type | Description |
|--------|------|-------------|
| `subscription_type` | ENUM('standard', 'premium') | DEFAULT 'standard' | Subscription tier |
| `subscription_price` | DECIMAL(10,2) | DEFAULT 0 | Subscription price |
| `subscription_status` | ENUM('active', 'past_due', 'canceled') | DEFAULT 'active' | Subscription status |
| `subscription_started_at` | TIMESTAMP | NULL | Subscription start date |
| `subscription_ends_at` | TIMESTAMP | NULL | Subscription end date |

**Location fields:**
| Column | Type | Description |
|--------|------|-------------|
| `location_id` | CHAR(36) | NULL, FK → locations.id | Reference to locations table |
| `location_latitude` | DECIMAL(10,8) | NULL | GPS latitude |
| `location_longitude` | DECIMAL(11,8) | NULL | GPS longitude |
| `delivery_radius_km` | DECIMAL(6,2) | DEFAULT 10.00 | Delivery radius in kilometers |
| `delivery_price` | DECIMAL(10,2) | DEFAULT 0.00 | Default delivery price |

**Indexes:**
- `idx_user_type` on `user_type`
- `idx_user_role` on `user_role`
- `idx_parent_user_id` on `parent_user_id`
- `idx_email` on `email`
- `idx_is_active` on `is_active`
- `idx_subscription_type` on `subscription_type`
- `idx_location_id` on `location_id`

**Foreign Keys:**
- `location_id` → `locations(id)` ON DELETE SET NULL
- `parent_user_id` → `users(id)` ON DELETE CASCADE

**Notes:**
- Branches are stored in this table with `user_type='branch'` and `parent_user_id` pointing to the business
- The old `branches` table has been removed and merged into this table

---

### 3. `items` Table

Menu items/products that belong to a business (and optionally a specific branch).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `business_id` | CHAR(36) | NOT NULL, FK → users.id | Business owner |
| `user_id` | CHAR(36) | NULL, FK → users.id | Branch-specific item (if not NULL) |
| `branch_id` | CHAR(36) | NULL, FK → branches.id | **Deprecated** - kept for backward compatibility |
| `menu_id` | CHAR(36) | NULL, FK → menus.id | Menu this item belongs to |
| `name` | VARCHAR(255) | NOT NULL | Item name |
| `description` | TEXT | NULL | Item description |
| `ingredients` | TEXT | NULL | Ingredients list |
| `price` | DECIMAL(10,2) | NOT NULL | Item price |
| `cost` | DECIMAL(10,2) | NULL | Item cost (for profit calculation) |
| `preparation_time_minutes` | INT | NULL | Preparation time (for F&B) |
| `duration_minutes` | INT | NULL | Duration (for entertainment/sports/rentals) |
| `quantity` | INT | NULL | Available quantity (NULL = unlimited, 1 = single, >1 = multiple) |
| `is_reusable` | BOOLEAN | DEFAULT true | Reusable item (e.g., football field) vs consumable |
| `is_rental` | BOOLEAN | DEFAULT false | Requires time slot booking |
| `track_quantity` | BOOLEAN | DEFAULT false | Enforce quantity limits |
| `is_schedulable` | BOOLEAN | DEFAULT false | Can only be scheduled (not immediate orders) |
| `min_schedule_hours` | INT | NULL | Minimum hours in advance for scheduling |
| `available_from` | TIME | NULL | Available from time (e.g., "09:00:00") |
| `available_to` | TIME | NULL | Available to time (e.g., "22:00:00") |
| `days_available` | JSON | NULL | Array of days: ["monday", "wednesday", "friday"] |
| `availability` | ENUM('available', 'out_of_stock', 'hidden') | DEFAULT 'available' | Availability status |
| `item_image_url` | TEXT | NULL | S3 URL for item image |
| `times_ordered` | INT | DEFAULT 0 | Order count (analytics) |
| `times_delivered` | INT | DEFAULT 0 | Delivery count (analytics) |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_business_id` on `business_id`
- `idx_user_id` on `user_id`
- `idx_branch_id` on `branch_id` (deprecated)
- `idx_menu_id` on `menu_id`
- `idx_availability` on `availability`

**Foreign Keys:**
- `business_id` → `users(id)` ON DELETE CASCADE
- `user_id` → `users(id)` ON DELETE CASCADE
- `branch_id` → `branches(id)` ON DELETE SET NULL (deprecated)
- `menu_id` → `menus(id)` ON DELETE SET NULL

---

### 4. `item_ingredients` Table

Optional normalization table for item ingredients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `item_id` | CHAR(36) | NOT NULL, FK → items.id | Item reference |
| `ingredient_name` | VARCHAR(255) | NOT NULL | Ingredient name |

**Indexes:**
- `idx_item_id` on `item_id`

**Foreign Keys:**
- `item_id` → `items(id)` ON DELETE CASCADE

---

### 5. `item_duration_tiers` Table

Time-based pricing tiers for rental items (e.g., 1 hour = $10, 2 hours = $18).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `item_id` | CHAR(36) | NOT NULL, FK → items.id | Item reference |
| `duration_minutes` | INT | NOT NULL | Duration in minutes |
| `price` | DECIMAL(10,2) | NOT NULL | Price for this duration |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_item_id` on `item_id`
- `idx_duration` on `duration_minutes`

**Foreign Keys:**
- `item_id` → `items(id)` ON DELETE CASCADE

---

### 6. `orders` Table

Transactional orders table. Carts are stored here with `status='cart'` and `notes='__cart__'`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `customer_id` | CHAR(36) | NULL, FK → users.id | Customer user ID (if registered) |
| `business_id` | CHAR(36) | NOT NULL, FK → users.id | Business owner |
| `user_id` | CHAR(36) | NOT NULL, FK → users.id | Branch user or business user |
| `branch_id` | CHAR(36) | NULL, FK → branches.id | **Deprecated** - kept for backward compatibility |
| `customer_phone_number` | VARCHAR(20) | NOT NULL | Customer phone number (primary identifier) |
| `whatsapp_user_id` | VARCHAR(255) | NULL | WhatsApp user ID |
| `language_used` | ENUM('arabic','arabizi','english','french') | NULL | Language used in conversation |
| `order_source` | ENUM('whatsapp', 'telegram', 'manual', 'dashboard') | DEFAULT 'whatsapp' | Order source |
| `customer_name` | VARCHAR(255) | NULL | Customer name |
| `status` | ENUM('cart', 'accepted', 'delivering', 'completed', 'rejected') | DEFAULT 'accepted' | Order status |
| `subtotal` | DECIMAL(10,2) | NOT NULL | Subtotal (items only) |
| `delivery_price` | DECIMAL(10,2) | DEFAULT 0 | Delivery fee |
| `total` | DECIMAL(10,2) | NOT NULL | Total amount |
| `delivery_type` | ENUM('takeaway', 'delivery', 'on_site') | NOT NULL | Delivery type |
| `notes` | TEXT | NULL | Order notes (cart marker: '__cart__' or '__cart__\nNOTES: ...') |
| `scheduled_for` | TIMESTAMP | NULL | Scheduled delivery/pickup time |
| `payment_method` | ENUM('cash','card','wallet','unknown') | DEFAULT 'unknown' | Payment method |
| `payment_status` | ENUM('unpaid','paid','refunded') | DEFAULT 'unpaid' | Payment status |
| `delivery_address_location_id` | CHAR(36) | NULL, FK → locations.id | Delivery address reference |
| `location_address` | TEXT | NULL | Delivery address text (for WhatsApp orders) |
| `location_latitude` | DECIMAL(10,8) | NULL | GPS latitude |
| `location_longitude` | DECIMAL(11,8) | NULL | GPS longitude |
| `location_name` | VARCHAR(255) | NULL | Location name (e.g., "Home", "Office") |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update timestamp |
| `completed_at` | TIMESTAMP | NULL | Completion timestamp |
| `cancelled_at` | TIMESTAMP | NULL | Cancellation timestamp |

**Indexes:**
- `idx_customer_id` on `customer_id`
- `idx_business_id` on `business_id`
- `idx_user_id` on `user_id`
- `idx_branch_id` on `branch_id` (deprecated)
- `idx_customer_phone_number` on `customer_phone_number`
- `idx_status` on `status`
- `idx_created_at` on `created_at`
- `idx_completed_at` on `completed_at`
- `idx_customer_created` on `(customer_phone_number, created_at)` (composite)

**Foreign Keys:**
- `customer_id` → `users(id)` ON DELETE RESTRICT
- `business_id` → `users(id)` ON DELETE RESTRICT
- `user_id` → `users(id)` ON DELETE RESTRICT
- `branch_id` → `branches(id)` ON DELETE RESTRICT (deprecated)
- `delivery_address_location_id` → `locations(id)` ON DELETE SET NULL

**Notes:**
- Carts are orders with `status='cart'` and `notes='__cart__'`
- Customer notes are stored as `'__cart__\nNOTES: {notes}'` to preserve cart marker
- Orders are archived to MongoDB after 24-48 hours

---

### 7. `order_items` Table

Line items for orders with price snapshots (preserves historical prices).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `order_id` | CHAR(36) | NOT NULL, FK → orders.id | Order reference |
| `item_id` | CHAR(36) | NOT NULL, FK → items.id | Item reference |
| `quantity` | INT | NOT NULL, DEFAULT 1 | Quantity ordered |
| `price_at_time` | DECIMAL(10,2) | NOT NULL | Price at time of order (snapshot) |
| `name_at_time` | VARCHAR(255) | NOT NULL | Item name at time of order (snapshot) |
| `notes` | TEXT | NULL | Item-specific notes |
| `booking_date` | DATE | NULL | Rental booking date |
| `booking_start_time` | TIME | NULL | Rental start time |
| `booking_end_time` | TIME | NULL | Rental end time (calculated) |
| `duration_tier_id` | CHAR(36) | NULL, FK → item_duration_tiers.id | Duration tier used |

**Indexes:**
- `idx_order_id` on `order_id`
- `idx_item_id` on `item_id`
- `idx_booking_date` on `booking_date`
- `idx_booking_times` on `(booking_start_time, booking_end_time)` (composite)

**Foreign Keys:**
- `order_id` → `orders(id)` ON DELETE CASCADE
- `item_id` → `items(id)` ON DELETE RESTRICT
- `duration_tier_id` → `item_duration_tiers(id)` ON DELETE SET NULL

---

### 8. `order_status_history` Table

Audit trail for order status changes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `order_id` | CHAR(36) | NOT NULL, FK → orders.id | Order reference |
| `status` | ENUM('accepted','delivering','completed','rejected') | NOT NULL | Status value |
| `changed_by` | ENUM('system','business','customer') | DEFAULT 'system' | Who changed the status |
| `changed_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Change timestamp |

**Indexes:**
- `idx_order_id` on `order_id`
- `idx_changed_at` on `changed_at`

**Foreign Keys:**
- `order_id` → `orders(id)` ON DELETE CASCADE

---

### 9. `tables` Table

Physical tables for F&B businesses (for reservations).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `user_id` | CHAR(36) | NOT NULL, FK → users.id | Business/branch owner |
| `seats` | INT | NOT NULL | Number of seats |
| `number` | VARCHAR(50) | NOT NULL | Table number/identifier |
| `reserved` | BOOLEAN | DEFAULT false | Currently reserved |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_user_id` on `user_id`
- `idx_reserved` on `reserved`

**Foreign Keys:**
- `user_id` → `users(id)` ON DELETE CASCADE

---

### 10. `reservations` Table

Reservations for tables or services (all business types).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `user_id` | CHAR(36) | NULL, FK → users.id | Branch user (if branch-specific) |
| `business_user_id` | CHAR(36) | NOT NULL, FK → users.id | Business owner |
| `table_id` | CHAR(36) | NULL, FK → tables.id | Table reference (for F&B) |
| `customer_phone_number` | VARCHAR(20) | NOT NULL | Customer phone number |
| `customer_name` | VARCHAR(255) | NOT NULL | Customer name |
| `reservation_date` | DATE | NOT NULL | Reservation date |
| `reservation_time` | TIME | NOT NULL | Reservation time |
| `number_of_guests` | INT | NULL | Number of guests |
| `notes` | TEXT | NULL | Reservation notes |
| `status` | ENUM('confirmed', 'cancelled', 'completed') | DEFAULT 'confirmed' | Reservation status |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_business_user_id` on `business_user_id`
- `idx_reservation_date` on `reservation_date`
- `idx_table_id` on `table_id`

**Foreign Keys:**
- `user_id` → `users(id)` ON DELETE SET NULL
- `business_user_id` → `users(id)` ON DELETE CASCADE
- `table_id` → `tables(id)` ON DELETE SET NULL

---

### 11. `menus` Table

Menu definitions (belong to business, shared by all branches).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `business_id` | CHAR(36) | NOT NULL, FK → users.id | Business owner |
| `name` | VARCHAR(255) | NOT NULL | Menu name |
| `description` | TEXT | NULL | Menu description |
| `is_shared` | BOOLEAN | DEFAULT false | Shared across branches |
| `menu_image_url` | TEXT | NULL | **Deprecated** - single image URL |
| `menu_pdf_url` | TEXT | NULL | PDF menu file URL (S3) |
| `menu_image_urls` | JSON | NULL | Array of image URLs (S3) |
| `menu_link` | TEXT | NULL | External menu link URL |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_business_id` on `business_id`
- `idx_is_active` on `is_active`

**Foreign Keys:**
- `business_id` → `users(id)` ON DELETE CASCADE

**Notes:**
- `menu_image_urls` is a JSON array: `["url1", "url2", ...]`
- Priority: images > PDF > link > text-based menu

---

### 12. `opening_hours` Table

Opening hours for businesses or branches (one row per day).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `owner_type` | ENUM('business','branch') | NOT NULL | Owner type |
| `owner_id` | CHAR(36) | NOT NULL | References `users.id` (business or branch) |
| `day_of_week` | ENUM('monday','tuesday','wednesday','thursday','friday','saturday','sunday') | NOT NULL | Day of week |
| `open_time` | TIME | NULL | Opening time (e.g., "09:00:00") |
| `close_time` | TIME | NULL | Closing time (e.g., "22:00:00") |
| `is_closed` | BOOLEAN | DEFAULT false | Closed on this day |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_owner` on `(owner_type, owner_id)` (composite)
- `idx_day` on `day_of_week`
- `unique_owner_day` on `(owner_type, owner_id, day_of_week)` (unique constraint)

**Notes:**
- Branch hours override business hours if both exist
- If `is_closed=true`, day is closed regardless of times
- If `open_time` and `close_time` are NULL and `is_closed=false`, day is considered open 24/7

---

### 13. `policies` Table

Business policies (delivery, refund, cancellation, custom).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | CHAR(36) | PRIMARY KEY | UUID identifier |
| `owner_type` | ENUM('business','branch') | NOT NULL | Owner type |
| `owner_id` | CHAR(36) | NOT NULL | References `users.id` (business or branch) |
| `policy_type` | ENUM('delivery','refund','cancellation','custom') | NOT NULL | Policy type |
| `title` | VARCHAR(255) | NULL | Policy title |
| `description` | TEXT | NOT NULL | Policy description |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_owner` on `(owner_type, owner_id)` (composite)
- `idx_policy_type` on `policy_type`

---

## Relationships Summary

### Entity Relationship Diagram (Text)

```
users (business)
  ├── users (branch) [parent_user_id → users.id]
  ├── items [business_id → users.id]
  ├── menus [business_id → users.id]
  ├── orders [business_id → users.id]
  ├── opening_hours [owner_id → users.id, owner_type='business']
  └── policies [owner_id → users.id, owner_type='business']

users (branch)
  ├── items [user_id → users.id] (optional branch-specific items)
  ├── orders [user_id → users.id]
  ├── opening_hours [owner_id → users.id, owner_type='branch']
  └── policies [owner_id → users.id, owner_type='branch']

menus
  └── items [menu_id → menus.id]

items
  ├── item_ingredients [item_id → items.id]
  ├── item_duration_tiers [item_id → items.id]
  └── order_items [item_id → items.id]

orders
  ├── order_items [order_id → orders.id]
  └── order_status_history [order_id → orders.id]

tables
  └── reservations [table_id → tables.id]

locations
  ├── users [location_id → locations.id]
  └── orders [delivery_address_location_id → locations.id]
```

---

## Data Types and Constraints

### UUID Format
All primary keys use `CHAR(36)` to store UUIDs in standard format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Decimal Precision
- Prices: `DECIMAL(10,2)` - up to 99,999,999.99
- Coordinates: `DECIMAL(10,8)` for latitude, `DECIMAL(11,8)` for longitude
- Delivery radius: `DECIMAL(6,2)` - up to 9999.99 km

### ENUM Values
- `user_type`: 'admin', 'business', 'branch', 'customer'
- `business_type`: 'food and beverage', 'entertainment', 'sports', 'salons', 'clinics', 'rentals', 'other'
- `order_status`: 'cart', 'accepted', 'delivering', 'completed', 'rejected'
- `delivery_type`: 'takeaway', 'delivery', 'on_site'
- `availability`: 'available', 'out_of_stock', 'hidden'
- `payment_method`: 'cash', 'card', 'wallet', 'unknown'
- `payment_status`: 'unpaid', 'paid', 'refunded'
- `order_source`: 'whatsapp', 'telegram', 'manual', 'dashboard'
- `language_used`: 'arabic', 'arabizi', 'english', 'french'

### JSON Fields
- `items.days_available`: Array of day names: `["monday", "wednesday", "friday"]`
- `menus.menu_image_urls`: Array of URLs: `["https://...", "https://..."]`

---

## Indexes and Performance

### Primary Indexes
All tables have a primary key on `id` (CHAR(36) UUID).

### Foreign Key Indexes
All foreign keys are automatically indexed for join performance.

### Composite Indexes
- `opening_hours`: `(owner_type, owner_id)` for efficient owner lookups
- `opening_hours`: `(owner_type, owner_id, day_of_week)` unique constraint
- `orders`: `(customer_phone_number, created_at)` for customer order history
- `order_items`: `(booking_start_time, booking_end_time)` for rental conflict detection

### Query Optimization
- Business isolation: All queries filter by `business_id` for tenant isolation
- Soft deletes: Use `deleted_at IS NULL` for active records
- Status filtering: Index on `status` for order filtering
- Date ranges: Indexes on `created_at`, `completed_at`, `reservation_date` for time-based queries

---

## Deprecated Fields

The following fields are deprecated but kept for backward compatibility during migration:

1. **`items.branch_id`** - Use `items.user_id` instead
2. **`orders.branch_id`** - Use `orders.user_id` instead
3. **`menus.menu_image_url`** - Use `menus.menu_image_urls` (JSON array) instead

These will be removed in a future migration after all code is updated.

---

## Notes

1. **Cart Implementation**: Carts are stored in the `orders` table with `status='cart'` and `notes='__cart__'`. This allows carts to use the same structure as orders.

2. **Multi-Tenancy**: All queries must filter by `business_id` to ensure tenant isolation. No cross-tenant data access is allowed.

3. **Soft Deletes**: Most tables use `deleted_at` for soft deletes. Queries should filter with `deleted_at IS NULL`.

4. **Price Snapshots**: `order_items` stores `price_at_time` and `name_at_time` to preserve historical data even if items are updated.

5. **Branch Hierarchy**: Branches are stored in `users` table with `user_type='branch'` and `parent_user_id` pointing to the business. Branch hours/policies override business-level settings.

6. **Scheduled Orders**: Orders can have `scheduled_for` timestamp for future delivery/pickup. Items with `is_schedulable=true` require scheduling.

7. **Rental Items**: Items with `is_rental=true` use `item_duration_tiers` for time-based pricing and `order_items.booking_*` fields for time slot booking.

8. **Archival**: Completed orders are archived to MongoDB after 24-48 hours and deleted from MySQL to keep the database lean.
