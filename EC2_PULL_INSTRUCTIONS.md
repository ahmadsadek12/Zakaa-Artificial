# EC2 Login & Pull Instructions

## 🚀 Quick Steps to Pull Latest Changes on EC2

### Step 1: Connect to EC2 Instance

**Option A: Using SSH (if you have the .pem key file)**
```bash
# On Windows (PowerShell or Git Bash)
ssh -i "path/to/your-key.pem" ubuntu@52.28.59.163

# If permission error on Windows:
# Right-click .pem file → Properties → Security → Advanced
# Disable inheritance → Remove all permissions → Add your user with Read permission
```

**Option B: Using AWS Console**
1. Go to AWS EC2 Console
2. Select your instance
3. Click "Connect" → "EC2 Instance Connect" or "Session Manager"
4. This opens a browser-based terminal

**Option C: Using PuTTY (Windows)**
1. Convert .pem to .ppk using PuTTYgen
2. Open PuTTY → Enter host: `ubuntu@52.28.59.163`
3. Load your .ppk key in Connection → SSH → Auth

---

### Step 2: Navigate to Project Directory

```bash
# Navigate to your project directory (adjust path if different)
cd ~/Zakaa-Artificial

# Or if it's in a different location:
cd /home/ubuntu/Zakaa-Artificial
```

---

### Step 3: Pull Latest Changes from GitHub

```bash
# Check current status
git status

# Pull latest changes
git pull origin main

# If you have local changes that conflict, you may need to:
git stash
git pull origin main
git stash pop
```

---

### Step 4: Install Backend Dependencies

```bash
# Install any new npm packages for backend
npm install
```

---

### Step 5: Build Frontend (if frontend changed)

```bash
# Navigate to frontend directory
cd frontend

# Install frontend dependencies
npm install

# Build for production (creates frontend/dist folder)
npm run build

# Go back to root directory
cd ..
```

**Note**: The frontend build creates a `frontend/dist` folder that nginx serves. If you only changed backend code, you can skip this step.

---

### Step 6: Run Database Migrations (if needed)

```bash
# Run the major update migration
node database/migrate_major_update.js
```

---

### Step 7: Restart the Application

**If using PM2:**
```bash
# Restart the app
pm2 restart zakaa

# Or restart all processes
pm2 restart all

# Check status
pm2 status

# View logs
pm2 logs zakaa
```

**If using systemd or other:**
```bash
# Restart your service
sudo systemctl restart zakaa
# or
sudo service zakaa restart
```

---

## 📋 Complete Command Sequence

Copy and paste this entire block:

```bash
# 1. Navigate to project
cd ~/Zakaa-Artificial

# 2. Pull changes
git pull origin main

# 3. Install backend dependencies
npm install

# 4. Build frontend (if frontend changed)
cd frontend
npm install
npm run build
cd ..

# 5. Run migrations (if needed)
node database/migrate_major_update.js

# 6. Restart with PM2
pm2 restart zakaa

# 7. Reload nginx (if frontend changed)
sudo nginx -t && sudo systemctl reload nginx

# 8. Check status
pm2 status
pm2 logs zakaa --lines 50
```

---

## 🔍 Verify Everything Works

```bash
# Check if server is running
curl http://localhost:3000/health

# Check PM2 status
pm2 status

# View recent logs
pm2 logs zakaa --lines 100

# Check if port 3000 is listening
sudo netstat -tlnp | grep 3000
```

---

## 🆘 Troubleshooting

### If git pull fails with "permission denied":
```bash
# Check git remote
git remote -v

# If needed, update remote URL
git remote set-url origin https://github.com/ahmadsadek12/Zakaa-Artificial.git
```

### If npm install fails:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### If PM2 is not installed:
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your app
pm2 start server.js --name zakaa

# Save PM2 configuration
pm2 save
pm2 startup
```

### If frontend build fails:
```bash
# Clear frontend cache and rebuild
cd frontend
rm -rf node_modules package-lock.json dist
npm install
npm run build
cd ..
```

### If database migration fails:
```bash
# Check MySQL connection
mysql -u root -p -e "USE zakaa_db; SHOW TABLES;"

# Check MongoDB connection (if using)
mongo --eval "db.version()"
```

### If nginx needs reload:
```bash
# Test nginx configuration
sudo nginx -t

# Reload nginx (applies changes without downtime)
sudo systemctl reload nginx

# Or restart nginx (full restart)
sudo systemctl restart nginx
```

---

## 📝 Important Notes

1. **Backup First**: Before running migrations, consider backing up your database:
   ```bash
   mysqldump -u root -p zakaa_db > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Environment Variables**: Make sure your `.env` file on EC2 has all required variables:
   ```bash
   # Check .env file
   cat .env
   ```

3. **Check Logs**: Always check logs after deployment:
   ```bash
   pm2 logs zakaa --lines 200
   ```

4. **Test Endpoints**: After deployment, test key endpoints:
   ```bash
   curl http://localhost:3000/api/health
   ```

---

## 🔗 Repository Information

- **GitHub URL**: https://github.com/ahmadsadek12/Zakaa-Artificial.git
- **Branch**: main
- **EC2 IP**: 52.28.59.163
- **Default User**: ubuntu

---

## ✅ What Was Just Pushed

The latest commit includes:
- ✅ Refactored chatbotFunctions into 7 modular files
- ✅ New middleware (addonGuard, contractGate, immutableFieldsGuard)
- ✅ New repositories for addons, bot integrations, service categories
- ✅ Database migration script for major schema updates
- ✅ Scheduled request completion job
- ✅ Updated services for new architecture

**Commit Hash**: `1d53054`
**Commit Message**: "Refactor chatbotFunctions into modular structure + implement major database updates"
