/**
 * Build comprehensive suburb database for SEO page generation
 * Generates suburb-details.json with all metadata needed for page generation
 */
const fs = require('fs');
const path = require('path');

const councilData = JSON.parse(fs.readFileSync(path.join(__dirname, 'suburb-data.json'), 'utf8'));

// Collect all unique suburbs from councils
const allSuburbSlugs = new Set();
councilData.councils.forEach(c => {
  c.suburbs.forEach(s => allSuburbSlugs.add(s));
});

// Additional suburbs to reach 300+
const additionalSuburbs = [
  'green-square', 'wolli-creek', 'tempe', 'sydenham', 'st-peters',
  'dulwich-hill', 'summer-hill', 'lewisham', 'petersham', 'stanmore',
  'enmore', 'haberfield', 'five-dock', 'abbotsford', 'drummoyne',
  'rodd-point', 'russell-lea', 'wareemba', 'canada-bay', 'concord',
  'concord-west', 'rhodes', 'mortlake', 'cabarita', 'wentworth-point',
  'lidcombe', 'berala', 'auburn', 'silverwater', 'newington',
  'homebush', 'homebush-west', 'strathfield-south', 'belfield',
  'greenacre', 'chullora', 'bass-hill', 'chester-hill', 'sefton',
  'birrong', 'regents-park', 'potts-hill', 'yagoona', 'condell-park',
  'revesby', 'padstow', 'panania', 'milperra', 'east-hills',
  'picnic-point', 'villawood', 'carramar', 'lansdowne', 'lansvale',
  'cabramatta', 'cabramatta-west', 'canley-vale', 'canley-heights',
  'smithfield', 'wetherill-park', 'prairiewood', 'bossley-park',
  'bonnyrigg', 'bonnyrigg-heights', 'edensor-park', 'abbotsbury',
  'cecil-hills', 'greenfield-park', 'wakeley', 'old-guildford',
  'casula', 'lurnea', 'moorebank', 'chipping-norton', 'hammondville',
  'holsworthy', 'wattle-grove', 'warwick-farm', 'hinchinbrook',
  'hoxton-park', 'green-valley', 'cartwright', 'prestons',
  'edmondson-park', 'leppington', 'austral', 'horningsea-park',
  'west-hoxton', 'narellan', 'oran-park', 'gregory-hills',
  'spring-farm', 'mount-annan', 'harrington-park', 'camden',
  'glenfield', 'macquarie-fields', 'ingleburn', 'minto',
  'leumeah', 'campbelltown', 'airds', 'bradbury', 'rosemeadow',
  'st-helens-park', 'eagle-vale', 'eschol-park', 'ruse',
  'seven-hills', 'prospect', 'kings-langley', 'doonside',
  'rooty-hill', 'mount-druitt', 'quakers-hill', 'stanhope-gardens',
  'the-ponds', 'rouse-hill', 'riverstone', 'schofields', 'marsden-park',
  'kellyville', 'bella-vista', 'norwest', 'baulkham-hills',
  'castle-hill', 'cherrybrook', 'west-pennant-hills', 'pennant-hills',
  'thornleigh', 'beecroft', 'epping', 'eastwood', 'carlingford',
  'north-ryde', 'macquarie-park', 'marsfield', 'gladesville',
  'putney', 'meadowbank', 'west-ryde', 'ryde', 'top-ryde',
  'chatswood', 'artarmon', 'st-leonards', 'crows-nest',
  'north-sydney', 'milsons-point', 'kirribilli', 'neutral-bay',
  'cremorne', 'mosman', 'manly', 'dee-why', 'brookvale',
  'narrabeen', 'mona-vale', 'newport', 'avalon',
  'hornsby', 'waitara', 'wahroonga', 'turramurra', 'pymble',
  'gordon', 'killara', 'lindfield', 'roseville',
  'penrith', 'kingswood', 'st-marys', 'emu-plains', 'glenmore-park',
  'jordan-springs', 'cranebrook', 'werrington',
  'cronulla', 'miranda', 'caringbah', 'sutherland', 'kirrawee',
  'jannali', 'como', 'engadine', 'menai', 'bangor', 'alfords-point',
  'kogarah', 'hurstville', 'mortdale', 'oatley', 'penshurst',
  'peakhurst', 'lugarno', 'riverwood', 'blakehurst',
  'rockdale', 'arncliffe', 'wolli-creek', 'bexley',
  'brighton-le-sands', 'sans-souci', 'ramsgate', 'monterey',
  'mascot', 'eastgardens', 'botany', 'pagewood', 'matraville',
  'randwick', 'coogee', 'maroubra', 'kingsford', 'kensington',
  'bondi', 'bondi-junction', 'bondi-beach', 'bronte', 'tamarama',
  'double-bay', 'rose-bay', 'vaucluse', 'bellevue-hill', 'paddington',
  'woollahra', 'edgecliff', 'darling-point',
  'burwood', 'croydon', 'croydon-park', 'enfield',
  'ashfield', 'leichhardt', 'balmain', 'rozelle', 'lilyfield',
  'marrickville', 'newtown', 'erskineville', 'alexandria',
  'waterloo', 'zetland', 'rosebery', 'beaconsfield',
  'redfern', 'surry-hills', 'darlinghurst', 'potts-point',
  'pyrmont', 'ultimo', 'haymarket', 'chippendale', 'glebe',
  'darling-harbour', 'the-rocks', 'barangaroo',
  'fairfield', 'fairfield-west', 'fairfield-heights',
  'liverpool', 'bankstown', 'parramatta', 'blacktown',
  'lane-cove', 'hunters-hill', 'woolwich', 'longueville',
  'greenwich', 'riverview'
];

additionalSuburbs.forEach(s => allSuburbSlugs.add(s));

// Suburb metadata lookup
const suburbMeta = {
  // Key landmarks, stations, distances for major suburbs
  'sydney-cbd': { postcode: '2000', council: 'city-of-sydney', airportKm: 8, trainStations: ['Central', 'Town Hall', 'Wynyard', 'Circular Quay', 'Martin Place', 'St James', 'Museum'], landmarks: ['Sydney Opera House', 'Sydney Harbour Bridge', 'Darling Harbour', 'Queen Victoria Building', 'Pitt Street Mall', 'Barangaroo', 'Circular Quay'], hospitals: ['Royal Prince Alfred Hospital', 'St Vincents Hospital'], shoppingCentres: ['Westfield Sydney', 'QVB', 'The Strand Arcade', 'World Square'], hotels: ['Four Seasons Sydney', 'Shangri-La Sydney', 'Hilton Sydney', 'InterContinental Sydney', 'Park Hyatt Sydney'], businessDistricts: ['Martin Place', 'Barangaroo', 'Pitt Street', 'George Street'] },
  'parramatta': { postcode: '2150', council: 'parramatta', airportKm: 28, trainStations: ['Parramatta', 'Harris Park', 'Westmead'], landmarks: ['Parramatta Park', 'Old Government House', 'Riverside Theatre', 'Church Street Mall'], hospitals: ['Westmead Hospital', 'Westmead Childrens Hospital'], shoppingCentres: ['Westfield Parramatta'], hotels: ['Meriton Suites Parramatta', 'Novotel Parramatta', 'Courtyard by Marriott'], businessDistricts: ['Parramatta CBD', 'Parramatta Square'] },
  'bondi': { postcode: '2026', council: 'waverley', airportKm: 10, trainStations: ['Bondi Junction'], landmarks: ['Bondi Beach', 'Bondi Icebergs', 'Bondi to Coogee Walk', 'Campbell Parade'], hospitals: ['Prince of Wales Hospital'], shoppingCentres: ['Westfield Bondi Junction', 'Bondi Junction Mall'], hotels: ['QT Bondi', 'Adina Apartment Hotel Bondi Beach'], businessDistricts: ['Bondi Junction'] },
  'chatswood': { postcode: '2067', council: 'willoughby', airportKm: 18, trainStations: ['Chatswood'], landmarks: ['Chatswood Chase', 'The Concourse', 'Chatswood Oval'], hospitals: ['Royal North Shore Hospital'], shoppingCentres: ['Chatswood Chase', 'Westfield Chatswood'], hotels: ['Mantra Chatswood', 'Silkari Suites Chatswood'], businessDistricts: ['Chatswood CBD', 'Pacific Highway corridor'] },
  'liverpool': { postcode: '2170', council: 'liverpool', airportKm: 30, trainStations: ['Liverpool', 'Warwick Farm', 'Casula'], landmarks: ['Liverpool CBD', 'Bigge Park', 'Casula Powerhouse'], hospitals: ['Liverpool Hospital'], shoppingCentres: ['Westfield Liverpool'], hotels: ['Novotel Liverpool', 'Quest Liverpool'], businessDistricts: ['Liverpool CBD', 'Moorebank Business Park'] },
  'penrith': { postcode: '2750', council: 'penrith', airportKm: 55, trainStations: ['Penrith', 'Kingswood', 'St Marys', 'Emu Plains'], landmarks: ['Penrith Panthers', 'Blue Mountains Gateway', 'Nepean River', 'Penrith Lakes'], hospitals: ['Nepean Hospital'], shoppingCentres: ['Westfield Penrith'], hotels: ['Mercure Penrith', 'Travelodge Penrith'], businessDistricts: ['Penrith CBD', 'High Street'] },
  'blacktown': { postcode: '2148', council: 'blacktown', airportKm: 35, trainStations: ['Blacktown', 'Seven Hills', 'Toongabbie', 'Rooty Hill'], landmarks: ['Blacktown Showground', 'Featherdale Wildlife Park', 'Wet n Wild'], hospitals: ['Blacktown Hospital'], shoppingCentres: ['Westpoint Blacktown'], hotels: ['Novotel Sydney West HQ', 'Mercure Sydney'], businessDistricts: ['Blacktown CBD'] },
  'mascot': { postcode: '2020', council: 'bayside', airportKm: 2, trainStations: ['Mascot', 'Domestic Airport', 'International Airport'], landmarks: ['Sydney Airport', 'Mascot Oval'], hospitals: ['Prince of Wales Hospital'], shoppingCentres: ['Eastgardens Shopping Centre'], hotels: ['Rydges Sydney Airport', 'Stamford Plaza Sydney Airport', 'Mantra Hotel at Sydney Airport', 'Ibis Budget Sydney Airport'], businessDistricts: ['Airport Business District'] },
  'hurstville': { postcode: '2220', council: 'georges-river', airportKm: 15, trainStations: ['Hurstville', 'Penshurst', 'Mortdale'], landmarks: ['Hurstville Entertainment Centre', 'Hurstville Oval'], hospitals: ['St George Hospital'], shoppingCentres: ['Westfield Hurstville'], hotels: ['Sage Hotel Hurstville'], businessDistricts: ['Hurstville CBD'] },
  'burwood': { postcode: '2134', council: 'burwood', airportKm: 12, trainStations: ['Burwood', 'Croydon'], landmarks: ['Burwood Park', 'Enfield Aquatic Centre'], hospitals: ['Concord Hospital'], shoppingCentres: ['Westfield Burwood'], hotels: ['Mantra Sydney Central'], businessDistricts: ['Burwood Road'] },
  'strathfield': { postcode: '2135', council: 'strathfield', airportKm: 13, trainStations: ['Strathfield', 'Homebush'], landmarks: ['Strathfield Park', 'Sydney Olympic Park'], hospitals: ['Concord Hospital'], shoppingCentres: ['Strathfield Plaza'], hotels: ['Novotel Sydney Olympic Park'], businessDistricts: ['Strathfield CBD'] },
  'bankstown': { postcode: '2200', council: 'canterbury-bankstown', airportKm: 20, trainStations: ['Bankstown', 'Yagoona', 'Birrong'], landmarks: ['Bankstown City Gardens', 'Paul Keating Park'], hospitals: ['Bankstown Hospital'], shoppingCentres: ['Bankstown Central'], hotels: ['Quest Bankstown'], businessDistricts: ['Bankstown CBD'] },
  'olympic-park': { postcode: '2127', council: 'parramatta', airportKm: 18, trainStations: ['Olympic Park'], landmarks: ['ANZ Stadium', 'Sydney Showground', 'Aquatic Centre', 'Bicentennial Park'], hospitals: ['Concord Hospital'], shoppingCentres: ['DFO Homebush'], hotels: ['Novotel Sydney Olympic Park', 'Pullman at Sydney Olympic Park', 'ibis Sydney Olympic Park'], businessDistricts: ['Sydney Olympic Park Business Centre'] },
  'homebush': { postcode: '2140', council: 'strathfield', airportKm: 15, trainStations: ['Homebush', 'Flemington'], landmarks: ['Sydney Olympic Park', 'DFO Homebush', 'Bicentennial Park'], hospitals: ['Concord Hospital'], shoppingCentres: ['DFO Homebush'], hotels: ['Novotel Sydney Olympic Park'], businessDistricts: ['Olympic Park precinct'] },
  'rhodes': { postcode: '2138', council: 'inner-west', airportKm: 15, trainStations: ['Rhodes', 'Concord West'], landmarks: ['Rhodes Waterside', 'Brays Bay Reserve'], hospitals: ['Concord Hospital'], shoppingCentres: ['Rhodes Waterside'], hotels: ['Meriton Suites'], businessDistricts: ['Rhodes Corporate Park'] },
  'macquarie-park': { postcode: '2113', council: 'ryde', airportKm: 20, trainStations: ['Macquarie Park', 'Macquarie University'], landmarks: ['Macquarie University', 'Macquarie Centre', 'Lane Cove National Park'], hospitals: ['Macquarie University Hospital'], shoppingCentres: ['Macquarie Centre'], hotels: ['Meriton Suites North Ryde'], businessDistricts: ['Macquarie Park Business District', 'Optus Campus'] },
  'manly': { postcode: '2095', council: 'northern-beaches', airportKm: 22, trainStations: ['Manly Wharf Ferry'], landmarks: ['Manly Beach', 'The Corso', 'Shelly Beach', 'North Head'], hospitals: ['Northern Beaches Hospital'], shoppingCentres: ['Manly Corso shops'], hotels: ['Novotel Manly Pacific', 'Sebel Manly Beach'], businessDistricts: ['Manly CBD'] },
  'cronulla': { postcode: '2230', council: 'sutherland-shire', airportKm: 28, trainStations: ['Cronulla'], landmarks: ['Cronulla Beach', 'Cronulla Mall', 'Royal National Park'], hospitals: ['Sutherland Hospital'], shoppingCentres: ['Cronulla Central'], hotels: ['Rydges Cronulla'], businessDistricts: ['Cronulla CBD'] },
  'castle-hill': { postcode: '2154', council: 'hills-shire', airportKm: 35, trainStations: ['Castle Hill Metro', 'Hills Showground Metro'], landmarks: ['Castle Towers', 'Castle Hill Heritage Park'], hospitals: ['Castle Hill Private Hospital', 'Hills Private Hospital'], shoppingCentres: ['Castle Towers'], hotels: ['Crowne Plaza Norwest'], businessDistricts: ['Norwest Business Park', 'Castle Hill CBD'] },
  'campbelltown': { postcode: '2560', council: 'campbelltown', airportKm: 45, trainStations: ['Campbelltown', 'Macarthur', 'Leumeah'], landmarks: ['Campbelltown Arts Centre', 'Mount Annan Botanic Garden'], hospitals: ['Campbelltown Hospital'], shoppingCentres: ['Macarthur Square'], hotels: ['Rydges Campbelltown'], businessDistricts: ['Campbelltown CBD', 'Macarthur'] }
};

// Function to generate metadata for suburbs without explicit data
function generateSuburbMeta(slug) {
  if (suburbMeta[slug]) return suburbMeta[slug];
  
  // Find which council this suburb belongs to
  let council = 'city-of-sydney';
  for (const c of councilData.councils) {
    if (c.suburbs.includes(slug)) {
      council = c.slug;
      break;
    }
  }
  
  // Estimate distance to Sydney Airport (SYD) based on council
  const councilDistancesSYD = {
    'city-of-sydney': 8, 'bayside': 5, 'randwick': 8, 'waverley': 10,
    'woollahra': 9, 'inner-west': 10, 'burwood': 12, 'strathfield': 13,
    'canterbury-bankstown': 18, 'georges-river': 15, 'sutherland-shire': 25,
    'ryde': 18, 'north-sydney': 14, 'willoughby': 16, 'lane-cove': 16,
    'ku-ring-gai': 25, 'hornsby': 30, 'northern-beaches': 25,
    'parramatta': 28, 'cumberland': 25, 'fairfield': 30,
    'liverpool': 30, 'blacktown': 35, 'hills-shire': 35,
    'penrith': 55, 'campbelltown': 45, 'camden': 50, 'wollondilly': 60,
    'mosman': 12, 'wollongong': 80, 'central-coast': 85, 'blue-mountains': 90, 'hawkesbury': 65
  };
  // Estimate distance to Western Sydney Airport (WSI at Luddenham) based on council
  const councilDistancesWSI = {
    'city-of-sydney': 55, 'bayside': 52, 'randwick': 58, 'waverley': 60,
    'woollahra': 60, 'inner-west': 50, 'burwood': 48, 'strathfield': 45,
    'canterbury-bankstown': 40, 'georges-river': 45, 'sutherland-shire': 55,
    'ryde': 50, 'north-sydney': 58, 'willoughby': 58, 'lane-cove': 55,
    'ku-ring-gai': 60, 'hornsby': 65, 'northern-beaches': 70,
    'parramatta': 35, 'cumberland': 32, 'fairfield': 25,
    'liverpool': 22, 'blacktown': 30, 'hills-shire': 40,
    'penrith': 18, 'campbelltown': 30, 'camden': 20, 'wollondilly': 35,
    'mosman': 60, 'wollongong': 85, 'central-coast': 100, 'blue-mountains': 45, 'hawkesbury': 40
  };
  
  const airportKm = councilDistancesSYD[council] || 20;
  const westernAirportKm = councilDistancesWSI[council] || 50;
  const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  return {
    postcode: '2000',
    council: council,
    airportKm: airportKm,
    westernAirportKm: westernAirportKm,
    trainStations: [`${name} Station`],
    landmarks: [`${name} Park`, `${name} shops`],
    hospitals: [],
    shoppingCentres: [],
    hotels: [],
    businessDistricts: []
  };
}

// WSI distances for explicit suburbs (that have hardcoded metadata)
const wsiDistByCouncil = {
  'city-of-sydney': 55, 'bayside': 52, 'randwick': 58, 'waverley': 60,
  'woollahra': 60, 'inner-west': 50, 'burwood': 48, 'strathfield': 45,
  'canterbury-bankstown': 40, 'georges-river': 45, 'sutherland-shire': 55,
  'ryde': 50, 'north-sydney': 58, 'willoughby': 58, 'lane-cove': 55,
  'ku-ring-gai': 60, 'hornsby': 65, 'northern-beaches': 70,
  'parramatta': 35, 'cumberland': 32, 'fairfield': 25,
  'liverpool': 22, 'blacktown': 30, 'hills-shire': 40,
  'penrith': 18, 'campbelltown': 30, 'camden': 20, 'wollondilly': 35,
  'mosman': 60, 'wollongong': 85, 'central-coast': 100, 'blue-mountains': 45, 'hawkesbury': 40
};

// Build full suburb list with details
const suburbs = [];
for (const slug of allSuburbSlugs) {
  const meta = generateSuburbMeta(slug);
  // Ensure westernAirportKm exists for all suburbs
  if (!meta.westernAirportKm) {
    meta.westernAirportKm = wsiDistByCouncil[meta.council] || 50;
  }
  const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  // Find nearby suburbs (same council)
  let nearbySuburbs = [];
  for (const c of councilData.councils) {
    if (c.suburbs.includes(slug)) {
      nearbySuburbs = c.suburbs.filter(s => s !== slug).slice(0, 8);
      break;
    }
  }
  
  suburbs.push({
    slug,
    name,
    ...meta,
    nearbySuburbs
  });
}

console.log(`Total suburbs: ${suburbs.length}`);

// Write output
fs.writeFileSync(
  path.join(__dirname, 'suburb-details.json'),
  JSON.stringify({ suburbs, councils: councilData.councils, airports: councilData.airports }, null, 2)
);

console.log('suburb-details.json written successfully');
