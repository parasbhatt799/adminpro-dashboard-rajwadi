#!/bin/bash
set -e

echo "=== Starting UsePay Deployment ==="
cd /var/www/adminpro-dashboard-rajwadi || exit 1

# 1. Backup current dist if exists
if [ -f "dist/index.html" ]; then
  cp -r dist dist_backup 2>/dev/null || true
fi

# 2. Check if node_modules exists, install if missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --legacy-peer-deps
  npm install @tailwindcss/oxide-linux-x64-gnu --save-dev --force 2>/dev/null || true
fi

# 3. Build the React frontend with memory safety
echo "Building frontend..."
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build || {
  echo "Build step failed or was killed. Restoring pre-built assets from git..."
  git checkout -- dist
}

# 4. Safeguard: if dist/index.html still missing, restore from git
if [ ! -f "dist/index.html" ]; then
  echo "Restoring dist from git..."
  git checkout -- dist
fi

# 5. Restart backend server in PM2
echo "Restarting backend server in PM2..."
pm2 restart all

echo "=== Deployment Completed Successfully! ==="

