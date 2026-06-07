/**
 * Generate unique SEO content for top-priority suburbs using OpenAI API
 * Generates 1500-2000 word unique content per suburb
 */
const fs = require('fs');
const path = require('path');

// Use the environment's OpenAI setup
const OpenAI = require('openai');
const client = new OpenAI();

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'suburb-details.json'), 'utf8'));
const outputDir = path.join(__dirname, 'generated-content');
fs.mkdirSync(outputDir, { recursive: true });

// Top priority suburbs for unique content
const TOP_SUBURBS = [
  'sydney-cbd', 'parramatta', 'bondi', 'chatswood', 'liverpool',
  'penrith', 'blacktown', 'mascot', 'hurstville', 'burwood',
  'strathfield', 'bankstown', 'olympic-park', 'homebush', 'rhodes',
  'macquarie-park', 'manly', 'cronulla', 'castle-hill', 'campbelltown'
];

async function generateContent(suburbSlug) {
  const suburb = data.suburbs.find(s => s.slug === suburbSlug);
  if (!suburb) { console.log(`Suburb not found: ${suburbSlug}`); return; }
  
  const outputFile = path.join(outputDir, `${suburbSlug}.json`);
  if (fs.existsSync(outputFile)) {
    console.log(`Already exists: ${suburbSlug}`);
    return;
  }
  
  const name = suburb.name;
  const council = data.councils.find(c => c.suburbs.includes(suburbSlug));
  const councilName = council ? council.name : 'Sydney';
  const airportKm = suburb.airportKm || 20;
  const stations = (suburb.trainStations || []).join(', ');
  const landmarks = (suburb.landmarks || []).join(', ');
  const shops = (suburb.shoppingCentres || []).join(', ');
  const hospitals = (suburb.hospitals || []).join(', ');
  const hotels = (suburb.hotels || []).join(', ');
  const business = (suburb.businessDistricts || []).join(', ');
  const nearby = (suburb.nearbySuburbs || []).slice(0, 6).map(s => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(', ');
  
  const prompt = `Write unique SEO-optimized HTML content (1500-2000 words) for a premium silver service taxi landing page for ${name}, Sydney, Australia.

CONTEXT:
- Business: Silver Taxi Sydney Service (silvertaxisydneyservice.com) — premium silver taxi service
- Location: ${name}, in the ${councilName} council area
- Distance to Sydney Airport: ~${airportKm}km
- Train stations: ${stations}
- Key landmarks: ${landmarks}
- Shopping centres: ${shops}
- Hospitals: ${hospitals}
- Hotels: ${hotels}
- Business districts: ${business}
- Nearby suburbs: ${nearby}
- Phone: 1800 173 171
- Booking URL: /book

REQUIREMENTS:
1. Write in HTML format using h2, h3, p, ul/li tags
2. Include these sections:
   - Introduction to silver taxi service in ${name} (mention the suburb's character, why people need premium taxi here)
   - Airport transfers section (fixed fares, meet & greet, flight monitoring)
   - Corporate & business travel section
   - Local area coverage (mention specific landmarks, stations, venues)
   - Service features (fixed pricing, 24/7, luxury fleet)
   - Why locals choose silver service
3. Naturally incorporate these keywords: silver taxi ${name.toLowerCase()}, silver service ${name.toLowerCase()}, taxi ${name.toLowerCase()}, airport transfers ${name.toLowerCase()}, ${name.toLowerCase()} to sydney airport
4. Include internal links using these anchor texts and URLs:
   - <a href="/book">Book online</a> or <a href="/book">book your silver taxi</a>
   - <a href="/airport-transfers">Sydney Airport transfers</a>
   - <a href="/silver-service-taxi-sydney">silver service taxi Sydney</a>
   - <a href="/locations/">all Sydney locations</a>
5. Include one external link to Sydney Airport: <a href="https://www.sydneyairport.com.au/" target="_blank" rel="noopener">Sydney Airport</a>
6. Include one external link to Transport NSW: <a href="https://transportnsw.info/travel-info/ways-to-get-around/taxi-hire-vehicle" target="_blank" rel="nofollow noopener">Transport NSW</a>
7. Make content genuinely unique — mention specific local details, routes, travel times
8. Write in professional but warm tone, emphasizing premium quality and reliability
9. Do NOT include the h1 tag (it's handled separately)
10. Do NOT include any schema markup or meta tags

Also provide:
- SEO title (max 60 chars): format "Silver Service Taxi ${name} | [Benefit] | Silver Taxi Sydney"
- Meta description (max 155 chars)
- H1 (with <span> around suburb name for styling)
- 6 unique FAQs with answers specific to ${name}

Return as JSON:
{
  "title": "...",
  "metaDescription": "...",
  "h1": "Silver Service Taxi <span>${name}</span>",
  "body": "<h2>...</h2><p>...</p>...",
  "faqs": [{"q":"...","a":"..."},...]
}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 4000
    });
    
    let content = response.choices[0].message.content;
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      fs.writeFileSync(outputFile, JSON.stringify(parsed, null, 2));
      console.log(`✓ Generated: ${suburbSlug}`);
    } else {
      console.log(`✗ Failed to parse: ${suburbSlug}`);
    }
  } catch (err) {
    console.log(`✗ Error for ${suburbSlug}: ${err.message}`);
  }
}

async function main() {
  console.log(`Generating unique content for ${TOP_SUBURBS.length} top suburbs...`);
  
  // Process in batches of 4 to avoid rate limits
  for (let i = 0; i < TOP_SUBURBS.length; i += 4) {
    const batch = TOP_SUBURBS.slice(i, i + 4);
    await Promise.all(batch.map(s => generateContent(s)));
    if (i + 4 < TOP_SUBURBS.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log('\\nContent generation complete!');
}

main().catch(console.error);
