const d = JSON.parse(require('fs').readFileSync('scripts/suburb-details.json'));
const missing = d.suburbs.filter(s => !s.westernAirportKm);
console.log('Missing WSI:', missing.length, 'of', d.suburbs.length);
if (missing.length > 0) {
  missing.slice(0, 5).forEach(s => console.log(' -', s.slug, s.council));
}
