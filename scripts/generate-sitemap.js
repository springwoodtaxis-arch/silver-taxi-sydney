/**
 * Generate XML Sitemap and HTML Sitemap for all location pages
 * Also generates RSS feed for indexing
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'suburb-details.json'), 'utf8'));
const SITE_URL = 'https://silvertaxisydneyservice.com';
const today = new Date().toISOString().split('T')[0];

// ============ XML SITEMAP ============
let xmlEntries = [];

// Main pages (high priority)
const mainPages = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/book', priority: '0.9', changefreq: 'weekly' },
  { url: '/locations/', priority: '0.9', changefreq: 'weekly' },
  { url: '/airport-transfers', priority: '0.9', changefreq: 'weekly' },
  { url: '/services', priority: '0.8', changefreq: 'monthly' },
  { url: '/contact', priority: '0.7', changefreq: 'monthly' },
  { url: '/about', priority: '0.6', changefreq: 'monthly' },
  { url: '/silver-service-taxi-sydney', priority: '0.8', changefreq: 'weekly' },
  { url: '/silver-taxi-sydney', priority: '0.8', changefreq: 'weekly' },
];

mainPages.forEach(p => {
  xmlEntries.push(`  <url>
    <loc>${SITE_URL}${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
});

// Airport pages
data.airports.forEach(a => {
  xmlEntries.push(`  <url>
    <loc>${SITE_URL}/locations/${a.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`);
});

// Council pages
data.councils.forEach(c => {
  const suburbExists = data.suburbs.some(s => s.slug === c.slug);
  const slugDir = suburbExists ? `council-${c.slug}` : c.slug;
  xmlEntries.push(`  <url>
    <loc>${SITE_URL}/locations/${slugDir}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
});

// Suburb pages
data.suburbs.forEach(s => {
  xmlEntries.push(`  <url>
    <loc>${SITE_URL}/locations/${s.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
});

// Existing taxi pages
const existingPages = fs.readdirSync(path.join(__dirname, '..', 'public'))
  .filter(f => f.startsWith('taxi-') && f.endsWith('.html'))
  .map(f => f.replace('.html', ''));

existingPages.forEach(p => {
  xmlEntries.push(`  <url>
    <loc>${SITE_URL}/${p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
});

const xmlSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${xmlEntries.join('\n')}
</urlset>`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'sitemap.xml'), xmlSitemap);
console.log(`XML Sitemap generated: ${xmlEntries.length} URLs`);

// ============ HTML SITEMAP ============
let htmlSections = '';

// Council sections with suburb links
data.councils.forEach(c => {
  const suburbExists = data.suburbs.some(s => s.slug === c.slug);
  const slugDir = suburbExists ? `council-${c.slug}` : c.slug;
  
  let suburbLinks = c.suburbs.map(s => {
    const name = s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `        <li><a href="/locations/${s}/">${name}</a></li>`;
  }).join('\n');
  
  htmlSections += `
    <div class="sitemap-council">
      <h3><a href="/locations/${slugDir}/">${c.name}</a></h3>
      <ul>
${suburbLinks}
      </ul>
    </div>`;
});

const htmlSitemap = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Sitemap | Silver Taxi Sydney Service — All Sydney Taxi Locations</title>
<meta name="description" content="Complete sitemap of Silver Taxi Sydney Service. Browse all 350+ Sydney suburb taxi service pages, council areas, and airport transfer routes."/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="${SITE_URL}/sitemap-html"/>
<link rel="icon" href="/images/logo.png" type="image/png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/style.css"/>
<link rel="stylesheet" href="/locations-style.css"/>
</head>
<body class="loc-page" style="background:#fff">
<div class="top-bar">
<div class="top-bar-inner">
<div class="top-bar-left">
<div class="top-bar-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"></path><circle cx="12" cy="10" r="3"></circle></svg>Sydney, NSW, Australia</div>
<div class="top-bar-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>Available 24/7 — 365 Days</div>
</div>
<div class="top-bar-right">
<div class="top-bar-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z"></path></svg><a href="tel:1800173171">1800 173 171</a></div>
<div class="top-bar-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg><a href="mailto:info@silvertaxisydneyservice.com">info@silvertaxisydneyservice.com</a></div>
</div>
</div>
</div>
<nav class="navbar" id="navbar">
<div class="nav-inner">
<a class="nav-logo" href="/"><img src="/images/logo.png" alt="Silver Service Taxi Sydney Logo"/><div class="nav-logo-text"><span>Silver Service</span><span>Taxi Sydney</span></div></a>
<ul class="nav-menu" id="nav-menu">
<li><a class="nav-link" href="/">Home</a></li>
<li><a class="nav-link" href="/services">Services</a></li>
<li><a class="nav-link" href="/airport-transfers">Airport Transfers</a></li>
<li><a class="nav-link" href="/locations/">Locations</a></li>
<li><a class="nav-link" href="/about">About</a></li>
<li><a class="nav-link" href="/contact">Contact</a></li>
<li><a class="nav-link" href="/manage">Manage Booking</a></li>
<li><a class="nav-book-btn" href="/book">Book your Sydney taxi now</a></li>
</ul>
<button aria-label="Toggle menu" class="nav-toggle" id="nav-toggle"><span></span><span></span><span></span></button>
</div>
</nav>
<div class="sitemap-wrap">
  <h1>Sitemap — Silver Taxi Sydney Service</h1>
  
  <h2>Main Pages</h2>
  <div class="sitemap-main-links">
    <a href="/">Home</a>
    <a href="/book">Book Now</a>
    <a href="/locations/">All Locations</a>
    <a href="/airport-transfers">Airport Transfers</a>
    <a href="/services">Services</a>
    <a href="/contact">Contact</a>
    <a href="/about">About Us</a>
    <a href="/silver-service-taxi-sydney">Silver Service Taxi Sydney</a>
    <a href="/locations/sydney-airport/">Sydney Airport Transfers</a>
    <a href="/locations/western-sydney-airport/">Western Sydney Airport</a>
  </div>
  
  <h2>All Locations by Council Area</h2>
  ${htmlSections}
</div>
<footer class="footer"><div class="container"><div class="footer-bottom"><div class="footer-bottom-text">&copy; 2026 Silver Taxi Sydney — All Rights Reserved</div><div class="footer-bottom-links"><a href="/privacy-policy">Privacy Policy</a><a href="/terms-and-conditions">Terms &amp; Conditions</a></div></div></div></footer>
<script src="/shared.js"></script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'sitemap-html.html'), htmlSitemap);
console.log('HTML Sitemap generated');

// ============ RSS FEED ============
const rssItems = data.suburbs.slice(0, 50).map(s => `    <item>
      <title>Silver Service Taxi ${s.name} — Premium Airport Transfers</title>
      <link>${SITE_URL}/locations/${s.slug}/</link>
      <description>Premium silver service taxi in ${s.name}. Fixed airport fares, luxury vehicles, 24/7 service. Book online.</description>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <guid>${SITE_URL}/locations/${s.slug}/</guid>
    </item>`).join('\n');

const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Silver Taxi Sydney Service — Sydney Taxi Locations</title>
    <link>${SITE_URL}/locations/</link>
    <description>Premium silver service taxi covering 300+ Sydney suburbs. Fixed airport fares, luxury vehicles, 24/7 service.</description>
    <language>en-au</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'feed.xml'), rssFeed);
console.log('RSS Feed generated');

// ============ ROBOTS.TXT UPDATE ============
const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml

# Silver Taxi Sydney Service — Premium Taxi Sydney
# 300+ suburb pages indexed
`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'robots.txt'), robotsTxt);
console.log('robots.txt updated');

console.log('\\n=== ALL SEO FILES GENERATED ===');
