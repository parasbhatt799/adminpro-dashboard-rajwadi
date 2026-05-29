#!/bin/bash
echo "=== Starting UsePay Deployment Rescue ==="
echo "1. Cleaning up old Windows-specific node_modules and lock file..."
rm -rf node_modules package-lock.json

echo "2. Re-installing clean Linux-specific dependencies..."
npm install

echo "2.5. Force-installing Linux-specific Tailwind oxide bindings to bypass npm bug..."
npm install @tailwindcss/oxide-linux-x64-gnu --save-dev --force

echo "3. Building the React frontend..."
npm run build

echo "4. Restarting the backend server in PM2..."
pm2 restart all

echo "=== Deployment Completed Successfully! ==="
