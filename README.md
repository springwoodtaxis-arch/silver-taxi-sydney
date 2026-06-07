# Silver Service Online — v2.0 Deployment Guide

## Overview

A fully premium, luxury-style Node.js/Express website for **Silver Service Online** — Sydney's premier taxi and chauffeur service.

---

## Features

| Feature | Status |
|---|---|
| Premium luxury homepage with hero image | ✅ Complete |
| 5-step booking wizard with Google Maps autocomplete | ✅ Complete |
| Accurate fare calculation (NSW metered rates) | ✅ Complete |
| Twilio SMS OTP phone verification | ✅ Complete |
| Stripe card payment integration | ✅ Complete (add key to activate) |
| Email confirmation (Hostinger SMTP) | ✅ Complete |
| Telegram admin notifications | ✅ Complete |
| Admin panel with booking management | ✅ Complete |
| Driver management system | ✅ Complete |
| Manage booking page (lookup by ref + phone) | ✅ Complete |
| Services, About, Contact, Airport Transfers pages | ✅ Complete |
| Contact form with email notification | ✅ Complete |
| Responsive mobile design | ✅ Complete |

---

## Quick Start

### 1. Install Dependencies

```bash
cd silver-service-online
npm install
```

### 2. Configure Environment

Edit `.env` and fill in your Twilio Auth Token and Stripe Secret Key:

```env
PORT=3000
TWILIO_ACCOUNT_SID=AC65b51fa00bc719c38cad12b5f69b79b0
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_FROM_NUMBER=+19592144266
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@silverserviceonline.com.au
SMTP_PASS=Au6GE4Jo2;
ADMIN_EMAIL=info@silverserviceonline.com.au
ADMIN_PHONE=+61420439848
ADMIN_PASSWORD=Au6GE4Jo2;
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_PK=pk_live_51T89nY0OeJ3KrNPPFOCXkxyXMOKrrmEKjlj5B8VWHTcC7BW9Cv1kO828v21EIugUGuMPMUhjMAjpz0aQfdPJ6hik00JMAOayCy
MAPS_API_KEY=AIzaSyBrZTJSjvZP0YcvuAqLeSR0A5Y9OjyPxuM
TELEGRAM_BOT_TOKEN=8679067781:AAEH436Zpx4hmeHh04WGcbqlLc12R17wCEI
TELEGRAM_CHAT_ID=7009455963
```

### 3. Start the Server

```bash
# Production
npm start

# Development (with auto-restart)
npm run dev
```

Server runs on port 3000 by default.

---

## Admin Panel

Access at: `https://yoursite.com/admin`

**Login credentials:**
- Email: `info@silverserviceonline.com.au`
- Password: `Au6GE4Jo2;`

**Admin features:**
- Dashboard with live stats and charts
- View all bookings with search/filter
- Update booking status (Pending → Confirmed → Assigned → Completed)
- Assign drivers to bookings
- Create manual bookings
- Driver management (add/deactivate/delete)
- Reports and revenue analytics
- Export bookings to CSV

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| POST | `/api/fare` | Calculate fare (pickup, dropoff, vehicle) |
| POST | `/api/send-otp` | Send SMS OTP to phone |
| POST | `/api/verify-otp` | Verify OTP code |
| POST | `/api/book` | Create a booking |
| POST | `/api/manage` | Lookup booking by ref + phone |
| POST | `/api/contact` | Submit contact form |
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/bookings` | Get all bookings |
| POST | `/api/admin/bookings` | Create booking (admin) |
| POST | `/api/admin/booking/:id/status` | Update booking status |
| POST | `/api/admin/booking/:id/assign` | Assign driver |
| GET | `/api/admin/drivers` | Get all drivers |
| POST | `/api/admin/drivers` | Add driver |
| DELETE | `/api/admin/driver/:id` | Delete driver |

---

## Fare Structure

All fares use official NSW taxi metered rates:

| Vehicle | Flag Fall | Per km (0-5km) | Per km (5-10km) | Per km (10-28km) |
|---|---|---|---|---|
| Sedan | $7.40 | $4.70 | $4.50 | $3.55 |
| Lexus | $7.40 | $4.70 | $4.55 | $3.55 |
| SUV | $7.40 | $4.80 | $4.50 | $3.65 |
| Maxi | $14.00 | $6.50 | $6.20 | $5.10 |

- Minimum fare: **$50 AUD** (minimum 8km)
- Booking fee: **$2.50** (online bookings)
- Return trip discount: **10% off**
- Tolls calculated separately

---

## Pages

| URL | Page |
|---|---|
| `/` | Homepage |
| `/book` | Booking wizard |
| `/services` | Fleet & services |
| `/airport-transfers` | Airport transfer info |
| `/about` | About us |
| `/contact` | Contact form |
| `/manage` | Manage booking |
| `/admin` | Admin panel |

---

## Production Deployment

### Using PM2 (recommended)

```bash
npm install -g pm2
pm2 start server.js --name "silver-service"
pm2 save
pm2 startup
```

### Using systemd

```ini
[Unit]
Description=Silver Service Online
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/silver-service-online
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name silverserviceonline.com.au www.silverserviceonline.com.au;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Notes

- **In-memory storage**: Bookings are stored in RAM. For production, integrate MongoDB or PostgreSQL.
- **Twilio**: Add your Auth Token to `.env` to enable real SMS. Without it, OTP codes are logged to console.
- **Stripe**: Add your Secret Key to `.env` to enable card payments. Without it, bookings proceed as cash.
- **Google Maps**: The Maps API key is pre-configured for address autocomplete and distance calculation.

---

*Silver Service Online v2.0 — Built for silverserviceonline.com.au*
