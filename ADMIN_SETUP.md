# Admin Dashboard Setup Guide

## Quick Start

### 1. Create an Admin User

You can create an admin user using the provided script:

```bash
# Using default credentials (admin@zakaa.com / admin123)
node scripts/create-admin.js

# Or specify custom credentials
node scripts/create-admin.js admin@example.com mypassword123
```

### 2. Login to Admin Dashboard

1. Start the backend server:
   ```bash
   npm start
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser and navigate to: `http://localhost:5173/login`

4. Login with your admin credentials

5. You'll be automatically redirected to the admin dashboard at `/admin`

## Manual Admin User Creation

If you prefer to create an admin user manually via SQL:

```sql
-- Replace with your desired email and password hash
INSERT INTO users (
  id, 
  user_type, 
  email, 
  password_hash, 
  is_active, 
  created_at
) VALUES (
  UUID(),
  'admin',
  'admin@zakaa.com',
  '$2a$10$YourBcryptHashedPasswordHere',
  true,
  NOW()
);
```

To generate a bcrypt hash for your password, you can use:

```bash
node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
```

## Admin Dashboard Features

Once logged in as admin, you'll have access to:

### Main Dashboard (`/admin`)
- System-wide statistics
- Total businesses, branches, orders, and messages
- Order breakdown by status

### Business Management (`/admin/businesses`)
- View all businesses
- Create new businesses
- Edit business details
- Delete businesses
- View detailed business information
- Manage WhatsApp Business API credentials

### Branch Management (`/admin/branches`)
- View all branches across all businesses
- Filter branches by business
- Create new branches
- Edit branch details
- Delete branches
- Manage branch locations and WhatsApp settings

## Testing the Admin Dashboard

### 1. Create a Test Business

1. Navigate to `/admin/businesses`
2. Click "Add Business"
3. Fill in the form:
   ```
   Email: test@business.com
   Password: test123
   Business Name: Test Restaurant
   Business Type: food and beverage
   Subscription Type: standard
   ```
4. Click "Create Business"

### 2. Add a Branch to the Business

1. Click on the business you just created
2. In the Branches section, click "Add Branch"
3. Fill in the form:
   ```
   Email: branch1@test.com
   Password: branch123
   Branch Name: Downtown Branch
   City: Beirut
   Street: Main Street
   ```
4. Click "Create Branch"

### 3. View Statistics

- Go back to the admin dashboard (`/admin`)
- You should see your test business and branch in the statistics
- The counts should update automatically

## WhatsApp Business API Setup

To enable WhatsApp functionality for a business or branch:

### 1. Get Meta Business Credentials

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Create or select a WhatsApp Business account
3. Get the following credentials:
   - **Phone Number ID**: Found in WhatsApp Business API settings
   - **Access Token**: Generate a permanent token in the API settings

### 2. Configure in Admin Dashboard

1. Navigate to the business or branch you want to configure
2. Click "Edit"
3. Fill in the WhatsApp fields:
   - WhatsApp Phone Number: e.g., +1234567890
   - WhatsApp Phone Number ID: From Meta Business Manager
   - WhatsApp Access Token: From Meta Business Manager
4. Click "Save Changes"

### 3. Test WhatsApp Integration

Once configured, the business/branch can:
- Receive messages from customers
- Send automated responses
- Process orders via WhatsApp
- Use AI chatbot for customer interactions

## Security Best Practices

1. **Strong Passwords**: Always use strong passwords for admin accounts
2. **Limited Admin Access**: Only create admin accounts for trusted personnel
3. **Regular Audits**: Regularly review business and branch accounts
4. **Token Security**: WhatsApp access tokens are encrypted in the database
5. **Soft Deletes**: Deleted businesses/branches are soft-deleted, not permanently removed

## Troubleshooting

### Admin Can't Login
- Verify the user exists: `SELECT * FROM users WHERE email = 'admin@zakaa.com'`
- Check user_type is 'admin': `SELECT user_type FROM users WHERE email = 'admin@zakaa.com'`
- Verify is_active is true
- Check deleted_at is NULL

### Admin Redirected to Wrong Page
- Clear browser cache and cookies
- Check the PrivateRoute component is properly handling admin users
- Verify user.userType is being set correctly in AuthContext

### Can't See Businesses/Branches
- Check database connection
- Verify businesses exist: `SELECT * FROM users WHERE user_type = 'business'`
- Check browser console for API errors
- Verify JWT token is valid

### Statistics Not Updating
- Check MongoDB connection for message counts
- Verify orders table has data
- Check browser network tab for API responses
- Refresh the page

## API Testing

You can test the admin API endpoints using curl:

```bash
# Get admin token (login first)
TOKEN="your-jwt-token-here"

# Get statistics
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/stats

# Get all businesses
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/businesses

# Get business details
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/businesses/BUSINESS_ID

# Create business
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newbiz@test.com",
    "password": "password123",
    "business_name": "New Business",
    "business_type": "food and beverage"
  }' \
  http://localhost:3000/api/admin/businesses
```

## Database Queries for Monitoring

Useful SQL queries for monitoring:

```sql
-- Count all users by type
SELECT user_type, COUNT(*) as count 
FROM users 
WHERE deleted_at IS NULL 
GROUP BY user_type;

-- List all admins
SELECT id, email, created_at 
FROM users 
WHERE user_type = 'admin' AND deleted_at IS NULL;

-- Count businesses with branches
SELECT 
  b.id,
  b.business_name,
  COUNT(br.id) as branch_count
FROM users b
LEFT JOIN users br ON br.parent_user_id = b.id AND br.user_type = 'branch'
WHERE b.user_type = 'business' AND b.deleted_at IS NULL
GROUP BY b.id, b.business_name;

-- Get order statistics
SELECT 
  status,
  COUNT(*) as count,
  SUM(total) as revenue
FROM orders
GROUP BY status;
```

## Support

For additional help or questions:
1. Check the main README.md
2. Review ADMIN_DASHBOARD.md for feature documentation
3. Check the API documentation at `/api-docs` (if enabled)
4. Review the codebase in `src/routes/api/admin.js`

## Next Steps

After setting up the admin dashboard:
1. Create your first business
2. Add branches to the business
3. Configure WhatsApp Business API credentials
4. Test the order flow
5. Monitor statistics and performance
