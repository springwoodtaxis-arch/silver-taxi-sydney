'use strict';
/**
 * smsglobal.js — SMSGlobal helper using the HTTP API (confirmed working)
 *
 * Credentials are read from environment variables:
 *   SMSGLOBAL_USER     (Master API Username, default: g7wp3zgk)
 *   SMSGLOBAL_PASS     (Master API Password, default: QzkxLtXm)
 *   SMSGLOBAL_FROM     (Sender number, default: SilverTaxis)
 *
 * Drop-in replacement for the Twilio SMS helper used across all booking servers.
 */

const https = require('https');

const DEFAULTS = {
  user: 'g7wp3zgk',
  pass: 'QzkxLtXm',
  from: 'SilverTaxis',
};

/**
 * Normalise an Australian phone number to E.164 digits only (no +).
 */
function normalisePhone(raw) {
  if (!raw) return raw;
  let n = String(raw).replace(/[\s\-().+]/g, '');
  if (n.startsWith('04')) n = '61' + n.slice(1);
  if (n.startsWith('614') && n.length === 11) return n;
  if (n.startsWith('61')) return n;
  return n;
}

/**
 * Send a single SMS via SMSGlobal HTTP API.
 *
 * @param {string} to    - Destination phone number (will be normalised)
 * @param {string} body  - SMS message text
 * @param {object} [opts]
 * @returns {Promise<object>}
 */
function sendSms(to, body, opts = {}) {
  const user   = opts.user || process.env.SMSGLOBAL_USER || DEFAULTS.user;
  const pass   = opts.pass || process.env.SMSGLOBAL_PASS || DEFAULTS.pass;
  const from   = opts.from || process.env.SMSGLOBAL_FROM || DEFAULTS.from;
  const normTo = normalisePhone(to);

  const params = new URLSearchParams({
    action:   'sendsms',
    user,
    password: pass,
    from,
    to:       normTo,
    text:     body,
  });

  const url = 'https://api.smsglobal.com/http-api.php?' + params.toString();

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.startsWith('OK')) {
          const msgId = (data.match(/SMSGlobalMsgID:(\d+)/) || [])[1] || 'n/a';
          console.log(`[SMSGlobal] Sent to ${normTo} | msgId: ${msgId}`);
          resolve({ success: true, raw: data, msgId });
        } else {
          console.error(`[SMSGlobal] Send error to ${normTo}:`, data);
          reject(new Error(data));
        }
      });
    }).on('error', (err) => {
      console.error('[SMSGlobal] HTTP error:', err.message);
      reject(err);
    });
  });
}

/**
 * Send an OTP code via SMSGlobal.
 * Generates a 6-digit code, stores it in memory, and sends it via SMS.
 *
 * @param {string} to      - Destination phone number
 * @param {string} brand   - Brand name shown in message (e.g. "SilverTaxis")
 * @param {object} [opts]
 * @returns {Promise<{code: string, expires: number}>}
 */
const otpStore = new Map(); // phone -> { code, expires }

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtp(to, brand, opts = {}) {
  const normTo = normalisePhone(to);
  const code   = genCode();
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(normTo, { code, expires });

  const msg = `${code} is your ${brand || 'SilverTaxis'} booking verification code. Valid for 10 minutes. Do not share this code.`;
  await sendSms(normTo, msg, opts);
  console.log(`[SMSGlobal OTP] Code for ${normTo}: ${code}`);
  return { code, expires };
}

/**
 * Verify an OTP code.
 *
 * @param {string} to   - Phone number
 * @param {string} code - Code entered by user
 * @returns {{ success: boolean, error?: string }}
 */
function verifyOtp(to, code) {
  const normTo = normalisePhone(to);
  const stored = otpStore.get(normTo);
  if (!stored) return { success: false, error: 'No code sent to this number. Click Send Code first.' };
  if (Date.now() > stored.expires) {
    otpStore.delete(normTo);
    return { success: false, error: 'Code expired. Please request a new one.' };
  }
  if (stored.code !== String(code).trim()) return { success: false, error: 'Incorrect code. Please try again.' };
  otpStore.delete(normTo);
  return { success: true };
}

module.exports = { sendSms, sendOtp, verifyOtp, normalisePhone, otpStore };
