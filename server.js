'use strict';

const express = require('express');
const path    = require('path');
const crypto  = require('crypto');
const geoip   = require('geoip-lite');
const { threatMiddleware, recordConversion, unblockFingerprint, blockFingerprint, getThreatReport, checkIPStack } = require('./middleware/threatProtection');
const { clickFraudMiddleware, buildServerFingerprint, mergeFingerprints, recordAdClick, recordFraudConversion, getFraudReport, blockIP, unblockIP, getIPBlocklist, generateExclusionCSV, getDailyStats, calculateRiskScore, riskLabel } = require('./middleware/clickFraud');

// Load .env if present
try {
  require('fs').readFileSync(path.join(__dirname, '.env'), 'utf8')
    .split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    });
} catch(e) {}

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');
// -------------------- Flight Tracking Shared State --------------------
// verifiedPhones: Set of phone numbers that have completed OTP verification
// Used to gate AviationStack API calls (100 req/mo free tier)
const verifiedPhones = new Set();
const flightCache    = new Map(); // fn -> { data, ts } — 5 min cache per flight number
app.use(express.json());
app.use(require('compression')());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(function(req, res, next) {
  const allowed = [
    'https://silvertaxisydneyservice.com',
    'https://www.silvertaxisydneyservice.com',
    'https://silvertaxisydneyservice.com',
    'https://www.silvertaxisydneyservice.com',
    'https://13cabssydney.com',
    'https://www.13cabssydney.com',
  ];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// -------------------- CANONICAL STATIC PAGE URLS --------------------
// Redirect public .html page URLs to their canonical extensionless paths.
// Keep Google verification files available exactly as requested by Search Console.
app.use((req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  if (!req.path.endsWith('.html')) return next();
  if (req.path.startsWith('/google') || req.path.startsWith('/.well-known/')) return next();

  const canonicalPath = req.path.replace(/\.html$/, '') || '/';
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(301, `${canonicalPath}${query}`);
});

// ==================== MASS SEO LOCATION PAGES ====================
// Auto-generated: 679 pages (643 suburbs + 33 councils + 2 airports + 1 hub)
// Serve location pages with clean /locations/{slug}/ URLs
app.use('/locations', express.static(path.join(PUBLIC_DIR, 'locations'), {
  extensions: ['html'],
  index: 'index.html'
}));
app.get('/locations', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'locations', 'index.html')));
app.get('/locations/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'locations', 'index.html')));
app.get('/sitemap-html', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'sitemap-html.html')));
app.get('/feed.xml', (req, res) => { res.setHeader('Content-Type', 'application/rss+xml'); res.sendFile(path.join(PUBLIC_DIR, 'feed.xml')); });
// ==================== END MASS SEO LOCATION PAGES ====================

app.use(express.static(PUBLIC_DIR, { extensions: ['html'], index: 'index.html' }));

// Serve extensionless canonical URLs from matching public/*.html files.
// This prevents clean URLs in the sitemap/canonicals from returning 403/404 on Node hosting.
app.use((req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  if (req.path.includes('.') || req.path.endsWith('/')) return next();
  if (req.path.startsWith('/api/')) return next();

  const relativePath = req.path.replace(/^\/+/, '');
  const htmlPath = path.normalize(path.join(PUBLIC_DIR, `${relativePath}.html`));
  if (!htmlPath.startsWith(PUBLIC_DIR + path.sep)) return next();

  try {
    require('fs').accessSync(htmlPath, require('fs').constants.R_OK);
    return res.sendFile(htmlPath);
  } catch (e) {
    return next();
  }
});

// -------------------- GEO-BLOCKING MIDDLEWARE --------------------
// Block traffic from India (IN), Pakistan (PK), Israel (IL)
// Strategy:
//  1. Cloudflare/proxy country header (fastest, no quota used)
//  2. geoip-lite offline DB (fast, no quota, good for page loads)
//  3. IPstack live API (most accurate — used only on booking/contact API calls)
const BLOCKED_COUNTRIES = ['IN', 'PK', 'IL'];
const GEO_BLOCK_HTML = '<!DOCTYPE html><html><head><title>Access Denied</title></head>' +
  '<body style="font-family:sans-serif;text-align:center;padding:80px;background:#111;color:#fff">' +
  '<h1 style="color:#e74c3c">403 — Access Denied</h1>' +
  '<p>This service is not available in your region.</p>' +
  '</body></html>';
app.use(async (req, res, next) => {
  // 1. Cloudflare / proxy country header (instant, no API call)
  const cfCountry = (req.headers['cf-ipcountry'] || req.headers['x-country-code'] || '').toUpperCase();
  if (cfCountry && BLOCKED_COUNTRIES.includes(cfCountry)) {
    return res.status(403).send(GEO_BLOCK_HTML);
  }
  const rawIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace('::ffff:', '');
  // 2. geoip-lite offline DB (fast, no quota — used for all page loads)
  const geo = geoip.lookup(rawIp);
  if (geo && BLOCKED_COUNTRIES.includes(geo.country)) {
    return res.status(403).send(GEO_BLOCK_HTML);
  }
  // 3. IPstack live API — only on booking/contact submissions to conserve quota
  // These are the highest-risk endpoints for spam/fraud from blocked countries
  const isApiSubmission = req.method === 'POST' && (
    req.path.startsWith('/api/booking') ||
    req.path.startsWith('/api/contact') ||
    req.path.startsWith('/api/send-otp')
  );
  if (isApiSubmission && rawIp && rawIp !== '127.0.0.1' && rawIp !== '::1') {
    try {
      const ipData = await checkIPStack(rawIp);
      if (ipData && BLOCKED_COUNTRIES.includes(ipData.country_code)) {
        console.log('[GeoBlock] IPstack blocked:', rawIp, ipData.country_code);
        return res.status(403).json({ success: false, error: 'This service is not available in your region.' });
      }
    } catch(e) { /* fail open — never block a real customer due to API error */ }
  }
  next();
});

// -------------------- THREAT PROTECTION MIDDLEWARE --------------------
// Bot blocking + device fingerprint tracking + auto-block repeat non-converters
app.use(threatMiddleware);

// -------------------- CLICK FRAUD DETECTION MIDDLEWARE --------------------
// Tracks Google Ads clicks (gclid) by device fingerprint — detects rotating-IP fraud
app.use(clickFraudMiddleware);

// -------------------- ENV helper --------------------
const E = (k, fb = '') => {
  const v = process.env[k] || process.env[k.toLowerCase()] || fb;
  return (v || '').replace(/^["'\s]+|["'\s]+$/g, '');
};

const CFG = {
  PORT:           process.env.PORT || E('PORT', '3000'),
  TWILIO_SID:     E('TWILIO_ACCOUNT_SID',  'AC65b51fa00bc719c38cad12b5f69b79b0'),
  TWILIO_TOKEN:   E('TWILIO_AUTH_TOKEN',   'TWILIO_AUTH_TOKEN_SET_VIA_ENV'),
  TWILIO_FROM:    E('TWILIO_FROM_NUMBER',  '+19592144266'),
  SMTP_HOST:      E('SMTP_HOST',           'smtp.hostinger.com'),
  SMTP_PORT:      E('SMTP_PORT',           '465'),
  SMTP_USER:      E('SMTP_USER',           'info@silvertaxisydneyservice.com'),
  SMTP_PASS:      E('SMTP_PASS',           'Au6GE4Jo2;'),
  ADMIN_EMAIL:    E('ADMIN_EMAIL',         'info@silvertaxisydneyservice.com'),
  ADMIN_PHONE:    E('ADMIN_PHONE',         '+61420439848'),
  ADMIN_PASSWORD: E('ADMIN_PASSWORD',      'Au6GE4Jo2;'),
  STRIPE_SECRET:  E('STRIPE_SECRET_KEY',   'STRIPE_SECRET_KEY_SET_VIA_ENV'),
  STRIPE_PK:      E('STRIPE_PK',           'pk_live_51T89nY0OeJ3KrNPPFOCXkxyXMOKrrmEKjlj5B8VWHTcC7BW9Cv1kO828v21EIugUGuMPMUhjMAjpz0aQfdPJ6hik00JMAOayCy'),
  TELEGRAM_TOKEN: E('TELEGRAM_BOT_TOKEN',  '8679067781:AAEH436Zpx4hmeHh04WGcbqlLc12R17wCEI'),
  TELEGRAM_CHAT:  E('TELEGRAM_CHAT_ID',    '-1003441151525'), // Added -100 prefix
  MAPS_KEY:       E('MAPS_API_KEY',        'AIzaSyBrZTJSjvZP0YcvuAqLeSR0A5Y9OjyPxuM'),
  RESEND_API_KEY: E('RESEND_API_KEY',      're_CwTpW4rQ_9DZSrHMNSaXLMosbMVnXwfbt'),
};

// -------------------- Services --------------------
let SVC = { twilio: null, mailer: null, stripe: null };

// Twilio
if (CFG.TWILIO_SID && CFG.TWILIO_TOKEN &&
    !CFG.TWILIO_TOKEN.includes('WILL') && !CFG.TWILIO_TOKEN.includes('PROVIDE')) {
  try {
    SVC.twilio = require('twilio')(CFG.TWILIO_SID, CFG.TWILIO_TOKEN);
    console.log('[TWILIO]  Loaded. From:', CFG.TWILIO_FROM);
  } catch(e) { console.error('[TWILIO] Load failed:', e.message); }
} else {
  console.warn('[TWILIO] WARNING: Auth token not yet set — SMS will be logged only');
}

// Nodemailer
if (CFG.SMTP_USER && CFG.SMTP_PASS) {
  try {
    const nm = require('nodemailer');
    SVC.mailer = nm.createTransport({
      host: CFG.SMTP_HOST, port: +CFG.SMTP_PORT,
      secure: +CFG.SMTP_PORT === 465,
      auth: { user: CFG.SMTP_USER, pass: CFG.SMTP_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000, greetingTimeout: 5000, socketTimeout: 8000,
    });
    console.log('[EMAIL]  Loaded. User:', CFG.SMTP_USER);
  } catch(e) { console.error('[EMAIL] Load failed:', e.message); }
}

// Stripe
if (CFG.STRIPE_SECRET && !CFG.STRIPE_SECRET.includes('WILL') && !CFG.STRIPE_SECRET.includes('PROVIDE')) {
  try {
    SVC.stripe = require('stripe')(CFG.STRIPE_SECRET);
    console.log('[STRIPE]  Loaded');
  } catch(e) { console.error('[STRIPE] Load failed:', e.message); }
} else {
  console.warn('[STRIPE] WARNING: Secret key not yet set — payments will be simulated');
}

// -------------------- MongoDB Persistent DB --------------------
const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://sso-admin:SSOBookings2026!@sso-bookings.zuhw01d.mongodb.net/sso?appName=sso-bookings';

// Flexible schemas (strict:false allows any fields)
const bookingSchema = new mongoose.Schema({ _id: String }, { strict: false });
const driverSchema  = new mongoose.Schema({ _id: String }, { strict: false });
const BookingModel  = mongoose.model('Booking', bookingSchema);
const DriverModel   = mongoose.model('Driver',  driverSchema);

// In-memory cache — populated from MongoDB on startup
const DB = {
  bookings: new Map(),
  drivers:  new Map(),

  async save(b) {
    const key = (b.ref || b.id || '').toUpperCase();
    b.ref = key;
    this.bookings.set(key, b);
    try {
      await BookingModel.findByIdAndUpdate(key, { ...b, _id: key }, { upsert: true, new: true });
    } catch(e) { console.error('[DB] Booking save error:', e.message); }
  },

  async saveDriver(d) {
    this.drivers.set(d.id, d);
    try {
      await DriverModel.findByIdAndUpdate(d.id, { ...d, _id: d.id }, { upsert: true, new: true });
    } catch(e) { console.error('[DB] Driver save error:', e.message); }
  },

  async deleteDriver(id) {
    this.drivers.delete(id);
    try { await DriverModel.findByIdAndDelete(id); } catch(e) { console.error('[DB] Driver delete error:', e.message); }
  },

  get(ref) { return this.bookings.get((ref||'').replace('#','').toUpperCase()); },

  findByPhone(ref, phone) {
    const b = this.get(ref);
    if (!b) return null;
    const stored = (b.phone||'').replace(/\D/g,'');
    const query  = (phone||'').replace(/\D/g,'');
    return stored.endsWith(query.slice(-8)) ? b : null;
  },

  all() { return [...this.bookings.values()].sort((a,b) => b.created > a.created ? 1 : -1); }
};

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB Atlas');
    const bookings = await BookingModel.find({}).lean();
    bookings.forEach(b => { const key = (b.ref || b._id || '').toUpperCase(); DB.bookings.set(key, b); });
    const drivers = await DriverModel.find({}).lean();
    drivers.forEach(d => DB.drivers.set(d.id || d._id, d));
    console.log('[DB] Loaded', DB.bookings.size, 'bookings,', DB.drivers.size, 'drivers from MongoDB');
  } catch(e) {
    console.error('[DB] MongoDB connection failed:', e.message);
    console.warn('[DB] Running with empty in-memory DB — data will not persist this session');
  }
}
connectDB();

// -------------------- reCAPTCHA v3 Verification --------------------
async function verifyRecaptcha(token) {
  if (!token) return { success: true, score: 0.5 }; // fail open
  try {
    // reCAPTCHA Enterprise REST API
    const RECAPTCHA_SECRET = '6Leki88sAAAAAE0zxdRRuFbVybO47b14eK37win1';
    const RECAPTCHA_SITE_KEY = '6Le_ac8sAAAAAD1xxGQjFphEWTkpp_xbtWa2kFop';
    const RECAPTCHA_PROJECT = 'flight-tracking-416511';
    const resp = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${RECAPTCHA_PROJECT}/assessments?key=${RECAPTCHA_SECRET}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: { token, siteKey: RECAPTCHA_SITE_KEY }
        })
      }
    );
    const data = await resp.json();
    // Enterprise returns riskAnalysis.score (1.0 = human, 0.0 = bot)
    const score = data.riskAnalysis?.score ?? 0.5;
    const valid = data.tokenProperties?.valid !== false;
    const ok = valid && score >= 0.3;
    console.log('[RECAPTCHA Enterprise] score:', score, 'valid:', valid, 'ok:', ok);
    return { success: ok, score };
  } catch(e) {
    console.error('[RECAPTCHA] Error:', e.message);
    return { success: true, score: 0.5 }; // fail open — never block real users due to API error
  }
}

// -------------------- Helpers --------------------
async function sms(to, body) {
  if (!to) return;
  if (!SVC.twilio) {
    console.log('[SMS mock] To:', to, '|', body.slice(0,100));
    return;
  }
  // Normalise Australian numbers to E.164
  let normTo = to.replace(/\s/g,'');
  if (normTo.startsWith('04')) normTo = '+61' + normTo.slice(1);
  if (normTo.startsWith('614') && !normTo.startsWith('+')) normTo = '+' + normTo;
  try {
    const m = await SVC.twilio.messages.create({ body, from: CFG.TWILIO_FROM, to: normTo });
    console.log('[SMS]  Sent to', normTo, '| SID:', m.sid);
  } catch(e) { console.error('[SMS]  Error to', normTo, ':', e.message); }
}

async function email(to, subject, html, attachments = []) {
  if (!to || !SVC.mailer) {
    console.log('[EMAIL mock] To:', to, '|', subject);
    return;
  }
  const mailOpts = {
    from: `"Silver Taxi Sydney Service" <${CFG.SMTP_USER}>`,
    to, subject, html
  };
  if (attachments.length > 0) mailOpts.attachments = attachments;
  const send = SVC.mailer.sendMail(mailOpts);
  const timeout = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000));
  try {
    const info = await Promise.race([send, timeout]);
    console.log('[EMAIL]  Sent to', to, '| ID:', info.messageId);
  } catch(e) {
    console.error('[EMAIL]  Error:', e.message);
    // Fallback port 587
    if (e.message.includes('timeout') || e.message.includes('connect')) {
      try {
        const nm2 = require('nodemailer');
        const alt = nm2.createTransport({
          host: CFG.SMTP_HOST, port: 587, secure: false,
          auth: { user: CFG.SMTP_USER, pass: CFG.SMTP_PASS },
          tls: { rejectUnauthorized: false }, connectionTimeout: 8000,
        });
        const altOpts = { from: `"Silver Taxi Sydney Service" <${CFG.SMTP_USER}>`, to, subject, html };
        if (attachments.length > 0) altOpts.attachments = attachments;
        const info2 = await Promise.race([
          alt.sendMail(altOpts),
          new Promise((_, r) => setTimeout(() => r(new Error('alt timeout')), 8000))
        ]);
        console.log('[EMAIL]  Sent via 587 to', to, '| ID:', info2.messageId);
        SVC.mailer = alt;
      } catch(e2) { console.error('[EMAIL]  Port 587 also failed:', e2.message); }
    }
  }
}

async function tg(text) {
  if (!CFG.TELEGRAM_TOKEN || !CFG.TELEGRAM_CHAT) return;
  try {
    let id = String(CFG.TELEGRAM_CHAT).trim();
    // Use the ID as-is (personal chat IDs are plain positive numbers)
    
    const body = JSON.stringify({ chat_id: id, text, parse_mode: 'HTML' });
    const https = require('https');
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${CFG.TELEGRAM_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
    });
    req.on('error', e => console.error('[TELEGRAM] Request Error:', e.message));
    req.write(body);
    req.end();
  } catch(e) { console.error('[TELEGRAM] Error:', e.message); }
}

function genRef() {
  return String(Math.floor(1000000000 + Math.random() * 9000000000));
}

// -------------------- Suburb Extractor --------------------
// Extract suburb name from full address (e.g. "918 Canterbury Rd, Roselands NSW 2196, Australia" → "ROSELANDS")
function shortAddr(addr) {
  if (!addr) return '';
  const parts = addr.split(',').map(p => p.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].toUpperCase();
    if (p === 'AUSTRALIA' || p === 'AU') continue;
    const m = p.match(/^([A-Z][A-Z\s]+?)\s+(?:NSW|VIC|QLD|WA|SA|ACT|TAS)(\s+\d{4})?$/);
    if (m) return m[1].trim();
    if (!/\d/.test(p) && p.length > 2 && i > 0) return p.trim();
  }
  return (parts[1] || parts[0] || addr).trim().toUpperCase();
}

// -------------------- Fare Tables --------------------
const FARES = {
  sedan: { init: 7.40, minFare: 50, minKm: 8, bands: [[0,5,4.70],[5,10,4.50],[10,28,3.55],[28,50,3.40],[50,70,3.00],[70,100,2.80],[100,9999,2.60]] },
  lexus: { init: 7.40, minFare: 50, minKm: 8, bands: [[0,5,4.70],[5,10,4.55],[10,28,3.55],[28,50,3.40],[50,70,3.00],[70,90,2.80],[90,9999,2.60]] },
  suv:   { init: 7.40, minFare: 50, minKm: 8, bands: [[0,5,4.80],[5,10,4.50],[10,28,3.65],[28,50,3.50],[50,70,3.10],[70,90,2.85],[90,9999,2.60]] },
  maxi:  { init:14.00, minFare: 60, minKm: 8, bands: [[0,5,6.50],[5,10,6.20],[10,30,5.10],[30,9999,4.60]] },
};

function calcBaseFare(vehicle, km) {
  const v = FARES[vehicle] || FARES.sedan;
  const effectiveKm = Math.max(+km || 0, v.minKm || 8);
  let dist = 0;
  for (const [lo, hi, rate] of v.bands) {
    if (effectiveKm <= lo) break;
    dist += (Math.min(effectiveKm, hi) - lo) * rate;
  }
  return { sub: +Math.max(v.init + dist, v.minFare || 50).toFixed(2), km: +effectiveKm.toFixed(1) };
}
const GOVT_LEVY = 1.32;   // NSW Government Levy (fixed)
const BOOKING_FEE = 2.50; // Booking fee (fixed)
const CARD_FEE_PCT = 0.05; // 5% card processing / service fee (matches Stripe receipt)

function calcFare(vehicle, km, tolls = 0, returnTrip = false, airportFee = 0, returnKm = 0, returnTolls = 0, isCardPayment = false) {
  const { sub: outSub, km: effectiveKm } = calcBaseFare(vehicle, km);
  const af = +(+airportFee || 0).toFixed(2);
  const t1 = +(+tolls || 0).toFixed(2);
  const levy = GOVT_LEVY;

  if (returnTrip) {
    // Return leg uses same km/tolls as outbound unless returnKm provided
    const retKm = +returnKm > 0 ? +returnKm : +km;
    const { sub: retSubRaw } = calcBaseFare(vehicle, retKm);
    const retSub = +(retSubRaw * 0.90).toFixed(2); // 10% off return
    const t2 = +(+returnTolls > 0 ? +returnTolls : +tolls || 0).toFixed(2);
    const subtotal = +(outSub + retSub + t1 + t2 + BOOKING_FEE + levy + af).toFixed(2);
    const serviceFee = isCardPayment ? +(subtotal * CARD_FEE_PCT).toFixed(2) : 0;
    const total = +(subtotal + serviceFee).toFixed(2);
    return {
      km: effectiveKm,
      sub: outSub,          // outbound fare
      returnSub: retSub,    // return fare (10% off)
      tolls: t1,            // outbound tolls
      returnTolls: t2,      // return tolls
      bookingFee: BOOKING_FEE,
      govtLevy: levy,
      airportFee: af,
      serviceFee,           // 5% card service fee
      cardFee: serviceFee,  // backward compat alias
      subtotal,             // fare before service fee
      total,
      returnTrip: true,
    };
  }
  const subtotal = +(outSub + t1 + BOOKING_FEE + levy + af).toFixed(2);
  const serviceFee = isCardPayment ? +(subtotal * CARD_FEE_PCT).toFixed(2) : 0;
  const total = +(subtotal + serviceFee).toFixed(2);
  return {
    km: effectiveKm,
    sub: outSub,
    tolls: t1,
    bookingFee: BOOKING_FEE,
    govtLevy: levy,
    airportFee: af,
    serviceFee,           // 5% card service fee
    cardFee: serviceFee,  // backward compat alias
    subtotal,             // fare before service fee
    total,
    returnTrip: false,
  };
}

// -------------------- Live Toll Calculation via Google Maps Routes API --------------------
// Cache toll results to avoid redundant API calls for the same route
const tollCache = new Map();

async function fetchTollsFromGoogle(pickup, dropoff) {
  const MAPS_KEY = CFG.MAPS_KEY || process.env.MAPS_API_KEY || 'AIzaSyBrZTJSjvZP0YcvuAqLeSR0A5Y9OjyPxuM';
  const cacheKey = `${(pickup||'').toLowerCase().trim()}|${(dropoff||'').toLowerCase().trim()}`;
  if (tollCache.has(cacheKey)) return tollCache.get(cacheKey);

  try {
    const body = {
      origin: { address: pickup + ', NSW, Australia' },
      destination: { address: dropoff + ', NSW, Australia' },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      extraComputations: ['TOLLS'],
      units: 'METRIC',
    };
    const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.travelAdvisory.tollInfo,routes.legs.travelAdvisory.tollInfo',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('Routes API HTTP ' + resp.status);
    const data = await resp.json();
    const route = (data.routes || [])[0];
    if (!route) throw new Error('No route returned');

    // Extract toll cost in AUD
    const tollInfo = route.travelAdvisory?.tollInfo;
    let tollAUD = 0;
    if (tollInfo && tollInfo.estimatedPrice) {
      for (const price of tollInfo.estimatedPrice) {
        if (price.currencyCode === 'AUD') {
          tollAUD = +(price.units || 0) + (price.nanos || 0) / 1e9;
          break;
        }
      }
    }
    tollAUD = +tollAUD.toFixed(2);
    console.log(`[TOLLS] ${pickup} → ${dropoff}: $${tollAUD} AUD (Google Routes API)`);
    tollCache.set(cacheKey, tollAUD);
    // Expire cache after 6 hours
    setTimeout(() => tollCache.delete(cacheKey), 6 * 60 * 60 * 1000);
    return tollAUD;
  } catch(e) {
    console.warn('[TOLLS] Google Routes API failed:', e.message, '— using fallback');
    return null; // null = use fallback
  }
}

// ─── Accurate Sydney Toll Calculation (Official NSW Rates from Jan 2026) ───
// Based on: https://www.nsw.gov.au/driving-boating-and-transport/tolling/toll-costs-by-road
// and Linkt quarterly price update January 2026

// Toll rates for Class A (passenger vehicles / taxis) as of 1 Jan 2026
const TOLL_RATES = {
  // Fixed tolls
  EASTERN_DISTRIBUTOR: 10.37,       // Northbound only (south/airport → city)
  HARBOUR_BRIDGE_PEAK: 4.41,        // Southbound only (north shore → CBD), weekday peak
  HARBOUR_BRIDGE_OFFPEAK: 3.30,     // Southbound only, weekday off-peak / weekend day
  HARBOUR_BRIDGE_NIGHT: 2.76,       // Southbound only, night
  HARBOUR_BRIDGE_AVG: 3.82,         // Average toll (used for estimates)
  LANE_COVE_TUNNEL: 4.24,           // Both directions
  MILITARY_RD_ERAMP: 2.12,          // Both directions
  NORTHCONNEX: 10.49,               // Both directions (M1 Wahroonga ↔ M2 West Pennant Hills)
  CROSS_CITY_MAIN: 7.31,            // Both directions (Darling Harbour ↔ Rushcutters Bay)
  CROSS_CITY_SJY: 3.45,             // Sir John Young Crescent
  M5_SOUTHWEST: 5.98,               // Both directions (Beverly Hills ↔ Prestons)
  // Hills M2 toll points (eastbound accumulates, westbound accumulates)
  M2_WINDSOR_RD: 3.72,              // Windsor Road toll point
  M2_PENNANT_HILLS: 5.25,           // Pennant Hills Road toll point
  M2_HERRING_CHRISTIE: 5.25,        // Herring & Christie Roads toll point
  M2_LANE_COVE_RD: 3.10,            // Lane Cove Road toll point
  M2_NORTH_RYDE: 10.49,             // North Ryde mainline (full traversal)
  M2_NCX: 5.25,                     // M2-NorthConnex junction
  // WestConnex (distance-based)
  WESTCONNEX_FLAGFALL: 1.80,
  WESTCONNEX_PER_KM: 0.6667,
  WESTCONNEX_M4_MAX: 10.79,          // M4 tunnels (Homebush ↔ Haberfield)
  WESTCONNEX_M8_MAX: 9.15,           // M8 (St Peters ↔ Kingsgrove)
  WESTCONNEX_M5_EAST_MAX: 9.15,      // M5 East (King Georges Rd ↔ Airport corridor)
  WESTCONNEX_M4M8_MAX: 6.48,         // M4-M8 Link (Haberfield ↔ St Peters)
  WESTCONNEX_EXTENDED_MAX: 12.74,    // Extended trip (>16km across WestConnex)
  // Westlink M7 (distance-based)
  M7_PER_KM: 0.5181,
  M7_MAX: 10.36,                     // M5 Prestons ↔ M4 Eastern Creek / M2 Baulkham Hills
};

// Suburb/area zone mapping for toll corridor detection
const TOLL_ZONES = {
  // Airport zone
  airport: ['airport','mascot','terminal','kingsford smith','domestic terminal','international terminal','t1','t2','t3'],
  // CBD / City zone
  cbd: ['cbd','city','sydney','circular quay','wynyard','town hall','martin place','barangaroo','darling harbour','the rocks','haymarket','chinatown','pyrmont','ultimo'],
  // Eastern Suburbs
  eastern: ['bondi','coogee','randwick','maroubra','bronte','waverley','double bay','rose bay','vaucluse','woollahra','paddington','darlinghurst','potts point','elizabeth bay','rushcutters bay','edgecliff','bellevue hill'],
  // Inner South
  inner_south: ['surry hills','redfern','waterloo','zetland','rosebery','alexandria','newtown','enmore','marrickville','erskineville','st peters','tempe','sydenham'],
  // Inner West
  inner_west: ['glebe','annandale','leichhardt','lilyfield','rozelle','balmain','drummoyne','haberfield','five dock','croydon','ashfield','summer hill','dulwich hill','petersham','stanmore','camperdown'],
  // North Shore (lower)
  lower_north: ['north sydney','milsons point','kirribilli','neutral bay','cremorne','mosman','wollstonecraft','waverton','crows nest','st leonards','artarmon','lane cove','greenwich','longueville','riverview'],
  // North Shore (upper)
  upper_north: ['chatswood','willoughby','roseville','lindfield','killara','gordon','pymble','turramurra','warrawee','st ives','hornsby','normanhurst','thornleigh','pennant hills','west pennant hills','cheltenham','beecroft'],
  // Northern Beaches
  northern_beaches: ['manly','dee why','brookvale','narrabeen','mona vale','newport','avalon','palm beach','collaroy','curl curl','freshwater','balgowlah','seaforth','clontarf','fairlight','north head','warriewood','elanora heights','ingleside','bayview','church point','terry hills','belrose','frenchs forest','forestville','allambie heights','beacon hill'],
  // Hills District
  hills: ['castle hill','baulkham hills','west pennant hills','carlingford','epping','eastwood','north rocks','north epping','dural','glenhaven','kellyville','rouse hill','beaumont hills','the ponds','stanhope gardens','bella vista','norwest','winston hills'],
  // Western Sydney (Parramatta corridor)
  parramatta: ['parramatta','harris park','granville','merrylands','guildford','auburn','lidcombe','homebush','strathfield','burwood','concord','rhodes','olympic park','silverwater','newington','wentworth point','ermington','rydalmere','dundas','telopea','oatlands','northmead'],
  // South-West
  southwest: ['liverpool','fairfield','cabramatta','canley vale','canley heights','villawood','bass hill','bankstown','revesby','padstow','panania','milperra','east hills','moorebank','holsworthy','casula','prestons','leppington','ingleburn','macquarie fields','campbelltown','camden','narellan','gregory hills','oran park'],
  // Western Sydney
  west: ['blacktown','seven hills','toongabbie','wentworthville','pendle hill','prospect','lalor park','kings langley','quakers hill','marayong','schofields','riverstone','marsden park','eastern creek','rooty hill','mount druitt','st marys','werrington','kingswood','penrith','emu plains','glenmore park','jordan springs','mulgoa','luddenham','badgerys creek','western sydney airport'],
  // Lower Blue Mountains / Great Western Highway to M4 corridor
  blue_mountains: ['glenbrook','blaxland','warrimoo','valley heights','springwood','faulconbridge','linden','woodford','hazelbrook','lawson','bullaburra','wentworth falls','leura','katoomba'],
  // Sutherland / Cronulla
  sutherland: ['cronulla','sutherland','miranda','caringbah','gymea','sylvania','engadine','heathcote','waterfall','como','jannali','kirrawee','hurstville','kogarah','rockdale','arncliffe','wolli creek','brighton-le-sands','sans souci','ramsgate'],
  // M5 Corridor
  m5_corridor: ['beverly hills','kingsgrove','bexley','penshurst','mortdale','oatley','peakhurst','lugarno','riverwood','narwee','padstow','revesby','milperra','bankstown airport'],
  // North-West (NorthConnex corridor - only far north M1 suburbs)
  northwest_ncx: ['wahroonga','mount colah','mount kuring-gai','berowra','brooklyn','cowan','asquith'],
};

// Detect which zone(s) an address belongs to
function detectZones(address) {
  if (!address) return [];
  const addr = address.toLowerCase();
  const zones = [];
  for (const [zone, keywords] of Object.entries(TOLL_ZONES)) {
    for (const kw of keywords) {
      if (addr.includes(kw)) {
        zones.push(zone);
        break;
      }
    }
  }
  return zones;
}

// Calculate tolls based on route corridor analysis
function lookupTollsFallback(pickup, dropoff) {
  if (!pickup || !dropoff) return 0;
  const pu = (pickup || '').toLowerCase();
  const dr = (dropoff || '').toLowerCase();
  const puZones = detectZones(pu);
  const drZones = detectZones(dr);

  let totalToll = 0;

  // Helper: check if route goes between two zone sets
  const routeBetween = (z1, z2) =>
    (puZones.includes(z1) && drZones.includes(z2)) ||
    (puZones.includes(z2) && drZones.includes(z1));
  const puIn = (z) => puZones.includes(z);
  const drIn = (z) => drZones.includes(z);

  // ─── Eastern Distributor (Northbound only: south → CBD/north via tunnel) ───
  // The ED runs from south (near airport/Moore Park) NORTHBOUND into the CBD.
  // Typical use: going from south/eastern suburbs heading north PAST the CBD to north shore.
  // NOT used for short trips (e.g. eastern→CBD can use surface roads).
  // Only triggered when crossing from south all the way to north shore destinations.
  if ((puIn('sutherland') || puIn('m5_corridor')) &&
      (drIn('lower_north') || drIn('upper_north') || drIn('northern_beaches') || drIn('hills') || drIn('northwest_ncx'))) {
    totalToll += TOLL_RATES.EASTERN_DISTRIBUTOR;
  }

  // ─── Sydney Harbour Bridge/Tunnel (Southbound only: north → south of harbour) ───
  // Tolled when crossing from north side to south side of the harbour
  if ((puIn('lower_north') || puIn('upper_north') || puIn('northern_beaches')) &&
      (drIn('cbd') || drIn('inner_south') || drIn('eastern') || drIn('airport') || drIn('sutherland') || drIn('m5_corridor') || drIn('southwest') || drIn('parramatta') || drIn('west') || drIn('inner_west'))) {
    totalToll += TOLL_RATES.HARBOUR_BRIDGE_AVG;
  }

  // ─── Lane Cove Tunnel (North Ryde/M2 ↔ Artarmon/Gore Hill Freeway) ───
  // Only triggered when route specifically goes through the M2/Lane Cove corridor
  if ((puIn('hills') && (drIn('lower_north') || drIn('cbd') || drIn('airport') || drIn('inner_south') || drIn('eastern'))) ||
      (drIn('hills') && (puIn('lower_north') || puIn('cbd') || puIn('airport') || puIn('inner_south') || puIn('eastern')))) {
    totalToll += TOLL_RATES.LANE_COVE_TUNNEL;
  }

  // ─── NorthConnex (M1 Wahroonga ↔ M2 West Pennant Hills) ───
  // Only used when travelling between the M1 Pacific Motorway (Wahroonga+) and western/southern destinations
  // NOT used for Hornsby→Parramatta (that goes via surface roads or M2 directly)
  if ((puIn('northwest_ncx') && (drIn('west') || drIn('southwest') || drIn('airport'))) ||
      ((puIn('west') || puIn('southwest') || puIn('airport')) && drIn('northwest_ncx'))) {
    totalToll += TOLL_RATES.NORTHCONNEX;
  }

  // ─── Hills M2 (Seven Hills ↔ North Ryde) ───
  if (routeBetween('hills', 'lower_north') || routeBetween('hills', 'cbd') ||
      routeBetween('hills', 'eastern') || routeBetween('hills', 'airport') ||
      routeBetween('hills', 'inner_south') || routeBetween('hills', 'northern_beaches')) {
    // Estimate M2 toll based on likely traversal distance
    // Full traversal = $10.49 (North Ryde mainline)
    // Partial = Windsor Rd $3.72 or Pennant Hills Rd $5.25
    if (puIn('hills') || drIn('hills')) {
      // Check if it's a short M2 trip or full
      if (pu.includes('castle hill') || pu.includes('baulkham hills') || pu.includes('west pennant hills') ||
          dr.includes('castle hill') || dr.includes('baulkham hills') || dr.includes('west pennant hills')) {
        totalToll += TOLL_RATES.M2_PENNANT_HILLS; // Partial: $5.25
      } else {
        totalToll += TOLL_RATES.M2_NORTH_RYDE; // Full traversal: $10.49
      }
    }
  }

  // ─── Cross City Tunnel (Darling Harbour ↔ Rushcutters Bay) ───
  if ((puIn('cbd') && drIn('eastern')) || (puIn('eastern') && drIn('cbd'))) {
    // Only applies for trips that cross the CBD east-west
    if ((pu.includes('darling') || pu.includes('pyrmont') || pu.includes('ultimo')) &&
        (dr.includes('rushcutters') || dr.includes('potts point') || dr.includes('elizabeth bay') || dr.includes('edgecliff'))) {
      totalToll += TOLL_RATES.CROSS_CITY_MAIN;
    } else if ((dr.includes('darling') || dr.includes('pyrmont') || dr.includes('ultimo')) &&
               (pu.includes('rushcutters') || pu.includes('potts point') || pu.includes('elizabeth bay') || pu.includes('edgecliff'))) {
      totalToll += TOLL_RATES.CROSS_CITY_MAIN;
    }
  }

  // ─── M5 South-West (Beverly Hills ↔ Prestons) ───
  if (routeBetween('m5_corridor', 'southwest') || routeBetween('sutherland', 'southwest') ||
      (puIn('southwest') && (drIn('airport') || drIn('cbd') || drIn('eastern') || drIn('inner_south'))) ||
      ((puIn('airport') || puIn('cbd') || puIn('eastern') || puIn('inner_south')) && drIn('southwest'))) {
    totalToll += TOLL_RATES.M5_SOUTHWEST;
  }

  // ─── WestConnex M4 (Homebush ↔ Haberfield, connects west to inner city) ───
  // Only for trips where one end is in west/parramatta/lower Blue Mountains and the other is inner city/airport
  // NOT triggered for north shore → parramatta (those use surface roads via Harbour Bridge)
  if ((puIn('parramatta') && (drIn('inner_west') || drIn('cbd') || drIn('airport') || drIn('eastern') || drIn('inner_south'))) ||
      (puIn('west') && (drIn('inner_west') || drIn('cbd') || drIn('airport') || drIn('eastern') || drIn('inner_south'))) ||
      (puIn('blue_mountains') && (drIn('inner_west') || drIn('cbd') || drIn('airport') || drIn('eastern') || drIn('inner_south'))) ||
      ((puIn('inner_west') || puIn('cbd') || puIn('airport') || puIn('eastern') || puIn('inner_south')) && (drIn('west') || drIn('blue_mountains'))) ||
      ((puIn('inner_west') || puIn('airport')) && drIn('parramatta'))) {
    totalToll += TOLL_RATES.WESTCONNEX_M4_MAX;
  }

  // ─── WestConnex M8 (St Peters ↔ Kingsgrove) ───
  if (routeBetween('inner_south', 'm5_corridor') ||
      (puIn('m5_corridor') && (drIn('cbd') || drIn('eastern') || drIn('airport'))) ||
      ((puIn('cbd') || puIn('eastern') || puIn('airport')) && drIn('m5_corridor'))) {
    totalToll += TOLL_RATES.WESTCONNEX_M8_MAX;
  }

  // ─── WestConnex M5 East (King Georges Rd ↔ Airport corridor) ───
  if ((puIn('sutherland') && drIn('airport')) || (puIn('airport') && drIn('sutherland'))) {
    totalToll += TOLL_RATES.WESTCONNEX_M5_EAST_MAX;
  }

  // ─── Westlink M7 (M5 Prestons ↔ M4 Eastern Creek / M2 Baulkham Hills) ───
  if (routeBetween('southwest', 'west') || routeBetween('southwest', 'hills') ||
      (puIn('southwest') && drIn('northwest_ncx')) || (puIn('northwest_ncx') && drIn('southwest'))) {
    totalToll += TOLL_RATES.M7_MAX;
  }

  // ─── Specific well-known routes (override/refine) ───
  // Blue Mountains / Glenbrook → Airport (via M4 / WestConnex)
  if ((pu.includes('glenbrook') || pu.includes('blaxland') || pu.includes('springwood') || pu.includes('katoomba') || pu.includes('blue mountains')) &&
      (dr.includes('airport') || dr.includes('mascot') || dr.includes('terminal'))) {
    return +TOLL_RATES.WESTCONNEX_M4_MAX.toFixed(2); // $10.79
  }
  if ((dr.includes('glenbrook') || dr.includes('blaxland') || dr.includes('springwood') || dr.includes('katoomba') || dr.includes('blue mountains')) &&
      (pu.includes('airport') || pu.includes('mascot') || pu.includes('terminal'))) {
    return +TOLL_RATES.WESTCONNEX_M4_MAX.toFixed(2);
  }

  // Windsor → Airport (user's original booking route)
  if ((pu.includes('windsor') || pu.includes('richmond') || pu.includes('hawkesbury')) &&
      (dr.includes('airport') || dr.includes('mascot') || dr.includes('terminal'))) {
    // Windsor to Airport via M7 + M5 or M4 + WestConnex
    return +(TOLL_RATES.M7_MAX + TOLL_RATES.WESTCONNEX_M4_MAX).toFixed(2); // ~$21.15
  }
  if ((dr.includes('windsor') || dr.includes('richmond') || dr.includes('hawkesbury')) &&
      (pu.includes('airport') || pu.includes('mascot') || pu.includes('terminal'))) {
    return +(TOLL_RATES.M7_MAX + TOLL_RATES.WESTCONNEX_M4_MAX).toFixed(2);
  }

  // No tolls detected — return 0 (toll-free route)
  // This is better than a default $3.50 which was inaccurate
  return +totalToll.toFixed(2);
}

// Main toll resolver — tries Google Routes API first, falls back to table
async function resolveTolls(pickup, dropoff) {
  const live = await fetchTollsFromGoogle(pickup, dropoff);
  if (live !== null) return live;
  return lookupTollsFallback(pickup, dropoff);
}

// -------------------- OTP Store --------------------
const otpStore = new Map();
function genOTP() { return String(Math.floor(100000 + Math.random() * 900000)); }

// -------------------- API Routes --------------------

// Security headers — noindex ONLY for private pages, allow indexing for all public pages
app.use((req, res, next) => {
  const privatePaths = ['/payment', '/payment.html', '/manage', '/manage.html', '/api/', ];
  const isPrivate = privatePaths.some(p => req.path.startsWith(p));
  if (isPrivate) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  } else {
    // Allow Google to index all public pages
    res.setHeader('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  }
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Private payment page - only accessible via /payment or /payment.html
// Both routes serve the same file; auth is enforced client-side via JWT in localStorage
// noindex + no-cache headers prevent indexing and caching by proxies
app.get(['/payment', '/payment.html'], (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({ stripePK: CFG.STRIPE_PK || '', mapsKey: CFG.MAPS_KEY || '' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok', time: new Date().toISOString(),
    services: {
      twilio: SVC.twilio ? 'loaded' : 'not loaded',
      email:  SVC.mailer ? 'loaded' : 'not loaded',
      stripe: SVC.stripe ? 'loaded' : 'not loaded',
    },
    config: {
      twilio_from: CFG.TWILIO_FROM || 'not set',
      smtp_user:   CFG.SMTP_USER   || 'not set',
      admin_email: CFG.ADMIN_EMAIL || 'not set',
      admin_phone: CFG.ADMIN_PHONE || 'not set',
      stripe_pk:   CFG.STRIPE_PK ? CFG.STRIPE_PK.slice(0,22)+'...' : 'not set',
    }
  });
});

// Fare calculation
app.post('/api/fare', async (req, res) => {
  const { vehicle = 'sedan', km = 0, tolls = 0, returnTrip = false, pickup, dropoff, airportFee = 0, returnPickup, returnDropoff } = req.body;
  if (+km < 0 || +km > 2000) return res.status(400).json({ error: 'Invalid distance' });
  // Use live Google Routes API toll if no toll passed from client
  const effectiveTolls = +tolls > 0 ? +tolls : await resolveTolls(pickup, dropoff);
  // For return trips, also resolve return leg tolls
  let returnTolls = 0;
  if (returnTrip) {
    const retPu = returnPickup || dropoff;
    const retDo = returnDropoff || pickup;
    returnTolls = await resolveTolls(retPu, retDo);
  }
  const isCardPayment = (req.body.payment || '').toLowerCase().includes('card') || (req.body.payment || '').toLowerCase().includes('stripe');
  res.json(calcFare(vehicle, +km, effectiveTolls, returnTrip, +airportFee || 0, 0, returnTolls, isCardPayment));
});

// Send OTP
app.post('/api/send-otp', async (req, res) => {
  const phone = (req.body.phone || '').trim();
  if (!phone || phone.length < 8) {
    return res.json({ success: false, error: 'Invalid phone number' });
  }
  // reCAPTCHA v3 check — skip for IVR requests (source: 'ivr')
  const isIvrOtp = req.body.source === 'ivr';
  if (!isIvrOtp) {
    const rc = await verifyRecaptcha(req.body.recaptchaToken);
    if (!rc.success) {
      console.log('[RECAPTCHA] OTP blocked — score:', rc.score, 'phone:', phone);
      return res.json({ success: false, error: 'Security check failed. Please refresh the page and try again.' });
    }
  }
  const code = genOTP();
  otpStore.set(phone, { code, expires: Date.now() + 10 * 60 * 1000 });
  console.log('[OTP] Code for', phone, ':', code);
  await sms(phone, `Your Silver Taxi Sydney verification code is: ${code}. Valid for 10 minutes. Do not share this code.`);
  res.json({ success: true });
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const phone  = (req.body.phone || '').trim();
  const code   = (req.body.code  || req.body.otp || '').trim();
  const stored = otpStore.get(phone);
  if (!stored) return res.json({ success: false, error: 'No code sent to this number. Click Send Code first.' });
  if (Date.now() > stored.expires) {
    otpStore.delete(phone);
    return res.json({ success: false, error: 'Code expired. Please request a new one.' });
  }
  if (stored.code !== code) return res.json({ success: false, error: 'Incorrect code. Please try again.' });
  otpStore.delete(phone);
  // Mark phone as verified — unlocks AviationStack flight lookup for this session
  verifiedPhones.add(phone);
  // Auto-expire after 2 hours to keep the set lean
  setTimeout(() => verifiedPhones.delete(phone), 2 * 60 * 60 * 1000);
  res.json({ success: true });
});

// Stripe: create payment intent
app.post('/api/create-payment-intent', async (req, res) => {
  const { amount, currency = 'aud', name = '', pickup = '', destination = '' } = req.body;
  if (!SVC.stripe) {
    // Simulate for testing
    return res.json({ clientSecret: 'pi_simulated_secret_test', simulated: true });
  }
  // amount = fare.total from calcFare (already includes 5% service fee for card payments)
  const amountCents = Math.round(parseFloat(amount) * 100);
  if (!amountCents || amountCents < 5000) return res.status(400).json({ error: 'Minimum charge is $50.00' });
  const puSuburb = (pickup || '').split(',')[0].trim();
  const doSuburb = (destination || '').split(',')[0].trim();
  const { date = '', time = '' } = req.body;
  const descLine = `${puSuburb} → ${doSuburb}${date ? ' | ' + date : ''}${time ? ' at ' + time : ''}`;
  try {
    const pi = await SVC.stripe.paymentIntents.create({
      amount: amountCents, currency,
      description: `Silver Taxi Sydney — ${descLine}`,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { name, pickup, destination, date, time, total: (amountCents/100).toFixed(2) }
    });
    console.log('[STRIPE] PaymentIntent:', pi.id, '| $' + (amountCents/100).toFixed(2));
    res.json({ clientSecret: pi.client_secret, total: (amountCents/100).toFixed(2) });
  } catch(e) {
    console.error('[STRIPE] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/payment/intent', async (req, res) => {
  const { vehicle, km, tolls, returnTrip, description, pickup = '', dropoff = '', date = '', time = '' } = req.body;
  // Always calculate as card payment since this endpoint is for online payment
  const fare = calcFare(vehicle || 'sedan', +km || 0, +tolls || 0, returnTrip || false, 0, 0, 0, true);
  // fare.total already includes 5% service fee — charge exactly that
  const amountCents = Math.round(fare.total * 100);
  if (!SVC.stripe) {
    return res.json({ clientSecret: 'pi_simulated_secret_test', fare, simulated: true });
  }
  if (amountCents < 5000) return res.status(400).json({ error: 'Minimum charge $50.00' });
  const puSuburb2 = (pickup || '').split(',')[0].trim();
  const doSuburb2 = (dropoff || '').split(',')[0].trim();
  const descLine2 = puSuburb2 && doSuburb2
    ? `${puSuburb2} → ${doSuburb2}${date ? ' | ' + date : ''}${time ? ' at ' + time : ''}`
    : (description || 'Sydney Taxi Transfer');
  try {
    const pi = await SVC.stripe.paymentIntents.create({
      amount: amountCents, currency: 'aud',
      description: `Silver Taxi Sydney — ${descLine2}`,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { vehicle, km: String(km), tolls: String(tolls), pickup, dropoff, date, time, total: (amountCents/100).toFixed(2) }
    });
    res.json({ clientSecret: pi.client_secret, fare });
  } catch(e) {
    console.error('[STRIPE] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Create booking
app.post('/api/booking', async (req, res) => {
  try {
    // reCAPTCHA v3 check - Skip for Twilio IVR requests
    const isTwilio = req.body.bookingRef && req.body.bookingRef.startsWith('VOICE-');
    if (!isTwilio) {
      const rc = await verifyRecaptcha(req.body.recaptchaToken);
      if (!rc.success) {
        console.log('[RECAPTCHA] Booking blocked — score:', rc.score);
        return res.json({ success: false, error: 'Security check failed. Please refresh the page and try again.' });
      }
    }
    const b = { ...req.body };
    delete b.recaptchaToken; // don't store token in DB

    // Validate addresses are full formatted (must contain a comma — suburb/state required)
    // Skip strict formatting for Twilio IVR voice inputs
    const hasFullAddr = (addr) => typeof addr === 'string' && addr.includes(',') && addr.trim().length > 10;
    if (!isTwilio) {
      if (!hasFullAddr(b.pickup)) {
        console.warn('[BOOKING] Rejected incomplete pickup address:', b.pickup);
        return res.json({ success: false, error: 'Please select your pickup address from the dropdown to include the full suburb and state.' });
      }
      if (!hasFullAddr(b.dropoff)) {
        console.warn('[BOOKING] Rejected incomplete dropoff address:', b.dropoff);
        return res.json({ success: false, error: 'Please select your drop-off address from the dropdown to include the full suburb and state.' });
      }
    }
    // Reject suspiciously low km (likely the 10km fallback bug — real Sydney routes are >3km)
    const kmVal = +(b.km || 0);
    if (kmVal > 0 && kmVal < 3) {
      console.warn('[BOOKING] Rejected suspiciously low km:', kmVal, 'for route:', b.pickup, '->', b.dropoff);
      return res.json({ success: false, error: 'Unable to calculate distance for this route. Please go back and re-enter your addresses.' });
    }

    b.ref     = b.bookingRef || genRef();
    b.status  = 'confirmed';
    b.created = new Date().toISOString();

    const vMap = {
      'silver service sedan': 'sedan',
      'lexus sedan – luxury': 'lexus',
      'lexus sedan - luxury': 'lexus',
      'suv / wagon':          'suv',
      'maxi taxi':            'maxi',
    };
    const vKey = vMap[(b.vehicle||'').toLowerCase()] || 'sedan';
    const tollsFromClient = +(b.tolls || 0);
    // Use live Google Routes API toll if client didn't send one
    const effectiveTolls  = tollsFromClient > 0 ? tollsFromClient : await resolveTolls(b.pickup, b.dropoff);
    // Resolve return leg tolls if return trip
    let returnTolls = 0;
    if (b.returnTrip) {
      const retPu = b.returnPickup || b.dropoff;
      const retDo = b.returnDropoff || b.pickup;
      returnTolls = await resolveTolls(retPu, retDo);
    }
    const airportFee = b.airportPickup ? 6.10 : +(b.airportFee || 0);
    const isCardPayment = (b.payment || '').toLowerCase().includes('card') || (b.payment || '').toLowerCase().includes('stripe');
    const fare = calcFare(vKey, +(b.km||0), effectiveTolls, b.returnTrip||false, airportFee, 0, returnTolls, isCardPayment);
     b.fareBreakdown = fare;
    b.fare = '$' + fare.total.toFixed(2);
    await DB.save(b);
    console.log('[BOOKING] #' + b.ref, b.name, b.vehicle, '|', b.pickup, '->', b.dropoff, '|', b.fare);

    // Respond immediately
    res.json({ success: true, ref: b.ref, fare });

    // Async notifications
    setImmediate(async () => {
      // Format date nicely: e.g. "Friday 3 April 2026 at 2:51 pm"
      const bookingDt = (() => {
        try {
          const [y,mo,d] = (b.date||'').split('-').map(Number);
          const [hh,mm] = (b.time||'00:00').split(':').map(Number);
          const dt = new Date(y, mo-1, d, hh, mm);
          const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const ampm = hh >= 12 ? 'pm' : 'am';
          const h12 = hh % 12 || 12;
          const minStr = mm > 0 ? `:${String(mm).padStart(2,'0')}` : '';
          return `${days[dt.getDay()]} ${d} ${months[mo-1]} ${y} at ${h12}${minStr} ${ampm}`;
        } catch(e) { return `${b.date} at ${b.time}`; }
      })();
       await sms(b.phone,
        `#${b.ref} — Your Sydney taxi booking confirmed for ${bookingDt}. Fare: ${b.fare} AUD. Amendments: 1800 173 171`);
      // Admin SMS disabled per owner request — Telegram notification used instead
      // Generate ICS calendar file for one-click calendar add
      const icsContent = (() => {
        try {
          const [y,mo,d] = (b.date||'').split('-').map(Number);
          const [hh,mm] = (b.time||'00:00').split(':').map(Number);
          const puSub = shortAddr(b.pickup);
          const doSub = shortAddr(b.dropoff);
          const fareAmt = b.fare || '$' + fare.total.toFixed(2);
          // Title format: PICKUP_SUBURB DROPOFF_SUBURB $FARE (e.g. "ROSELANDS MASCOT $78.99")
          const evtTitle = `${puSub} ${doSub} ${fareAmt}`;
          // Notes with full booking details
          const notes = [
            `Name: ${b.name}`,
            `Phone: ${b.phone}`,
            `Vehicle: ${b.vehicle}`,
            `Pickup: ${b.pickup}`,
            `Drop-off: ${b.dropoff}`,
            `Date: ${b.date} ${b.time}`,
            `Fare: ${fareAmt}`,
            `Booking Ref: #${b.ref}`,
            `Amendments: 1800 173 171`
          ].join('\\n');
          return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Silver Taxi Sydney Service//Booking//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `DTSTART;TZID=Australia/Sydney:${y}${String(mo).padStart(2,'0')}${String(d).padStart(2,'0')}T${String(hh).padStart(2,'0')}${String(mm).padStart(2,'0')}00`,
            `DTEND;TZID=Australia/Sydney:${y}${String(mo).padStart(2,'0')}${String(d).padStart(2,'0')}T${String(hh+1).padStart(2,'0')}${String(mm).padStart(2,'0')}00`,
            `SUMMARY:${evtTitle}`,
            `DESCRIPTION:${notes}`,
            `LOCATION:${b.pickup}`,
            `ORGANIZER;CN=Silver Taxi Sydney Service:mailto:info@silvertaxisydneyservice.com`,
            `ATTENDEE;CN=${b.name};TEL=${b.phone}:mailto:${b.email || 'info@silvertaxisydneyservice.com'}`,
            `STATUS:CONFIRMED`,
            `BEGIN:VALARM`,
            `TRIGGER:-PT30M`,
            `ACTION:DISPLAY`,
            `DESCRIPTION:Your Silver Service taxi arrives in 30 minutes`,
            `END:VALARM`,
            'END:VEVENT',
            'END:VCALENDAR'
          ].join('\r\n');
        } catch(e) { return null; }
      })();
      const icsAttachment = icsContent ? [{
        filename: `booking-${b.ref}.ics`,
        content: icsContent,
        contentType: 'text/calendar; method=PUBLISH'
      }] : [];

      // Send receipt to customer for ALL payment methods (not just card)
      if (b.email) {
        await email(b.email, `Booking Confirmation #${b.ref} – Silver Taxi Sydney Service`, receiptHtml(b, fare), icsAttachment);
      }

      // Build Telegram message with return trip as separate section
      const retPu = b.returnPickup || b.dropoff;
      const retDo = b.returnDropoff || b.pickup;
      const sourceLabel = b.source === '13cabssydney.com' ? '🟠 13 CABS SYDNEY'
        : b.source === 'silvertaxisydneyservice.com' ? '🔵 SILVER TAXI SYDNEY'
        : '🟢 SILVER TAXI SYDNEY SERVICE';
      const tgMsg =
        `<b>NEW BOOKING #${b.ref}</b>\n` +
        `<b>📍 ${sourceLabel}</b>\n` +
        `--------------------\n` +
        `<b>Passenger:</b> ${b.name}\n` +
        `<b>Phone:</b> ${b.phone}\n` +
        `<b>Vehicle:</b> ${b.vehicle}\n` +
        `\n<b>OUTBOUND TRIP</b>\n` +
        `Pickup: ${b.pickup}\n` +
        `Drop-off: ${b.dropoff}\n` +
        `Date: ${b.date} at ${b.time}\n` +
        (b.flight ? `Flight: ${b.flight}\n` : '') +
        (fare.airportFee > 0 ? `Airport Fee: $${fare.airportFee.toFixed(2)}\n` : '') +
        `Tolls: $${fare.tolls.toFixed(2)}\n` +
        `Outbound Fare: $${fare.sub.toFixed(2)}\n` +
        (b.returnTrip ? (
          `\n<b>RETURN TRIP (10% off)</b>\n` +
          `Pickup: ${retPu}\n` +
          `Drop-off: ${retDo}\n` +
          `Date: ${b.returnDate} at ${b.returnTime}\n` +
          (fare.returnTolls > 0 ? `Return Tolls: $${fare.returnTolls.toFixed(2)}\n` : '') +
          (fare.returnSub ? `Return Fare: $${fare.returnSub.toFixed(2)}\n` : '')
        ) : '') +
        `\n<b>Payment: ${b.payment}</b>\n` +
        `<b>TOTAL: ${b.fare}</b>`;

      // Generate Stripe Payment Link for ALL bookings (so admin can send to cash/EFTPOS customers)
      let stripePayLink = null;
      try {
        if (SVC.stripe) {
          // CabFare-style receipt:
          // Line 1: Fare (GST inclusive) = fare.total — shown as single fare line
          // Line 2: Extras = $0.00
          // Line 3: Tip = $0.00
          // Line 4: Service Fee (card processing) = 5% of fare.total
          // Line 5: Service Fee GST = GST component of service fee (1/11)
          // Total charged = fare.total + svcFee (GST already in fare, svcFeeGst already in svcFee)
          const pickupSuburb = shortAddr(b.pickup) || (b.pickup || '').split(',')[0].trim();
          const dropoffSuburb = shortAddr(b.dropoff) || (b.dropoff || '').split(',')[0].trim();
          const fareCents = Math.round(fare.total * 100); // GST-inclusive fare (what customer sees)
          const svcFeeCents = Math.round(fareCents * 0.05); // 5% card processing fee
          const svcFeeGstCents = Math.round(svcFeeCents / 11); // GST within service fee
          const svcFeeExGstCents = svcFeeCents - svcFeeGstCents; // service fee excl GST
          const totalCents = fareCents + svcFeeCents; // grand total charged
          const routeDesc = `${pickupSuburb} → ${dropoffSuburb} | ${b.date} at ${b.time}`;
          const pl = await SVC.stripe.paymentLinks.create({
            line_items: [
              {
                // Fare (inclusive of GST) — single fare line, no GST breakdown shown
                price_data: {
                  currency: 'aud',
                  product_data: {
                    name: `Fare (inclusive of GST)`,
                    description: `${routeDesc} | Company: SS Taxi Sydney NSW`,
                  },
                  unit_amount: fareCents,
                  tax_behavior: 'inclusive',
                },
                quantity: 1,
              },
              {
                // Service Fee (card processing fee, excl GST portion)
                price_data: {
                  currency: 'aud',
                  product_data: {
                    name: 'Service Fee',
                    description: 'Card processing fee',
                  },
                  unit_amount: svcFeeExGstCents,
                  tax_behavior: 'exclusive',
                },
                quantity: 1,
              },
            ],
            automatic_tax: { enabled: false },
            metadata: {
              booking_ref: b.ref,
              passenger: b.name,
              phone: b.phone,
              pickup: b.pickup,
              dropoff: b.dropoff,
              date: b.date,
              time: b.time,
              vehicle: b.vehicle,
              fare_incl_gst: (fareCents/100).toFixed(2),
              service_fee: (svcFeeCents/100).toFixed(2),
              service_fee_gst: (svcFeeGstCents/100).toFixed(2),
              total: (totalCents/100).toFixed(2),
            },
            after_completion: { type: 'redirect', redirect: { url: `https://silvertaxisydneyservice.com/booking-confirmed?ref=${b.ref}` } },
          });
          stripePayLink = pl.url;
          console.log('[STRIPE] Payment link created:', stripePayLink);
        }
      } catch(e) { console.error('[STRIPE] Payment link error:', e.message); }

      // Send payment link to customer via email and SMS
      // SKIP if customer already paid online (stripePI present = payment already completed on booking page)
      const alreadyPaidOnline = !!(b.stripePI);
      if (stripePayLink && !alreadyPaidOnline) {
        // Customer email with payment link
        const payEmailHtml = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#0f1f3d,#144a8f);padding:24px;text-align:center;border-radius:8px 8px 0 0;">
  <h2 style="color:#fff;margin:0;font-size:20px;">Silver Taxi Sydney Service</h2>
  <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:12px;">PREMIUM SYDNEY TAXI</p>
</div>
<div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
  <h3 style="color:#0f1f3d;margin:0 0 12px;">Complete Your Payment Online</h3>
  <p style="color:#374151;margin:0 0 8px;">Hi ${b.name},</p>
  <p style="color:#374151;margin:0 0 16px;">Your booking <strong>#${b.ref}</strong> is confirmed. You can pay securely online using the button below — it's quick, safe, and you'll receive an instant receipt.</p>
  <div style="background:#f0fdf4;border:1px solid #16a34a;border-radius:8px;padding:16px;margin-bottom:16px;">
    <p style="margin:0 0 4px;color:#166534;font-weight:700;">Amount Due</p>
    <p style="margin:0;font-size:28px;font-weight:900;color:#14532d;">$${fare.total.toFixed(2)} AUD</p>
    <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">GST included &bull; Booking #${b.ref}</p>
  </div>
  <a href="${stripePayLink}" style="display:block;text-align:center;padding:14px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:16px;"> PAY NOW — $${fare.total.toFixed(2)} AUD</a>
  <p style="color:#6b7280;font-size:12px;margin:0;">Or copy this link: <a href="${stripePayLink}" style="color:#144a8f;">${stripePayLink}</a></p>
</div></div>
<!-- Premium Footer/Signature -->
<div style="margin:0 auto; max-width:520px; overflow:hidden;">
  <!-- Quick Action Links -->
  <div style="background:#ffffff; padding:24px 24px 20px; border-top:1px solid #e5e7eb;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,sans-serif;">
      <tr>
        <td width="33%" style="text-align:center; padding:8px 4px;">
          <a href="https://silvertaxisydneyservice.com/book" style="text-decoration:none; display:block;">
            <div style="width:44px; height:44px; margin:0 auto 8px; background:linear-gradient(135deg,#0f1f3d,#144a8f); border-radius:50%; line-height:44px; text-align:center; font-size:18px;">&#128663;</div>
            <div style="font-size:12px; font-weight:700; color:#0f1f3d; text-transform:uppercase; letter-spacing:.04em;">Book Online</div>
            <div style="font-size:10px; color:#6b7280; margin-top:2px;">Quick &amp; easy booking</div>
          </a>
        </td>
        <td width="33%" style="text-align:center; padding:8px 4px;">
          <a href="https://silvertaxisydneyservice.com/contact" style="text-decoration:none; display:block;">
            <div style="width:44px; height:44px; margin:0 auto 8px; background:linear-gradient(135deg,#0f1f3d,#144a8f); border-radius:50%; line-height:44px; text-align:center; font-size:18px;">&#128172;</div>
            <div style="font-size:12px; font-weight:700; color:#0f1f3d; text-transform:uppercase; letter-spacing:.04em;">Contact Us</div>
            <div style="font-size:10px; color:#6b7280; margin-top:2px;">We're here to help</div>
          </a>
        </td>
        <td width="33%" style="text-align:center; padding:8px 4px;">
          <a href="https://silvertaxisydneyservice.com/manage" style="text-decoration:none; display:block;">
            <div style="width:44px; height:44px; margin:0 auto 8px; background:linear-gradient(135deg,#0f1f3d,#144a8f); border-radius:50%; line-height:44px; text-align:center; font-size:18px;">&#128221;</div>
            <div style="font-size:12px; font-weight:700; color:#0f1f3d; text-transform:uppercase; letter-spacing:.04em;">Manage Booking</div>
            <div style="font-size:10px; color:#6b7280; margin-top:2px;">Modify or cancel</div>
          </a>
        </td>
      </tr>
    </table>
  </div>
  <!-- Brand Signature Block -->
  <div style="background:#0f1f3d; padding:28px 28px 24px; border-radius:0 0 8px 8px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Georgia,'Times New Roman',serif;">
      <tr>
        <td>
          <div style="font-size:28px; font-weight:700; letter-spacing:2px; color:#ffffff; line-height:1.1;">SILVER SERVICE</div>
          <div style="font-size:14px; font-weight:700; letter-spacing:4px; color:#d4a63c; margin-top:4px;">TAXI SYDNEY</div>
          <div style="margin:16px 0 14px; border-top:1px solid rgba(255,255,255,0.15);"></div>
          <table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif; font-size:12px; line-height:2.2; color:#d0d4dc;">
            <tr>
              <td style="padding-right:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4a63c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></td>
              <td><a href="https://silvertaxisydneyservice.com" style="color:#d4a63c; text-decoration:none; font-weight:700;">silvertaxisydneyservice.com</a></td>
            </tr>
            <tr>
              <td style="padding-right:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></td>
              <td><a href="tel:1800173171" style="color:#ffffff; text-decoration:none;">1800 173 171</a></td>
            </tr>
            <tr>
              <td style="padding-right:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></td>
              <td><a href="mailto:info@silvertaxisydneyservice.com" style="color:#ffffff; text-decoration:none;">info@silvertaxisydneyservice.com</a></td>
            </tr>
          </table>
          <div style="margin-top:16px; font-size:10px; color:rgba(255,255,255,0.5); line-height:1.6; font-family:Arial,sans-serif;">Premium Airport Transfers &bull; Executive Corporate Travel &bull; Luxury Chauffeur Service &bull; Fixed Price Rides &bull; 24/7 Australia Wide Service</div>
        </td>
      </tr>
    </table>
  </div>
</div>`;
        if (b.email) {
          await email(b.email, `Pay Online — Booking #${b.ref} — $${fare.total.toFixed(2)} AUD`, payEmailHtml);
        }
        // Customer SMS with payment link
        await sms(b.phone, `Silver Service Booking #${b.ref} — Pay $${fare.total.toFixed(2)} AUD online: ${stripePayLink}`);
      } else if (alreadyPaidOnline) {
        console.log(`[BOOKING] #${b.ref} — Payment link NOT sent to customer (already paid online, stripePI: ${b.stripePI})`);
      }

      // Admin email (always sent, with payment link if available)
      const pickupSuburbEmail = shortAddr(b.pickup);
      const dropoffSuburbEmail = shortAddr(b.dropoff);
      await email(CFG.ADMIN_EMAIL, `${pickupSuburbEmail} To ${dropoffSuburbEmail} $${fare.total.toFixed(2)} — #${b.ref}`, adminEmailHtml(b, fare, stripePayLink));

      const tgFull = tgMsg +
        (stripePayLink ? `\n\n<b>PAYMENT LINK:</b>\n${stripePayLink}` : '') +
        `\n\nBooked: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST`;
      await tg(tgFull);

      // Quick-glance READY notification (sent 1 second after main notification)
      setTimeout(async () => {
        try {
          const timeStr = (() => {
            const [hh,mm] = (b.time||'00:00').split(':').map(Number);
            const ampm = hh >= 12 ? 'PM' : 'AM';
            const h12 = hh % 12 || 12;
            return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
          })();
          const puSuburb = shortAddr(b.pickup);
          const doSuburb = shortAddr(b.dropoff);
          await tg(`<b>READY ${timeStr}</b>\n\n${puSuburb}\n\n${doSuburb}`);
        } catch(e) { console.error('[TG READY] Error:', e.message); }
      }, 1000);
    });

  } catch(err) {
    console.error('[BOOKING] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Server error. Please call 1800 173 171.' });
  }
});

// Lookup booking (POST with phone)
app.post('/api/booking/lookup', (req, res) => {
  const b = DB.findByPhone(req.body.ref, req.body.phone);
  if (b) return res.json({ found: true, booking: b });
  res.json({ found: false });
});

// Lookup booking (GET with email or phone)
app.get('/api/booking/lookup', (req, res) => {
  const ref = (req.query.ref || '').replace('#','').toUpperCase();
  const email = (req.query.email || '').toLowerCase();
  const phone = req.query.phone || '';
  const b = DB.get(ref);
  if (!b) return res.json({ found: false });
  // Verify by email or phone
  const emailMatch = email && (b.email||'').toLowerCase() === email;
  const phoneMatch = phone && DB.findByPhone(ref, phone);
  // If no email/phone provided, still return booking (for admin-created bookings)
  if (emailMatch || phoneMatch || (!email && !phone)) {
    return res.json({ found: true, booking: b });
  }
  // Try partial match on email domain for flexibility
  if (email && b.email && b.email.toLowerCase().includes(email.split('@')[0])) {
    return res.json({ found: true, booking: b });
  }
  res.json({ found: false });
});

// Send OTP for manage booking (modify/cancel verification)
app.post('/api/booking/send-otp', async (req, res) => {
  const ref   = (req.body.ref   || '').replace('#','').toUpperCase();
  const phone = (req.body.phone || '').trim();
  const b = DB.get(ref);
  if (!b) return res.json({ success: false, error: 'Booking not found. Please check your reference number.' });
  // Verify phone matches booking
  const stored = (b.phone||'').replace(/\D/g,'');
  const query  = (phone||'').replace(/\D/g,'');
  if (!stored.endsWith(query.slice(-8))) {
    return res.json({ success: false, error: 'Phone number does not match this booking.' });
  }
  const code = genOTP();
  const key  = `manage:${ref}`;
  otpStore.set(key, { code, expires: Date.now() + 10 * 60 * 1000, phone: b.phone });
  console.log('[MANAGE OTP] Ref:', ref, '| Code:', code);
  await sms(b.phone, `Silver Taxi Sydney Service: Your booking management code is ${code}. Valid 10 min. Ref: #${ref}`);
  res.json({ success: true, masked: b.phone.replace(/.(?=.{4})/g, '*') });
});

// Verify OTP for manage booking
app.post('/api/booking/verify-otp', (req, res) => {
  const ref  = (req.body.ref  || '').replace('#','').toUpperCase();
  const code = (req.body.code || '').trim();
  const key  = `manage:${ref}`;
  const stored = otpStore.get(key);
  if (!stored) return res.json({ success: false, error: 'No code sent. Please request a new code.' });
  if (Date.now() > stored.expires) {
    otpStore.delete(key);
    return res.json({ success: false, error: 'Code expired. Please request a new one.' });
  }
  if (stored.code !== code) return res.json({ success: false, error: 'Incorrect code. Please try again.' });
  // Issue a short-lived manage token
  const token = crypto.randomBytes(16).toString('hex');
  otpStore.set(`token:${ref}`, { token, expires: Date.now() + 30 * 60 * 1000 });
  otpStore.delete(key);
  res.json({ success: true, token });
});

// Modify booking (requires manage token)
app.post('/api/booking/modify', async (req, res) => {
  const ref   = (req.body.ref || '').replace('#','').toUpperCase();
  const token = req.body.token || '';
  const b = DB.get(ref);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  // Verify manage token
  const stored = otpStore.get(`token:${ref}`);
  if (!stored || stored.token !== token || Date.now() > stored.expires) {
    return res.status(403).json({ error: 'Session expired. Please verify your phone again.' });
  }
  const { date, time, notes } = req.body;
  if (date)  b.date  = date;
  if (time)  b.time  = time;
  if (notes !== undefined) b.notes = notes;
  b.modified = new Date().toISOString();
  await sms(b.phone, `Silver Taxi Sydney Service: Booking #${b.ref} updated to ${b.date} at ${b.time}. Queries: 1800 173 171`);
  await tg(`<b>BOOKING MODIFIED #${b.ref}</b>\nName: ${b.name}\nNew Date: ${b.date} ${b.time}`);
  res.json({ success: true, booking: b });
});

// Cancel booking (requires manage token)
app.post('/api/booking/cancel', async (req, res) => {
  const ref   = (req.body.ref || '').replace('#','').toUpperCase();
  const token = req.body.token || '';
  const b = DB.get(ref);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  // Verify manage token
  const stored = otpStore.get(`token:${ref}`);
  if (!stored || stored.token !== token || Date.now() > stored.expires) {
    return res.status(403).json({ error: 'Session expired. Please verify your phone again.' });
  }
  if (b.status === 'cancelled') return res.json({ error: 'Booking is already cancelled.' });
  b.status    = 'cancelled';
  b.cancelled = new Date().toISOString();
  otpStore.delete(`token:${ref}`);
  await sms(b.phone, `Silver Taxi Sydney Service: Booking #${b.ref} has been cancelled. Queries: 1800 173 171`);
  await tg(`<b>BOOKING CANCELLED #${b.ref}</b>\nName: ${b.name}\nVehicle: ${b.vehicle}\nDate: ${b.date} ${b.time}`);
  res.json({ success: true });
});

// RESTful cancel endpoint — accepts email verification (used by manage.html)
app.post('/api/booking/:ref/cancel', async (req, res) => {
  const ref = (req.params.ref || '').replace('#','').toUpperCase();
  const emailInput = (req.body.email || '').toLowerCase().trim();
  const b = DB.get(ref);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (b.status === 'cancelled') return res.json({ error: 'Booking is already cancelled.' });
  // Verify email matches
  if (emailInput && b.email && !b.email.toLowerCase().includes(emailInput.split('@')[0])) {
    return res.status(403).json({ error: 'Email does not match this booking.' });
  }
  b.status    = 'cancelled';
  b.cancelled = new Date().toISOString();
  await sms(b.phone, `Silver Taxi Sydney Service: Booking #${b.ref} has been cancelled. Queries: 1800 173 171`);
  await tg(`<b>BOOKING CANCELLED #${b.ref}</b>\nName: ${b.name}\nVehicle: ${b.vehicle}\nDate: ${b.date} ${b.time}`);
  await email(b.email, `Booking Cancelled – #${b.ref}`,
    `<p>Hi ${b.name},</p><p>Your booking <b>#${b.ref}</b> has been cancelled as requested.</p><p>If you need a new booking, visit <a href="https://silvertaxisydneyservice.com/book">silvertaxisydneyservice.com/book</a></p>`);
  res.json({ success: true });
});

// RESTful modify endpoint — accepts email verification (used by manage.html)
app.post('/api/booking/:ref/modify', async (req, res) => {
  const ref = (req.params.ref || '').replace('#','').toUpperCase();
  const emailInput = (req.body.email || '').toLowerCase().trim();
  const b = DB.get(ref);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (b.status === 'cancelled') return res.status(400).json({ error: 'Cannot modify a cancelled booking.' });
  // Verify email matches
  if (emailInput && b.email && !b.email.toLowerCase().includes(emailInput.split('@')[0])) {
    return res.status(403).json({ error: 'Email does not match this booking.' });
  }
  const { date, time, notes } = req.body;
  if (!date || !time) return res.status(400).json({ error: 'Date and time are required.' });
  b.date  = date;
  b.time  = time;
  if (notes !== undefined) b.notes = notes;
  b.modified = new Date().toISOString();
  await sms(b.phone, `Silver Taxi Sydney Service: Booking #${b.ref} updated to ${b.date} at ${b.time}. Queries: 1800 173 171`);
  await tg(`<b>BOOKING MODIFIED #${b.ref}</b>\nName: ${b.name}\nNew Date: ${b.date} ${b.time}`);
  await email(b.email, `Booking Modified – #${b.ref}`,
    `<p>Hi ${b.name},</p><p>Your booking <b>#${b.ref}</b> has been updated:</p><ul><li>New Date: ${b.date}</li><li>New Time: ${b.time}</li>${notes ? `<li>Notes: ${notes}</li>` : ''}</ul>`);
  res.json({ success: true, booking: b });
});

// ─── Booking Payment Status (for IVR payment conversion tracking) ─────────────
app.get('/api/admin/booking/:ref/payment-status', (req, res) => {
  const ref = (req.params.ref || '').replace('#','').toUpperCase();
  const b = DB.get(ref);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  res.json({
    ref: b.ref,
    paymentStatus: b.paymentStatus || (b.stripePI ? 'paid' : 'pending'),
    stripePI: b.stripePI || null,
    stripeTransactionId: b.stripeTransactionId || null,
    payment: b.payment || 'Cash in Vehicle',
    fare: b.fare,
  });
});

// ─── Admin: IVR Conversion Analytics ─────────────────────────────────────────
app.get('/api/admin/ivr-stats', async (req, res) => {
  try {
    const Model = getIvrCallLogModel();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total30d, booked30d, abandoned30d, blocked30d, totalToday, bookedToday] = await Promise.all([
      Model.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Model.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: 'booked' }),
      Model.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: 'abandoned' }),
      Model.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: 'blocked' }),
      Model.countDocuments({ createdAt: { $gte: today } }),
      Model.countDocuments({ createdAt: { $gte: today }, status: 'booked' }),
    ]);

    // Payment conversion
    const paymentLinks = await Model.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      stripePaymentLinkId: { $exists: true, $ne: null }
    });
    const paymentsPaid = await Model.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      paymentStatus: 'paid'
    });

    // Recovery SMS stats
    const recoverySent = await Model.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      recoverySmssSent: true
    });

    res.json({
      period: '30 days',
      today: { calls: totalToday, booked: bookedToday },
      thirtyDays: {
        totalCalls: total30d,
        booked: booked30d,
        abandoned: abandoned30d,
        blocked: blocked30d,
        bookingRate: total30d > 0 ? ((booked30d / total30d) * 100).toFixed(1) + '%' : '0%',
      },
      payments: {
        linksSent: paymentLinks,
        paid: paymentsPaid,
        conversionRate: paymentLinks > 0 ? ((paymentsPaid / paymentLinks) * 100).toFixed(1) + '%' : '0%',
      },
      recovery: {
        smsSent: recoverySent,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load IVR stats', detail: err.message });
  }
});

// ─── Admin: Refund a booking payment ───────────────────────────────────────
app.post('/api/admin/booking/:ref/refund', async (req, res) => {
  const ref = (req.params.ref || '').replace('#','').toUpperCase();
  const b = DB.get(ref);
  if (!b) return res.status(404).json({ error: 'Booking not found' });

  const transactionId = b.stripeTransactionId || b.stripePI;
  if (!transactionId) return res.status(400).json({ error: 'No payment transaction found for this booking' });

  try {
    const refund = await SVC.stripe.refunds.create({ payment_intent: transactionId });
    b.paymentStatus = 'refunded';
    b.refundId = refund.id;
    b.refundedAt = new Date().toISOString();
    await DB.save(b);

    // Notify customer
    await sms(b.phone, `Silver Taxi Sydney: A refund of ${b.fare} has been processed for booking #${ref}. Please allow 5-10 business days.`);
    console.log(`[REFUND] Processed for #${ref} | Refund ID: ${refund.id}`);
    res.json({ success: true, refundId: refund.id });
  } catch (err) {
    console.error('[REFUND] Error:', err.message);
    res.status(500).json({ error: 'Refund failed', detail: err.message });
  }
});

// ─── Admin: Resend payment receipt ─────────────────────────────────────────
app.post('/api/admin/booking/:ref/resend-receipt', async (req, res) => {
  const ref = (req.params.ref || '').replace('#','').toUpperCase();
  const b = DB.get(ref);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (!b.email) return res.status(400).json({ error: 'No email on file for this booking' });

  try {
    const fare = b.fareBreakdown || { total: parseFloat((b.fare || '0').replace('$', '')) };
    await email(b.email, `Payment Receipt #${ref} – Silver Taxi Sydney Service`, receiptHtml(b, fare));
    console.log(`[RECEIPT] Resent to ${b.email} for #${ref}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend receipt', detail: err.message });
  }
});

// ─── Customer History (for IVR Returning Customer Recognition) ────────────────
app.get('/api/admin/customer-history/:phone', (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone).replace(/\s/g, '');
    const phoneDigits = phone.replace(/\D/g, '');
    const last8 = phoneDigits.slice(-8);

    // Find all bookings for this phone number
    const allBookings = DB.all();
    const customerBookings = allBookings.filter(b => {
      const bPhone = (b.phone || '').replace(/\D/g, '');
      return bPhone.endsWith(last8) && b.status !== 'cancelled';
    });

    if (customerBookings.length === 0) {
      return res.json({ found: false });
    }

    // Get customer name from most recent booking
    const sortedBookings = customerBookings.sort((a, b) => {
      const da = new Date(a.created || a.createdAt || 0);
      const db = new Date(b.created || b.createdAt || 0);
      return db - da;
    });
    const latestBooking = sortedBookings[0];
    const name = latestBooking.name || '';

    // Find most frequent route (pickup/dropoff pair)
    const routeMap = new Map();
    customerBookings.forEach(b => {
      if (b.pickup && b.dropoff) {
        const key = `${b.pickup}|||${b.dropoff}`;
        const existing = routeMap.get(key) || { count: 0, pickup: b.pickup, dropoff: b.dropoff, vehicle: b.vehicle };
        existing.count++;
        routeMap.set(key, existing);
      }
    });

    let frequentRoute = null;
    if (routeMap.size > 0) {
      const sorted = [...routeMap.values()].sort((a, b) => b.count - a.count);
      if (sorted[0].count >= 2) {
        frequentRoute = sorted[0];
      }
    }

    res.json({
      found: true,
      name,
      phone,
      totalBookings: customerBookings.length,
      frequentRoute,
      bookings: sortedBookings.slice(0, 5).map(b => ({
        ref: b.ref,
        pickup: b.pickup,
        dropoff: b.dropoff,
        date: b.date,
        time: b.time,
        vehicle: b.vehicle,
        fare: b.fare,
        status: b.status,
      })),
    });
  } catch (err) {
    console.error('[CUSTOMER HISTORY] Error:', err.message);
    res.json({ found: false });
  }
});

// Contact form
app.post('/api/contact', async (req, res) => {
  try {
    const b = req.body;
    const firstName = (b.firstName || '').trim();
    const lastName  = (b.lastName  || '').trim();
    const name      = b.name || `${firstName} ${lastName}`.trim() || 'Unknown';
    const emailAddr = (b.emailAddr || b.email || '').trim();
    const phone     = (b.phone || 'N/A').trim();
    const subject   = (b.subject || b.enquiryType || 'General Enquiry').trim();
    const message   = (b.message || '').trim();
    const enquiryType = (b.enquiryType || b.subject || 'general').trim();
    const submittedAt = new Date().toISOString();

    console.log('[CONTACT]', name, emailAddr, subject);

    // Map enquiry type to readable label
    const enquiryLabels = {
      'receipt':         'Receipt',
      'fare-payment':    'Fare / Payment',
      'lost-property':   'For lost property',
      'modify-booking':  'Modify / Cancel Booking',
      'booking':         'Booking Enquiry',
      'corporate':       'Corporate Account',
      'feedback':        'Feedback',
      'complaint':       'Complaint',
      'other':           'Other'
    };
    const enquiryLabel = enquiryLabels[enquiryType] || subject;

    // Save contact submission to MongoDB
    try {
      const ContactModel = mongoose.models.Contact ||
        mongoose.model('Contact', new mongoose.Schema({}, { strict: false }), 'contacts');
      await ContactModel.create({
        name, firstName, lastName, email: emailAddr, phone,
        subject: enquiryLabel, enquiryType, message,
        submittedAt, source: 'contact-form'
      });
      console.log('[CONTACT] Saved to MongoDB');
    } catch(dbErr) {
      console.error('[CONTACT] MongoDB save error:', dbErr.message);
    }

    // Send admin email
    await email(
      CFG.ADMIN_EMAIL,
      ` New Contact Enquiry: ${enquiryLabel} – ${name}`,
      `<div style="font-family:sans-serif;max-width:600px">`+
      `<h2 style="color:#0f1f3d;border-bottom:3px solid #A8B4C0;padding-bottom:12px">New Contact Form Submission</h2>`+
      `<table style="width:100%;border-collapse:collapse">`+
      `<tr><td style="padding:8px 0;color:#6b7a99;width:120px"><b>Name</b></td><td style="padding:8px 0;color:#2d3a52">${name}</td></tr>`+
      `<tr><td style="padding:8px 0;color:#6b7a99"><b>Email</b></td><td style="padding:8px 0"><a href="mailto:${emailAddr}" style="color:#144a8f">${emailAddr}</a></td></tr>`+
      `<tr><td style="padding:8px 0;color:#6b7a99"><b>Phone</b></td><td style="padding:8px 0"><a href="tel:${phone}" style="color:#144a8f">${phone}</a></td></tr>`+
      `<tr><td style="padding:8px 0;color:#6b7a99"><b>Enquiry Type</b></td><td style="padding:8px 0;color:#2d3a52">${enquiryLabel}</td></tr>`+
      `<tr><td style="padding:8px 0;color:#6b7a99;vertical-align:top"><b>Message</b></td><td style="padding:8px 0;color:#2d3a52">${(message||'').replace(/\n/g,'<br>')}</td></tr>`+
      `<tr><td style="padding:8px 0;color:#6b7a99"><b>Submitted</b></td><td style="padding:8px 0;color:#2d3a52">${submittedAt}</td></tr>`+
      `</table>`+
      `<div style="margin-top:24px;padding:16px;background:#eef2fa;border-radius:8px">`+
      `<a href="tel:${phone}" style="color:#144a8f;font-weight:bold"> Call ${name}</a> &nbsp;|&nbsp; `+
      `<a href="mailto:${emailAddr}" style="color:#144a8f;font-weight:bold">️ Reply by Email</a>`+
      `</div></div>`
    );

    // Send Telegram notification
    await tg(
      ` <b>NEW CONTACT ENQUIRY</b>\n`+
      `━━━━━━━━━━━━━━━━━━\n`+
      ` <b>Name:</b> ${name}\n`+
      ` <b>Email:</b> ${emailAddr}\n`+
      ` <b>Phone:</b> ${phone}\n`+
      ` <b>Enquiry:</b> ${enquiryLabel}\n`+
      ` <b>Message:</b> ${message.slice(0,500)}\n`+
      ` <b>Time:</b> ${new Date().toLocaleString('en-AU',{timeZone:'Australia/Sydney'})}`
    );

    res.json({ success: true });
  } catch(err) {
    console.error('[CONTACT] Error:', err.message);
    res.status(500).json({ success: false, error: 'Server error. Please call 1800 173 171.' });
  }
});

// Admin login - tokens stored server-side for persistent sessions
const ADMIN_TOKENS = new Set();

app.post('/api/admin/login', (req, res) => {
  if (req.body.password === CFG.ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    ADMIN_TOKENS.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Validate admin token (used by frontend to check if still logged in)
app.get('/api/admin/verify-token', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '') || req.query.token;
  if (token && ADMIN_TOKENS.has(token)) {
    res.json({ valid: true });
  } else {
    // If no server-side tokens exist (server restarted), accept any token
    // This prevents logout on server restart
    if (ADMIN_TOKENS.size === 0 && token && token.length === 64) {
      ADMIN_TOKENS.add(token);
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false });
    }
  }
});

// Admin: all bookings
app.get('/api/admin/bookings', (req, res) => {
  const all = DB.all();
  res.json({
    total:    DB.bookings.size,
    bookings: all,
    revenue:  all.filter(b => b.status === 'confirmed')
                 .reduce((s, b) => s + (b.fareBreakdown?.total || 0), 0).toFixed(2)
  });
});

// Admin: update booking status (legacy route)
app.post('/api/admin/booking/status', async (req, res) => {
  const { ref: r, status } = req.body;
  const b = DB.get(r);
  if (!b) return res.status(404).json({ error: 'Not found' });
  b.status = status;
  b.statusUpdated = new Date().toISOString();
  await DB.save(b);
  if (status === 'cancelled') {
    await sms(b.phone, `Silver Taxi Sydney Service: Booking #${b.ref} has been cancelled. Queries: 1800 173 171`);
  }
  res.json({ success: true, booking: b });
});
// Admin: update booking status (RESTful route)
app.post('/api/admin/booking/:id/status', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  let b = DB.get(id);
  if (!b) b = DB.all().find(x => x.id === id || x.bookingRef === id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  b.status = status;
  b.statusUpdated = new Date().toISOString();
  await DB.save(b);
  if (status === 'cancelled') {
    await sms(b.phone, `Silver Taxi Sydney Service: Booking #${b.ref} has been cancelled. Queries: 1800 173 171`);
  } else if (status === 'confirmed') {
    await sms(b.phone, `Silver Taxi Sydney Service: Booking #${b.ref} is CONFIRMED. Pickup: ${b.pickup}. Date: ${b.date} ${b.time}. Queries: 1800 173 171`);
  }
  res.json({ success: true, booking: b });
});

// Admin: assign driver to booking
app.post('/api/admin/booking/:id/assign', async (req, res) => {
  const id = req.params.id;
  const { driverId } = req.body;
  let b = DB.get(id);
  if (!b) b = DB.all().find(x => x.id === id || x.bookingRef === id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  const driver = DB.drivers.get(driverId);
  b.assignedDriver = driverId;
  b.driverName = driver ? `${driver.firstName} ${driver.lastName}` : driverId;
  b.status = 'assigned';
  b.statusUpdated = new Date().toISOString();
  await DB.save(b);
  if (driver) {
    await sms(b.phone, `Silver Taxi Sydney Service: Driver ${driver.firstName} has been assigned to your booking #${b.ref}. Queries: 1800 173 171`);
  }
  res.json({ success: true, booking: b });
});

// Admin: edit existing booking
app.post('/api/admin/booking/:id/edit', async (req, res) => {
  const id = req.params.id;
  const d = req.body;
  let b = DB.get(id);
  if (!b) b = DB.all().find(x => x.id === id || x.bookingRef === id || x.ref === id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  // Update all provided fields
  if (d.firstName !== undefined) { b.firstName = d.firstName; b.name = `${d.firstName} ${d.lastName||b.lastName||''}`.trim(); }
  if (d.lastName  !== undefined) { b.lastName  = d.lastName;  b.name = `${b.firstName||''} ${d.lastName}`.trim(); }
  if (d.phone     !== undefined) b.phone    = d.phone;
  if (d.email     !== undefined) b.email    = d.email;
  if (d.pickupAddress  !== undefined) { b.pickupAddress  = d.pickupAddress;  b.pickup  = d.pickupAddress; }
  if (d.dropoffAddress !== undefined) { b.dropoffAddress = d.dropoffAddress; b.dropoff = d.dropoffAddress; }
  if (d.pickupDateTime !== undefined) {
    b.pickupDateTime = d.pickupDateTime;
    const dt = new Date(d.pickupDateTime);
    b.date = dt.toISOString().slice(0,10);
    b.time = dt.toTimeString().slice(0,5);
  }
  if (d.vehicle       !== undefined) { b.vehicle = d.vehicle; b.vehicleKey = d.vehicle; }
  if (d.estimatedFare !== undefined) { b.estimatedFare = d.estimatedFare; b.fareBreakdown = { total: d.estimatedFare }; b.fare = `$${d.estimatedFare.toFixed(2)}`; }
  if (d.status        !== undefined) b.status      = d.status;
  if (d.payment       !== undefined) b.payment     = d.payment;
  if (d.flightNumber  !== undefined) { b.flightNumber = d.flightNumber; b.flight = d.flightNumber; }
  if (d.notes         !== undefined) b.notes       = d.notes;
  b.lastModified = new Date().toISOString();
  await DB.save(b);
  res.json({ success: true, booking: b });
});

// Admin: create booking manually
app.post('/api/admin/bookings', async (req, res) => {
  try {
    const d = req.body;
    const ref = genRef();
    const name = d.name || `${d.firstName||''} ${d.lastName||''}`.trim();
    const pickup = d.pickupAddress || d.pickup || '';
    const dropoff = d.dropoffAddress || d.dropoff || '';
    // Parse pickupDateTime in AEST timezone to avoid UTC conversion issues
    let date, time;
    if (d.pickupDateTime) {
      const dtStr = d.pickupDateTime;
      // If it contains +10:00 or +11:00 (AEST/AEDT), extract date/time directly from the string
      const isoMatch = dtStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      if (isoMatch) {
        date = isoMatch[1];
        time = isoMatch[2];
      } else {
        // Fallback: use Intl to format in Sydney timezone
        const dt = new Date(dtStr);
        date = dt.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // YYYY-MM-DD
        time = dt.toLocaleTimeString('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false });
      }
    } else {
      const dt = new Date();
      date = dt.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
      time = dt.toLocaleTimeString('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false });
    }
    let fareAmt = parseFloat(d.estimatedFare) || 0;
    let stripeChargeId = null;
    if (d.payment === 'Card (Stripe)' && d.stripeToken && SVC.stripe) {
      const cardFeeCents = Math.round(fareAmt * 100 * 0.05);
      const amountCents = Math.round(fareAmt * 100) + cardFeeCents;
      try {
        const puSuburb3 = (pickup || '').split(',')[0].trim();
        const doSuburb3 = (dropoff || '').split(',')[0].trim();
        const charge = await SVC.stripe.charges.create({
          amount: amountCents, currency: 'aud', source: d.stripeToken,
          description: `Silver Taxi Sydney — ${puSuburb3} → ${doSuburb3} | ${date} at ${time}`,
          metadata: { bookingRef: ref, pickup, dropoff, date, time }
        });
        stripeChargeId = charge.id;
        console.log('[STRIPE] Admin charge:', charge.id, '| $' + (amountCents/100).toFixed(2));
      } catch(stripeErr) {
        console.error('[STRIPE] Charge failed:', stripeErr.message);
        return res.status(400).json({ error: 'Card payment failed: ' + stripeErr.message });
      }
    }
    const fareObj = {
      sub: fareAmt,
      total: fareAmt,
      km: 0,
      tolls: 0,
      bookingFee: 2.50
    };
    const b = {
      ref, id: ref, bookingRef: ref,
      vehicle: d.vehicle || 'sedan',
      vehicleKey: d.vehicle || 'sedan',
      pickup, dropoff,
      pickupAddress: pickup, dropoffAddress: dropoff,
      date, time, pickupDateTime: d.pickupDateTime || dt.toISOString(),
      passengers: d.passengers || 1,
      returnTrip: false,
      flight: d.flightNumber || '', flightNumber: d.flightNumber || '',
      notes: d.notes || '',
      name, firstName: d.firstName || name.split(' ')[0], lastName: d.lastName || name.split(' ').slice(1).join(' '),
      email: d.email || '',
      phone: d.phone || '',
      payment: d.payment || 'Admin Created',
      estimatedFare: fareAmt,
      fareBreakdown: fareObj,
      fare: `$${fareAmt.toFixed(2)}`,
      status: d.status || 'confirmed',
      stripeChargeId: stripeChargeId || null,
      created: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await DB.save(b);

    // SMS to customer (if phone provided) - format date/time nicely
    if (b.phone) {
      const smsDt = (() => {
        try {
          const [y,mo,d2] = (b.date||'').split('-').map(Number);
          const [hh,mm] = (b.time||'00:00').split(':').map(Number);
          const dt2 = new Date(y, mo-1, d2, hh, mm);
          const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const ampm = hh >= 12 ? 'pm' : 'am';
          const h12 = hh % 12 || 12;
          const minStr = mm > 0 ? `:${String(mm).padStart(2,'0')}` : '';
          return `${days[dt2.getDay()]} ${d2} ${months[mo-1]} ${y} at ${h12}${minStr} ${ampm}`;
        } catch(e) { return `${b.date} at ${b.time}`; }
      })();
      await sms(b.phone,
        `#${b.ref} — Your Silver Service booking is confirmed for ${smsDt}. Fare: ${b.fare} AUD. Queries: 1800 173 171`);
    }

    // Generate ICS for admin-created bookings
    const adminIcs = (() => {
      try {
        const [y,mo,d2] = (b.date||'').split('-').map(Number);
        const [hh,mm] = (b.time||'00:00').split(':').map(Number);
        const puSub = shortAddr(b.pickup);
        const doSub = shortAddr(b.dropoff);
        const evtTitle = `${puSub} ${doSub} ${b.fare}`;
        const notes = [
          `Name: ${b.name}`,`Phone: ${b.phone}`,`Vehicle: ${b.vehicle}`,
          `Pickup: ${b.pickup}`,`Drop-off: ${b.dropoff}`,
          `Date: ${b.date} ${b.time}`,`Fare: ${b.fare}`,
          `Booking Ref: #${b.ref}`,`Amendments: 1800 173 171`
        ].join('\\n');
        return [
          'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Silver Taxi Sydney Service//Booking//EN',
          'CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
          `DTSTART;TZID=Australia/Sydney:${y}${String(mo).padStart(2,'0')}${String(d2).padStart(2,'0')}T${String(hh).padStart(2,'0')}${String(mm).padStart(2,'0')}00`,
          `DTEND;TZID=Australia/Sydney:${y}${String(mo).padStart(2,'0')}${String(d2).padStart(2,'0')}T${String(hh+1).padStart(2,'0')}${String(mm).padStart(2,'0')}00`,
          `SUMMARY:${evtTitle}`,`DESCRIPTION:${notes}`,`LOCATION:${b.pickup}`,
          `ORGANIZER;CN=Silver Taxi Sydney Service:mailto:info@silvertaxisydneyservice.com`,
          `STATUS:CONFIRMED`,
          `BEGIN:VALARM`,`TRIGGER:-PT30M`,`ACTION:DISPLAY`,
          `DESCRIPTION:Your Silver Service taxi arrives in 30 minutes`,`END:VALARM`,
          'END:VEVENT','END:VCALENDAR'
        ].join('\r\n');
      } catch(e) { return null; }
    })();
    const adminIcsAttach = adminIcs ? [{ filename: `booking-${b.ref}.ics`, content: adminIcs, contentType: 'text/calendar; method=PUBLISH' }] : [];

    // Receipt email to customer (if email provided)
    if (b.email) {
      await email(b.email, `Booking Confirmation #${b.ref} – Silver Taxi Sydney Service`, receiptHtml(b, fareObj), adminIcsAttach);
    }

    // Notification email to owner
    const puSubAdmin = shortAddr(b.pickup);
    const doSubAdmin = shortAddr(b.dropoff);
    await email(CFG.ADMIN_EMAIL, `${puSubAdmin} To ${doSubAdmin} ${b.fare} — #${b.ref}`, adminEmailHtml(b, fareObj));

    // Telegram notification
    await tg(
      `<b>[ADMIN CREATED] #${b.ref}</b>\n` +
      `Name: ${b.name}\nPhone: ${b.phone || 'N/A'}\nVehicle: ${b.vehicle}\n` +
      `Pickup: ${b.pickup}\nDrop-off: ${b.dropoff}\n` +
      `Date: ${b.date} ${b.time}\nFare: ${b.fare}`
    );
    // READY notification for admin-created bookings
    setTimeout(async () => {
      try {
        const [hh,mm] = (b.time||'00:00').split(':').map(Number);
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h12 = hh % 12 || 12;
        const timeStr = `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
        await tg(`<b>READY ${timeStr}</b>\n\n${shortAddr(b.pickup)}\n\n${shortAddr(b.dropoff)}`);
      } catch(e) {}
    }, 1000);

    res.json({ success: true, booking: b, ref });
  } catch(err) {
    console.error('[ADMIN CREATE BOOKING] Error:', err.message);
    res.status(500).json({ error: 'Failed to create booking', detail: err.message });
  }
});
// Admin: drivers CRUDD
app.get('/api/admin/drivers', (req, res) => {
  const drivers = [...DB.drivers.values()];
  res.json({ drivers });
});

app.post('/api/admin/drivers', async (req, res) => {
  const d = req.body;
  const id = 'DRV' + Date.now();
  const driver = { id, ...d, active: true, created: new Date().toISOString() };
  await DB.saveDriver(driver);
  res.json({ success: true, driver });
});

app.post('/api/admin/driver/:id/activate', async (req, res) => {
  const d = DB.drivers.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Driver not found' });
  d.active = true;
  await DB.saveDriver(d);
  res.json({ success: true });
});

app.post('/api/admin/driver/:id/deactivate', async (req, res) => {
  const d = DB.drivers.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Driver not found' });
  d.active = false;
  await DB.saveDriver(d);
  res.json({ success: true });
});

app.delete('/api/admin/driver/:id', async (req, res) => {
  await DB.deleteDriver(req.params.id);
  res.json({ success: true });
});

// ─── IVR Call Logs ────────────────────────────────────────────────────────────
// Lazy-load the IvrCallLog model (same MongoDB connection, different collection)
let IvrCallLogModel;
function getIvrCallLogModel() {
  if (!IvrCallLogModel) {
    const schema = new mongoose.Schema({
      callSid:       String,
      caller:        String,
      passengerName: String,
      phone:         String,
      pickup:        String,
      dropoff:       String,
      date:          String,
      time:          String,
      vehicle:       String,
      fareEstimate:  String,
      fareAmount:    Number,
      distanceKm:    Number,
      durationMin:   Number,
      status:        String,
      recordingUrl:  String,
      bookingRef:    String,
      notes:         String,
      source:        String,
      createdAt:     Date
    }, { collection: 'ivr_calls', strict: false });
    IvrCallLogModel = mongoose.model('IvrCallLog', schema);
  }
  return IvrCallLogModel;
}

app.get('/api/admin/ivr-calls', async (req, res) => {
  try {
    const Model = getIvrCallLogModel();
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
    const skip  = parseInt(req.query.skip || '0', 10);
    const calls = await Model.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await Model.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Model.countDocuments({ createdAt: { $gte: today } });
    const bookedCount = await Model.countDocuments({ status: 'booked' });
    res.json({
      total,
      todayCount,
      bookedCount,
      calls
    });
  } catch (err) {
    console.error('[IVR Calls] API error:', err.message);
    res.status(500).json({ error: 'Failed to load IVR call logs', detail: err.message });
  }
});

// ─── Admin IVR Calls: Aggregated by Caller (History Cleanup) ─────────────────
const ADMIN_HIDDEN_NUMBERS = ['+61420439848', '+420439848', '0420439848'];

app.get('/api/admin/ivr-calls/aggregated', async (req, res) => {
  try {
    const Model = getIvrCallLogModel();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const perPage = Math.min(parseInt(req.query.perPage || '20', 10), 100);
    const skip = (page - 1) * perPage;
    const filter = req.query.filter || 'all'; // all, booked, abandoned, spam, blocked

    // Aggregate calls grouped by phone number, excluding admin number
    const pipeline = [
      { $match: { phone: { $nin: ADMIN_HIDDEN_NUMBERS } } },
      { $group: {
        _id: '$phone',
        totalCalls: { $sum: 1 },
        successfulBookings: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } },
        abandonedCalls: { $sum: { $cond: [{ $eq: ['$status', 'abandoned'] }, 1, 0] } },
        failedCalls: { $sum: { $cond: [{ $in: ['$status', ['failed', 'failed-validation', 'transferred']] }, 1, 0] } },
        lastCallDate: { $max: '$createdAt' },
        lastBookingRef: { $last: { $cond: [{ $eq: ['$status', 'booked'] }, '$bookingRef', null] } },
        callerName: { $last: '$name' },
        lastPickup: { $last: '$pickup' },
        lastDropoff: { $last: '$dropoff' },
        lastVehicle: { $last: '$vehicle' },
        lastFare: { $last: '$fareEstimate' },
        callSids: { $push: '$callSid' },
        lastStatus: { $last: '$status' },
        paymentStatus: { $last: '$paymentStatus' },
      }},
      { $addFields: {
        phone: '$_id',
        spamScore: {
          $cond: {
            if: { $gte: ['$totalCalls', 5] },
            then: {
              $round: [{ $multiply: [
                { $divide: ['$abandonedCalls', { $max: ['$totalCalls', 1] }] },
                100
              ] }, 0]
            },
            else: 0
          }
        },
        isFrequentCaller: { $gte: ['$totalCalls', 3] },
      }},
      { $sort: { lastCallDate: -1 } },
    ];

    // Apply filter
    if (filter === 'booked') {
      pipeline.push({ $match: { successfulBookings: { $gte: 1 } } });
    } else if (filter === 'abandoned') {
      pipeline.push({ $match: { abandonedCalls: { $gte: 1 }, successfulBookings: 0 } });
    } else if (filter === 'spam') {
      pipeline.push({ $match: { spamScore: { $gte: 60 } } });
    } else if (filter === 'blocked') {
      // Will filter after blacklist check
    }

    // Pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Model.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: perPage });

    const callers = await Model.aggregate(pipeline);

    // Check blacklist status for each caller
    const BlacklistModel = getBlacklistModel();
    const phones = callers.map(c => c.phone).filter(Boolean);
    const blacklisted = await BlacklistModel.find({ phone: { $in: phones } }).lean();
    const blacklistMap = new Map(blacklisted.map(b => [b.phone, b]));

    const enrichedCallers = callers.map(c => ({
      ...c,
      isBlacklisted: blacklistMap.has(c.phone),
      blacklistInfo: blacklistMap.get(c.phone) || null,
    }));

    res.json({ total, page, perPage, totalPages: Math.ceil(total / perPage), callers: enrichedCallers });
  } catch (err) {
    console.error('[IVR Aggregated] API error:', err.message);
    res.status(500).json({ error: 'Failed to load aggregated IVR data', detail: err.message });
  }
});

// ─── Admin IVR Calls: Get individual calls for a specific phone ──────────────
app.get('/api/admin/ivr-calls/by-phone/:phone', async (req, res) => {
  try {
    const Model = getIvrCallLogModel();
    const phone = decodeURIComponent(req.params.phone);
    const calls = await Model.find({ phone }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ calls });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load calls for phone', detail: err.message });
  }
});

// ─── Blacklist Model ─────────────────────────────────────────────────────────
let BlacklistModel = null;
function getBlacklistModel() {
  if (!BlacklistModel) {
    const schema = new mongoose.Schema({
      phone:     { type: String, required: true, unique: true, index: true },
      type:      { type: String, enum: ['temporary', 'permanent'], default: 'permanent' },
      reason:    String,
      blockedBy: String,
      expiresAt: Date,
      createdAt: { type: Date, default: Date.now },
    }, { collection: 'blacklist', strict: false });
    BlacklistModel = mongoose.model('Blacklist', schema);
  }
  return BlacklistModel;
}

// ─── Admin: Block/Unblock Caller ─────────────────────────────────────────────
app.post('/api/admin/blacklist', async (req, res) => {
  try {
    const { phone, type, reason, blockedBy } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    const Model = getBlacklistModel();
    const normalizedPhone = phone.replace(/\s/g, '');

    const entry = await Model.findOneAndUpdate(
      { phone: normalizedPhone },
      {
        phone: normalizedPhone,
        type: type || 'permanent',
        reason: reason || 'Blocked by admin',
        blockedBy: blockedBy || 'Admin',
        expiresAt: type === 'temporary' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`[BLACKLIST] Blocked: ${normalizedPhone} | Type: ${type} | Reason: ${reason}`);
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block caller', detail: err.message });
  }
});

app.delete('/api/admin/blacklist/:phone', async (req, res) => {
  try {
    const Model = getBlacklistModel();
    const phone = decodeURIComponent(req.params.phone).replace(/\s/g, '');
    await Model.deleteOne({ phone });
    console.log(`[BLACKLIST] Unblocked: ${phone}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock caller', detail: err.message });
  }
});

app.get('/api/admin/blacklist', async (req, res) => {
  try {
    const Model = getBlacklistModel();
    const entries = await Model.find({}).sort({ createdAt: -1 }).lean();
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load blacklist', detail: err.message });
  }
});

// Check if a phone is blacklisted (used by IVR)
app.get('/api/admin/blacklist/check/:phone', async (req, res) => {
  try {
    const Model = getBlacklistModel();
    const phone = decodeURIComponent(req.params.phone).replace(/\s/g, '');
    const entry = await Model.findOne({ phone }).lean();
    if (entry) {
      // Check if temporary block has expired
      if (entry.type === 'temporary' && entry.expiresAt && new Date() > new Date(entry.expiresAt)) {
        await Model.deleteOne({ phone });
        return res.json({ blocked: false });
      }
      return res.json({ blocked: true, entry });
    }
    res.json({ blocked: false });
  } catch (err) {
    res.json({ blocked: false });
  }
});

// ─── Export Contacts (CSV) ────────────────────────────────────────────────────
app.get('/api/admin/export-contacts', async (req, res) => {
  try {
    const Model = getIvrCallLogModel();
    const filter = req.query.filter || 'all'; // all, mobile-only, booked

    const pipeline = [
      { $match: { phone: { $nin: ADMIN_HIDDEN_NUMBERS } } },
      { $group: {
        _id: '$phone',
        name: { $last: '$passengerName' },
        totalCalls: { $sum: 1 },
        bookings: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } },
        lastCallDate: { $max: '$createdAt' },
        lastPickup: { $last: '$pickup' },
        lastDropoff: { $last: '$dropoff' },
      }},
      { $addFields: { phone: '$_id' } },
      { $sort: { lastCallDate: -1 } },
    ];

    if (filter === 'mobile-only') {
      pipeline.splice(0, 0, { $match: { phone: { $regex: /^\+614/ } } });
    } else if (filter === 'booked') {
      pipeline.push({ $match: { bookings: { $gte: 1 } } });
    }

    const contacts = await Model.aggregate(pipeline);

    // Filter out anonymous/invalid numbers
    const validContacts = contacts.filter(c => c.phone && c.phone.length >= 10 && !c.phone.includes('unknown') && !c.phone.includes('Anonymous'));

    // Generate CSV
    let csv = 'Phone,Name,Total Calls,Bookings,Last Call,Last Pickup,Last Dropoff\n';
    validContacts.forEach(c => {
      const phone = (c.phone || '').replace('+61', '0');
      const name = (c.name || '').replace(/,/g, ' ');
      const lastCall = c.lastCallDate ? new Date(c.lastCallDate).toISOString().split('T')[0] : '';
      const pickup = (c.lastPickup || '').replace(/,/g, ' ');
      const dropoff = (c.lastDropoff || '').replace(/,/g, ' ');
      csv += `${phone},${name},${c.totalCalls},${c.bookings},${lastCall},${pickup},${dropoff}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ivr-contacts-' + new Date().toISOString().split('T')[0] + '.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[Export] Error:', err.message);
    res.status(500).json({ error: 'Failed to export contacts', detail: err.message });
  }
});

// ─── Marketing SMS: Send bulk SMS ─────────────────────────────────────────────
app.post('/api/admin/marketing-sms/send', async (req, res) => {
  try {
    const { phones, message } = req.body;
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({ error: 'No phone numbers provided' });
    }
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (message.length > 1600) {
      return res.status(400).json({ error: 'Message too long (max 1600 chars)' });
    }

    // Filter out admin numbers and invalid numbers
    const validPhones = phones.filter(p => 
      p && p.length >= 10 && 
      !ADMIN_HIDDEN_NUMBERS.includes(p) &&
      !p.includes('unknown') && !p.includes('Anonymous')
    );

    if (validPhones.length === 0) {
      return res.status(400).json({ error: 'No valid phone numbers to send to' });
    }

    console.log(`[MARKETING SMS] Sending to ${validPhones.length} numbers: "${message.substring(0, 50)}..."`);

    // Send SMS with rate limiting (1 per 200ms to avoid Twilio throttling)
    let sent = 0;
    let failed = 0;
    const results = [];

    for (const phone of validPhones) {
      try {
        await sms(phone, message);
        sent++;
        results.push({ phone, status: 'sent' });
      } catch (err) {
        failed++;
        results.push({ phone, status: 'failed', error: err.message });
      }
      // Rate limit: wait 200ms between sends
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[MARKETING SMS] Complete: ${sent} sent, ${failed} failed`);
    res.json({ success: true, total: validPhones.length, sent, failed, results });
  } catch (err) {
    console.error('[MARKETING SMS] Error:', err.message);
    res.status(500).json({ error: 'Failed to send marketing SMS', detail: err.message });
  }
});

// Get all contact numbers for marketing (mobile only, excludes admin)
app.get('/api/admin/marketing-sms/contacts', async (req, res) => {
  try {
    const Model = getIvrCallLogModel();
    const pipeline = [
      { $match: { phone: { $nin: ADMIN_HIDDEN_NUMBERS, $regex: /^\+614/ } } },
      { $group: {
        _id: '$phone',
        name: { $last: '$passengerName' },
        totalCalls: { $sum: 1 },
        bookings: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } },
        lastCallDate: { $max: '$createdAt' },
      }},
      { $addFields: { phone: '$_id' } },
      { $sort: { lastCallDate: -1 } },
    ];

    const contacts = await Model.aggregate(pipeline);
    res.json({ contacts: contacts.filter(c => c.phone && c.phone.length >= 10) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load contacts', detail: err.message });
  }
});

// Diagnostic
app.get('/api/test/booking', (req, res) => {
  res.json({
    status: 'booking route alive',
    dbSize: DB.bookings.size,
    services: {
      twilio: SVC.twilio ? 'loaded' : 'NOT LOADED',
      email:  SVC.mailer ? 'loaded' : 'NOT LOADED',
      stripe: SVC.stripe ? 'loaded' : 'NOT LOADED'
    },
    fare_test: calcFare('sedan', 9, 0, false),
  });
});

app.get('/api/health/sms', async (req, res) => {
  await sms(CFG.ADMIN_PHONE, 'Silver Taxi Sydney Service: Health check SMS. Server is running.');
  res.json({ attempted: true, to: CFG.ADMIN_PHONE });
});

app.get('/api/health/email', async (req, res) => {
  await email(CFG.ADMIN_EMAIL, 'Silver Taxi Sydney Service – Health Check Email', '<p>Server is running correctly.</p>');
  res.json({ attempted: true, to: CFG.ADMIN_EMAIL });
});

// -------------------- Page Routes --------------------
const page = f => (req, res) => res.sendFile(path.join(__dirname, 'public', f));
app.get('/',                       page('index.html'));
app.get('/index.html',             page('index.html'));
app.get('/book',                   page('book.html'));
app.get('/book.html',              page('book.html'));
app.get('/about',                  page('about.html'));
app.get('/about.html',             page('about.html'));
app.get('/services',               page('services.html'));
app.get('/services.html',          page('services.html'));
app.get('/maxi-taxi',              page('maxi-taxi.html'));
app.get('/maxi-taxi/',             page('maxi-taxi.html'));
app.get('/maxi-taxi.html',         page('maxi-taxi.html'));
app.get('/contact',                page('contact.html'));
app.get('/contact.html',           page('contact.html'));
app.get('/manage',                 page('manage.html'));
app.get('/manage.html',            page('manage.html'));
app.get('/admin',                  page('admin.html'));
app.get('/admin.html',             page('admin.html'));
app.get('/airport-transfers',      page('airport-transfers.html'));
app.get('/airport-transfers.html', page('airport-transfers.html'));
app.get('/silver-taxi-sydney', page('silver-taxi-sydney.html'));
app.get('/silver-taxi-sydney.html', page('silver-taxi-sydney.html'));
app.get('/silver-service-taxi-sydney', page('silver-service-taxi-sydney.html'));
app.get('/silver-service-taxi-sydney.html', page('silver-service-taxi-sydney.html'));
// Location pages
app.get('/taxi-liverpool',                           page('taxi-liverpool.html'));
app.get('/taxi-loftus',                              page('taxi-loftus.html'));
app.get('/taxi-lower-north-shore-sydney',             page('taxi-lower-north-shore-sydney.html'));
app.get('/taxi-lugarno',                             page('taxi-lugarno.html'));
app.get('/taxi-macquarie-fields',                    page('taxi-macquarie-fields.html'));
app.get('/taxi-manly',                               page('taxi-manly.html'));
app.get('/taxi-marsfield-all-in-one',                page('taxi-marsfield-all-in-one.html'));
app.get('/taxi-menai',                               page('taxi-menai.html'));
app.get('/taxi-minto',                               page('taxi-minto.html'));
app.get('/taxi-miranda',                             page('taxi-miranda.html'));
app.get('/taxi-mortdale',                            page('taxi-mortdale.html'));
app.get('/taxi-mosman',                              page('taxi-mosman.html'));
app.get('/taxi-newport',                             page('taxi-newport.html'));
app.get('/taxi-oatley',                              page('taxi-oatley.html'));
app.get('/taxi-parramatta',                          page('taxi-parramatta.html'));
app.get('/taxi-peakhurst',                           page('taxi-peakhurst.html'));
app.get('/taxi-penrith',                             page('taxi-penrith.html'));
app.get('/taxi-penshurst',                           page('taxi-penshurst.html'));
app.get('/taxi-prestons',                            page('taxi-prestons.html'));
app.get('/taxi-riverwood',                           page('taxi-riverwood.html'));
app.get('/taxi-sans-souci',                          page('taxi-sans-souci.html'));
app.get('/taxi-service-hawkesbury-windsor-richmond', page('taxi-service-hawkesbury-windsor-richmond.html'));
app.get('/taxi-service-mona-vale',                   page('taxi-service-mona-vale.html'));
app.get('/taxi-service-narellan',                    page('taxi-service-narellan.html'));
app.get('/taxi-service-wetherill-park',              page('taxi-service-wetherill-park.html'));
app.get('/taxi-st-leonards',                         page('taxi-st-leonards.html'));
app.get('/taxi-sutherland-shire',                    page('taxi-sutherland-shire.html'));
app.get('/taxi-sutherland',                          page('taxi-sutherland.html'));
app.get('/taxi-sydney-cbd',                          page('taxi-sydney-cbd.html'));
app.get('/taxi-sylvania',                            page('taxi-sylvania.html'));
app.get('/taxi-to-sydney-airport-updated',           page('taxi-to-sydney-airport-updated.html'));
app.get('/taxi-upper-north-shore',                   page('taxi-upper-north-shore.html'));
app.get('/taxi-woolooware',                          page('taxi-woolooware.html'));
app.get('/terms-and-conditions',                     page('terms-and-conditions.html'));
app.get('/terrey-hills-taxi-service',                page('terrey-hills-taxi-service.html'));
app.get('/warriewood-taxi-service',                  page('warriewood-taxi-service.html'));
app.get('/whale-beach-taxi',                         page('whale-beach-taxi.html'));
app.get('/privacy-policy',                           page('privacy-policy.html'));
app.get('/thank-you',                                page('thank-you.html'));
app.get('/thank-you.html',                           page('thank-you.html'));
// New suburb pages (generated May 2026)
app.get('/taxi-greater-western-sydney',              page('taxi-greater-western-sydney.html'));
app.get('/taxi-bondi',                               page('taxi-bondi.html'));
app.get('/taxi-chatswood',                            page('taxi-chatswood.html'));
app.get('/taxi-cronulla',                             page('taxi-cronulla.html'));
app.get('/taxi-hurstville',                           page('taxi-hurstville.html'));
app.get('/taxi-newtown',                              page('taxi-newtown.html'));
app.get('/taxi-randwick',                             page('taxi-randwick.html'));
app.get('/taxi-strathfield',                          page('taxi-strathfield.html'));
app.get('/taxi-ryde',                                page('taxi-ryde.html'));
app.get('/taxi-hornsby',                              page('taxi-hornsby.html'));
app.get('/taxi-campbelltown',                         page('taxi-campbelltown.html'));
app.get('/taxi-bankstown',                            page('taxi-bankstown.html'));
app.get('/taxi-blacktown',                            page('taxi-blacktown.html'));
app.get('/taxi-castle-hill',                          page('taxi-castle-hill.html'));
app.get('/taxi-kogarah',                              page('taxi-kogarah.html'));
app.get('/taxi-rockdale',                             page('taxi-rockdale.html'));
app.get('/taxi-burwood',                              page('taxi-burwood.html'));
app.get('/taxi-ashfield',                             page('taxi-ashfield.html'));
app.get('/taxi-leichhardt',                           page('taxi-leichhardt.html'));
app.get('/taxi-balmain',                              page('taxi-balmain.html'));
app.get('/taxi-surry-hills',                          page('taxi-surry-hills.html'));
app.get('/taxi-redfern',                              page('taxi-redfern.html'));
app.get('/taxi-glebe',                                page('taxi-glebe.html'));
app.get('/taxi-marrickville',                         page('taxi-marrickville.html'));
app.get('/taxi-mascot',                               page('taxi-mascot.html'));
app.get('/taxi-zetland',                              page('taxi-zetland.html'));
app.get('/taxi-waterloo',                             page('taxi-waterloo.html'));
app.get('/taxi-erskineville',                         page('taxi-erskineville.html'));
app.get('/taxi-alexandria',                           page('taxi-alexandria.html'));
app.get('/taxi-rosebery',                             page('taxi-rosebery.html'));
app.get('/taxi-beaconsfield',                         page('taxi-beaconsfield.html'));
app.get('/taxi-ingleburn',                            page('taxi-ingleburn.html'));
// Google Search Console verification
app.get('/googlee390b76c55f0aa92.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(require('path').join(__dirname, 'public', 'googlee390b76c55f0aa92.html'));
});
// SEO files
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(require('path').join(__dirname, 'public', 'robots.txt'));
});
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(require('path').join(__dirname, 'public', 'sitemap.xml'));
});
app.get('/sitemap', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(require('path').join(__dirname, 'public', 'sitemap.xml'));
});

// -------------------- SEO Dashboard Routes --------------------

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'SSO-SEO-Bot/1.0' }, signal: AbortSignal.timeout(8000) });
    const html = await response.text();
    const hasTitle = /<title[^>]*>[^<]{10,}/i.test(html);
    const hasMeta = /name=["']description["']/i.test(html);
    const hasCanonical = /rel=["']canonical["']/i.test(html);
    const hasSchema = /application\/ld\+json/i.test(html);
    const hasH1 = /<h1[^>]*>[^<]{3,}/i.test(html);
    const hasOG = /property=["']og:/i.test(html);
    const noindex = /noindex/i.test(response.headers.get('x-robots-tag') || '');
    const score = [hasTitle, hasMeta, hasCanonical, hasSchema, hasH1, hasOG, !noindex].filter(Boolean).length;
    res.json({ url, score: Math.round((score / 7) * 100), checks: { hasTitle, hasMeta, hasCanonical, hasSchema, hasH1, hasOG, noindex } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -------------------- SEO Health & Pages Endpoints --------------------
const ALL_PAGES = [
  {url:"/",title:"Silver Taxi Sydney | #1 Airport Transfers"},
  {url:"/book",title:"Book a Taxi Online Sydney | Fixed Fares"},
  {url:"/services",title:"Taxi Services Sydney | Sedan, SUV, Maxi"},
  {url:"/airport-transfers",title:"Sydney Airport Taxi Transfers | Fixed Price"},
  {url:"/about",title:"About Silver Taxi Sydney Service"},
  {url:"/contact",title:"Contact Silver Taxi Sydney Service"},
  {url:"/locations/",title:"All Locations | Silver Taxi Sydney Service"},
  {url:"/locations/abbotsbury/",title:"Silver Taxi Abbotsbury | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/abbotsford/",title:"Silver Taxi Abbotsford | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/acacia-gardens/",title:"Silver Taxi Acacia Gardens | Fixed Fares & Airport Transfers"},
  {url:"/locations/agnes-banks/",title:"Silver Taxi Agnes Banks | Fixed Fares & Airport Transfers | "},
  {url:"/locations/airds/",title:"Silver Taxi Airds | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/albion-park/",title:"Silver Taxi Albion Park | Fixed Fares & Airport Transfers | "},
  {url:"/locations/albion-park-rail/",title:"Silver Taxi Albion Park Rail | Fixed Fares & Airport Transfe"},
  {url:"/locations/alexandria/",title:"Silver Taxi Alexandria | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/alfords-point/",title:"Silver Taxi Alfords Point | Fixed Fares & Airport Transfers "},
  {url:"/locations/allambie-heights/",title:"Silver Taxi Allambie Heights | Fixed Fares & Airport Transfe"},
  {url:"/locations/allawah/",title:"Silver Taxi Allawah | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/ambarvale/",title:"Silver Taxi Ambarvale | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/annandale/",title:"Silver Taxi Annandale | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/annangrove/",title:"Silver Taxi Annangrove | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/appin/",title:"Silver Taxi Appin | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/arcadia/",title:"Silver Taxi Arcadia | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/arncliffe/",title:"Silver Taxi Arncliffe | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/artarmon/",title:"Silver Taxi Artarmon | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/ashcroft/",title:"Silver Taxi Ashcroft | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/ashfield/",title:"Silver Taxi Ashfield | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/asquith/",title:"Silver Taxi Asquith | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/auburn/",title:"Silver Taxi Auburn | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/austinmer/",title:"Silver Taxi Austinmer | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/austral/",title:"Silver Taxi Austral | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/avalon/",title:"Silver Taxi Avalon | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/avoca-beach/",title:"Silver Taxi Avoca Beach | Fixed Fares & Airport Transfers | "},
  {url:"/locations/badgerys-creek/",title:"Silver Taxi Badgerys Creek | Fixed Fares & Airport Transfers"},
  {url:"/locations/balgowlah/",title:"Silver Taxi Balgowlah | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/balgowlah-heights/",title:"Silver Taxi Balgowlah Heights | Fixed Fares & Airport Transf"},
  {url:"/locations/balgownie/",title:"Silver Taxi Balgownie | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/balmain/",title:"Silver Taxi Balmain | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/balmoral/",title:"Silver Taxi Balmoral | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/bangor/",title:"Silver Taxi Bangor | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/banksmeadow/",title:"Silver Taxi Banksmeadow | Fixed Fares & Airport Transfers | "},
  {url:"/locations/bankstown/",title:"Silver Taxi Bankstown | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/barangaroo/",title:"Silver Taxi Barangaroo | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/barden-ridge/",title:"Silver Taxi Barden Ridge | Fixed Fares & Airport Transfers |"},
  {url:"/locations/bardwell-park/",title:"Silver Taxi Bardwell Park | Fixed Fares & Airport Transfers "},
  {url:"/locations/bardwell-valley/",title:"Silver Taxi Bardwell Valley | Fixed Fares & Airport Transfer"},
  {url:"/locations/bargo/",title:"Silver Taxi Bargo | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/barrack-heights/",title:"Silver Taxi Barrack Heights | Fixed Fares & Airport Transfer"},
  {url:"/locations/bass-hill/",title:"Silver Taxi Bass Hill | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/bateau-bay/",title:"Silver Taxi Bateau Bay | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/baulkham-hills/",title:"Silver Taxi Baulkham Hills | Fixed Fares & Airport Transfers"},
  {url:"/locations/bayside/",title:"Silver Taxi Bayside Council | All 28 Suburbs | Silver Servic"},
  {url:"/locations/bayview/",title:"Silver Taxi Bayview | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/beaconsfield/",title:"Silver Taxi Beaconsfield | Fixed Fares & Airport Transfers |"},
  {url:"/locations/beaumont-hills/",title:"Silver Taxi Beaumont Hills | Fixed Fares & Airport Transfers"},
  {url:"/locations/beauty-point/",title:"Silver Taxi Beauty Point | Fixed Fares & Airport Transfers |"},
  {url:"/locations/beecroft/",title:"Silver Taxi Beecroft | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/belfield/",title:"Silver Taxi Belfield | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/bella-vista/",title:"Silver Taxi Bella Vista | Fixed Fares & Airport Transfers | "},
  {url:"/locations/bellevue-hill/",title:"Silver Taxi Bellevue Hill | Fixed Fares & Airport Transfers "},
  {url:"/locations/belmore/",title:"Silver Taxi Belmore | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/belrose/",title:"Silver Taxi Belrose | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/bensville/",title:"Silver Taxi Bensville | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/berala/",title:"Silver Taxi Berala | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/berkeley/",title:"Silver Taxi Berkeley | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/berkeley-vale/",title:"Silver Taxi Berkeley Vale | Fixed Fares & Airport Transfers "},
  {url:"/locations/berowra/",title:"Silver Taxi Berowra | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/berowra-heights/",title:"Silver Taxi Berowra Heights | Fixed Fares & Airport Transfer"},
  {url:"/locations/berry/",title:"Silver Taxi Berry | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/beverley-park/",title:"Silver Taxi Beverley Park | Fixed Fares & Airport Transfers "},
  {url:"/locations/beverly-hills/",title:"Silver Taxi Beverly Hills | Fixed Fares & Airport Transfers "},
  {url:"/locations/bexley/",title:"Silver Taxi Bexley | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/bexley-north/",title:"Silver Taxi Bexley North | Fixed Fares & Airport Transfers |"},
  {url:"/locations/bidwill/",title:"Silver Taxi Bidwill | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/bilgola-plateau/",title:"Silver Taxi Bilgola Plateau | Fixed Fares & Airport Transfer"},
  {url:"/locations/bilpin/",title:"Silver Taxi Bilpin | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/birchgrove/",title:"Silver Taxi Birchgrove | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/birrong/",title:"Silver Taxi Birrong | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/blackheath/",title:"Silver Taxi Blackheath | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/blacktown/",title:"Silver Taxi Blacktown | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/blackwall/",title:"Silver Taxi Blackwall | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/blair-athol/",title:"Silver Taxi Blair Athol | Fixed Fares & Airport Transfers | "},
  {url:"/locations/blairmount/",title:"Silver Taxi Blairmount | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/blakehurst/",title:"Silver Taxi Blakehurst | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/blaxland/",title:"Silver Taxi Blaxland | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/blue-mountains/",title:"Silver Taxi Blue Mountains City Council | All 22 Suburbs | S"},
  {url:"/locations/bombo/",title:"Silver Taxi Bombo | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/bondi/",title:"Silver Taxi Bondi | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/bondi-beach/",title:"Silver Taxi Bondi Beach | Fixed Fares & Airport Transfers | "},
  {url:"/locations/bondi-junction/",title:"Silver Taxi Bondi Junction | Fixed Fares & Airport Transfers"},
  {url:"/locations/bonnet-bay/",title:"Silver Taxi Bonnet Bay | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/bonnyrigg/",title:"Silver Taxi Bonnyrigg | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/bonnyrigg-heights/",title:"Silver Taxi Bonnyrigg Heights | Fixed Fares & Airport Transf"},
  {url:"/locations/booker-bay/",title:"Silver Taxi Booker Bay | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/bossley-park/",title:"Silver Taxi Bossley Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/botany/",title:"Silver Taxi Botany | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/box-hill/",title:"Silver Taxi Box Hill | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/bradbury/",title:"Silver Taxi Bradbury | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/brighton-le-sands/",title:"Silver Taxi Brighton Le Sands | Fixed Fares & Airport Transf"},
  {url:"/locations/bronte/",title:"Silver Taxi Bronte | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/brookvale/",title:"Silver Taxi Brookvale | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/budgewoi/",title:"Silver Taxi Budgewoi | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/bulli/",title:"Silver Taxi Bulli | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/bundeena/",title:"Silver Taxi Bundeena | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/burraneer/",title:"Silver Taxi Burraneer | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/burwood/",title:"Silver Taxi Burwood | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/burwood-heights/",title:"Silver Taxi Burwood Heights | Fixed Fares & Airport Transfer"},
  {url:"/locations/busby/",title:"Silver Taxi Busby | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/cabarita/",title:"Silver Taxi Cabarita | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/cabramatta/",title:"Silver Taxi Cabramatta | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/cabramatta-west/",title:"Silver Taxi Cabramatta West | Fixed Fares & Airport Transfer"},
  {url:"/locations/cambridge-park/",title:"Silver Taxi Cambridge Park | Fixed Fares & Airport Transfers"},
  {url:"/locations/camden/",title:"Silver Taxi Camden | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/camellia/",title:"Silver Taxi Camellia | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/cammeray/",title:"Silver Taxi Cammeray | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/campbelltown/",title:"Silver Taxi Campbelltown | Fixed Fares & Airport Transfers |"},
  {url:"/locations/camperdown/",title:"Silver Taxi Camperdown | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/campsie/",title:"Silver Taxi Campsie | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/canada-bay/",title:"Silver Taxi Canada Bay | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/canley-heights/",title:"Silver Taxi Canley Heights | Fixed Fares & Airport Transfers"},
  {url:"/locations/canley-vale/",title:"Silver Taxi Canley Vale | Fixed Fares & Airport Transfers | "},
  {url:"/locations/canterbury/",title:"Silver Taxi Canterbury | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/canterbury-bankstown/",title:"Silver Taxi City of Canterbury-Bankstown | All 29 Suburbs | "},
  {url:"/locations/caringbah/",title:"Silver Taxi Caringbah | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/caringbah-south/",title:"Silver Taxi Caringbah South | Fixed Fares & Airport Transfer"},
  {url:"/locations/carlingford/",title:"Silver Taxi Carlingford | Fixed Fares & Airport Transfers | "},
  {url:"/locations/carlton/",title:"Silver Taxi Carlton | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/carramar/",title:"Silver Taxi Carramar | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/cartwright/",title:"Silver Taxi Cartwright | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/castle-cove/",title:"Silver Taxi Castle Cove | Fixed Fares & Airport Transfers | "},
  {url:"/locations/castle-hill/",title:"Silver Taxi Castle Hill | Fixed Fares & Airport Transfers | "},
  {url:"/locations/castlecrag/",title:"Silver Taxi Castlecrag | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/castlereagh/",title:"Silver Taxi Castlereagh | Fixed Fares & Airport Transfers | "},
  {url:"/locations/casula/",title:"Silver Taxi Casula | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/catherine-field/",title:"Silver Taxi Catherine Field | Fixed Fares & Airport Transfer"},
  {url:"/locations/cecil-hills/",title:"Silver Taxi Cecil Hills | Fixed Fares & Airport Transfers | "},
  {url:"/locations/centennial-park/",title:"Silver Taxi Centennial Park | Fixed Fares & Airport Transfer"},
  {url:"/locations/central-coast/",title:"Silver Taxi Central Coast Council | All 45 Suburbs | Silver "},
  {url:"/locations/chatswood/",title:"Silver Taxi Chatswood | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/chatswood-west/",title:"Silver Taxi Chatswood West | Fixed Fares & Airport Transfers"},
  {url:"/locations/cheltenham/",title:"Silver Taxi Cheltenham | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/cherrybrook/",title:"Silver Taxi Cherrybrook | Fixed Fares & Airport Transfers | "},
  {url:"/locations/chester-hill/",title:"Silver Taxi Chester Hill | Fixed Fares & Airport Transfers |"},
  {url:"/locations/chifley/",title:"Silver Taxi Chifley | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/chippendale/",title:"Silver Taxi Chippendale | Fixed Fares & Airport Transfers | "},
  {url:"/locations/chipping-norton/",title:"Silver Taxi Chipping Norton | Fixed Fares & Airport Transfer"},
  {url:"/locations/chullora/",title:"Silver Taxi Chullora | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/church-point/",title:"Silver Taxi Church Point | Fixed Fares & Airport Transfers |"},
  {url:"/locations/city-of-sydney/",title:"Silver Taxi City of Sydney | All 31 Suburbs | Silver Service"},
  {url:"/locations/clarendon/",title:"Silver Taxi Clarendon | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/claymore/",title:"Silver Taxi Claymore | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/clemton-park/",title:"Silver Taxi Clemton Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/clifton-gardens/",title:"Silver Taxi Clifton Gardens | Fixed Fares & Airport Transfer"},
  {url:"/locations/clontarf/",title:"Silver Taxi Clontarf | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/clovelly/",title:"Silver Taxi Clovelly | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/coledale/",title:"Silver Taxi Coledale | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/collaroy/",title:"Silver Taxi Collaroy | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/collaroy-plateau/",title:"Silver Taxi Collaroy Plateau | Fixed Fares & Airport Transfe"},
  {url:"/locations/colyton/",title:"Silver Taxi Colyton | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/como/",title:"Silver Taxi Como | Fixed Fares & Airport Transfers | Silver "},
  {url:"/locations/concord/",title:"Silver Taxi Concord | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/concord-west/",title:"Silver Taxi Concord West | Fixed Fares & Airport Transfers |"},
  {url:"/locations/condell-park/",title:"Silver Taxi Condell Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/coniston/",title:"Silver Taxi Coniston | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/connells-point/",title:"Silver Taxi Connells Point | Fixed Fares & Airport Transfers"},
  {url:"/locations/constitution-hill/",title:"Silver Taxi Constitution Hill | Fixed Fares & Airport Transf"},
  {url:"/locations/coogee/",title:"Silver Taxi Coogee | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/copacabana/",title:"Silver Taxi Copacabana | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/corrimal/",title:"Silver Taxi Corrimal | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/council-blacktown/",title:"Silver Taxi City of Blacktown | All 32 Suburbs | Silver Serv"},
  {url:"/locations/council-burwood/",title:"Silver Taxi Burwood Council | All 6 Suburbs | Silver Service"},
  {url:"/locations/council-camden/",title:"Silver Taxi Camden Council | All 13 Suburbs | Silver Service"},
  {url:"/locations/council-campbelltown/",title:"Silver Taxi City of Campbelltown | All 22 Suburbs | Silver S"},
  {url:"/locations/council-fairfield/",title:"Silver Taxi City of Fairfield | All 25 Suburbs | Silver Serv"},
  {url:"/locations/council-hornsby/",title:"Silver Taxi Hornsby Shire Council | All 35 Suburbs | Silver "},
  {url:"/locations/council-lane-cove/",title:"Silver Taxi Lane Cove Council | All 8 Suburbs | Silver Servi"},
  {url:"/locations/council-liverpool/",title:"Silver Taxi City of Liverpool | All 27 Suburbs | Silver Serv"},
  {url:"/locations/council-mosman/",title:"Silver Taxi Mosman Council | All 7 Suburbs | Silver Service "},
  {url:"/locations/council-north-sydney/",title:"Silver Taxi North Sydney Council | All 13 Suburbs | Silver S"},
  {url:"/locations/council-parramatta/",title:"Silver Taxi City of Parramatta | All 27 Suburbs | Silver Ser"},
  {url:"/locations/council-penrith/",title:"Silver Taxi City of Penrith | All 28 Suburbs | Silver Servic"},
  {url:"/locations/council-randwick/",title:"Silver Taxi Randwick City Council | All 19 Suburbs | Silver "},
  {url:"/locations/council-ryde/",title:"Silver Taxi City of Ryde | All 16 Suburbs | Silver Service O"},
  {url:"/locations/council-strathfield/",title:"Silver Taxi Strathfield Council | All 5 Suburbs | Silver Ser"},
  {url:"/locations/council-waverley/",title:"Silver Taxi Waverley Council | All 11 Suburbs | Silver Servi"},
  {url:"/locations/council-willoughby/",title:"Silver Taxi City of Willoughby | All 8 Suburbs | Silver Serv"},
  {url:"/locations/council-wollongong/",title:"Silver Taxi City of Wollongong | All 37 Suburbs | Silver Ser"},
  {url:"/locations/council-woollahra/",title:"Silver Taxi Woollahra Council | All 10 Suburbs | Silver Serv"},
  {url:"/locations/cranebrook/",title:"Silver Taxi Cranebrook | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/cremorne/",title:"Silver Taxi Cremorne | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/cremorne-point/",title:"Silver Taxi Cremorne Point | Fixed Fares & Airport Transfers"},
  {url:"/locations/cromer/",title:"Silver Taxi Cromer | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/cronulla/",title:"Silver Taxi Cronulla | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/crows-nest/",title:"Silver Taxi Crows Nest | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/croydon/",title:"Silver Taxi Croydon | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/croydon-park/",title:"Silver Taxi Croydon Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/cumberland/",title:"Silver Taxi Cumberland City Council | All 19 Suburbs | Silve"},
  {url:"/locations/curl-curl/",title:"Silver Taxi Curl Curl | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/currans-hill/",title:"Silver Taxi Currans Hill | Fixed Fares & Airport Transfers |"},
  {url:"/locations/daceyville/",title:"Silver Taxi Daceyville | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/dapto/",title:"Silver Taxi Dapto | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/darling-harbour/",title:"Silver Taxi Darling Harbour | Fixed Fares & Airport Transfer"},
  {url:"/locations/darling-point/",title:"Silver Taxi Darling Point | Fixed Fares & Airport Transfers "},
  {url:"/locations/darlinghurst/",title:"Silver Taxi Darlinghurst | Fixed Fares & Airport Transfers |"},
  {url:"/locations/davidson/",title:"Silver Taxi Davidson | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/davistown/",title:"Silver Taxi Davistown | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/dawes-point/",title:"Silver Taxi Dawes Point | Fixed Fares & Airport Transfers | "},
  {url:"/locations/dee-why/",title:"Silver Taxi Dee Why | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/denistone/",title:"Silver Taxi Denistone | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/denistone-east/",title:"Silver Taxi Denistone East | Fixed Fares & Airport Transfers"},
  {url:"/locations/denistone-west/",title:"Silver Taxi Denistone West | Fixed Fares & Airport Transfers"},
  {url:"/locations/dharruk/",title:"Silver Taxi Dharruk | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/doonside/",title:"Silver Taxi Doonside | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/double-bay/",title:"Silver Taxi Double Bay | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/douglas-park/",title:"Silver Taxi Douglas Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/dover-heights/",title:"Silver Taxi Dover Heights | Fixed Fares & Airport Transfers "},
  {url:"/locations/drummoyne/",title:"Silver Taxi Drummoyne | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/dulwich-hill/",title:"Silver Taxi Dulwich Hill | Fixed Fares & Airport Transfers |"},
  {url:"/locations/dundas/",title:"Silver Taxi Dundas | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/dundas-valley/",title:"Silver Taxi Dundas Valley | Fixed Fares & Airport Transfers "},
  {url:"/locations/dural/",title:"Silver Taxi Dural | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/eagle-vale/",title:"Silver Taxi Eagle Vale | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/earlwood/",title:"Silver Taxi Earlwood | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/east-gosford/",title:"Silver Taxi East Gosford | Fixed Fares & Airport Transfers |"},
  {url:"/locations/east-hills/",title:"Silver Taxi East Hills | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/east-killara/",title:"Silver Taxi East Killara | Fixed Fares & Airport Transfers |"},
  {url:"/locations/east-lindfield/",title:"Silver Taxi East Lindfield | Fixed Fares & Airport Transfers"},
  {url:"/locations/eastgardens/",title:"Silver Taxi Eastgardens | Fixed Fares & Airport Transfers | "},
  {url:"/locations/eastlakes/",title:"Silver Taxi Eastlakes | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/eastwood/",title:"Silver Taxi Eastwood | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/edensor-park/",title:"Silver Taxi Edensor Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/edgecliff/",title:"Silver Taxi Edgecliff | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/edmondson-park/",title:"Silver Taxi Edmondson Park | Fixed Fares & Airport Transfers"},
  {url:"/locations/elara/",title:"Silver Taxi Elara | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/elderslie/",title:"Silver Taxi Elderslie | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/elizabeth-bay/",title:"Silver Taxi Elizabeth Bay | Fixed Fares & Airport Transfers "},
  {url:"/locations/emerton/",title:"Silver Taxi Emerton | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/empire-bay/",title:"Silver Taxi Empire Bay | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/emu-heights/",title:"Silver Taxi Emu Heights | Fixed Fares & Airport Transfers | "},
  {url:"/locations/emu-plains/",title:"Silver Taxi Emu Plains | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/enfield/",title:"Silver Taxi Enfield | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/engadine/",title:"Silver Taxi Engadine | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/enmore/",title:"Silver Taxi Enmore | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/epping/",title:"Silver Taxi Epping | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/erina/",title:"Silver Taxi Erina | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/erina-heights/",title:"Silver Taxi Erina Heights | Fixed Fares & Airport Transfers "},
  {url:"/locations/ermington/",title:"Silver Taxi Ermington | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/erskine-park/",title:"Silver Taxi Erskine Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/erskineville/",title:"Silver Taxi Erskineville | Fixed Fares & Airport Transfers |"},
  {url:"/locations/eschol-park/",title:"Silver Taxi Eschol Park | Fixed Fares & Airport Transfers | "},
  {url:"/locations/ettalong-beach/",title:"Silver Taxi Ettalong Beach | Fixed Fares & Airport Transfers"},
  {url:"/locations/fairfield/",title:"Silver Taxi Fairfield | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/fairfield-east/",title:"Silver Taxi Fairfield East | Fixed Fares & Airport Transfers"},
  {url:"/locations/fairfield-heights/",title:"Silver Taxi Fairfield Heights | Fixed Fares & Airport Transf"},
  {url:"/locations/fairfield-west/",title:"Silver Taxi Fairfield West | Fixed Fares & Airport Transfers"},
  {url:"/locations/fairlight/",title:"Silver Taxi Fairlight | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/fairy-meadow/",title:"Silver Taxi Fairy Meadow | Fixed Fares & Airport Transfers |"},
  {url:"/locations/faulconbridge/",title:"Silver Taxi Faulconbridge | Fixed Fares & Airport Transfers "},
  {url:"/locations/figtree/",title:"Silver Taxi Figtree | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/five-dock/",title:"Silver Taxi Five Dock | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/forest-lodge/",title:"Silver Taxi Forest Lodge | Fixed Fares & Airport Transfers |"},
  {url:"/locations/forestville/",title:"Silver Taxi Forestville | Fixed Fares & Airport Transfers | "},
  {url:"/locations/forresters-beach/",title:"Silver Taxi Forresters Beach | Fixed Fares & Airport Transfe"},
  {url:"/locations/fox-valley/",title:"Silver Taxi Fox Valley | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/freemans-reach/",title:"Silver Taxi Freemans Reach | Fixed Fares & Airport Transfers"},
  {url:"/locations/frenchs-forest/",title:"Silver Taxi Frenchs Forest | Fixed Fares & Airport Transfers"},
  {url:"/locations/freshwater/",title:"Silver Taxi Freshwater | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/galston/",title:"Silver Taxi Galston | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/georges-heights/",title:"Silver Taxi Georges Heights | Fixed Fares & Airport Transfer"},
  {url:"/locations/georges-river/",title:"Silver Taxi Georges River Council | All 17 Suburbs | Silver "},
  {url:"/locations/gerringong/",title:"Silver Taxi Gerringong | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/gilead/",title:"Silver Taxi Gilead | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/girraween/",title:"Silver Taxi Girraween | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/gladesville/",title:"Silver Taxi Gladesville | Fixed Fares & Airport Transfers | "},
  {url:"/locations/glebe/",title:"Silver Taxi Glebe | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/gledswood-hills/",title:"Silver Taxi Gledswood Hills | Fixed Fares & Airport Transfer"},
  {url:"/locations/glen-alpine/",title:"Silver Taxi Glen Alpine | Fixed Fares & Airport Transfers | "},
  {url:"/locations/glenbrook/",title:"Silver Taxi Glenbrook | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/glendenning/",title:"Silver Taxi Glendenning | Fixed Fares & Airport Transfers | "},
  {url:"/locations/glenfield/",title:"Silver Taxi Glenfield | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/glenhaven/",title:"Silver Taxi Glenhaven | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/glenmore-park/",title:"Silver Taxi Glenmore Park | Fixed Fares & Airport Transfers "},
  {url:"/locations/glenorie/",title:"Silver Taxi Glenorie | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/glossodia/",title:"Silver Taxi Glossodia | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/gordon/",title:"Silver Taxi Gordon | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/gosford/",title:"Silver Taxi Gosford | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/granville/",title:"Silver Taxi Granville | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/grays-point/",title:"Silver Taxi Grays Point | Fixed Fares & Airport Transfers | "},
  {url:"/locations/green-point/",title:"Silver Taxi Green Point | Fixed Fares & Airport Transfers | "},
  {url:"/locations/green-square/",title:"Silver Taxi Green Square | Fixed Fares & Airport Transfers |"},
  {url:"/locations/green-valley/",title:"Silver Taxi Green Valley | Fixed Fares & Airport Transfers |"},
  {url:"/locations/greenacre/",title:"Silver Taxi Greenacre | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/greenfield-park/",title:"Silver Taxi Greenfield Park | Fixed Fares & Airport Transfer"},
  {url:"/locations/greenwich/",title:"Silver Taxi Greenwich | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/gregory-hills/",title:"Silver Taxi Gregory Hills | Fixed Fares & Airport Transfers "},
  {url:"/locations/greystanes/",title:"Silver Taxi Greystanes | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/guildford/",title:"Silver Taxi Guildford | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/guildford-west/",title:"Silver Taxi Guildford West | Fixed Fares & Airport Transfers"},
  {url:"/locations/gwynneville/",title:"Silver Taxi Gwynneville | Fixed Fares & Airport Transfers | "},
  {url:"/locations/gymea/",title:"Silver Taxi Gymea | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/gymea-bay/",title:"Silver Taxi Gymea Bay | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/haberfield/",title:"Silver Taxi Haberfield | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/hammondville/",title:"Silver Taxi Hammondville | Fixed Fares & Airport Transfers |"},
  {url:"/locations/harrington-park/",title:"Silver Taxi Harrington Park | Fixed Fares & Airport Transfer"},
  {url:"/locations/harris-park/",title:"Silver Taxi Harris Park | Fixed Fares & Airport Transfers | "},
  {url:"/locations/hawkesbury/",title:"Silver Taxi Hawkesbury City Council | All 13 Suburbs | Silve"},
  {url:"/locations/haymarket/",title:"Silver Taxi Haymarket | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/hazelbrook/",title:"Silver Taxi Hazelbrook | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/heathcote/",title:"Silver Taxi Heathcote | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/hebersham/",title:"Silver Taxi Hebersham | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/helensburgh/",title:"Silver Taxi Helensburgh | Fixed Fares & Airport Transfers | "},
  {url:"/locations/hills-shire/",title:"Silver Taxi The Hills Shire Council | All 16 Suburbs | Silve"},
  {url:"/locations/hillsdale/",title:"Silver Taxi Hillsdale | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/hinchinbrook/",title:"Silver Taxi Hinchinbrook | Fixed Fares & Airport Transfers |"},
  {url:"/locations/holroyd/",title:"Silver Taxi Holroyd | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/holsworthy/",title:"Silver Taxi Holsworthy | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/homebush/",title:"Silver Taxi Homebush | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/homebush-west/",title:"Silver Taxi Homebush West | Fixed Fares & Airport Transfers "},
  {url:"/locations/horningsea-park/",title:"Silver Taxi Horningsea Park | Fixed Fares & Airport Transfer"},
  {url:"/locations/hornsby/",title:"Silver Taxi Hornsby | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/hornsby-heights/",title:"Silver Taxi Hornsby Heights | Fixed Fares & Airport Transfer"},
  {url:"/locations/hoxton-park/",title:"Silver Taxi Hoxton Park | Fixed Fares & Airport Transfers | "},
  {url:"/locations/hunters-hill/",title:"Silver Taxi Hunters Hill | Fixed Fares & Airport Transfers |"},
  {url:"/locations/hurlstone-park/",title:"Silver Taxi Hurlstone Park | Fixed Fares & Airport Transfers"},
  {url:"/locations/hurstville/",title:"Silver Taxi Hurstville | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/illawong/",title:"Silver Taxi Illawong | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/ingleburn/",title:"Silver Taxi Ingleburn | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/ingleside/",title:"Silver Taxi Ingleside | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/inner-west/",title:"Silver Taxi Inner West Council | All 30 Suburbs | Silver Ser"},
  {url:"/locations/jamisontown/",title:"Silver Taxi Jamisontown | Fixed Fares & Airport Transfers | "},
  {url:"/locations/jannali/",title:"Silver Taxi Jannali | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/jordan-springs/",title:"Silver Taxi Jordan Springs | Fixed Fares & Airport Transfers"},
  {url:"/locations/kareela/",title:"Silver Taxi Kareela | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/kariong/",title:"Silver Taxi Kariong | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/katoomba/",title:"Silver Taxi Katoomba | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/keiraville/",title:"Silver Taxi Keiraville | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/kellyville/",title:"Silver Taxi Kellyville | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/kellyville-ridge/",title:"Silver Taxi Kellyville Ridge | Fixed Fares & Airport Transfe"},
  {url:"/locations/kensington/",title:"Silver Taxi Kensington | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/kenthurst/",title:"Silver Taxi Kenthurst | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/kentlyn/",title:"Silver Taxi Kentlyn | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/kiama/",title:"Silver Taxi Kiama | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/killara/",title:"Silver Taxi Killara | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/killarney-heights/",title:"Silver Taxi Killarney Heights | Fixed Fares & Airport Transf"},
  {url:"/locations/killarney-vale/",title:"Silver Taxi Killarney Vale | Fixed Fares & Airport Transfers"},
  {url:"/locations/kincumber/",title:"Silver Taxi Kincumber | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/kings-cross/",title:"Silver Taxi Kings Cross | Fixed Fares & Airport Transfers | "},
  {url:"/locations/kings-langley/",title:"Silver Taxi Kings Langley | Fixed Fares & Airport Transfers "},
  {url:"/locations/kingsford/",title:"Silver Taxi Kingsford | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/kingsgrove/",title:"Silver Taxi Kingsgrove | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/kingswood/",title:"Silver Taxi Kingswood | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/kirrawee/",title:"Silver Taxi Kirrawee | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/kirribilli/",title:"Silver Taxi Kirribilli | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/kogarah/",title:"Silver Taxi Kogarah | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/koolewong/",title:"Silver Taxi Koolewong | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/ku-ring-gai/",title:"Silver Taxi Ku-ring-gai Council | All 12 Suburbs | Silver Se"},
  {url:"/locations/kurrajong/",title:"Silver Taxi Kurrajong | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/kurrajong-heights/",title:"Silver Taxi Kurrajong Heights | Fixed Fares & Airport Transf"},
  {url:"/locations/kyeemagh/",title:"Silver Taxi Kyeemagh | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/kyle-bay/",title:"Silver Taxi Kyle Bay | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/la-perouse/",title:"Silver Taxi La Perouse | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/lake-haven/",title:"Silver Taxi Lake Haven | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/lake-illawarra/",title:"Silver Taxi Lake Illawarra | Fixed Fares & Airport Transfers"},
  {url:"/locations/lakemba/",title:"Silver Taxi Lakemba | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/lalor-park/",title:"Silver Taxi Lalor Park | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/lane-cove/",title:"Silver Taxi Lane Cove | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/lane-cove-north/",title:"Silver Taxi Lane Cove North | Fixed Fares & Airport Transfer"},
  {url:"/locations/lane-cove-west/",title:"Silver Taxi Lane Cove West | Fixed Fares & Airport Transfers"},
  {url:"/locations/lansdowne/",title:"Silver Taxi Lansdowne | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/lansvale/",title:"Silver Taxi Lansvale | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/lapstone/",title:"Silver Taxi Lapstone | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/lavender-bay/",title:"Silver Taxi Lavender Bay | Fixed Fares & Airport Transfers |"},
  {url:"/locations/lawson/",title:"Silver Taxi Lawson | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/leichhardt/",title:"Silver Taxi Leichhardt | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/leonay/",title:"Silver Taxi Leonay | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/leppington/",title:"Silver Taxi Leppington | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/lethbridge-park/",title:"Silver Taxi Lethbridge Park | Fixed Fares & Airport Transfer"},
  {url:"/locations/leumeah/",title:"Silver Taxi Leumeah | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/leura/",title:"Silver Taxi Leura | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/lewisham/",title:"Silver Taxi Lewisham | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/lidcombe/",title:"Silver Taxi Lidcombe | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/lilli-pilli/",title:"Silver Taxi Lilli Pilli | Fixed Fares & Airport Transfers | "},
  {url:"/locations/lilyfield/",title:"Silver Taxi Lilyfield | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/linden/",title:"Silver Taxi Linden | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/lindfield/",title:"Silver Taxi Lindfield | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/lisarow/",title:"Silver Taxi Lisarow | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/little-bay/",title:"Silver Taxi Little Bay | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/liverpool/",title:"Silver Taxi Liverpool | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/llandilo/",title:"Silver Taxi Llandilo | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/loftus/",title:"Silver Taxi Loftus | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/londonderry/",title:"Silver Taxi Londonderry | Fixed Fares & Airport Transfers | "},
  {url:"/locations/long-jetty/",title:"Silver Taxi Long Jetty | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/longueville/",title:"Silver Taxi Longueville | Fixed Fares & Airport Transfers | "},
  {url:"/locations/lucas-heights/",title:"Silver Taxi Lucas Heights | Fixed Fares & Airport Transfers "},
  {url:"/locations/lugarno/",title:"Silver Taxi Lugarno | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/lurnea/",title:"Silver Taxi Lurnea | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/macmasters-beach/",title:"Silver Taxi Macmasters Beach | Fixed Fares & Airport Transfe"},
  {url:"/locations/macquarie-fields/",title:"Silver Taxi Macquarie Fields | Fixed Fares & Airport Transfe"},
  {url:"/locations/macquarie-park/",title:"Silver Taxi Macquarie Park | Fixed Fares & Airport Transfers"},
  {url:"/locations/macquarie-university/",title:"Silver Taxi Macquarie University | Fixed Fares & Airport Tra"},
  {url:"/locations/maianbar/",title:"Silver Taxi Maianbar | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/malabar/",title:"Silver Taxi Malabar | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/mangerton/",title:"Silver Taxi Mangerton | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/manly/",title:"Silver Taxi Manly | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/manly-vale/",title:"Silver Taxi Manly Vale | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/maroubra/",title:"Silver Taxi Maroubra | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/marrickville/",title:"Silver Taxi Marrickville | Fixed Fares & Airport Transfers |"},
  {url:"/locations/marsden-park/",title:"Silver Taxi Marsden Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/marsfield/",title:"Silver Taxi Marsfield | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/mascot/",title:"Silver Taxi Mascot | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/matraville/",title:"Silver Taxi Matraville | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/mcgraths-hill/",title:"Silver Taxi Mcgraths Hill | Fixed Fares & Airport Transfers "},
  {url:"/locations/mcmahons-point/",title:"Silver Taxi Mcmahons Point | Fixed Fares & Airport Transfers"},
  {url:"/locations/meadowbank/",title:"Silver Taxi Meadowbank | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/medlow-bath/",title:"Silver Taxi Medlow Bath | Fixed Fares & Airport Transfers | "},
  {url:"/locations/megalong-valley/",title:"Silver Taxi Megalong Valley | Fixed Fares & Airport Transfer"},
  {url:"/locations/menai/",title:"Silver Taxi Menai | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/menangle-park/",title:"Silver Taxi Menangle Park | Fixed Fares & Airport Transfers "},
  {url:"/locations/merrylands/",title:"Silver Taxi Merrylands | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/merrylands-west/",title:"Silver Taxi Merrylands West | Fixed Fares & Airport Transfer"},
  {url:"/locations/middle-cove/",title:"Silver Taxi Middle Cove | Fixed Fares & Airport Transfers | "},
  {url:"/locations/miller/",title:"Silver Taxi Miller | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/millers-point/",title:"Silver Taxi Millers Point | Fixed Fares & Airport Transfers "},
  {url:"/locations/milperra/",title:"Silver Taxi Milperra | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/milsons-point/",title:"Silver Taxi Milsons Point | Fixed Fares & Airport Transfers "},
  {url:"/locations/minto/",title:"Silver Taxi Minto | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/miranda/",title:"Silver Taxi Miranda | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/mona-vale/",title:"Silver Taxi Mona Vale | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/monterey/",title:"Silver Taxi Monterey | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/moore-park/",title:"Silver Taxi Moore Park | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/moorebank/",title:"Silver Taxi Moorebank | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/mortdale/",title:"Silver Taxi Mortdale | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/mortlake/",title:"Silver Taxi Mortlake | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/mosman/",title:"Silver Taxi Mosman | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/mount-annan/",title:"Silver Taxi Mount Annan | Fixed Fares & Airport Transfers | "},
  {url:"/locations/mount-colah/",title:"Silver Taxi Mount Colah | Fixed Fares & Airport Transfers | "},
  {url:"/locations/mount-druitt/",title:"Silver Taxi Mount Druitt | Fixed Fares & Airport Transfers |"},
  {url:"/locations/mount-kuring-gai/",title:"Silver Taxi Mount Kuring Gai | Fixed Fares & Airport Transfe"},
  {url:"/locations/mount-ousley/",title:"Silver Taxi Mount Ousley | Fixed Fares & Airport Transfers |"},
  {url:"/locations/mount-riverview/",title:"Silver Taxi Mount Riverview | Fixed Fares & Airport Transfer"},
  {url:"/locations/mount-victoria/",title:"Silver Taxi Mount Victoria | Fixed Fares & Airport Transfers"},
  {url:"/locations/mulgoa/",title:"Silver Taxi Mulgoa | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/narara/",title:"Silver Taxi Narara | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/narellan/",title:"Silver Taxi Narellan | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/narellan-vale/",title:"Silver Taxi Narellan Vale | Fixed Fares & Airport Transfers "},
  {url:"/locations/naremburn/",title:"Silver Taxi Naremburn | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/narrabeen/",title:"Silver Taxi Narrabeen | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/narwee/",title:"Silver Taxi Narwee | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/nelson/",title:"Silver Taxi Nelson | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/neutral-bay/",title:"Silver Taxi Neutral Bay | Fixed Fares & Airport Transfers | "},
  {url:"/locations/newington/",title:"Silver Taxi Newington | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/newport/",title:"Silver Taxi Newport | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/newtown/",title:"Silver Taxi Newtown | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/niagara-park/",title:"Silver Taxi Niagara Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/noraville/",title:"Silver Taxi Noraville | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/normanhurst/",title:"Silver Taxi Normanhurst | Fixed Fares & Airport Transfers | "},
  {url:"/locations/north-bondi/",title:"Silver Taxi North Bondi | Fixed Fares & Airport Transfers | "},
  {url:"/locations/north-epping/",title:"Silver Taxi North Epping | Fixed Fares & Airport Transfers |"},
  {url:"/locations/north-head/",title:"Silver Taxi North Head | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/north-manly/",title:"Silver Taxi North Manly | Fixed Fares & Airport Transfers | "},
  {url:"/locations/north-parramatta/",title:"Silver Taxi North Parramatta | Fixed Fares & Airport Transfe"},
  {url:"/locations/north-richmond/",title:"Silver Taxi North Richmond | Fixed Fares & Airport Transfers"},
  {url:"/locations/north-ryde/",title:"Silver Taxi North Ryde | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/north-st-marys/",title:"Silver Taxi North St Marys | Fixed Fares & Airport Transfers"},
  {url:"/locations/north-sydney/",title:"Silver Taxi North Sydney | Fixed Fares & Airport Transfers |"},
  {url:"/locations/north-turramurra/",title:"Silver Taxi North Turramurra | Fixed Fares & Airport Transfe"},
  {url:"/locations/north-wollongong/",title:"Silver Taxi North Wollongong | Fixed Fares & Airport Transfe"},
  {url:"/locations/northbridge/",title:"Silver Taxi Northbridge | Fixed Fares & Airport Transfers | "},
  {url:"/locations/northern-beaches/",title:"Silver Taxi Northern Beaches Council | All 35 Suburbs | Silv"},
  {url:"/locations/northmead/",title:"Silver Taxi Northmead | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/norwest/",title:"Silver Taxi Norwest | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/oak-flats/",title:"Silver Taxi Oak Flats | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/oakdale/",title:"Silver Taxi Oakdale | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/oakhurst/",title:"Silver Taxi Oakhurst | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/oatlands/",title:"Silver Taxi Oatlands | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/oatley/",title:"Silver Taxi Oatley | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/old-guildford/",title:"Silver Taxi Old Guildford | Fixed Fares & Airport Transfers "},
  {url:"/locations/old-toongabbie/",title:"Silver Taxi Old Toongabbie | Fixed Fares & Airport Transfers"},
  {url:"/locations/olympic-park/",title:"Silver Taxi Olympic Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/oran-park/",title:"Silver Taxi Oran Park | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/orchard-hills/",title:"Silver Taxi Orchard Hills | Fixed Fares & Airport Transfers "},
  {url:"/locations/otford/",title:"Silver Taxi Otford | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/ourimbah/",title:"Silver Taxi Ourimbah | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/oxley-park/",title:"Silver Taxi Oxley Park | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/oyster-bay/",title:"Silver Taxi Oyster Bay | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/paddington/",title:"Silver Taxi Paddington | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/padstow/",title:"Silver Taxi Padstow | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/pagewood/",title:"Silver Taxi Pagewood | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/palm-beach/",title:"Silver Taxi Palm Beach | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/panania/",title:"Silver Taxi Panania | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/parklea/",title:"Silver Taxi Parklea | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/parramatta/",title:"Silver Taxi Parramatta | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/peakhurst/",title:"Silver Taxi Peakhurst | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/pemulwuy/",title:"Silver Taxi Pemulwuy | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/pendle-hill/",title:"Silver Taxi Pendle Hill | Fixed Fares & Airport Transfers | "},
  {url:"/locations/pennant-hills/",title:"Silver Taxi Pennant Hills | Fixed Fares & Airport Transfers "},
  {url:"/locations/penrith/",title:"Silver Taxi Penrith | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/penshurst/",title:"Silver Taxi Penshurst | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/petersham/",title:"Silver Taxi Petersham | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/picnic-point/",title:"Silver Taxi Picnic Point | Fixed Fares & Airport Transfers |"},
  {url:"/locations/picton/",title:"Silver Taxi Picton | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/pitt-town/",title:"Silver Taxi Pitt Town | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/pleasure-point/",title:"Silver Taxi Pleasure Point | Fixed Fares & Airport Transfers"},
  {url:"/locations/plumpton/",title:"Silver Taxi Plumpton | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/point-clare/",title:"Silver Taxi Point Clare | Fixed Fares & Airport Transfers | "},
  {url:"/locations/point-piper/",title:"Silver Taxi Point Piper | Fixed Fares & Airport Transfers | "},
  {url:"/locations/port-hacking/",title:"Silver Taxi Port Hacking | Fixed Fares & Airport Transfers |"},
  {url:"/locations/port-kembla/",title:"Silver Taxi Port Kembla | Fixed Fares & Airport Transfers | "},
  {url:"/locations/potts-hill/",title:"Silver Taxi Potts Hill | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/potts-point/",title:"Silver Taxi Potts Point | Fixed Fares & Airport Transfers | "},
  {url:"/locations/prairiewood/",title:"Silver Taxi Prairiewood | Fixed Fares & Airport Transfers | "},
  {url:"/locations/prestons/",title:"Silver Taxi Prestons | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/prospect/",title:"Silver Taxi Prospect | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/punchbowl/",title:"Silver Taxi Punchbowl | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/putney/",title:"Silver Taxi Putney | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/pymble/",title:"Silver Taxi Pymble | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/pyrmont/",title:"Silver Taxi Pyrmont | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/quakers-hill/",title:"Silver Taxi Quakers Hill | Fixed Fares & Airport Transfers |"},
  {url:"/locations/queens-park/",title:"Silver Taxi Queens Park | Fixed Fares & Airport Transfers | "},
  {url:"/locations/ramsgate/",title:"Silver Taxi Ramsgate | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/randwick/",title:"Silver Taxi Randwick | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/redfern/",title:"Silver Taxi Redfern | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/regents-park/",title:"Silver Taxi Regents Park | Fixed Fares & Airport Transfers |"},
  {url:"/locations/revesby/",title:"Silver Taxi Revesby | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/rhodes/",title:"Silver Taxi Rhodes | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/richmond/",title:"Silver Taxi Richmond | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/riverstone/",title:"Silver Taxi Riverstone | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/riverview/",title:"Silver Taxi Riverview | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/riverwood/",title:"Silver Taxi Riverwood | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/rockdale/",title:"Silver Taxi Rockdale | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/rodd-point/",title:"Silver Taxi Rodd Point | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/rookwood/",title:"Silver Taxi Rookwood | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/rooty-hill/",title:"Silver Taxi Rooty Hill | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/rose-bay/",title:"Silver Taxi Rose Bay | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/rosebery/",title:"Silver Taxi Rosebery | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/rosehill/",title:"Silver Taxi Rosehill | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/roselands/",title:"Silver Taxi Roselands | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/rosemeadow/",title:"Silver Taxi Rosemeadow | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/roseville/",title:"Silver Taxi Roseville | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/roseville-chase/",title:"Silver Taxi Roseville Chase | Fixed Fares & Airport Transfer"},
  {url:"/locations/round-corner/",title:"Silver Taxi Round Corner | Fixed Fares & Airport Transfers |"},
  {url:"/locations/rouse-hill/",title:"Silver Taxi Rouse Hill | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/rozelle/",title:"Silver Taxi Rozelle | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/ruse/",title:"Silver Taxi Ruse | Fixed Fares & Airport Transfers | Silver "},
  {url:"/locations/rushcutters-bay/",title:"Silver Taxi Rushcutters Bay | Fixed Fares & Airport Transfer"},
  {url:"/locations/russell-lea/",title:"Silver Taxi Russell Lea | Fixed Fares & Airport Transfers | "},
  {url:"/locations/rydalmere/",title:"Silver Taxi Rydalmere | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/ryde/",title:"Silver Taxi Ryde | Fixed Fares & Airport Transfers | Silver "},
  {url:"/locations/sadleir/",title:"Silver Taxi Sadleir | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/san-remo/",title:"Silver Taxi San Remo | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/sandy-point/",title:"Silver Taxi Sandy Point | Fixed Fares & Airport Transfers | "},
  {url:"/locations/sans-souci/",title:"Silver Taxi Sans Souci | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/saratoga/",title:"Silver Taxi Saratoga | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/scarborough/",title:"Silver Taxi Scarborough | Fixed Fares & Airport Transfers | "},
  {url:"/locations/schofields/",title:"Silver Taxi Schofields | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/seaforth/",title:"Silver Taxi Seaforth | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/sefton/",title:"Silver Taxi Sefton | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/seven-hills/",title:"Silver Taxi Seven Hills | Fixed Fares & Airport Transfers | "},
  {url:"/locations/shalvey/",title:"Silver Taxi Shalvey | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/shellharbour/",title:"Silver Taxi Shellharbour | Fixed Fares & Airport Transfers |"},
  {url:"/locations/shelly-beach/",title:"Silver Taxi Shelly Beach | Fixed Fares & Airport Transfers |"},
  {url:"/locations/silverwater/",title:"Silver Taxi Silverwater | Fixed Fares & Airport Transfers | "},
  {url:"/locations/smithfield/",title:"Silver Taxi Smithfield | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/somersby/",title:"Silver Taxi Somersby | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/south-coogee/",title:"Silver Taxi South Coogee | Fixed Fares & Airport Transfers |"},
  {url:"/locations/south-granville/",title:"Silver Taxi South Granville | Fixed Fares & Airport Transfer"},
  {url:"/locations/south-hurstville/",title:"Silver Taxi South Hurstville | Fixed Fares & Airport Transfe"},
  {url:"/locations/south-penrith/",title:"Silver Taxi South Penrith | Fixed Fares & Airport Transfers "},
  {url:"/locations/south-turramurra/",title:"Silver Taxi South Turramurra | Fixed Fares & Airport Transfe"},
  {url:"/locations/south-windsor/",title:"Silver Taxi South Windsor | Fixed Fares & Airport Transfers "},
  {url:"/locations/spring-farm/",title:"Silver Taxi Spring Farm | Fixed Fares & Airport Transfers | "},
  {url:"/locations/springwood/",title:"Silver Taxi Springwood | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/st-clair/",title:"Silver Taxi St Clair | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/st-helens-park/",title:"Silver Taxi St Helens Park | Fixed Fares & Airport Transfers"},
  {url:"/locations/st-ives/",title:"Silver Taxi St Ives | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/st-ives-chase/",title:"Silver Taxi St Ives Chase | Fixed Fares & Airport Transfers "},
  {url:"/locations/st-leonards/",title:"Silver Taxi St Leonards | Fixed Fares & Airport Transfers | "},
  {url:"/locations/st-marys/",title:"Silver Taxi St Marys | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/st-peters/",title:"Silver Taxi St Peters | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/stanhope-gardens/",title:"Silver Taxi Stanhope Gardens | Fixed Fares & Airport Transfe"},
  {url:"/locations/stanmore/",title:"Silver Taxi Stanmore | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/stanwell-park/",title:"Silver Taxi Stanwell Park | Fixed Fares & Airport Transfers "},
  {url:"/locations/strathfield/",title:"Silver Taxi Strathfield | Fixed Fares & Airport Transfers | "},
  {url:"/locations/strathfield-south/",title:"Silver Taxi Strathfield South | Fixed Fares & Airport Transf"},
  {url:"/locations/summer-hill/",title:"Silver Taxi Summer Hill | Fixed Fares & Airport Transfers | "},
  {url:"/locations/sun-valley/",title:"Silver Taxi Sun Valley | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/surry-hills/",title:"Silver Taxi Surry Hills | Fixed Fares & Airport Transfers | "},
  {url:"/locations/sutherland/",title:"Silver Taxi Sutherland | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/sutherland-shire/",title:"Silver Taxi Sutherland Shire Council | All 33 Suburbs | Silv"},
  {url:"/locations/sydenham/",title:"Silver Taxi Sydenham | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/sydney-airport/",title:"Sydney Airport (Kingsford Smith) Transfers | Fixed Fares | S"},
  {url:"/locations/sydney-cbd/",title:"Silver Taxi Sydney Cbd | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/sydney-olympic-park/",title:"Silver Taxi Sydney Olympic Park | Fixed Fares & Airport Tran"},
  {url:"/locations/sylvania/",title:"Silver Taxi Sylvania | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/sylvania-waters/",title:"Silver Taxi Sylvania Waters | Fixed Fares & Airport Transfer"},
  {url:"/locations/tahmoor/",title:"Silver Taxi Tahmoor | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/tamarama/",title:"Silver Taxi Tamarama | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/taren-point/",title:"Silver Taxi Taren Point | Fixed Fares & Airport Transfers | "},
  {url:"/locations/tascott/",title:"Silver Taxi Tascott | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/telopea/",title:"Silver Taxi Telopea | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/tempe/",title:"Silver Taxi Tempe | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/tennyson-point/",title:"Silver Taxi Tennyson Point | Fixed Fares & Airport Transfers"},
  {url:"/locations/terrey-hills/",title:"Silver Taxi Terrey Hills | Fixed Fares & Airport Transfers |"},
  {url:"/locations/terrigal/",title:"Silver Taxi Terrigal | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/the-entrance/",title:"Silver Taxi The Entrance | Fixed Fares & Airport Transfers |"},
  {url:"/locations/the-oaks/",title:"Silver Taxi The Oaks | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/the-ponds/",title:"Silver Taxi The Ponds | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/the-rocks/",title:"Silver Taxi The Rocks | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/thirlmere/",title:"Silver Taxi Thirlmere | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/thirroul/",title:"Silver Taxi Thirroul | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/thornleigh/",title:"Silver Taxi Thornleigh | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/toongabbie/",title:"Silver Taxi Toongabbie | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/toowoon-bay/",title:"Silver Taxi Toowoon Bay | Fixed Fares & Airport Transfers | "},
  {url:"/locations/top-ryde/",title:"Silver Taxi Top Ryde | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/toukley/",title:"Silver Taxi Toukley | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/towradgi/",title:"Silver Taxi Towradgi | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/tregear/",title:"Silver Taxi Tregear | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/tuggerah/",title:"Silver Taxi Tuggerah | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/turramurra/",title:"Silver Taxi Turramurra | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/turrella/",title:"Silver Taxi Turrella | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/ultimo/",title:"Silver Taxi Ultimo | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/umina-beach/",title:"Silver Taxi Umina Beach | Fixed Fares & Airport Transfers | "},
  {url:"/locations/unanderra/",title:"Silver Taxi Unanderra | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/unsw/",title:"Silver Taxi Unsw | Fixed Fares & Airport Transfers | Silver "},
  {url:"/locations/valley-heights/",title:"Silver Taxi Valley Heights | Fixed Fares & Airport Transfers"},
  {url:"/locations/vaucluse/",title:"Silver Taxi Vaucluse | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/villawood/",title:"Silver Taxi Villawood | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/voyager-point/",title:"Silver Taxi Voyager Point | Fixed Fares & Airport Transfers "},
  {url:"/locations/wahroonga/",title:"Silver Taxi Wahroonga | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/waitara/",title:"Silver Taxi Waitara | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/wakeley/",title:"Silver Taxi Wakeley | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/wamberal/",title:"Silver Taxi Wamberal | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/wareemba/",title:"Silver Taxi Wareemba | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/warragamba/",title:"Silver Taxi Warragamba | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/warrawee/",title:"Silver Taxi Warrawee | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/warrawong/",title:"Silver Taxi Warrawong | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/warriewood/",title:"Silver Taxi Warriewood | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/warrimoo/",title:"Silver Taxi Warrimoo | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/warwick-farm/",title:"Silver Taxi Warwick Farm | Fixed Fares & Airport Transfers |"},
  {url:"/locations/waterfall/",title:"Silver Taxi Waterfall | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/waterloo/",title:"Silver Taxi Waterloo | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/watsons-bay/",title:"Silver Taxi Watsons Bay | Fixed Fares & Airport Transfers | "},
  {url:"/locations/wattle-grove/",title:"Silver Taxi Wattle Grove | Fixed Fares & Airport Transfers |"},
  {url:"/locations/waverley/",title:"Silver Taxi Waverley | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/waverton/",title:"Silver Taxi Waverton | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/wentworth-falls/",title:"Silver Taxi Wentworth Falls | Fixed Fares & Airport Transfer"},
  {url:"/locations/wentworth-point/",title:"Silver Taxi Wentworth Point | Fixed Fares & Airport Transfer"},
  {url:"/locations/wentworthville/",title:"Silver Taxi Wentworthville | Fixed Fares & Airport Transfers"},
  {url:"/locations/werrington/",title:"Silver Taxi Werrington | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/west-hoxton/",title:"Silver Taxi West Hoxton | Fixed Fares & Airport Transfers | "},
  {url:"/locations/west-pennant-hills/",title:"Silver Taxi West Pennant Hills | Fixed Fares & Airport Trans"},
  {url:"/locations/west-pymble/",title:"Silver Taxi West Pymble | Fixed Fares & Airport Transfers | "},
  {url:"/locations/west-ryde/",title:"Silver Taxi West Ryde | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/western-sydney-airport/",title:"Western Sydney International Airport Transfers | Fixed Fares"},
  {url:"/locations/westmead/",title:"Silver Taxi Westmead | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/wetherill-park/",title:"Silver Taxi Wetherill Park | Fixed Fares & Airport Transfers"},
  {url:"/locations/whale-beach/",title:"Silver Taxi Whale Beach | Fixed Fares & Airport Transfers | "},
  {url:"/locations/wheeler-heights/",title:"Silver Taxi Wheeler Heights | Fixed Fares & Airport Transfer"},
  {url:"/locations/wilberforce/",title:"Silver Taxi Wilberforce | Fixed Fares & Airport Transfers | "},
  {url:"/locations/wiley-park/",title:"Silver Taxi Wiley Park | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/willmot/",title:"Silver Taxi Willmot | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/willoughby/",title:"Silver Taxi Willoughby | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/wilton/",title:"Silver Taxi Wilton | Fixed Fares & Airport Transfers | Silve"},
  {url:"/locations/windang/",title:"Silver Taxi Windang | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/windsor/",title:"Silver Taxi Windsor | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/winmalee/",title:"Silver Taxi Winmalee | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/wolli-creek/",title:"Silver Taxi Wolli Creek | Fixed Fares & Airport Transfers | "},
  {url:"/locations/wollondilly/",title:"Silver Taxi Wollondilly Shire Council | All 9 Suburbs | Silv"},
  {url:"/locations/wollongong/",title:"Silver Taxi Wollongong | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/wollstonecraft/",title:"Silver Taxi Wollstonecraft | Fixed Fares & Airport Transfers"},
  {url:"/locations/wombarra/",title:"Silver Taxi Wombarra | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/woodbine/",title:"Silver Taxi Woodbine | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/woodcroft/",title:"Silver Taxi Woodcroft | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/woodford/",title:"Silver Taxi Woodford | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/woollahra/",title:"Silver Taxi Woollahra | Fixed Fares & Airport Transfers | Si"},
  {url:"/locations/woolloomooloo/",title:"Silver Taxi Woolloomooloo | Fixed Fares & Airport Transfers "},
  {url:"/locations/woolooware/",title:"Silver Taxi Woolooware | Fixed Fares & Airport Transfers | S"},
  {url:"/locations/woolwich/",title:"Silver Taxi Woolwich | Fixed Fares & Airport Transfers | Sil"},
  {url:"/locations/woy-woy/",title:"Silver Taxi Woy Woy | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/wyoming/",title:"Silver Taxi Wyoming | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/wyong/",title:"Silver Taxi Wyong | Fixed Fares & Airport Transfers | Silver"},
  {url:"/locations/yagoona/",title:"Silver Taxi Yagoona | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/yellow-rock/",title:"Silver Taxi Yellow Rock | Fixed Fares & Airport Transfers | "},
  {url:"/locations/yennora/",title:"Silver Taxi Yennora | Fixed Fares & Airport Transfers | Silv"},
  {url:"/locations/zetland/",title:"Silver Taxi Zetland | Fixed Fares & Airport Transfers | Silv"}
];

// -------------------- Threat Protection API Routes --------------------

// GET /api/threat/report — full threat report for dashboard
app.get('/api/threat/report', (req, res) => {
  try {
    res.json({ success: true, data: getThreatReport() });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/threat/block — manually block a fingerprint
app.post('/api/threat/block', (req, res) => {
  const { fingerprint, reason } = req.body;
  if (!fingerprint) return res.status(400).json({ success: false, message: 'fingerprint required' });
  blockFingerprint(fingerprint, reason || 'Manual block from dashboard');
  res.json({ success: true, message: `Fingerprint ${fingerprint} blocked.` });
});

// POST /api/threat/unblock — unblock a fingerprint
app.post('/api/threat/unblock', (req, res) => {
  const { fingerprint } = req.body;
  if (!fingerprint) return res.status(400).json({ success: false, message: 'fingerprint required' });
  unblockFingerprint(fingerprint);
  res.json({ success: true, message: `Fingerprint ${fingerprint} unblocked.` });
});

// POST /api/threat/conversion — record a conversion for current visitor
app.post('/api/threat/conversion', (req, res) => {
  recordConversion(req);
  res.json({ success: true });
});

// -------------------- CLICK FRAUD API ROUTES --------------------
// GET /api/fraud/report — full click fraud report for dashboard
app.get('/api/fraud/report', (req, res) => {
  try {
    res.json({ success: true, data: getFraudReport() });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/fraud/fingerprint — receive enhanced client-side fingerprint signals
app.post('/api/fraud/fingerprint', (req, res) => {
  try {
    const { gclid, canvas, webgl, screen, fonts, timezone } = req.body || {};
    if (gclid) {
      const serverFp = buildServerFingerprint(req);
      const strongFp = mergeFingerprints(serverFp, { canvas, webgl, screen, fonts, timezone });
      // If fingerprint changed (stronger now), record the click with the stronger fp
      if (strongFp !== serverFp) {
        recordAdClick(strongFp, gclid, req);
      }
    }
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false });
  }
});

// GET /api/threat/history — 30-day threat event history
app.get('/api/threat/history', (req, res) => {
  try {
    const report = getThreatReport();
    res.json({ success: true, data: report.threatHistory || [] });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/fraud/history — 30-day fraud event history
app.get('/api/fraud/history', (req, res) => {
  try {
    const report = getFraudReport();
    // Return all ad click events as history
    const allClicks = report.recentClicks || [];
    res.json({ success: true, data: allClicks });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/fraud/conversion — mark a device as converted (booking completed)
app.post('/api/fraud/conversion', (req, res) => {
  try {
    const serverFp = buildServerFingerprint(req);
    recordFraudConversion(serverFp);
    res.json({ success: true });

// POST /api/fraud/block-ip — manually block an IP address
app.post('/api/fraud/block-ip', (req, res) => {
  try {
    const { ip, reason } = req.body || {};
    if (!ip) return res.status(400).json({ success: false, error: 'IP required' });
    blockIP(ip, reason || 'Manual block from dashboard', true, '');
    res.json({ success: true, message: 'IP ' + ip + ' blocked' });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/fraud/unblock-ip — remove an IP from the blocklist
app.post('/api/fraud/unblock-ip', (req, res) => {
  try {
    const { ip } = req.body || {};
    if (!ip) return res.status(400).json({ success: false, error: 'IP required' });
    unblockIP(ip);
    res.json({ success: true, message: 'IP ' + ip + ' unblocked' });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/fraud/blocklist — get full IP blocklist
app.get('/api/fraud/blocklist', (req, res) => {
  try {
    res.json({ success: true, data: getIPBlocklist() });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/fraud/exclusion-csv — download Google Ads IP exclusion CSV
app.get('/api/fraud/exclusion-csv', (req, res) => {
  try {
    const csv = generateExclusionCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="google-ads-ip-exclusions.csv"');
    res.send(csv);
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/fraud/daily-stats — 30-day daily click/fraud stats
app.get('/api/fraud/daily-stats', (req, res) => {
  try {
    res.json({ success: true, data: getDailyStats() });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/fraud/config — get fraud detection configuration
app.get('/api/fraud/config', (req, res) => {
  try {
    const report = getFraudReport();
    res.json({ success: true, config: report.config });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/fraud/config — update fraud detection configuration
app.post('/api/fraud/config', (req, res) => {
  try {
    const { clickThreshold, costPerClick, autoBlock, alertEmail, vpnBlock } = req.body || {};
    const { fraudConfig: cfg } = require('./middleware/clickFraud');
    if (clickThreshold !== undefined) cfg.clickThreshold = Math.max(1, Math.min(20, +clickThreshold));
    if (costPerClick !== undefined) cfg.costPerClick = Math.max(0.1, Math.min(100, +costPerClick));
    if (autoBlock !== undefined) cfg.autoBlock = !!autoBlock;
    if (alertEmail !== undefined) cfg.alertEmail = !!alertEmail;
    if (vpnBlock !== undefined) cfg.vpnBlock = !!vpnBlock;
    res.json({ success: true, config: cfg });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
  } catch(e) {
    res.json({ success: false });
  }
});

// -------------------- Payment Routes (must be before catch-all) --------------------
// Customer payment page
app.get('/pay/:tripId', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'pay.html'));
});

const paymentRouter = require('./routes/payment');
app.use('/api/payment', paymentRouter);

// -------------------- Flight Tracking API --------------------
// Uses AviationStack free tier (100 calls/month) to look up flight arrival time
// GATED: Only fires for phone-verified users to conserve quota
// Quota exhaustion fallback: returns graceful 'monitored' message
app.get('/api/flight-info', async (req, res) => {
  const { flight, phone } = req.query;
  if (!flight) return res.json({ error: 'No flight number provided' });
  const fn = flight.replace(/\s+/g, '').toUpperCase();
  // Parse IATA airline code and flight number
  const match = fn.match(/^([A-Z]{2})(\d+)$/);
  if (!match) return res.json({ error: 'Invalid flight number format. Use e.g. QF401' });
  const iata = match[1], num = match[2];
  // GATE: require phone verification — return graceful fallback for unverified requests
  const normalizedPhone = (phone || '').trim();
  if (!normalizedPhone || !verifiedPhones.has(normalizedPhone)) {
    return res.json({
      flightNumber: fn,
      airline: iata,
      status: 'pending_verification',
      message: 'Verify your phone number to track this flight in real time.',
      monitored: true
    });
  }
  // Serve from cache if fresh (5 min)
  const cached = flightCache.get(fn);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
    return res.json(cached.data);
  }
  try {
    // Try AviationStack free API (100 calls/month)
    // Quota exhaustion: AviationStack returns { success: false, error: { code: 104 } }
    const AVIATION_KEY = process.env.AVIATION_API_KEY || '';
    let flightData = null;
    if (AVIATION_KEY) {
      const url = `http://api.aviationstack.com/v1/flights?access_key=${AVIATION_KEY}&flight_iata=${fn}&limit=1`;
      const r = await fetch(url);
      const j = await r.json();
      // Quota exhaustion fallback (AviationStack error code 104 = monthly limit reached)
      if (j.success === false && j.error && (j.error.code === 104 || j.error.code === 101 || j.error.code === 102)) {
        console.warn('[FlightAPI] AviationStack quota exhausted or key invalid:', j.error.code, j.error.info);
        const fallback = {
          flightNumber: fn, airline: iata,
          status: 'lookup_unavailable',
          message: 'Flight tracking active — your driver will monitor this flight for delays at no extra charge.',
          monitored: true
        };
        flightCache.set(fn, { data: fallback, ts: Date.now() }); // cache to avoid hammering
        return res.json(fallback);
      }
      if (j.data && j.data.length > 0) {
        const f = j.data[0];
        // VALIDATE: This service only handles Sydney Airport (SYD/YSSY) pickups
        // If the flight doesn't arrive at SYD, return graceful monitored fallback
        const arrIata = (f.arrival?.iata || '').toUpperCase();
        const arrIcao = (f.arrival?.icao || '').toUpperCase();
        if (arrIata && arrIata !== 'SYD' && arrIcao !== 'YSSY') {
          console.log('[FlightAPI] Flight', fn, 'arrives at', arrIata, '— not SYD, returning monitored fallback');
          const fallback = {
            flightNumber: fn,
            airline: f.airline?.name || iata,
            status: 'lookup_unavailable',
            message: `Flight ${fn} does not arrive at Sydney Airport. Please check your flight number. Your driver will monitor your flight for delays.`,
            monitored: true
          };
          flightCache.set(fn, { data: fallback, ts: Date.now() });
          return res.json(fallback);
        }
        // AviationStack returns times as UTC ISO strings (e.g. 2026-05-06T09:40:00+00:00)
        // The arrival timezone field tells us the local TZ (always Australia/Sydney for SYD)
        // Convert to Sydney local time for display
        const arrTZ = f.arrival?.timezone || 'Australia/Sydney';
        const toLocalTime = (utcStr) => {
          if (!utcStr) return null;
          try {
            const d = new Date(utcStr);
            // Format as "6 May at 09:40 am" in the arrival airport's local timezone
            return d.toLocaleString('en-AU', {
              timeZone: arrTZ,
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
          } catch(e) { return utcStr; }
        };
        // Use best available arrival time: actual > estimated_runway > estimated > scheduled
        const bestArrivalUtc = f.arrival?.actual ||
                               f.arrival?.estimated_runway ||
                               f.arrival?.estimated ||
                               f.arrival?.scheduled || null;
        const scheduledUtc   = f.arrival?.scheduled || null;
        flightData = {
          flightNumber: fn,
          airline: f.airline?.name || iata,
          status: f.flight_status || 'unknown',
          origin: f.departure?.airport || '',
          originIata: f.departure?.iata || '',
          // Raw UTC strings (kept for pickup time auto-set logic in book.html)
          scheduledArrival: scheduledUtc,
          estimatedArrival: bestArrivalUtc,
          // Human-readable Sydney local time strings for display
          scheduledArrivalLocal: toLocalTime(scheduledUtc),
          estimatedArrivalLocal: toLocalTime(bestArrivalUtc),
          arrivalTimezone: arrTZ,
          terminal: f.arrival?.terminal || '',
          gate: f.arrival?.gate || '',
        };
      }
    }
    // If no API key or no data, return a helpful message
    if (!flightData) {
      return res.json({
        flightNumber: fn,
        airline: iata,
        status: 'lookup_unavailable',
        message: 'Flight tracking active — your driver will monitor this flight for delays.',
        monitored: true
      });
    }
    // Cache successful result for 5 minutes
    flightCache.set(fn, { data: flightData, ts: Date.now() });
    // Evict old cache entries (keep last 200)
    if (flightCache.size > 200) {
      const oldest = [...flightCache.entries()].sort((a,b) => a[1].ts - b[1].ts).slice(0, 50);
      oldest.forEach(([k]) => flightCache.delete(k));
    }
    res.json(flightData);
  } catch (e) {
    res.json({
      flightNumber: fn,
      status: 'lookup_unavailable',
      message: 'Flight tracking active — your driver will monitor this flight for delays.',
      monitored: true
    });
  }
});

app.get('*',                       page('index.html'));

// -------------------- Email Templates --------------------
function receiptHtml(b, fare) {
  const now = new Date().toLocaleString('en-AU', {
    timeZone:'Australia/Sydney', day:'2-digit', month:'2-digit',
    year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true
  });
  // Format booking date/time nicely for confirmation message
  const bookingDtFmt = (() => {
    try {
      const [y,mo,d] = (b.date||'').split('-').map(Number);
      const [hh,mm] = (b.time||'00:00').split(':').map(Number);
      const dt = new Date(y, mo-1, d, hh, mm);
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const ampm = hh >= 12 ? 'pm' : 'am';
      const h12 = hh % 12 || 12;
      const minStr = mm > 0 ? `:${String(mm).padStart(2,'0')}` : '';
      return `${days[dt.getDay()]} ${d} ${months[mo-1]} ${y} at ${h12}${minStr} ${ampm}`;
    } catch(e) { return `${b.date} at ${b.time}`; }
  })();
  const govtLevy = fare.govtLevy || 1.32;
  const gst = +(fare.total / 11).toFixed(2);
  const af = +(fare.airportFee || 0);
  const serviceFee = fare.serviceFee || fare.cardFee || 0;
  const subtotalFare = fare.subtotal || +(fare.total - serviceFee).toFixed(2);
  const totalCharged = fare.total;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#f0f4f8;font-family:'Courier New',Courier,monospace;}
  .wrap{max-width:480px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.15);}
  .hd{background:linear-gradient(135deg,#0f1f3d 0%,#144a8f 100%);padding:28px 24px;text-align:center;}
  .hd-logo{color:#fff;font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.2em;margin:0 0 4px;font-family:Arial,sans-serif;}
  .hd-tagline{color:rgba(255,255,255,.6);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 14px;font-family:Arial,sans-serif;}
  .hd-badge{display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:4px 14px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;font-family:Arial,sans-serif;}
  .ref-block{border-bottom:2px dashed #d1d5db;padding:16px 24px;text-align:center;background:#f8faff;}
  .ref-lbl{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;font-family:Arial,sans-serif;}
  .ref-num{font-size:28px;font-weight:900;color:#144a8f;letter-spacing:.08em;}
  .ref-date{font-size:10px;color:#9ca3af;margin-top:4px;font-family:Arial,sans-serif;}
  /* Receipt body - monospace ticket style */
  .ticket{padding:20px 24px;}
  .dashes{border:none;border-top:1px dashed #9ca3af;margin:10px 0;}
  .receipt-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;letter-spacing:.04em;}
  .receipt-row .lbl{color:#374151;font-weight:700;text-transform:uppercase;}
  .receipt-row .val{color:#111827;font-weight:700;text-align:right;}
  .receipt-row.total-row .lbl{font-size:15px;color:#0f1f3d;}
  .receipt-row.total-row .val{font-size:15px;color:#0f1f3d;}
  .receipt-row.grand .lbl,.receipt-row.grand .val{font-size:17px;font-weight:900;color:#144a8f;}
  .receipt-row.gst-row .lbl,.receipt-row.gst-row .val{font-size:10px;color:#9ca3af;font-weight:400;}
  .addr-block{padding:10px 0;}
  .addr-line{font-size:12px;color:#374151;padding:2px 0;}
  .addr-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:2px;font-family:Arial,sans-serif;}
  .info-section{background:#f8faff;padding:12px 24px;border-top:1px dashed #d1d5db;font-family:Arial,sans-serif;}
  .info-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;}
  .info-row .k{color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;}
  .info-row .v{color:#374151;font-weight:600;text-align:right;}
  .footer{background:#f9fafb;padding:16px 24px;text-align:center;font-size:10px;color:#9ca3af;line-height:2;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;}
  .footer strong{color:#374151;}
  .payment-badge{display:inline-block;background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;font-family:Arial,sans-serif;}
</style>
</head><body>

<!-- Booking Confirmation Message -->
<div style="max-width:480px;margin:24px auto 0;background:#f0fdf4;border:1px solid #16a34a;border-radius:8px 8px 0 0;padding:16px 20px;font-family:Arial,sans-serif;">
  <p style="margin:0;font-size:13px;color:#166534;line-height:1.5;"><strong>#${b.ref}</strong> — Your Sydney taxi booking confirmed for <strong>${bookingDtFmt}</strong>. Fare: <strong>${b.fare || '$'+fare.total.toFixed(2)} AUD</strong>. Amendments: <a href="tel:1800173171" style="color:#166534;font-weight:700;">1800 173 171</a></p>
</div>

<div class="wrap" style="border-radius:0 0 8px 8px;margin-top:0;">
  <div class="hd">
    <p class="hd-logo">Silver Taxi Sydney Service</p>
    <p class="hd-tagline">Premium Sydney Taxi Service</p>
        <span class="hd-badge"> TAX INVOICE</span>
  </div>

  <div class="ref-block">
    <div class="ref-lbl">Booking Reference</div>
    <div class="ref-num">#${b.ref}</div>
    <div class="ref-date">Issued: ${now} AEST</div>
  </div>

  <div class="ticket">
    <hr class="dashes"/>
    <div class="receipt-row">
      <span class="lbl">PICK UP:</span>
      <span class="val">${shortAddr(b.pickup)}</span>
    </div>
    <div class="receipt-row">
      <span class="lbl">DEST:</span>
      <span class="val">${shortAddr(b.dropoff)}</span>
    </div>
    <hr class="dashes"/>
    <div class="receipt-row">
      <span class="lbl">FARE</span>
      <span class="val">$${fare.sub.toFixed(2)}</span>
    </div>
    <div class="receipt-row">
      <span class="lbl">GOVT. LEVY</span>
      <span class="val">$${govtLevy.toFixed(2)}</span>
    </div>
    ${fare.tolls > 0 ? `
    <div class="receipt-row">
      <span class="lbl">TOLLS</span>
      <span class="val">$${fare.tolls.toFixed(2)}</span>
    </div>` : ''}
    ${fare.returnSub ? `
    <div class="receipt-row">
      <span class="lbl">RETURN FARE (10% OFF)</span>
      <span class="val">$${fare.returnSub.toFixed(2)}</span>
    </div>` : ''}
    ${fare.returnTolls > 0 ? `
    <div class="receipt-row">
      <span class="lbl">RETURN TOLLS</span>
      <span class="val">$${fare.returnTolls.toFixed(2)}</span>
    </div>` : ''}
    ${af > 0 ? `
    <div class="receipt-row">
      <span class="lbl">AIRPORT FEE</span>
      <span class="val">$${af.toFixed(2)}</span>
    </div>` : ''}
    <div class="receipt-row">
      <span class="lbl">BOOKING FEE</span>
      <span class="val">$${(fare.bookingFee || 2.50).toFixed(2)}</span>
    </div>
    <hr class="dashes"/>
    <div class="receipt-row total-row">
      <span class="lbl">TOTAL FARE</span>
      <span class="val">$${subtotalFare.toFixed(2)}</span>
    </div>
    ${serviceFee > 0 ? `
    <div class="receipt-row">
      <span class="lbl">SERVICE FEE</span>
      <span class="val">$${serviceFee.toFixed(2)}</span>
    </div>` : ''}
    <hr class="dashes"/>
    <div class="receipt-row grand">
      <span class="lbl">TOTAL (AUD)</span>
      <span class="val">$${totalCharged.toFixed(2)}</span>
    </div>
    <div class="receipt-row" style="font-size:.78rem;color:#6b7280;">
      <span class="lbl">*INC. GST</span>
      <span class="val">$${gst.toFixed(2)}</span>
    </div>
    <div class="receipt-row" style="font-size:.72rem;color:#9ca3af;">
      <span class="lbl">GST = 1/11 of total fare (all fares are GST inclusive)</span>
      <span class="val"></span>
    </div>
    <hr class="dashes"/>
    <div style="text-align:center;padding:6px 0;">
      <span class="payment-badge">${b.payment || 'Cash / EFTPOS'}</span>
    </div>
    <hr class="dashes"/>
  </div>

  <div class="info-section">
    <div class="info-row"><span class="k">Passenger</span><span class="v">${b.name || ''}</span></div>
    <div class="info-row"><span class="k">Mobile</span><span class="v">${b.phone || ''}</span></div>
    ${b.email ? `<div class="info-row"><span class="k">Email</span><span class="v">${b.email}</span></div>` : ''}
    <div class="info-row"><span class="k">Vehicle</span><span class="v">${b.vehicle || ''}</span></div>
    <div class="info-row"><span class="k">Date &amp; Time</span><span class="v">${b.date || ''} ${b.time || ''}</span></div>
    <div class="info-row"><span class="k">Distance</span><span class="v">${fare.km.toFixed(1)} km</span></div>
    ${b.flight ? `<div class="info-row"><span class="k">Flight</span><span class="v">${b.flight}</span></div>` : ''}
    ${b.returnTrip ? `<div class="info-row"><span class="k">Return</span><span class="v">${b.returnDate || ''} ${b.returnTime || ''}</span></div>` : ''}
  </div>

</div>

<!-- Pay Online CTA -->
<div style="margin:0 auto; max-width:480px; padding:20px 24px; background:#eff6ff; border-top:1px solid #e5e7eb; text-align:center; font-family:Arial,sans-serif;">
  <p style="margin:0 0 12px; font-size:13px; color:#1e40af; font-weight:600;">Prefer to pay online? It's quick, safe &amp; you'll get an instant receipt.</p>
  <a href="https://silvertaxisydneyservice.com/manage" style="display:inline-block; padding:12px 28px; background:linear-gradient(135deg,#144a8f,#0f1f3d); color:#ffffff; border-radius:6px; text-decoration:none; font-weight:700; font-size:14px;">PAY ONLINE</a>
</div>

<!-- Premium Footer/Signature -->
<div style="margin:0 auto; max-width:480px; overflow:hidden;">
  <!-- Quick Action Links with SVG Icons -->
  <div style="background:#ffffff; padding:24px 24px 20px; border-top:1px solid #e5e7eb;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,sans-serif;">
      <tr>
        <td width="33%" style="text-align:center; padding:8px 4px; vertical-align:top;">
          <a href="https://silvertaxisydneyservice.com/book" style="text-decoration:none; display:block;">
            <div style="width:44px; height:44px; margin:0 auto 8px; background:linear-gradient(135deg,#0f1f3d,#144a8f); border-radius:50%; text-align:center; line-height:44px;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg></div>
            <div style="font-size:11px; font-weight:700; color:#0f1f3d; text-transform:uppercase; letter-spacing:.04em;">Book Online</div>
            <div style="font-size:10px; color:#6b7280; margin-top:2px;">Quick &amp; easy</div>
          </a>
        </td>
        <td width="33%" style="text-align:center; padding:8px 4px; vertical-align:top;">
          <a href="https://silvertaxisydneyservice.com/contact" style="text-decoration:none; display:block;">
            <div style="width:44px; height:44px; margin:0 auto 8px; background:linear-gradient(135deg,#0f1f3d,#144a8f); border-radius:50%; text-align:center; line-height:44px;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div style="font-size:11px; font-weight:700; color:#0f1f3d; text-transform:uppercase; letter-spacing:.04em;">Contact Us</div>
            <div style="font-size:10px; color:#6b7280; margin-top:2px;">We're here to help</div>
          </a>
        </td>
        <td width="33%" style="text-align:center; padding:8px 4px; vertical-align:top;">
          <a href="https://silvertaxisydneyservice.com/manage" style="text-decoration:none; display:block;">
            <div style="width:44px; height:44px; margin:0 auto 8px; background:linear-gradient(135deg,#0f1f3d,#144a8f); border-radius:50%; text-align:center; line-height:44px;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
            <div style="font-size:11px; font-weight:700; color:#0f1f3d; text-transform:uppercase; letter-spacing:.04em;">Manage Booking</div>
            <div style="font-size:10px; color:#6b7280; margin-top:2px;">Modify or cancel</div>
          </a>
        </td>
      </tr>
    </table>
  </div>

  <!-- Brand Signature Block -->
  <div style="background:#0f1f3d; padding:28px 28px 24px; border-radius:0 0 8px 8px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Georgia,'Times New Roman',serif;">
      <tr>
        <td>
          <div style="font-size:28px; font-weight:700; letter-spacing:2px; color:#ffffff; line-height:1.1;">SILVER SERVICE</div>
          <div style="font-size:14px; font-weight:700; letter-spacing:4px; color:#d4a63c; margin-top:4px;">TAXI SYDNEY</div>
          <div style="margin:16px 0 14px; border-top:1px solid rgba(255,255,255,0.15);"></div>
          <table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif; font-size:12px; line-height:2.2; color:#d0d4dc;">
            <tr>
              <td style="padding-right:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4a63c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></td>
              <td><a href="https://silvertaxisydneyservice.com" style="color:#d4a63c; text-decoration:none; font-weight:700;">silvertaxisydneyservice.com</a></td>
            </tr>
            <tr>
              <td style="padding-right:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></td>
              <td><a href="tel:1800173171" style="color:#ffffff; text-decoration:none;">1800 173 171</a></td>
            </tr>
            <tr>
              <td style="padding-right:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></td>
              <td><a href="mailto:info@silvertaxisydneyservice.com" style="color:#ffffff; text-decoration:none;">info@silvertaxisydneyservice.com</a></td>
            </tr>
          </table>
          <div style="margin-top:16px; font-size:10px; color:rgba(255,255,255,0.5); line-height:1.6; font-family:Arial,sans-serif;">Premium Airport Transfers &bull; Executive Corporate Travel &bull; Luxury Chauffeur Service &bull; Fixed Price Rides &bull; 24/7 Australia Wide Service</div>
          <div style="margin-top:12px; font-size:9px; color:rgba(255,255,255,0.35); font-family:Arial,sans-serif;">Please retain this receipt for your records. This is a tax invoice.</div>
        </td>
      </tr>
    </table>
  </div>
</div>

</body></html>`;
}

function adminEmailHtml(b, fare, stripePayLink = null) {
  const puSub = shortAddr(b.pickup);
  const doSub = shortAddr(b.dropoff);
  return `<div style="font-family:Arial,sans-serif;font-size:13px;max-width:600px;margin:0 auto;">
<!-- Premium Header -->
<div style="background:linear-gradient(135deg,#0f1f3d 0%,#144a8f 100%);padding:20px 24px;border-radius:8px 8px 0 0;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td><span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:1px;">SILVER SERVICE</span><span style="color:#d4a63c;font-size:12px;font-weight:700;letter-spacing:2px;margin-left:8px;">TAXI</span></td>
      <td style="text-align:right;"><span style="color:#d4a63c;font-size:22px;font-weight:900;">$${fare.total.toFixed(2)}</span></td>
    </tr>
  </table>
  <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.15);">
    <span style="color:rgba(255,255,255,0.7);font-size:11px;text-transform:uppercase;letter-spacing:1px;">NEW BOOKING</span>
    <span style="color:#ffffff;font-size:16px;font-weight:700;display:block;margin-top:4px;">${puSub} → ${doSub}</span>
  </div>
</div>

<!-- Booking Details -->
<div style="background:#ffffff;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;">
  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#6b7280;width:130px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Ref</td><td style="padding:10px 12px;font-weight:bold;color:#144a8f;font-size:14px;">#${b.ref}</td></tr>
    <tr><td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Passenger</td><td style="padding:10px 12px;font-weight:bold;font-size:14px;">${b.name}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Phone</td><td style="padding:10px 12px;"><a href="tel:${b.phone}" style="color:#144a8f;text-decoration:none;font-weight:600;">${b.phone}</a></td></tr>
    <tr><td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Email</td><td style="padding:10px 12px;">${b.email || 'N/A'}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Vehicle</td><td style="padding:10px 12px;font-weight:600;">${b.vehicle}</td></tr>
  </table>

  <!-- Route -->
  <div style="margin:16px 0;padding:14px 16px;background:#f0f4ff;border-radius:6px;border-left:4px solid #144a8f;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Route</div>
    <div style="font-size:13px;color:#1f2937;line-height:1.6;">
      <strong style="color:#144a8f;">FROM:</strong> ${b.pickup}<br/>
      <strong style="color:#144a8f;">TO:</strong> ${b.dropoff}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Date &amp; Time</td><td style="padding:10px 12px;font-weight:700;">${b.date} at ${b.time}</td></tr>
    <tr><td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Distance</td><td style="padding:10px 12px;">${fare.km ? fare.km.toFixed(1) : '0.0'} km</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Payment</td><td style="padding:10px 12px;"><span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;${b.payment === 'Card (Online)' || b.stripePI ? 'background:#dcfce7;color:#16a34a;' : 'background:#fef3c7;color:#92400e;'}">${b.payment}</span></td></tr>
  </table>

  <!-- Fare Breakdown -->
  <div style="margin-top:16px;padding:14px 16px;background:#0f1f3d;border-radius:6px;">
    <table style="width:100%;border-collapse:collapse;color:#ffffff;font-size:12px;">
      ${fare.sub ? `<tr><td style="padding:4px 0;">Outbound Fare</td><td style="text-align:right;padding:4px 0;">$${fare.sub.toFixed(2)}</td></tr>` : ''}
      ${fare.tolls > 0 ? `<tr><td style="padding:4px 0;">Tolls</td><td style="text-align:right;padding:4px 0;">$${fare.tolls.toFixed(2)}</td></tr>` : ''}
      ${fare.returnSub ? `<tr><td style="padding:4px 0;">Return Fare (10% off)</td><td style="text-align:right;padding:4px 0;">$${fare.returnSub.toFixed(2)}</td></tr>` : ''}
      ${fare.returnTolls > 0 ? `<tr><td style="padding:4px 0;">Return Tolls</td><td style="text-align:right;padding:4px 0;">$${fare.returnTolls.toFixed(2)}</td></tr>` : ''}
      ${(fare.serviceFee || fare.cardFee) > 0 ? `<tr><td style="padding:4px 0;">Service Fee</td><td style="text-align:right;padding:4px 0;">$${(fare.serviceFee || fare.cardFee).toFixed(2)}</td></tr>` : ''}
      <tr style="border-top:1px solid rgba(255,255,255,0.2);"><td style="padding:8px 0 4px;font-size:15px;font-weight:700;color:#d4a63c;">TOTAL</td><td style="text-align:right;padding:8px 0 4px;font-size:15px;font-weight:900;color:#d4a63c;">$${fare.total.toFixed(2)} AUD</td></tr>
      <tr><td style="padding:2px 0;font-size:10px;color:rgba(255,255,255,0.5);">*INC. GST</td><td style="text-align:right;padding:2px 0;font-size:10px;color:rgba(255,255,255,0.5);">$${(fare.total / 11).toFixed(2)}</td></tr>
    </table>
  </div>

  ${b.returnTrip ? `<div style="margin-top:12px;padding:12px 16px;background:#f5f3ff;border-radius:6px;border-left:4px solid #7c3aed;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Return Trip</div>
    <div style="font-size:12px;color:#1f2937;line-height:1.6;">From: ${b.returnPickup || b.dropoff}<br/>To: ${b.returnDropoff || b.pickup}<br/>Date: ${b.returnDate} at ${b.returnTime}</div>
  </div>` : ''}
  ${b.stripePI ? `<div style="margin-top:8px;font-size:11px;color:#16a34a;">Stripe PI: ${b.stripePI}</div>` : ''}
  ${b.notes ? `<div style="margin-top:8px;padding:8px 12px;background:#fefce8;border-radius:4px;font-size:12px;color:#78350f;"><strong>Notes:</strong> ${b.notes}</div>` : ''}
</div>

<!-- Payment Action -->
${stripePayLink ? `<div style="padding:16px 24px;background:#f0fdf4;border:1px solid #e5e7eb;border-top:none;">
<div style="padding:14px 18px;background:#ffffff;border:2px solid #16a34a;border-radius:8px;text-align:center;">
<p style="margin:0 0 8px;font-weight:700;color:#14532d;font-size:14px;">Payment Link Ready</p>
<a href="${stripePayLink}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">PAY NOW — $${fare.total.toFixed(2)} AUD</a>
<p style="margin:10px 0 0;font-size:10px;color:#6b7280;word-break:break-all;">${stripePayLink}</p>
</div>
</div>` : `<div style="padding:16px 24px;background:#fffbeb;border:1px solid #e5e7eb;border-top:none;">
<div style="padding:14px 18px;background:#ffffff;border:1px solid #fbbf24;border-radius:8px;">
<p style="margin:0 0 8px;font-weight:700;color:#92400e;font-size:13px;">${b.payment !== 'Card (Online)' && !b.stripePI ? 'Cash / EFTPOS — Encourage Online Payment' : 'Payment Pending'}</p>
<a href="https://silvertaxisydneyservice.com/admin" style="display:inline-block;padding:10px 20px;background:#144a8f;color:#fff;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px;">Manage Booking</a>
</div>
</div>`}

<!-- Footer -->
<div style="padding:12px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;text-align:center;">
  <p style="margin:0;color:#9ca3af;font-size:10px;">Booked: ${b.created}</p>
</div>
</div>`;
}

// -------------------- Daily Security Report Scheduler --------------------
try {
  const cron = require('node-cron');
  const { sendReport } = require('./scripts/dailySecurityReport');
  // Run every day at 8:00am AEST (UTC+10 = 22:00 UTC previous day)
  cron.schedule('0 0 22 * * *', async () => {
    console.log('[Cron] Running daily security report...');
    try { await sendReport(); } catch(e) { console.error('[Cron] Report error:', e.message); }
  }, { timezone: 'UTC' });
  console.log('    Daily security report scheduled: 8am AEST daily');
} catch(e) {
  console.warn('   WARNING:  node-cron not available:', e.message);
}

// -------------------- GitHub Webhook Auto-Deploy --------------------
app.post('/api/deploy', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-hub-signature-256'] || '';
  const secret = process.env.WEBHOOK_SECRET || 'springwood-deploy-2026';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(req.body);
  const digest = 'sha256=' + hmac.digest('hex');
  let valid = false;
  try { valid = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig)); } catch {}
  if (!valid) { return res.status(401).send('Unauthorized'); }
  let payload;
  try { payload = JSON.parse(req.body.toString()); } catch { return res.status(400).send('Bad JSON'); }
  const branch = (payload.ref || '').replace('refs/heads/', '');
  if (branch !== 'master') { return res.status(200).send('Skipped'); }
  const { exec } = require('child_process');
  const deployCmd = `export PATH=/opt/alt/alt-nodejs20/root/bin:$PATH && cd /home/u848559930/domains/silvertaxisydneyservice.com/nodejs && git pull origin master 2>&1 && npm install --production 2>&1 | tail -3 && touch tmp/restart.txt && echo done`;
  exec(deployCmd, { timeout: 120000 }, (err, stdout) => {
    if (err) { console.error('[Deploy]', err.message); return res.status(500).send('Failed'); }
    console.log('[Deploy] silvertaxisydneyservice.com:', stdout.trim());
    res.status(200).send('Deployed');
  });
  res.status(200).send('Deploying...');
});

// -------------------- Start --------------------
app.listen(+CFG.PORT, () => {
  console.log(`\n Silver Taxi Sydney Service v2.0 running on port ${CFG.PORT}`);
  console.log(`   Health: http://localhost:${CFG.PORT}/api/health`);
  console.log(`   Admin:  http://localhost:${CFG.PORT}/admin\n`);
});

// -------------------- Twilio IVR API Endpoints --------------------

// GET /api/check-hours - Check if business is open (24/7 for Silver Taxi Sydney)
app.get('/api/check-hours', (req, res) => {
  // Silver Taxi Sydney is a 24/7 service
  res.json({ open: true, message: 'Silver Taxi Sydney is open 24/7' });
});

// POST /api/verify-location - Verify address with Google Maps
app.post('/api/verify-location', async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ success: false, error: 'No address provided' });

  try {
    const MAPS_KEY = CFG.MAPS_KEY || process.env.MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', NSW, Australia')}&key=${MAPS_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      res.json({
        success: true,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted: result.formatted_address
      });
    } else {
      res.json({ success: false, error: 'Location not found' });
    }
  } catch (e) {
    console.error('[IVR] Location verification error:', e.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// -------------------- Deploy V2 (Token-based, fixes git remote) --------------------
app.post('/api/deploy-v2', (req, res) => {
  const token = req.headers['x-deploy-token'] || req.query.token || '';
  const secret = process.env.WEBHOOK_SECRET || 'springwood-deploy-2026';
  if (token !== secret) { return res.status(401).send('Unauthorized'); }
  const { exec } = require('child_process');
  const deployPath = '/home/u848559930/domains/silvertaxisydneyservice.com/nodejs';
  const deployCmd = [
    'export PATH=/opt/alt/alt-nodejs20/root/bin:/usr/bin:$PATH',
    `cd ${deployPath}`,
    'git remote set-url origin https://github.com/springwoodtaxis-arch/silver-taxi-sydney.git',
    'git fetch origin master 2>&1',
    'git reset --hard origin/master 2>&1',
    'npm install --production 2>&1 | tail -3',
    'touch tmp/restart.txt 2>/dev/null || true',
    'echo DEPLOY_DONE'
  ].join(' && ');
  res.status(200).send('Deploying v2...');
  exec(deployCmd, { timeout: 180000 }, (err, stdout, stderr) => {
    if (err) { console.error('[Deploy-V2] Error:', err.message, stderr); return; }
    console.log('[Deploy-V2] Done:', stdout.trim());
  });
});
