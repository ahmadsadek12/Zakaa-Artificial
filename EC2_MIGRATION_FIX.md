# EC2 Migration Fix - Quick Guide

## Issues Found:
1. ❌ Migration failed: `bot_integrations` table doesn't exist
2. ❌ PM2 process "zakaa" not found

## Quick Fix Commands

Run these commands on your EC2 instance:

```bash
# 1. Pull the fix
cd ~/zakaa
git pull origin main

# 2. Check if bot_integrations table exists
mysql -u root -p zakaa_db -e "SHOW TABLES LIKE 'bot_integrations';"

# 3. If table doesn't exist, run SQL manually
mysql -u root -p zakaa_db < database/migration_major_update.sql

# 4. Then run the migration script again
node database/migrate_major_update.js

# 5. Check PM2 processes
pm2 list

# 6. Start/restart the app (use the actual process name)
pm2 start server.js --name zakaa
# OR if it has a different name:
pm2 restart all
```

## Alternative: Run SQL Migration Manually

If the migration script still fails, run the SQL file directly:

```bash
mysql -u root -p zakaa_db < database/migration_major_update.sql
```

Then run the data migration part:
```bash
node database/migrate_major_update.js
```

## Check PM2 Process Name

```bash
# List all PM2 processes
pm2 list

# If your app has a different name, use that:
pm2 restart <actual-process-name>

# Or start it fresh:
pm2 start server.js --name zakaa
pm2 save
```
