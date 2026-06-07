# Deploying to Hostinger Business Hosting

## Method 1 — Deploy from GitHub (Recommended, Automatic CI/CD)

This method connects your GitHub repo to Hostinger so every push to `main` auto-deploys.

### Step 1 — Log into hPanel
Go to [hpanel.hostinger.com](https://hpanel.hostinger.com) and log in.

### Step 2 — Add a New Website
1. Click **Websites** in the left sidebar
2. Click **Add Website**
3. Select **Node.js Apps**
4. Select **Import Git Repository**

### Step 3 — Authorise GitHub
Click **Authorise** when prompted — this links your `springwoodtaxis-arch` GitHub account to Hostinger.

### Step 4 — Select Repository
Choose: **springwoodtaxis-arch / silver-service-online**

### Step 5 — Configure Build Settings
Hostinger will auto-detect Express.js. Confirm these settings:

| Setting | Value |
|---|---|
| Framework | **Other** (Express.js) |
| Branch | `main` |
| Entry file | `server.js` |
| Build command | `npm install` |
| Node.js version | `20.x` |

### Step 6 — Add Environment Variables
Before clicking Deploy, click **Environment Variables** and add each of these:

| Variable | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | `AC65b51fa00bc719c38cad12b5f69b79b0` |
| `TWILIO_AUTH_TOKEN` | *(your Twilio auth token)* |
| `TWILIO_FROM_NUMBER` | `+19592144266` |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `info@silverserviceonline.com.au` |
| `SMTP_PASS` | `Au6GE4Jo2;` |
| `ADMIN_EMAIL` | `info@silverserviceonline.com.au` |
| `ADMIN_PHONE` | `+61420439848` |
| `ADMIN_PASSWORD` | `Au6GE4Jo2;` |
| `STRIPE_SECRET_KEY` | *(your Stripe secret key)* |
| `STRIPE_PK` | `pk_live_51T89nY0OeJ3KrNPPFOCXkxyXMOKrrmEKjlj5B8VWHTcC7BW9Cv1kO828v21EIugUGuMPMUhjMAjpz0aQfdPJ6hik00JMAOayCy` |
| `MAPS_API_KEY` | `AIzaSyBrZTJSjvZP0YcvuAqLeSR0A5Y9OjyPxuM` |
| `TELEGRAM_BOT_TOKEN` | `8679067781:AAEH436Zpx4hmeHh04WGcbqlLc12R17wCEI` |
| `TELEGRAM_CHAT_ID` | `7009455963` |

### Step 7 — Deploy
Click **Deploy**. Hostinger will:
1. Clone your repository
2. Run `npm install`
3. Start the app with `node server.js`
4. Point `silverserviceonline.com.au` to the running app

---

## Method 2 — Upload ZIP File (Manual)

Use this if you prefer not to use GitHub integration.

### Step 1 — Download the ZIP
Download `silver-service-online-v2.zip` (provided separately).

### Step 2 — Add a New Website
1. Log into [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Click **Websites → Add Website**
3. Select **Node.js Apps**
4. Select **Upload your website files**

### Step 3 — Upload the ZIP
Upload `silver-service-online-v2.zip` and wait for it to extract.

### Step 4 — Configure Settings
| Setting | Value |
|---|---|
| Framework | Other (Express.js) |
| Entry file | `server.js` |
| Build command | `npm install` |
| Node.js version | `20.x` |

### Step 5 — Add Environment Variables
Add all the same variables listed in Method 1, Step 6 above.

### Step 6 — Deploy
Click **Deploy** and wait ~2 minutes for the app to go live.

---

## After Deployment

### Connect Your Domain
1. In hPanel, go to **Domains**
2. Point `silverserviceonline.com.au` to your new Node.js app
3. Enable **Free SSL** (Let's Encrypt) — click the SSL button in hPanel

### Verify the Site is Live
Visit: https://silverserviceonline.com.au/api/health

You should see: `{"status":"ok","time":"..."}`

### Admin Panel
Visit: https://silverserviceonline.com.au/admin
Password: `Au6GE4Jo2;`

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Site shows 503 error | App is still starting — wait 2 minutes and refresh |
| Site shows 403 error | Check `.htaccess` in `public_html` — redeploy from hPanel |
| Environment variables not working | Go to hPanel → Node.js App → Environment Variables and verify all are set |
| App crashes on start | Go to hPanel → Node.js App → Logs to see the error |
| Booking emails not sending | Verify `SMTP_PASS` is correct in Environment Variables |
