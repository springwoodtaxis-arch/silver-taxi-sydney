/**
 * Generate the Express.js route code to add to server.js
 * This creates the routing for all /locations/* pages
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'suburb-details.json'), 'utf8'));

// Generate route code
let routeCode = `
// ==================== MASS SEO LOCATION PAGES ====================
// Auto-generated: ${new Date().toISOString()}
// Total pages: 381 (350 suburbs + 28 councils + 2 airports + 1 hub)

// Serve location pages statically with clean URLs
app.use('/locations', express.static(path.join(__dirname, 'public', 'locations'), {
  extensions: ['html'],
  index: 'index.html'
}));

// Locations hub
app.get('/locations', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'locations', 'index.html'));
});
app.get('/locations/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'locations', 'index.html'));
});

// HTML Sitemap
app.get('/sitemap-html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sitemap-html.html'));
});

// RSS Feed
app.get('/feed.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/rss+xml');
  res.sendFile(path.join(__dirname, 'public', 'feed.xml'));
});

// Redirect old taxi-{suburb} URLs to new /locations/{suburb}/ format (301)
const suburbRedirects = {
`;

// Add redirects from old taxi-suburb pages to new locations
const existingPages = fs.readdirSync(path.join(__dirname, '..', 'public'))
  .filter(f => f.startsWith('taxi-') && f.endsWith('.html'))
  .map(f => f.replace('.html', '').replace('taxi-', ''));

existingPages.forEach(slug => {
  // Only redirect if we have a matching location page
  const locationDir = path.join(__dirname, '..', 'public', 'locations', slug);
  if (fs.existsSync(locationDir)) {
    routeCode += `  '${slug}': true,\n`;
  }
});

routeCode += `};

// Apply redirects for old URLs
Object.keys(suburbRedirects).forEach(slug => {
  app.get('/taxi-' + slug, (req, res) => {
    res.redirect(301, '/locations/' + slug + '/');
  });
});

// ==================== END MASS SEO LOCATION PAGES ====================
`;

fs.writeFileSync(path.join(__dirname, 'location-routes.js'), routeCode);
console.log('Route code generated: scripts/location-routes.js');
console.log(`Includes ${existingPages.filter(s => fs.existsSync(path.join(__dirname, '..', 'public', 'locations', s))).length} redirects from old pages`);
