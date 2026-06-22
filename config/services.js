'use strict';
const CFG     = require('./index');
const smsglobal = require('../smsglobal');

// ─── Service handles ─────────────────────────────────────────────────────────
const SVC = { mailer: null, stripe: null };

// ─── Nodemailer ───────────────────────────────────────────────────────────────
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
  } catch (e) { console.error('[EMAIL] Load failed:', e.message); }
}

// ─── Stripe ───────────────────────────────────────────────────────────────────
if (CFG.STRIPE_SECRET && !CFG.STRIPE_SECRET.includes('your_') && CFG.STRIPE_SECRET.length > 20) {
  try {
    SVC.stripe = require('stripe')(CFG.STRIPE_SECRET);
    console.log('[STRIPE] Loaded');
  } catch (e) { console.error('[STRIPE] Load failed:', e.message); }
} else {
  console.warn('[STRIPE] WARNING: Secret key not set — payments will be simulated');
}

// ─── SMSGlobal ────────────────────────────────────────────────────────────────
if (CFG.SMSGLOBAL_USER && CFG.SMSGLOBAL_PASS) {
  console.log('[SMSGlobal] Loaded. From:', CFG.SMSGLOBAL_FROM);
} else {
  console.warn('[SMSGlobal] WARNING: credentials not set — SMS will be logged only');
}

// ─── Helper: send SMS ─────────────────────────────────────────────────────────
const { DB } = require('./db');

async function sms(to, body) {
  if (!to) return;
  const entry = { to, body: body.substring(0, 160), status: 'sent', error: null };
  try {
    await smsglobal.sendSms(to, body, {
      user: CFG.SMSGLOBAL_USER,
      pass: CFG.SMSGLOBAL_PASS,
      from: CFG.SMSGLOBAL_FROM,
    });
    console.log('[SMS] Sent to', to);
    DB.logSms(entry);
  } catch (e) {
    console.error('[SMS] Error to', to, ':', e.message);
    entry.status = 'failed';
    entry.error  = e.message;
    DB.logSms(entry);
    tg(`⚠️ <b>SMS FAILED</b>\nTo: ${to}\nError: ${e.message}\nMsg: ${body.substring(0, 100)}`).catch(() => {});
  }
}

// ─── Helper: send email ───────────────────────────────────────────────────────
async function email(to, subject, html, attachments = []) {
  if (!to || !SVC.mailer) {
    console.log('[EMAIL mock] To:', to, '|', subject);
    return;
  }
  const mailOpts = {
    from: `"Silver Service Online" <${CFG.SMTP_USER}>`,
    to, subject, html,
  };
  if (attachments.length > 0) mailOpts.attachments = attachments;
  const send    = SVC.mailer.sendMail(mailOpts);
  const timeout = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000));
  try {
    const info = await Promise.race([send, timeout]);
    console.log('[EMAIL]  Sent to', to, '| ID:', info.messageId);
  } catch (e) {
    console.error('[EMAIL]  Error:', e.message);
    if (e.message.includes('timeout') || e.message.includes('connect')) {
      try {
        const nm2 = require('nodemailer');
        const alt = nm2.createTransport({
          host: CFG.SMTP_HOST, port: 587, secure: false,
          auth: { user: CFG.SMTP_USER, pass: CFG.SMTP_PASS },
          tls: { rejectUnauthorized: false }, connectionTimeout: 8000,
        });
        const altOpts = { from: `"Silver Service Online" <${CFG.SMTP_USER}>`, to, subject, html };
        if (attachments.length > 0) altOpts.attachments = attachments;
        const info2 = await Promise.race([
          alt.sendMail(altOpts),
          new Promise((_, r) => setTimeout(() => r(new Error('alt timeout')), 8000)),
        ]);
        console.log('[EMAIL]  Sent via 587 to', to, '| ID:', info2.messageId);
        SVC.mailer = alt;
      } catch (e2) {
        console.error('[EMAIL]  Port 587 also failed:', e2.message);
        tg(`⚠️ <b>EMAIL FAILED</b>\nTo: ${to}\nSubject: ${subject}\nError: ${e2.message}`).catch(() => {});
      }
    } else {
      tg(`⚠️ <b>EMAIL FAILED</b>\nTo: ${to}\nSubject: ${subject}\nError: ${e.message}`).catch(() => {});
    }
  }
}

// ─── Helper: send Telegram message ───────────────────────────────────────────
async function tg(text) {
  if (!CFG.TELEGRAM_TOKEN || !CFG.TELEGRAM_CHAT) return;
  try {
    const id   = String(CFG.TELEGRAM_CHAT).trim();
    const body = JSON.stringify({ chat_id: id, text, parse_mode: 'HTML' });
    const https = require('https');
    const req   = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${CFG.TELEGRAM_TOKEN}/sendMessage`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => { let d = ''; res.on('data', c => d += c); });
    req.on('error', e => console.error('[TELEGRAM] Request Error:', e.message));
    req.write(body);
    req.end();
  } catch (e) { console.error('[TELEGRAM] Error:', e.message); }
}

module.exports = { SVC, sms, email, tg };
