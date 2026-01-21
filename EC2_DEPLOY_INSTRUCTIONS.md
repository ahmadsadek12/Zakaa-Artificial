# EC2 Deployment Instructions

## Quick Deploy (Automated)

1. **SSH into your EC2 instance:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

2. **Run the deployment script:**
   ```bash
   cd ~/zakaa
   bash EC2_DEPLOY_ALL.sh
   ```

The script will automatically:
- Pull latest changes from GitHub
- Install backend dependencies
- Install frontend dependencies
- Build the frontend
- Restart PM2
- Reload Nginx

---

## Manual Deploy (Step by Step)

If you prefer to run commands manually:

1. **SSH into EC2:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

2. **Navigate to project:**
   ```bash
   cd ~/zakaa
   ```

3. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

4. **Install backend dependencies:**
   ```bash
   npm install
   ```

5. **Install frontend dependencies and build:**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

6. **Restart PM2:**
   ```bash
   pm2 restart zakaa
   # OR if PM2 process doesn't exist:
   pm2 start server.js --name zakaa
   ```

7. **Reload Nginx:**
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

8. **Check status:**
   ```bash
   pm2 list
   pm2 logs zakaa --lines 50
   ```

---

## Troubleshooting

### PM2 Process Not Found
```bash
pm2 list  # Check if process exists
pm2 start server.js --name zakaa  # Start if not running
```

### Port Already in Use
```bash
sudo lsof -ti:3000 | xargs sudo kill -9  # Kill process on port 3000
pm2 restart zakaa
```

### Frontend Not Updating
```bash
cd frontend
rm -rf dist node_modules
npm install
npm run build
cd ..
sudo systemctl reload nginx
```

### Database Migration Needed
If you see database errors, run:
```bash
node database/migrate_major_update.js
# OR
bash fix_migration.sh
```

---

## Environment Variables

Make sure your `.env` file on EC2 has all required variables. The new features don't require additional env vars, but you can optionally add:

```bash
# Optional - for Instagram/Facebook webhook verification
INSTAGRAM_VERIFY_TOKEN=your_token_here
FACEBOOK_VERIFY_TOKEN=your_token_here

# Optional - for webhook signature verification (production)
INSTAGRAM_APP_SECRET=your_app_secret
FACEBOOK_APP_SECRET=your_app_secret
```

If not set, the webhooks will fall back to `WHATSAPP_VERIFY_TOKEN`.

---

## Verify Deployment

1. **Check backend is running:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Check PM2 status:**
   ```bash
   pm2 status
   pm2 logs zakaa --lines 20
   ```

3. **Check Nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

4. **Access your application:**
   - Frontend: `http://your-ec2-ip`
   - API: `http://your-ec2-ip/api/health`
