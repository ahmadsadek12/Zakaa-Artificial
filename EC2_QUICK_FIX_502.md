# Quick Fix for 502 Error

## Check PM2 Logs First

```bash
pm2 logs zakaa --lines 100
```

Look for any errors or crashes.

## Test the Correct Health Endpoint

The health endpoint is `/health`, not `/api/health`:

```bash
curl http://localhost:3000/health
```

## If Backend is Running But Still Getting 502

1. **Check Nginx is proxying correctly:**
```bash
sudo cat /etc/nginx/sites-available/default | grep -A 5 "location /api"
```

Should show something like:
```
location /api {
    proxy_pass http://localhost:3000;
    ...
}
```

2. **Test backend directly:**
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}'
```

3. **If backend works but Nginx doesn't:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Full Restart Sequence

```bash
cd ~/zakaa

# Check logs first
pm2 logs zakaa --lines 50

# If there are errors, stop and restart
pm2 stop zakaa
pm2 delete zakaa

# Kill any process on port 3000
sudo lsof -ti:3000 | xargs sudo kill -9 2>/dev/null || true

# Start fresh
pm2 start server.js --name zakaa

# Wait a few seconds
sleep 5

# Check logs
pm2 logs zakaa --lines 20

# Test backend
curl http://localhost:3000/health

# If backend works, reload Nginx
sudo systemctl reload nginx
```
