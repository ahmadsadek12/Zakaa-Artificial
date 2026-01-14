# Admin Dashboard Documentation

## Overview

The Admin Dashboard provides comprehensive system-wide management capabilities for administrators. Admins can view all businesses, manage branches, monitor orders, track messages, and add new businesses with their WhatsApp Business API configurations.

## Features

### 1. Admin Dashboard (`/admin`)

The main admin dashboard displays:
- **Total Businesses**: Count of all businesses in the system
- **Total Branches**: Count of all branches across all businesses
- **Total Orders**: Aggregate order count with breakdown by status
  - Accepted orders
  - Completed orders
  - Rejected orders
- **Messages Sent**: Total WhatsApp messages sent across all businesses

### 2. Business Management (`/admin/businesses`)

#### View All Businesses
- Paginated list of all businesses (20 per page)
- Search functionality by business name or email
- Display information:
  - Business name and email
  - Business type (food and beverage, entertainment, sports, etc.)
  - Contact information (phone, WhatsApp)
  - Subscription type (standard/premium) and status
  - Statistics:
    - Number of branches
    - Total orders
    - Accepted orders
    - Messages sent
  - Account status (active/inactive)

#### Create New Business
Admin can create a new business with:
- **Basic Information**:
  - Email (required)
  - Password (required)
  - Business name (required)
  - Business type (required)
  - Business description
  
- **Contact Information**:
  - Contact phone number
  - WhatsApp phone number
  - WhatsApp Phone Number ID (from Meta Business)
  - WhatsApp Access Token (from Meta Business)
  
- **Subscription & Status**:
  - Subscription type (standard/premium)
  - Subscription status (active/past_due/canceled)
  - Account status (active/inactive)

#### Edit Business
- Update all business information
- Change subscription type and status
- Update WhatsApp credentials
- Activate/deactivate accounts
- Password and WhatsApp token are optional during edit (leave empty to keep current)

#### Delete Business
- Soft delete (sets `deleted_at` timestamp)
- Also deletes all associated branches
- Confirmation required before deletion

#### View Business Details (`/admin/businesses/:id`)
Detailed view showing:
- Business information
- All branches with their statistics
- Order statistics breakdown
- Message count
- Revenue metrics
- Quick access to add branches

### 3. Branch Management (`/admin/branches`)

#### View All Branches
- Paginated list of all branches across all businesses
- Filter by specific business
- Search functionality
- Display information:
  - Branch name and email
  - Parent business name
  - Location details (city, street, building, floor)
  - Contact information
  - Statistics (orders, messages)
  - Account status

#### Create New Branch
Admin can create a branch for any business with:
- **Basic Information**:
  - Email (required)
  - Password (required)
  - Branch name (required)
  - Branch description
  
- **Location**:
  - City
  - Street
  - Building
  - Floor
  - Location notes
  - Latitude/Longitude coordinates
  
- **Contact & WhatsApp**:
  - Contact phone number
  - WhatsApp phone number
  - WhatsApp Phone Number ID
  - WhatsApp Access Token
  
- **Status**:
  - Account status (active/inactive)

#### Edit Branch
- Update all branch information
- Modify location details
- Update WhatsApp credentials
- Change account status

#### Delete Branch
- Soft delete
- Confirmation required

## API Endpoints

### Admin Statistics
```
GET /api/admin/stats
```
Returns system-wide statistics.

### Business Management
```
GET    /api/admin/businesses              - List all businesses (paginated)
GET    /api/admin/businesses/:id          - Get business details
POST   /api/admin/businesses              - Create new business
PUT    /api/admin/businesses/:id          - Update business
DELETE /api/admin/businesses/:id          - Delete business
```

### Branch Management
```
GET    /api/admin/branches                           - List all branches (paginated)
GET    /api/admin/businesses/:businessId/branches    - List branches for a business
POST   /api/admin/businesses/:businessId/branches    - Create branch for business
PUT    /api/admin/branches/:id                       - Update branch
DELETE /api/admin/branches/:id                       - Delete branch
```

## Authentication & Authorization

- All admin routes require authentication
- Only users with `user_type = 'admin'` can access admin routes
- Business users are automatically redirected away from admin routes
- Admin users are automatically redirected to admin dashboard

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt before storage
2. **Token Encryption**: WhatsApp access tokens are encrypted before storage
3. **Soft Deletes**: Businesses and branches are soft-deleted (not permanently removed)
4. **Role-Based Access**: Strict role checking on all admin endpoints
5. **Input Validation**: All inputs are validated before processing

## WhatsApp Business API Integration

When adding or editing businesses/branches, admins can configure:

1. **WhatsApp Phone Number**: The phone number registered with WhatsApp Business
2. **WhatsApp Phone Number ID**: Obtained from Meta Business Manager
3. **WhatsApp Access Token**: API access token from Meta Business Manager

These credentials enable the business/branch to:
- Send and receive WhatsApp messages
- Process customer orders via WhatsApp
- Use AI chatbot for customer interactions

## Usage Instructions

### Creating a Business

1. Navigate to `/admin/businesses`
2. Click "Add Business" button
3. Fill in all required fields:
   - Email
   - Password
   - Business name
   - Business type
4. Optionally add:
   - Contact information
   - WhatsApp credentials
   - Subscription settings
5. Click "Create Business"

### Adding a Branch to a Business

1. Navigate to `/admin/businesses/:id` (business detail page)
2. Click "Add Branch" in the Branches section
   
   OR
   
1. Navigate to `/admin/branches`
2. Select the business from the filter dropdown
3. Click "Add Branch"
4. Fill in branch details including location
5. Click "Create Branch"

### Configuring WhatsApp Business API

To enable WhatsApp functionality:

1. Register a WhatsApp Business account with Meta
2. Obtain the following from Meta Business Manager:
   - Phone Number ID
   - Access Token
3. In the admin dashboard, edit the business/branch
4. Enter the WhatsApp credentials
5. Save changes

The business/branch will now be able to receive and send WhatsApp messages.

## Statistics Tracking

The system automatically tracks:
- **Orders**: Total, accepted, completed, rejected
- **Messages**: All WhatsApp messages (stored in MongoDB)
- **Revenue**: Total revenue from completed orders
- **Branches**: Number of branches per business

All statistics are updated in real-time and displayed in the admin dashboard.

## Database Schema

### Users Table (Multi-Role)
- Businesses: `user_type = 'business'`
- Branches: `user_type = 'branch'`, `parent_user_id` references business
- Admins: `user_type = 'admin'`

### Related Tables
- `locations`: Stores branch location details
- `orders`: Tracks all orders (linked to business_id and user_id)
- `message_logs` (MongoDB): Stores WhatsApp message history

## Future Enhancements

Potential features for future development:
- Bulk business import
- Advanced analytics dashboard
- Business performance reports
- Automated subscription management
- Email notifications for admins
- Audit log viewer
- System health monitoring
- Revenue analytics and charts

## Support

For issues or questions about the admin dashboard, contact the development team.
