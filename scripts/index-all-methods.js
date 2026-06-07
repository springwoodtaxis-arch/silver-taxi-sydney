/**
 * Multi-method URL indexing:
 * 1. IndexNow (Bing/Yandex) - submit all URLs immediately using existing key
 * 2. Ping sitemap to Google & Bing
 * 3. Google Indexing API - submit in daily batches of 200
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SITE_URL = 'https://silvertaxisydneyservice.com';
const SA_PATH = path.join(__dirname, '..', 'config', 'google-service-account.json');
const INDEXNOW_KEY = 'myIndexNowKey63638';

// Load all URLs from sitemap
const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
const urlMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g);
const ALL_URLS = urlMatches.map(m => m.replace('<loc>', '').replace('</loc>', ''));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ METHOD 1: IndexNow (Bing/Yandex) ============
async function submitIndexNow() {
  console.log('\n=== METHOD 1: IndexNow (Bing/Yandex) ===');
  console.log(`Submitting ${ALL_URLS.length} URLs to IndexNow...\n`);

  try {
    // Submit to IndexNow batch endpoint
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'silvertaxisydneyservice.com',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: ALL_URLS,
      }),
    });

    const statusText = `${response.status} ${response.statusText}`;
    if (response.ok || response.status === 200 || response.status === 202) {
      console.log(`✓ IndexNow: ${ALL_URLS.length} URLs submitted successfully (${statusText})`);
      return { success: true, count: ALL_URLS.length };
    } else {
      const errText = await response.text();
      console.log(`✗ IndexNow batch failed: ${statusText} - ${errText}`);
      
      // Try individual submissions for top priority URLs
      console.log('\nTrying individual URL submissions for top 50 pages...');
      let individualSuccess = 0;
      const topUrls = ALL_URLS.slice(0, 50);
      
      for (const url of topUrls) {
        try {
          const r = await fetch(`https://api.indexnow.org/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`, {
            method: 'GET',
          });
          if (r.ok || r.status === 200 || r.status === 202) {
            individualSuccess++;
          }
          await sleep(500);
        } catch (e) {}
      }
      console.log(`✓ Individual IndexNow: ${individualSuccess}/${topUrls.length} submitted`);
      return { success: individualSuccess > 0, count: individualSuccess };
    }
  } catch (err) {
    console.log(`✗ IndexNow error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ============ METHOD 2: Ping Sitemap ============
async function pingSitemap() {
  console.log('\n=== METHOD 2: Ping Sitemap to Search Engines ===');
  
  const pings = [
    { name: 'Google', url: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITE_URL + '/sitemap.xml')}` },
    { name: 'Bing', url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITE_URL + '/sitemap.xml')}` },
    { name: 'IndexNow Bing', url: `https://www.bing.com/indexnow?url=${encodeURIComponent(SITE_URL + '/sitemap.xml')}&key=${INDEXNOW_KEY}` },
  ];

  for (const ping of pings) {
    try {
      const resp = await fetch(ping.url, { signal: AbortSignal.timeout(10000) });
      console.log(`✓ ${ping.name} ping: ${resp.status} ${resp.statusText}`);
    } catch (err) {
      console.log(`✗ ${ping.name} ping failed: ${err.message}`);
    }
  }
}

// ============ METHOD 3: Google Indexing API (batch of 200) ============
async function submitGoogleIndexing() {
  console.log('\n=== METHOD 3: Google Indexing API (Daily Batch) ===');
  
  const progressFile = path.join(__dirname, 'indexing-progress.json');
  let progress = { lastDate: '', lastIndex: 0, totalSubmitted: 0 };
  
  if (fs.existsSync(progressFile)) {
    progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
  }

  const today = new Date().toISOString().split('T')[0];
  
  if (progress.lastDate === today && progress.quotaHitToday) {
    console.log(`⚠ Quota already exhausted today. Will retry tomorrow.`);
    console.log(`  Total submitted so far: ${progress.totalSubmitted}/${ALL_URLS.length}`);
    console.log(`  Remaining: ${ALL_URLS.length - progress.totalSubmitted}`);
    return { success: true, submitted: 0, message: 'Quota used today' };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: SA_PATH,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    const token = accessToken.token || accessToken;

    const startIdx = progress.totalSubmitted || 0;
    const batch = ALL_URLS.slice(startIdx, startIdx + 200);
    
    if (batch.length === 0) {
      console.log('✓ All URLs already submitted via Google Indexing API!');
      return { success: true, submitted: 0, message: 'All done' };
    }

    console.log(`Submitting URLs ${startIdx + 1} to ${startIdx + batch.length} of ${ALL_URLS.length}`);
    
    let success = 0;
    let failed = 0;
    let quotaHit = false;

    for (let i = 0; i < batch.length; i += 3) {
      const chunk = batch.slice(i, i + 3);
      
      const results = await Promise.allSettled(
        chunk.map(async (url) => {
          const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ url, type: 'URL_UPDATED' }),
          });
          if (!response.ok) {
            const errText = await response.text();
            if (errText.includes('429') || errText.includes('Quota exceeded')) {
              throw new Error('QUOTA_EXCEEDED');
            }
            throw new Error(`${response.status}`);
          }
          return true;
        })
      );

      results.forEach(r => {
        if (r.status === 'fulfilled') success++;
        else {
          if (r.reason.message === 'QUOTA_EXCEEDED') quotaHit = true;
          failed++;
        }
      });

      if (quotaHit) {
        console.log(`\n⚠ Quota hit after ${success} submissions.`);
        break;
      }

      process.stdout.write(`\r  Progress: ${success + failed}/${batch.length} (${success} ok, ${failed} failed)`);
      await sleep(2000);
    }

    // Save progress
    progress.lastDate = today;
    progress.totalSubmitted = startIdx + success;
    progress.quotaHitToday = quotaHit;
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));

    console.log(`\n✓ Google Indexing API: ${success} submitted today`);
    console.log(`  Total submitted: ${progress.totalSubmitted}/${ALL_URLS.length}`);
    console.log(`  Remaining: ${ALL_URLS.length - progress.totalSubmitted}`);
    
    return { success: true, submitted: success };
  } catch (err) {
    console.log(`✗ Google Indexing API error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ============ MAIN ============
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  BULK URL INDEXING — Silver Taxi Sydney Service       ║');
  console.log('║  All search engines — multi-method approach      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\nTotal URLs: ${ALL_URLS.length}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`IndexNow Key: ${INDEXNOW_KEY}`);

  const indexNowResult = await submitIndexNow();
  await pingSitemap();
  const googleResult = await submitGoogleIndexing();

  console.log('\n\n═══════════════════════════════════════');
  console.log('FINAL SUMMARY:');
  console.log('═══════════════════════════════════════');
  console.log(`IndexNow (Bing/Yandex): ${indexNowResult.success ? '✓' : '✗'} ${indexNowResult.count || 0} URLs`);
  console.log(`Sitemap Ping: ✓ Notified`);
  console.log(`Google Indexing API: ${googleResult.submitted || 0} URLs today`);
  console.log('\n💡 Tips:');
  console.log('  - Resubmit sitemap.xml in Google Search Console');
  console.log('  - Run this script daily until all URLs are submitted');
  console.log('  - Google quota resets at midnight Pacific Time');
}

main().catch(console.error);
