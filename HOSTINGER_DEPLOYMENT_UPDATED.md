# Hostinger Deployment Guide - Updated May 20, 2026

## Overview

This guide provides step-by-step instructions for deploying the updated Silver Taxi Sydney application to Hostinger with the latest branding, Twilio IVR flows, and lost property messaging.

## Prerequisites

- Hostinger account with Node.js hosting enabled
- Git access to the repository
- SSH access to the Hostinger server (if using direct deployment)
- Updated environment variables configured

## Deployment Method 1: Git Import (Recommended)

### Step 1: Prepare Repository

Ensure all changes are committed and pushed to GitHub:

```bash
cd /home/ubuntu/silver-service-online
git status  # Should show clean working directory
git log --oneline -5  # Verify latest commit includes Twilio updates
```

Latest commit should include:
- Branding updates (Silver Taxi Sydney)
- Lost property messaging
- Twilio IVR V1 and V2 flows
- TWILIO_UPDATES.md documentation

### Step 2: Access Hostinger Control Panel

1. Log in to Hostinger hPanel
2. Navigate to **Hosting** → **Manage**
3. Select your Node.js application
4. Go to **Git** section

### Step 3: Configure Git Deployment

1. Click **Connect Repository**
2. Select **GitHub** as source
3. Authorize Hostinger to access your GitHub account
4. Select repository: `springwoodtaxis-arch/silver-service-online`
5. Select branch: `main`
6. Set deployment path: `/home/ubuntu/silver-service-online` (or default)

### Step 4: Environment Variables

In Hostinger hPanel, navigate to **Environment Variables** and set:

```
# Twilio Configuration
TWILIO_ACCOUNT_SID=AC65b51fa00bc719c38cad12b5f69b79b0
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_FROM_NUMBER=+19592144266

# SMTP Configuration (Hostinger)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@silverserviceonline.com.au
SMTP_PASS=Au6GE4Jo2;

# Admin Configuration
ADMIN_EMAIL=info@silverserviceonline.com.au
ADMIN_PHONE=+61420439848
ADMIN_PASSWORD=Au6GE4Jo2;

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_PK=pk_live_51T89nY0OeJ3KrNPPFOCXkxyXMOKrrmEKjlj5B8VWHTcC7BW9Cv1kO828v21EIugUGuMPMUhjMAjpz0aQfdPJ6hik00JMAOayCy

# Google Maps API
MAPS_API_KEY=AIzaSyBrZTJSjvZP0YcvuAqLeSR0A5Y9OjyPxuM

# Telegram Notifications
TELEGRAM_BOT_TOKEN=8679067781:AAEH436Zpx4hmeHh04WGcbqlLc12R17wCEI
TELEGRAM_CHAT_ID=-1003441151525

# Resend Email API
RESEND_API_KEY=re_CwTpW4rQ_9DZSrHMNSaXLMosbMVnXwfbt

# MongoDB Connection
MONGODB_URI=mongodb+srv://sso-admin:SSOBookings2026!@sso-bookings.zuhw01d.mongodb.net/sso?appName=sso-bookings

# Node Environment
NODE_ENV=production
PORT=3000
```

### Step 5: Deploy Application

1. In Hostinger hPanel, click **Deploy** or **Redeploy**
2. Select the branch: `main`
3. Click **Deploy Now**
4. Wait for deployment to complete (typically 2-5 minutes)

### Step 6: Verify Deployment

Once deployment is complete:

1. Check application status in Hostinger hPanel
2. Visit your domain: `https://silverserviceonline.com.au`
3. Verify branding shows "Silver Taxi Sydney"
4. Test contact form - should show "For lost property" option
5. Check API health endpoint: `https://silverserviceonline.com.au/api/health`

Expected response:
```json
{
  "status": "ok",
  "services": {
    "twilio": "loaded",
    "email": "loaded",
    "stripe": "loaded"
  }
}
```

---

## Deployment Method 2: Manual ZIP Upload

### Step 1: Prepare Application

```bash
cd /home/ubuntu/silver-service-online
npm ci --omit=dev  # Install production dependencies
```

### Step 2: Create Deployment Package

```bash
# Exclude unnecessary files
zip -r silver-service-online.zip . \
  -x "node_modules/*" ".git/*" ".env*" "*.md" "*.log"
```

### Step 3: Upload to Hostinger

1. In Hostinger hPanel, go to **File Manager**
2. Navigate to application root directory
3. Upload `silver-service-online.zip`
4. Extract the ZIP file
5. Delete the ZIP file

### Step 4: Install Dependencies

In Hostinger terminal:
```bash
cd /path/to/application
npm ci --omit=dev
```

### Step 5: Set Environment Variables

Set all variables listed in Method 1, Step 4

### Step 6: Restart Application

In Hostinger hPanel:
1. Click **Restart Application**
2. Wait for application to restart

---

## Twilio IVR Deployment

### Update Twilio Studio Flows

1. Log in to Twilio Console
2. Navigate to **Studio** → **Flows**
3. Create new flow or update existing:

#### Option A: Import JSON Flow

1. Click **Create New Flow**
2. Select **Import from JSON**
3. Choose one of:
   - `twilio-ivr-v1-standard.json` (with agent escalation)
   - `twilio-ivr-v2-ai-automated.json` (fully automated)
4. Update HTTP request URLs to your Hostinger domain:
   - Replace `https://silverserviceonline.com.au` with your actual domain
   - Verify all endpoints are accessible

#### Option B: Manual Configuration

If importing JSON fails:
1. Create flow manually using the state diagrams in `TWILIO_UPDATES.md`
2. Configure HTTP requests to point to your backend
3. Test each state transition

### Configure Twilio Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Manage Numbers**
2. Select your incoming number
3. Under **Voice & Fax**:
   - Set **Accept incoming calls** to enabled
   - Set **Configure with** to **Studio Flow**
   - Select the flow you created above
4. Save configuration

### Test Twilio Integration

1. Call your Twilio number
2. Verify greeting says "Silver Taxi Sydney"
3. Test booking flow
4. Verify SMS confirmation is sent
5. Check booking appears in MongoDB

---

## Post-Deployment Verification

### 1. Website Branding Check

```bash
# Verify branding updates
curl https://silverserviceonline.com.au | grep "Silver Taxi Sydney" | wc -l
# Should return > 0
```

### 2. Contact Form Check

1. Visit https://silverserviceonline.com.au/contact
2. Click enquiry type dropdown
3. Verify "For lost property" option is present
4. Verify lost property banner shows "call 1 3 1 0 0 8"

### 3. API Endpoints Check

```bash
# Check health
curl https://silverserviceonline.com.au/api/health

# Check config
curl https://silverserviceonline.com.au/api/config

# Test booking endpoint (should return error for missing data)
curl -X POST https://silverserviceonline.com.au/api/booking \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

### 4. Twilio Integration Check

1. Call your Twilio number
2. Listen for greeting: "Thank you for calling Silver Taxi Sydney"
3. Verify lost property message: "For lost property, please call 1 3 1 0 0 8"
4. Complete a test booking
5. Verify SMS confirmation received

### 5. Database Check

```bash
# In MongoDB Atlas console
db.bookings.find({ site: "silver-ai" }).limit(1)
# Should show recent bookings from Twilio V2 flow
```

---

## Troubleshooting

### Application Won't Start

**Error:** "Cannot find module 'express'"

**Solution:**
```bash
npm ci --omit=dev
# or
npm install --production
```

### Twilio Calls Not Working

**Error:** "HTTP request failed"

**Solution:**
1. Verify environment variables are set correctly
2. Check Hostinger firewall allows outbound HTTPS
3. Verify API endpoints are responding:
   ```bash
   curl https://silverserviceonline.com.au/api/health
   ```

### SMS Not Sending

**Error:** "SMS delivery failed"

**Solution:**
1. Verify Twilio account has credits
2. Check phone number format (should be E.164)
3. Review Twilio logs for specific error

### Booking Not Created

**Error:** "Failed to save booking"

**Solution:**
1. Verify MongoDB connection string is correct
2. Check MongoDB Atlas IP whitelist includes Hostinger server
3. Verify MongoDB user has write permissions

---

## Rollback Procedure

If deployment causes issues:

### Method 1: Revert Git Deployment

1. In Hostinger hPanel, go to **Git** section
2. Click **Deploy** and select previous commit
3. Wait for deployment to complete

### Method 2: Manual Rollback

```bash
# SSH into Hostinger server
ssh user@hostinger-server

# Navigate to application
cd /path/to/application

# Revert to previous version
git revert HEAD
npm ci --omit=dev

# Restart application
pm2 restart silver-service
```

---

## Monitoring

### Enable Application Logs

In Hostinger hPanel:
1. Go to **Logs** section
2. Enable **Application Logs**
3. Monitor for errors

### Set Up Alerts

1. Configure Telegram notifications (already set up via `TELEGRAM_BOT_TOKEN`)
2. Check logs regularly for errors
3. Monitor booking success rate

### Performance Monitoring

```bash
# Check application status
pm2 status

# View logs
pm2 logs silver-service

# Monitor memory usage
pm2 monit
```

---

## Maintenance

### Regular Updates

1. Pull latest changes from GitHub
2. Test in staging environment first
3. Deploy to production during low-traffic hours
4. Monitor logs for errors

### Database Maintenance

1. Regular MongoDB backups (enabled in Atlas)
2. Archive old bookings periodically
3. Monitor database size

### SSL Certificate

Hostinger automatically manages SSL certificates. Verify:
- Certificate is valid: `https://silverserviceonline.com.au`
- Auto-renewal is enabled in Hostinger settings

---

## Support

For deployment issues:
1. Check Hostinger documentation: https://support.hostinger.com
2. Review application logs in Hostinger hPanel
3. Check Twilio documentation: https://www.twilio.com/docs
4. Contact Hostinger support with error logs

---

**Last Updated:** May 20, 2026
**Version:** 2.0
**Status:** Ready for Production Deployment
