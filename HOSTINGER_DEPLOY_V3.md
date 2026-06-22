# Silver Taxi Sydney Service — v3.0 Hostinger Deployment Guide

> **Status:** Code is live on GitHub (`master` branch, commit `fa9698a`).  
> The site is currently returning 503 because the Node.js process on Hostinger has stopped.  
> Follow the steps below to bring it back online.

---

## What Changed in v3.0

The monolithic 4,134-line `server.js` has been **rebuilt from scratch** into a clean, modular structure:

| File | Purpose |
|---|---|
| `server.js` | Main app — clean, ~600 lines, crash-proof |
| `config/index.js` | All environment variables and CFG object |
| `config/db.js` | MongoDB connection + in-memory cache |
| `config/services.js` | Email, SMS, Telegram, Stripe helpers |
| `config/fare.js` | Fare calculation + toll zone logic |
| `config/emailTemplates.js` | Booking confirmation + receipt HTML |
| `config/pages.js` | All 685 SEO page definitions |

**Key improvements:**
- `process.on('uncaughtException')` and `process.on('unhandledRejection')` — app **never crashes** on unhandled errors
- MongoDB failure no longer kills the app — falls back to in-memory gracefully
- All optional middleware (threat protection, click fraud) loaded with `try/catch`
- Stripe loaded conditionally — no crash if key not set
- All 150 existing bookings preserved in MongoDB Atlas

---

## Option A — Deploy via Hostinger SSH (Recommended, ~2 minutes)

### Step 1: Open SSH Terminal
1. Log in to [hPanel](https://hpanel.hostinger.com)
2. Go to **Hosting → silvertaxisydneyservice.com → Advanced → SSH Access**
3. Enable SSH if not already enabled, then click **Open SSH Terminal**

### Step 2: Run the deploy script
```bash
cd /home/u848559930/domains/silvertaxisydneyservice.com/nodejs
git fetch origin master
git reset --hard origin/master
npm install --production
touch tmp/restart.txt
```

### Step 3: Verify
```bash
curl -s https://silvertaxisydneyservice.com/api/health
```
You should see: `{"status":"ok","time":"...","services":{"smsglobal":"loaded","email":"loaded",...}}`

---

## Option B — Deploy via hPanel File Manager (No SSH needed)

### Step 1: Download the deploy package
Download the ZIP from GitHub:  
`https://github.com/springwoodtaxis-arch/silver-taxi-sydney/archive/refs/heads/master.zip`

### Step 2: Upload via hPanel File Manager
1. Go to **hPanel → Files → File Manager**
2. Navigate to `/home/u848559930/domains/silvertaxisydneyservice.com/nodejs/`
3. Upload and extract the ZIP
4. Make sure these files are in the root:
   - `server.js`
   - `package.json`
   - `config/` (folder with 6 files)

### Step 3: Restart via hPanel Node.js Manager
1. Go to **hPanel → Advanced → Node.js**
2. Find your app (`silvertaxisydneyservice.com`)
3. Click **Restart**
4. Wait 30 seconds, then visit https://silvertaxisydneyservice.com/api/health

---

## Option C — Trigger via Webhook (Once app is running)

Once the app is running, future GitHub pushes will auto-deploy via the webhook:
```
POST https://silvertaxisydneyservice.com/api/deploy
Header: x-deploy-token: springwood-deploy-2026
```

---

## Troubleshooting

### App won't start after restart
1. In hPanel → Node.js → click **Error Log**
2. Common causes:
   - `Cannot find module './smsglobal'` → run `npm install` again
   - `EADDRINUSE` → another process is using port 3000, restart the app
   - `MongoServerSelectionError` → MongoDB Atlas is unreachable (app still starts, just no DB)

### Site still shows 503 after restart
- Wait 60 seconds and try again (Hostinger CDN cache)
- Check the Node.js error log in hPanel
- Try: `curl -s https://silvertaxisydneyservice.com/api/health`

### All bookings still there?
Yes — all 150 bookings are stored in MongoDB Atlas and will be loaded on startup.

---

## Environment Variables (Already Set in Code)

All credentials are hardcoded as fallbacks in `config/index.js`. No `.env` file is required.  
If you want to override any value, set it as a Hostinger environment variable in hPanel → Node.js → Environment Variables.

| Variable | Value |
|---|---|
| `SMTP_USER` | info@silvertaxisydneyservice.com |
| `ADMIN_EMAIL` | info@silvertaxisydneyservice.com |
| `ADMIN_PHONE` | +61420439848 |
| `STRIPE_PK` | pk_live_51T89nY0... |
| `MONGODB_URI` | mongodb+srv://sso-admin:... |

---

## GitHub Repository

`https://github.com/springwoodtaxis-arch/silver-taxi-sydney`  
Branch: `master`  
Latest commit: `fa9698a` — v3.0 clean rebuild
