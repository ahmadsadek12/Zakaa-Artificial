# Zakaa System Architecture - Complete Documentation

## Overview

Zakaa is a WhatsApp-first ordering and reservation SaaS platform where customers interact entirely through WhatsApp (no website/app), and businesses manage everything through a web dashboard. The system uses AI (OpenAI/LLM) to handle customer conversations and automatically process orders.

---

## Technology Stack

### Backend
- **Runtime**: Node.js (Express.js)
- **Language**: JavaScript (ES6+)
- **Framework**: Express.js 4.x
- **Process Manager**: PM2 (via ecosystem.config.js)

### Databases
- **Primary Database**: MySQL 8.0+ (InnoDB engine)
  - Stores all active/transactional data
  - Users, businesses, branches, menus, items, active orders
  - Connection pooling via mysql2
- **Archive Database**: MongoDB (optional, can be disabled)
  - Stores archived orders (after 24-48 hours)
  - Chat history and message logs
  - Analytics data
  - Gracefully degrades if unavailable

### Storage
- **Object Storage**: AWS S3
  - Menu images (PDFs, images)
  - Item images
  - Organized by business folders: `businesses/{businessId}/...`

### AI/LLM
- **Provider**: OpenAI
- **Model**: GPT-4o-mini (configurable)
- **Usage**: Conversational order taking, language detection, natural language processing

### Messaging Platforms
- **WhatsApp**: Meta WhatsApp Business API
  - Primary customer communication channel
  - Webhook-based message handling
- **Telegram**: Telegram Bot API
  - Alternative messaging channel
  - Bot-based interactions
- **Twilio**: Twilio WhatsApp API (alternative)
  - Fallback WhatsApp provider

### Authentication & Security
- **JWT**: JSON Web Tokens for dashboard authentication
- **Bcrypt**: Password hashing
- **Helmet**: Security headers
- **Rate Limiting**: express-rate-limit
- **CORS**: Configurable CORS policies

### Other Services
- **Image Processing**: Sharp (for image optimization)
- **Logging**: Winston (structured logging)
- **Caching**: In-memory cache (for menu items, etc.)
- **Scheduling**: node-cron (for background jobs)

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├─────────────────────────────────────────────────────────────┤
│  WhatsApp Users  │  Telegram Users  │  Business Dashboard    │
└────────┬─────────┴────────┬──────────┴──────────┬────────────┘
         │                  │                     │
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer                │
│                    (Nginx / AWS ALB)                         │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Application                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Webhooks   │  │  REST API    │  │  Middleware   │      │
│  │   Handler    │  │   Routes     │  │   (Auth,     │      │
│  │              │  │              │  │   Tenant)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                   │
│         ┌─────────────────┴─────────────────┐               │
│         │                                   │               │
│         ▼                                   ▼               │
│  ┌──────────────┐                  ┌──────────────┐        │
│  │   Services   │                  │ Repositories │        │
│  │              │                  │              │        │
│  │ - Chatbot    │                  │ - Users      │        │
│  │ - Cart       │                  │ - Orders     │        │
│  │ - Orders     │                  │ - Items      │        │
│  │ - WhatsApp   │                  │ - Menus      │        │
│  │ - Telegram   │                  │ - Branches   │        │
│  └──────┬───────┘                  └──────┬───────┘        │
│         │                                   │               │
└─────────┼───────────────────────────────────┼───────────────┘
          │                                   │
          ▼                                   ▼
┌─────────────────────┐          ┌─────────────────────┐
│      MySQL           │          │      MongoDB         │
│   (Active Data)      │          │   (Archive/Logs)     │
│                      │          │                      │
│ - Users              │          │ - Order Logs         │
│ - Businesses         │          │ - Message Logs       │
│ - Orders (active)    │          │ - Analytics          │
│ - Items              │          │                      │
│ - Menus              │          │                      │
└─────────────────────┘          └─────────────────────┘
          │
          ▼
┌─────────────────────┐
│      AWS S3          │
│   (File Storage)     │
│                      │
│ - Menu Images        │
│ - Item Images        │
│ - PDFs               │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│      OpenAI API      │
│   (LLM Service)      │
│                      │
│ - Chat Completion    │
│ - Function Calling   │
└─────────────────────┘
```

---

## Application Structure

### Directory Structure

```
zakaa-api/
├── server.js                 # Entry point, starts Express server
├── src/
│   ├── app.js               # Express app configuration
│   ├── config/              # Configuration files
│   │   ├── database.js      # MySQL/MongoDB connections
│   │   ├── constants.js     # App constants
│   │   └── aws.js           # AWS S3 configuration
│   ├── middleware/          # Express middleware
│   │   ├── auth.js          # JWT authentication
│   │   ├── tenant.js        # Multi-tenant isolation
│   │   ├── premium.js       # Premium feature gating
│   │   ├── security.js      # Security headers
│   │   └── errorHandler.js  # Error handling
│   ├── routes/              # API routes
│   │   ├── api/             # REST API endpoints
│   │   │   ├── auth.js      # Authentication routes
│   │   │   ├── businesses.js # Business CRUD
│   │   │   ├── branches.js  # Branch management
│   │   │   ├── menus.js     # Menu management
│   │   │   ├── items.js     # Item management
│   │   │   ├── orders.js    # Order management
│   │   │   ├── carts.js     # Cart endpoints
│   │   │   └── ...
│   │   └── webhook/         # Webhook handlers
│   │       ├── whatsapp.js  # WhatsApp webhooks
│   │       └── telegram.js  # Telegram webhooks
│   ├── services/            # Business logic services
│   │   ├── llm/             # LLM/AI services
│   │   │   ├── chatbot.js           # Main chatbot service
│   │   │   ├── chatbotFunctions.js  # OpenAI function definitions
│   │   │   ├── conversationManager.js # Conversation flow
│   │   │   ├── cartManager.js       # Cart operations
│   │   │   ├── promptBuilder.js    # LLM prompt construction
│   │   │   ├── languageDetector.js  # Language detection
│   │   │   └── dateTimeParser.js    # Date/time parsing
│   │   ├── whatsapp/        # WhatsApp integration
│   │   │   ├── webhookHandler.js    # Meta WhatsApp webhooks
│   │   │   ├── twilioWebhookHandler.js # Twilio webhooks
│   │   │   ├── messageSender.js     # Message sending
│   │   │   ├── twilioMessageSender.js # Twilio sender
│   │   │   └── contextResolver.js   # Business context resolution
│   │   ├── telegram/        # Telegram integration
│   │   │   ├── telegramWebhookHandler.js
│   │   │   ├── telegramMessageSender.js
│   │   │   └── telegramWebhookSetup.js
│   │   ├── order/           # Order processing
│   │   │   └── orderService.js
│   │   ├── analytics/       # Analytics (premium)
│   │   │   └── analyticsService.js
│   │   └── archive/         # Data archival
│   │       └── archiveService.js
│   ├── repositories/        # Data access layer
│   │   ├── userRepository.js
│   │   ├── orderRepository.js
│   │   ├── itemRepository.js
│   │   ├── menuRepository.js
│   │   ├── branchRepository.js
│   │   └── ...
│   ├── jobs/                # Background jobs
│   │   ├── archiveJob.js    # Archive completed orders
│   │   ├── cartCleanupJob.js # Cleanup old carts
│   │   └── cartTimeoutJob.js # Cart timeout handling
│   └── utils/               # Utility functions
│       ├── logger.js        # Winston logger
│       ├── cache.js         # In-memory cache
│       ├── uuid.js          # UUID generation
│       ├── geoUtils.js      # Geolocation utilities
│       └── ...
├── database/                # Database scripts
│   ├── schema.sql           # Database schema
│   ├── init.js              # Database initialization
│   └── ...
├── frontend/                # React frontend (separate app)
└── package.json
```

---

## Data Flow

### 1. Customer Order Flow (WhatsApp)

```
1. Customer sends WhatsApp message
   ↓
2. WhatsApp → Webhook → /webhook/whatsapp
   ↓
3. Context Resolver identifies business/branch from phone number
   ↓
4. Chatbot Service processes message:
   - Fetches conversation history (MongoDB)
   - Builds prompt with business context (menus, items, hours)
   - Calls OpenAI API with function calling
   ↓
5. OpenAI returns response + function calls (if needed)
   ↓
6. Execute functions (add_item_to_cart, confirm_order, etc.)
   - Cart Manager updates cart (MySQL orders table)
   - Order Service creates order when confirmed
   ↓
7. Response sent back to customer via WhatsApp
   ↓
8. Message logged to MongoDB
```

### 2. Business Dashboard Flow

```
1. Business logs in → POST /api/auth/login
   ↓
2. JWT token issued
   ↓
3. Business makes API calls with JWT:
   - GET /api/orders (view orders)
   - PUT /api/orders/:id/status (update status)
   - GET /api/items (view items)
   - POST /api/items (create item)
   ↓
4. Middleware validates:
   - auth.js: JWT verification
   - tenant.js: Business isolation (filter by business_id)
   ↓
5. Repository layer queries MySQL
   ↓
6. Response returned to frontend
```

### 3. Order Archival Flow

```
1. Archive Job runs daily (cron)
   ↓
2. Finds completed orders older than 24 hours
   ↓
3. Archive Service:
   - Fetches order + order_items + status_history
   - Transforms to MongoDB document
   - Inserts into MongoDB order_logs collection
   ↓
4. Deletes from MySQL orders table
   ↓
5. Analytics can query MongoDB for historical data
```

---

## Multi-Tenancy

### Tenant Isolation Strategy

**Tenant Identifier**: `business_id` (UUID)

**Isolation Methods:**
1. **Database Level**: All queries filter by `business_id`
2. **Middleware**: `tenant.js` middleware ensures `business_id` is set from JWT
3. **Repository Layer**: All repository methods accept `businessId` parameter
4. **Service Layer**: Services validate business ownership before operations

**Example Query Pattern:**
```sql
SELECT * FROM orders 
WHERE business_id = ? AND status = 'accepted'
```

**Branch Isolation:**
- Branches belong to a business (`parent_user_id`)
- Branch data is filtered by both `business_id` and `user_id` (branch)
- Branch hours/policies override business-level settings

---

## Security Architecture

### Authentication Flow

1. **Login**: `POST /api/auth/login`
   - Validates email/password
   - Returns JWT token with `userId` and `businessId`

2. **Token Structure**:
   ```json
   {
     "userId": "uuid",
     "businessId": "uuid",
     "userType": "business",
     "iat": 1234567890,
     "exp": 1234571490
   }
   ```

3. **Authorization**: JWT middleware validates token on protected routes

### Security Measures

1. **Password Hashing**: Bcrypt with salt rounds
2. **JWT Expiration**: Tokens expire after 24 hours
3. **Rate Limiting**: 
   - General API: 100 requests/15min (production)
   - Auth endpoints: 20 requests/15min
4. **CORS**: Configurable origin whitelist
5. **Helmet**: Security headers (XSS protection, etc.)
6. **Input Validation**: express-validator on all inputs
7. **SQL Injection Prevention**: Parameterized queries only
8. **WhatsApp Webhook Verification**: Signature validation for Meta webhooks

---

## Caching Strategy

### Cache Implementation
- **Type**: In-memory cache (Node.js Map)
- **TTL**: Configurable per cache key
- **Use Cases**:
  - Menu items (5 minutes)
  - Business context (1 minute)
  - Opening hours (5 minutes)

### Cache Invalidation
- Menu items: Invalidated when items are added/updated
- Business context: Invalidated when business settings change
- Cart changes: Menu cache invalidated (items might be out of stock)

---

## Background Jobs

### 1. Archive Job (`archiveJob.js`)
- **Schedule**: Daily at 2 AM
- **Purpose**: Move completed orders to MongoDB
- **Criteria**: Orders with `status='completed'` and `completed_at < 24 hours ago`

### 2. Cart Cleanup Job (`cartCleanupJob.js`)
- **Schedule**: Every 6 hours
- **Purpose**: Delete old abandoned carts
- **Criteria**: Carts (`status='cart'`) older than 7 days

### 3. Cart Timeout Job (`cartTimeoutJob.js`)
- **Schedule**: Every 5 minutes
- **Purpose**: Handle cart timeouts and notifications
- **Actions**: 
  - Warn customers if cart is idle for 30 minutes
  - Clear cart if idle for 1 hour

---

## API Architecture

### REST API Endpoints

**Authentication:**
- `POST /api/auth/register` - Business registration
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

**Businesses:**
- `GET /api/businesses/me` - Get current business
- `PUT /api/businesses/me` - Update business
- `POST /api/businesses/me/whatsapp` - Connect WhatsApp

**Branches:**
- `GET /api/branches` - List branches
- `POST /api/branches` - Create branch
- `PUT /api/branches/:id` - Update branch
- `DELETE /api/branches/:id` - Delete branch

**Menus:**
- `GET /api/menus` - List menus
- `POST /api/menus` - Create menu
- `PUT /api/menus/:id` - Update menu
- `DELETE /api/menus/:id` - Delete menu
- `POST /api/menus/:id/image` - Upload menu image

**Items:**
- `GET /api/items` - List items
- `POST /api/items` - Create item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `POST /api/items/:id/image` - Upload item image

**Orders:**
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status
- `POST /api/orders` - Create manual order

**Carts:**
- `GET /api/carts` - Get cart
- `POST /api/carts/items` - Add item to cart
- `DELETE /api/carts/items/:itemId` - Remove item
- `PUT /api/carts` - Update cart

**Analytics (Premium):**
- `GET /api/analytics/revenue` - Revenue analytics
- `GET /api/analytics/items` - Top items
- `GET /api/analytics/customers` - Customer analytics

### Webhook Endpoints

**WhatsApp:**
- `POST /webhook/whatsapp` - Meta WhatsApp webhooks
- `GET /webhook/whatsapp` - Webhook verification

**Telegram:**
- `POST /webhook/telegram` - Telegram webhooks

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Error Types
- **Validation Errors**: 400 Bad Request
- **Authentication Errors**: 401 Unauthorized
- **Authorization Errors**: 403 Forbidden
- **Not Found**: 404 Not Found
- **Server Errors**: 500 Internal Server Error

### Logging
- All errors logged with Winston
- Includes stack traces, request context, user info
- Log levels: error, warn, info, debug

---

## Deployment Architecture

### Production Setup
- **Server**: EC2 instance or similar
- **Database**: RDS MySQL (or self-hosted)
- **Storage**: S3 bucket for images
- **Reverse Proxy**: Nginx (load balancing, SSL termination)
- **Process Manager**: PM2 (process management, auto-restart)
- **Monitoring**: Winston logs + optional APM

### Environment Variables
- `NODE_ENV`: production/development
- `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_DATABASE`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- `TELEGRAM_BOT_TOKEN`

---

## Scalability Considerations

### Horizontal Scaling
- Stateless API servers (can run multiple instances)
- Load balancer distributes requests
- Shared MySQL database (connection pooling)
- Shared S3 storage

### Database Scaling
- MySQL read replicas for analytics queries
- MongoDB sharding for large archives
- Connection pooling limits connections per instance

### Caching
- Redis (future): Distributed cache for multi-instance deployments
- Current: In-memory cache (per-instance)

### Message Queue (Future)
- RabbitMQ/Redis Queue for async processing
- Webhook processing, order notifications, etc.

---

## Monitoring and Observability

### Logging
- **Winston**: Structured logging with levels
- **Log Files**: Rotated daily, kept for 30 days
- **Log Levels**: error, warn, info, debug

### Health Checks
- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity
- `GET /health/s3` - S3 connectivity
- `GET /health/openai` - OpenAI API connectivity

### Metrics (Future)
- Request rate, response times
- Database query performance
- OpenAI API usage/costs
- Order processing metrics

---

## Integration Points

### External Services

1. **OpenAI API**
   - Endpoint: `https://api.openai.com/v1/chat/completions`
   - Authentication: API key in header
   - Rate Limits: Handled by OpenAI SDK

2. **Meta WhatsApp Business API**
   - Webhook URL: `https://your-domain.com/webhook/whatsapp`
   - Authentication: Access token + signature verification
   - Rate Limits: Per conversation window

3. **Telegram Bot API**
   - Webhook URL: `https://your-domain.com/webhook/telegram`
   - Authentication: Bot token
   - Rate Limits: 30 messages/second

4. **AWS S3**
   - Bucket: Configurable per environment
   - Folders: `businesses/{businessId}/menus/`, `businesses/{businessId}/items/`
   - CORS: Enabled for frontend access

---

## Data Consistency

### Transaction Management
- MySQL transactions for multi-step operations (order creation, cart updates)
- MongoDB: Eventually consistent (archive operations)

### Eventual Consistency
- Order archival: Small delay (24 hours) before MongoDB sync
- Cache invalidation: Immediate on updates

### Data Integrity
- Foreign key constraints in MySQL
- Soft deletes: `deleted_at` timestamp instead of hard deletes
- Price snapshots: Historical prices preserved in `order_items`

---

## Future Enhancements

### Planned Features
1. **Redis Cache**: Distributed caching
2. **Message Queue**: Async job processing
3. **Real-time Updates**: WebSocket for order status
4. **Payment Integration**: Stripe/PayPal
5. **SMS Notifications**: Twilio SMS for order updates
6. **Multi-language Support**: i18n for dashboard
7. **Advanced Analytics**: Machine learning insights
8. **Mobile App**: React Native app for businesses

### Technical Debt
1. Remove deprecated `branch_id` columns
2. Migrate from in-memory cache to Redis
3. Add comprehensive test coverage
4. API versioning strategy
5. GraphQL API option

---

## Summary

Zakaa is a **multi-tenant, WhatsApp-first ordering platform** with:
- **Hybrid database**: MySQL for active data, MongoDB for archives
- **AI-powered**: OpenAI for conversational order taking
- **Multi-channel**: WhatsApp, Telegram support
- **Scalable**: Stateless API, connection pooling, caching
- **Secure**: JWT auth, tenant isolation, rate limiting
- **Observable**: Structured logging, health checks

The architecture supports horizontal scaling, graceful degradation (MongoDB optional), and maintains data consistency through transactions and soft deletes.
