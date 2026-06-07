
// ==================== MASS SEO LOCATION PAGES ====================
// Auto-generated: 2026-05-29T03:42:13.614Z
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
  'alexandria': true,
  'bankstown': true,
  'beaconsfield': true,
  'blacktown': true,
  'burwood': true,
  'cronulla': true,
  'erskineville': true,
  'glebe': true,
  'hornsby': true,
  'hurstville': true,
  'kogarah': true,
  'liverpool': true,
  'loftus': true,
  'manly': true,
  'mascot': true,
  'menai': true,
  'miranda': true,
  'newport': true,
  'newtown': true,
  'parramatta': true,
  'penrith': true,
  'prestons': true,
  'redfern': true,
  'rockdale': true,
  'rosebery': true,
  'ryde': true,
  'sans-souci': true,
  'strathfield': true,
  'surry-hills': true,
  'sutherland-shire': true,
  'sutherland': true,
  'sydney-cbd': true,
  'sylvania': true,
  'waterloo': true,
  'woolooware': true,
  'zetland': true,
};

// Apply redirects for old URLs
Object.keys(suburbRedirects).forEach(slug => {
  app.get('/taxi-' + slug, (req, res) => {
    res.redirect(301, '/locations/' + slug + '/');
  });
});

// ==================== END MASS SEO LOCATION PAGES ====================
