1️⃣ Architecture Overview
SQL (Relational – Source of Truth)

Use SQL (PostgreSQL / MySQL) for:

Users

Branches

Items

Active Orders (≤ 24–48 hours)

Order–Item relationships

NoSQL (Logs & History)

Use NoSQL (MongoDB / DynamoDB) for:

Order logs (immutable history)

Status transitions

WhatsApp message logs

Webhook payloads

Audit trails

Policy

Completed orders remain in SQL for 24 hours

After 24h → archive full snapshot into NoSQL → delete from SQL

2️⃣ Users Table (Single Table, Multi-Role)
Table: users
users (
  id UUID PRIMARY KEY,
  user_type ENUM('admin', 'business', 'customer'),

  -- Shared
  email VARCHAR(255),
  contact_phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP,

  -- Business-only (nullable)
  business_name VARCHAR(255),
  business_type ENUM('restaurant', 'sports_court', 'salon', 'other'),
  whatsapp_phone_number VARCHAR(20),
  whatsapp_phone_number_id VARCHAR(255),
  whatsapp_access_token_encrypted TEXT,

  -- Customer-only (nullable)
  first_name VARCHAR(100),
  last_name VARCHAR(100)
)

Rules

user_type controls permissions

WhatsApp fields nullable (business only)

Tokens must be encrypted before storage

Use UUIDs for multi-tenant safety

3️⃣ Branches Table (Business → Many Branches)
Table: branches
branches (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES users(id),

  branch_name VARCHAR(255),
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  menu_image_url TEXT,

  contact_phone_number VARCHAR(20),
  whatsapp_phone_number VARCHAR(20),
  whatsapp_phone_number_id VARCHAR(255),
  whatsapp_access_token_encrypted TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
)

Rules

Each branch may have its own WhatsApp number

Menu stored as URL, not binary

Branch belongs only to user_type = business

4️⃣ Items (Belongs to Business + Optional Branch)
Table: items
items (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES users(id),
  branch_id UUID REFERENCES branches(id),

  name VARCHAR(255),
  description TEXT,

  price DECIMAL(10,2),
  cost DECIMAL(10,2),

  preparation_time_minutes INT,

  availability ENUM('available', 'out_of_stock', 'hidden'),
  created_at TIMESTAMP DEFAULT now()
)

Notes

branch_id nullable → item applies to all branches

Do NOT store earnings (derived value)

Optional Normalization (Recommended)
Table: item_ingredients
item_ingredients (
  id UUID PRIMARY KEY,
  item_id UUID REFERENCES items(id),
  ingredient_name VARCHAR(255)
)

5️⃣ Orders (Transactional, Short-Lived)
Table: orders
orders (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES users(id),
  business_id UUID REFERENCES users(id),
  branch_id UUID REFERENCES branches(id),

  status ENUM(
    'pending',
    'accepted',
    'preparing',
    'completed',
    'cancelled'
  ),

  subtotal DECIMAL(10,2),
  delivery_price DECIMAL(10,2),
  total DECIMAL(10,2),

  delivery_type ENUM('takeaway', 'delivery', 'on_site'),

  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
)

Lifecycle

Orders exist in SQL only while active or recently completed

After completion + 24h → archived to NoSQL → deleted

6️⃣ Order ↔ Item (Many-to-Many)
Table: order_items
order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  item_id UUID REFERENCES items(id),

  quantity INT,
  price_at_time DECIMAL(10,2)
)

Rules

price_at_time is mandatory

Guarantees historical accuracy even if prices change

7️⃣ NoSQL Order Logs (MongoDB)
Collection: order_logs
{
  "_id": "uuid",
  "order_id": "uuid",

  "business_id": "uuid",
  "branch_id": "uuid",
  "customer_id": "uuid",

  "delivery_type": "delivery",
  "final_status": "completed",

  "items": [
    {
      "item_id": "uuid",
      "name": "Burger",
      "quantity": 2,
      "price": 8.5
    }
  ],

  "subtotal": 17,
  "delivery_price": 3,
  "total": 20,

  "status_timeline": [
    { "status": "pending", "at": "2026-01-02T18:12:00Z" },
    { "status": "accepted", "at": "2026-01-02T18:15:00Z" },
    { "status": "completed", "at": "2026-01-02T18:42:00Z" }
  ],

  "created_at": "2026-01-02T18:12:00Z",
  "archived_at": "2026-01-03T18:12:00Z"
}

Rules

Immutable (append-only)

No updates after insert

Used for:

History

Analytics

Audits

Customer support

8️⃣ Security Requirements
WhatsApp Tokens

Encrypt using AES-256

Encryption key stored in environment variables

Tokens never logged

Decrypt only at runtime

Access Control

Admin → full access

Business → own data only

Customer → own orders only

9️⃣ Cleanup & Archival Job
Background Job (Cron / Worker)
IF order.status = 'completed'
AND completed_at < now() - 24 hours
THEN
  → Copy full snapshot to NoSQL
  → Delete order + order_items from SQL

✅ Final Notes for Cursor

Use UUIDs everywhere

Enforce foreign keys

Index:

orders.business_id

orders.customer_id

items.branch_id

branches.business_id

Treat NoSQL as write-only history