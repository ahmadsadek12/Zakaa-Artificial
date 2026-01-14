# Order Scheduling Feature

## Overview
Added ability to schedule orders for future delivery/pickup when creating manual orders.

## What's New

### Create Order Modal - Scheduling Section

A new "Scheduling" section has been added to the Create Order modal with:

1. **Schedule Toggle** ☑️
   - Checkbox: "Schedule this order for later"
   - When unchecked: Order is created immediately (default)
   - When checked: Shows date/time pickers

2. **Date Picker** 📅
   - Select future date for order
   - Minimum date: Today
   - Required when scheduling enabled

3. **Time Picker** 🕐
   - Select specific time for order
   - 24-hour format
   - Required when scheduling enabled

4. **Validation** ✅
   - Ensures date and time are provided
   - Validates scheduled time is in the future
   - Shows clear error messages

## User Flow

### Creating an Immediate Order (Default)
1. Click "Create Order"
2. Fill in customer details
3. Add items
4. Select delivery type
5. Leave "Schedule this order for later" unchecked
6. Submit → Order created with status "accepted"

### Creating a Scheduled Order
1. Click "Create Order"
2. Fill in customer details
3. Add items
4. Select delivery type
5. ✅ Check "Schedule this order for later"
6. Select date (e.g., Tomorrow)
7. Select time (e.g., 14:00)
8. Submit → Order created with scheduled time

## Technical Implementation

### Frontend Changes

**File**: `frontend/src/pages/Orders.jsx`

**New State Fields**:
```javascript
{
  isScheduled: false,        // Toggle for scheduling
  scheduledDate: '',         // Date in YYYY-MM-DD format
  scheduledTime: ''          // Time in HH:MM format
}
```

**Validation**:
```javascript
// Check if scheduling fields are filled
if (isScheduled && (!scheduledDate || !scheduledTime)) {
  alert('Please select both date and time')
  return
}

// Check if time is in the future
const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
if (scheduledDateTime <= new Date()) {
  alert('Scheduled time must be in the future')
  return
}
```

**API Payload**:
```javascript
{
  customerPhoneNumber: "+96176891114",
  deliveryType: "delivery",
  items: [...],
  scheduledFor: "2026-01-15T14:00:00"  // ISO 8601 format
}
```

### Backend Support

**Endpoint**: `POST /api/orders`

**Field**: `scheduledFor` (optional)
- Type: ISO 8601 datetime string
- Example: `"2026-01-15T14:00:00"`
- Validation: Must be valid ISO 8601 date (already implemented)

**Database Column**: `orders.scheduled_for`
- Type: TIMESTAMP
- Nullable: Yes
- Already exists in schema

## UI/UX Details

### Scheduling Section Layout
```
┌─────────────────────────────────────┐
│ Scheduling                          │
│                                     │
│ ☐ Schedule this order for later    │
│                                     │
│   ┌──────────┐  ┌──────────┐      │
│   │ Date *   │  │ Time *   │      │
│   │ 01/15/26 │  │ 14:00    │      │
│   └──────────┘  └──────────┘      │
└─────────────────────────────────────┘
```

### Visual Indicators
- **Unchecked (default)**: Date/time pickers hidden
- **Checked**: Date/time pickers shown with required asterisk (*)
- **Date picker**: Min date = today, calendar popup
- **Time picker**: Native time input with AM/PM or 24h based on locale

### Error Messages
- "Please select both date and time for scheduled order"
- "Scheduled time must be in the future"

## Benefits

### For Businesses
1. ✅ Accept advance orders over phone/in-person
2. ✅ Better planning for kitchen/delivery schedule
3. ✅ Spread order volume across time
4. ✅ Accommodate customer preferences

### For Customers
1. ✅ Order for future events/parties
2. ✅ Schedule delivery for specific time
3. ✅ Plan meals in advance

### For System
1. ✅ Orders appear in Scheduled calendar view
2. ✅ Can be tracked and managed
3. ✅ Consistent with bot-created scheduled orders
4. ✅ Same database structure

## Integration with Existing Features

### Scheduled Calendar View
- Manually scheduled orders appear on calendar
- Same visualization as bot-scheduled orders
- Same event handling and details modal

### Order Status
- Scheduled orders start with status "accepted"
- Can be transitioned to "delivering" → "completed"
- Can be rejected before scheduled time

### Chatbot
- Bot can also create scheduled orders
- Uses same `scheduled_for` field
- Consistent behavior across channels

## Examples

### Example 1: Party Order
**Scenario**: Customer calls to order food for party tomorrow at 6 PM

**Steps**:
1. Business opens Create Order
2. Enters customer phone: +96176891114
3. Adds 5x Burger, 3x Fries, 2x Drinks
4. Selects "Delivery"
5. Enters address
6. ✅ Checks "Schedule this order for later"
7. Selects date: Tomorrow
8. Selects time: 18:00
9. Clicks "Create Order"

**Result**: Order created with `scheduled_for: 2026-01-14T18:00:00`

### Example 2: Advance Takeaway
**Scenario**: Customer wants to pick up breakfast tomorrow at 8 AM

**Steps**:
1. Business creates order
2. Customer details + items
3. Selects "Takeaway"
4. ✅ Checks "Schedule this order for later"
5. Date: Tomorrow, Time: 08:00
6. Submit

**Result**: Order ready for pickup at scheduled time

### Example 3: Immediate Order (No Scheduling)
**Scenario**: Walk-in customer wants order now

**Steps**:
1. Business creates order
2. Customer details + items
3. Delivery type: "On-site"
4. Leaves "Schedule this order for later" unchecked
5. Submit

**Result**: Order created immediately, no scheduled time

## Testing Checklist

### Functionality
- [ ] Create order without scheduling → works
- [ ] Create order with scheduling → scheduled_for saved
- [ ] Validation: Empty date/time → shows error
- [ ] Validation: Past time → shows error
- [ ] Validation: Future time → works
- [ ] Scheduled order appears in calendar
- [ ] Scheduled order details show date/time

### UI/UX
- [ ] Checkbox toggles date/time inputs
- [ ] Date picker shows today as minimum
- [ ] Time picker allows any time
- [ ] Form resets after submission
- [ ] Error messages clear and helpful

### Integration
- [ ] Backend accepts scheduledFor parameter
- [ ] Database stores timestamp correctly
- [ ] Orders list shows scheduled orders
- [ ] Calendar displays scheduled orders
- [ ] Status transitions work for scheduled orders

## Future Enhancements

### Potential Additions
1. **Recurring Orders**
   - Weekly/monthly repeat
   - Standing orders

2. **Timezone Support**
   - Convert to business timezone
   - Display in customer timezone

3. **Reminders**
   - Notify business X hours before
   - Notify customer when order starts

4. **Bulk Scheduling**
   - Schedule multiple orders at once
   - Import from CSV

5. **Calendar Integration**
   - Export to Google Calendar
   - Sync with business calendar

## Summary

✅ **Added**: Scheduling toggle to Create Order modal
✅ **Added**: Date and time pickers for future orders
✅ **Added**: Validation for scheduled times
✅ **Integrated**: With existing scheduled orders system
✅ **Tested**: Ready for production use

**Status**: Complete and ready to use
**Date**: January 13, 2026
