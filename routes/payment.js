'use strict';
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
let QRCode = null;
try { QRCode = require('qrcode'); } catch(e) { console.warn('[QR] qrcode package not available, QR endpoint will return 404'); }

// Token secret — persistent across restarts (no external packages needed)
const TOKEN_SECRET = process.env.JWT_SECRET || process.env.STRIPE_SECRET_KEY || 'ss-driver-pay-secret-2026';

// ── Stripe ──
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
let stripe = null;
try { stripe = require('stripe')(STRIPE_SECRET); } catch(e) {}

// ── Twilio ──
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID  || 'AC65b51fa00bc719c38cad12b5f69b79b0';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER   || '+19592144266';
let twilio = null;
try { twilio = require('twilio')(TWILIO_SID, TWILIO_TOKEN); } catch(e) {}

// ── Config ──
const DRIVER_PHONE  = '0420439848';           // Only this number can log in
const DRIVER_PHONE_E164 = '+61420439848';
const COMPANY_NAME  = 'SS Taxi Sydney NSW';

// ── OTP store: phone → { code, expires, attempts } ──
const otpStore = new Map();

// ── HMAC token helpers (survive server restarts, no extra packages) ──
// Token format: base64(phone:expiry):hmac
function signToken(phone) {
  const expiry = Date.now() + 90 * 24 * 60 * 60 * 1000; // 90 days
  const payload = Buffer.from(phone + ':' + expiry).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifyToken(token) {
  try {
    const [payload, sig] = (token || '').split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const decoded = Buffer.from(payload, 'base64url').toString();
    const [phone, expiry] = decoded.split(':');
    if (Date.now() > Number(expiry)) return null;
    return { phone };
  } catch(e) { return null; }
}

// ── In-memory trip storage ──
const trips = new Map();

// ── Stripe product IDs ──
const STRIPE_PRODUCTS = {
  fare:          'prod_UWZGfgy7b6IyTU',
  extras:        'prod_UWZGKd5MSfrl8B',
  serviceFee:    'prod_UWZGQyDXPn7ZRr',
  serviceFeeGst: 'prod_UWZGKFtpwca77Y',
};

// ── Auth middleware ──
function checkDriverAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  // Accept token from Authorization header OR query param (needed for img src GET requests)
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.auth || null);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyToken(token);
  if (!payload || payload.phone !== DRIVER_PHONE_E164) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  req.driverToken = token;
  next();
}

// ── Normalise AU phone to E.164 ──
function toE164(phone) {
  let p = (phone || '').replace(/\s/g, '');
  if (p.startsWith('04')) return '+61' + p.slice(1);
  if (p.startsWith('614') && !p.startsWith('+')) return '+' + p;
  return p;
}

// ── CabFare-style totals ──
function calculateTotals(fareIncGst, extrasIncGst = 0, tipAmount = 0) {
  const fare   = parseFloat(fareIncGst)   || 0;
  const extras = parseFloat(extrasIncGst) || 0;
  const tip    = parseFloat(tipAmount)    || 0;
  const totalFare     = parseFloat((fare + extras + tip).toFixed(2));
  const serviceFee    = parseFloat((totalFare * 0.05).toFixed(2));
  const serviceFeeGst = parseFloat((serviceFee / 10).toFixed(2));
  const grandTotal    = parseFloat((totalFare + serviceFee + serviceFeeGst).toFixed(2));
  return { fareIncGst: parseFloat(fare.toFixed(2)), extrasIncGst: parseFloat(extras.toFixed(2)), tipAmount: parseFloat(tip.toFixed(2)), totalFare, serviceFee, serviceFeeGst, grandTotal };
}

// ── Build Stripe payment link ──
async function buildStripePaymentLink(totals, routeDesc, meta, redirectUrl) {
  const fareCents      = Math.round(totals.fareIncGst * 100);
  const extrasCents    = Math.round(totals.extrasIncGst * 100);
  const tipCents       = Math.round(totals.tipAmount * 100);
  const svcFeeCents    = Math.round(totals.serviceFee * 100);
  const svcFeeGstCents = Math.round(totals.serviceFeeGst * 100);

  // Use inline product_data for Fare so the description is dynamic (route + time) per trip
  // Using a fixed product ID would show the product's stored description (which is static/stale)
  const fareDesc = `${routeDesc} | Company: SS Taxi Sydney NSW`;
  const lineItems = [
    { price_data: { currency: 'aud', product_data: { name: 'Fare (inclusive of GST)', description: fareDesc }, unit_amount: fareCents   }, quantity: 1 },
    { price_data: { currency: 'aud', product_data: { name: 'Extras',                  description: 'Additional charges (tolls, waiting time, etc.)' }, unit_amount: extrasCents }, quantity: 1 },
  ];
  if (tipCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Tip', description: 'Gratuity' }, unit_amount: tipCents }, quantity: 1 });
  }
  lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Service Fee',     description: 'Card processing fee (excl. GST)' }, unit_amount: svcFeeCents    }, quantity: 1 });
  lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Service Fee GST', description: 'GST on card processing fee'         }, unit_amount: svcFeeGstCents }, quantity: 1 });

  const pl = await stripe.paymentLinks.create({
    line_items: lineItems,
    metadata: { ...meta, route: routeDesc, fare: totals.fareIncGst.toFixed(2), service_fee: totals.serviceFee.toFixed(2), total: totals.grandTotal.toFixed(2) },
    after_completion: { type: 'redirect', redirect: { url: redirectUrl || 'https://silvertaxisydneyservice.com' } },
  });
  return pl;
}

// ─────────────────────────────────────────────
// POST /api/payment/send-otp
// Sends a 6-digit OTP to the registered driver phone
// ─────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  const normalised = toE164(phone || '');
  if (normalised !== DRIVER_PHONE_E164) {
    // Don't reveal that the number is wrong — just say "sent"
    return res.json({ success: true, message: 'If that number is registered, a code has been sent.' });
  }

  const code    = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  otpStore.set(normalised, { code, expires, attempts: 0 });

  const msg = `SS Taxi Pay: Your login code is ${code}. Valid for 5 minutes. Do not share this code.`;

  if (twilio) {
    try {
      await twilio.messages.create({ body: msg, from: TWILIO_FROM, to: DRIVER_PHONE_E164 });
      console.log('[OTP] Sent to', DRIVER_PHONE_E164);
    } catch(e) {
      console.error('[OTP] Twilio error:', e.message);
      return res.status(500).json({ success: false, error: 'Failed to send SMS. Please try again.' });
    }
  } else {
    console.log('[OTP mock] Code for', DRIVER_PHONE_E164, ':', code);
  }

  res.json({ success: true, message: 'Code sent to your registered number.' });
});

// ─────────────────────────────────────────────
// POST /api/payment/verify-otp
// Verifies the OTP and returns a session token
// ─────────────────────────────────────────────
router.post('/verify-otp', (req, res) => {
  const { phone, code } = req.body;
  const normalised = toE164(phone || '');
  const entry = otpStore.get(normalised);

  if (!entry) {
    return res.status(401).json({ success: false, error: 'No code found. Please request a new code.' });
  }
  if (Date.now() > entry.expires) {
    otpStore.delete(normalised);
    return res.status(401).json({ success: false, error: 'Code expired. Please request a new code.' });
  }
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts > 5) {
    otpStore.delete(normalised);
    return res.status(429).json({ success: false, error: 'Too many attempts. Please request a new code.' });
  }
  if (String(code).trim() !== entry.code) {
    return res.status(401).json({ success: false, error: 'Incorrect code. Please try again.' });
  }

  // Valid — create JWT (survives server restarts for 90 days)
  otpStore.delete(normalised);
  const token = signToken(normalised);
  res.json({ success: true, token, driver: { phone: DRIVER_PHONE } });
});

// ─────────────────────────────────────────────
// POST /api/payment/logout
// ─────────────────────────────────────────────
router.post('/logout', (req, res) => {
  // JWT is stateless — client just deletes the token from localStorage
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// POST /api/payment/generate-link
// ─────────────────────────────────────────────
router.post('/generate-link', checkDriverAuth, async (req, res) => {
  const { fareIncGst, extrasAmount = 0, tipAmount = 0, pickupLocation = '', dropLocation = '', pickupTime = '', vehicleNumber = '', passengerName = '' } = req.body;
  if (!fareIncGst || parseFloat(fareIncGst) <= 0) {
    return res.status(400).json({ error: 'Fare amount is required' });
  }

  const totals = calculateTotals(parseFloat(fareIncGst), parseFloat(extrasAmount), parseFloat(tipAmount));

  const puSuburb  = (pickupLocation || '').split(',')[0].trim() || 'Pickup';
  const doSuburb  = (dropLocation  || '').split(',')[0].trim() || 'Drop-off';
  const pickupDt  = pickupTime ? new Date(pickupTime) : new Date();
  // Always format in Sydney time (AEST/AEDT) regardless of server timezone
  const sydneyTZ  = 'Australia/Sydney';
  const dateStr   = pickupDt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: sydneyTZ });
  const timeStr   = pickupDt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: sydneyTZ });
  const routeDesc = `${puSuburb} → ${doSuburb} | ${dateStr} at ${timeStr}`;

  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured', totals });
  }

  try {
    const pl = await buildStripePaymentLink(totals, routeDesc,
      { vehicle: vehicleNumber, passenger: passengerName, pickup: pickupLocation, dropoff: dropLocation },
      'https://silvertaxisydneyservice.com'
    );
    res.json({ success: true, url: pl.url, linkId: pl.id, totals, route: routeDesc });
  } catch (e) {
    console.error('[STRIPE] Generate link error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/payment/trip
// ─────────────────────────────────────────────
router.post('/trip', checkDriverAuth, async (req, res) => {
  const { vehicleNumber, pickupLocation, dropLocation, pickupTime, baseFare, extrasAmount = 0, tipAmount = 0, passengerName = '' } = req.body;
  if (!vehicleNumber || !pickupLocation || !dropLocation || !baseFare) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const totals  = calculateTotals(parseFloat(baseFare), parseFloat(extrasAmount), parseFloat(tipAmount));
  const tripId  = crypto.randomBytes(8).toString('hex');
  const puSuburb = (pickupLocation || '').split(',')[0].trim();
  const doSuburb = (dropLocation  || '').split(',')[0].trim();
  const pickupDt = pickupTime ? new Date(pickupTime) : new Date();
  // Always format in Sydney time (AEST/AEDT) regardless of server timezone
  const sydneyTZ  = 'Australia/Sydney';
  const dateStr  = pickupDt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: sydneyTZ });
  const timeStr  = pickupDt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: sydneyTZ });
  const routeDesc = `${puSuburb} → ${doSuburb} | ${dateStr} at ${timeStr}`;

  const trip = {
    id: tripId, vehicleNumber, company: COMPANY_NAME,
    pickupLocation, dropLocation, pickupTime: pickupDt,
    ...totals, passengerName, paymentStatus: 'pending', createdAt: new Date(),
  };
  trips.set(tripId, trip);

  let paymentLink = `${req.protocol}://${req.get('host')}/pay/${tripId}`;
  if (stripe) {
    try {
      const pl = await buildStripePaymentLink(totals, routeDesc,
        { trip_id: tripId, vehicle: vehicleNumber, pickup: pickupLocation, dropoff: dropLocation },
        `https://silvertaxisydneyservice.com/booking-confirmed?ref=${tripId}`
      );
      paymentLink = pl.url;
      trip.stripePaymentLink = pl.url;
    } catch (e) { console.error('[STRIPE] Trip link error:', e.message); }
  }

  res.json({ success: true, trip, paymentLink, totals });
});

// GET /api/payment/trip/:tripId
router.get('/trip/:tripId', (req, res) => {
  const trip = trips.get(req.params.tripId);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json({ success: true, trip });
});

// POST /api/payment/confirm
router.post('/confirm', (req, res) => {
  const { tripId, paymentStatus } = req.body;
  const trip = trips.get(tripId);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  trip.paymentStatus = paymentStatus;
  trip.paidAt = new Date();
  res.json({ success: true, trip });
});

// GET /api/payment/trips
router.get('/trips', checkDriverAuth, (req, res) => {
  const allTrips = Array.from(trips.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, trips: allTrips });
});

// GET /api/payment/analytics
router.get('/analytics', checkDriverAuth, (req, res) => {
  const allTrips = Array.from(trips.values());
  res.json({ success: true, stats: {
    totalTrips:      allTrips.length,
    completedTrips:  allTrips.filter(t => t.paymentStatus === 'completed').length,
    pendingTrips:    allTrips.filter(t => t.paymentStatus === 'pending').length,
    totalRevenue:    allTrips.filter(t => t.paymentStatus === 'completed').reduce((s, t) => s + (t.grandTotal || 0), 0),
  }});
});

// ─────────────────────────────────────────────
// GET /api/payment/qr?data=<url>
// Returns a PNG QR code image for the given URL
// Used by payment.html for reliable Safari iOS rendering
// ─────────────────────────────────────────────
router.get('/qr', checkDriverAuth, async (req, res) => {
  const data = req.query.data;
  if (!data) return res.status(400).json({ error: 'data parameter required' });
  if (!QRCode) return res.status(503).json({ error: 'QR service unavailable' });
  try {
    const buf = await QRCode.toBuffer(data, { type: 'png', width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch(e) {
    console.error('[QR] Error generating QR:', e.message);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

module.exports = router;
