'use strict';
// ─── Load .env if present ─────────────────────────────────────────────────────
try {
  const fs = require('fs');
  const path = require('path');
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
    .split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    });
} catch (e) { /* .env not present — use process.env */ }

const E = (k, fb = '') => {
  const v = process.env[k] || process.env[k.toLowerCase()] || fb;
  return (v || '').replace(/^["'\s]+|["'\s]+$/g, '');
};

const CFG = {
  PORT:           process.env.PORT || E('PORT', '3000'),
  SMSGLOBAL_USER: E('SMSGLOBAL_USER', 'g7wp3zgk'),
  SMSGLOBAL_PASS: E('SMSGLOBAL_PASS', 'QzkxLtXm'),
  SMSGLOBAL_FROM: E('SMSGLOBAL_FROM', '61447100306'),
  SMTP_HOST:      E('SMTP_HOST',      'smtp.hostinger.com'),
  SMTP_PORT:      E('SMTP_PORT',      '465'),
  SMTP_USER:      E('SMTP_USER',      'info@silvertaxisydneyservice.com'),
  SMTP_PASS:      E('SMTP_PASS',      'a3e4-qhmr-yepi-aoxf'),
  ADMIN_EMAIL:    E('ADMIN_EMAIL',    'info@silvertaxisydneyservice.com'),
  ADMIN_PHONE:    E('ADMIN_PHONE',    '+61420439848'),
  ADMIN_PASSWORD: E('ADMIN_PASSWORD', 'Au6GE4Jo2;'),
  STRIPE_SECRET:  E('STRIPE_SECRET_KEY'),
  STRIPE_PK:      E('STRIPE_PK'),  // Set STRIPE_PK in .env — never hardcode keys in source
  TELEGRAM_TOKEN: E('TELEGRAM_BOT_TOKEN', '8679067781:AAEH436Zpx4hmeHh04WGcbqlLc12R17wCEI'),
  TELEGRAM_CHAT:  E('TELEGRAM_CHAT_ID',   '7009455963'),
  MAPS_KEY:       E('MAPS_API_KEY',   'AIzaSyBkJjXqZJsRkFbjEsadjlZa6O87BkpMY60'),
  RESEND_API_KEY: E('RESEND_API_KEY', 're_CwTpW4rQ_9DZSrHMNSaXLMosbMVnXwfbt'),
  WEBHOOK_SECRET: E('WEBHOOK_SECRET', 'springwood-deploy-2026'),
  MONGODB_URI:    E('MONGODB_URI',    'mongodb+srv://sso-admin:SSOBookings2026!@sso-bookings.zuhw01d.mongodb.net/sso?appName=sso-bookings'),
  AVIATION_KEY:   E('AVIATION_STACK_KEY', ''),
  SMSGLOBAL_REST_KEY:    E('SMSGLOBAL_REST_KEY',    '31736f205d7b28e3204e7ace6833f82e'),
  SMSGLOBAL_REST_SECRET: E('SMSGLOBAL_REST_SECRET', 'dc043fe439f35fdf31075aaae7e87579'),
};

module.exports = CFG;
