# MongoDB Setup on AWS - Guide

## Options for MongoDB on AWS

You have **3 main options** for MongoDB on AWS:

### 1. **MongoDB Atlas (Recommended) ⭐**
- **What**: MongoDB's official managed service
- **Deployed on**: AWS infrastructure (you choose the region)
- **Pros**: 
  - Free tier available (512MB storage)
  - Fully managed (backups, scaling, monitoring)
  - Easy setup (5 minutes)
  - Same MongoDB you're already using
- **Cons**: 
  - Costs increase with usage
  - Requires internet connection from EC2

### 2. **AWS DocumentDB**
- **What**: AWS's MongoDB-compatible managed service
- **Pros**: 
  - Native AWS integration
  - Can be in same VPC as EC2
- **Cons**: 
  - More expensive than Atlas
  - Slightly different from MongoDB (compatibility layer)
  - More complex setup

### 3. **Self-hosted on EC2** (Current - Not Recommended)
- **Pros**: Full control
- **Cons**: 
  - You manage backups, updates, scaling
  - Takes time to maintain
  - No automatic failover

---

## Recommended: MongoDB Atlas Setup

### Step 1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free (or log in if you have an account)
3. Click **"Build a Database"**

### Step 2: Create a Free Cluster

1. **Choose Cloud Provider**: Select **AWS**
2. **Choose Region**: Select the same region as your EC2 instance (e.g., `us-east-1`)
3. **Cluster Tier**: Select **M0 Sandbox** (FREE - 512MB storage)
4. **Cluster Name**: `zakaa-cluster` (or any name)
5. Click **"Create"**

### Step 3: Create Database User

1. In the **Security** section, click **"Database Access"**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter:
   - **Username**: `zakaa_user` (or your choice)
   - **Password**: Generate a strong password (save it!)
5. **Database User Privileges**: Select **"Atlas admin"** (or "Read and write to any database")
6. Click **"Add User"**

### Step 4: Configure Network Access

1. In the **Security** section, click **"Network Access"**
2. Click **"Add IP Address"**
3. **Option A - Allow from anywhere** (for testing):
   - Click **"Allow Access from Anywhere"**
   - This adds `0.0.0.0/0` (less secure but easier)
4. **Option B - Allow only EC2** (recommended for production):
   - Click **"Add Current IP Address"** (your current IP)
   - Then add your EC2 instance's Elastic IP: `52.28.59.163`
   - Or add EC2's security group if using VPC peering
5. Click **"Confirm"**

### Step 5: Get Connection String

1. Go back to **"Database"** section
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. **Driver**: Node.js
5. **Version**: 5.5 or later
6. Copy the connection string - it looks like:
   ```
   mongodb+srv://zakaa_user:<password>@zakaa-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 6: Update Environment Variables on EC2

1. SSH into your EC2 instance:
   ```bash
   ssh -i "D:\Zakaa Artificial\zakaa-key.pem" ubuntu@52.28.59.163
   ```

2. Edit the `.env` file:
   ```bash
   cd ~/zakaa
   nano .env
   ```

3. Add or update these variables:
   ```env
   # MongoDB Atlas Connection
   MONGO_URI=mongodb+srv://zakaa_user:YOUR_PASSWORD@zakaa-cluster.xxxxx.mongodb.net/zakaa_db?retryWrites=true&w=majority
   
   # OR use individual variables (if your code supports it):
   MONGODB_HOST=zakaa-cluster.xxxxx.mongodb.net
   MONGODB_PORT=27017
   MONGODB_DATABASE=zakaa_db
   MONGODB_USER=zakaa_user
   MONGODB_PASSWORD=YOUR_PASSWORD
   ```

4. **Important**: Replace:
   - `YOUR_PASSWORD` with the actual password you created
   - `xxxxx` with your actual cluster identifier
   - The connection string format may vary - use the exact one from Atlas

5. Save and exit (Ctrl+X, then Y, then Enter)

### Step 7: Update Code to Support MongoDB Atlas Connection String

Your current code uses `MONGODB_HOST` and `MONGODB_PORT`, but Atlas uses a connection string. Let's update the database config to support both:

The code already supports `MONGO_URI` environment variable! Check `src/config/database.js` line 76:
```javascript
const MONGODB_URI = `mongodb://${process.env.MONGODB_HOST || process.env.MONGO_URI?.replace('mongodb://', '').split(':')[0] || '127.0.0.1'}:${process.env.MONGODB_PORT || process.env.MONGO_URI?.split(':')[2] || '27017'}`;
```

However, this doesn't fully support MongoDB Atlas connection strings (which use `mongodb+srv://`). Let's update it:

### Step 8: Restart Application

```bash
pm2 restart zakaa
pm2 logs zakaa --lines 50
```

You should see: `MongoDB connected successfully` instead of connection errors.

---

## Alternative: AWS DocumentDB Setup

If you prefer AWS-native services:

### Step 1: Create DocumentDB Cluster

1. Go to AWS Console → **DocumentDB**
2. Click **"Create cluster"**
3. Configure:
   - **Cluster identifier**: `zakaa-docdb`
   - **Engine version**: Latest MongoDB-compatible version
   - **Instance class**: `db.t3.medium` (smallest, ~$50/month)
   - **VPC**: Same VPC as your EC2 instance
   - **Subnet group**: Create new or use existing
   - **Master username**: `zakaa_admin`
   - **Master password**: (generate strong password)
4. Click **"Create cluster"**

### Step 2: Configure Security Group

1. Edit the DocumentDB security group
2. Add inbound rule:
   - **Type**: Custom TCP
   - **Port**: 27017
   - **Source**: Your EC2 instance's security group

### Step 3: Get Connection String

1. In DocumentDB console, click your cluster
2. Copy the **Endpoint** (e.g., `zakaa-docdb.cluster-xxxxx.us-east-1.docdb.amazonaws.com:27017`)

### Step 4: Update Environment Variables

```env
MONGODB_HOST=zakaa-docdb.cluster-xxxxx.us-east-1.docdb.amazonaws.com
MONGODB_PORT=27017
MONGODB_DATABASE=zakaa_db
MONGODB_USER=zakaa_admin
MONGODB_PASSWORD=YOUR_PASSWORD
```

---

## Cost Comparison

| Service | Free Tier | Paid Tier (Small) |
|---------|-----------|-------------------|
| **MongoDB Atlas** | ✅ 512MB free | ~$9/month (M10) |
| **AWS DocumentDB** | ❌ No free tier | ~$50/month (db.t3.medium) |
| **Self-hosted EC2** | ✅ Included in EC2 | Included in EC2 |

**Recommendation**: Start with **MongoDB Atlas Free Tier**, upgrade when needed.

---

## Updating Code for MongoDB Atlas Connection String

If you want to use the full MongoDB Atlas connection string (`mongodb+srv://`), we need to update the database config. Let me know if you want me to make this change!
