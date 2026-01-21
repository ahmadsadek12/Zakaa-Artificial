# Implementation Status - Major Update

## ✅ COMPLETED

1. **Database Migrations** ✅
   - All tables created (bot_integrations, addons, business_addons, service_categories, service_customizations)
   - All columns added (users, orders, items, menus, tables, reservations)
   - Data migration completed

2. **Middleware** ✅
   - `addonGuard.js` - Feature gating based on addons
   - `contractGate.js` - Contract approval gate
   - `immutableFieldsGuard.js` - Prevents changing immutable fields

3. **Repositories** ✅
   - `addonRepository.js`
   - `botIntegrationRepository.js`
   - `serviceCategoryRepository.js`
   - `serviceCustomizationRepository.js`
   - Updated: userRepository, itemRepository, orderRepository, reservationRepository

4. **Services Layer** ✅
   - Refactored `chatbotFunctions.js` into modular structure
   - Updated `cartManager.js` for services concept
   - Updated `orderService.js` for completed_at
   - Updated `archiveService.js` for new fields
   - Updated webhook handlers for contract gate

5. **Background Jobs** ✅
   - `scheduledRequestCompletionJob.js` - Auto-complete scheduled requests

6. **Existing Routes** ✅
   - `/api/tables` - Exists but needs addonGuard update
   - `/api/reservations` - Exists but needs addonGuard update

---

## ❌ MISSING - NEEDS IMPLEMENTATION

### Backend API Endpoints

1. **Add-ons Management** ❌
   - `GET /api/addons` - List available addons + business status
   - `PUT /api/addons/:addonKey` - Activate/deactivate addon

2. **Calendar Endpoint** ❌
   - `GET /api/calendar?from=&to=` - Unified scheduled requests + reservations

3. **Business Profile Updates** ❌
   - Update `/api/businesses/me` to:
     - Enforce immutableFieldsGuard
     - Allow new fields (google_maps_link, carrier_phone_number, etc.)
     - Add contract viewing endpoint

4. **Admin Contract Management** ❌
   - `POST /api/admin/businesses/:id/contract` - Upload contract
   - `PATCH /api/admin/businesses/:id/contract-status` - Set status

5. **Tables/Reservations Updates** ❌
   - Update existing routes to use `addonGuard('reservations')`
   - Add support for new fields (is_active, label, reservation_kind, start_at, source)

### Platform Integrations

6. **Instagram Webhook Handler** ❌
   - Create `src/services/instagram/instagramWebhookHandler.js`
   - Create `src/routes/webhook/instagram.js`
   - Add to `src/app.js`

7. **Facebook Webhook Handler** ❌
   - Create `src/services/facebook/facebookWebhookHandler.js`
   - Create `src/routes/webhook/facebook.js`
   - Add to `src/app.js`

### Analytics Service

8. **FREE Metrics** ❌
   - `milestones` - Max completed orders per minute (last 7 days)
   - `requests_handled` - Count inbound message_logs
   - `avg_response_time_ms` - Average latency from inbound to first outbound

9. **PAID Addon Metrics** ❌
   - `analytics_paid_loyal_customer` - Most orders by customerPhoneNumber
   - `analytics_paid_most_ordered` - Top service by sum(qty)
   - `analytics_paid_most_rewarding` - Max (priceAtTime - costAtTime) * qty per service
   - `analytics_paid_time_breakdown` - Group stats per hour/day/month

### Frontend Components

10. **Add-ons Management UI** ❌
    - Add-ons list page
    - Activate/deactivate toggle

11. **Platform Integration Setup** ❌
    - Instagram integration setup page
    - Facebook integration setup page
    - Telegram integration setup (may exist, verify)

12. **Calendar View** ❌
    - Unified calendar showing scheduled requests + reservations

13. **Settings Updates** ❌
    - Contract viewing/status
    - New business fields (google_maps_link, carrier_phone_number, etc.)
    - Immutable fields display (read-only)

---

## 📋 IMPLEMENTATION PRIORITY

**Phase 1: Critical Backend APIs** (Do First)
1. Add-ons endpoints
2. Calendar endpoint
3. Business profile updates with contract management
4. Admin contract endpoints

**Phase 2: Platform Integrations**
5. Instagram webhook handler
6. Facebook webhook handler

**Phase 3: Analytics**
7. FREE metrics
8. PAID addon metrics

**Phase 4: Frontend**
9. Add-ons UI
10. Platform integration UI
11. Calendar view
12. Settings updates
