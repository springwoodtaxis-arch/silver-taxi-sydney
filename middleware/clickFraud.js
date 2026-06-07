'use strict';
/**
 * Click Fraud Detection — Silver Taxi Sydney Service
 * ClickGuard/ClickCease-level protection built in-house.
 *
 * Features:
 *  - Device fingerprinting (server-side + client canvas/WebGL signals)
 *  - IP exclusion list management (Google Ads CSV export)
 *  - Risk scoring (0-100) per device
 *  - VPN/datacenter IP detection
 *  - Configurable fraud thresholds
 *  - 30-day persistent history
 *  - Auto-block on threshold breach
 *  - Manual IP block/unblock with reason
 *  - Daily spend waste tracking
 */
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// PERSISTENT STORAGE
const DATA_DIR           = path.join(__dirname, '..', 'data');
const FRAUD_HISTORY_FILE = path.join(DATA_DIR, 'fraud-history.json');
const CLICK_LOG_FILE     = path.join(DATA_DIR, 'click-log.json');
const IP_BLOCK_FILE      = path.join(DATA_DIR, 'ip-blocklist.json');
const FRAUD_CONFIG_FILE  = path.join(DATA_DIR, 'fraud-config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { console.warn('[ClickFraud] Could not load', file, e.message); }
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch(e) { console.warn('[ClickFraud] Could not save', file, e.message); }
}
function pruneOld(arr, days) {
  days = days || 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return arr.filter(function(e) { return new Date(e.timestamp || e.firstSeen || 0).getTime() > cutoff; });
}

// Load persistent data
let deviceStore = loadJSON(FRAUD_HISTORY_FILE, {});
let clickLog    = pruneOld(loadJSON(CLICK_LOG_FILE, []));
let ipBlocklist = loadJSON(IP_BLOCK_FILE, {});

// Fraud configuration (user-configurable from dashboard)
let fraudConfig = Object.assign({
  clickThreshold:   3,
  costPerClick:     3.50,
  autoBlock:        true,
  alertEmail:       true,
  vpnBlock:         false,
  minClickInterval: 0,
}, loadJSON(FRAUD_CONFIG_FILE, {}));

// Save every 60 seconds
setInterval(function() {
  clickLog = pruneOld(clickLog);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [fp, dev] of Object.entries(deviceStore)) {
    if (new Date(dev.lastSeen || 0).getTime() < cutoff) delete deviceStore[fp];
  }
  saveJSON(FRAUD_HISTORY_FILE, deviceStore);
  saveJSON(CLICK_LOG_FILE, clickLog.slice(-5000));
  saveJSON(IP_BLOCK_FILE, ipBlocklist);
  saveJSON(FRAUD_CONFIG_FILE, fraudConfig);
}, 60 * 1000);

// KNOWN DATACENTER / VPN IP PREFIXES
// IPs that are NEVER flagged as fraud (hosting provider health checks, monitoring)
const FRAUD_WHITELIST_PREFIXES = [
  '127.0.0.1', '::1', '::ffff:127.',
  // Hostinger hosting servers
  '2a02:4780:', '2a02:4781:', '2a02:4782:', '2a02:4783:',
  '31.220.', '31.222.', '185.185.', '185.186.', '185.187.',
  '185.188.', '185.189.', '185.190.', '185.191.',
  '46.17.', '46.105.',
];

const DATACENTER_PREFIXES = [
  '10.','172.16.','172.17.','172.18.','172.19.','172.20.','172.21.','172.22.',
  '172.23.','172.24.','172.25.','172.26.','172.27.','172.28.','172.29.','172.30.',
  '172.31.','192.168.',
  '104.16.','104.17.','104.18.','104.19.','104.20.','104.21.',
  '45.33.','45.56.','45.79.',
  '167.99.','167.71.',
  '157.245.','159.65.',
  '198.199.',
  '35.185.','35.186.','35.187.','35.188.','35.189.','35.190.',
  '34.64.','34.65.','34.66.','34.67.','34.68.',
  '52.0.','52.1.','52.2.',
  '54.0.','54.1.','54.2.',
];

function isDatacenterIP(ip) {
  return DATACENTER_PREFIXES.some(function(p) { return ip.startsWith(p); });
}

// RISK SCORING (0-100)
function calculateRiskScore(device) {
  let score = 0;
  const clicks = device.adClicks || 0;
  const ips    = (device.ips || []).length;
  const convs  = device.conversions || 0;
  if (clicks >= 1 && convs === 0) score += Math.min(40, clicks * 10);
  if (ips >= 3) score += 30;
  else if (ips >= 2) score += 15;
  if (clicks >= 10) score += 20;
  else if (clicks >= 5) score += 10;
  if ((device.ips || []).some(isDatacenterIP)) score += 20;
  if (device.minClickInterval && device.minClickInterval < 30) score += 15;
  if (device.isFraud) score = Math.max(score, 80);
  return Math.min(100, score);
}

function riskLabel(score) {
  if (score >= 80) return { label: 'HIGH RISK', color: '#ef4444' };
  if (score >= 50) return { label: 'MEDIUM RISK', color: '#eab308' };
  if (score >= 20) return { label: 'LOW RISK', color: '#f97316' };
  return { label: 'SAFE', color: '#22c55e' };
}

// HELPERS
function getClientIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress || ''
  ).replace('::ffff:', '');
}

function buildServerFingerprint(req) {
  const ua      = req.headers['user-agent'] || '';
  const lang    = req.headers['accept-language'] || '';
  const enc     = req.headers['accept-encoding'] || '';
  const secUa   = req.headers['sec-ch-ua'] || '';
  const secPlat = req.headers['sec-ch-ua-platform'] || '';
  const ip      = getClientIP(req);
  const subnet  = ip.split('.').slice(0, 3).join('.');
  return crypto.createHash('sha256').update(ua+'|'+lang+'|'+enc+'|'+secUa+'|'+secPlat+'|'+subnet).digest('hex').slice(0, 16);
}

function mergeFingerprints(serverFp, clientSignals) {
  if (!clientSignals) return serverFp;
  const { canvas, webgl, screen, fonts, timezone } = clientSignals;
  const combined = serverFp+'|'+(canvas||'')+'|'+(webgl||'')+'|'+(screen||'')+'|'+(fonts||'')+'|'+(timezone||'');
  return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 16);
}

function getDevice(fp, req) {
  if (!deviceStore[fp]) {
    const ua = req.headers['user-agent'] || '';
    const ip = getClientIP(req);
    let deviceType = 'Desktop';
    if (/iphone/i.test(ua)) deviceType = 'iPhone';
    else if (/ipad/i.test(ua)) deviceType = 'iPad';
    else if (/android.*mobile/i.test(ua)) deviceType = 'Android Phone';
    else if (/android/i.test(ua)) deviceType = 'Android Tablet';
    let browser = 'Unknown';
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/chrome\//i.test(ua)) browser = 'Chrome';
    else if (/firefox\//i.test(ua)) browser = 'Firefox';
    else if (/safari\//i.test(ua)) browser = 'Safari';
    deviceStore[fp] = {
      fingerprint: fp,
      firstSeen:   new Date().toISOString(),
      lastSeen:    new Date().toISOString(),
      deviceType, browser,
      ua: (ua||'').slice(0, 120),
      ip, ips: [ip],
      adClicks: 0, gclidList: [],
      conversions: 0,
      isFraud: false, fraudReason: '',
      estimatedCost: 0,
      riskScore: 0,
      isDatacenter: isDatacenterIP(ip),
      clickTimestamps: [],
    };
  }
  return deviceStore[fp];
}

// CORE FUNCTIONS
function recordAdClick(fp, gclid, req) {
  const ip     = getClientIP(req);
  const device = getDevice(fp, req);
  const now    = new Date().toISOString();
  const nowMs  = Date.now();

  device.lastSeen = now;
  device.adClicks++;
  device.estimatedCost = +(device.adClicks * fraudConfig.costPerClick).toFixed(2);

  device.clickTimestamps = device.clickTimestamps || [];
  device.clickTimestamps.push(nowMs);
  if (device.clickTimestamps.length > 20) device.clickTimestamps = device.clickTimestamps.slice(-20);

  if (device.clickTimestamps.length >= 2) {
    const intervals = [];
    for (let i = 1; i < device.clickTimestamps.length; i++) {
      intervals.push((device.clickTimestamps[i] - device.clickTimestamps[i-1]) / 1000);
    }
    device.minClickInterval = Math.min(...intervals);
  }

  if (!device.ips.includes(ip)) {
    device.ips.push(ip);
    if (device.ips.length > 30) device.ips = device.ips.slice(-30);
  }
  if (gclid && !device.gclidList.includes(gclid)) {
    device.gclidList.push(gclid);
    if (device.gclidList.length > 50) device.gclidList = device.gclidList.slice(-50);
  }

  device.riskScore = calculateRiskScore(device);
  device.isDatacenter = (device.ips || []).some(isDatacenterIP);

  clickLog.push({
    timestamp:   now,
    time:        now,
    fingerprint: fp,
    ip,
    ua:          (req.headers['user-agent']||'').slice(0, 100),
    gclid,
    path:        req.path || '/',
    converted:   false,
    date:        new Date().toLocaleDateString('en-AU'),
  });

  if (device.adClicks >= fraudConfig.clickThreshold && device.conversions === 0 && !device.isFraud) {
    device.isFraud    = true;
    device.flaggedAt  = now;
    device.fraudReason = device.ips.length >= 2
      ? device.adClicks + ' ad clicks, 0 bookings, ' + device.ips.length + ' IPs (rotating)'
      : device.adClicks + ' ad clicks, 0 bookings';
    console.log('[ClickFraud] FRAUD DETECTED: fp=' + fp + ' clicks=' + device.adClicks + ' ips=' + device.ips.length + ' risk=' + device.riskScore);

    if (fraudConfig.autoBlock) {
      for (const fraudIP of device.ips) {
        if (!ipBlocklist[fraudIP]) {
          ipBlocklist[fraudIP] = {
            ip: fraudIP,
            reason: 'Auto-blocked: ' + device.fraudReason,
            blockedAt: now,
            manual: false,
            fingerprint: fp,
          };
        }
      }
    }
  }

  return device;
}

function recordFraudConversion(req) {
  const fp = buildServerFingerprint(req);
  if (deviceStore[fp]) {
    deviceStore[fp].conversions++;
    deviceStore[fp].isFraud = false;
    deviceStore[fp].riskScore = calculateRiskScore(deviceStore[fp]);
    deviceStore[fp].lastConversion = new Date().toISOString();
  }
  for (let i = clickLog.length - 1; i >= 0; i--) {
    if (clickLog[i].fingerprint === fp && !clickLog[i].converted) {
      clickLog[i].converted = true;
      break;
    }
  }
}

// IP BLOCKLIST MANAGEMENT
function blockIP(ip, reason, manual, fingerprint) {
  manual = manual !== false;
  ipBlocklist[ip] = {
    ip,
    reason: reason || 'Manual block',
    blockedAt: new Date().toISOString(),
    manual,
    fingerprint: fingerprint || '',
  };
  saveJSON(IP_BLOCK_FILE, ipBlocklist);
}

function unblockIP(ip) {
  delete ipBlocklist[ip];
  saveJSON(IP_BLOCK_FILE, ipBlocklist);
}

function isIPBlocked(ip) {
  return !!ipBlocklist[ip];
}

function getIPBlocklist() {
  return Object.values(ipBlocklist).sort(function(a, b) { return new Date(b.blockedAt) - new Date(a.blockedAt); });
}

function generateExclusionCSV() {
  const ips = Object.keys(ipBlocklist);
  const lines = ['IP Address,Reason,Blocked At'];
  for (const ip of ips) {
    const b = ipBlocklist[ip];
    lines.push(ip + ',"' + (b.reason||'').replace(/"/g,'""') + '","' + (b.blockedAt||'') + '"');
  }
  return lines.join('\n');
}

// DAILY STATS
function getDailyStats() {
  const byDay = {};
  for (const c of clickLog) {
    const d = c.date || new Date(c.timestamp || c.time || 0).toLocaleDateString('en-AU');
    if (!byDay[d]) byDay[d] = { date: d, clicks: 0, conversions: 0, fraudClicks: 0, cost: 0, wastedCost: 0 };
    byDay[d].clicks++;
    if (c.converted) byDay[d].conversions++;
    byDay[d].cost = +(byDay[d].clicks * fraudConfig.costPerClick).toFixed(2);
  }
  for (const dev of Object.values(deviceStore)) {
    if (dev.isFraud && dev.flaggedAt) {
      const d = new Date(dev.flaggedAt).toLocaleDateString('en-AU');
      if (byDay[d]) {
        byDay[d].fraudClicks += dev.adClicks || 0;
        byDay[d].wastedCost = +((byDay[d].fraudClicks || 0) * fraudConfig.costPerClick).toFixed(2);
      }
    }
  }
  return Object.values(byDay).sort(function(a, b) {
    const pa = a.date.split('/').map(Number), pb = b.date.split('/').map(Number);
    return new Date(pa[2], pa[1]-1, pa[0]) - new Date(pb[2], pb[1]-1, pb[0]);
  }).slice(-30);
}

// FULL REPORT
function getFraudReport() {
  const devices   = Object.values(deviceStore);
  const confirmed = devices
    .filter(function(d) { return d.isFraud; })
    .map(function(d) { const rs = calculateRiskScore(d); return Object.assign({}, d, { riskScore: rs, riskLabel: riskLabel(rs) }); })
    .sort(function(a, b) { return b.riskScore - a.riskScore; });

  const suspicious = devices
    .filter(function(d) { return !d.isFraud && d.adClicks >= 2 && d.conversions === 0; })
    .map(function(d) { const rs = calculateRiskScore(d); return Object.assign({}, d, { riskScore: rs, riskLabel: riskLabel(rs) }); })
    .sort(function(a, b) { return b.riskScore - a.riskScore; })
    .slice(0, 50);

  const totalWasted      = confirmed.reduce(function(s, d) { return s + (d.estimatedCost || 0); }, 0);
  const totalFraudClicks = confirmed.reduce(function(s, d) { return s + (d.adClicks || 0); }, 0);
  const todayStr         = new Date().toDateString();
  const fraudClicksToday = clickLog.filter(function(c) {
    return new Date(c.timestamp || c.time || 0).toDateString() === todayStr;
  }).length;

  const dailyHistory  = getDailyStats();
  const blockedIPList = getIPBlocklist();

  return {
    fraudDevicesCount: confirmed.length,
    fraudDeviceCount:  confirmed.length,
    fraudClicksToday,
    estimatedWasted:   +totalWasted.toFixed(2),
    totalFraudClicks,
    totalAdClicks:     clickLog.length,
    uniqueDevices:     Object.keys(deviceStore).length,
    suspiciousCount:   suspicious.length,
    blockedIPCount:    blockedIPList.length,
    config:            fraudConfig,
    fraudDevices:      confirmed.slice(0, 100),
    confirmedFraud:    confirmed.slice(0, 100),
    suspiciousDevices: suspicious,
    recentClicks:      clickLog.slice(-200).reverse(),
    dailyHistory,
    blockedIPs:        blockedIPList.slice(0, 200),
  };
}

// MIDDLEWARE
function clickFraudMiddleware(req, res, next) {
  try {
    const ip = getClientIP(req);
    // Skip fraud tracking for whitelisted IPs (hosting provider, monitoring)
    if (ip && FRAUD_WHITELIST_PREFIXES.some(function(p) { return ip.startsWith(p); })) {
      return next();
    }
    if (ip && isIPBlocked(ip)) {
      res.locals.fraudIPBlocked = true;
    }
    const gclid = req.query && (req.query.gclid || req.query.GCLID);
    if (gclid) {
      const fp = buildServerFingerprint(req);
      recordAdClick(fp, gclid, req);
      res.locals.fraudFingerprint = fp;
    }
  } catch(e) {
    console.error('[ClickFraud] Middleware error:', e.message);
  }
  next();
}

module.exports = {
  clickFraudMiddleware,
  buildServerFingerprint,
  mergeFingerprints,
  recordAdClick,
  recordFraudConversion,
  getFraudReport,
  blockIP,
  unblockIP,
  isIPBlocked,
  getIPBlocklist,
  generateExclusionCSV,
  getDailyStats,
  calculateRiskScore,
  riskLabel,
  get fraudConfig() { return fraudConfig; },
  set fraudConfig(cfg) { fraudConfig = cfg; saveJSON(FRAUD_CONFIG_FILE, fraudConfig); },
};
