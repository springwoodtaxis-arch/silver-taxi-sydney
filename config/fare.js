'use strict';
const CFG = require('./index');

// ─── Rate Tables ──────────────────────────────────────────────────────────────
const FARES = {
  sedan: { init: 7.40, minFare: 50, minKm: 8, bands: [[0,5,4.70],[5,10,4.50],[10,28,3.55],[28,50,3.40],[50,70,3.00],[70,100,2.80],[100,9999,2.60]] },
  lexus: { init: 7.40, minFare: 50, minKm: 8, bands: [[0,5,4.70],[5,10,4.55],[10,28,3.55],[28,50,3.40],[50,70,3.00],[70,90,2.80],[90,9999,2.60]] },
  suv:   { init: 7.40, minFare: 50, minKm: 8, bands: [[0,5,4.80],[5,10,4.50],[10,28,3.65],[28,50,3.50],[50,70,3.10],[70,90,2.85],[90,9999,2.60]] },
  maxi:  { init:14.00, minFare: 60, minKm: 8, bands: [[0,5,6.50],[5,10,6.20],[10,30,5.10],[30,9999,4.60]] },
};
const GOVT_LEVY   = 1.32;
const BOOKING_FEE = 2.50;
const CARD_FEE_PCT = 0.05;

function calcBaseFare(vehicle, km) {
  const v = FARES[vehicle] || FARES.sedan;
  const effectiveKm = Math.max(+km || 0, v.minKm || 8);
  let dist = 0;
  for (const [lo, hi, rate] of v.bands) {
    if (effectiveKm <= lo) break;
    dist += (Math.min(effectiveKm, hi) - lo) * rate;
  }
  return { sub: +Math.max(v.init + dist, v.minFare || 50).toFixed(2), km: +effectiveKm.toFixed(1) };
}

function calcFare(vehicle, km, tolls = 0, returnTrip = false, airportFee = 0, returnKm = 0, returnTolls = 0, isCardPayment = false) {
  const { sub: outSub, km: effectiveKm } = calcBaseFare(vehicle, km);
  const af   = +(+airportFee || 0).toFixed(2);
  const t1   = +(+tolls || 0).toFixed(2);
  const levy = GOVT_LEVY;
  if (returnTrip) {
    const retKm = +returnKm > 0 ? +returnKm : +km;
    const { sub: retSubRaw } = calcBaseFare(vehicle, retKm);
    const retSub = +(retSubRaw * 0.90).toFixed(2);
    const t2     = +(+returnTolls > 0 ? +returnTolls : +tolls || 0).toFixed(2);
    const subtotal   = +(outSub + retSub + t1 + t2 + BOOKING_FEE + levy + af).toFixed(2);
    const serviceFee = isCardPayment ? +(subtotal * CARD_FEE_PCT).toFixed(2) : 0;
    const total      = +(subtotal + serviceFee).toFixed(2);
    return { km: effectiveKm, sub: outSub, returnSub: retSub, tolls: t1, returnTolls: t2, bookingFee: BOOKING_FEE, govtLevy: levy, airportFee: af, serviceFee, cardFee: serviceFee, subtotal, total, returnTrip: true };
  }
  const subtotal   = +(outSub + t1 + BOOKING_FEE + levy + af).toFixed(2);
  const serviceFee = isCardPayment ? +(subtotal * CARD_FEE_PCT).toFixed(2) : 0;
  const total      = +(subtotal + serviceFee).toFixed(2);
  return { km: effectiveKm, sub: outSub, tolls: t1, bookingFee: BOOKING_FEE, govtLevy: levy, airportFee: af, serviceFee, cardFee: serviceFee, subtotal, total, returnTrip: false };
}

// ─── Toll Rates ───────────────────────────────────────────────────────────────
const TOLL_RATES = {
  HARBOUR_BRIDGE:        4.00,
  HARBOUR_TUNNEL:        4.00,
  CROSS_CITY_MAIN:       6.33,
  M5_SOUTHWEST:          7.60,
  WESTCONNEX_M4_MAX:    10.79,
  WESTCONNEX_M8_MAX:     7.60,
  WESTCONNEX_M5_EAST_MAX:7.60,
  M7_PER_KM:             0.5181,
  M7_MAX:               10.36,
  NORTHCONNEX:           8.97,
  WESTCONNEX_EXTENDED_MAX: 12.74,
};

const TOLL_ZONES = {
  airport:        ['airport','mascot','terminal','kingsford smith','domestic terminal','international terminal','t1','t2','t3'],
  cbd:            ['cbd','city','sydney','circular quay','wynyard','town hall','martin place','barangaroo','darling harbour','the rocks','haymarket','chinatown','pyrmont','ultimo'],
  eastern:        ['bondi','coogee','randwick','maroubra','bronte','waverley','double bay','rose bay','vaucluse','woollahra','paddington','darlinghurst','potts point','elizabeth bay','rushcutters bay','edgecliff','bellevue hill'],
  inner_south:    ['surry hills','redfern','waterloo','zetland','rosebery','alexandria','newtown','enmore','marrickville','erskineville','st peters','tempe','sydenham'],
  inner_west:     ['glebe','annandale','leichhardt','lilyfield','rozelle','balmain','drummoyne','haberfield','five dock','croydon','ashfield','summer hill','dulwich hill','petersham','stanmore','camperdown'],
  lower_north:    ['north sydney','milsons point','kirribilli','neutral bay','cremorne','mosman','wollstonecraft','waverton','crows nest','st leonards','artarmon','lane cove','greenwich','longueville','riverview'],
  upper_north:    ['chatswood','willoughby','roseville','lindfield','killara','gordon','pymble','turramurra','warrawee','st ives','hornsby','normanhurst','thornleigh','pennant hills','west pennant hills','cheltenham','beecroft'],
  northern_beaches:['manly','dee why','brookvale','narrabeen','mona vale','newport','avalon','palm beach','collaroy','curl curl','freshwater','balgowlah','seaforth','clontarf','fairlight','north head','warriewood','elanora heights','ingleside','bayview','church point','terry hills','belrose','frenchs forest','forestville','allambie heights','beacon hill'],
  hills:          ['castle hill','baulkham hills','west pennant hills','carlingford','epping','eastwood','north rocks','north epping','dural','glenhaven','kellyville','rouse hill','beaumont hills','the ponds','stanhope gardens','bella vista','norwest','winston hills'],
  parramatta:     ['parramatta','harris park','granville','merrylands','guildford','auburn','lidcombe','homebush','strathfield','burwood','concord','rhodes','olympic park','silverwater','newington','wentworth point','ermington','rydalmere','dundas','telopea','oatlands','northmead'],
  southwest:      ['liverpool','fairfield','cabramatta','canley vale','canley heights','villawood','bass hill','bankstown','revesby','padstow','panania','milperra','east hills','moorebank','holsworthy','casula','prestons','leppington','ingleburn','macquarie fields','campbelltown','camden','narellan','gregory hills','oran park'],
  west:           ['blacktown','seven hills','toongabbie','wentworthville','pendle hill','prospect','lalor park','kings langley','quakers hill','marayong','schofields','riverstone','marsden park','eastern creek','rooty hill','mount druitt','st marys','werrington','kingswood','penrith','emu plains','glenmore park','jordan springs','mulgoa','luddenham','badgerys creek','western sydney airport'],
  blue_mountains: ['glenbrook','blaxland','warrimoo','valley heights','springwood','faulconbridge','linden','woodford','hazelbrook','lawson','bullaburra','wentworth falls','leura','katoomba'],
  sutherland:     ['cronulla','sutherland','miranda','caringbah','gymea','sylvania','engadine','heathcote','waterfall','como','jannali','kirrawee','hurstville','kogarah','rockdale','arncliffe','wolli creek','brighton-le-sands','sans souci','ramsgate'],
  m5_corridor:    ['beverly hills','kingsgrove','bexley','penshurst','mortdale','oatley','peakhurst','lugarno','riverwood','narwee','padstow','revesby','milperra','bankstown airport'],
  northwest_ncx:  ['wahroonga','mount colah','mount kuring-gai','berowra','brooklyn','cowan','asquith'],
};

function detectZones(address) {
  if (!address) return [];
  const addr  = address.toLowerCase();
  const zones = [];
  for (const [zone, keywords] of Object.entries(TOLL_ZONES)) {
    for (const kw of keywords) {
      if (addr.includes(kw)) { zones.push(zone); break; }
    }
  }
  return zones;
}

function lookupTollsFallback(pickup, dropoff) {
  if (!pickup || !dropoff) return 0;
  const pu = (pickup  || '').toLowerCase();
  const dr = (dropoff || '').toLowerCase();
  const puZones = detectZones(pu);
  const drZones = detectZones(dr);
  const puIn = z => puZones.includes(z);
  const drIn = z => drZones.includes(z);
  const routeBetween = (a, b) => (puIn(a) && drIn(b)) || (puIn(b) && drIn(a));
  let totalToll = 0;
  // Harbour Bridge/Tunnel
  if (routeBetween('lower_north', 'cbd') || routeBetween('lower_north', 'eastern') ||
      routeBetween('lower_north', 'inner_south') || routeBetween('lower_north', 'inner_west') ||
      routeBetween('upper_north', 'cbd') || routeBetween('upper_north', 'eastern') ||
      routeBetween('upper_north', 'inner_south') || routeBetween('upper_north', 'inner_west') ||
      routeBetween('northern_beaches', 'cbd') || routeBetween('northern_beaches', 'eastern') ||
      routeBetween('hills', 'cbd') || routeBetween('hills', 'eastern') ||
      routeBetween('lower_north', 'airport') || routeBetween('upper_north', 'airport') ||
      routeBetween('northern_beaches', 'airport') || routeBetween('hills', 'airport') ||
      routeBetween('northwest_ncx', 'cbd') || routeBetween('northwest_ncx', 'eastern') ||
      routeBetween('northwest_ncx', 'airport')) {
    totalToll += TOLL_RATES.HARBOUR_BRIDGE;
  }
  // NorthConnex
  if (routeBetween('northwest_ncx', 'upper_north') || routeBetween('northwest_ncx', 'hills') ||
      routeBetween('northwest_ncx', 'lower_north') || routeBetween('northwest_ncx', 'parramatta')) {
    totalToll += TOLL_RATES.NORTHCONNEX;
  }
  // Cross City Tunnel
  if ((puIn('eastern') && (drIn('inner_west') || drIn('cbd'))) ||
      (drIn('eastern') && (puIn('inner_west') || puIn('cbd')))) {
    if (pu.includes('rushcutters') || pu.includes('potts point') || pu.includes('elizabeth bay') || pu.includes('edgecliff') ||
        dr.includes('rushcutters') || dr.includes('potts point') || dr.includes('elizabeth bay') || dr.includes('edgecliff')) {
      totalToll += TOLL_RATES.CROSS_CITY_MAIN;
    }
  }
  // M5 South-West
  if (routeBetween('m5_corridor', 'southwest') || routeBetween('sutherland', 'southwest') ||
      (puIn('southwest') && (drIn('airport') || drIn('cbd') || drIn('eastern') || drIn('inner_south'))) ||
      ((puIn('airport') || puIn('cbd') || puIn('eastern') || puIn('inner_south')) && drIn('southwest'))) {
    totalToll += TOLL_RATES.M5_SOUTHWEST;
  }
  // WestConnex M4
  if ((puIn('parramatta') && (drIn('inner_west') || drIn('cbd') || drIn('airport') || drIn('eastern') || drIn('inner_south'))) ||
      (puIn('west') && (drIn('inner_west') || drIn('cbd') || drIn('airport') || drIn('eastern') || drIn('inner_south'))) ||
      (puIn('blue_mountains') && (drIn('inner_west') || drIn('cbd') || drIn('airport') || drIn('eastern') || drIn('inner_south'))) ||
      ((puIn('inner_west') || puIn('cbd') || puIn('airport') || puIn('eastern') || puIn('inner_south')) && (drIn('west') || drIn('blue_mountains'))) ||
      ((puIn('inner_west') || puIn('airport')) && drIn('parramatta'))) {
    totalToll += TOLL_RATES.WESTCONNEX_M4_MAX;
  }
  // WestConnex M8
  if (routeBetween('inner_south', 'm5_corridor') ||
      (puIn('m5_corridor') && (drIn('cbd') || drIn('eastern') || drIn('airport'))) ||
      ((puIn('cbd') || puIn('eastern') || puIn('airport')) && drIn('m5_corridor'))) {
    totalToll += TOLL_RATES.WESTCONNEX_M8_MAX;
  }
  // WestConnex M5 East
  if ((puIn('sutherland') && drIn('airport')) || (puIn('airport') && drIn('sutherland'))) {
    totalToll += TOLL_RATES.WESTCONNEX_M5_EAST_MAX;
  }
  // Westlink M7
  if (routeBetween('southwest', 'west') || routeBetween('southwest', 'hills') ||
      (puIn('southwest') && drIn('northwest_ncx')) || (puIn('northwest_ncx') && drIn('southwest'))) {
    totalToll += TOLL_RATES.M7_MAX;
  }
  // Specific well-known routes
  if ((pu.includes('glenbrook') || pu.includes('blaxland') || pu.includes('springwood') || pu.includes('katoomba') || pu.includes('blue mountains')) &&
      (dr.includes('airport') || dr.includes('mascot') || dr.includes('terminal'))) {
    return +TOLL_RATES.WESTCONNEX_M4_MAX.toFixed(2);
  }
  if ((dr.includes('glenbrook') || dr.includes('blaxland') || dr.includes('springwood') || dr.includes('katoomba') || dr.includes('blue mountains')) &&
      (pu.includes('airport') || pu.includes('mascot') || pu.includes('terminal'))) {
    return +TOLL_RATES.WESTCONNEX_M4_MAX.toFixed(2);
  }
  if ((pu.includes('windsor') || pu.includes('richmond') || pu.includes('hawkesbury')) &&
      (dr.includes('airport') || dr.includes('mascot') || dr.includes('terminal'))) {
    return +(TOLL_RATES.M7_MAX + TOLL_RATES.WESTCONNEX_M4_MAX).toFixed(2);
  }
  if ((dr.includes('windsor') || dr.includes('richmond') || dr.includes('hawkesbury')) &&
      (pu.includes('airport') || pu.includes('mascot') || pu.includes('terminal'))) {
    return +(TOLL_RATES.M7_MAX + TOLL_RATES.WESTCONNEX_M4_MAX).toFixed(2);
  }
  return +totalToll.toFixed(2);
}

// ─── Live toll via Google Routes API ─────────────────────────────────────────
const tollCache = new Map();
async function fetchTollsFromGoogle(pickup, dropoff) {
  const MAPS_KEY  = CFG.MAPS_KEY;
  const cacheKey  = `${(pickup || '').toLowerCase().trim()}|${(dropoff || '').toLowerCase().trim()}`;
  if (tollCache.has(cacheKey)) return tollCache.get(cacheKey);
  try {
    const body = {
      origin:      { address: pickup  + ', NSW, Australia' },
      destination: { address: dropoff + ', NSW, Australia' },
      travelMode:  'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      extraComputations: ['TOLLS'],
      units: 'METRIC',
    };
    const resp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_KEY,
        'X-Goog-FieldMask': 'routes.travelAdvisory.tollInfo',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('Routes API HTTP ' + resp.status);
    const data  = await resp.json();
    const route = (data.routes || [])[0];
    if (!route) throw new Error('No route returned');
    const tollInfo = route.travelAdvisory?.tollInfo;
    let tollAUD = 0;
    if (tollInfo && tollInfo.estimatedPrice) {
      for (const price of tollInfo.estimatedPrice) {
        if (price.currencyCode === 'AUD') {
          tollAUD = +(price.units || 0) + (price.nanos || 0) / 1e9;
          break;
        }
      }
    }
    tollAUD = +tollAUD.toFixed(2);
    console.log(`[TOLLS] ${pickup} → ${dropoff}: $${tollAUD} AUD (Google Routes API)`);
    tollCache.set(cacheKey, tollAUD);
    setTimeout(() => tollCache.delete(cacheKey), 6 * 60 * 60 * 1000);
    return tollAUD;
  } catch (e) {
    console.warn('[TOLLS] Google API failed, using fallback:', e.message);
    return null;
  }
}

async function resolveTolls(pickup, dropoff) {
  const live = await fetchTollsFromGoogle(pickup, dropoff);
  if (live !== null) return live;
  return lookupTollsFallback(pickup, dropoff);
}

module.exports = { calcFare, calcBaseFare, resolveTolls, FARES, GOVT_LEVY, BOOKING_FEE, CARD_FEE_PCT };
