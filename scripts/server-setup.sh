#!/bin/bash
# =============================================================================
# Silver Service Online — Production Server Setup Script
# Run this ONCE on your server to prepare it for CI/CD deployments.
# Tested on Ubuntu 20.04 / 22.04
# =============================================================================

set -e

REPO_URL="https://github.com/springwoodtaxis-arch/silver-service-online.git"
DEPLOY_PATH="/var/www/silver-service-online"
APP_USER="www-data"
DOMAIN="silverserviceonline.com.au"

echo "============================================"
echo " Silver Service Online — Server Setup"
echo "============================================"

# ── 1. Install Node.js 20 ──
echo "[1/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# ── 2. Install PM2 ──
echo "[2/7] Installing PM2..."
sudo npm install -g pm2

# ── 3. Install Nginx ──
echo "[3/7] Installing Nginx..."
sudo apt-get install -y nginx

# ── 4. Clone the repository ──
echo "[4/7] Cloning repository..."
sudo mkdir -p $DEPLOY_PATH
sudo chown $USER:$USER $DEPLOY_PATH
git clone $REPO_URL $DEPLOY_PATH
cd $DEPLOY_PATH

# ── 5. Create .env from template ──
echo "[5/7] Creating .env file..."
cp .env.example .env
echo ""
echo "⚠️  IMPORTANT: Edit $DEPLOY_PATH/.env with your real credentials before continuing."
echo "   Run: nano $DEPLOY_PATH/.env"
echo ""
read -p "Press ENTER once you have saved your .env file..."

# ── 6. Install dependencies and start with PM2 ──
echo "[6/7] Installing dependencies and starting app..."
npm ci --omit=dev
pm2 start server.js --name silver-service --env production
pm2 save
pm2 startup | tail -1 | sudo bash   # Enable PM2 on server reboot

# ── 7. Configure Nginx reverse proxy ──
echo "[7/7] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/silver-service > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # Static files — serve directly from Nginx (faster)
    location /images/ {
        root /var/www/silver-service-online/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        root /var/www/silver-service-online/public;
        expires 7d;
        add_header Cache-Control "public";
        try_files \$uri @proxy;
    }

    # All other requests — proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    location @proxy {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/silver-service /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "============================================"
echo " ✅ Setup complete!"
echo "============================================"
echo ""
echo " App running at: http://$DOMAIN"
echo " PM2 status:     pm2 status"
echo " PM2 logs:       pm2 logs silver-service"
echo " Nginx logs:     sudo tail -f /var/log/nginx/error.log"
echo ""
echo " Next step: Set up SSL with Let's Encrypt:"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo " Then add these GitHub Secrets in your repo settings:"
echo "   SSH_PRIVATE_KEY   — your server's SSH private key"
echo "   SERVER_HOST       — $DOMAIN (or server IP)"
echo "   SERVER_USER       — $(whoami)"
echo "   DEPLOY_PATH       — $DEPLOY_PATH"
echo "   TELEGRAM_BOT_TOKEN"
echo "   TELEGRAM_CHAT_ID"
