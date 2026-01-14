# Business Types & Item Scheduling Implementation Summary

## Overview
Successfully implemented comprehensive business type refactoring and item-level scheduling system.

## Database Changes

### 1. Business Type Migration
- **Old Values**: `restaurant`, `sports_court`, `salon`, `other`
- **New Values**: `f & b`, `services`, `products`
- **Migration Results**:
  - 8 restaurants → 3 f & b businesses
  - 4 sports_court/salon → 2 services businesses
  - 4 other → 1 products business

### 2. Item Scheduling Fields Added
```sql
ALTER TABLE items
  ADD COLUMN item_type ENUM('service', 'good') DEFAULT 'good',
  ADD COLUMN is_schedulable BOOLEAN DEFAULT false,
  ADD COLUMN min_schedule_hours INT DEFAULT 0;
```

### 3. Data Migration
- **F&B items**: `item_type='good'`, `is_schedulable=false` (23 items)
- **Services items**: `item_type='service'`, `is_schedulable=true`, `min_schedule_hours=2` (9 items)
- **Products items**: `item_type='good'`, `is_schedulable=false` (33 items)

## Backend Updates

### 1. Item Repository (`src/repositories/itemRepository.js`)
- Added `itemType`, `isSchedulable`, `minScheduleHours` to `create()` and `update()` functions
- Proper field mapping and validation

### 2. Items API (`src/routes/api/items.js`)
- Added validation for new fields in POST and PUT routes:
  - `itemType`: Must be 'service' or 'good'
  - `isSchedulable`: Boolean
  - `minScheduleHours`: Integer 0-168 (max 1 week)
- Added string-to-boolean parsing for `isSchedulable`

### 3. Prompt Builder (`src/services/llm/promptBuilder.js`)
- Updated business type checks:
  ```javascript
  const isFoodAndBeverage = business.business_type === 'f & b';
  const isServices = business.business_type === 'services';
  const isProducts = business.business_type === 'products';
  ```
- Added service scheduling context to system prompt
- Updated all `isRestaurant` references to `isFoodAndBeverage`

### 4. Date/Time Parser (`src/services/llm/dateTimeParser.js`)
- Added `validateMinScheduleTime()` function:
  - Checks if scheduled time meets minimum hours requirement
  - Returns validation object with `valid`, `hoursUntil`, and `message`

### 5. Chatbot Functions (`src/services/llm/chatbotFunctions.js`)
- Updated `set_scheduled_time` to:
  - Fetch cart items and check their scheduling requirements
  - Find the maximum `min_schedule_hours` among all items
  - Validate the scheduled time against this maximum
  - Return error if time is too soon

### 6. Constants (`src/config/constants.js`)
- Updated `BUSINESS_TYPES`:
  ```javascript
  {
    FOOD_AND_BEVERAGE: 'f & b',
    SERVICES: 'services',
    PRODUCTS: 'products'
  }
  ```
- Removed old types (SALONS, CLINICS, RENTALS, OTHER)

### 7. API Validation Updates
- `src/routes/api/auth.js`: Updated registration validation
- `src/routes/api/businesses.js`: Updated profile update validation

## Frontend Updates

### 1. Items Page (`frontend/src/pages/Items.jsx`)
- Added state fields: `itemType`, `isSchedulable`, `minScheduleHours`
- Added form section "Scheduling Options" with:
  - **Item Type** dropdown (Good/Service)
  - **Can be Scheduled** checkbox
  - **Minimum Schedule Hours** input (shown when schedulable)
- Updated `handleEdit()` and `resetForm()` to include new fields
- Updated FormData submission to send new fields
- Changed all `'food and beverage'` references to `'f & b'`

### 2. Scheduled Page (`frontend/src/pages/Scheduled.jsx`)
- Updated business type references from `'food and beverage'` to `'f & b'`

## Business Logic

### Scheduling Rules
1. **Item Type**: 
   - `good` = Physical product (burger, toy)
   - `service` = Service (haircut, massage, court rental)

2. **Is Schedulable**:
   - `false` = Immediate order only
   - `true` = Can be scheduled for future time

3. **Min Schedule Hours**:
   - `0` = Can order immediately OR schedule
   - `> 0` = Must schedule X hours in advance
   - Max: 168 hours (1 week)

4. **Cart Validation**:
   - When setting scheduled time, system checks all items in cart
   - Uses the HIGHEST `min_schedule_hours` value
   - Rejects if scheduled time is less than required

### Business Type Behavior

#### F & B (Food & Beverage)
- Items are goods (not schedulable by default)
- Can enable scheduling if business allows scheduled orders
- Closed status prompts scheduling

#### Services
- Items are services (schedulable by default)
- Minimum advance booking times enforced
- Opening hours checked

#### Products
- Items are goods (not schedulable by default)
- Can configure per-item scheduling
- Works like f & b for ordering

## Testing Checklist

### Database
- [x] Business types migrated correctly
- [x] Item scheduling fields added
- [x] Item defaults set based on business type

### Backend API
- [ ] Create item with scheduling fields
- [ ] Update item scheduling fields
- [ ] Validate min_schedule_hours (0-168)
- [ ] Validate itemType enum
- [ ] Return scheduling fields in GET requests

### Frontend
- [ ] Item form shows scheduling fields
- [ ] Fields save correctly
- [ ] Fields load correctly when editing
- [ ] Conditional display works (min hours only when schedulable)

### Chatbot
- [ ] Order schedulable service with 2 hour minimum
- [ ] Try scheduling service too soon (should reject)
- [ ] Order non-schedulable good immediately
- [ ] Mixed cart (schedulable + immediate items)
- [ ] Business type context correct in prompts
- [ ] F&B closed → offers scheduling
- [ ] Services → mentions scheduling options

## Files Modified

### Database Scripts
1. `database/add_item_scheduling.js` (new)
2. `database/migrate_business_types.js` (new)
3. `database/migrate_item_defaults.js` (new)

### Backend
1. `src/repositories/itemRepository.js`
2. `src/routes/api/items.js`
3. `src/services/llm/promptBuilder.js`
4. `src/services/llm/dateTimeParser.js`
5. `src/services/llm/chatbotFunctions.js`
6. `src/config/constants.js`
7. `src/routes/api/auth.js`
8. `src/routes/api/businesses.js`

### Frontend
1. `frontend/src/pages/Items.jsx`
2. `frontend/src/pages/Scheduled.jsx`

## Migration Commands

```bash
# 1. Add item scheduling fields
node database/add_item_scheduling.js

# 2. Migrate business types
node database/migrate_business_types.js

# 3. Set item defaults
node database/migrate_item_defaults.js
```

## Verification Queries

```sql
-- Check business types
SELECT business_name, business_type FROM users WHERE user_type='business';

-- Check item scheduling fields
SELECT 
  u.business_name,
  u.business_type,
  i.name,
  i.item_type,
  i.is_schedulable,
  i.min_schedule_hours
FROM items i
JOIN users u ON i.business_id = u.id
WHERE i.deleted_at IS NULL
ORDER BY u.business_type, i.name;
```

## Next Steps

1. **Testing**: Run comprehensive tests on all flows
2. **Documentation**: Update API documentation with new fields
3. **Training**: Educate businesses on new scheduling features
4. **Monitoring**: Track usage of scheduling features

## Known Limitations

1. Mixed cart scheduling: Uses highest min_schedule_hours from all items
2. Maximum advance scheduling: 168 hours (1 week)
3. No per-day scheduling restrictions (only global min hours)
4. No capacity management for services (handled by existing quantity/reusable system)

## Success Metrics

- ✅ All database migrations completed
- ✅ All business types migrated (16 businesses)
- ✅ All items migrated (65 items)
- ✅ Backend API updated with validation
- ✅ Frontend forms updated
- ✅ Chatbot logic updated
- ✅ All "food and beverage" references updated to "f & b"
- ⏳ End-to-end testing pending

## Rollback Plan

If issues arise:
1. Keep migration scripts for reference
2. Business types are in enum - can add old values back temporarily
3. Item scheduling fields nullable - safe to ignore if needed
4. Frontend conditionally renders - backward compatible

---

**Implementation Date**: January 13, 2026
**Status**: ✅ Complete (pending end-to-end testing)
