# Deploying silvertaxisydneyservice.com — Separate from silverserviceonline.com.au

> **IMPORTANT:** This repo (`silver-taxi-sydney`) is ONLY for **silvertaxisydneyservice.com**.
> Do NOT use this repo for silverserviceonline.com.au — that domain uses the `silver-service-online` repo.

---

## Method 1 — GitHub Auto-Deploy via hPanel (Recommended)

### Step 1 — Log into hPanel
Go to [hpanel.hostinger.com](https://hpanel.hostinger.com) and log in.

### Step 2 — Find silvertaxisydneyservice.com
1. Click **Websites** in the left sidebar
2. Find **silvertaxisydneyservice.com** → click **Manage**
3. Go to **Node.js** section

### Step 3 — Connect the GitHub Repository
- Repository: **springwoodtaxis-arch / silver-taxi-sydney**
- Branch: **master**
- Entry file: `server.js`
- Build command: `npm install`
- Node.js version: `20.x`

### Step 4 — Environment Variables
| Variable | Value |
|---|---|
| `PORT` | `3000` |
| `TWILIO_ACCOUNT_SID` | `AC65b51fa00bc719c38cad12b5f69b79b0` |
| `TWILIO_FROM_NUMBER` | `+19592144266` |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `info@silvertaxisydneyservice.com` |
| `SMTP_PASS` | `Au6GE4Jo2;` |
| `ADMIN_EMAIL` | `info@silvertaxisydneyservice.com` |
| `ADMIN_PHONE` | `+61420439848` |
| `ADMIN_PASSWORD` | `Au6GE4Jo2;` |
| `STRIPE_SECRET_KEY` | `STRIPE_SECRET_KEY_SET_VIA_ENV` |
| `STRIPE_PK` | `pk_live_51T89nY0OeJ3KrNPPFOCXkxyXMOKrrmEKjlj5B8VWHTcC7BW9Cv1kO828v21EIugUGuMPMUhjMAjpz0aQfdPJ6hik00JMAOayCy` |
| `MAPS_API_KEY` | `AIzaSyBrZTJSjvZP0YcvuAqLeSR0A5Y9OjyPxuM` |
| `TELEGRAM_BOT_TOKEN` | `8679067781:AAEH436Zpx4hmeHh04WGcbqlLc12R17wCEI` |
| `TELEGRAM_CHAT_ID` | `-1003441151525` |
| `WEBHOOK_SECRET` | `springwood-deploy-2026` |

### Step 5 — Deploy
Click **Deploy** and wait ~2 minutes.

### Step 6 — GitHub Webhook for Auto-Deploy on Push
In GitHub → silver-taxi-sydney → Settings → Webhooks → Add webhook:
- **Payload URL:** `https://silvertaxisydneyservice.com/api/deploy`
- **Content type:** `application/json`
- **Secret:** `springwood-deploy-2026`
- **Events:** Push to `master` only

---

## Method 2 — Upload ZIP (Manual)

1. Upload `silver-taxi-sydney-deploy.zip` via hPanel File Manager
2. Extract to `/home/u848559930/domains/silvertaxisydneyservice.com/nodejs/`
3. In hPanel → Node.js App → click **Restart**

---

## Domain Separation

| Domain | Repo | Branch |
|---|---|---|
| silvertaxisydneyservice.com | `silver-taxi-sydney` | `master` |
| silverserviceonline.com.au | `silver-service-online` | `main` |

These are **completely independent** — changes to one do NOT affect the other.

---

## Verify
- Health: https://silvertaxisydneyservice.com/api/health
- New pages: https://silvertaxisydneyservice.com/camden-council-taxi/
- Sitemap: https://silvertaxisydneyservice.com/sitemap.xml (should show 1080 URLs)
