#!/bin/bash
# Migration script for EC2
# Run: bash run_migration.sh

cd ~/zakaa

echo "=== Step 1: Pull latest changes ==="
git pull origin main

echo ""
echo "=== Step 2: Check if bot_integrations table exists ==="
mysql -u root -p$(grep MYSQL_PASSWORD .env | cut -d '=' -f2) zakaa_db -e "SHOW TABLES LIKE 'bot_integrations';" 2>/dev/null

echo ""
echo "=== Step 3: Run SQL migration ==="
mysql -u root -p$(grep MYSQL_PASSWORD .env | cut -d '=' -f2) zakaa_db < database/migration_major_update.sql 2>&1 | grep -v "Warning\|Duplicate" || echo "SQL migration completed"

echo ""
echo "=== Step 4: Run data migration ==="
node database/migrate_major_update.js

echo ""
echo "=== Step 5: Restart PM2 ==="
pm2 restart zakaa

echo ""
echo "=== Step 6: Check status ==="
pm2 status
pm2 logs zakaa --lines 20
