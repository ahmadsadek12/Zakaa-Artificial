# Troubleshooting 502 Bad Gateway Error

## Quick Fix Commands

Run these on your EC2 instance:

```bash
# 1. Check if PM2 process is running
pm2 list

# 2. Check PM2 logs for errors
pm2 logs zakaa --lines 50

# 3. If process is not running, start it
pm2 start server.js --name zakaa

# 4. If process exists but crashed, restart it
pm2 restart zakaa

# 5. Check if port 3000 is in use
sudo lsof -i :3000

# 6. Kill any process on port 3000 if needed
sudo lsof -ti:3000 | xargs sudo kill -9

# 7. Check Nginx configuration
sudo nginx -t

# 8. Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# 9. Test backend directly
curl http://localhost:3000/api/health

# 10. Restart everything
pm2 restart zakaa
sudo systemctl reload nginx
```

## Common Causes

1. **PM2 process crashed** - Check `pm2 logs zakaa`
2. **Port 3000 already in use** - Kill the process and restart
3. **Backend not started** - Run `pm2 start server.js --name zakaa`
4. **Database connection failed** - Check MySQL connection in logs
5. **Environment variables missing** - Check `.env` file

## Step-by-Step Fix

```bash
# Step 1: Check PM2 status
pm2 list

# Step 2: If process is missing or errored, restart
pm2 delete zakaa  # If exists but errored
pm2 start server.js --name zakaa

# Step 3: Check logs for errors
pm2 logs zakaa --lines 100

# Step 4: If you see database errors, check MySQL
# If you see module errors, run:
cd ~/zakaa
npm install

# Step 5: Test backend
curl http://localhost:3000/api/health

# Step 6: If backend works, reload Nginx
sudo nginx -t && sudo systemctl reload nginx
```

## Check Nginx Configuration

Make sure Nginx is pointing to the correct backend:

```bash
# Check Nginx config
sudo cat /etc/nginx/sites-available/default | grep proxy_pass

# Should show something like:
# proxy_pass http://localhost:3000;
```

## Full Restart Sequence

```bash
cd ~/zakaa

# Stop everything
pm2 stop zakaa
pm2 delete zakaa

# Kill any process on port 3000
sudo lsof -ti:3000 | xargs sudo kill -9 2>/dev/null || true

# Start fresh
pm2 start server.js --name zakaa

# Wait a few seconds, then check
sleep 3
pm2 logs zakaa --lines 20

# Test backend
curl http://localhost:3000/api/health

# Reload Nginx
sudo systemctl reload nginx
```
