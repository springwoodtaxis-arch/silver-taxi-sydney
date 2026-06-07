/**
 * Submit ALL pages to Google Indexing API for immediate crawling/indexing
 * Uses the service account: indexnow-bot@indexing-api-493016.iam.gserviceaccount.com
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SA_PATH = path.join(__dirname, '..', 'config', 'google-service-account.json');
const SITE_URL = 'https://silvertaxisydneyservice.com';

// Load all URLs from sitemap
const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
const urlMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g);
const ALL_URLS = urlMatches.map(m => m.replace('<loc>', '').replace('</loc>', ''));

console.log(`\n=== Google Indexing API — Bulk URL Submission ===`);
console.log(`Total URLs to submit: ${ALL_URLS.length}`);
console.log(`Service Account: indexnow-bot@indexing-api-493016.iam.gserviceaccount.com\n`);

// Rate limiting: Google allows 200 requests per day for Indexing API
// For URL_UPDATED notifications, the limit is higher but we'll batch carefully
const BATCH_SIZE = 10; // Submit 10 at a time
const DELAY_MS = 1500; // 1.5 second delay between batches

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    // Authenticate
    const auth = new google.auth.GoogleAuth({
      keyFile: SA_PATH,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    const token = accessToken.token || accessToken;

    console.log('✓ Authenticated successfully\n');

    let success = 0;
    let failed = 0;
    let errors = [];
    const startTime = Date.now();

    // Process in batches
    for (let i = 0; i < ALL_URLS.length; i += BATCH_SIZE) {
      const batch = ALL_URLS.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(ALL_URLS.length / BATCH_SIZE);
      
      process.stdout.write(`\rBatch ${batchNum}/${totalBatches} | Submitted: ${success} | Failed: ${failed} | Progress: ${Math.round((i / ALL_URLS.length) * 100)}%`);

      // Submit batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              url: url,
              type: 'URL_UPDATED',
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${response.status}: ${errText}`);
          }
          return await response.json();
        })
      );

      // Count results
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          success++;
        } else {
          failed++;
          errors.push({ url: batch[idx], error: result.reason.message });
        }
      });

      // Rate limit delay
      if (i + BATCH_SIZE < ALL_URLS.length) {
        await sleep(DELAY_MS);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n\n=== INDEXING COMPLETE ===`);
    console.log(`✓ Successfully submitted: ${success}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`⏱ Time: ${elapsed}s`);
    
    if (errors.length > 0) {
      console.log(`\n--- Failed URLs (first 20) ---`);
      errors.slice(0, 20).forEach(e => {
        console.log(`  ${e.url}`);
        console.log(`    Error: ${e.error.substring(0, 100)}`);
      });
    }

    // Save results to file
    const report = {
      timestamp: new Date().toISOString(),
      totalUrls: ALL_URLS.length,
      success,
      failed,
      elapsed: `${elapsed}s`,
      errors: errors.slice(0, 50),
    };
    fs.writeFileSync(path.join(__dirname, 'indexing-report.json'), JSON.stringify(report, null, 2));
    console.log(`\nReport saved to scripts/indexing-report.json`);

  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
    process.exit(1);
  }
}

main();
