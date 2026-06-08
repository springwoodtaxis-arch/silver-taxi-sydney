/**
 * Mass SEO Location Page Generator v3
 * Uses EXACT same HTML structure as about.html / home page
 * - Uses style.css only (no locations-style.css)
 * - page-hero, .section, .container, .btn .btn-gold classes
 * - Same nav, footer, mobile panel as about.html
 * - Correct fare calculations matching server.js
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'suburb-details.json'), 'utf8'));
const contentDir = path.join(__dirname, 'generated-content');
const outputDir = path.join(__dirname, '..', 'public', 'locations');

const SITE = 'https://silvertaxisydneyservice.com';
const PHONE = '1800 173 171';

const ICON_LOCATION = '<svg class=\"site-svg-icon\" width=\"20\" height=\"20\" focusable=\"false\" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const ICON_PLANE = '<svg class=\"site-svg-icon\" width=\"20\" height=\"20\" focusable=\"false\" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
const ICON_PHONE = '<svg class=\"site-svg-icon\" width=\"20\" height=\"20\" focusable=\"false\" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.86 19.86 0 01-3.07-8.67A2 2 0 014.11 1h3a2 2 0 012 1.72c.12.9.33 1.78.64 2.62a2 2 0 01-.45 2.11L8.1 8.64a16 16 0 006 6l1.19-1.19a2 2 0 012.11-.45c.84.31 1.72.52 2.62.64A2 2 0 0122 16.92z"/></svg>';
const ICON_CLOCK = '<svg class=\"site-svg-icon\" width=\"20\" height=\"20\" focusable=\"false\" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICON_SHIELD = '<svg class=\"site-svg-icon\" width=\"20\" height=\"20\" focusable=\"false\" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>';
const ICON_CAR = '<svg class=\"site-svg-icon\" width=\"20\" height=\"20\" focusable=\"false\" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11"/><path d="M3 13h18v5a1 1 0 01-1 1h-1a2 2 0 01-4 0H9a2 2 0 01-4 0H4a1 1 0 01-1-1v-5z"/><path d="M7 13h.01M17 13h.01"/></svg>';
const ICON_PRICE = '<svg class=\"site-svg-icon\" width=\"20\" height=\"20\" focusable=\"false\" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7"/><path d="M2 7h20v5H2z"/><path d="M12 7v14"/><path d="M12 7c-1.2 0-3-1-3-2.5A2.5 2.5 0 0111.5 2C13 2 14 4 12 7z"/><path d="M12 7c1.2 0 3-1 3-2.5A2.5 2.5 0 0012.5 2C11 2 10 4 12 7z"/></svg>';
const ICON_BOOK = '<svg class=\"site-svg-icon\" width=\"20\" height=\"20\" focusable=\"false\" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>';

function premiumHero({ badge, title, sub, primaryHref = '/book', primaryText = 'Book Online Now', secondaryHref = 'tel:1800173171', secondaryText = `Call ${PHONE}`, proof = [] }) {
  const proofItems = (proof.length ? proof : [
    { icon: ICON_PRICE, title: 'Fixed Fare Quote', text: 'Transparent pricing before travel' },
    { icon: ICON_CLOCK, title: '24/7 Dispatch', text: 'Airport and local rides anytime' },
    { icon: ICON_CAR, title: 'Premium Fleet', text: 'Sedan, Lexus, SUV and maxi taxi' },
  ]).map(item => `<div class="page-hero-proof"><span class="page-hero-proof-icon">${item.icon}</span><div><strong>${item.title}</strong><span>${item.text}</span></div></div>`).join('');
  return `<div class="page-hero seo-hero">
<div class="page-hero-content container">
<div class="page-hero-copy">
<div class="page-hero-badge">${ICON_SHIELD}${badge}</div>
<h1 class="page-hero-title">${title}</h1>
<p class="page-hero-sub">${sub}</p>
<div class="page-hero-actions">
<a class="btn btn-gold" href="${primaryHref}">${ICON_BOOK}${primaryText}</a>
<a class="btn btn-outline" href="${secondaryHref}" onclick="return trackPhoneCall('hero')">${ICON_PHONE}${secondaryText}</a>
</div>
<div class="page-hero-trust">
<span class="page-hero-trust-item">${ICON_PRICE}Fixed fares</span>
<span class="page-hero-trust-item">${ICON_CLOCK}Available 24/7</span>
<span class="page-hero-trust-item">${ICON_CAR}Premium vehicles</span>
</div>
</div>
<div class="page-hero-panel">
<div class="page-hero-panel-title">${ICON_PLANE}Premium Sydney Taxi Booking</div>
<div class="page-hero-proof-grid">${proofItems}</div>
</div>
</div>
</div>`;
}


// ─── SAFE LOCAL SEO SERVICE AREA ASSIGNMENT ───
// Public pages avoid exposing direct Google Business Profile or review/map links.
// Each page still receives clear service-area signals for SEO, booking intent and suburb relevance.
const SERVICE_AREAS = {
  centralCoast: {
    key: 'central-coast',
    label: 'Central Coast Silver Service Taxi Coverage',
    name: 'Central Coast taxi and airport transfer service area',
    serviceArea: 'Central Coast Council suburbs',
    seoFocus: 'Central Coast airport transfers, premium taxi bookings and long-distance Sydney transfers'
  },
  blueMountains: {
    key: 'blue-mountains',
    label: 'Blue Mountains and Penrith Silver Service Taxi Coverage',
    name: 'Blue Mountains and Penrith taxi and airport transfer service area',
    serviceArea: 'Blue Mountains and Penrith Council suburbs',
    seoFocus: 'Blue Mountains airport transfers, Penrith silver taxi bookings and long-distance Sydney transfers'
  },
  sydneyAirport: {
    key: 'sydney-airport',
    label: 'Sydney Airport Silver Service Taxi Coverage',
    name: 'Sydney airport taxi and transfer service area',
    serviceArea: 'Sydney Metro, Sydney Airport, Western Sydney Airport, corporate, CBD and Greater Sydney councils',
    seoFocus: 'Sydney airport transfers, silver service taxi bookings, fixed fare airport taxi and premium corporate transfers'
  },
  westernSydneyAirport: {
    key: 'western-sydney-airport',
    label: 'Western Sydney Airport Silver Service Taxi Coverage',
    name: 'Western Sydney International Airport taxi and transfer service area',
    serviceArea: 'Western Sydney International Airport, Badgerys Creek, Luddenham, Penrith, Liverpool, Camden, Campbelltown and Greater Western Sydney',
    seoFocus: 'Western Sydney Airport transfers, WSI taxi bookings, Badgerys Creek airport pickup, fixed fare airport taxi and premium corporate transfers'
  }
};

// ─── FARE CALCULATION (matches server.js exactly) ───
const FARES = {
  sedan: { init:7.40, minFare:50, minKm:8, bands:[[0,5,4.70],[5,10,4.50],[10,28,3.55],[28,50,3.40],[50,70,3.00],[70,100,2.80],[100,9999,2.60]] },
  suv:   { init:7.40, minFare:50, minKm:8, bands:[[0,5,4.80],[5,10,4.50],[10,28,3.65],[28,50,3.50],[50,70,3.10],[70,90,2.85],[90,9999,2.60]] },
};
function calcFare(vehicle, km) {
  const v = FARES[vehicle];
  const effectiveKm = Math.max(km, v.minKm);
  let dist = 0;
  for (const [lo, hi, rate] of v.bands) {
    if (effectiveKm <= lo) break;
    dist += (Math.min(effectiveKm, hi) - lo) * rate;
  }
  return Math.max(Math.round(v.init + dist), v.minFare);
}
function fareRange(km) {
  return { from: calcFare('sedan', km), to: calcFare('suv', km) };
}

// ─── LOAD LLM CONTENT ───
function loadContent(slug) {
  const f = path.join(contentDir, `${slug}.json`);
  if (fs.existsSync(f)) {
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e) {}
  }
  return null;
}

// ─── SHARED HTML (copied from about.html exactly) ───
const HEAD_START = (title, desc, canonical, extraHead='') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<meta name="description" content="${desc}"/>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Silver Taxi Sydney Service"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:image" content="${SITE}/images/hero.jpg"/>
<meta property="og:url" content="${canonical}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${desc}"/>
<meta name="twitter:image" content="${SITE}/images/hero.jpg"/>
${extraHead}
<meta content="width=device-width,initial-scale=1" name="viewport"/>
<link href="/images/logo.png" rel="icon" type="image/png"/>
<link href="/style.css?v=5" rel="stylesheet"/>
<link rel="stylesheet" href="/mobile-menu.css?v=5">
<style>
/* Location page specific styles */
.loc-routes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:24px}
.loc-route-card{background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:var(--r-lg,12px);padding:20px;transition:box-shadow .2s}
.loc-route-card:hover{box-shadow:var(--shadow-md,0 4px 12px rgba(0,0,0,.1))}
.loc-route-from{font-family:var(--ff-ui,'Inter',sans-serif);font-weight:700;color:var(--navy,#0f1f3d);font-size:.9rem}
.loc-route-meta{color:var(--mid,#6b7280);font-size:.82rem;margin-top:4px}
.loc-route-fare{color:var(--blue,#144a8f);font-weight:700;font-size:.88rem;margin-top:8px}
.loc-nearby-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:24px}
.loc-nearby-link{display:block;padding:14px 16px;background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:var(--r-md,8px);text-decoration:none;color:var(--navy,#0f1f3d);font-weight:600;font-size:.85rem;text-align:center;transition:all .2s}
.loc-nearby-link:hover{border-color:var(--blue,#144a8f);color:var(--blue,#144a8f);box-shadow:var(--shadow-sm,0 2px 4px rgba(0,0,0,.05))}
.loc-faq{margin-top:24px}
.loc-faq-item{border:1px solid var(--border,#e5e7eb);border-radius:var(--r-md,8px);margin-bottom:12px;overflow:hidden}
.loc-faq-q{padding:16px 20px;font-weight:700;color:var(--navy,#0f1f3d);cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:.9rem;background:#fff}
.loc-faq-q:hover{background:var(--off,#f9fafb)}
.loc-faq-a{padding:0 20px 16px;color:var(--mid,#6b7280);line-height:1.7;font-size:.87rem;display:none}
.loc-faq-item.open .loc-faq-a{display:block}
.loc-faq-item.open .faq-chevron{transform:rotate(180deg)}
.loc-council-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:24px}
.loc-council-card{display:block;background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:var(--r-lg,12px);padding:24px 20px;text-align:center;text-decoration:none;transition:all .2s}
.loc-council-card:hover{border-color:var(--blue,#144a8f);box-shadow:var(--shadow-md,0 4px 12px rgba(0,0,0,.1));transform:translateY(-2px)}
.loc-council-card h3{color:var(--navy,#0f1f3d);font-size:.9rem;font-weight:700;margin:0 0 4px}
.loc-council-card p{color:var(--mid,#6b7280);font-size:.78rem;margin:0}
.loc-suburb-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.loc-suburb-tag{display:inline-block;padding:8px 14px;background:var(--off,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:20px;color:var(--navy,#0f1f3d);font-size:.8rem;font-weight:600;text-decoration:none;transition:all .2s}
.loc-suburb-tag:hover{background:var(--blue,#144a8f);color:#fff;border-color:var(--blue,#144a8f)}
.loc-content h2{font-family:var(--ff-head,'Playfair Display',serif);font-size:1.6rem;font-weight:800;color:var(--navy,#0f1f3d);margin:32px 0 16px}
.loc-content h3{font-family:var(--ff-ui,'Inter',sans-serif);font-size:1.1rem;font-weight:700;color:var(--navy,#0f1f3d);margin:24px 0 12px}
.loc-content p{color:var(--mid,#6b7280);line-height:1.8;margin-bottom:16px}
.loc-content a{color:var(--blue,#144a8f);text-decoration:none;font-weight:600}
.loc-content a:hover{text-decoration:underline}
.loc-content ul,.loc-content ol{color:var(--mid,#6b7280);line-height:1.8;margin-bottom:16px;padding-left:24px}
.loc-content li{margin-bottom:6px}
.loc-service-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:24px;align-items:stretch}
.loc-service-card,.loc-service-proof{background:#fff;border:1px solid var(--border,#e5e7eb);border-radius:var(--r-lg,12px);padding:24px;box-shadow:var(--shadow-sm,0 2px 4px rgba(0,0,0,.05))}
.loc-service-card p{color:var(--mid,#6b7280);line-height:1.8;margin-bottom:14px}
.loc-service-focus{color:var(--navy,#0f1f3d)!important;font-size:1rem;font-weight:800}
.loc-service-proof{background:linear-gradient(135deg,#0f1f3d 0%,#123d74 100%);color:#fff;display:flex;flex-direction:column;justify-content:center;gap:14px;min-height:320px;position:relative;overflow:hidden}
.loc-service-proof:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 20%,rgba(217,184,96,.26),transparent 32%);pointer-events:none}
.loc-service-proof h3{font-family:var(--ff-head,'Playfair Display',serif);font-size:1.45rem;line-height:1.2;margin:0;position:relative;z-index:1}
.loc-service-proof p{color:rgba(255,255,255,.82);line-height:1.7;margin:0;position:relative;z-index:1}
.loc-proof-list{display:grid;gap:12px;position:relative;z-index:1}
.loc-proof-item{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.08)}
.loc-proof-item svg{display:block;box-sizing:content-box;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;max-width:18px!important;max-height:18px!important;fill:none;stroke:#d9b860;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:0 0 18px!important;padding:10px;border-radius:12px;background:linear-gradient(135deg,rgba(168,180,192,.18),rgba(255,255,255,.08));border:1px solid rgba(168,180,192,.28);margin:0}
.page-hero-badge svg,.page-hero-trust-item svg,.page-hero-panel-title svg,.page-hero-proof-icon svg,.page-hero-actions .btn svg,.loc-service-card .btn svg,.breadcrumb svg,.top-bar-item svg{display:inline-block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;min-width:0;overflow:visible}
.page-hero-badge svg{width:16px!important;height:16px!important;max-width:16px!important;max-height:16px!important;flex:0 0 16px}
.page-hero-trust-item svg{width:15px!important;height:15px!important;max-width:15px!important;max-height:15px!important;flex:0 0 15px}
.page-hero-panel-title svg{width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important;flex:0 0 20px}
.page-hero-proof-icon{display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important}.page-hero-proof-icon svg{display:block!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;max-width:18px!important;max-height:18px!important;flex:0 0 18px!important;margin:auto!important}
.page-hero-actions .btn svg,.loc-service-card .btn svg{width:16px!important;height:16px!important;max-width:16px!important;max-height:16px!important;flex:0 0 16px}
.breadcrumb svg{width:12px!important;height:12px!important;max-width:12px!important;max-height:12px!important;flex:0 0 12px}
.top-bar-item svg{width:14px!important;height:14px!important;max-width:14px!important;max-height:14px!important;flex:0 0 14px}
.btn::after{pointer-events:none!important;opacity:0!important}.btn:hover::after{opacity:0!important}.loc-service-card .btn-outline{color:var(--navy,#0f1f3d)!important;border-color:rgba(168,180,192,.72)!important;background:#fff!important}.loc-service-card .btn-outline:hover{color:var(--navy,#0f1f3d)!important;background:rgba(168,180,192,.12)!important;border-color:var(--gold,#A8B4C0)!important}
.loc-internal-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.loc-internal-links a{display:inline-block;padding:9px 13px;background:var(--off,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:999px;color:var(--navy,#0f1f3d);font-weight:700;font-size:.78rem;text-decoration:none}
.loc-internal-links a:hover{background:var(--blue,#144a8f);border-color:var(--blue,#144a8f);color:#fff}
@media(max-width:820px){.loc-service-grid{grid-template-columns:1fr}}
</style>
<script>
function trackPhoneCall(source) {
  return true;
}
</script>
</head>
<body>
`;

const TOP_BAR = `<div class="top-bar">
<div class="top-bar-inner">
<div class="top-bar-left">
<div class="top-bar-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Available 24/7</div>
</div>
<div class="top-bar-right">
<div class="top-bar-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z"></path></svg><a href="tel:1800173171" onclick="return trackPhoneCall('topbar')">${PHONE}</a></div>
</div>
</div>
</div>`;

const NAVBAR = `<nav class="navbar" id="navbar">
<div class="nav-inner">
<a class="nav-logo" href="/"><div class="nav-logo-text"><span>Silver Service</span><span>Taxi Sydney</span></div></a>
<ul class="nav-menu" id="nav-menu">
<li><a class="nav-link" href="/">Home</a></li>
<li><a class="nav-link" href="/services">Services</a></li>
<li><a class="nav-link" href="/airport-transfers">Airport Transfers</a></li>
<li><a class="nav-link" href="/maxi-taxi">Maxi Taxi</a></li>
<li><a class="nav-link" href="/locations/">Locations</a></li>
<li><a class="nav-link" href="/about">About</a></li>
<li><a class="nav-link" href="/contact">Contact</a></li>
<li><a class="nav-link" href="/manage">Manage Booking</a></li>
<li><a class="nav-book-btn" href="/book">Book your Sydney taxi now</a></li>
</ul>
<button aria-label="Toggle menu" class="nav-toggle" id="nav-toggle"><span></span><span></span><span></span></button>
</div>
</nav>`;

const MOB_PANEL = `<div id="mob-overlay"></div>
<div id="mob-panel">
<div class="mob-header">
<a class="mob-logo-link" href="/"><div class="mob-logo-text"><span class="mob-logo-top">Silver Service</span><span class="mob-logo-sub">Taxi Sydney</span></div></a>
<button aria-label="Close menu" class="mob-close" id="mob-close-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
</div>
<nav class="mob-links">
<a href="/" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg></span><span class="mob-nav-label">Home</span></a>
<a href="/airport-transfers" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></span><span class="mob-nav-label">Airport Transfers</span></a>
<a href="/maxi-taxi" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13h18l-2-6H5l-2 6z"/><path d="M5 13v5"/><path d="M19 13v5"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg></span><span class="mob-nav-label">Maxi Taxi</span></a>
<a href="/services" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></span><span class="mob-nav-label">Services</span></a>
<a href="/locations/" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span><span class="mob-nav-label">Locations</span></a>
<a href="/book" class="mob-nav-item mob-book-link"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg></span><span class="mob-nav-label">Book Now</span></a>
<a href="/about" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg></span><span class="mob-nav-label">About Us</span></a>
<a href="/contact" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg></span><span class="mob-nav-label">Contact</span></a>
<a href="/manage" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span><span class="mob-nav-label">Manage Booking</span></a>
</nav>
<div class="mob-footer"><a class="mob-call-btn" href="tel:1800173171"><svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="18"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg> ${PHONE}</a></div>
</div>`;

const FOOTER = `<footer class="footer">
<div class="container">
<div class="footer-grid">
<div>
<img alt="Silver Taxi Sydney" class="footer-brand-logo" src="/images/logo.png"/>
<p class="footer-brand-desc">Sydney's premier Silver Service taxi and chauffeur company. Professional, reliable and luxurious transport — 24/7.</p>
</div>
<div>
<div class="footer-col-title">Quick Links</div>
<ul class="footer-links">
<li><a href="/">Home</a></li>
<li><a href="/services">Services</a></li>
<li><a href="/airport-transfers">Airport Transfers</a></li>
<li><a href="/maxi-taxi">Maxi Taxi</a></li>
<li><a href="/locations/">All Locations</a></li>
<li><a href="/about">About</a></li>
<li><a href="/contact">Contact</a></li>
<li><a href="/book">Book your Sydney taxi now</a></li>
</ul>
</div>
<div>
<div class="footer-col-title">Services</div>
<ul class="footer-links">
<li><a href="/services">Silver Service Sedan</a></li>
<li><a href="/services">Lexus Luxury Sedan</a></li>
<li><a href="/services">SUV / Wagon</a></li>
<li><a href="/services">Maxi Taxi</a></li>
<li><a href="/airport-transfers">Airport Transfers</a></li>
<li><a href="/maxi-taxi">Maxi Taxi</a></li>
</ul>
</div>
<div>
<div class="footer-col-title">Contact</div>
<div class="footer-contact-item">
<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z"></path></svg>
<a href="tel:1800173171" onclick="return trackPhoneCall('footer')">${PHONE}</a>
</div>
<div class="footer-contact-item">
<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
<a href="mailto:info@silvertaxisydneyservice.com">info@silvertaxisydneyservice.com</a>
</div>
</div>
</div>
<div class="footer-bottom">
<div class="footer-bottom-text">&copy; 2026 Silver Taxi Sydney — All Rights Reserved</div>
</div>
</div>
</footer>`;

const PAGE_END = `${MOB_PANEL}
<script src="/shared.js"></script>
<script src="/mobile-menu.js?v=5"></script>
<script>
window.addEventListener('scroll', function() {
  var nb = document.getElementById('navbar');
  if (nb) nb.classList.toggle('scrolled', window.scrollY > 50);
});
document.querySelectorAll('.loc-faq-q').forEach(function(q) {
  q.addEventListener('click', function() { q.parentElement.classList.toggle('open'); });
});
</script>
</body>
</html>`;

// ─── CHEVRON SVG ───
const CHEV = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>';
const CHEV_DOWN = '<svg class="faq-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="transition:transform .2s"><polyline points="6 9 12 15 18 9"></polyline></svg>';

function profileForCouncilSlug(councilSlug) {
  if (councilSlug === 'central-coast') return SERVICE_AREAS.centralCoast;
  if (councilSlug === 'blue-mountains' || councilSlug === 'penrith') return SERVICE_AREAS.blueMountains;
  return SERVICE_AREAS.sydneyAirport;
}

function profileForSuburb(suburb) {
  const council = data.councils.find(c => c.suburbs.includes(suburb.slug));
  return profileForCouncilSlug(council ? council.slug : '');
}

function serviceAreaPanel(profile, areaName, hubUrl) {
  return `<section class="section">
<div class="container">
<div class="loc-service-grid">
<div class="loc-service-card">
<div class="section-badge">Verified Service Coverage</div>
<h2 class="section-title">${areaName} <span>Taxi Service Area</span></h2>
<p>${areaName} is covered by our <strong>${profile.label}</strong> for premium taxi bookings, airport transfers, corporate travel and 24/7 fixed fare requests.</p>
<p class="loc-service-focus"><strong>Popular services:</strong> ${profile.seoFocus}.</p>
<p>Book direct for confirmed pricing, dispatch support and a premium transfer pathway tailored to ${areaName} customers.</p>
<div class="loc-internal-links">
<a href="/">Home</a>
<a href="/book">Book Online</a>
<a href="${hubUrl}">Council Hub</a>
<a href="/locations/sydney-airport/">Sydney Airport Transfers</a>
<a href="/locations/western-sydney-airport/">Western Sydney Airport Transfers</a>
</div>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px">
<a class="btn btn-gold" href="/book">${ICON_BOOK} Book ${areaName} Taxi</a>
<a class="btn btn-outline" href="tel:1800173171" onclick="return trackPhoneCall('service-${profile.key}')">${ICON_PHONE} Call ${PHONE}</a>
</div>
</div>
<div class="loc-service-proof">
<h3>Book Direct for ${areaName} Transfers</h3>
<p>Fast airport transfers, corporate pickups and local taxi bookings with clear conversion paths for customers ready to travel.</p>
<div class="loc-proof-list">
<div class="loc-proof-item">${ICON_PRICE}<span>Fixed fare quotes before pickup</span></div>
<div class="loc-proof-item">${ICON_CLOCK}<span>24/7 airport and local dispatch</span></div>
<div class="loc-proof-item">${ICON_SHIELD}<span>Secure direct booking pathway with premium service support</span></div>
<div class="loc-proof-item">${ICON_CAR}<span>Silver service sedans, SUVs and maxi taxi options</span></div>
</div>
</div>
</div>
</div>
</section>`;
}

function localSeoSchema(profile, pageName, canonical, areaServed) {
  const graph = [
    {
      '@type': ['LocalBusiness', 'TaxiService'],
      '@id': `${canonical}#localbusiness`,
      name: pageName,
      url: canonical,
      logo: `${SITE}/images/logo.png`,
      telephone: '+611800173171',
      priceRange: '$$',
      areaServed: { '@type': 'AdministrativeArea', name: areaServed },
      serviceArea: { '@type': 'AdministrativeArea', name: profile.serviceArea },
      slogan: profile.seoFocus,
      openingHours: 'Mo-Su 00:00-23:59'
    },
    {
      '@type': 'Service',
      '@id': `${canonical}#service`,
      name: `Silver service taxi, airport transfer and chauffeur service for ${areaServed}`,
      serviceType: ['Airport Transfers', 'Corporate Transfers', 'Cruise Transfers', 'Hotel Transfers', 'Event Transfers', 'Long Distance Transfers', 'Parcel Delivery', '24/7 Taxi Services'],
      provider: { '@id': `${canonical}#localbusiness` },
      areaServed: { '@type': 'AdministrativeArea', name: areaServed }
    },
    {
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      name: 'Silver Taxi Sydney Service',
      url: SITE,
      logo: `${SITE}/images/logo.png`,
      telephone: '+611800173171'
    }
  ];
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

function councilServiceSections(name) {
  return `<section class="section">
<div class="container">
<div class="section-badge">Services</div>
<h2 class="section-title">Silver Service Taxi <span>${name}</span></h2>
<div class="loc-routes-grid">
${['Airport Transfers','Corporate Transfers','Cruise Transfers','Hotel Transfers','Event Transfers','Long Distance Transfers','Parcel Delivery','24/7 Taxi Services'].map(service => `<div class="loc-route-card"><div class="loc-route-from">${service}</div><div class="loc-route-meta">Premium fixed-fare ${service.toLowerCase()} across ${name}.</div></div>`).join('')}
</div>
</div>
</section>`;
}

// ═══════════════════════════════════════════════════
// SUBURB PAGE
// ═══════════════════════════════════════════════════
function generateSuburbPage(suburb) {
  const name = suburb.name;
  const slug = suburb.slug;
  const council = data.councils.find(c => c.suburbs.includes(slug));
  const councilName = council ? council.name : 'Sydney';
  const councilSlug = council ? council.slug : '';
  const airportKm = suburb.airportKm || 20;
  const wsiKm = suburb.westernAirportKm || 55;
  const fare = fareRange(airportKm);
  const wsiFare = fareRange(wsiKm);

  const title = `Silver Taxi ${name} | Fixed Fares & Airport Transfers | Silver Taxi Sydney Service`;
  const desc = `Book premium silver service taxi in ${name}. Fixed fare from $${fare.from} to Sydney Airport. 24/7 service, luxury vehicles, professional chauffeurs. Call ${PHONE}.`;
  const canonical = `${SITE}/locations/${slug}/`;
  const profile = profileForSuburb(suburb);
  const hubUrl = councilSlug ? `/locations/${councilSlug}/` : '/locations/';

  // Schema
  const schemas = `${localSeoSchema(profile, `Silver Taxi ${name}`, canonical, `${name}, ${councilName}, NSW`)}
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"Locations","item":"${SITE}/locations/"},{"@type":"ListItem","position":3,"name":"${councilName}","item":"${SITE}/locations/${councilSlug}/"},{"@type":"ListItem","position":4,"name":"${name}","item":"${canonical}"}]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How much is a taxi from ${name} to Sydney Airport?","acceptedAnswer":{"@type":"Answer","text":"Fixed fare from ${name} to Sydney Airport is approximately $${fare.from}\u2013$${fare.to} depending on vehicle type."}},{"@type":"Question","name":"Is Silver Service available 24/7 in ${name}?","acceptedAnswer":{"@type":"Answer","text":"Yes, we operate 24/7 across ${name} and all ${councilName} suburbs."}},{"@type":"Question","name":"What vehicles are available in ${name}?","acceptedAnswer":{"@type":"Answer","text":"Premium sedans, Lexus luxury sedans, SUVs, and maxi taxis for groups up to 11 passengers."}}]}
</script>`;

  // Content
  const llm = loadContent(slug);
  let mainContent;
  if (llm && llm.content) {
    mainContent = llm.content;
  } else {
    mainContent = defaultContent(suburb, councilName, fare, wsiFare);
  }

  // Routes
  const cbdKm = Math.max(airportKm - 3, 5);
  const routes = [
    { from: name, to: 'Sydney Airport (SYD)', km: airportKm, fare: fare },
    { from: name, to: 'Western Sydney Airport (WSI)', km: wsiKm, fare: wsiFare },
    { from: name, to: 'Sydney CBD', km: cbdKm, fare: fareRange(cbdKm) },
  ];

  // Nearby
  const nearby = (suburb.nearbySuburbs || []).slice(0, 8);

  // FAQs
  const faqs = [
    { q: `How much is a silver taxi from ${name} to Sydney Airport?`, a: `Our fixed fare from ${name} to Sydney Airport is approximately $${fare.from}\u2013$${fare.to} AUD depending on vehicle type. No meters, no surge. <a href="/book">Book online</a> for instant quote.` },
    { q: `Is Silver Service available 24/7 in ${name}?`, a: `Yes, we operate 24 hours a day, 7 days a week across ${name} and all ${councilName} suburbs including public holidays.` },
    { q: `What vehicles can I book in ${name}?`, a: `Toyota Camry Hybrid sedans, Lexus ES300h luxury sedans, SUVs (Toyota Kluger), and maxi taxis for groups up to 11 passengers.` },
    { q: `How do I book a taxi in ${name}?`, a: `<a href="/book">Book online</a> in under 30 seconds, or call <a href="tel:1800173171">${PHONE}</a> anytime. Instant confirmation with driver details.` },
  ];

  let html = HEAD_START(title, desc, canonical, schemas);
  html += TOP_BAR;
  html += NAVBAR;

  // page-hero (same as about.html)
  html += premiumHero({
  badge: `#1 Rated Taxi in ${name}`,
  title: `Silver Service Taxi ${name}`,
  sub: `Book a premium silver service taxi in ${name} for airport transfers, corporate travel and local rides. Fixed fares from $${fare.from} to Sydney Airport with 24/7 online booking.`,
  primaryHref: `/book?pickup=${encodeURIComponent(name+', NSW')}`,
  primaryText: `Book ${name} Taxi`,
  secondaryHref: 'tel:1800173171',
  secondaryText: `Call ${PHONE}`,
  proof: [
    { icon: ICON_LOCATION, title: `${name} Coverage`, text: `${councilName} pickup and drop-off service` },
    { icon: ICON_PRICE, title: `Airport Fare From $${fare.from}`, text: `Fixed quote to Sydney Airport` },
    { icon: ICON_CLOCK, title: 'Instant Booking', text: 'Book online or call dispatch 24/7' },
  ]
});

  // Breadcrumb (same as about.html)
  html += `<div class="breadcrumb"><div class="breadcrumb-inner container">
<a href="/">Home</a>${CHEV}<a href="/locations/">Locations</a>${CHEV}<a href="/locations/${councilSlug}/">${councilName}</a>${CHEV}<span>${name}</span>
</div></div>`;

  // Main content section
  html += `<section class="section">
<div class="container">
<div class="loc-content" style="max-width:800px;margin:0 auto">
${mainContent}
</div>
</div>
</section>`;

  html += serviceAreaPanel(profile, name, hubUrl);

  // Routes section
  html += `<section class="section" style="background:var(--off,#f9fafb)">
<div class="container">
<div class="section-badge">Popular Routes</div>
<h2 class="section-title">Fixed-Price <span>Transfers</span> from ${name}</h2>
<div class="loc-routes-grid">
${routes.map(r => `<div class="loc-route-card">
<div class="loc-route-from">${r.from} \u2192 ${r.to}</div>
<div class="loc-route-meta">~${r.km}km | Fixed fare</div>
<div class="loc-route-fare">From $${r.fare.from} (sedan) | $${r.fare.to} (SUV)</div>
</div>`).join('')}
</div>
<div style="text-align:center;margin-top:24px"><a class="btn btn-gold" href="/book?pickup=${encodeURIComponent(name+', NSW')}">Get Instant Quote</a></div>
</div>
</section>`;

  // Nearby suburbs
  if (nearby.length > 0) {
    html += `<section class="section">
<div class="container">
<div class="section-badge">Nearby</div>
<h2 class="section-title">Taxi Service in <span>Nearby Suburbs</span></h2>
<div class="loc-nearby-grid">
${nearby.map(s => {
  const n = s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `<a class="loc-nearby-link" href="/locations/${s}/">${n}</a>`;
}).join('')}
</div>
</div>
</section>`;
  }

  // FAQ
  html += `<section class="section" style="background:var(--off,#f9fafb)">
<div class="container">
<div class="section-badge">FAQ</div>
<h2 class="section-title">Frequently Asked <span>Questions</span></h2>
<div class="loc-faq">
${faqs.map(f => `<div class="loc-faq-item">
<div class="loc-faq-q">${f.q} ${CHEV_DOWN}</div>
<div class="loc-faq-a">${f.a}</div>
</div>`).join('')}
</div>
</div>
</section>`;

  // CTA
  html += `<section class="section section-dark" style="text-align:center">
<div class="container">
<div class="section-badge" style="color:var(--gold,#A8B4C0)">Ready to Ride?</div>
<h2 class="section-title" style="color:#fff">Book Your Silver Taxi in <span>${name}</span></h2>
<p style="color:rgba(255,255,255,.7);max-width:500px;margin:0 auto 24px">Fixed fares. Professional chauffeurs. Available 24/7.</p>
<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
<a class="btn btn-gold" href="/book?pickup=${encodeURIComponent(name+', NSW')}">Book Online Now</a>
<a class="btn btn-outline" style="border-color:rgba(255,255,255,.3);color:#fff" href="tel:1800173171">Call ${PHONE}</a>
</div>
</div>
</section>`;

  html += FOOTER;
  html += PAGE_END;
  return html;
}

function defaultContent(suburb, councilName, fare, wsiFare) {
  const name = suburb.name;
  const airportKm = suburb.airportKm || 20;
  const wsiKm = suburb.westernAirportKm || 55;
  const stations = (suburb.trainStations || []).join(', ') || `${name} Station`;
  const landmarks = (suburb.landmarks || []).join(', ') || name;

  return `<h2>Premium Silver Service Taxi in ${name}</h2>
<p>${name} is proudly serviced by Silver Taxi Sydney Service \u2014 Sydney's premier taxi and chauffeur company. As part of the ${councilName} local government area, ${name} benefits from our comprehensive coverage across all suburbs in the council. We provide <a href="/airport-transfers">airport transfers</a>, corporate travel, point-to-point rides, and special event transport 24 hours a day, 7 days a week.</p>
<p>Our fleet of premium vehicles \u2014 including Toyota Camry Hybrid sedans, Lexus ES300h luxury sedans, family SUVs, and maxi taxis \u2014 ensures you travel in comfort. All fares are fixed before you travel, with no meters, no surge pricing, and no hidden charges.</p>

<h2>Airport Transfers from ${name}</h2>
<p>Located approximately ${airportKm}km from Sydney Airport (SYD), ${name} is well-serviced by our fleet. Our fixed fare from ${name} to Sydney Airport is $${fare.from}\u2013$${fare.to}. This includes flight monitoring, meet and greet service at arrivals, and complimentary waiting time.</p>
<p>We also provide transfers to <a href="/locations/western-sydney-airport/">Western Sydney International Airport</a> at Luddenham (approximately ${wsiKm}km), with fares from $${wsiFare.from}.</p>

<h3>Key Locations Near ${name}</h3>
<ul>
<li><strong>Transport:</strong> ${stations}</li>
<li><strong>Landmarks:</strong> ${landmarks}</li>
${suburb.hospitals && suburb.hospitals.length ? `<li><strong>Hospitals:</strong> ${suburb.hospitals.join(', ')}</li>` : ''}
${suburb.shoppingCentres && suburb.shoppingCentres.length ? `<li><strong>Shopping:</strong> ${suburb.shoppingCentres.join(', ')}</li>` : ''}
</ul>

<h2>Why Choose Silver Service in ${name}?</h2>
<ul>
<li>Fixed-price fares \u2014 no meters, no surge pricing</li>
<li>Professional, licensed chauffeurs</li>
<li>24/7 availability including public holidays</li>
<li>Flight monitoring for airport pickups</li>
<li>Free waiting time on arrival</li>
<li>Clean, modern, well-maintained vehicles</li>
<li>Instant booking confirmation</li>
<li>Secure online payment</li>
</ul>`;
}

// ═══════════════════════════════════════════════════
// COUNCIL PAGE
// ═══════════════════════════════════════════════════
function generateCouncilPage(council, slugDir) {
  slugDir = slugDir || council.slug;
  const name = council.name;
  const suburbs = council.suburbs;
  const title = `Silver Taxi ${name} | All ${suburbs.length} Suburbs | Silver Taxi Sydney Service`;
  const desc = `Premium silver service taxi covering all ${suburbs.length} suburbs in ${name}. Fixed airport fares, 24/7 service. Book online or call ${PHONE}.`;
  const canonical = `${SITE}/locations/${slugDir}/`;
  const profile = profileForCouncilSlug(council.slug);

  const schema = `${localSeoSchema(profile, `Silver Service Taxi ${name}`, canonical, `${name}, NSW`)}
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"Locations","item":"${SITE}/locations/"},{"@type":"ListItem","position":3,"name":"${name}","item":"${canonical}"}]}
</script>`;

  let html = HEAD_START(title, desc, canonical, schema);
  html += TOP_BAR;
  html += NAVBAR;

  html += premiumHero({
  badge: `${suburbs.length} Suburbs Covered`,
  title: `Silver Service Taxi ${name}`,
  sub: `Book premium silver service taxis across ${name}. Fixed airport fares, professional chauffeurs, luxury vehicles and 24/7 Sydney-wide coverage across all ${suburbs.length} suburbs.`,
  primaryHref: '/book',
  primaryText: `Book ${name} Taxi`,
  secondaryHref: 'tel:1800173171',
  secondaryText: `Call ${PHONE}`,
  proof: [
    { icon: ICON_LOCATION, title: `${suburbs.length} Local Suburbs`, text: `Complete ${name} taxi coverage` },
    { icon: ICON_PLANE, title: 'Airport Transfers', text: 'Fixed fares to SYD and Western Sydney Airport' },
    { icon: ICON_SHIELD, title: 'Professional Drivers', text: 'Premium silver service experience' },
  ]
});

  html += `<div class="breadcrumb"><div class="breadcrumb-inner container">
<a href="/">Home</a>${CHEV}<a href="/locations/">Locations</a>${CHEV}<span>${name}</span>
</div></div>`;

  html += `<section class="section">
<div class="container">
<div class="section-badge">All Suburbs</div>
<h2 class="section-title">Taxi Service Across <span>${name}</span></h2>
<p style="color:var(--mid,#6b7280);max-width:600px;margin:0 auto 20px;text-align:center">Click any suburb for local taxi service details, fares, and instant booking.</p>
<div class="loc-suburb-tags">
${suburbs.map(s => {
  const n = s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `<a class="loc-suburb-tag" href="/locations/${s}/">${n}</a>`;
}).join('')}
</div>
</div>
</section>`;

  html += `<section class="section" style="background:var(--off,#f9fafb)">
<div class="container">
<div class="loc-content" style="max-width:800px;margin:0 auto">
<h2>About Our Service in ${name}</h2>
<p>Silver Taxi Sydney Service provides premium taxi and chauffeur services across all ${suburbs.length} suburbs in ${name}. Whether you need an <a href="/airport-transfers">airport transfer</a>, a corporate pickup, or a comfortable ride across Sydney, our professional chauffeurs are ready 24/7.</p>
<p>All fares are fixed before you travel \u2014 no meters, no surge pricing. <a href="/book">Book online</a> for instant confirmation, or call <a href="tel:1800173171">${PHONE}</a> anytime.</p>
</div>
</div>
</section>`;

  html += councilServiceSections(name);
  html += serviceAreaPanel(profile, name, `/locations/${slugDir}/`);

  html += `<section class="section section-dark" style="text-align:center">
<div class="container">
<h2 class="section-title" style="color:#fff">Book Your Taxi in <span>${name}</span></h2>
<p style="color:rgba(255,255,255,.7);margin-bottom:24px">Fixed fares across all ${suburbs.length} suburbs. Available 24/7.</p>
<a class="btn btn-gold" href="/book">Book Online Now</a>
</div>
</section>`;


  html += FOOTER;
  html += PAGE_END;
  return html;
}

// ═══════════════════════════════════════════════════
// HUB PAGE
// ═══════════════════════════════════════════════════
function generateHubPage() {
  const title = 'Sydney Taxi Locations | Silver Service Taxi Sydney | Book Online';
  const desc = `Find Silver Service Taxi Sydney coverage across ${data.suburbs.length}+ suburbs and ${data.councils.length} council areas. Book airport transfers, silver taxi Sydney rides and 24/7 service online.`;
  const canonical = `${SITE}/locations/`;

  const schema = `<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"Locations","item":"${canonical}"}]}
</script>`;

  let html = HEAD_START(title, desc, canonical, schema);
  html += TOP_BAR;
  html += NAVBAR;

  html += premiumHero({
  badge: `${data.suburbs.length}+ Sydney Suburbs`,
  title: 'Silver Service Taxi Sydney Locations',
  sub: 'Find and book Silver Service Taxi Sydney coverage across metropolitan Sydney. Choose fixed-fare airport transfers, premium silver taxi Sydney rides and 24/7 professional chauffeurs from your suburb.',
  primaryHref: '/book',
  primaryText: 'Book Your Sydney Taxi',
  secondaryHref: '/silver-service-taxi-sydney',
  secondaryText: 'Silver Service Taxi Sydney',
  proof: [
    { icon: ICON_LOCATION, title: `${data.suburbs.length}+ Suburbs`, text: 'Sydney-wide coverage from one booking hub' },
    { icon: ICON_PLANE, title: 'Airport Transfer Pages', text: 'SYD, WSA and priority routes' },
    { icon: ICON_BOOK, title: 'Online Booking', text: 'Instant quote and confirmation' },
  ]
});

  html += `<div class="breadcrumb"><div class="breadcrumb-inner container">
<a href="/">Home</a>${CHEV}<span>Locations</span>
</div></div>`;

  // Priority commercial services
  html += `<section class="section">
<div class="container">
<div class="section-badge">Priority Services</div>
<h2 class="section-title">Priority <span>Sydney Taxi Services</span></h2>
<p style="color:var(--mid,#6b7280);max-width:760px;margin:0 auto 22px;text-align:center">Start with the highest-demand booking pages for Silver Service Taxi Sydney, Silver Taxi Sydney, airport transfers and online reservations.</p>
<div class="loc-council-grid">
<a class="loc-council-card" href="/silver-service-taxi-sydney"><h3>Silver Service Taxi Sydney</h3><p>Premium silver service Sydney bookings</p></a>
<a class="loc-council-card" href="/silver-taxi-sydney"><h3>Silver Taxi Sydney</h3><p>Book premium silver taxi rides 24/7</p></a>
<a class="loc-council-card" href="/airport-transfers"><h3>Airport Transfers</h3><p>Fixed-fare SYD and WSA pickups</p></a>
<a class="loc-council-card" href="/book"><h3>Book Online</h3><p>Instant quote and confirmation</p></a>
</div>
</div>
</section>`;

  // Airport section
  html += `<section class="section">
<div class="container">
<div class="section-badge">Airport Transfers</div>
<h2 class="section-title">Sydney <span>Airport</span> Services</h2>
<div class="loc-council-grid">
${data.airports.map(a => `<a class="loc-council-card" href="/locations/${a.slug}/"><h3>${a.name}</h3><p>${a.code} \u2014 Airport Transfers</p></a>`).join('')}
</div>
</div>
</section>`;

  // Council areas
  html += `<section class="section" style="background:var(--off,#f9fafb)">
<div class="container">
<div class="section-badge">By Council Area</div>
<h2 class="section-title">All <span>Service Areas</span></h2>
<div class="loc-council-grid">
${data.councils.map(c => `<a class="loc-council-card" href="/locations/${c.slug}/"><h3>${c.name}</h3><p>${c.suburbs.length} suburbs</p></a>`).join('')}
</div>
</div>
</section>`;

  html += `<section class="section section-dark" style="text-align:center">
<div class="container">
<h2 class="section-title" style="color:#fff">Can't Find Your <span>Suburb</span>?</h2>
<p style="color:rgba(255,255,255,.7);margin-bottom:24px">We cover all of Sydney. Book online and enter any pickup address, or compare <a href="/silver-service-taxi-sydney" style="color:var(--gold,#A8B4C0);font-weight:700">Silver Service Taxi Sydney</a> and <a href="/silver-taxi-sydney" style="color:var(--gold,#A8B4C0);font-weight:700">Silver Taxi Sydney</a> services.</p>
<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a class="btn btn-gold" href="/book">Book Online Now</a><a class="btn btn-outline" style="border-color:rgba(255,255,255,.3);color:#fff" href="/airport-transfers">Airport Transfers</a></div>
</div>
</section>`;

  html += FOOTER;
  html += PAGE_END;
  return html;
}

// ═══════════════════════════════════════════════════
// AIRPORT PAGE
// ═══════════════════════════════════════════════════
function generateAirportPage(airport) {
  const name = airport.name;
  const slug = airport.slug;
  const code = airport.code;
  const isSYD = code === 'SYD';
  const title = `${name} Transfers | Fixed Fares | Silver Taxi Sydney Service`;
  const desc = `Book fixed-price taxi transfers to/from ${name} (${code}). Professional chauffeurs, flight monitoring, meet & greet. Available 24/7. Call ${PHONE}.`;
  const canonical = `${SITE}/locations/${slug}/`;

  const profile = isSYD ? SERVICE_AREAS.sydneyAirport : SERVICE_AREAS.westernSydneyAirport;
  const schema = `${localSeoSchema(profile, `${name} Transfers`, canonical, `${name} transfers and airport service areas`)}
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":"Locations","item":"${SITE}/locations/"},{"@type":"ListItem","position":3,"name":"${name}","item":"${canonical}"}]}
</script>`;

  // Popular routes - different suburbs for each airport
  const popularSlugs = isSYD
    ? ['sydney-cbd','parramatta','bondi','chatswood','penrith','liverpool','campbelltown','manly','cronulla','hurstville','blacktown','castle-hill','hornsby','bankstown','strathfield']
    : ['penrith','liverpool','campbelltown','camden','blacktown','parramatta','narellan','ingleburn','glenmore-park','st-marys','mount-annan','leppington','oran-park','katoomba','springwood'];

  let html = HEAD_START(title, desc, canonical, schema);
  html += TOP_BAR;
  html += NAVBAR;

  html += premiumHero({
  badge: `${code} Airport Transfers`,
  title: `${name} Transfers`,
  sub: `Book fixed-price taxi transfers to and from ${name} (${code}) with flight monitoring, meet and greet, premium vehicles and 24/7 airport pickup coverage.`,
  primaryHref: `/book?dropoff=${encodeURIComponent(airport.address || name)}`,
  primaryText: `Book ${code} Transfer`,
  secondaryHref: 'tel:1800173171',
  secondaryText: `Call ${PHONE}`,
  proof: [
    { icon: ICON_PLANE, title: `${code} Airport Pickup`, text: 'Domestic and international transfer service' },
    { icon: ICON_CLOCK, title: 'Flight Monitoring', text: 'Driver timing aligned to your arrival' },
    { icon: ICON_PRICE, title: 'Fixed Fare Booking', text: 'Know the price before you travel' },
  ]
});

  html += `<div class="breadcrumb"><div class="breadcrumb-inner container">
<a href="/">Home</a>${CHEV}<a href="/locations/">Locations</a>${CHEV}<span>${name}</span>
</div></div>`;

  // About section
  html += `<section class="section">
<div class="container">
<div class="loc-content" style="max-width:800px;margin:0 auto">
<h2>About ${name}</h2>
<p>${isSYD
  ? 'Sydney Airport (SYD) is located at Airport Drive, Mascot NSW 2020. It is Australia\'s busiest airport, handling over 40 million passengers annually. Silver Taxi Sydney Service provides premium fixed-fare transfers to and from both the Domestic and International terminals.'
  : 'Western Sydney International Airport (WSI) is located at 100 Eaton Rd, Luddenham NSW 2745. This brand-new airport serves Western Sydney and provides an alternative to Sydney\'s Kingsford Smith Airport. Silver Taxi Sydney Service offers fixed-fare transfers from all Sydney suburbs.'
}</p>
<h3>Our Airport Transfer Service Includes:</h3>
<ul>
<li>Fixed fares \u2014 no meters, no surge pricing</li>
<li>Flight monitoring \u2014 we track your arrival in real-time</li>
<li>Meet & greet at arrivals</li>
<li>Free waiting time (60 min international, 30 min domestic)</li>
<li>Professional uniformed chauffeurs</li>
<li>Premium vehicles: sedan, SUV, maxi taxi</li>
<li>24/7 availability including public holidays</li>
</ul>
</div>
</div>
</section>`;

  html += serviceAreaPanel(profile, `${name} Transfers`, '/locations/');

  // Popular routes
  const routeCards = popularSlugs.map(s => {
    const sub = data.suburbs.find(x => x.slug === s);
    if (!sub) return '';
    const km = isSYD ? (sub.airportKm || 20) : (sub.westernAirportKm || 55);
    const f = fareRange(km);
    return `<div class="loc-route-card">
<div class="loc-route-from"><a href="/locations/${s}/" style="color:inherit;text-decoration:none">${sub.name}</a> \u2192 ${code}</div>
<div class="loc-route-meta">~${km}km | Fixed fare</div>
<div class="loc-route-fare">From $${f.from} (sedan) | $${f.to} (SUV)</div>
</div>`;
  }).filter(Boolean).join('');

  html += `<section class="section" style="background:var(--off,#f9fafb)">
<div class="container">
<div class="section-badge">Popular Routes</div>
<h2 class="section-title">Fixed-Price Transfers to <span>${code}</span></h2>
<p style="color:var(--mid,#6b7280);text-align:center;margin-bottom:16px">All fares include GST. Book online for instant quote.</p>
<div class="loc-routes-grid">${routeCards}</div>
<div style="text-align:center;margin-top:24px"><a class="btn btn-gold" href="/book?dropoff=${encodeURIComponent(airport.address || name)}">Get Instant Quote</a></div>
</div>
</section>`;

  html += `<section class="section section-dark" style="text-align:center">
<div class="container">
<h2 class="section-title" style="color:#fff">Book Your <span>${code}</span> Transfer Now</h2>
<p style="color:rgba(255,255,255,.7);margin-bottom:24px">Fixed fares from any Sydney suburb. Instant confirmation.</p>
<a class="btn btn-gold" href="/book?dropoff=${encodeURIComponent(airport.address || name)}">Book Airport Transfer</a>
</div>
</section>`;

  html += FOOTER;
  html += PAGE_END;
  return html;
}

// ═══════════════════════════════════════════════════
// EXECUTE GENERATION
// ═══════════════════════════════════════════════════
if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

let count = 0;

// Hub page
fs.writeFileSync(path.join(outputDir, 'index.html'), generateHubPage());
count++;

// Council pages
for (const council of data.councils) {
  const suburbExists = data.suburbs.some(s => s.slug === council.slug);
  const slugDir = suburbExists ? `council-${council.slug}` : council.slug;
  const dir = path.join(outputDir, slugDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), generateCouncilPage(council, slugDir));
  count++;
}

// Suburb pages
for (const suburb of data.suburbs) {
  const dir = path.join(outputDir, suburb.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), generateSuburbPage(suburb));
  count++;
}

// Airport pages
for (const airport of data.airports) {
  const dir = path.join(outputDir, airport.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), generateAirportPage(airport));
  count++;
}

console.log(`\n=== GENERATION COMPLETE ===`);
console.log(`Total pages generated: ${count}`);
console.log(`  Suburbs: ${data.suburbs.length}`);
console.log(`  Councils: ${data.councils.length}`);
console.log(`  Airports: ${data.airports.length}`);
console.log(`  Hub: 1`);
