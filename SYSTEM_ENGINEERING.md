# Zakaa System Engineering - Function Documentation

## Overview

This document provides a complete catalog of all functions in the Zakaa system, organized by module/service, with descriptions of what each function does.

---

## Table of Contents

1. [LLM Services](#llm-services)
2. [Cart Management](#cart-management)
3. [Order Services](#order-services)
4. [Conversation Management](#conversation-management)
5. [WhatsApp Services](#whatsapp-services)
6. [Telegram Services](#telegram-services)
7. [Repositories](#repositories)
8. [API Routes](#api-routes)
9. [Middleware](#middleware)
10. [Utilities](#utilities)
11. [Background Jobs](#background-jobs)
12. [Configuration](#configuration)

---

## LLM Services

### `src/services/llm/chatbot.js`

#### `reinitializeOpenAIClient()`
- **Purpose**: Reinitializes the OpenAI client with a new API key
- **Usage**: Called when API key changes dynamically
- **Returns**: void

#### `sanitizeResponse(text)`
- **Purpose**: Sanitizes LLM response before sending to WhatsApp
- **Parameters**: 
  - `text` (string): Raw LLM response
- **Returns**: Sanitized string
- **Features**:
  - Removes S3 URLs (should be sent as media, not links)
  - Truncates to 4096 characters (WhatsApp limit)
  - Removes HTML/script tags
  - Cleans excessive whitespace

#### `getConversationHistory(businessId, branchId, customerPhoneNumber, currentMessage, limit)`
- **Purpose**: Retrieves conversation history from MongoDB
- **Parameters**:
  - `businessId` (string): Business UUID
  - `branchId` (string): Branch UUID (optional)
  - `customerPhoneNumber` (string): Customer phone number
  - `currentMessage` (string): Current message text
  - `limit` (number): Max messages to retrieve (default: 50)
- **Returns**: Array of message objects
- **Features**:
  - Resets history if customer requests fresh start
  - Resets history if last message was >3 hours ago
  - Returns empty array if MongoDB unavailable (graceful degradation)

#### `handleMessage({ business, branch, customerPhoneNumber, message, messageType, messageId, whatsappUserId })`
- **Purpose**: Main entry point for processing customer messages
- **Parameters**: Object with business, branch, customer info, and message
- **Returns**: Object with response text, images, PDFs, etc.
- **Flow**:
  1. Detects language
  2. Gets conversation history
  3. Builds prompt with business context
  4. Calls OpenAI API
  5. Executes function calls if needed
  6. Processes order confirmation if ready
  7. Logs message to MongoDB
  8. Returns formatted response

---

### `src/services/llm/chatbotFunctions.js`

#### `getAvailableFunctions()`
- **Purpose**: Returns array of function definitions for OpenAI function calling
- **Returns**: Array of function schema objects
- **Functions Defined**:
  - `add_item_to_cart`: Add item to cart
  - `remove_item_from_cart`: Remove item from cart
  - `update_item_quantity`: Update item quantity
  - `get_cart`: Get current cart contents
  - `clear_cart`: Clear entire cart
  - `update_delivery_type`: Set delivery type (takeaway/delivery/on_site)
  - `set_delivery_address`: Set delivery address text
  - `set_location`: Set GPS coordinates
  - `set_scheduled_time`: Schedule order for future time
  - `confirm_order`: Confirm and place order
  - `cancel_scheduled_order`: Cancel scheduled order
  - `get_my_orders`: Get customer's accepted orders
  - `cancel_accepted_order`: Cancel accepted scheduled order
  - `get_menu_items`: Get menu items/images/PDFs
  - `send_item_image`: Send item image
  - `send_menu_pdf`: Send menu PDF
  - `send_menu_image`: Send menu images
  - `get_opening_hours`: Get opening hours
  - `get_closing_time`: Check if open/closed now
  - `get_next_opening_time`: Get next opening time
  - `set_order_notes`: Add special instructions

#### `executeFunction(functionName, args, context)`
- **Purpose**: Executes a function call from OpenAI
- **Parameters**:
  - `functionName` (string): Name of function to execute
  - `args` (object): Function arguments
  - `context` (object): Business, branch, customer context
- **Returns**: Object with `success`, `message`, and function-specific data
- **Features**:
  - Validates inputs
  - Updates database via cartManager/orderService
  - Returns structured responses for LLM
  - Handles errors gracefully

---

### `src/services/llm/promptBuilder.js`

#### `buildPrompt({ business, branch, customerPhoneNumber, message, language, messageHistory, isFirstMessage })`
- **Purpose**: Builds structured prompt for OpenAI with business context
- **Parameters**: Business context, message, history
- **Returns**: String prompt
- **Includes**:
  - Business information (name, type, description)
  - Menu items with prices
  - Current cart contents
  - Opening hours
  - Policies
  - Current open/closed status
  - Conversation history
  - Instructions for chatbot behavior
  - Available functions list

---

### `src/services/llm/languageDetector.js`

#### `detectLanguage(text)`
- **Purpose**: Detects language of customer message
- **Parameters**: `text` (string)
- **Returns**: Language code ('arabic', 'arabizi', 'english', 'french')
- **Method**: Pattern matching for common words/phrases

---

### `src/services/llm/dateTimeParser.js`

#### `parseDateTime(text, timezone, openingHours)`
- **Purpose**: Parses natural language date/time expressions
- **Parameters**:
  - `text` (string): Natural language time (e.g., "tomorrow 7pm")
  - `timezone` (string): Business timezone
  - `openingHours` (array): Opening hours for validation
- **Returns**: Date object or null
- **Supports**: "tomorrow", "Friday", "in 2 hours", relative dates, etc.

#### `validateMinScheduleTime(scheduledDate, minScheduleHours)`
- **Purpose**: Validates minimum scheduling time requirement
- **Parameters**:
  - `scheduledDate` (Date): Proposed scheduled time
  - `minScheduleHours` (number): Minimum hours in advance
- **Returns**: Object with `valid` (boolean) and `message` (string)

#### `formatDate(date, language)`
- **Purpose**: Formats date for display in customer's language
- **Parameters**:
  - `date` (Date): Date to format
  - `language` (string): Language code
- **Returns**: Formatted date string

---

## Cart Management

### `src/services/llm/cartManager.js`

#### `getCart(businessId, branchId, customerPhoneNumber)`
- **Purpose**: Gets or creates cart for customer
- **Parameters**: Business ID, branch ID, customer phone number
- **Returns**: Cart object with items, totals, delivery info
- **Features**:
  - Finds existing cart (status='cart', notes='__cart__')
  - Creates new cart if none exists
  - Handles branch resolution automatically
  - Returns formatted cart with item details

#### `updateCart(businessId, branchId, customerPhoneNumber, updates)`
- **Purpose**: Updates cart metadata (delivery type, address, scheduled time, etc.)
- **Parameters**: Business/branch/customer IDs, updates object
- **Returns**: Updated cart object
- **Updates**: delivery_type, location_*, scheduled_for, notes, etc.

#### `addItemToCart(businessId, branchId, customerPhoneNumber, item)`
- **Purpose**: Adds item to cart or increments quantity
- **Parameters**: Business/branch/customer IDs, item object
- **Returns**: Updated cart object
- **Features**:
  - Checks if item already in cart (increments quantity)
  - Adds new item if not present
  - Recalculates subtotal and total
  - Updates order_items table

#### `removeItemFromCart(businessId, branchId, customerPhoneNumber, itemId)`
- **Purpose**: Removes item from cart
- **Parameters**: Business/branch/customer IDs, item ID
- **Returns**: Updated cart object
- **Features**: Deletes order_items row, recalculates totals

#### `updateItemQuantity(businessId, branchId, customerPhoneNumber, itemId, quantity)`
- **Purpose**: Updates quantity of item in cart
- **Parameters**: Business/branch/customer IDs, item ID, new quantity
- **Returns**: Updated cart object
- **Features**: Updates quantity, removes if quantity=0, recalculates totals

#### `clearCart(businessId, branchId, customerPhoneNumber)`
- **Purpose**: Clears all items from cart
- **Parameters**: Business/branch/customer IDs
- **Returns**: Empty cart object
- **Features**: Deletes all order_items, resets totals, preserves cart order

#### `confirmCart(businessId, branchId, customerPhoneNumber)`
- **Purpose**: Confirms cart and converts to order
- **Parameters**: Business/branch/customer IDs
- **Returns**: Order object
- **Features**:
  - Validates cart has items
  - Validates delivery type is set
  - Validates address if delivery
  - Changes status from 'cart' to 'accepted'
  - Removes cart marker from notes
  - Creates order status history entry

#### `completeCart(businessId, branchId, customerPhoneNumber)`
- **Purpose**: Marks cart as completed (internal use)
- **Parameters**: Business/branch/customer IDs
- **Returns**: Updated cart/order object

#### `getCartSummary(cart)`
- **Purpose**: Generates human-readable cart summary
- **Parameters**: Cart object
- **Returns**: Formatted string with items, quantities, prices, totals

---

## Order Services

### `src/services/order/orderService.js`

#### `createOrder(orderData)`
- **Purpose**: Creates order from cart or manual input
- **Parameters**: Order data object
- **Returns**: Created order object
- **Features**:
  - Validates branch/user
  - Validates items (availability, branch-specific)
  - Calculates subtotal and total
  - Determines initial status (accepted/ongoing based on scheduled_for)
  - Creates order and order_items
  - Creates status history entry

#### `updateOrderStatus(orderId, businessId, status, changedBy)`
- **Purpose**: Updates order status with validation
- **Parameters**: Order ID, business ID, new status, who changed it
- **Returns**: Updated order object
- **Features**:
  - Validates status transitions
  - Prevents invalid transitions
  - Creates status history entry
  - Updates completed_at/cancelled_at timestamps
  - Increments times_delivered if completed

---

## Conversation Management

### `src/services/llm/conversationManager.js`

#### `isOpenNow(businessId, branchId)`
- **Purpose**: Checks if business/branch is currently open
- **Parameters**: Business ID, branch ID
- **Returns**: Object with:
  - `isOpen` (boolean): Can accept immediate orders
  - `isWithinOpeningHours` (boolean): Between open and close
  - `lastOrderTimePassed` (boolean): Past last order time
  - `minutesUntilLastOrder` (number|null): Minutes until last order
  - `lastOrderTime` (string|null): HH:MM format
  - `reason` (string): Human-readable reason
- **Features**:
  - Checks branch hours first, falls back to business hours
  - Considers timezone
  - Accounts for last_order_before_closing_minutes
  - Returns detailed status information

#### `getAvailableTimeSlots(businessId, branchId, date)`
- **Purpose**: Gets available time slots for scheduling
- **Parameters**: Business ID, branch ID, date
- **Returns**: Object with available slots or error
- **Features**: Generates 30-minute slots within opening hours

#### `generateTimeSlots(startTime, endTime)`
- **Purpose**: Generates array of time slots
- **Parameters**: Start time, end time (HH:MM format)
- **Returns**: Array of time strings

#### `timeToMinutes(timeString)`
- **Purpose**: Converts time string to minutes since midnight
- **Parameters**: Time string (HH:MM)
- **Returns**: Number of minutes

#### `getOpeningHoursForDay(businessId, branchId, dayOfWeek)`
- **Purpose**: Gets opening hours for specific day
- **Parameters**: Business ID, branch ID, day of week
- **Returns**: Opening hours object or null

#### `getAllOpeningHours(businessId, branchId)`
- **Purpose**: Gets all opening hours for business/branch
- **Parameters**: Business ID, branch ID
- **Returns**: Array of opening hours objects

#### `getNextOpeningTime(businessId, branchId)`
- **Purpose**: Gets next time business will be open
- **Parameters**: Business ID, branch ID
- **Returns**: Object with next opening time and day

#### `processChatbotResponse({ business, branch, customerPhoneNumber, response, functionCalls, messageHistory })`
- **Purpose**: Processes chatbot response and handles function calls
- **Parameters**: Business context, OpenAI response, function calls, history
- **Returns**: Processed response object
- **Features**:
  - Executes function calls in sequence
  - Handles order confirmation
  - Formats response for WhatsApp
  - Manages images/PDFs/media

---

## WhatsApp Services

### `src/services/whatsapp/webhookHandler.js`

#### `processWebhook(webhookData)`
- **Purpose**: Processes incoming WhatsApp webhook from Meta
- **Parameters**: Webhook data object
- **Returns**: void
- **Features**:
  - Verifies webhook signature
  - Handles different webhook types (messages, status updates)
  - Processes messages
  - Logs webhook events

#### `processMessage(message, value)`
- **Purpose**: Processes individual WhatsApp message
- **Parameters**: Message object, webhook value object
- **Returns**: void
- **Features**:
  - Resolves business/branch context
  - Extracts customer phone number
  - Calls chatbot service
  - Sends response via WhatsApp
  - Handles images, locations, etc.

#### `logMessage(messageData)`
- **Purpose**: Logs message to MongoDB
- **Parameters**: Message data object
- **Returns**: void
- **Features**: Stores message in message_logs collection

---

### `src/services/whatsapp/twilioWebhookHandler.js`

#### `processTwilioWebhook(req)`
- **Purpose**: Processes incoming Twilio WhatsApp webhook
- **Parameters**: Express request object
- **Returns**: void
- **Features**:
  - Parses Twilio webhook format
  - Resolves business context from phone number
  - Processes message
  - Sends response via Twilio

#### `logMessage(messageData)`
- **Purpose**: Logs Twilio message to MongoDB
- **Parameters**: Message data object
- **Returns**: void

---

### `src/services/whatsapp/messageSender.js`

#### `sendMessage(business, branch, customerPhoneNumber, message, options)`
- **Purpose**: Sends WhatsApp message via Meta API
- **Parameters**: Business, branch, customer phone, message, options
- **Returns**: Message ID
- **Features**:
  - Uses Meta WhatsApp Business API
  - Handles text, images, PDFs
  - Manages conversation windows
  - Error handling and retries

---

### `src/services/whatsapp/twilioMessageSender.js`

#### `sendMessage(business, branch, customerPhoneNumber, message, options)`
- **Purpose**: Sends WhatsApp message via Twilio
- **Parameters**: Business, branch, customer phone, message, options
- **Returns**: Message SID
- **Features**: Twilio-specific message sending

---

### `src/services/whatsapp/contextResolver.js`

#### `resolveContext(phoneNumberId)`
- **Purpose**: Resolves business/branch from WhatsApp phone number ID
- **Parameters**: Phone number ID
- **Returns**: Object with `business` and `branch` or null
- **Features**:
  - Checks branches first
  - Falls back to business
  - Decrypts WhatsApp tokens
  - Handles single vs multiple branches

#### `resolveContextFromTwilioNumber(twilioNumber, accountSid)`
- **Purpose**: Resolves business/branch from Twilio phone number
- **Parameters**: Twilio number, account SID (optional)
- **Returns**: Object with `business` and `branch` or null

---

## Telegram Services

### `src/services/telegram/telegramWebhookHandler.js`

#### `processTelegramUpdate(update, businessId)`
- **Purpose**: Processes incoming Telegram update
- **Parameters**: Telegram update object, business ID (optional)
- **Returns**: void
- **Features**: Routes to message or callback query handler

#### `processMessage(message, businessId)`
- **Purpose**: Processes Telegram message
- **Parameters**: Telegram message object, business ID
- **Returns**: void
- **Features**: Similar to WhatsApp message processing

#### `processCallbackQuery(callbackQuery, businessId)`
- **Purpose**: Processes Telegram callback queries (button clicks)
- **Parameters**: Callback query object, business ID
- **Returns**: void

#### `resolveBusinessFromTelegram(businessId)`
- **Purpose**: Resolves business from Telegram bot token
- **Parameters**: Business ID
- **Returns**: Business object or null

#### `logMessage(messageData)`
- **Purpose**: Logs Telegram message to MongoDB
- **Parameters**: Message data object
- **Returns**: void

---

### `src/services/telegram/telegramMessageSender.js`

#### `sendMessage(business, branch, chatId, message, options)`
- **Purpose**: Sends Telegram message
- **Parameters**: Business, branch, chat ID, message, options
- **Returns**: Message object
- **Features**: Uses Telegram Bot API

---

## Repositories

### `src/repositories/userRepository.js`

#### `findById(userId)`
- **Purpose**: Finds user by ID
- **Returns**: User object or null

#### `findByEmail(email)`
- **Purpose**: Finds user by email
- **Returns**: User object or null

#### `findByWhatsAppPhoneId(whatsappPhoneNumberId)`
- **Purpose**: Finds user by WhatsApp phone number ID
- **Returns**: User object or null

#### `create(userData)`
- **Purpose**: Creates new user
- **Returns**: Created user object (without password)

#### `update(userId, updateData)`
- **Purpose**: Updates user
- **Returns**: Updated user object

#### `updatePassword(userId, newPassword)`
- **Purpose**: Updates user password
- **Returns**: void

#### `verifyPassword(userId, password)`
- **Purpose**: Verifies user password
- **Returns**: Boolean

#### `verifyPasswordByEmail(email, password)`
- **Purpose**: Verifies password by email
- **Returns**: Boolean

#### `softDelete(userId)`
- **Purpose**: Soft deletes user (sets deleted_at)
- **Returns**: void

#### `findBranchesByParent(parentUserId)`
- **Purpose**: Finds all branches for a business
- **Returns**: Array of branch objects

#### `createBranchUser(parentUserId, branchData)`
- **Purpose**: Creates branch user
- **Returns**: Created branch object

#### `createBranch(parentUserId, branchData)`
- **Purpose**: Creates branch (legacy, uses createBranchUser)
- **Returns**: Created branch object

#### `isBranch(userId)`
- **Purpose**: Checks if user is a branch
- **Returns**: Boolean

#### `getParentBusiness(userId)`
- **Purpose**: Gets parent business for branch
- **Returns**: Business object or null

---

### `src/repositories/orderRepository.js`

#### `findById(orderId, businessId)`
- **Purpose**: Finds order by ID
- **Returns**: Order object with branch info or null

#### `find(filters)`
- **Purpose**: Finds orders with filters
- **Parameters**: Filters object (businessId, status, dates, etc.)
- **Returns**: Array of order objects

#### `getOrderItems(orderId)`
- **Purpose**: Gets items for an order
- **Returns**: Array of order item objects

#### `getStatusHistory(orderId)`
- **Purpose**: Gets status change history for order
- **Returns**: Array of status history objects

#### `create(orderData)`
- **Purpose**: Creates new order
- **Returns**: Created order object

#### `updateStatus(orderId, businessId, status, changedBy)`
- **Purpose**: Updates order status
- **Returns**: Updated order object

#### `updateDeliveryPrice(orderId, businessId, deliveryPrice)`
- **Purpose**: Updates delivery price
- **Returns**: Updated order object

#### `findOrdersToArchive()`
- **Purpose**: Finds completed orders ready for archival
- **Returns**: Array of order objects

---

### `src/repositories/itemRepository.js`

#### `findById(itemId, businessId)`
- **Purpose**: Finds item by ID
- **Returns**: Item object or null

#### `find(businessId, filters)`
- **Purpose**: Finds items with filters
- **Returns**: Array of item objects

#### `create(itemData)`
- **Purpose**: Creates new item
- **Returns**: Created item object

#### `update(itemId, businessId, updateData)`
- **Purpose**: Updates item
- **Returns**: Updated item object

#### `softDelete(itemId, businessId)`
- **Purpose**: Soft deletes item
- **Returns**: void

---

### `src/repositories/menuRepository.js`

#### `findById(menuId, businessId)`
- **Purpose**: Finds menu by ID
- **Returns**: Menu object or null

#### `find(businessId)`
- **Purpose**: Finds all menus for business
- **Returns**: Array of menu objects

#### `create(menuData)`
- **Purpose**: Creates new menu
- **Returns**: Created menu object

#### `update(menuId, businessId, updateData)`
- **Purpose**: Updates menu
- **Returns**: Updated menu object

#### `softDelete(menuId, businessId)`
- **Purpose**: Soft deletes menu
- **Returns**: void

---

### `src/repositories/branchRepository.js`

#### `findById(branchId, businessId)`
- **Purpose**: Finds branch by ID
- **Returns**: Branch object or null

#### `findByBusinessId(businessId)`
- **Purpose**: Finds all branches for business
- **Returns**: Array of branch objects

#### `findByWhatsAppPhoneId(phoneNumberId)`
- **Purpose**: Finds branch by WhatsApp phone number ID
- **Returns**: Branch object or null

---

### `src/repositories/openingHoursRepository.js`

#### `findByOwner(ownerType, ownerId)`
- **Purpose**: Finds opening hours for owner
- **Returns**: Array of opening hours objects

#### `upsert(ownerType, ownerId, hoursData)`
- **Purpose**: Creates or updates opening hours
- **Returns**: Array of opening hours objects

#### `deleteByOwner(ownerType, ownerId)`
- **Purpose**: Deletes all opening hours for owner
- **Returns**: void

---

## API Routes

### `src/routes/api/auth.js`

#### `POST /api/auth/register`
- **Purpose**: Business registration
- **Handler**: Creates new business user
- **Returns**: User object and JWT token

#### `POST /api/auth/login`
- **Purpose**: User login
- **Handler**: Validates credentials, returns JWT
- **Returns**: User object and JWT token

#### `POST /api/auth/refresh`
- **Purpose**: Refresh JWT token
- **Handler**: Validates current token, issues new one
- **Returns**: New JWT token

---

### `src/routes/api/businesses.js`

#### `GET /api/businesses/me`
- **Purpose**: Get current business profile
- **Handler**: Returns authenticated business data
- **Auth**: Required

#### `PUT /api/businesses/me`
- **Purpose**: Update business profile
- **Handler**: Updates business fields
- **Auth**: Required

#### `POST /api/businesses/me/whatsapp`
- **Purpose**: Connect WhatsApp Business account
- **Handler**: Stores WhatsApp credentials
- **Auth**: Required

---

### `src/routes/api/orders.js`

#### `GET /api/orders`
- **Purpose**: List orders
- **Handler**: Returns filtered orders for business
- **Query Params**: status, startDate, endDate, limit, offset
- **Auth**: Required

#### `GET /api/orders/:id`
- **Purpose**: Get order details
- **Handler**: Returns order with items and history
- **Auth**: Required

#### `PUT /api/orders/:id/status`
- **Purpose**: Update order status
- **Handler**: Updates status via orderService
- **Auth**: Required

#### `POST /api/orders`
- **Purpose**: Create manual order
- **Handler**: Creates order from dashboard
- **Auth**: Required

---

### `src/routes/api/items.js`

#### `GET /api/items`
- **Purpose**: List items
- **Handler**: Returns items for business
- **Query Params**: menuId, availability
- **Auth**: Required

#### `POST /api/items`
- **Purpose**: Create item
- **Handler**: Creates item, uploads image to S3
- **Auth**: Required

#### `PUT /api/items/:id`
- **Purpose**: Update item
- **Handler**: Updates item fields
- **Auth**: Required

#### `DELETE /api/items/:id`
- **Purpose**: Delete item
- **Handler**: Soft deletes item
- **Auth**: Required

#### `POST /api/items/:id/image`
- **Purpose**: Upload item image
- **Handler**: Uploads to S3, updates item_image_url
- **Auth**: Required

---

### `src/routes/api/menus.js`

#### `GET /api/menus`
- **Purpose**: List menus
- **Handler**: Returns menus for business
- **Auth**: Required

#### `POST /api/menus`
- **Purpose**: Create menu
- **Handler**: Creates menu
- **Auth**: Required

#### `PUT /api/menus/:id`
- **Purpose**: Update menu
- **Handler**: Updates menu fields
- **Auth**: Required

#### `DELETE /api/menus/:id`
- **Purpose**: Delete menu
- **Handler**: Soft deletes menu
- **Auth**: Required

#### `POST /api/menus/:id/image`
- **Purpose**: Upload menu image(s)
- **Handler**: Uploads to S3, updates menu_image_urls
- **Auth**: Required

#### `POST /api/menus/:id/pdf`
- **Purpose**: Upload menu PDF
- **Handler**: Uploads to S3, updates menu_pdf_url
- **Auth**: Required

---

### `src/routes/api/carts.js`

#### `GET /api/carts`
- **Purpose**: Get cart
- **Handler**: Returns current cart for customer
- **Query Params**: customerPhoneNumber
- **Auth**: Required

#### `POST /api/carts/items`
- **Purpose**: Add item to cart
- **Handler**: Adds item via cartManager
- **Auth**: Required

#### `DELETE /api/carts/items/:itemId`
- **Purpose**: Remove item from cart
- **Handler**: Removes item via cartManager
- **Auth**: Required

#### `PUT /api/carts`
- **Purpose**: Update cart
- **Handler**: Updates cart metadata
- **Auth**: Required

---

### `src/routes/api/analytics.js` (Premium Only)

#### `GET /api/analytics/revenue`
- **Purpose**: Revenue analytics
- **Handler**: Queries MongoDB for revenue data
- **Query Params**: period (daily/weekly/monthly)
- **Auth**: Required, Premium

#### `GET /api/analytics/items`
- **Purpose**: Top items analytics
- **Handler**: Returns top selling items
- **Auth**: Required, Premium

#### `GET /api/analytics/customers`
- **Purpose**: Customer analytics
- **Handler**: Returns customer statistics
- **Auth**: Required, Premium

---

## Middleware

### `src/middleware/auth.js`

#### `authenticate(req, res, next)`
- **Purpose**: Validates JWT token
- **Sets**: `req.user`, `req.businessId`
- **Error**: 401 if invalid/missing token

---

### `src/middleware/tenant.js`

#### `setTenant(req, res, next)`
- **Purpose**: Sets tenant context from JWT
- **Sets**: `req.businessId` for all queries
- **Ensures**: Tenant isolation

---

### `src/middleware/premium.js`

#### `requirePremium(req, res, next)`
- **Purpose**: Checks if business has premium subscription
- **Error**: 403 if not premium
- **Usage**: Gates premium features

---

### `src/middleware/security.js`

#### `secureHeaders(req, res, next)`
- **Purpose**: Sets security headers
- **Headers**: X-Content-Type-Options, X-Frame-Options, etc.

---

### `src/middleware/errorHandler.js`

#### `errorHandler(err, req, res, next)`
- **Purpose**: Global error handler
- **Returns**: Formatted error response
- **Logs**: Errors to Winston

#### `notFoundHandler(req, res, next)`
- **Purpose**: 404 handler
- **Returns**: Not found error

---

## Utilities

### `src/utils/logger.js`

#### `logger.info(message, meta)`
- **Purpose**: Logs info message
- **Output**: Console + log files

#### `logger.error(message, meta)`
- **Purpose**: Logs error message
- **Output**: Console + log files + error file

#### `logger.warn(message, meta)`
- **Purpose**: Logs warning message

#### `logger.debug(message, meta)`
- **Purpose**: Logs debug message (development only)

---

### `src/utils/cache.js`

#### `cache.get(key)`
- **Purpose**: Gets cached value
- **Returns**: Cached value or null

#### `cache.set(key, value, ttl)`
- **Purpose**: Sets cached value with TTL
- **Parameters**: Key, value, TTL in milliseconds

#### `cache.delete(key)`
- **Purpose**: Deletes cached value

#### `cache.clear()`
- **Purpose**: Clears all cache

---

### `src/utils/uuid.js`

#### `generateUUID()`
- **Purpose**: Generates UUID v4
- **Returns**: UUID string

---

### `src/utils/geoUtils.js`

#### `validateCoordinates(latitude, longitude)`
- **Purpose**: Validates GPS coordinates
- **Returns**: Boolean

#### `isWithinDeliveryRadius(customerLat, customerLon, businessLat, businessLon, radiusKm)`
- **Purpose**: Checks if customer is within delivery radius
- **Returns**: Object with `withinRadius` (boolean) and `distance` (number)

#### `calculateDistance(lat1, lon1, lat2, lon2)`
- **Purpose**: Calculates distance between two points (Haversine formula)
- **Returns**: Distance in kilometers

---

### `src/utils/rateLimiter.js`

#### `rateLimit(options)`
- **Purpose**: Creates rate limiter middleware
- **Options**: windowMs, max requests
- **Returns**: Express middleware

---

### `src/utils/webhookSignature.js`

#### `verifyWebhookSignature(signature, payload, secret)`
- **Purpose**: Verifies WhatsApp webhook signature
- **Returns**: Boolean

---

## Background Jobs

### `src/jobs/archiveJob.js`

#### `startArchiveJob()`
- **Purpose**: Starts archive job scheduler
- **Schedule**: Daily at 2 AM
- **Action**: Archives completed orders to MongoDB

#### `archiveOrders()`
- **Purpose**: Archives orders older than 24 hours
- **Process**:
  1. Finds completed orders
  2. Fetches order + items + history
  3. Inserts into MongoDB
  4. Deletes from MySQL

---

### `src/jobs/cartCleanupJob.js`

#### `startCartCleanupJob()`
- **Purpose**: Starts cart cleanup scheduler
- **Schedule**: Every 6 hours
- **Action**: Deletes abandoned carts older than 7 days

#### `cleanupOldCarts()`
- **Purpose**: Deletes old carts
- **Criteria**: status='cart', created_at < 7 days ago

---

### `src/jobs/cartTimeoutJob.js`

#### `start()`
- **Purpose**: Starts cart timeout job
- **Schedule**: Every 5 minutes
- **Actions**:
  - Warns customers if cart idle 30 minutes
  - Clears cart if idle 1 hour

#### `checkCartTimeouts()`
- **Purpose**: Checks and handles cart timeouts
- **Process**: Finds idle carts, sends warnings, clears if needed

---

## Configuration

### `src/config/database.js`

#### `getMySQLConnection()`
- **Purpose**: Gets MySQL connection from pool
- **Returns**: Connection object

#### `queryMySQL(sql, params)`
- **Purpose**: Executes MySQL query
- **Returns**: Query results

#### `getMySQLPool()`
- **Purpose**: Gets MySQL connection pool
- **Returns**: Pool object

#### `connectMongoDB()`
- **Purpose**: Connects to MongoDB
- **Returns**: Client and database objects

#### `getMongoDB()`
- **Purpose**: Gets MongoDB database instance
- **Returns**: Database object or null (if unavailable)

#### `getMongoCollection(collectionName)`
- **Purpose**: Gets MongoDB collection
- **Returns**: Collection object or null

#### `closeConnections()`
- **Purpose**: Closes all database connections
- **Usage**: Graceful shutdown

---

### `src/config/constants.js`

#### Exports application constants:
- `PORT`: Server port
- `NODE_ENV`: Environment
- `API_BASE_URL`: API base URL
- `OPENAI_API_KEY`: OpenAI API key
- `JWT_SECRET`: JWT secret
- `MYSQL_*`: MySQL connection config
- `MONGODB_*`: MongoDB connection config
- `AWS_*`: AWS S3 config

---

### `src/config/aws.js`

#### `uploadToS3(fileBuffer, fileName, mimetype, folder, businessId)`
- **Purpose**: Uploads file to S3
- **Returns**: S3 URL
- **Features**: Organizes by business folder

#### `deleteFromS3(key)`
- **Purpose**: Deletes file from S3
- **Returns**: void

#### `extractKeyFromUrl(url)`
- **Purpose**: Extracts S3 key from URL
- **Returns**: S3 key string

---

## Summary

The Zakaa system consists of:

- **~150+ functions** across services, repositories, routes, and utilities
- **Modular architecture** with clear separation of concerns
- **Repository pattern** for data access
- **Service layer** for business logic
- **Middleware** for cross-cutting concerns
- **Background jobs** for maintenance tasks
- **Comprehensive error handling** and logging

All functions are designed for:
- **Multi-tenancy**: Business isolation
- **Scalability**: Stateless, connection pooling
- **Reliability**: Error handling, graceful degradation
- **Maintainability**: Clear naming, single responsibility
