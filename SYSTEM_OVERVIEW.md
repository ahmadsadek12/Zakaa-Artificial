# Zakaa Artificial - WhatsApp Ordering SaaS System Overview

## System Purpose

Zakaa is a WhatsApp-first ordering and reservation SaaS platform where **customers interact entirely through WhatsApp** (no website/app), and **businesses manage everything through a web dashboard**. The system uses AI (OpenAI/LLM) to handle customer conversations and automatically process orders.

---

## Core Architecture

### Technology Stack
- **Backend**: Node.js (Express)
- **SQL Database**: MySQL - for live/active data (users, businesses, branches, menus, items, active orders)
- **NoSQL Database**: MongoDB - for immutable logs (order history, chat logs, analytics)
- **Storage**: AWS S3 - for images (menu images, item images)
- **AI/LLM**: OpenAI (GPT-4o-mini) - for conversational order taking
- **Messaging**: Meta WhatsApp Business API - for customer communication
- **Authentication**: JWT tokens - for business dashboard access

### Hybrid Database Strategy
- **MySQL**: Stores active orders (≤24-48 hours), live business data, current menus/items
- **MongoDB**: Stores archived orders (after 24 hours), chat history, audit logs
- **Archival Job**: Automatically moves completed orders from MySQL → MongoDB daily

---

## User Roles

### 1. **Business Users**
- Register and create business profile
- Manage branches, menus, items
- Set opening hours, policies
- Connect WhatsApp Business account
- View/manage orders via dashboard
- **Standard**: Basic features
- **Premium**: Advanced analytics

### 2. **Customers**
- **No registration required**
- Identified by phone number only
- Interact **only via WhatsApp**
- Place orders through AI chatbot
- No dashboard access

### 3. **Admin Users**
- Full system access
- Can manage all businesses
- Access to all data

---

## How It Works

### Customer Journey (WhatsApp)

1. **Customer Messages Business WhatsApp Number**
   - Customer sends a message (e.g., "I want to order a burger")

2. **System Receives Webhook**
   - WhatsApp sends webhook to your server
   - System identifies which business/branch based on WhatsApp phone number ID

3. **AI Chatbot Responds**
   - System fetches business context (menus, items, prices, policies, hours)
   - OpenAI generates contextual response in customer's language
   - Chatbot helps build order, answers questions, confirms items

4. **Order Creation**
   - Customer confirms order via chat
   - System creates order in MySQL
   - Order status: `pending` → `accepted` → `preparing` → `ready` → `completed`

5. **Order Completion**
   - Business updates order status via dashboard
   - After 24 hours, order automatically archived to MongoDB
   - Used for analytics and history

### Business Dashboard Journey

1. **Business Registration**
   - Business signs up via API
   - Gets JWT token for dashboard access
   - Sets up profile, branches, menus, items

2. **Manage Operations**
   - Create/edit branches with locations
   - Manage menus and items (with images via S3)
   - Set opening hours and policies
   - Configure WhatsApp Business account

3. **Order Management**
   - View incoming orders
   - Update order status
   - Cancel orders if needed
   - View order statistics

4. **Analytics (Premium Only)**
   - Revenue analytics (daily/weekly/monthly)
   - Top selling items
   - Customer analytics
   - Branch performance comparison
   - Order trends

---

## Key Features

### 1. **WhatsApp Integration**
- Webhook handler for incoming messages
- Automatic business/branch resolution from phone number
- Message logging to MongoDB
- Support for text, images, interactive messages

### 2. **AI Chatbot (LLM-Powered)**
- Language detection (Arabic, Arabizi, English, French)
- Context-aware responses based on business data
- Menu browsing and item selection
- Order building and confirmation
- Constrained to actual menu items/prices (no hallucination)

### 3. **Multi-Tenant System**
- Complete tenant isolation (businesses can only see their data)
- Secure data separation
- Admin override capability

### 4. **Order Management**
- Order lifecycle tracking
- Status history logging
- Price snapshots (historical accuracy)
- Support for delivery, takeaway, on-site orders
- Scheduled orders support

### 5. **Menu & Item Management**
- Multiple menus per business
- Items can belong to menus and optionally specific branches
- Image upload to S3
- Availability management (available, out_of_stock, hidden)
- Price and cost tracking

### 6. **Location Management**
- Reusable locations table
- Can be attached to businesses or branches
- Includes city, street, building, floor, notes
- GPS coordinates support (latitude/longitude)

### 7. **Opening Hours**
- Business-level or branch-level hours
- Per-day configuration (Monday-Sunday)
- Open/close times
- Closed day support

### 8. **Policies & Rules**
- Business-level or branch-level policies
- Types: delivery, refund, cancellation, custom
- Used by chatbot to inform customers

### 9. **Subscription Management**
- **Standard**: Basic features (order management, menu management)
- **Premium**: Advanced analytics, revenue reports, customer insights
- Subscription status tracking
- Automatic gating of premium features

### 10. **Archive System**
- Completed orders archived after 24 hours
- Full snapshot saved to MongoDB
- Includes order details, items, status timeline
- Used for analytics and historical reports
- Automatic cleanup from MySQL

### 11. **Analytics (Premium)**
- Revenue analytics by period (daily/weekly/monthly)
- Top selling items
- Customer spending analysis
- Branch performance comparison
- Order statistics and trends
- All computed from MongoDB order_logs

### 12. **Security Features**
- JWT authentication for dashboard
- Encrypted WhatsApp tokens (AES-256)
- Tenant isolation middleware
- Rate limiting on API endpoints
- Input validation and sanitization
- Password hashing (bcrypt)

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Business registration
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Business Management
- `GET /api/businesses/me` - Get business profile
- `PUT /api/businesses/me` - Update profile
- `GET /api/businesses/me/subscription` - Get subscription
- `PUT /api/businesses/me/subscription` - Update subscription
- `POST /api/businesses/me/whatsapp/connect` - Connect WhatsApp
- `GET /api/businesses/me/whatsapp/status` - WhatsApp status

### Branches
- `GET /api/branches` - List branches
- `POST /api/branches` - Create branch
- `GET /api/branches/:id` - Get branch details
- `PUT /api/branches/:id` - Update branch
- `DELETE /api/branches/:id` - Delete branch
- `GET /api/branches/:id/menus` - Get branch menus

### Menus
- `GET /api/menus` - List menus
- `POST /api/menus` - Create menu (with image upload)
- `GET /api/menus/:id` - Get menu details
- `PUT /api/menus/:id` - Update menu
- `DELETE /api/menus/:id` - Delete menu
- `POST /api/menus/:id/attach` - Attach menu to branches
- `GET /api/menus/:id/items` - Get menu items

### Items
- `GET /api/items` - List items (filterable)
- `POST /api/items` - Create item (with image upload)
- `GET /api/items/:id` - Get item details
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `PUT /api/items/:id/availability` - Update availability

### Orders
- `GET /api/orders` - List orders (filterable by status, date, branch)
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status
- `POST /api/orders/:id/cancel` - Cancel order
- `GET /api/orders/stats` - Order statistics

### Policies
- `GET /api/policies` - List policies (filterable by owner)
- `POST /api/policies` - Create policy
- `PUT /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy

### Opening Hours
- `GET /api/opening-hours` - Get opening hours
- `POST /api/opening-hours` - Create/update hours
- `DELETE /api/opening-hours` - Delete hours

### Analytics (Premium Only)
- `GET /api/analytics/overview` - Dashboard overview
- `GET /api/analytics/revenue` - Revenue analytics
- `GET /api/analytics/orders` - Order analytics
- `GET /api/analytics/items` - Top items
- `GET /api/analytics/customers` - Customer analytics
- `GET /api/analytics/branches` - Branch comparison

### Webhooks
- `GET /webhook/whatsapp` - Webhook verification (Meta requirement)
- `POST /webhook/whatsapp` - WhatsApp message handler

### Health
- `GET /health` - Health check
- `GET /health/db` - Database health check

---

## Data Flow Examples

### Example 1: Customer Places Order via WhatsApp

```
1. Customer: "Hi, I want a burger"
   ↓
2. WhatsApp → Webhook → Your Server
   ↓
3. System resolves: Which business? Which branch?
   ↓
4. System fetches: Menus, items, prices, policies
   ↓
5. OpenAI generates response: "Great! We have..."
   ↓
6. Customer: "I want the cheese burger"
   ↓
7. OpenAI: "Added cheese burger. Anything else?"
   ↓
8. Customer: "No, that's all"
   ↓
9. System creates order in MySQL
   ↓
10. Business sees order in dashboard
   ↓
11. Business updates status: accepted → preparing → ready → completed
   ↓
12. After 24 hours: Order archived to MongoDB
```

### Example 2: Business Adds New Item

```
1. Business logs into dashboard
   ↓
2. POST /api/items (with image file)
   ↓
3. Image uploaded to S3
   ↓
4. Item saved to MySQL with S3 URL
   ↓
5. Item now available for customers via WhatsApp chatbot
```

### Example 3: Premium Analytics Query

```
1. Premium business requests analytics
   ↓
2. GET /api/analytics/revenue?period=monthly
   ↓
3. System queries MongoDB order_logs
   ↓
4. Aggregates completed orders by month
   ↓
5. Returns revenue data, trends, comparisons
```

---

## Database Schema Summary

### MySQL Tables (Active Data)
- `users` - Business users, admins (multi-role table)
- `locations` - Reusable location data
- `branches` - Business branches with locations
- `opening_hours` - Business/branch opening hours
- `policies` - Business/branch policies
- `menus` - Menu definitions
- `branch_menus` - Branch-Menu relationships (M:N)
- `items` - Menu items with prices
- `orders` - Active orders (≤24-48 hours old)
- `order_items` - Order line items with price snapshots
- `order_status_history` - Order status change tracking

### MongoDB Collections (Immutable Logs)
- `order_logs` - Archived orders (full snapshots)
- `message_logs` - WhatsApp chat history
- `audit_logs` - Dashboard action logs
- `daily_business_metrics` - Optional aggregated analytics

---

## Key Business Rules

### Order Lifecycle
1. Order created: `pending`
2. Business accepts: `accepted`
3. Business preparing: `preparing`
4. Order ready: `ready`
5. Order completed: `completed`
6. After 24h: Archived to MongoDB, deleted from MySQL

### Subscription Tiers
- **Standard**: All basic features, no analytics
- **Premium**: Includes advanced analytics endpoints

### Tenant Isolation
- Businesses can ONLY see their own data
- All queries auto-filtered by `business_id`
- Admins can see everything

### WhatsApp Integration
- Business can have WhatsApp at business-level (default for all branches)
- Or each branch can have its own WhatsApp number
- System automatically resolves context from incoming message

### LLM Safety
- LLM only receives actual database data
- Cannot invent items or prices
- Constrained to actual menu items
- If uncertain, asks clarifying questions

---

## Automated Jobs

### Archive Job (Daily at 2 AM)
- Finds completed orders > 24 hours old
- Builds full snapshot (order + items + status history)
- Saves to MongoDB `order_logs`
- Deletes from MySQL
- Logs errors for monitoring

---

## Security Measures

1. **JWT Authentication** - Secure token-based auth
2. **Password Hashing** - bcrypt (10 rounds)
3. **Token Encryption** - AES-256-GCM for WhatsApp tokens
4. **Tenant Isolation** - Middleware enforces data separation
5. **Rate Limiting** - Prevents abuse (100 req/15min, 5 auth req/15min)
6. **Input Validation** - express-validator on all endpoints
7. **SQL Injection Prevention** - Parameterized queries
8. **CORS Protection** - Configurable origins
9. **Helmet** - Security headers
10. **Error Handling** - No sensitive data in errors

---

## Configuration Required

### Minimum (To Run)
- ✅ JWT_SECRET - Secure random key
- ✅ ENCRYPTION_KEY - 32-byte hex key
- ✅ OPENAI_API_KEY - For LLM chatbot
- ✅ MySQL & MongoDB - Already configured

### Optional (For Full Features)
- ⚠️ AWS S3 Credentials - For image uploads
- ⚠️ WhatsApp Business API - For WhatsApp integration

---

## Potential Issues to Check

### 1. **WhatsApp Integration**
- ✅ Webhook verification implemented
- ✅ Context resolution (business/branch from phone number)
- ⚠️ Need to verify WhatsApp API message format matches implementation
- ⚠️ Need to test with actual WhatsApp webhooks

### 2. **LLM Chatbot**
- ✅ Language detection implemented
- ✅ Prompt building from database data
- ⚠️ Need to test order creation flow (how chatbot creates orders)
- ⚠️ Need cart/order state management in conversations

### 3. **Order Creation**
- ✅ Order creation endpoint exists
- ⚠️ Currently no route for chatbot to create orders (might need integration)
- ⚠️ Need to verify LLM can trigger order creation

### 4. **Image Upload**
- ✅ S3 upload configured
- ✅ Multer middleware for file uploads
- ⚠️ Need AWS credentials configured

### 5. **Analytics**
- ✅ Queries MongoDB order_logs
- ✅ Premium gating middleware
- ⚠️ Need to verify date range queries work correctly

### 6. **Archive Job**
- ✅ Cron job scheduled
- ✅ Archive service implemented
- ⚠️ Need to test with actual completed orders

---

## What's Missing or Needs Clarification

### 1. **Order Creation Flow**
Currently, the chatbot returns text responses but there's no clear integration for the LLM to actually **create orders** in the system. You may need:
- A way for the LLM to trigger order creation
- Cart state management in conversations
- Order confirmation mechanism

### 2. **Language Detection**
Current implementation is basic. For production, you might want:
- More sophisticated Arabic/Arabizi detection
- Language preference persistence per customer

### 3. **Multi-Language Responses**
LLM can respond in different languages, but you might want to:
- Store language preference per business
- Ensure consistent language throughout conversation

### 4. **Payment Integration**
- Currently only tracks payment method/status
- No actual payment processing integration
- You may need to add payment gateway (Stripe, PayPal, etc.)

### 5. **Delivery Address**
- Orders support `delivery_address_location_id`
- But no route/customer-facing way to set delivery address via WhatsApp

### 6. **Branch Selection**
- If business has multiple branches, chatbot should help customer choose
- Currently no explicit branch selection flow in chatbot

### 7. **Order Notifications**
- Business should be notified of new orders
- Could add email/push notifications or webhook callbacks

### 8. **WhatsApp Template Messages**
- Currently only handles inbound messages
- Might want to send order status updates proactively
- WhatsApp templates for order confirmations

---

## Testing Checklist

### Basic Functionality
- [ ] Server starts without errors
- [ ] Health check endpoints work
- [ ] Database connections successful
- [ ] Authentication (register/login) works
- [ ] Business profile CRUD works

### Core Features
- [ ] Branch creation with location
- [ ] Menu creation with image upload
- [ ] Item creation with image upload
- [ ] Opening hours configuration
- [ ] Policies creation

### WhatsApp Integration
- [ ] Webhook verification works
- [ ] Incoming message processing
- [ ] Business/branch context resolution
- [ ] LLM chatbot responses
- [ ] Message logging to MongoDB

### Order Management
- [ ] Order creation (manually via API)
- [ ] Order status updates
- [ ] Order cancellation
- [ ] Order statistics

### Archive System
- [ ] Archive job runs (or manual trigger)
- [ ] Completed orders moved to MongoDB
- [ ] Orders deleted from MySQL
- [ ] Analytics queries work

### Premium Features
- [ ] Premium middleware gates analytics
- [ ] Analytics endpoints return data
- [ ] Revenue analytics calculations correct

---

## Summary

**The system is a complete WhatsApp-first ordering platform** where:
- Customers order through WhatsApp via AI chatbot
- Businesses manage everything through REST API dashboard
- Orders are processed and tracked through complete lifecycle
- Premium businesses get advanced analytics
- Completed orders are automatically archived for history

**Main thing to verify**: The order creation flow from WhatsApp → LLM → Database needs to be tested and potentially enhanced to handle the conversation-to-order conversion seamlessly.
