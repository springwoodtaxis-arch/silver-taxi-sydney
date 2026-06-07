from pathlib import Path
from datetime import date
import html
import re

ROOT = Path('/home/ubuntu/silver-service-online')
PUBLIC = ROOT / 'public'
BASE = 'https://silverserviceonline.com.au'
TODAY = date.today().isoformat()

COUNCILS = [
    ("City of Sydney", 31),
    ("City of Parramatta", 27),
    ("City of Blacktown", 32),
    ("City of Canterbury-Bankstown", 29),
    ("City of Liverpool", 27),
    ("Cumberland City Council", 19),
    ("Bayside Council", 28),
    ("City of Penrith", 28),
    ("City of Fairfield", 25),
    ("City of Ryde", 16),
    ("Burwood Council", 6),
    ("Strathfield Council", 5),
    ("Sutherland Shire Council", 33),
    ("Northern Beaches Council", 35),
    ("Hornsby Shire Council", 35),
    ("Randwick City Council", 19),
    ("City of Campbelltown", 22),
    ("Camden Council", 13),
    ("Wollondilly Shire Council", 9),
    ("Inner West Council", 30),
    ("North Sydney Council", 13),
    ("City of Willoughby", 8),
    ("Ku-ring-gai Council", 12),
    ("Lane Cove Council", 8),
    ("The Hills Shire Council", 16),
    ("Georges River Council", 17),
    ("Waverley Council", 11),
    ("Woollahra Council", 10),
    ("Mosman Council", 7),
    ("City of Wollongong", 37),
    ("Central Coast Council", 45),
    ("Blue Mountains City Council", 22),
    ("Hawkesbury City Council", 13),
]

ICON_BUS = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9"/><path d="M4 11h16"/><path d="M7 20h.01"/><path d="M17 20h.01"/><path d="M6 16h12"/><path d="M6 20h12"/></svg>'''
ICON_PLANE = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>'''
ICON_GROUP = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'''
ICON_SHIELD = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>'''
ICON_BABY = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/><path d="M9 9h.01M15 9h.01M10 12c1.2 1 2.8 1 4 0"/></svg>'''
ICON_ACCESS = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="M10 8h4l1 5h3l2 7"/><path d="M9 11l-1 4a4 4 0 1 0 7 3"/></svg>'''

STYLE = '''
<style>
.maxi-area-hero{position:relative;padding:142px 0 88px;background:linear-gradient(135deg,rgba(7,17,31,.97),rgba(13,54,94,.92)),url('/images/hero-sydney.jpg');background-size:cover;background-position:center;color:#fff;overflow:hidden}.maxi-area-hero:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 78% 20%,rgba(214,170,47,.24),transparent 32%),linear-gradient(90deg,rgba(5,12,23,.94),rgba(9,31,58,.70));pointer-events:none}.maxi-area-hero .container{position:relative;z-index:2}.maxi-area-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,.48fr);gap:46px;align-items:center}.maxi-eyebrow{display:inline-flex;align-items:center;gap:10px;padding:10px 16px;border:1px solid rgba(214,170,47,.36);border-radius:999px;background:rgba(214,170,47,.13);color:#f5d875;font-weight:900;letter-spacing:.15em;text-transform:uppercase;font-size:12px}.maxi-area-title{font-family:var(--font-display,Georgia,serif);font-size:clamp(42px,6.4vw,82px);line-height:.94;margin:22px 0 18px;text-transform:uppercase;letter-spacing:-.04em}.maxi-area-title span{display:block;color:#d6aa2f}.maxi-area-lead{font-size:19px;line-height:1.78;color:rgba(255,255,255,.82);max-width:830px}.maxi-area-ctas{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px}.maxi-area-card{padding:28px;border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.045));border:1px solid rgba(214,170,47,.30);box-shadow:0 34px 90px rgba(0,0,0,.32);backdrop-filter:blur(18px)}.maxi-area-card h2{font-family:var(--font-display,Georgia,serif);font-size:34px;line-height:1.02;margin:0 0 18px;color:#fff;text-transform:uppercase}.maxi-stat-list{display:grid;gap:12px}.maxi-stat{display:flex;align-items:center;gap:13px;padding:14px;border-radius:18px;background:rgba(12,45,83,.58);border:1px solid rgba(255,255,255,.12);font-weight:800}.maxi-stat svg{color:#d6aa2f;flex:0 0 22px}.maxi-section{padding:84px 0}.maxi-section.alt{background:#f7f8fb}.maxi-section.dark{background:linear-gradient(135deg,#07111f,#103963);color:#fff}.maxi-section-head{max-width:900px;margin:0 auto 42px;text-align:center}.maxi-kicker{display:inline-flex;padding:9px 15px;border-radius:999px;background:rgba(214,170,47,.14);color:#a97813;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.maxi-section.dark .maxi-kicker{background:rgba(214,170,47,.2);color:#f4d263}.maxi-section-title{font-family:var(--font-display,Georgia,serif);font-size:clamp(34px,4vw,56px);line-height:1.04;margin:18px 0 14px;color:#081a33;text-transform:uppercase}.maxi-section.dark .maxi-section-title{color:#fff}.maxi-section-title span{color:#d6aa2f}.maxi-copy{font-size:18px;line-height:1.78;color:#667085}.maxi-section.dark .maxi-copy{color:rgba(255,255,255,.76)}.maxi-card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.maxi-card{padding:28px;border-radius:28px;background:#fff;border:1px solid rgba(8,26,51,.08);box-shadow:0 20px 60px rgba(8,26,51,.08)}.maxi-icon-box{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;color:#d6aa2f;background:linear-gradient(145deg,rgba(214,170,47,.16),rgba(12,45,83,.08));border:1px solid rgba(214,170,47,.24);margin-bottom:18px}.maxi-icon-box svg{width:22px;height:22px;display:block;flex:none}.maxi-card h3{font-family:var(--font-display,Georgia,serif);font-size:24px;margin:0 0 12px;color:#081a33}.maxi-card p{margin:0;color:#667085;line-height:1.72}.maxi-two-col{display:grid;grid-template-columns:1fr 1fr;gap:28px}.maxi-panel{padding:34px;border-radius:30px;background:#fff;border:1px solid rgba(8,26,51,.08);box-shadow:0 22px 70px rgba(8,26,51,.08)}.maxi-panel h2{font-family:var(--font-display,Georgia,serif);font-size:36px;line-height:1.05;margin:0 0 18px;color:#081a33}.maxi-panel p{font-size:17px;line-height:1.78;color:#667085}.maxi-link-cloud{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.maxi-link-cloud a,.maxi-link-cloud span{padding:10px 14px;border-radius:999px;background:#f4f6fa;border:1px solid rgba(8,26,51,.1);color:#081a33;font-weight:800;text-decoration:none;font-size:13px}.maxi-council-directory{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.maxi-council-directory a{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);color:#fff;text-decoration:none;font-weight:800}.maxi-council-directory span{color:#f4d263;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.maxi-final-cta{padding:46px;border-radius:34px;background:linear-gradient(135deg,#081a33,#103963);color:#fff;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}.maxi-final-cta h2{font-family:var(--font-display,Georgia,serif);font-size:40px;margin:0 0 12px;text-transform:uppercase}.maxi-final-cta p{margin:0;color:rgba(255,255,255,.75);font-size:18px;line-height:1.65}.maxi-final-actions{display:flex;gap:14px;flex-wrap:wrap}.maxi-final-actions .btn-outline{color:#fff;border-color:rgba(255,255,255,.35)}@media(max-width:980px){.maxi-area-grid,.maxi-two-col,.maxi-final-cta{grid-template-columns:1fr}.maxi-card-grid,.maxi-council-directory{grid-template-columns:1fr 1fr}.maxi-area-hero{padding:120px 0 70px}}@media(max-width:640px){.maxi-card-grid,.maxi-council-directory{grid-template-columns:1fr}.maxi-area-title{font-size:42px}.maxi-area-ctas .btn,.maxi-final-actions .btn{width:100%;justify-content:center}.maxi-final-cta{padding:28px}.maxi-final-cta h2{font-size:31px}}
</style>
'''


def slugify(name: str) -> str:
    s = name.lower().replace('&', 'and')
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s


def extract_header_footer(src: str):
    nav_end = src.find('</nav>')
    footer_start = src.find('<footer')
    if nav_end == -1 or footer_start == -1:
        raise RuntimeError('Could not locate header/footer in services.html')
    return src[: nav_end + len('</nav>')], src[footer_start:]


def set_meta(header: str, council: str, suburbs: int, slug: str) -> str:
    title = f'Maxi Taxi {council} | 11 Seater Maxi Cab & Airport Transfers'
    desc = f'Book Maxi Taxi {council} service across {suburbs} suburbs for 7 to 11 seater maxi cab trips, Sydney Airport transfers, wheelchair accessible taxi requests, baby seats, cruise transfers and group travel.'
    keywords = f'maxi taxi {council}, maxi cab {council}, 11 seater taxi {council}, airport maxi taxi {council}, wheelchair maxi taxi {council}, baby seat taxi {council}, group taxi {council}, cruise transfer maxi cab {council}'
    canonical = f'{BASE}/maxi-taxi/{slug}/'
    header = header.replace('href="images/logo.png"', 'href="/images/logo.png"')
    header = header.replace('href="style.css?v=7"', 'href="/style.css?v=7"')
    header = header.replace('href="style.css?v=7"', 'href="/style.css?v=7"')
    header = re.sub(r'<title>.*?</title>', f'<title>{html.escape(title)}</title>', header, flags=re.S)
    header = re.sub(r'<meta name="description" content="[^"]*"\s*/?>', f'<meta name="description" content="{html.escape(desc)}"/>', header)
    header = re.sub(r'<meta name="keywords" content="[^"]*"\s*/?>', f'<meta name="keywords" content="{html.escape(keywords)}"/>', header)
    header = re.sub(r'<link rel="canonical" href="[^"]*"\s*/?>', f'<link rel="canonical" href="{canonical}"/>', header)
    header = re.sub(r'<meta property="og:title" content="[^"]*"\s*/?>', f'<meta property="og:title" content="{html.escape(title)}"/>', header)
    header = re.sub(r'<meta property="og:description" content="[^"]*"\s*/?>', f'<meta property="og:description" content="{html.escape(desc)}"/>', header)
    header = re.sub(r'<meta property="og:url" content="[^"]*"\s*/?>', f'<meta property="og:url" content="{canonical}"/>', header)
    header = re.sub(r'<meta name="twitter:title" content="[^"]*"\s*/?>', f'<meta name="twitter:title" content="{html.escape(title)}"/>', header)
    header = re.sub(r'<meta name="twitter:description" content="[^"]*"\s*/?>', f'<meta name="twitter:description" content="{html.escape(desc)}"/>', header)
    if STYLE not in header:
        header = header.replace('</head>', STYLE + '\n</head>')
    return header


def schema(council: str, suburbs: int, slug: str) -> str:
    url = f'{BASE}/maxi-taxi/{slug}/'
    safe = html.escape(council)
    return f'''
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"Service","name":"Maxi Taxi {safe}","serviceType":"Premium Maxi Taxi and Maxi Cab Group Transport","provider":{{"@type":"LocalBusiness","name":"Silver Service Online","telephone":"1800 173 171","url":"{BASE}"}},"areaServed":"{safe}","description":"Premium Maxi Taxi {safe} service across {suburbs} suburbs for airport transfers, 11 seater taxi requests, baby seat taxi requests, wheelchair accessible taxi requests, cruise transfers, corporate travel and event transport.","url":"{url}"}}
</script>
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{{"@type":"Question","name":"Can I book a Maxi Taxi in {safe}?","acceptedAnswer":{{"@type":"Answer","text":"Yes. Silver Service Online supports premium Maxi Taxi and maxi cab booking requests across {safe} for airport transfers, groups, luggage, events and corporate travel."}}}},{{"@type":"Question","name":"How many suburbs are covered in {safe}?","acceptedAnswer":{{"@type":"Answer","text":"This Maxi Taxi service-area page targets {suburbs} suburbs across {safe}, with direct online booking and phone booking pathways for group transport."}}}},{{"@type":"Question","name":"Can I request airport, baby seat or wheelchair support?","acceptedAnswer":{{"@type":"Answer","text":"Yes. Add Sydney Airport, Western Sydney Airport, baby seat, booster, wheelchair access, passenger count and luggage details when booking so requirements can be checked and confirmed."}}}}]}}
</script>
'''


def page_body(council: str, suburbs: int, slug: str) -> str:
    safe = html.escape(council)
    url = f'/maxi-taxi/{slug}/'
    links = ''.join(f'<a href="/maxi-taxi/{slugify(name)}/">{html.escape(name)} <span>{count} suburbs</span></a>' for name, count in COUNCILS if name != council)
    return f'''
<main>
<section class="maxi-area-hero">
  <div class="container">
    <div class="maxi-area-grid">
      <div>
        <span class="maxi-eyebrow">{ICON_BUS} Premium Maxi Taxi Service Area</span>
        <h1 class="maxi-area-title">Maxi Taxi <span>{safe}</span></h1>
        <p class="maxi-area-lead">Book a premium Maxi Taxi {safe} service across {suburbs} suburbs for Sydney Airport transfers, Western Sydney Airport transfers, 7 to 11 seater maxi cab bookings, family trips with luggage, wheelchair accessible taxi requests, baby seat taxi requests, cruise terminal transfers, events, weddings and corporate group transport.</p>
        <div class="maxi-area-ctas"><a class="btn btn-gold" href="/book?vehicle=maxi&area={slug}">Book Maxi Taxi {safe}</a><a class="btn btn-outline" href="tel:1800173171">Call 1800 173 171</a></div>
      </div>
      <aside class="maxi-area-card"><h2>{safe} Maxi Cab Coverage</h2><div class="maxi-stat-list"><div class="maxi-stat">{ICON_GROUP}<span>{suburbs} suburb service-area coverage</span></div><div class="maxi-stat">{ICON_PLANE}<span>Airport, cruise and hotel transfers</span></div><div class="maxi-stat">{ICON_SHIELD}<span>Fixed-fare quote pathway before pickup</span></div><div class="maxi-stat">{ICON_BUS}<span>7-11 seat group taxi requests</span></div></div></aside>
    </div>
  </div>
</section>
<section class="maxi-section">
  <div class="container">
    <div class="maxi-section-head"><span class="maxi-kicker">Local Maxi Taxi Bookings</span><h2 class="maxi-section-title"><span>Maxi Taxi {safe}</span> booking options</h2><p class="maxi-copy">Book a Maxi Taxi in {safe} for airport transfers, larger groups, luggage, baby seat requests, accessible taxi requests, cruise transfers, events and corporate travel.</p></div>
    <div class="maxi-card-grid">
      <article class="maxi-card"><div class="maxi-icon-box">{ICON_PLANE}</div><h3>Airport Maxi Taxi Transfers</h3><p>Pre-book a maxi taxi from {safe} to Sydney Airport terminals T1, T2 and T3 or Western Sydney International Airport. Ideal for families, business teams, visitors and groups carrying suitcases or sporting equipment.</p></article>
      <article class="maxi-card"><div class="maxi-icon-box">{ICON_GROUP}</div><h3>7 to 11 Seater Maxi Cabs</h3><p>Keep your group together with spacious maxi cab options instead of splitting across multiple rides. Add passenger count, luggage quantity and pickup notes so the correct vehicle type can be checked.</p></article>
      <article class="maxi-card"><div class="maxi-icon-box">{ICON_BABY}</div><h3>Family and Baby Seat Requests</h3><p>Request child-friendly taxi travel with room for prams, capsules, boosters and luggage. Baby seat and booster requirements should be added during booking for confirmation before pickup.</p></article>
      <article class="maxi-card"><div class="maxi-icon-box">{ICON_ACCESS}</div><h3>Wheelchair Accessible Requests</h3><p>Wheelchair accessible maxi taxi requests can be submitted with ramp, mobility and passenger details. The team checks suitable availability and confirms the practical transfer pathway.</p></article>
      <article class="maxi-card"><div class="maxi-icon-box">{ICON_BUS}</div><h3>Events, Weddings and Cruise Transfers</h3><p>Book group maxi cab transfers from {safe} to hotels, restaurants, wedding venues, race days, concerts, sporting fixtures, White Bay Cruise Terminal and the Overseas Passenger Terminal.</p></article>
      <article class="maxi-card"><div class="maxi-icon-box">{ICON_SHIELD}</div><h3>Direct Booking and Fixed Fare Quotes</h3><p>Use the Silver Service Online booking flow for direct confirmation, professional dispatch support, clear pickup instructions and fixed-fare quote options before your group travels.</p></article>
    </div>
  </div>
</section>
<section class="maxi-section alt">
  <div class="container"><div class="maxi-two-col"><div class="maxi-panel"><h2>Maxi Taxi options for {safe}</h2><p>Arrange a Maxi Taxi in {safe} for group travel, airport transfers, family trips, cruise terminal pickups, larger luggage, baby seat requests and wheelchair accessible taxi requests.</p><div class="maxi-link-cloud"><a href="/maxi-taxi">Maxi Taxi Sydney</a><a href="/airport-transfers">Sydney Airport Transfers</a><a href="/locations/western-sydney-airport/">Western Sydney Airport</a><a href="/locations/">All Taxi Locations</a><span>{suburbs} Suburbs Covered</span></div></div><div class="maxi-panel"><h2>Book Maxi Taxi {safe}</h2><p>Enter your pickup, destination, time, passenger count, luggage count and special requirements. For airport and cruise transfers, include terminal, flight, ship, hotel or venue details so your group booking can be checked properly.</p><div class="maxi-area-ctas"><a class="btn btn-gold" href="/book?vehicle=maxi&area={slug}">Book Online</a><a class="btn btn-outline" href="tel:1800173171">Call 1800 173 171</a></div></div></div></div>
</section>
<section class="maxi-section dark">
  <div class="container"><div class="maxi-section-head"><span class="maxi-kicker">Maxi Taxi Service Areas</span><h2 class="maxi-section-title">More <span>Maxi Taxi service areas</span></h2><p class="maxi-copy">Explore Maxi Taxi booking options across Greater Sydney, the Central Coast, Blue Mountains, Wollongong and Hawkesbury travel corridors.</p></div><div class="maxi-council-directory">{links}</div></div>
</section>
<section class="maxi-section alt"><div class="container"><div class="maxi-final-cta"><div><h2>Need a Maxi Taxi in {safe}?</h2><p>Book direct for a premium maxi cab, 11 seater taxi request, airport group transfer, wheelchair accessible taxi request, baby seat taxi request, cruise pickup or corporate group ride across {suburbs} suburbs.</p></div><div class="maxi-final-actions"><a class="btn btn-gold" href="/book?vehicle=maxi&area={slug}">Book Maxi Taxi Online</a><a class="btn btn-outline" href="tel:1800173171">Call 1800 173 171</a></div></div></div></section>
</main>
'''


def create_area_pages():
    src = (PUBLIC / 'services.html').read_text(errors='ignore')
    head, footer = extract_header_footer(src)
    out_base = PUBLIC / 'maxi-taxi'
    out_base.mkdir(exist_ok=True)
    for council, suburbs in COUNCILS:
        slug = slugify(council)
        folder = out_base / slug
        folder.mkdir(parents=True, exist_ok=True)
        page = set_meta(head, council, suburbs, slug) + '\n' + page_body(council, suburbs, slug) + '\n' + footer
        page = page.replace('</body>', schema(council, suburbs, slug) + '\n</body>')
        (folder / 'index.html').write_text(page)


def update_main_maxi_page():
    path = PUBLIC / 'maxi-taxi.html'
    text = path.read_text(errors='ignore')
    directory = ''.join(f'<a href="/maxi-taxi/{slugify(name)}/">{html.escape(name)} <span>{count} suburbs</span></a>' for name, count in COUNCILS)
    section = f'''
<section class="maxi-section dark">
  <div class="container">
    <div class="maxi-section-head"><span class="maxi-kicker">Maxi Taxi Service Areas</span><h2 class="maxi-section-title">Maxi Taxi service across <span>Sydney council areas</span></h2><p class="maxi-section-copy">Choose your council area to book a Maxi Taxi for airport transfers, group travel, baby seat requests, accessible taxi requests, cruise transfers, events and corporate trips.</p></div>
    <div class="maxi-council-directory">{directory}</div>
  </div>
</section>
'''
    if '.maxi-council-directory' not in text:
        text = text.replace('@media(max-width:980px){.maxi-hero', '.maxi-council-directory{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.maxi-council-directory a{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);color:#fff;text-decoration:none;font-weight:800}.maxi-council-directory span{color:#f4d263;font-size:12px;text-transform:uppercase;letter-spacing:.08em}@media(max-width:980px){.maxi-hero')
        text = text.replace('@media(max-width:980px){.maxi-hero{padding:120px 0 70px}.maxi-hero-grid,.maxi-seo-band,.maxi-final-cta{grid-template-columns:1fr}.maxi-service-grid{grid-template-columns:1fr 1fr}.maxi-trust{grid-template-columns:1fr 1fr}.maxi-area-grid{columns:2}}', '@media(max-width:980px){.maxi-hero{padding:120px 0 70px}.maxi-hero-grid,.maxi-seo-band,.maxi-final-cta{grid-template-columns:1fr}.maxi-service-grid,.maxi-council-directory{grid-template-columns:1fr 1fr}.maxi-trust{grid-template-columns:1fr 1fr}.maxi-area-grid{columns:2}}')
        text = text.replace('@media(max-width:640px){.maxi-service-grid{grid-template-columns:1fr}', '@media(max-width:640px){.maxi-service-grid,.maxi-council-directory{grid-template-columns:1fr}')
    marker = '<section class="maxi-section">\n  <div class="container">\n    <div class="maxi-section-head"><span class="maxi-kicker">Maxi Taxi FAQs</span>'
    if 'Maxi Taxi service across <span>Sydney council areas</span>' not in text:
        text = text.replace(marker, section + '\n' + marker)
    path.write_text(text)


def update_sitemaps():
    sm = PUBLIC / 'sitemap.xml'
    if sm.exists():
        text = sm.read_text(errors='ignore')
        inserts = []
        for council, _ in COUNCILS:
            loc = f'{BASE}/maxi-taxi/{slugify(council)}/'
            if f'<loc>{loc}</loc>' not in text:
                inserts.append(f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.90</priority>\n  </url>\n')
        if inserts:
            text = text.replace('</urlset>', ''.join(inserts) + '</urlset>')
            sm.write_text(text)
    hs = PUBLIC / 'sitemap-html.html'
    if hs.exists():
        text = hs.read_text(errors='ignore')
        if 'Maxi Taxi Service Areas' not in text:
            links = '\n'.join(f'<a href="/maxi-taxi/{slugify(name)}/">Maxi Taxi {html.escape(name)}</a>' for name, _ in COUNCILS)
            block = f'\n<h2>Maxi Taxi Service Areas</h2>\n<div class="sitemap-grid">\n{links}\n</div>\n'
            text = text.replace('</main>', block + '</main>') if '</main>' in text else text + block
            hs.write_text(text)


def main():
    create_area_pages()
    update_main_maxi_page()
    update_sitemaps()
    print(f'Created {len(COUNCILS)} Maxi Taxi council service-area pages and updated Maxi Taxi directory/sitemaps.')

if __name__ == '__main__':
    main()

# Dedicated Maxi Taxi logo/menu, SVG constraints, and SEO dashboard registration are finalized by scripts/patch_maxi_dedicated_section.py.
