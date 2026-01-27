# Zakaa Database System Summary

## Database Configuration

### MySQL Database
- **Database Name**: `zakaa_db` (default)
- **Connection Pool**: 10 connections max
- **Configuration File**: `src/config/database.js`

**Environment Variables Required:**
- `MYSQL_HOST` - MySQL server host (default: 127.0.0.1)
- `MYSQL_PORT` - MySQL server port (default: 3306)
- `MYSQL_USER` - MySQL username (default: root)
- `MYSQL_PASSWORD` - MySQL password
- `MYSQL_DATABASE` - Database name (default: zakaa_db)

### MongoDB Database
- **Database Name**: `zakaa_db` (default)
- **Configuration File**: `src/config/database.js`

**Environment Variables Supported:**
- `MONGO_URI` - Full MongoDB connection string (supports mongodb+srv:// for Atlas)
- OR individual components:
  - `MONGODB_HOST` - MongoDB host
  - `MONGODB_PORT` - MongoDB port (default: 27017)
  - `MONGODB_USER` - MongoDB username
  - `MONGODB_PASSWORD` - MongoDB password
  - `MONGODB_DATABASE` or `MONGO_DB_NAME` - Database name

## MySQL Database Schema

### Core Tables

#### 1. **users** (Multi-role table)
- Stores: admins, businesses, branches, customers
- Key fields:
  - `user_type`: ENUM('admin', 'business', 'branch', 'customer')
  - `business_type`: ENUM('food and beverage', 'entertainment', 'sports', 'salons', 'clinics', 'rentals', 'other')
  - `subscription_type`: ENUM('standard', 'premium')
  - `contract_status`: ENUM('pending', 'approved', 'rejected') - **CRITICAL: blocks bot if not approved**
  - `google_calendar_integration_json`: JSON for Google Calendar integration
  - `whatsapp_phone_number`, `whatsapp_phone_number_id`, `whatsapp_access_token_encrypted`

#### 2. **items**
- Stores: products, services, menu items
- Key fields:
  - `item_type`: ENUM('service', 'good')
  - `is_schedulable`: BOOLEAN
  - `min_schedule_hours`: INT
  - `service_type`: ENUM('physical', 'time_based')
  - `availability_status`: ENUM('available', 'unavailable', 'hidden')
  - `stock_quantity`: INT
  - `only_scheduled`: BOOLEAN
  - `category_id`: CHAR(36) - FK to service_categories

#### 3. **orders**
- Stores: customer orders
- Key fields:
  - `status`: ENUM('cart', 'accepted', 'delivering', 'completed', 'rejected')
  - `request_type`: ENUM('order', 'scheduled_request')
  - `delivery_type`: ENUM('takeaway', 'delivery', 'on_site')
  - `payment_method`: ENUM('cash', 'card', 'wallet', 'unknown')
  - `payment_status`: ENUM('unpaid', 'paid', 'refunded')
  - `scheduled_for`: TIMESTAMP
  - `first_response_at`: TIMESTAMP (analytics)
  - `source_message_id`: VARCHAR(255)

#### 4. **order_items**
- Stores: items in each order (with price snapshots)
- Key fields:
  - `price_at_time`: DECIMAL(10,2) - Price when ordered
  - `name_at_time`: VARCHAR(255) - Name when ordered
  - `booking_date`, `booking_start_time`, `booking_end_time` - For rental items
  - `item_type`: VARCHAR (from items table join)

#### 5. **menus**
- Stores: menu collections
- Key fields:
  - `menu_image_urls`: JSON - Array of image URLs
  - `menu_pdf_url`: TEXT
  - `menu_link`: TEXT
  - `sort_order`: INT

#### 6. **tables**
- Stores: Physical tables for F&B businesses
- Key fields:
  - `business_id`: CHAR(36)
  - `owner_user_id`: CHAR(36)
  - `table_number`: VARCHAR(50)
  - `min_seats`, `max_seats`: INT
  - `position_label`, `position_notes`: VARCHAR/TEXT
  - `is_active`: BOOLEAN

#### 7. **reservations**
- Stores: Table reservations and appointments
- Key fields:
  - `reservation_type`: ENUM('table', 'appointment', 'other')
  - `owner_user_id`: CHAR(36)
  - `platform`: ENUM('whatsapp', 'telegram', 'instagram', 'facebook', 'dashboard')
  - `status`: ENUM('confirmed', 'cancelled', 'completed', 'no_show')
  - `completed_at`, `cancelled_at`: TIMESTAMP

#### 8. **reservation_items**
- Stores: Items pre-ordered with reservations
- Key fields:
  - `reservation_id`: CHAR(36) - FK to reservations
  - `item_id`: CHAR(36) - FK to items
  - `quantity`: INT
  - `price_at_time`: DECIMAL(10,2)
  - `notes`: TEXT

### Add-on System Tables

#### 9. **addons**
- Stores: Available add-ons
- Key fields:
  - `addon_key`: VARCHAR(50) UNIQUE - e.g., 'base_bot', 'analytics_free', 'table_reservations'
  - `name`: VARCHAR(100)
  - `default_price`: DECIMAL(10,2)
  - `is_active`: BOOLEAN

#### 10. **business_addons**
- Stores: Business add-on activations
- Key fields:
  - `business_id`: CHAR(36) - FK to users
  - `addon_id`: CHAR(36) - FK to addons
  - `status`: ENUM('active', 'inactive')
  - `price_override`: DECIMAL(10,2)
  - `starts_at`, `ends_at`: TIMESTAMP

### Analytics & Tracking Tables

#### 11. **carriers**
- Stores: Delivery carriers
- Key fields:
  - `user_id`: CHAR(36) - Business or branch
  - `business_id`: CHAR(36)
  - `branch_id`: CHAR(36) - Nullable
  - `name`, `phone_number`: VARCHAR
  - `is_active`: BOOLEAN

#### 12. **service_categories**
- Stores: Item/service categories
- Key fields:
  - `business_id`: CHAR(36)
  - `name`: VARCHAR(255)
  - `sort_order`: INT
  - `is_active`: BOOLEAN

#### 13. **service_customizations**
- Stores: Item customization options
- Key fields:
  - `item_id`: CHAR(36) - FK to items
  - `name`: VARCHAR(255)
  - `price`: DECIMAL(10,2)
  - `is_active`: BOOLEAN

#### 14. **order_status_history**
- Stores: Order status change history
- Key fields:
  - `order_id`: CHAR(36)
  - `status`: ENUM('accepted', 'delivering', 'completed', 'rejected')
  - `changed_by`: ENUM('system', 'business', 'customer')
  - `changed_at`: TIMESTAMP

### Supporting Tables

#### 15. **locations**
- Stores: Address information
- Key fields:
  - `city`, `street`, `building`, `floor`: VARCHAR
  - `notes`: TEXT

#### 16. **opening_hours**
- Stores: Business/branch opening hours
- Key fields:
  - `owner_type`: ENUM('business', 'branch')
  - `owner_id`: CHAR(36)
  - `day_of_week`: ENUM('monday', ..., 'sunday')
  - `open_time`, `close_time`: TIME
  - `is_closed`: BOOLEAN

#### 17. **policies**
- Stores: Business policies
- Key fields:
  - `owner_type`: ENUM('business', 'branch')
  - `owner_id`: CHAR(36)
  - `policy_type`: ENUM('delivery', 'refund', 'cancellation', 'custom')
  - `title`, `description`: VARCHAR/TEXT

#### 18. **subscriptions**
- Stores: Subscription plans
- Key fields:
  - `name`: VARCHAR(255)
  - `price`: DECIMAL(10,2)
  - `description`: TEXT
  - `sale`: DECIMAL(5,2) - Sale percentage

#### 19. **user_subscriptions**
- Stores: User-subscription relationships (many-to-many)
- Key fields:
  - `user_id`: CHAR(36)
  - `subscription_id`: CHAR(36)
  - `status`: ENUM('active', 'cancelled', 'expired')
  - `started_at`, `ends_at`: TIMESTAMP

#### 20. **bot_integrations**
- Stores: Bot platform integrations
- Key fields:
  - `owner_type`: ENUM('business', 'branch')
  - `owner_id`: CHAR(36)
  - `platform`: ENUM('whatsapp', 'instagram', 'telegram', 'facebook')
  - `enabled`: BOOLEAN
  - `config_json`: JSON
  - `access_token_encrypted`: TEXT
  - `phone_number`, `phone_number_id`, `page_id`, `app_id`: VARCHAR

#### 21. **item_ingredients**
- Stores: Item ingredients (optional normalization)
- Key fields:
  - `item_id`: CHAR(36)
  - `ingredient_name`: VARCHAR(255)

#### 22. **item_duration_tiers**
- Stores: Time-based pricing tiers for rental items
- Key fields:
  - `item_id`: CHAR(36)
  - `duration_minutes`: INT
  - `price`: DECIMAL(10,2)

## MongoDB Collections

MongoDB is used for:
- **Message logs** - Chatbot conversation history
  - Collection: `message_logs`
  - Fields: `business_id`, `branch_id`, `customer_phone_number`, `direction` ('inbound'/'outbound'), `timestamp`, `message`, etc.

## Key Add-on Keys

- `base_bot` - Core chatbot functionality
- `analytics_free` - Free analytics features
- `table_reservations` - Table reservation system
- `analytics_paid_loyal_customer` - Paid analytics: Loyal customer
- `analytics_paid_most_ordered` - Paid analytics: Most ordered
- `analytics_paid_most_rewarding` - Paid analytics: Most rewarding
- `analytics_paid_time_breakdown` - Paid analytics: Time breakdown

## Database Files Location

- **Schema**: `database/schema.sql`
- **Major Migration**: `database/migration_major_update.sql`
- **Migrations**: `database/migration_*.sql`
- **Configuration**: `src/config/database.js`

## Important Notes

1. **Contract Status**: The `users.contract_status` field is CRITICAL - bots are blocked if status is not 'approved'
2. **Business Types**: Updated to: 'f & b', 'services', 'products' (migrated from old values)
3. **Item Types**: Items can be 'service' or 'good' with scheduling capabilities
4. **Add-on System**: Features are gated by add-on activation in `business_addons` table
5. **Multi-tenant**: All tables use `business_id` for tenant isolation
