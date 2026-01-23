# MongoDB Atlas CLI Setup on Ubuntu/EC2

## Step 1: Install MongoDB Atlas CLI

```bash
# Download the Atlas CLI binary
curl -O https://fastdl.mongodb.org/mongocli/mongocli_1.32.0_linux_x86_64.tar.gz

# Extract it
tar -xzf mongocli_1.32.0_linux_x86_64.tar.gz

# Move to a system path
sudo mv mongocli /usr/local/bin/

# Make it executable
sudo chmod +x /usr/local/bin/mongocli

# Verify installation
mongocli --version
```

## Step 2: Authenticate with MongoDB Atlas

First, create an API key:
1. Go to https://cloud.mongodb.com/
2. Log in to your account
3. Go to **Access Manager** → **API Keys**
4. Click **"Create API Key"**
5. Give it a name (e.g., "EC2 Setup")
6. Copy the **Public Key** and **Private Key** (you'll need both)

Then authenticate:
```bash
# Authenticate using API key
mongocli auth login --apiKey YOUR_PUBLIC_KEY --privateApiKey YOUR_PRIVATE_KEY

# OR authenticate interactively (will open browser)
mongocli auth login
```

## Step 3: Create a Cluster

```bash
# Create a free M0 cluster
mongocli atlas clusters create zakaa-cluster \
  --provider AWS \
  --region US_EAST_1 \
  --tier M0 \
  --mdbVersion 7.0

# Wait for cluster to be ready (this takes 3-5 minutes)
mongocli atlas clusters watch zakaa-cluster
```

## Step 4: Configure Network Access

```bash
# Allow your EC2 instance IP
mongocli atlas accessList create --ip 52.28.59.163 --comment "EC2 Instance"

# OR allow all IPs (for testing - less secure)
mongocli atlas accessList create --ip 0.0.0.0/0 --comment "Allow all"
```

## Step 5: Create Database User

```bash
# Create a database user (replace PASSWORD with a strong password)
mongocli atlas dbusers create \
  --username zakaa_user \
  --password YOUR_STRONG_PASSWORD \
  --role readWriteAnyDatabase \
  --authDatabase admin
```

## Step 6: Get Connection String

```bash
# Get the connection string
mongocli atlas clusters connectionstrings get zakaa-cluster

# This will output something like:
# mongodb+srv://zakaa-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

## Step 7: Update Environment Variables

```bash
# Edit your .env file
cd ~/zakaa
nano .env

# Add or update (replace with your actual connection string and password):
MONGODB_URI=mongodb+srv://zakaa_user:YOUR_PASSWORD@zakaa-cluster.xxxxx.mongodb.net/zakaa_db?retryWrites=true&w=majority

# Save and exit (Ctrl+X, Y, Enter)
```

## Step 8: Restart Application

```bash
pm2 restart zakaa
pm2 logs zakaa --lines 50
```

---

## Alternative: Manual Setup (Easier)

If the CLI is too complex, you can set up MongoDB Atlas manually through the web interface:

1. Go to https://cloud.mongodb.com/
2. Sign up/login
3. Click **"Build a Database"**
4. Choose **AWS** → **M0 Sandbox (Free)** → **US East (N. Virginia)**
5. Click **"Create"**
6. Wait 3-5 minutes for cluster to deploy
7. Go to **Security** → **Network Access** → Add IP: `52.28.59.163`
8. Go to **Security** → **Database Access** → Add user: `zakaa_user` with password
9. Go to **Database** → **Connect** → **Connect your application** → Copy connection string
10. Update `.env` file with the connection string
11. Restart: `pm2 restart zakaa`
