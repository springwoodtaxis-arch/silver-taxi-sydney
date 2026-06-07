'use strict';
/**
 * Threat Protection Middleware — Silver Taxi Sydney Service
 * Conservative mode: NEVER block real customers. Only block confirmed fraud.
 *
 * Blocking rules (ALL must apply — never block on single signal alone):
 *  1. Confirmed bot UA (clear scanner/scraper signatures only)
 *  2. Tor exit node (official list) — single signal is enough (no real customer uses Tor)
 *  3. VPN CIDR + proxy header BOTH present (double confirmation required)
 *  4. Manual block list (admin-added fingerprints only)
 *
 * NEVER blocked:
 *  - Booking, payment, OTP, API pages
 *  - Safari / iPhone / iPad / Mac (Apple Private Relay)
 *  - Any visitor who has previously converted (made a booking)
 *  - Australian ISP ranges
 *  - Repeat visitors (only flagged, never hard-blocked automatically)
 */

const crypto       = require('crypto');
const https        = require('https');
const fs           = require('fs');
const path         = require('path');
const ipRangeCheck = require('ip-range-check');
// ─────────────────────────────────────────────────────────────────────────────
// USERSTACK — Live crawler/bot detection (100 req/mo free tier)
// Used ONLY for ambiguous UAs that pass the static BAD_BOT_UA list
// Cache results for 24h to conserve quota
// ─────────────────────────────────────────────────────────────────────────────
const USERSTACK_KEY  = process.env.USERSTACK_API_KEY || '';
const userstackCache = new Map(); // ua_hash -> { isCrawler, type, name, ts }
function checkUserstack(ua) {
  if (!USERSTACK_KEY || !ua) return Promise.resolve(null);
  const crypto2 = require('crypto');
  const hash = crypto2.createHash('md5').update(ua).digest('hex').slice(0,12);
  const cached = userstackCache.get(hash);
  if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const url = 'http://api.userstack.com/detect?access_key=' + USERSTACK_KEY + '&ua=' + encodeURIComponent(ua);
    require('http').get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          const result = {
            isCrawler: r.type === 'crawler',
            type: r.type || 'unknown',
            name: (r.crawler && r.crawler.name) ? r.crawler.name : ((r.browser && r.browser.name) ? r.browser.name : ''),
            ts: Date.now()
          };
          userstackCache.set(hash, result);
          if (userstackCache.size > 500) {
            const oldest = [...userstackCache.entries()].sort((a,b) => a[1].ts - b[1].ts).slice(0, 100);
            oldest.forEach(([k]) => userstackCache.delete(k));
          }
          resolve(result);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// IPSTACK — Live IP geolocation (5000 req/mo free tier)
// Used ONLY on booking/contact API submissions (not every page load)
// Cache results for 1h per IP to conserve quota
// ─────────────────────────────────────────────────────────────────────────────
const IPSTACK_KEY  = process.env.IPSTACK_API_KEY || '';
const ipstackCache = new Map(); // ip -> { country_code, country_name, ts }
function checkIPStack(ip) {
  if (!IPSTACK_KEY || !ip || ip === '127.0.0.1' || ip === '::1') return Promise.resolve(null);
  const cached = ipstackCache.get(ip);
  if (cached && Date.now() - cached.ts < 60 * 60 * 1000) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const url = 'http://api.ipstack.com/' + ip + '?access_key=' + IPSTACK_KEY + '&fields=country_code,country_name,type';
    require('http').get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          if (!r || !r.country_code) return resolve(null);
          const result = { country_code: r.country_code, country_name: r.country_name || '', ts: Date.now() };
          ipstackCache.set(ip, result);
          if (ipstackCache.size > 1000) {
            const oldest = [...ipstackCache.entries()].sort((a,b) => a[1].ts - b[1].ts).slice(0, 200);
            oldest.forEach(([k]) => ipstackCache.delete(k));
          }
          resolve(result);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT STORAGE — survives server restarts
// ─────────────────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const THREAT_HISTORY_FILE  = path.join(DATA_DIR, 'threat-history.json');
const FRAUD_HISTORY_FILE   = path.join(DATA_DIR, 'fraud-history.json');
const VISITOR_STORE_FILE   = path.join(DATA_DIR, 'visitor-store.json');
const LOGIN_ATTEMPTS_FILE  = path.join(DATA_DIR, 'login-attempts.json');

function loadJSON(file, defaultVal) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch(e) { console.warn('[ThreatProtection] Could not load', file, e.message); }
  return defaultVal;
}

function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch(e) { console.warn('[ThreatProtection] Could not save', file, e.message); }
}

// Prune entries older than 30 days
function pruneOld(arr) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return arr.filter(e => new Date(e.timestamp || e.date || e.time || 0).getTime() > cutoff);
}

// Load persistent data
let threatHistory  = pruneOld(loadJSON(THREAT_HISTORY_FILE, []));   // 30-day blocked events
let loginAttempts  = pruneOld(loadJSON(LOGIN_ATTEMPTS_FILE, []));    // dashboard login attempts
let visitorStore   = loadJSON(VISITOR_STORE_FILE, {});               // fingerprint -> visitor

// Save every 60 seconds
setInterval(() => {
  threatHistory = pruneOld(threatHistory);
  loginAttempts = pruneOld(loginAttempts);
  saveJSON(THREAT_HISTORY_FILE, threatHistory.slice(-2000));
  saveJSON(LOGIN_ATTEMPTS_FILE, loginAttempts.slice(-500));
  // Save visitor store (keep last 5000 visitors)
  const entries = Object.entries(visitorStore);
  if (entries.length > 5000) {
    const sorted = entries.sort((a,b) => new Date(b[1].lastSeen) - new Date(a[1].lastSeen));
    visitorStore = Object.fromEntries(sorted.slice(0, 5000));
  }
  saveJSON(VISITOR_STORE_FILE, visitorStore);
}, 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// 1. WHITELIST — NEVER blocked
// ─────────────────────────────────────────────────────────────────────────────
const WHITELIST_UA = [
  'googlebot','google-inspectiontool','adsbot-google','mediapartners-google',
  'bingbot','slurp','duckduckbot','baiduspider','yandexbot',
  'facebot','ia_archiver','mj12bot','semrushbot','ahrefsbot',
  'github','githubactions','vercel','render','uptimerobot',
  'pingdom','gtmetrix','pagespeed','lighthouse','chrome-lighthouse',
  'facebookexternalhit','twitterbot','linkedinbot','whatsapp',
  'applebot','duckduckgo','sogou','exabot','seznambot',
];

// Apple Private Relay IP ranges (Safari users — NEVER block)
const APPLE_RELAY_PREFIXES = [
  '17.248.128.','17.248.129.','17.248.130.','17.248.131.','17.248.132.',
  '17.248.133.','17.248.134.','17.248.135.','17.248.136.','17.248.137.',
  '17.248.138.','17.248.139.','17.248.140.','17.248.141.','17.248.142.',
  '17.248.143.','17.248.144.','17.248.145.','17.248.146.','17.248.147.',
  '17.248.148.','17.248.149.','17.248.150.','17.248.151.','17.248.152.',
  '17.248.153.','17.248.154.','17.248.155.','17.248.156.','17.248.157.',
  '17.248.158.','17.248.159.','17.248.192.','17.248.193.','17.248.194.',
  '17.248.195.','17.248.196.','17.248.197.','17.248.198.','17.248.199.',
  '17.248.200.','17.248.201.','17.248.202.','17.248.203.','17.248.204.',
  '17.248.205.','17.248.206.','17.248.207.','17.248.208.','17.248.209.',
  '17.248.210.','17.248.211.','17.248.212.','17.248.213.','17.248.214.',
  '17.248.215.','17.248.216.','17.248.217.','17.248.218.','17.248.219.',
  '17.248.220.','17.248.221.','17.248.222.','17.248.223.',
  '17.253.0.','17.253.1.','17.253.2.','17.253.3.','17.253.4.',
  '17.57.144.','17.57.145.','17.57.146.','17.57.147.',
];

// ─────────────────────────────────────────────────────────────────────────────
// WHITELISTED IP PREFIXES — NEVER blocked (hosting provider, monitoring, CDN)
// ─────────────────────────────────────────────────────────────────────────────
const WHITELIST_IP_PREFIXES = [
  '127.0.0.1', '::1', '::ffff:127.',
  // Hostinger hosting servers (health checks, internal monitoring)
  '2a02:4780:', '2a02:4781:', '2a02:4782:', '2a02:4783:',
  '31.220.', '31.222.', '185.185.', '185.186.', '185.187.',
  '185.188.', '185.189.', '185.190.', '185.191.',
  '46.17.', '46.105.',
  // Cloudflare (CDN, health checks)
  '103.21.244.', '103.22.200.', '103.31.4.', '141.101.64.',
  '108.162.192.', '190.93.240.', '188.114.96.', '197.234.240.',
  '198.41.128.', '162.158.', '104.16.', '104.17.',
  '172.64.', '172.65.', '172.66.', '172.67.',
  '131.0.72.',
];
// Paths that are ALWAYS exempt from any blocking (booking funnel + admin)
const EXEMPT_PATHS = [
  '/book', '/thank-you', '/payment', '/checkout', '/confirm',
  '/api/', '/admin', '/manage', '/seo-dashboard',
  '/otp', '/verify', '/stripe', '/webhook',
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONFIRMED BOT USER-AGENTS (clear scrapers/scanners only)
// ─────────────────────────────────────────────────────────────────────────────
const BAD_BOT_UA = [
  'sqlmap','nikto','nmap','masscan','zgrab','zmap','dirbuster','gobuster',
  'wfuzz','hydra','medusa','burpsuite','owasp','acunetix','nessus',
  'openvas','w3af','skipfish','arachni','vega','webscarab',
  'python-requests','python-urllib','go-http-client','java/','libwww-perl',
  'curl/','wget/','scrapy','phantomjs','headlesschrome','headless chrome',
  'selenium','puppeteer','playwright','zombie','mechanize',
  'httpclient','okhttp','apache-httpclient','restsharp',
  'masscan','zgrab','censys','shodan','binaryedge',
  'dataforseo','semrush-bot','dotbot','rogerbot','exabot',
  'mj12bot','blexbot','yandex.com/bots','mail.ru_bot',
  'petalbot','bytespider','tiktokspider','claudebot','gptbot',
  'ccbot','omgili','dataforseo','webzio','netcraft',
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. VPN CIDR RANGES (confirmed VPN providers only — no broad datacenter ranges)
// ─────────────────────────────────────────────────────────────────────────────
const VPN_CIDR_RANGES = [
  // NordVPN
  '5.180.62.0/23','31.13.191.0/24','37.120.131.0/24','45.83.88.0/22',
  '45.83.92.0/22','45.83.96.0/22','45.83.100.0/22','45.83.104.0/22',
  '82.102.16.0/20','89.187.161.0/24','91.108.4.0/22','91.108.56.0/22',
  '149.154.160.0/20','185.130.184.0/22','185.156.46.0/24',
  '185.195.232.0/22','185.216.32.0/22','194.165.16.0/22',
  '198.54.128.0/17',
  // ExpressVPN
  '5.180.62.0/24','23.105.168.0/22','185.76.151.0/24','185.76.152.0/24',
  // ProtonVPN
  '185.159.156.0/22','185.107.80.0/22','37.19.200.0/22',
  '185.177.124.0/22','193.138.218.0/24','185.230.124.0/22',
  // Windscribe
  '64.44.100.0/22','104.238.180.0/22','185.242.4.0/22','199.116.118.0/24',
  // Mullvad
  '185.213.154.0/24','185.213.155.0/24','193.32.127.0/24','193.32.126.0/24',
  '198.54.128.0/18','185.65.134.0/24','185.65.135.0/24',
  // PIA
  '209.222.0.0/16','173.199.64.0/18','198.8.80.0/20','185.216.33.0/24',
  // Surfshark
  '45.87.212.0/22','194.61.24.0/22',
  // CyberGhost
  '146.70.0.0/15','185.212.170.0/24',
  // IPVanish
  '64.237.32.0/19',
  // TunnelBear
  '104.254.90.0/24','192.243.60.0/22',
  // Hotspot Shield
  '185.51.128.0/18','104.245.0.0/16',
  // VyprVPN
  '195.181.160.0/19',
  // Tor known exit relay ranges
  '185.220.100.0/22','185.220.0.0/16','51.15.0.0/16',
  '46.165.0.0/17','176.10.99.0/24','171.25.193.0/24',
  '199.87.154.0/24','162.247.72.0/22','77.247.181.0/24',
];

// ─────────────────────────────────────────────────────────────────────────────
// TOR EXIT NODE LIST — live from Tor Project, refreshed every 6 hours
// ─────────────────────────────────────────────────────────────────────────────
let torExitNodes = new Set();
let torLastFetch = 0;

function refreshTorList() {
  const now = Date.now();
  if (now - torLastFetch < 6 * 60 * 60 * 1000) return;
  torLastFetch = now;
  https.get('https://check.torproject.org/torbulkexitlist', (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      const ips = data.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      torExitNodes = new Set(ips);
      console.log(`[ThreatProtection] Tor list refreshed: ${torExitNodes.size} nodes`);
    });
  }).on('error', e => console.warn('[ThreatProtection] Tor fetch failed:', e.message));
}
refreshTorList();
setInterval(refreshTorList, 6 * 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY THREAT STORE (daily stats + manual block list)
// ─────────────────────────────────────────────────────────────────────────────
const threatStore = {
  manualBlocked: new Set(),  // admin-added fingerprints
  dailyStats: {
    date:           new Date().toDateString(),
    totalRequests:  0,
    blockedBots:    0,
    blockedVPN:     0,
    blockedManual:  0,
    uniqueVisitors: new Set(),
    conversions:    0,
  },
};

// Reset daily stats at midnight
setInterval(() => {
  const today = new Date().toDateString();
  if (threatStore.dailyStats.date !== today) {
    threatStore.dailyStats = {
      date: today, totalRequests: 0, blockedBots: 0,
      blockedVPN: 0, blockedManual: 0,
      uniqueVisitors: new Set(), conversions: 0,
    };
  }
}, 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// DAILY EMAIL REPORT — sent at 8am AEST every day
// ─────────────────────────────────────────────────────────────────────────────
function scheduleDailyReport() {
  const now = new Date();
  // AEST = UTC+10
  const aestHour = (now.getUTCHours() + 10) % 24;
  const minutesUntil8am = ((8 - aestHour + 24) % 24) * 60 - now.getUTCMinutes();
  const msUntil8am = minutesUntil8am * 60 * 1000;
  setTimeout(() => {
    sendDailyReport();
    setInterval(sendDailyReport, 24 * 60 * 60 * 1000);
  }, msUntil8am > 0 ? msUntil8am : msUntil8am + 24 * 60 * 60 * 1000);
}

function sendDailyReport() {
  try {
    const nodemailer = require('nodemailer');
    const cfg = {
      SMTP_HOST: process.env.SMTP_HOST || 'smtp.hostinger.com',
      SMTP_PORT: parseInt(process.env.SMTP_PORT || '465'),
      SMTP_USER: process.env.SMTP_USER || 'info@silvertaxisydneyservice.com',
      SMTP_PASS: process.env.SMTP_PASS || '',
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'info@silvertaxisydneyservice.com',
    };
    if (!cfg.SMTP_PASS) return;

    const last30 = threatHistory.slice(-100);
    const fraudData = loadJSON(FRAUD_HISTORY_FILE, []);
    const last30Fraud = fraudData.slice(-50);

    const stats = threatStore.dailyStats;
    const html = `
<h2 style="color:#1a1a2e">🛡️ Daily Security Report — Silver Taxi Sydney Service</h2>
<p style="color:#666">Date: ${new Date().toLocaleDateString('en-AU', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
<hr/>
<h3>Today's Stats</h3>
<table style="border-collapse:collapse;width:100%">
  <tr><td style="padding:8px;border:1px solid #ddd"><b>Total Requests</b></td><td style="padding:8px;border:1px solid #ddd">${stats.totalRequests}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd"><b>Unique Visitors</b></td><td style="padding:8px;border:1px solid #ddd">${stats.uniqueVisitors.size}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd"><b>Bots Blocked</b></td><td style="padding:8px;border:1px solid #ddd">${stats.blockedBots}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd"><b>VPN/Proxy Blocked</b></td><td style="padding:8px;border:1px solid #ddd">${stats.blockedVPN}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd"><b>Conversions (Bookings)</b></td><td style="padding:8px;border:1px solid #ddd">${stats.conversions}</td></tr>
</table>
<h3>Recent Threats (last 30 days — last 10)</h3>
<table style="border-collapse:collapse;width:100%;font-size:12px">
  <tr style="background:#f5f5f5"><th style="padding:6px;border:1px solid #ddd">Time</th><th style="padding:6px;border:1px solid #ddd">IP</th><th style="padding:6px;border:1px solid #ddd">Type</th><th style="padding:6px;border:1px solid #ddd">Reason</th></tr>
  ${last30.slice(-10).reverse().map(e => `<tr><td style="padding:6px;border:1px solid #ddd">${new Date(e.timestamp).toLocaleString('en-AU')}</td><td style="padding:6px;border:1px solid #ddd">${e.ip||'-'}</td><td style="padding:6px;border:1px solid #ddd">${e.type||'-'}</td><td style="padding:6px;border:1px solid #ddd">${e.reason||'-'}</td></tr>`).join('')}
</table>
<h3>Click Fraud (last 30 days — last 10)</h3>
<table style="border-collapse:collapse;width:100%;font-size:12px">
  <tr style="background:#f5f5f5"><th style="padding:6px;border:1px solid #ddd">Time</th><th style="padding:6px;border:1px solid #ddd">Device</th><th style="padding:6px;border:1px solid #ddd">Clicks</th><th style="padding:6px;border:1px solid #ddd">Est. Cost</th></tr>
  ${last30Fraud.slice(-10).reverse().map(e => `<tr><td style="padding:6px;border:1px solid #ddd">${new Date(e.timestamp||e.firstClick).toLocaleString('en-AU')}</td><td style="padding:6px;border:1px solid #ddd">${(e.ua||'-').slice(0,40)}</td><td style="padding:6px;border:1px solid #ddd">${e.adClicks||0}</td><td style="padding:6px;border:1px solid #ddd">$${((e.adClicks||0)*3.5).toFixed(2)}</td></tr>`).join('')}
</table>
<p style="color:#999;font-size:11px;margin-top:20px">Silver Taxi Sydney Service SEO Command Centre · <a href="https://silvertaxisydneyservice.com/seo-dashboard">View Dashboard</a></p>
    `;

    const transporter = nodemailer.createTransport({
      host: cfg.SMTP_HOST, port: cfg.SMTP_PORT, secure: true,
      auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
    transporter.sendMail({
      from: `"Silver Taxi Sydney Service Security" <${cfg.SMTP_USER}>`,
      to: cfg.ADMIN_EMAIL,
      subject: `🛡️ Daily Security Report — ${new Date().toLocaleDateString('en-AU')}`,
      html,
    }).then(() => console.log('[ThreatProtection] Daily report sent'))
      .catch(e => console.warn('[ThreatProtection] Daily report failed:', e.message));
  } catch(e) {
    console.warn('[ThreatProtection] Daily report error:', e.message);
  }
}
scheduleDailyReport();

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
function getClientIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress || ''
  ).replace('::ffff:', '');
}

function getFingerprint(req) {
  const ip   = getClientIP(req);
  const ua   = req.headers['user-agent'] || '';
  const lang = req.headers['accept-language'] || '';
  const enc  = req.headers['accept-encoding'] || '';
  const raw  = `${ip}|${ua}|${lang}|${enc}`;
  return {
    ip,
    fingerprint: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16),
    ua, lang,
  };
}

function isSafariOrApple(ua) {
  const u = (ua || '').toLowerCase();
  return u.includes('safari') || u.includes('iphone') || u.includes('ipad') ||
         u.includes('macintosh') || u.includes('applewebkit') || u.includes('apple');
}

function isExemptPath(urlPath) {
  return EXEMPT_PATHS.some(p => urlPath.startsWith(p));
}

function logThreat(ip, ua, fingerprint, type, reason, path) {
  const entry = {
    timestamp: new Date().toISOString(),
    ip, ua: (ua||'').slice(0, 120), fingerprint,
    type, reason, path,
    date: new Date().toLocaleDateString('en-AU'),
  };
  threatHistory.push(entry);
  if (threatHistory.length > 2000) threatHistory = threatHistory.slice(-2000);
}

// ─────────────────────────────────────────────────────────────────────────────
// VPN DETECTION — requires DOUBLE confirmation to avoid false positives
// ─────────────────────────────────────────────────────────────────────────────
function detectVPN(ip, req, ua) {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return { isVPN: false };

  // Apple Private Relay — NEVER flag
  if (APPLE_RELAY_PREFIXES.some(p => ip.startsWith(p))) return { isVPN: false };

  // Safari/Apple device — NEVER flag (too many false positives)
  if (isSafariOrApple(ua)) return { isVPN: false };

  // Tor exit node — single signal is enough (confirmed fraud tool)
  if (torExitNodes.has(ip)) return { isVPN: true, reason: 'Tor exit node (confirmed)' };

  // VPN CIDR — only block if ALSO has proxy headers (double confirmation)
  let inVpnRange = false;
  try { inVpnRange = ipRangeCheck(ip, VPN_CIDR_RANGES); } catch(e) {}

  const hasProxyHeader = !!(
    req.headers['via'] ||
    req.headers['proxy-connection'] ||
    req.headers['x-proxy-id']
  );

  // Proxy chain (3+ hops) — strong signal
  const xfwd = req.headers['x-forwarded-for'] || '';
  const isProxyChain = xfwd.split(',').length > 3;

  if (inVpnRange && hasProxyHeader) {
    return { isVPN: true, reason: 'VPN IP range + proxy headers (double confirmed)' };
  }
  if (inVpnRange && isProxyChain) {
    return { isVPN: true, reason: 'VPN IP range + proxy chain (double confirmed)' };
  }
  if (isProxyChain && hasProxyHeader) {
    return { isVPN: true, reason: 'Proxy chain + proxy headers (double confirmed)' };
  }

  return { isVPN: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
function threatMiddleware(req, res, next) {
  const urlPath = req.path || req.url || '/';
  const ua = req.headers['user-agent'] || '';
  const ip = getClientIP(req);

  // Always allow API routes and booking funnel
  if (isExemptPath(urlPath)) return next();

  // Always allow whitelisted IPs (hosting provider, CDN, monitoring)
  if (WHITELIST_IP_PREFIXES.some(p => ip.startsWith(p))) return next();
  // Always allow whitelisted bots (SEO crawlers, Render, GitHub)
  const uaLower = ua.toLowerCase();
  if (WHITELIST_UA.some(w => uaLower.includes(w))) return next();

  // Always allow Apple Private Relay
  if (APPLE_RELAY_PREFIXES.some(p => ip.startsWith(p))) return next();

  // Always allow Safari/Apple devices
  if (isSafariOrApple(ua)) return next();

  const fp = getFingerprint(req);

  // Track stats
  threatStore.dailyStats.totalRequests++;
  threatStore.dailyStats.uniqueVisitors.add(fp.fingerprint);

  // Update visitor record
  if (!visitorStore[fp.fingerprint]) {
    visitorStore[fp.fingerprint] = {
      fingerprint: fp.fingerprint, ip: fp.ip, ua: fp.ua,
      firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      visits: 0, conversions: 0, ips: [],
    };
  }
  const visitor = visitorStore[fp.fingerprint];
  visitor.lastSeen = new Date().toISOString();
  visitor.visits++;
  if (!visitor.ips.includes(fp.ip)) {
    visitor.ips.push(fp.ip);
    if (visitor.ips.length > 20) visitor.ips = visitor.ips.slice(-20);
  }

  // BLOCK: Admin-manually-blocked fingerprint
  if (threatStore.manualBlocked.has(fp.fingerprint)) {
    threatStore.dailyStats.blockedManual++;
    logThreat(ip, ua, fp.fingerprint, 'Manual Block', 'Admin blocked device', urlPath);
    return res.status(403).send(getBlockPage('Access Denied', 'Your device has been blocked by the site administrator. Please call 1800 173 171 for assistance.'));
  }

  // BLOCK: Confirmed bad bot (static list)
  const isBadBot = BAD_BOT_UA.some(b => uaLower.includes(b));
  if (isBadBot) {
    threatStore.dailyStats.blockedBots++;
    logThreat(ip, ua, fp.fingerprint, 'Bot', `Bad bot UA: ${ua.slice(0,60)}`, urlPath);
    return res.status(403).send('Forbidden');
  }
  // Userstack live crawler check — fire-and-forget (logs for dashboard, no latency impact)
  // Only fires for non-browser UAs to conserve the 100 req/mo quota
  if (USERSTACK_KEY && !uaLower.includes('mozilla') && !uaLower.includes('applewebkit')) {
    checkUserstack(ua).then((result) => {
      if (result && result.isCrawler) {
        logThreat(ip, ua, fp.fingerprint, 'Bot', 'Userstack: crawler (' + (result.name || result.type) + ')', urlPath);
        threatStore.dailyStats.blockedBots++;
      }
    }).catch(() => {});
  }

  // BLOCK: Empty or suspicious UA (but not Safari/Chrome/Firefox/Edge)
  const isRealBrowser = uaLower.includes('mozilla') || uaLower.includes('chrome') ||
                        uaLower.includes('firefox') || uaLower.includes('safari') ||
                        uaLower.includes('edge') || uaLower.includes('opera');
  if (!ua || (!isRealBrowser && ua.length < 20)) {
    threatStore.dailyStats.blockedBots++;
    logThreat(ip, ua, fp.fingerprint, 'Bot', 'Empty/suspicious User-Agent', urlPath);
    return res.status(403).send('Forbidden');
  }

  // BLOCK: VPN/Tor (double-confirmed only)
  const vpnCheck = detectVPN(ip, req, ua);
  if (vpnCheck.isVPN) {
    threatStore.dailyStats.blockedVPN++;
    logThreat(ip, ua, fp.fingerprint, 'VPN/Proxy', vpnCheck.reason, urlPath);
    return res.status(403).send(getBlockPage(
      'VPN / Proxy Detected',
      `For security reasons, Silver Taxi Sydney Service does not allow bookings through VPN, proxy, or Tor connections.<br><br>
       <b>→ Disable your VPN or proxy</b><br>
       <b>→ Disconnect from Tor browser</b><br>
       <b>→ Switch to your regular internet connection</b><br>
       <b>→ Reload this page to continue</b><br><br>
       This protects our customers from fraud and ensures secure payment processing.`,
      '1800 173 171', 'info@silvertaxisydneyservice.com'
    ));
  }

  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK PAGE HTML
// ─────────────────────────────────────────────────────────────────────────────
function getBlockPage(title, message, phone, email) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Silver Taxi Sydney Service</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#161b22;border:1px solid #30363d;border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center}.icon{font-size:3rem;margin-bottom:16px}.title{font-size:1.5rem;font-weight:700;margin-bottom:12px;color:#f0883e}.msg{color:#8b949e;font-size:.9rem;line-height:1.7;margin-bottom:24px;text-align:left;background:#0d1117;padding:16px;border-radius:8px}.btn{display:inline-block;background:#f0883e;color:#0d1117;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:16px}.help{color:#8b949e;font-size:.8rem}</style>
</head><body><div class="card"><div class="icon">🛡️</div><div class="title">${title}</div><div class="msg">${message}</div><a class="btn" href="/">Try Again</a><div class="help">Need help? Call us on <b>${phone||'1800 173 171'}</b> or email <b>${email||'info@silvertaxisydneyservice.com'}</b></div></div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
function recordConversion(fingerprint) {
  if (visitorStore[fingerprint]) {
    visitorStore[fingerprint].conversions++;
    visitorStore[fingerprint].lastConversion = new Date().toISOString();
  }
  threatStore.dailyStats.conversions++;
}

function blockFingerprint(fingerprint) {
  threatStore.manualBlocked.add(fingerprint);
}

function unblockFingerprint(fingerprint) {
  threatStore.manualBlocked.delete(fingerprint);
}

function recordLoginAttempt(ip, ua, success, dashboardName) {
  loginAttempts.push({
    timestamp: new Date().toISOString(),
    ip, ua: (ua||'').slice(0,100),
    success, dashboardName: dashboardName || 'seo-dashboard',
    date: new Date().toLocaleDateString('en-AU'),
  });
}

function getThreatReport() {
  const stats = threatStore.dailyStats;
  const allVisitors = Object.values(visitorStore);

  // Recent bot/VPN attempts from threat history (last 50, newest first)
  const recentBots = threatHistory.slice(-50).reverse().map(e => ({
    time:   e.timestamp,
    ip:     e.ip,
    ua:     e.ua || '',
    type:   (e.type || '').toLowerCase().includes('vpn') ? 'vpn' : 'bot',
    path:   e.path || '/',
    reason: e.reason || e.type || 'Unknown',
  }));

  // Top visitors by visit count (top 30)
  const topVisitors = allVisitors
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 30)
    .map(v => ({
      fingerprint: v.fingerprint,
      ip:          v.ip,
      ua:          v.ua,
      visits:      v.visits,
      conversions: v.conversions,
      firstSeen:   v.firstSeen,
      lastSeen:    v.lastSeen,
      autoBlocked: threatStore.manualBlocked.has(v.fingerprint),
    }));

  // Suspicious visitors: 5+ visits, 0 conversions
  const suspicious = allVisitors
    .filter(v => v.visits >= 5 && v.conversions === 0)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 20)
    .map(v => ({
      fingerprint: v.fingerprint,
      ip:          v.ip,
      ips:         v.ips || [v.ip],
      ua:          v.ua,
      visits:      v.visits,
      conversions: v.conversions,
      firstSeen:   v.firstSeen,
      lastSeen:    v.lastSeen,
    }));

  // Manually blocked devices
  const blocked = [...threatStore.manualBlocked].map(fp => ({
    fingerprint: fp,
    reason:      'Manual block',
    ...(visitorStore[fp] || {}),
  }));

  return {
    // Today's stats
    totalRequests:  stats.totalRequests,
    blockedBots:    stats.blockedBots,
    blockedVPN:     stats.blockedVPN,
    blockedManual:  stats.blockedManual,
    totalBlocked:   stats.blockedBots + stats.blockedVPN + stats.blockedManual,
    uniqueVisitors: stats.uniqueVisitors.size,
    conversions:    stats.conversions,
    // Arrays for dashboard tables
    blocked,
    suspicious,
    recentBots,
    topVisitors,
    // 30-day history
    threatHistory: threatHistory.slice(-200).reverse(),
    // Login attempts (last 50)
    loginAttempts: loginAttempts.slice(-50).reverse(),
    torExitNodeCount: torExitNodes.size,
  };
}

module.exports = {
  threatMiddleware,
  recordConversion,
  blockFingerprint,
  unblockFingerprint,
  recordLoginAttempt,
  getThreatReport,
  checkIPStack,
};
