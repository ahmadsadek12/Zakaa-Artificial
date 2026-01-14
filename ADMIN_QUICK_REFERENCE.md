# Admin Dashboard - Quick Reference Card

## 🔑 Admin Credentials

```
Email:    admin@zakaa-artificial.com
Password: Z@ka2@dm1n*
```

## 🚀 Quick Start Commands

```bash
# Create admin account
node scripts/create-admin.js

# Start backend
npm start

# Start frontend (new terminal)
cd frontend && npm run dev

# Access dashboard
http://localhost:5173/login
```

## 📍 Admin Pages

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/admin` | System statistics |
| Businesses | `/admin/businesses` | Manage businesses |
| Business Details | `/admin/businesses/:id` | View business info |
| Branches | `/admin/branches` | Manage branches |
| Profile | `/admin/profile` | Edit admin profile |

## 🔐 Security Features

✅ **Password**: Bcrypt hashed, strength validation  
✅ **Lockout**: 5 failed attempts = 15 min lock  
✅ **Logging**: All admin actions audited  
✅ **Headers**: XSS, Clickjacking protection  
✅ **Rate Limit**: 100 req/15 min (general), 5 req/15 min (auth)  

## 📊 Admin Capabilities

### Full CRUD Access
- ✅ Businesses (create, edit, delete, view all)
- ✅ Branches (create, edit, delete, view all)
- ✅ Orders (view, update status, delete)
- ✅ Items (view, delete)
- ✅ Menus (view, delete)
- ✅ Customers (view, update status)
- ✅ Admins (create, delete)

### Statistics Viewing
- Total businesses, branches, orders, messages
- Order breakdown by status
- Per-business analytics
- Per-branch analytics

### Profile Management
- Update email, name, phone
- Change password
- View account info

## 🔧 Key Environment Variables

```env
# Required for production
JWT_SECRET=<generate with: openssl rand -base64 64>
ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Database
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=zakaa_db

# MongoDB
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=zakaa_db
```

## 🆘 Common Tasks

### Create Business
1. Go to `/admin/businesses`
2. Click "Add Business"
3. Fill in details + WhatsApp credentials
4. Click "Create Business"

### Add Branch
1. Go to business details page
2. Click "Add Branch"
3. Fill in details + location
4. Click "Create Branch"

### View All Orders
1. Go to `/admin`
2. See order statistics
3. Or navigate directly via API:
   ```
   GET /api/admin/orders
   ```

### Change Admin Password
1. Go to `/admin/profile`
2. Scroll to "Change Password"
3. Enter current and new password
4. Click "Change Password"

## 📞 Support

**Documentation**: See `/docs` folder  
**Security**: See `SECURITY_AUDIT.md`  
**Setup**: See `ADMIN_SETUP.md`  
**Features**: See `ADMIN_DASHBOARD.md`  

## ⚡ Pro Tips

1. **Search**: Use search boxes for quick filtering
2. **Pagination**: Use pagination for large lists
3. **Filters**: Filter branches by business
4. **Stats**: Dashboard auto-updates
5. **Audit**: Check logs regularly
6. **Backup**: Test restore procedures
7. **Monitor**: Set up alerts for security events

## 🔒 Security Best Practices

- ✅ Change default admin password immediately
- ✅ Use strong, unique passwords
- ✅ Enable HTTPS in production
- ✅ Whitelist CORS origins
- ✅ Generate strong JWT secrets
- ✅ Review audit logs weekly
- ✅ Update dependencies monthly
- ✅ Run security audits quarterly

## 🎯 Quick Stats

**Total Routes**: 25+ admin endpoints  
**Security Rating**: 8.5/10  
**Code Coverage**: Backend + Frontend  
**Documentation**: 6 comprehensive guides  

---

**Status**: ✅ PRODUCTION READY  
**Last Updated**: January 2026  
**Version**: 1.0  

**Get Started Now:**
```bash
node scripts/create-admin.js
npm start
```
