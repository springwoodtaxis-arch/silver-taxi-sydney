'use strict';
/**
 * SEO Competitor Intelligence — Silver Taxi Sydney Service
 *
 * Automatically:
 *  1. Scrapes 15 core + 9 secondary competitor pages for title, meta, H1, schema, word count
 *  2. Uses GPT-4.1-mini to generate AI gap analysis and action recommendations
 *  3. Sends daily email report with changes, new opportunities, and recommended actions
 *  4. Persists 30-day history of competitor data for trend analysis
 *
 * Scheduled: 7am AEST daily (21:00 UTC)
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL  = 'https://silvertaxisydneyservice.com';
const SITE_NAME = 'Silver Taxi Sydney Service';

const COMPETITORS_CORE = [
  // Big brands
  { name: 'Silver Service (Main)',     domain: 'silverservice.com.au',          url: 'https://www.silverservice.com.au/',                        category: 'brand' },
  { name: '13Cabs',                    domain: '13cabs.com.au',                 url: 'https://www.13cabs.com.au/',                               category: 'brand' },
  { name: 'Blacklane',                 domain: 'blacklane.com',                 url: 'https://www.blacklane.com/en/australia/',                  category: 'brand' },
  { name: 'Con-X-ion',                 domain: 'con-x-ion.com',                 url: 'https://www.con-x-ion.com/',                               category: 'direct' },
  { name: 'Airport Shuttle Sydney',    domain: 'airportshuttlesydney.com.au',   url: 'https://www.airportshuttlesydney.com.au/',                 category: 'direct' },
  { name: 'Sydney Airport Transfer',   domain: 'sydneyairporttransfer.com.au',  url: 'https://www.sydneyairporttransfer.com.au/',                category: 'seo' },
  { name: 'Go Airlink Shuttle',        domain: 'goairlinkshuttle.com',          url: 'https://www.goairlinkshuttle.com/',                        category: 'direct' },
  { name: 'Sydney Limousines',         domain: 'sydneylimousines.com.au',       url: 'https://www.sydneylimousines.com.au/',                     category: 'direct' },
  { name: 'Elite Limos',               domain: 'elitelimos.com.au',             url: 'https://www.elitelimos.com.au/',                           category: 'direct' },
  { name: 'Anywhere Transfers',        domain: 'anywheretransfers.com.au',      url: 'https://www.anywheretransfers.com.au/',                    category: 'direct' },
  { name: 'Airport Express',           domain: 'airportexpress.com.au',         url: 'https://www.airportexpress.com.au/',                       category: 'direct' },
  { name: 'East Coast Shuttles',       domain: 'eastcoastshuttles.com.au',      url: 'https://www.eastcoastshuttles.com.au/',                    category: 'direct' },
  { name: 'Sydney Airport Cars',       domain: 'sydneyairportcars.com.au',      url: 'https://www.sydneyairportcars.com.au/',                    category: 'seo' },
  { name: 'Premier Car Sydney',        domain: 'premiercarsydney.com.au',       url: 'https://www.premiercarsydney.com.au/',                     category: 'direct' },
  { name: 'Luxury Airport Transfer',   domain: 'luxuryairporttransfersydney.com.au', url: 'https://www.luxuryairporttransfersydney.com.au/',    category: 'seo' },
];

const COMPETITORS_SECONDARY = [
  { name: 'Silver Cab Sydney Online',  domain: 'silvercabsydneyonline.com.au',         url: 'https://silvercabsydneyonline.com.au/',               category: 'secondary' },
  { name: 'Silver Cab Sydney (www)',   domain: 'www.silvercabsydneyonline.com.au',      url: 'https://www.silvercabsydneyonline.com.au/',           category: 'secondary' },
  { name: 'Silver Cab Service Online', domain: 'silvercabsydneyserviceonline.com.au',   url: 'https://www.silvercabsydneyserviceonline.com.au/',    category: 'secondary' },
  { name: 'Silver Sydney Cab Online',  domain: 'silversydneycabonline.com.au',          url: 'https://silversydneycabonline.com.au/',               category: 'secondary' },
  { name: 'Sydney Airport Taxi Online',domain: 'sydneyairporttaxionline.com.au',        url: 'https://www.sydneyairporttaxionline.com.au/',         category: 'secondary' },
  { name: 'Book Airport Taxi',         domain: 'bookairporttaxi.com.au',                url: 'https://www.bookairporttaxi.com.au/',                 category: 'secondary' },
  { name: 'Sydney Affordable Transfer',domain: 'sydneyaffordableairporttransfer.com.au',url: 'https://www.sydneyaffordableairporttransfer.com.au/',category: 'secondary' },
  { name: 'Maxi Taxi Sydney Airport',  domain: 'maxitaxisydneyairport.com.au',          url: 'https://www.maxitaxisydneyairport.com.au/',           category: 'secondary' },
  { name: 'Sydney Airport Taxi',       domain: 'sydneyaairporttaxi.com.au',             url: 'https://www.sydneyaairporttaxi.com.au/',              category: 'secondary' },
];

const ALL_COMPETITORS = [...COMPETITORS_CORE, ...COMPETITORS_SECONDARY];

// Silver service brand keywords + premium/chauffeur intent + local geo
const TARGET_KEYWORDS = [
  // Brand keywords (intercept competitor brand searches)
  'silver service taxi sydney',
  'silver service airport transfer sydney',
  'silver service chauffeur sydney',
  'silver service cab sydney',
  'silver service booking sydney',
  'silver service airport pickup sydney',
  'silver service airport transfer',
  'silver service premium taxi',
  'silver service hire car sydney',
  // Premium / chauffeur intent
  'silver service luxury taxi sydney',
  'silver service executive car sydney',
  'silver service corporate taxi sydney',
  'silver service private driver sydney',
  'silver service premium airport transfer',
  'silver service business class taxi',
  'silver service vip airport transfer',
  // Local geo targets
  'silver service taxi sydney cbd',
  'silver service eastern suburbs taxi',
  'silver service western sydney taxi',
  'silver service taxi parramatta',
  'silver service taxi bondi',
  'silver service taxi chatswood',
  'silver service airport sydney',
  // Generic high-value
  'sydney airport taxi online booking',
  'sydney airport transfer book online',
  'sydney airport chauffeur service',
  'luxury airport transfer sydney',
  'private airport transfer sydney',
  'executive airport transfer sydney',
  'sydney airport to cbd taxi',
  'sydney airport maxi taxi booking',
];

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SEO_INTEL_FILE   = path.join(DATA_DIR, 'sso-seo-intel.json');
const SEO_HISTORY_FILE = path.join(DATA_DIR, 'sso-seo-intel-history.json');

function loadJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { console.warn('[SSO-SEOIntel] Load error:', e.message); }
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch(e) { console.warn('[SSO-SEOIntel] Save error:', e.message); }
}

let seoIntelStore = loadJSON(SEO_INTEL_FILE, {
  lastRun: null, competitors: [], aiAnalysis: null, changes: [], opportunities: [],
});
let seoHistory = loadJSON(SEO_HISTORY_FILE, []);

// ─────────────────────────────────────────────────────────────────────────────
// HTTP FETCH HELPER
// ─────────────────────────────────────────────────────────────────────────────

function fetchUrl(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0; +https://silvertaxisydneyservice.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ANALYSER
// ─────────────────────────────────────────────────────────────────────────────

function extractBetween(html, start, end) {
  const si = html.indexOf(start);
  if (si < 0) return '';
  const ei = html.indexOf(end, si + start.length);
  if (ei < 0) return '';
  return html.slice(si + start.length, ei).trim();
}
function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function analysePage(url) {
  const base = {
    url, title: '', metaDesc: '', h1: '', wordCount: 0,
    hasSchema: false, hasFAQSchema: false, hasReviewSchema: false,
    hasLocalBusinessSchema: false, hasOG: false, hasCanonical: false,
    loadedAt: new Date().toISOString(),
  };
  try {
    const html = await fetchUrl(url, 12000);
    const lower = html.toLowerCase();
    base.title    = stripTags(extractBetween(html, '<title>', '</title>')).slice(0, 120);
    const metaMatch = html.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']{0,300})["']/i)
      || html.match(/<meta\s[^>]*content=["']([^"']{0,300})["'][^>]*name=["']description["']/i);
    if (metaMatch) base.metaDesc = metaMatch[1].trim();
    const h1Match = html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i);
    if (h1Match) base.h1 = stripTags(h1Match[1]).slice(0, 100);
    const bodyMatch = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
    if (bodyMatch) base.wordCount = stripTags(bodyMatch[1]).split(/\s+/).filter(Boolean).length;
    base.hasSchema              = lower.includes('application/ld+json');
    base.hasFAQSchema           = lower.includes('"faqpage"') || lower.includes('"faq"');
    base.hasReviewSchema        = lower.includes('"review"') || lower.includes('"aggregaterating"');
    base.hasLocalBusinessSchema = lower.includes('"localbusiness"') || lower.includes('"taxiservice"');
    base.hasOG                  = lower.includes('og:title') || lower.includes('og:description');
    base.hasCanonical           = lower.includes('rel="canonical"') || lower.includes("rel='canonical'");
  } catch(e) {
    base.error = e.message;
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI GAP ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

async function runAIAnalysis(competitorData) {
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI.default({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    const summary = competitorData.map(c => ({
      name: c.name, domain: c.domain, category: c.category,
      title: c.analysis?.title || 'N/A',
      h1: c.analysis?.h1 || 'N/A',
      wordCount: c.analysis?.wordCount || 0,
      hasSchema: c.analysis?.hasSchema,
      hasFAQSchema: c.analysis?.hasFAQSchema,
      hasReviewSchema: c.analysis?.hasReviewSchema,
      error: c.analysis?.error,
    }));
    const prompt = `You are an expert SEO strategist for Silver Taxi Sydney Service (silvertaxisydneyservice.com), a premium Sydney taxi, chauffeur and airport transfer booking website.

SITE: Silver Taxi Sydney Service (silvertaxisydneyservice.com)
NICHE: Premium silver service taxi, chauffeur cars, and airport transfers in Sydney, Australia
KEY ADVANTAGE: Online booking system, competitive pricing vs Silver Service main brand, local Sydney focus

COMPETITOR DATA (scraped today — 15 core + 9 secondary competitors):
${JSON.stringify(summary, null, 2)}

TARGET KEYWORDS: silver service taxi sydney, silver service airport transfer, silver service chauffeur sydney, sydney airport taxi online booking, luxury airport transfer sydney

Provide a concise SEO action report with:
1. TOP 3 OPPORTUNITIES (specific content gaps or weaknesses in competitors we can exploit NOW)
2. TOP 3 IMMEDIATE ACTIONS (specific page titles, meta descriptions, or content to create/update)
3. BRAND KEYWORD STRATEGY (how to intercept silver service brand searches from the main brand)
4. SCHEMA ADVANTAGES (schema types we should add that competitors lack)
5. CONTENT RECOMMENDATIONS (specific blog posts, suburb pages, or FAQ content to create)

Be specific, actionable, and focused on outranking all 24 competitors. Format as plain text with clear headings.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1400,
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content || 'AI analysis unavailable';
  } catch(e) {
    console.error('[SSO-SEOIntel] AI analysis error:', e.message);
    return `AI analysis error: ${e.message}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECT CHANGES
// ─────────────────────────────────────────────────────────────────────────────

function detectChanges(current, previous) {
  const changes = [];
  for (const comp of current) {
    const prev = previous.find(p => p.domain === comp.domain);
    if (!prev || !prev.analysis || !comp.analysis) continue;
    if (prev.analysis.title !== comp.analysis.title && prev.analysis.title && comp.analysis.title) {
      changes.push(`${comp.name}: Title changed → "${comp.analysis.title}"`);
    }
    if (Math.abs((prev.analysis.wordCount || 0) - (comp.analysis.wordCount || 0)) > 200) {
      const diff = comp.analysis.wordCount - prev.analysis.wordCount;
      changes.push(`${comp.name}: Word count ${diff > 0 ? '+' : ''}${diff} (now ${comp.analysis.wordCount})`);
    }
    if (!prev.analysis.hasSchema && comp.analysis.hasSchema) {
      changes.push(`${comp.name}: Added JSON-LD schema — we should review our schema`);
    }
    if (!prev.analysis.hasFAQSchema && comp.analysis.hasFAQSchema) {
      changes.push(`${comp.name}: Added FAQ schema — we should add more FAQ content`);
    }
  }
  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND EMAIL REPORT
// ─────────────────────────────────────────────────────────────────────────────

async function sendSEOReport(data, aiAnalysis, changes) {
  try {
    const nodemailer = require('nodemailer');
    const cfg = (() => {
      try {
        const raw = require('fs').readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8');
        const env = {};
        raw.split('\n').forEach(l => { const [k,...v]=l.split('='); if(k) env[k.trim()]=v.join('=').trim(); });
        return env;
      } catch(e) { return process.env; }
    })();

    const smtpHost = cfg.SMTP_HOST || process.env.SMTP_HOST || 'smtp.hostinger.com';
    const smtpPort = parseInt(cfg.SMTP_PORT || process.env.SMTP_PORT || '465');
    const smtpUser = cfg.SMTP_USER || process.env.SMTP_USER || 'info@silvertaxisydneyservice.com';
    const smtpPass = cfg.SMTP_PASS || process.env.SMTP_PASS || '';

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const catColors = { brand: '#ef4444', direct: '#4f6ef7', seo: '#22c55e', shuttle: '#eab308', platform: '#a855f7', secondary: '#6b7280' };
    const compRows = data.competitors.map(c => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">
          <strong>${c.name}</strong><br>
          <span style="color:#888;font-size:11px">${c.domain}</span><br>
          <span style="background:${catColors[c.category]||'#888'};color:#fff;border-radius:3px;padding:1px 5px;font-size:10px">${c.category}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:11px;max-width:180px">${(c.analysis?.title||'N/A').slice(0,60)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:${(c.analysis?.wordCount||0)<500?'#e74c3c':'#333'}">${c.analysis?.wordCount||0}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${c.analysis?.hasSchema?'✅':'❌'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${c.analysis?.hasFAQSchema?'✅':'❌'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-size:11px">${c.analysis?.error?'⚠️ Err':'✅ OK'}</td>
      </tr>`).join('');

    const changesHtml = changes.length > 0
      ? `<h3 style="color:#e74c3c">🔄 ${changes.length} Competitor Change(s) Detected</h3>
         <ul>${changes.map(c=>`<li style="margin:6px 0;color:#c0392b">${c}</li>`).join('')}</ul>`
      : '<p style="color:#27ae60">✅ No significant competitor changes detected today.</p>';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;max-width:750px;margin:0 auto;padding:20px}
h1{color:#1a1a2e;border-bottom:3px solid #e74c3c;padding-bottom:10px}
h2{color:#1a1a2e;margin-top:28px}
table{width:100%;border-collapse:collapse;margin:14px 0}
th{background:#1a1a2e;color:#fff;padding:9px 8px;text-align:left;font-size:12px}
.ai-box{background:#f8f9fa;border-left:4px solid #e74c3c;padding:16px;border-radius:4px;white-space:pre-wrap;font-size:13px;line-height:1.65}
.footer{margin-top:28px;padding-top:18px;border-top:1px solid #eee;color:#888;font-size:11px}
</style></head>
<body>
<h1>🚗 Daily SEO Intelligence Report — Silver Taxi Sydney Service</h1>
<p><strong>silvertaxisydneyservice.com</strong> — ${new Date().toLocaleDateString('en-AU',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
<p>Monitoring <strong>${ALL_COMPETITORS.length} competitors</strong> (15 core + 9 secondary) across ${TARGET_KEYWORDS.length} target keywords including all silver service brand terms.</p>

${changesHtml}

<h2>🤖 AI SEO Analysis &amp; Recommendations</h2>
<div class="ai-box">${aiAnalysis.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>

<h2>📊 Competitor Snapshot (${data.competitors.length} sites analysed)</h2>
<table>
  <thead><tr><th>Competitor</th><th>Page Title</th><th>Words</th><th>Schema</th><th>FAQ</th><th>Status</th></tr></thead>
  <tbody>${compRows}</tbody>
</table>

<div class="footer">
  <p>Report generated: ${new Date().toLocaleString('en-AU',{timeZone:'Australia/Sydney'})} AEST</p>
  <p>View live dashboard: <a href="https://silvertaxisydneyservice.com/seo-dashboard">SEO Dashboard</a></p>
  <p>This report is sent automatically every day at 7am AEST.</p>
</div>
</body></html>`;

    await transporter.sendMail({
      from: `"SSO SEO Intelligence" <${smtpUser}>`,
      to: smtpUser,
      subject: `🚗 SEO Intelligence — ${new Date().toLocaleDateString('en-AU')} — ${changes.length} changes, ${data.competitors.length} sites`,
      html,
    });
    console.log('[SSO-SEOIntel] Daily report sent successfully');
  } catch(e) {
    console.error('[SSO-SEOIntel] Email send error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN INTELLIGENCE RUN
// ─────────────────────────────────────────────────────────────────────────────

async function runSEOIntelligence() {
  console.log('[SSO-SEOIntel] Starting competitor intelligence run...');
  const previousCompetitors = seoIntelStore.competitors || [];
  const results = [];

  for (const comp of ALL_COMPETITORS) {
    console.log(`[SSO-SEOIntel] Analysing ${comp.name} (${comp.url})...`);
    const analysis = await analysePage(comp.url);
    results.push({ ...comp, analysis, checkedAt: new Date().toISOString() });
    await new Promise(r => setTimeout(r, 2000)); // polite delay
  }

  const changes = detectChanges(results, previousCompetitors);
  console.log('[SSO-SEOIntel] Running AI gap analysis...');
  const aiAnalysis = await runAIAnalysis(results);

  const opportunities = results
    .filter(c => !c.analysis?.error)
    .map(c => {
      const gaps = [];
      if (!c.analysis?.hasFAQSchema) gaps.push('No FAQ schema');
      if (!c.analysis?.hasReviewSchema) gaps.push('No review schema');
      if (!c.analysis?.hasLocalBusinessSchema) gaps.push('No LocalBusiness schema');
      if ((c.analysis?.wordCount || 0) < 500) gaps.push('Thin content (<500 words)');
      if (!c.analysis?.hasCanonical) gaps.push('No canonical tag');
      return { name: c.name, domain: c.domain, category: c.category, gaps };
    })
    .filter(c => c.gaps.length > 0);

  seoIntelStore = {
    lastRun: new Date().toISOString(),
    competitors: results,
    aiAnalysis,
    changes,
    opportunities,
  };
  saveJSON(SEO_INTEL_FILE, seoIntelStore);

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  seoHistory = seoHistory.filter(h => new Date(h.date).getTime() > cutoff);
  seoHistory.push({ date: new Date().toISOString(), changes, competitorCount: results.length });
  saveJSON(SEO_HISTORY_FILE, seoHistory);

  await sendSEOReport(seoIntelStore, aiAnalysis, changes);
  console.log('[SSO-SEOIntel] Intelligence run complete.');
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT GETTER (for API)
// ─────────────────────────────────────────────────────────────────────────────

function getSEOIntelReport() {
  return {
    lastRun:       seoIntelStore.lastRun,
    competitors:   seoIntelStore.competitors,
    aiAnalysis:    seoIntelStore.aiAnalysis,
    changes:       seoIntelStore.changes,
    opportunities: seoIntelStore.opportunities,
    history:       seoHistory.slice(-30),
    competitorList: ALL_COMPETITORS,
    keywords:      TARGET_KEYWORDS,
    stats: {
      coreCount:      COMPETITORS_CORE.length,
      secondaryCount: COMPETITORS_SECONDARY.length,
      totalCount:     ALL_COMPETITORS.length,
      keywordCount:   TARGET_KEYWORDS.length,
    },
  };
}

module.exports = { runSEOIntelligence, getSEOIntelReport, ALL_COMPETITORS, TARGET_KEYWORDS };
