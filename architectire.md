# WhatsApp-First Ordering SaaS (AWS) — Hybrid SQL + NoSQL Architecture (Cursor Spec)

This document is a Cursor-ready architecture + data model spec for a multi-tenant WhatsApp ordering/reservation system.
Customers do NOT use a website; they interact only via WhatsApp. Businesses manage data via a web dashboard (Premium adds analytics).

---

## 0) High-Level Architecture

### Core components (AWS)
- **API**: Node/Java backend (REST) behind API Gateway / ALB
- **WhatsApp Webhook**: Meta WhatsApp Business API → Webhook endpoint
- **SQL DB (Transactional)**: PostgreSQL (RDS) for live data + active/recent orders
- **NoSQL (Immutable Logs)**: DynamoDB or MongoDB (recommended) for order logs + chat/message logs + audit trails
- **Storage**: S3 for images (menu images, item images)
- **Cache (optional)**: Redis (ElastiCache) for hot reads (menus/items) if needed
- **Scheduler/Worker**: Cron/Lambda/Queue worker for archival + cleanup + analytics aggregation
- **Auth for dashboard**: JWT/Cognito (business/admin only)

### Data flow (WhatsApp)
1. Customer messages a business WhatsApp number
2. WhatsApp → Webhook (your backend)
3. Backend resolves **business + branch context** (phone_number_id mapping)
4. Backend fetches business data (menus/items/policies/hours) from SQL
5. Backend calls LLM (ChatGPT API) with constrained context (DB-derived) to generate response
6. Backend can create/update orders in SQL
7. Backend writes chat + order events to NoSQL logs

### Conversation pricing (important)
- WhatsApp charges per **24h conversation window**, not per message.
- Design for a single window per order; avoid templates unless needed.

---

## 1) Core Concepts / Tenancy Rules

- `users.user_type` ∈ { `admin`, `business`, `customer` }
- Only `business` users have:
  - branches
  - dashboard access
  - WhatsApp credentials
  - subscription
- Customers are identified primarily by:
  - `customer_phone_number` (and optionally `whatsapp_user_id`)
- Strong tenant isolation:
  - Business can only see data where `business_id = their user id`
  - Admin can see everything

---

## 2) SQL Data Model (PostgreSQL / MySQL)

> Use UUIDs everywhere. Add `created_at`, `updated_at`, and optional `deleted_at` (soft delete) to most tables.

### 2.1 Users

**Table: `users`**
- `id` UUID PK
- `user_type` ENUM('admin','business','customer')
- `email` VARCHAR(255) NULL (customers likely NULL)
- `contact_phone_number` VARCHAR(20) NULL
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMP DEFAULT now()
- `updated_at` TIMESTAMP
- `deleted_at` TIMESTAMP NULL

**Business-only fields (nullable)**
- `business_name` VARCHAR(255)
- `business_type` ENUM('restaurant','sports_court','salon','other')
- `default_language` ENUM('arabic','arabizi','english','french') NULL
- `timezone` VARCHAR(50) DEFAULT 'Asia/Beirut'

**WhatsApp (business-level default, nullable)**
- `whatsapp_phone_number` VARCHAR(20)
- `whatsapp_phone_number_id` VARCHAR(255)
- `whatsapp_access_token_encrypted` TEXT

**Subscription (business-only, nullable)**
- `subscription_type` ENUM('standard','premium') DEFAULT 'standard'
- `subscription_price` DECIMAL(10,2) NULL
- `subscription_started_at` TIMESTAMP NULL
- `subscription_ends_at` TIMESTAMP NULL
- `subscription_status` ENUM('active','past_due','canceled') DEFAULT 'active'

**Optional: business settings**
- `allow_scheduled_orders` BOOLEAN DEFAULT true
- `allow_delivery` BOOLEAN DEFAULT true
- `allow_takeaway` BOOLEAN DEFAULT true
- `allow_on_site` BOOLEAN DEFAULT true

---

### 2.2 Locations (Reusable)

**Table: `locations`**
- `id` UUID PK
- `city` VARCHAR(100)
- `street` VARCHAR(255)
- `building` VARCHAR(255)
- `floor` VARCHAR(50)
- `notes` TEXT
- `latitude` DECIMAL(10,8) NULL
- `longitude` DECIMAL(11,8) NULL
- `created_at` TIMESTAMP DEFAULT now()

> Link locations from businesses and branches using `location_id`.

---

### 2.3 Branches (Business 1 → M Branches)

**Table: `branches`**
- `id` UUID PK
- `business_id` UUID FK → users(id)
- `branch_name` VARCHAR(255)
- `location_id` UUID FK → locations(id)
- `contact_phone_number` VARCHAR(20) NULL
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMP DEFAULT now()
- `updated_at` TIMESTAMP
- `deleted_at` TIMESTAMP NULL

**Branch WhatsApp overrides (optional)**
- `whatsapp_phone_number` VARCHAR(20) NULL
- `whatsapp_phone_number_id` VARCHAR(255) NULL
- `whatsapp_access_token_encrypted` TEXT NULL

**Branch rules/settings**
- `min_order_value` DECIMAL(10,2) NULL
- `avg_preparation_time_minutes` INT NULL

---

### 2.4 Opening Hours (Business or Branch)

**Table: `opening_hours`**
- `id` UUID PK
- `owner_type` ENUM('business','branch')
- `owner_id` UUID  (business_id or branch_id based on owner_type)
- `day_of_week` ENUM('monday','tuesday','wednesday','thursday','friday','saturday','sunday')
- `open_time` TIME NULL
- `close_time` TIME NULL
- `is_closed` BOOLEAN DEFAULT false

**Optional Holiday Overrides**
- `date_overrides` table (future):
  - `owner_type`, `owner_id`, `date`, `is_closed`, `open_time`, `close_time`

---

### 2.5 Policies & Rules (Business or Branch)

**Table: `policies`**
- `id` UUID PK
- `owner_type` ENUM('business','branch')
- `owner_id` UUID
- `policy_type` ENUM('delivery','refund','cancellation','custom')
- `title` VARCHAR(255) NULL
- `description` TEXT
- `created_at` TIMESTAMP DEFAULT now()

---

### 2.6 Menus (Shared across branches or branch-specific)

**Table: `menus`**
- `id` UUID PK
- `business_id` UUID FK → users(id)
- `name` VARCHAR(255)
- `description` TEXT NULL
- `is_shared` BOOLEAN DEFAULT false
- `menu_image_url` TEXT NULL (S3)
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMP DEFAULT now()
- `updated_at` TIMESTAMP

**Table: `branch_menus`** (M:N)
- `id` UUID PK
- `branch_id` UUID FK → branches(id)
- `menu_id` UUID FK → menus(id)
- UNIQUE(branch_id, menu_id)

> If a menu is shared, you can attach it to all branches via `branch_menus`.

---

### 2.7 Items

**Table: `items`**
- `id` UUID PK
- `business_id` UUID FK → users(id)
- `menu_id` UUID FK → menus(id)
- `name` VARCHAR(255)
- `description` TEXT NULL
- `price` DECIMAL(10,2)
- `cost` DECIMAL(10,2) NULL
- `preparation_time_minutes` INT NULL
- `availability` ENUM('available','out_of_stock','hidden') DEFAULT 'available'
- `item_image_url` TEXT NULL (S3)
- `created_at` TIMESTAMP DEFAULT now()
- `updated_at` TIMESTAMP
- `deleted_at` TIMESTAMP NULL

**Optional: item options / modifiers (recommended for restaurants)**
- `item_options` (size, add-ons, extras)
- `order_item_options` (selected options per order item)

**Optional: ingredients normalization**
- `item_ingredients` (id, item_id, ingredient_name)

---

### 2.8 Orders (Active + Recent only)

**Table: `orders`**
- `id` UUID PK
- `business_id` UUID FK → users(id)
- `branch_id` UUID FK → branches(id)
- `customer_phone_number` VARCHAR(20) NOT NULL
- `whatsapp_user_id` VARCHAR(255) NULL  (if available from Meta)
- `language_used` ENUM('arabic','arabizi','english','french') NULL
- `order_source` ENUM('whatsapp') DEFAULT 'whatsapp'

- `delivery_type` ENUM('takeaway','delivery','on_site') NOT NULL
- `status` ENUM('pending','accepted','preparing','ready','completed','cancelled') DEFAULT 'pending'

- `subtotal` DECIMAL(10,2)
- `delivery_price` DECIMAL(10,2) DEFAULT 0
- `total` DECIMAL(10,2)

- `notes` TEXT NULL
- `scheduled_for` TIMESTAMP NULL  (for scheduled orders)
- `created_at` TIMESTAMP DEFAULT now()
- `updated_at` TIMESTAMP
- `completed_at` TIMESTAMP NULL
- `cancelled_at` TIMESTAMP NULL

**Table: `order_items`**
- `id` UUID PK
- `order_id` UUID FK → orders(id)
- `item_id` UUID FK → items(id)
- `quantity` INT NOT NULL
- `price_at_time` DECIMAL(10,2) NOT NULL
- `name_at_time` VARCHAR(255) NOT NULL  (snapshot for history)
- `notes` TEXT NULL

**Table: `order_status_history`** (recommended even if orders are short-lived)
- `id` UUID PK
- `order_id` UUID FK → orders(id)
- `status` ENUM(...)
- `changed_at` TIMESTAMP DEFAULT now()
- `changed_by` ENUM('system','business','customer') DEFAULT 'system'

---

### 2.9 Business Dashboard Access (Premium gating)

- Premium businesses can access analytics endpoints/views.
- Enforce gating in backend using:
  - `users.subscription_type = 'premium'` AND `subscription_status = 'active'`

---

## 3) NoSQL Data Model (Logs & Analytics Source)

Use NoSQL for append-only documents/events. One-way flow: SQL → NoSQL (archive).

### 3.1 Order Logs (Immutable Snapshots)

**Collection/Table: `order_logs`**
Store one document per archived order:
- `order_id`, `business_id`, `branch_id`
- `customer_phone_number`, `whatsapp_user_id`
- `delivery_type`, `final_status`
- `items[]` snapshots (id/name/qty/price)
- `subtotal`, `delivery_price`, `total`
- `status_timeline[]` (status, at)
- `created_at`, `completed_at`, `archived_at`
- Optional: `language_used`, `notes`, `source`

### 3.2 Chat / Message Logs

**Collection/Table: `message_logs`**
- `id`
- `business_id`, `branch_id`
- `customer_phone_number`, `whatsapp_user_id`
- `direction` ENUM('inbound','outbound')
- `channel` ENUM('whatsapp')
- `message_type` ENUM('text','image','audio','interactive')
- `text` (if any)
- `meta_message_id`
- `timestamp`
- Optional: `llm_used` boolean, `tokens_in`, `tokens_out`, `latency_ms`

### 3.3 Audit Logs (Dashboard actions)

**Collection/Table: `audit_logs`**
- `actor_user_id` (business/admin)
- `business_id`
- `action` (create_item, update_price, delete_menu, etc.)
- `entity_type`, `entity_id`
- `before`, `after` snapshots
- `timestamp`, `ip`

### 3.4 Aggregations (Premium analytics)

**Collection/Table: `daily_business_metrics`** (optional later)
- `business_id`, `date`
- `orders_count`
- `revenue_total`
- `avg_order_value`
- `top_items[]`
- `peak_hours[]`
- `repeat_customers_count`

> You can compute analytics directly from `order_logs` first, then add aggregates when scale grows.

---

## 4) Archival & Cleanup Jobs (Critical)

### 4.1 Archive completed orders after 24 hours
Condition:
- `orders.status = 'completed'`
- `orders.completed_at < now() - interval '24 hours'`

Steps:
1. Build full snapshot from SQL (`orders`, `order_items`, `order_status_history`)
2. Insert into NoSQL `order_logs`
3. Delete from SQL:
   - `order_status_history`
   - `order_items`
   - `orders`

### 4.2 Optional: archive cancelled orders after 24 hours
Same approach.

### 4.3 Optional: analytics daily rollup (premium)
- Every night: compute metrics from `order_logs` for that day → store in `daily_business_metrics`

---

## 5) WhatsApp Mapping (Branch vs Business Resolution)

**Goal:** When webhook hits, determine which tenant/branch it belongs to.

Recommended:
- Keep `whatsapp_phone_number_id` on **branches** if branches have their own numbers.
- Else store on **business** and default to a branch selection step.

Implementation rule:
- On inbound webhook:
  - Try match `branches.whatsapp_phone_number_id`
  - Else match `users.whatsapp_phone_number_id`
  - If only business match and multiple branches exist → chatbot asks user to choose a branch (or infer by location text).

---

## 6) Access Control Rules (Backend)

- Admin:
  - unrestricted
- Business:
  - can CRUD only own entities:
    - branches where `business_id = user.id`
    - menus where `business_id = user.id`
    - items where `business_id = user.id`
    - orders where `business_id = user.id`
- Customer:
  - no dashboard access
  - only interacts through WhatsApp, identified by phone number

---

## 7) LLM / Chatbot Safety & Data Access Rules

### Principle: LLM answers must be grounded in DB data
- Backend retrieves relevant records first
- LLM gets:
  - business name, policies, hours, menus, items, prices, etc.
  - current order cart context (if any)
- LLM should NOT invent items/prices.
- If uncertain, LLM should ask a clarifying question.

### Language handling
- Detect: arabizi / Arabic / English / French
- Normalize and store `language_used` in orders + logs.

### Token security
- Store WhatsApp token encrypted (AES-256)
- Store OpenAI/LLM API key in server env/secret manager only (NEVER DB)

---

## 8) Recommended Indexes (SQL)

Create indexes:
- `branches(business_id)`
- `menus(business_id)`
- `items(business_id)`
- `items(menu_id)`
- `branch_menus(branch_id)`
- `branch_menus(menu_id)`
- `orders(business_id, created_at)`
- `orders(branch_id, created_at)`
- `orders(customer_phone_number, created_at)`
- `order_items(order_id)`
- `order_status_history(order_id)`

Optional uniqueness:
- `branches(whatsapp_phone_number_id)` unique where not null
- `users(whatsapp_phone_number_id)` unique where not null

---

## 9) Recommended “You Might Forget These” Fields / Features

Add these if needed (recommended):
- `orders.payment_method` ENUM('cash','card','wallet','unknown')
- `orders.payment_status` ENUM('unpaid','paid','refunded') default 'unpaid'
- `orders.delivery_address_location_id` FK → locations (if delivery)
- `orders.customer_name` (optional text captured by chatbot)
- `branches.service_radius_km` (if delivery)
- `branches.delivery_fee_rules` (table or JSON later)
- `items.is_featured` BOOLEAN
- `items.tags` (table or array later)

Also recommended:
- Soft delete (`deleted_at`) on items/menus/branches to avoid breaking historical references.
- Snapshot fields in `order_items` (`name_at_time`, `price_at_time`) already included.

---

## 10) Implementation Notes for Cursor

- Use UUID primary keys everywhere.
- Enforce foreign keys + cascade rules carefully (do NOT cascade delete historical logs).
- Use S3 for images; store only URLs in SQL.
- Do not store derived values (earnings); compute in queries.
- Hybrid model is intentional:
  - SQL = live operations
  - NoSQL = immutable history, logs, analytics source
- Archive policy is mandatory for predictable performance/cost.

---

## 11) Premium Analytics Examples (Computed from NoSQL `order_logs`)

Premium dashboard can show:
- Biggest spenders (by customer_phone_number total)
- Sales by hour/day/week
- Most ordered items
- Repeat customers
- Avg order value
- Order completion time (created_at → completed_at)
- Branch performance comparisons
- Language distribution (arabizi/Arabic/EN/FR)

---

END.
