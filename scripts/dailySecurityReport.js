/**
 * Daily Security Report — Silver Taxi Sydney Service
 * Runs at 8am AEST every day via node-cron
 * Collects threat + fraud data from the past 24h and emails a summary
 */
'use strict';

const nodemailer = require('nodemailer');
const path = require('path');
const fs   = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────
const REPORT_EMAIL  = process.env.SMTP_USER || 'info@silvertaxisydneyservice.com';
const SMTP_HOST     = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT     = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER     = process.env.SMTP_USER || 'info@silvertaxisydneyservice.com';
const SMTP_PASS     = process.env.SMTP_PASS || '';
const SITE_NAME     = 'Silver Taxi Sydney Service';
const SITE_URL      = 'https://silvertaxisydneyservice.com';
const DASHBOARD_URL = `${SITE_URL}/seo-dashboard`;

// ── Data paths ───────────────────────────────────────────────────────────────
const DATA_DIR          = path.join(__dirname, '..', 'data');
const THREAT_HIST_FILE  = path.join(DATA_DIR, 'threat-history.json');
const FRAUD_HIST_FILE   = path.join(DATA_DIR, 'fraud-history.json');
const REPORT_LOG_FILE   = path.join(DATA_DIR, 'daily-report-log.json');

function loadJSON(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}
function saveJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Collect data ─────────────────────────────────────────────────────────────
function collectData() {
  const now     = Date.now();
  const since24 = now - 24 * 60 * 60 * 1000;
  const since30d = now - 30 * 24 * 60 * 60 * 1000;

  const threatAll  = loadJSON(THREAT_HIST_FILE, []);
  const fraudAll   = loadJSON(FRAUD_HIST_FILE, []);

  const threat24h  = threatAll.filter(e => new Date(e.timestamp || e.time || 0).getTime() > since24);
  const fraud24h   = fraudAll.filter(e => new Date(e.firstSeen || e.timestamp || 0).getTime() > since24);
  const threat30d  = threatAll.filter(e => new Date(e.timestamp || e.time || 0).getTime() > since30d);
  const fraud30d   = fraudAll.filter(e => new Date(e.firstSeen || e.timestamp || 0).getTime() > since30d);

  // Breakdown by reason (last 24h)
  const byReason = {};
  threat24h.forEach(e => {
    const r = e.reason || 'Unknown';
    byReason[r] = (byReason[r] || 0) + 1;
  });

  // Top blocked IPs (last 24h)
  const byIP = {};
  threat24h.forEach(e => {
    const ip = e.ip || 'unknown';
    byIP[ip] = (byIP[ip] || 0) + 1;
  });
  const topIPs = Object.entries(byIP).sort((a,b) => b[1]-a[1]).slice(0,5);

  // Fraud stats
  const fraudDevices = new Set(fraud24h.map(e => e.fingerprint)).size;
  const fraudClicks  = fraud24h.reduce((s,e) => s + (e.adClicks || 1), 0);
  const fraudCost    = (fraudClicks * 3.5).toFixed(2);

  // 30-day totals
  const total30dBlocked = threat30d.length;
  const total30dFraud   = fraud30d.length;

  return {
    date: new Date().toLocaleDateString('en-AU', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Australia/Sydney' }),
    time: new Date().toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', timeZone:'Australia/Sydney' }),
    threat24h: threat24h.length,
    fraud24h: fraudDevices,
    fraudClicks,
    fraudCost,
    byReason,
    topIPs,
    total30dBlocked,
    total30dFraud,
    recentThreats: threat24h.slice(-10).reverse(),
    recentFraud: fraud24h.slice(-5).reverse(),
  };
}

// ── Build HTML email ──────────────────────────────────────────────────────────
function buildHTML(d) {
  const reasonRows = Object.entries(d.byReason).map(([r,c]) =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #1e3a5f">${r}</td><td style="padding:6px 12px;border-bottom:1px solid #1e3a5f;text-align:right;color:#f59e0b;font-weight:700">${c}</td></tr>`
  ).join('') || '<tr><td colspan="2" style="padding:10px;color:#64748b;text-align:center">No threats in last 24h ✅</td></tr>';

  const ipRows = d.topIPs.map(([ip,c]) =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #1e3a5f;font-family:monospace">${ip}</td><td style="padding:6px 12px;border-bottom:1px solid #1e3a5f;text-align:right;color:#ef4444;font-weight:700">${c} hits</td></tr>`
  ).join('') || '<tr><td colspan="2" style="padding:10px;color:#64748b;text-align:center">No repeat IPs</td></tr>';

  const threatRows = d.recentThreats.map(e =>
    `<tr><td style="padding:5px 10px;border-bottom:1px solid #1e3a5f;font-size:12px;font-family:monospace">${e.ip || '-'}</td><td style="padding:5px 10px;border-bottom:1px solid #1e3a5f;font-size:12px">${e.reason || '-'}</td><td style="padding:5px 10px;border-bottom:1px solid #1e3a5f;font-size:11px;color:#64748b">${e.ua ? e.ua.substring(0,40)+'...' : '-'}</td><td style="padding:5px 10px;border-bottom:1px solid #1e3a5f;font-size:11px;color:#64748b">${e.timestamp ? new Date(e.timestamp).toLocaleTimeString('en-AU',{timeZone:'Australia/Sydney'}) : '-'}</td></tr>`
  ).join('') || '<tr><td colspan="4" style="padding:10px;color:#64748b;text-align:center">No threats in last 24h ✅</td></tr>';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Daily Security Report — ${SITE_NAME}</title></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:680px;margin:0 auto;padding:24px 16px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f1f3d,#144a8f);border-radius:16px;padding:28px 32px;margin-bottom:20px;text-align:center">
    <div style="font-size:32px;margin-bottom:8px">🛡️</div>
    <h1 style="color:#fff;font-size:22px;margin:0 0 4px">${SITE_NAME}</h1>
    <p style="color:rgba(255,255,255,.6);margin:0;font-size:14px">Daily Security Report — ${d.date}</p>
  </div>

  <!-- Stats row -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px">
    <div style="background:#0f1f3d;border-radius:12px;padding:16px;text-align:center;border:1px solid #1e3a5f">
      <div style="font-size:28px;font-weight:700;color:#ef4444">${d.threat24h}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">Threats Blocked<br>Last 24h</div>
    </div>
    <div style="background:#0f1f3d;border-radius:12px;padding:16px;text-align:center;border:1px solid #1e3a5f">
      <div style="font-size:28px;font-weight:700;color:#f59e0b">${d.fraud24h}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">Fraud Devices<br>Detected</div>
    </div>
    <div style="background:#0f1f3d;border-radius:12px;padding:16px;text-align:center;border:1px solid #1e3a5f">
      <div style="font-size:28px;font-weight:700;color:#a855f7">$${d.fraudCost}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">Est. Ad Spend<br>Protected</div>
    </div>
    <div style="background:#0f1f3d;border-radius:12px;padding:16px;text-align:center;border:1px solid #1e3a5f">
      <div style="font-size:28px;font-weight:700;color:#22c55e">${d.total30dBlocked}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px">Total Blocked<br>Last 30 Days</div>
    </div>
  </div>

  <!-- Threats by reason -->
  <div style="background:#0f1f3d;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #1e3a5f">
    <h2 style="color:#fff;font-size:15px;margin:0 0 14px">🤖 Threats Blocked by Reason (Last 24h)</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Reason</th>
        <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Count</th>
      </tr></thead>
      <tbody>${reasonRows}</tbody>
    </table>
  </div>

  <!-- Top IPs -->
  <div style="background:#0f1f3d;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #1e3a5f">
    <h2 style="color:#fff;font-size:15px;margin:0 0 14px">🌐 Top Blocked IPs (Last 24h)</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em">IP Address</th>
        <th style="padding:8px 12px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Hits</th>
      </tr></thead>
      <tbody>${ipRows}</tbody>
    </table>
  </div>

  <!-- Recent threats log -->
  <div style="background:#0f1f3d;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #1e3a5f">
    <h2 style="color:#fff;font-size:15px;margin:0 0 14px">📋 Recent Threat Events (Last 24h)</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="padding:6px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">IP</th>
        <th style="padding:6px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">Reason</th>
        <th style="padding:6px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">User Agent</th>
        <th style="padding:6px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">Time</th>
      </tr></thead>
      <tbody>${threatRows}</tbody>
    </table>
  </div>

  <!-- 30-day summary -->
  <div style="background:linear-gradient(135deg,#0f1f3d,#1a2f5a);border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #1e3a5f">
    <h2 style="color:#fff;font-size:15px;margin:0 0 10px">📅 30-Day Summary</h2>
    <p style="color:#94a3b8;font-size:13px;margin:0">Total threats blocked: <strong style="color:#ef4444">${d.total30dBlocked}</strong> &nbsp;|&nbsp; Total fraud events: <strong style="color:#f59e0b">${d.total30dFraud}</strong></p>
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:24px">
    <a href="${DASHBOARD_URL}" style="display:inline-block;background:linear-gradient(135deg,#144a8f,#1e6dd5);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:14px">View Full Dashboard →</a>
  </div>

  <!-- Footer -->
  <p style="text-align:center;color:#334155;font-size:11px;margin:0">
    ${SITE_NAME} Security System &nbsp;·&nbsp; Report generated ${d.date} at ${d.time} AEST<br>
    <a href="${SITE_URL}" style="color:#334155">${SITE_URL}</a>
  </p>
</div>
</body>
</html>`;
}

// ── Send email ────────────────────────────────────────────────────────────────
async function sendReport() {
  console.log('[Daily Report] Collecting security data...');
  const data = collectData();

  const html = buildHTML(data);
  const subject = `🛡️ Daily Security Report — ${data.threat24h} threats, $${data.fraudCost} protected — ${data.date}`;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${SITE_NAME} Security" <${SMTP_USER}>`,
      to: REPORT_EMAIL,
      subject,
      html,
    });
    console.log('[Daily Report] Sent:', info.messageId);

    // Log the send
    const log = loadJSON(REPORT_LOG_FILE, []);
    log.push({ sent: new Date().toISOString(), threats: data.threat24h, fraudDevices: data.fraud24h, fraudCost: data.fraudCost, messageId: info.messageId });
    if (log.length > 90) log.splice(0, log.length - 90);
    saveJSON(REPORT_LOG_FILE, log);
  } catch(e) {
    console.error('[Daily Report] Failed to send:', e.message);
  }
}

// ── Export for use in server.js ───────────────────────────────────────────────
module.exports = { sendReport, collectData };

// ── Run directly if called as main ───────────────────────────────────────────
if (require.main === module) {
  sendReport().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
