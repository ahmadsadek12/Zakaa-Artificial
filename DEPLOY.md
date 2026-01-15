# 🚀 Quick Deploy Guide

## What Was Fixed

✅ **Removed `deleted_at` queries** - Items, orders, and menus no longer query for deleted_at column  
✅ **Fixed branches table** - Now correctly queries from `users` table where `user_type='branch'`  
✅ **Fixed collation** - Changed schema from `utf8mb4_unicode_ci` to `utf8mb4_0900_ai_ci` (MySQL 8.0 default)  
✅ **Single .env file** - Only one `.env` at project root (frontend `.env` auto-removed after build)

## Deploy to EC2

### Step 1: SSH into EC2
```bash
ssh -i "your-key.pem" ubuntu@52.28.59.163
```

### Step 2: Pull Latest Code
```bash
cd ~/zakaa
git pull origin main
```

### Step 3: Run Deployment Script
```bash
./deploy-to-ec2.sh
```

**The script will:**
1. ✅ Install dependencies
2. ✅ Initialize database with correct collation
3. ✅ Create admin account (`admin@zakaa-artificial.com` / `Z@ka2@dm1n*`)
4. ✅ Build frontend
5. ✅ Configure Nginx
6. ✅ Start backend with PM2

### Step 4: Access Admin Dashboard
```
http://52.28.59.163/
```

Login with:
- **Email:** `admin@zakaa-artificial.com`
- **Password:** `Z@ka2@dm1n*`

## What the Admin Can Do

✅ **View all businesses** - See every business in the system  
✅ **View all branches** - See all branches for each business  
✅ **View all orders** - Monitor order stats (accepted, completed, rejected)  
✅ **Add new businesses** - Create businesses with WhatsApp API keys  
✅ **Add branches** - Create new branches for businesses  
✅ **Manage users** - Full CRUD on all users  
✅ **View system stats** - Dashboard with system-wide metrics

## Useful Commands

```bash
# View backend logs
pm2 logs zakaa-api

# Check PM2 status
pm2 status

# Restart backend
pm2 restart zakaa-api

# Check Nginx
sudo systemctl status nginx

# View Nginx errors
sudo tail -f /var/log/nginx/zakaa-error.log
```

## Troubleshooting

### If database errors occur:
```bash
# Reconnect to RDS and re-initialize
cd ~/zakaa
npm run init
node scripts/create-admin.js
pm2 restart zakaa-api
```

### If frontend not showing:
```bash
# Rebuild frontend
cd ~/zakaa/frontend
npm run build
cd ..
sudo systemctl restart nginx
```

### If API returns 500 errors:
```bash
# Check backend logs
pm2 logs zakaa-api --lines 50
```

---

## 🎉 That's It!

Your admin dashboard is ready to manage all businesses, branches, orders, and system data!
