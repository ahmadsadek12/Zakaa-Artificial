#!/bin/bash
# Script to update frontend on server
# Run this after pulling latest changes

set -e

echo "🚀 Updating Frontend..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found. Are you in the project root?"
    exit 1
fi

# Navigate to frontend directory
cd frontend

# Install dependencies (in case new packages were added)
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
npm install

# Check if .env file exists, if not create it
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚙️ Creating frontend .env file...${NC}"
    # Use HTTPS with same domain (assuming API is on same domain)
    # Change this to your actual domain or API subdomain
    cat > .env << EOF
VITE_API_URL=https://zakaa-artificial.com
EOF
    echo "Created .env with VITE_API_URL=https://zakaa-artificial.com"
else
    # Update existing .env to use HTTPS
    echo -e "${YELLOW}⚙️ Updating frontend .env file to use HTTPS...${NC}"
    # Replace HTTP with HTTPS and placeholder with actual domain
    sed -i 's|http://your_ec2_ip_or_domain|https://zakaa-artificial.com|g' .env
    sed -i 's|http://[^/]*|https://zakaa-artificial.com|g' .env || true
    echo "Updated .env to use HTTPS"
fi

# Build frontend for production
echo -e "${YELLOW}🏗️ Building frontend for production...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend built successfully!${NC}"
    echo ""
    echo "Frontend build is in: frontend/dist"
    echo ""
    echo "If nginx is configured correctly, it should automatically serve the new build."
    echo "To reload nginx (if needed): sudo systemctl reload nginx"
else
    echo "❌ Frontend build failed!"
    exit 1
fi

# Go back to root
cd ..

echo -e "${GREEN}🎉 Frontend update complete!${NC}"
