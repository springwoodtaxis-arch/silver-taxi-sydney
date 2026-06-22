#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Silver Taxi Sydney Service — Hostinger SSH Deploy Script
#  Run this via Hostinger SSH terminal to deploy v3.0 cleanly
# ─────────────────────────────────────────────────────────────────────────────
set -e

DEPLOY_PATH="/home/u848559930/domains/silvertaxisydneyservice.com/nodejs"
GITHUB_REPO="https://github.com/springwoodtaxis-arch/silver-taxi-sydney.git"

echo "=== Silver Taxi Sydney v3.0 Deploy ==="
echo "Deploy path: $DEPLOY_PATH"
echo ""

# Navigate to deploy directory
cd "$DEPLOY_PATH"

# Pull latest code
echo "[1/4] Pulling latest code from GitHub..."
git remote set-url origin "$GITHUB_REPO"
git fetch origin master
git reset --hard origin/master
echo "      Done."

# Install dependencies
echo "[2/4] Installing npm dependencies..."
npm install --production
echo "      Done."

# Restart the Node.js app via Hostinger passenger touch
echo "[3/4] Restarting Node.js app..."
mkdir -p tmp
touch tmp/restart.txt
echo "      Done."

# Health check
echo "[4/4] Waiting 5s then checking health..."
sleep 5
HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://silvertaxisydneyservice.com/api/health 2>/dev/null || echo "000")
echo "      Health check HTTP status: $HTTP"

if [ "$HTTP" = "200" ]; then
  echo ""
  echo "SUCCESS! Site is live at https://silvertaxisydneyservice.com"
else
  echo ""
  echo "WARNING: Health check returned $HTTP — check hPanel Node.js error log"
fi

echo ""
echo "=== Deploy complete ==="
