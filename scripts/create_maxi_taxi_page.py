from pathlib import Path
import re
from datetime import date

ROOT = Path('/home/ubuntu/silver-service-online')
PUBLIC = ROOT / 'public'
BASE = 'https://silverserviceonline.com.au'
TODAY = date.today().isoformat()

MAXI_SVG = '''<svg class="maxi-logo-svg" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="7" y="18" width="58" height="34" rx="12" fill="url(#maxiGold)"/>
  <path d="M17 36h38M22 28h28M20 44h32" stroke="#07111f" stroke-width="3" stroke-linecap="round"/>
  <circle cx="23" cy="55" r="5" fill="#07111f"/><circle cx="50" cy="55" r="5" fill="#07111f"/>
  <path d="M13 34l7-10h32l7 10" stroke="#07111f" stroke-width="3" stroke-linejoin="round"/>
  <path d="M29 14h14" stroke="#e9c75d" stroke-width="4" stroke-linecap="round"/>
  <defs><linearGradient id="maxiGold" x1="7" y1="18" x2="65" y2="52" gradientUnits="userSpaceOnUse"><stop stop-color="#fff0a8"/><stop offset="0.45" stop-color="#d6aa2f"/><stop offset="1" stop-color="#a97813"/></linearGradient></defs>
</svg>'''

ICON_GROUP = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'''
ICON_PLANE = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>'''
ICON_SHIELD = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>'''
ICON_BRIEFCASE = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>'''
ICON_BABY = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/><path d="M9 9h.01M15 9h.01M10 12c1.2 1 2.8 1 4 0"/></svg>'''
ICON_ACCESS = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M10 8h4l1 5h3l2 7"/><path d="M9 11l-1 4a4 4 0 1 0 7 3"/></svg>'''
ICON_CRUISE = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M5 18V8l7-4 7 4v10"/><path d="M2 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0"/></svg>'''
ICON_STAR = '''<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'''

PAGE_STYLE = '''
<style>
.maxi-hero{position:relative;padding:150px 0 90px;background:linear-gradient(135deg,rgba(7,17,31,.96),rgba(12,45,83,.93)),url('/images/hero-sydney.jpg');background-size:cover;background-position:center;color:#fff;overflow:hidden}.maxi-hero:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 78% 22%,rgba(220,178,65,.22),transparent 34%),linear-gradient(90deg,rgba(5,12,23,.92),rgba(9,31,58,.72));pointer-events:none}.maxi-hero .container{position:relative;z-index:2}.maxi-hero-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.72fr);gap:56px;align-items:center}.maxi-eyebrow{display:inline-flex;align-items:center;gap:10px;padding:10px 16px;border:1px solid rgba(214,170,47,.35);border-radius:999px;background:rgba(214,170,47,.12);color:#f5d875;font-weight:900;letter-spacing:.16em;text-transform:uppercase;font-size:12px}.maxi-title{font-family:var(--font-display,Georgia,serif);font-size:clamp(48px,7vw,92px);line-height:.92;margin:22px 0 20px;text-transform:uppercase;letter-spacing:-.04em}.maxi-title span{display:block;color:#d6aa2f}.maxi-lead{font-size:20px;line-height:1.75;color:rgba(255,255,255,.82);max-width:760px}.maxi-hero-ctas{display:flex;flex-wrap:wrap;gap:14px;margin-top:34px}.maxi-hero-ctas .btn{min-height:56px}.maxi-trust{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:34px}.maxi-trust-item{padding:16px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:rgba(255,255,255,.06);backdrop-filter:blur(14px)}.maxi-trust-num{display:block;color:#f4d263;font-weight:900;font-size:22px}.maxi-trust-label{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.7)}.maxi-logo-card{border:1px solid rgba(214,170,47,.36);border-radius:34px;padding:30px;background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.045));box-shadow:0 35px 90px rgba(0,0,0,.34);backdrop-filter:blur(22px)}.maxi-logo-lockup{display:flex;align-items:center;gap:18px;padding:20px;border-radius:26px;background:rgba(2,8,18,.45);border:1px solid rgba(255,255,255,.11)}.maxi-logo-svg{flex:0 0 72px;filter:drop-shadow(0 14px 24px rgba(214,170,47,.25))}.maxi-logo-text strong{display:block;font-family:var(--font-display,Georgia,serif);font-size:33px;line-height:.92;text-transform:uppercase}.maxi-logo-text span{display:block;margin-top:8px;color:#f4d263;font-weight:900;letter-spacing:.18em;text-transform:uppercase;font-size:12px}.maxi-feature-stack{margin-top:22px;display:grid;gap:12px}.maxi-feature-pill{display:flex;align-items:center;gap:12px;padding:15px 16px;border-radius:18px;background:rgba(12,45,83,.58);border:1px solid rgba(255,255,255,.12);font-weight:800}.maxi-feature-pill svg{color:#d6aa2f;flex:0 0 22px}.maxi-section{padding:90px 0}.maxi-section.alt{background:#f7f8fb}.maxi-section.dark{background:linear-gradient(135deg,#07111f,#103963);color:#fff}.maxi-section-head{max-width:840px;margin:0 auto 44px;text-align:center}.maxi-kicker{display:inline-flex;padding:9px 15px;border-radius:999px;background:rgba(214,170,47,.14);color:#a97813;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.maxi-section.dark .maxi-kicker{background:rgba(214,170,47,.2);color:#f4d263}.maxi-section-title{font-family:var(--font-display,Georgia,serif);font-size:clamp(36px,4vw,58px);line-height:1.02;margin:18px 0 14px;color:#081a33;text-transform:uppercase}.maxi-section.dark .maxi-section-title{color:#fff}.maxi-section-title span{color:#d6aa2f}.maxi-section-copy{font-size:18px;line-height:1.75;color:#667085}.maxi-section.dark .maxi-section-copy{color:rgba(255,255,255,.76)}.maxi-service-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.maxi-service-card{padding:28px;border-radius:28px;background:#fff;border:1px solid rgba(8,26,51,.08);box-shadow:0 20px 60px rgba(8,26,51,.08)}.maxi-service-card.dark-card{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.13);box-shadow:none}.maxi-icon-box{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;color:#d6aa2f;background:linear-gradient(145deg,rgba(214,170,47,.16),rgba(12,45,83,.08));border:1px solid rgba(214,170,47,.24);margin-bottom:20px}.maxi-icon-box svg{width:22px;height:22px;display:block;flex:none}.maxi-service-card h3{font-family:var(--font-display,Georgia,serif);font-size:25px;margin:0 0 12px;color:#081a33}.maxi-service-card.dark-card h3{color:#fff}.maxi-service-card p{margin:0;color:#667085;line-height:1.7}.maxi-service-card.dark-card p{color:rgba(255,255,255,.76)}.maxi-seo-band{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:stretch}.maxi-copy-panel,.maxi-book-panel{padding:34px;border-radius:30px;background:#fff;border:1px solid rgba(8,26,51,.08);box-shadow:0 22px 70px rgba(8,26,51,.08)}.maxi-copy-panel h2,.maxi-book-panel h2{font-family:var(--font-display,Georgia,serif);font-size:36px;line-height:1.05;margin:0 0 18px;color:#081a33}.maxi-copy-panel p,.maxi-book-panel p{font-size:17px;line-height:1.78;color:#667085}.maxi-keyword-cloud{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.maxi-keyword-cloud a,.maxi-keyword-cloud span{padding:10px 14px;border-radius:999px;background:#f4f6fa;border:1px solid rgba(8,26,51,.1);color:#081a33;font-weight:800;text-decoration:none;font-size:13px}.maxi-book-steps{counter-reset:step;display:grid;gap:12px;margin:22px 0}.maxi-book-step{counter-increment:step;display:flex;gap:14px;align-items:flex-start;padding:15px;border-radius:18px;background:#f7f8fb}.maxi-book-step:before{content:counter(step);width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#d6aa2f;color:#07111f;font-weight:900;flex:0 0 30px}.maxi-area-grid{columns:3;column-gap:34px}.maxi-area-grid p{break-inside:avoid;margin:0 0 14px;color:rgba(255,255,255,.76);line-height:1.65}.maxi-faq{max-width:950px;margin:0 auto;display:grid;gap:14px}.maxi-faq details{background:#fff;border:1px solid rgba(8,26,51,.09);border-radius:20px;padding:22px;box-shadow:0 12px 38px rgba(8,26,51,.06)}.maxi-faq summary{cursor:pointer;font-weight:900;color:#081a33;font-size:18px}.maxi-faq p{color:#667085;line-height:1.7;margin:14px 0 0}.maxi-final-cta{padding:48px;border-radius:34px;background:linear-gradient(135deg,#081a33,#103963);color:#fff;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}.maxi-final-cta h2{font-family:var(--font-display,Georgia,serif);font-size:42px;margin:0 0 12px;text-transform:uppercase}.maxi-final-cta p{margin:0;color:rgba(255,255,255,.75);font-size:18px;line-height:1.65}.maxi-final-actions{display:flex;gap:14px;flex-wrap:wrap}.maxi-final-actions .btn-outline{color:#fff;border-color:rgba(255,255,255,.35)}@media(max-width:980px){.maxi-hero{padding:120px 0 70px}.maxi-hero-grid,.maxi-seo-band,.maxi-final-cta{grid-template-columns:1fr}.maxi-service-grid{grid-template-columns:1fr 1fr}.maxi-trust{grid-template-columns:1fr 1fr}.maxi-area-grid{columns:2}}@media(max-width:640px){.maxi-service-grid{grid-template-columns:1fr}.maxi-area-grid{columns:1}.maxi-title{font-size:44px}.maxi-logo-lockup{align-items:flex-start}.maxi-hero-ctas .btn,.maxi-final-actions .btn{width:100%;justify-content:center}.maxi-final-cta{padding:28px}.maxi-final-cta h2{font-size:32px}}
</style>
'''

MAIN = f'''
<main>
<section class="maxi-hero">
  <div class="container">
    <div class="maxi-hero-grid">
      <div>
        <span class="maxi-eyebrow">{ICON_GROUP} Premium Group Transport</span>
        <h1 class="maxi-title">Maxi Taxi <span>Sydney</span></h1>
        <p class="maxi-lead">Book a premium Maxi Taxi Sydney service for group airport transfers, family travel, cruise terminal pickups, event transport, business groups and long-distance fixed-fare taxi bookings. Silver Service Online brings the comfort of a spacious maxi cab together with direct booking, professional drivers and the same premium Sydney taxi experience used across our airport and suburb pages.</p>
        <div class="maxi-hero-ctas">
          <a class="btn btn-gold" href="/book?vehicle=maxi">Book Maxi Taxi Online</a>
          <a class="btn btn-outline" href="tel:1800173171">Call 1800 173 171</a>
        </div>
        <div class="maxi-trust">
          <div class="maxi-trust-item"><span class="maxi-trust-num">24/7</span><span class="maxi-trust-label">Booking Support</span></div>
          <div class="maxi-trust-item"><span class="maxi-trust-num">7-11</span><span class="maxi-trust-label">Seat Options</span></div>
          <div class="maxi-trust-item"><span class="maxi-trust-num">SYD</span><span class="maxi-trust-label">Airport Transfers</span></div>
          <div class="maxi-trust-item"><span class="maxi-trust-num">WSA</span><span class="maxi-trust-label">Western Sydney</span></div>
        </div>
      </div>
      <aside class="maxi-logo-card" aria-label="Maxi Taxi Sydney service highlights">
        <div class="maxi-logo-lockup">{MAXI_SVG}<div class="maxi-logo-text"><strong>Maxi Taxi</strong><span>Silver Service Sydney</span></div></div>
        <div class="maxi-feature-stack">
          <div class="maxi-feature-pill">{ICON_GROUP}<span>Group maxi cab bookings for up to 11 passengers</span></div>
          <div class="maxi-feature-pill">{ICON_PLANE}<span>Sydney Airport and Western Sydney Airport transfers</span></div>
          <div class="maxi-feature-pill">{ICON_SHIELD}<span>Fixed fare quotes before pickup</span></div>
          <div class="maxi-feature-pill">{ICON_BRIEFCASE}<span>Corporate, cruise, event and family transport</span></div>
        </div>
      </aside>
    </div>
  </div>
</section>

<section class="maxi-section">
  <div class="container">
    <div class="maxi-section-head"><span class="maxi-kicker">Maxi Taxi Booking Features</span><h2 class="maxi-section-title">Everything you need for a <span>comfortable Maxi Taxi trip</span></h2><p class="maxi-section-copy">Book a spacious Maxi Taxi for airport transfers, family travel, cruise terminals, events, corporate groups, luggage, baby seat requests and accessible taxi requests across Sydney.</p></div>
    <div class="maxi-service-grid">
      <article class="maxi-service-card"><div class="maxi-icon-box">{ICON_PLANE}</div><h3>Airport Maxi Taxi Transfers</h3><p>Pre-book a maxi taxi to Sydney Airport terminals T1, T2 and T3 or Western Sydney International Airport. Ideal for groups with suitcases, families with prams, corporate travellers and cruise passengers connecting through the airport.</p></article>
      <article class="maxi-service-card"><div class="maxi-icon-box">{ICON_GROUP}</div><h3>7 to 11 Seater Maxi Cabs</h3><p>Choose spacious maxi cab options for passengers travelling together instead of splitting across multiple rides. Vehicle size is matched to passenger numbers, luggage volume and booking requirements, subject to availability.</p></article>
      <article class="maxi-service-card"><div class="maxi-icon-box">{ICON_BABY}</div><h3>Family Taxi With Baby Seats</h3><p>Request child-friendly taxi travel with space for capsules, boosters, strollers, nappy bags and luggage. Add baby seat or booster requirements during booking so the right option can be confirmed before pickup.</p></article>
      <article class="maxi-service-card"><div class="maxi-icon-box">{ICON_ACCESS}</div><h3>Accessible Maxi Taxi Requests</h3><p>For wheelchair accessible maxi taxi Sydney requests, tell us your mobility and ramp requirements during booking. Our team will confirm suitable availability and help arrange a practical door-to-door transfer pathway.</p></article>
      <article class="maxi-service-card"><div class="maxi-icon-box">{ICON_CRUISE}</div><h3>Cruise, Wedding and Event Transfers</h3><p>Book group transport for White Bay Cruise Terminal, Overseas Passenger Terminal, weddings, race days, concerts, sporting events, hotels, restaurants and late-night returns across Sydney.</p></article>
      <article class="maxi-service-card"><div class="maxi-icon-box">{ICON_BRIEFCASE}</div><h3>Corporate Group Transport</h3><p>Move executive teams, delegates and VIP guests in one premium maxi taxi booking with direct confirmation, professional presentation and clear fixed-fare quote options for planned business travel.</p></article>
    </div>
  </div>
</section>

<section class="maxi-section alt">
  <div class="container">
    <div class="maxi-seo-band">
      <div class="maxi-copy-panel"><h2>Premium Maxi Taxi bookings across Sydney</h2><p>Travel together in a premium Maxi Taxi for Sydney Airport, Western Sydney Airport, cruise terminals, hotels, events, family outings and corporate transfers. Tell us your passenger count, luggage, child seat needs or accessibility requirements when you book.</p><p>Our team can help confirm the right vehicle option for your group, with clear pickup details, direct booking support and fixed-fare quote options where available.</p><div class="maxi-keyword-cloud"><a href="/airport-transfers">Sydney Airport Maxi Taxi</a><a href="/locations/western-sydney-airport/">Western Sydney Airport Maxi Taxi</a><a href="/locations/">Sydney Suburb Maxi Taxi</a><span>11 Seater Taxi Sydney</span><span>Baby Seat Maxi Taxi</span><span>Wheelchair Maxi Taxi Request</span><span>Cruise Terminal Maxi Cab</span></div></div>
      <div class="maxi-book-panel"><h2>Book Maxi Taxi online or call now</h2><p>Book online or call our team to request a Maxi Taxi, large passenger taxi, baby seat, wheelchair accessible option or airport group transfer. For best availability, pre-book airport, cruise and event transfers early.</p><div class="maxi-book-steps"><div class="maxi-book-step"><div><strong>Enter pickup and destination.</strong><br>Include airport terminal, hotel, home address, venue or cruise terminal.</div></div><div class="maxi-book-step"><div><strong>Choose Maxi Taxi requirements.</strong><br>Add passenger count, bags, child seats, wheelchair access or large luggage notes.</div></div><div class="maxi-book-step"><div><strong>Confirm your fixed-fare quote.</strong><br>We confirm the booking details before pickup so your group knows the plan.</div></div></div><div class="maxi-hero-ctas"><a class="btn btn-gold" href="/book?vehicle=maxi">Book Maxi Taxi</a><a class="btn btn-outline" href="tel:1800173171">Call 1800 173 171</a></div></div>
    </div>
  </div>
</section>

<section class="maxi-section dark">
  <div class="container">
    <div class="maxi-section-head"><span class="maxi-kicker">Sydney Wide Coverage</span><h2 class="maxi-section-title">Maxi taxi service across <span>Greater Sydney</span></h2><p class="maxi-section-copy">Book group taxi transfers from the CBD, Eastern Suburbs, Inner West, North Shore, Northern Beaches, Parramatta, Western Sydney, South West Sydney, Hills District, St George, Sutherland Shire, Central Coast, Blue Mountains and regional transfer corridors connected to Sydney Airport.</p></div>
    <div class="maxi-area-grid">
      <p><strong>Airport routes:</strong> Sydney CBD to Sydney Airport, Parramatta to Sydney Airport, Bondi to Sydney Airport, North Shore to Sydney Airport, Western Sydney to Western Sydney Airport and cruise terminal connections.</p>
      <p><strong>Group occasions:</strong> weddings, corporate meetings, hotel transfers, race days, sporting fixtures, concerts, school formals, family holidays, tours, restaurants and late-night returns.</p>
      <p><strong>Passenger needs:</strong> group seating, extra luggage, prams, surfboards, child seats on request, mobility support on request, fixed fares and direct booking confirmation.</p>
    </div>
  </div>
</section>

<section class="maxi-section">
  <div class="container">
    <div class="maxi-section-head"><span class="maxi-kicker">Maxi Taxi FAQs</span><h2 class="maxi-section-title">Questions before you <span>book a Maxi Taxi</span></h2><p class="maxi-section-copy">Find quick answers about passengers, luggage, airport transfers, baby seat requests, accessibility options and fixed-fare quotes before you book.</p></div>
    <div class="maxi-faq">
      <details open><summary>How many passengers can a Maxi Taxi take?</summary><p>Maxi taxi bookings can suit larger groups, commonly up to 7 to 11 passengers depending on vehicle availability, luggage volume and the exact booking requirements. Add your passenger count and bag count when booking so the correct option can be confirmed.</p></details>
      <details><summary>Can I book a Maxi Taxi to Sydney Airport?</summary><p>Yes. Silver Service Online supports maxi taxi airport transfers to Sydney Airport terminals T1, T2 and T3, as well as Western Sydney International Airport transfer requests through the existing booking flow.</p></details>
      <details><summary>Do you offer baby seats or booster seats?</summary><p>Child seat and booster requests should be added at the time of booking. Availability can vary, so pre-booking is recommended for family airport transfers and early morning trips.</p></details>
      <details><summary>Can I request a wheelchair accessible Maxi Taxi?</summary><p>Yes, you can request wheelchair accessible taxi support. Please include ramp, chair and passenger details so a suitable option can be checked and confirmed before dispatch.</p></details>
      <details><summary>Is the fare fixed before pickup?</summary><p>Silver Service Online focuses on confirmed direct booking and fixed-fare quote pathways where possible. Submit your trip details online or call 1800 173 171 for a quote before pickup.</p></details>
    </div>
  </div>
</section>

<section class="maxi-section alt">
  <div class="container">
    <div class="maxi-final-cta"><div><h2>Need a Maxi Taxi Sydney now?</h2><p>Book direct for a premium maxi cab, airport group transfer, family taxi with luggage, event transfer, cruise pickup or corporate group ride with Silver Service Online.</p></div><div class="maxi-final-actions"><a class="btn btn-gold" href="/book?vehicle=maxi">Book Maxi Taxi Online</a><a class="btn btn-outline" href="tel:1800173171">Call 1800 173 171</a></div></div>
  </div>
</section>
</main>
'''

FAQ_SCHEMA = '''
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"FAQPage",
  "mainEntity":[
    {"@type":"Question","name":"How many passengers can a Maxi Taxi take?","acceptedAnswer":{"@type":"Answer","text":"Maxi taxi bookings can suit larger groups, commonly up to 7 to 11 passengers depending on vehicle availability, luggage volume and booking requirements."}},
    {"@type":"Question","name":"Can I book a Maxi Taxi to Sydney Airport?","acceptedAnswer":{"@type":"Answer","text":"Yes. Silver Service Online supports maxi taxi airport transfers to Sydney Airport terminals T1, T2 and T3, plus Western Sydney International Airport transfer requests."}},
    {"@type":"Question","name":"Do you offer baby seats or booster seats?","acceptedAnswer":{"@type":"Answer","text":"Child seat and booster requests should be added at the time of booking so availability can be checked and confirmed."}},
    {"@type":"Question","name":"Can I request a wheelchair accessible Maxi Taxi?","acceptedAnswer":{"@type":"Answer","text":"Yes, wheelchair accessible taxi support can be requested. Include ramp, chair and passenger details during booking."}},
    {"@type":"Question","name":"Is the fare fixed before pickup?","acceptedAnswer":{"@type":"Answer","text":"Silver Service Online focuses on confirmed direct booking and fixed-fare quote pathways where possible. Submit your trip details online or call for a quote before pickup."}}
  ]
}
</script>
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Service",
  "name":"Maxi Taxi Sydney",
  "serviceType":"Premium Maxi Taxi and Maxi Cab Group Transport",
  "provider":{"@type":"LocalBusiness","name":"Silver Service Online","telephone":"1800 173 171","url":"https://silverserviceonline.com.au"},
  "areaServed":["Sydney","Greater Sydney","Parramatta","Bondi","North Shore","Northern Beaches","Western Sydney","Sydney Airport","Western Sydney Airport"],
  "description":"Premium Maxi Taxi Sydney service for group airport transfers, 11 seater taxi requests, baby seat taxi requests, wheelchair accessible taxi requests, cruise transfers, corporate transfers and event transport.",
  "url":"https://silverserviceonline.com.au/maxi-taxi"
}
</script>
'''


def extract_header_footer(src: str):
    nav_end = src.find('</nav>')
    first_section = src.find('<section')
    footer_start = src.find('<footer')
    if nav_end == -1 or first_section == -1 or footer_start == -1:
        raise RuntimeError('Could not locate nav/content/footer boundaries in services.html')
    header_end = nav_end + len('</nav>')
    # Keep the document head, top bar, and primary desktop navigation, then replace only the page body content.
    head_header = src[:header_end]
    footer_tail = src[footer_start:]
    return head_header, footer_tail


def set_head_meta(html: str) -> str:
    title = 'Maxi Taxi Sydney | 11 Seater Maxi Cab & Group Airport Transfers'
    desc = 'Book premium Maxi Taxi Sydney service for 7 to 11 seater maxi cab transfers, Sydney Airport, Western Sydney Airport, baby seat taxi, wheelchair requests, cruise transfers, events and corporate groups.'
    html = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html, flags=re.S)
    html = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', html, flags=re.S)
    html = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="https://silverserviceonline.com.au/maxi-taxi">', html)
    html = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="Maxi Taxi Sydney | Premium Maxi Cab Group Transfers">', html)
    html = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{desc}">', html)
    html = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="https://silverserviceonline.com.au/maxi-taxi">', html)
    html = re.sub(r'<meta name="twitter:title" content="[^"]*">', '<meta name="twitter:title" content="Maxi Taxi Sydney | Premium Maxi Cab Group Transfers">', html)
    html = re.sub(r'<meta name="twitter:description" content="[^"]*">', f'<meta name="twitter:description" content="{desc}">', html)
    html = html.replace('</head>', PAGE_STYLE + '\n</head>') if PAGE_STYLE not in html else html
    return html


def update_nav(html: str) -> str:
    if '/maxi-taxi' not in html:
        pass
    maxi_mega = '''<a href="/maxi-taxi" class="mega-service-item">
<div class="mega-service-icon"><svg viewBox="0 0 24 24"><path d="M3 13h18l-2-6H5l-2 6z"/><path d="M5 13v5"/><path d="M19 13v5"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="M8 7V4h8v3"/></svg></div>
<div class="mega-service-text"><span class="mega-service-title">Maxi Taxi</span><span class="mega-service-desc">7-11 seat group taxi and airport transfers</span></div>
</a>
'''
    if 'href="/maxi-taxi" class="mega-service-item"' not in html and 'href="/services#corporate" class="mega-service-item"' in html:
        html = html.replace('<a href="/services#corporate" class="mega-service-item">', maxi_mega + '<a href="/services#corporate" class="mega-service-item">')
    if '<li><a class="nav-link" href="/maxi-taxi">Maxi Taxi</a></li>' not in html:
        html = html.replace('<li><a class="nav-link" href="/airport-transfers">Airport Transfers</a></li>', '<li><a class="nav-link" href="/airport-transfers">Airport Transfers</a></li>\n<li><a class="nav-link" href="/maxi-taxi">Maxi Taxi</a></li>')
    mob = '<a href="/maxi-taxi" class="mob-nav-item"><span class="mob-nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13h18l-2-6H5l-2 6z"/><path d="M5 13v5"/><path d="M19 13v5"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg></span><span class="mob-nav-label">Maxi Taxi</span></a>'
    if 'href="/maxi-taxi" class="mob-nav-item"' not in html:
        html = html.replace('<a href="/services" class="mob-nav-item"', mob + '\n<a href="/services" class="mob-nav-item"')
    if '<li><a href="/maxi-taxi">Maxi Taxi</a></li>' not in html:
        html = html.replace('<li><a href="/airport-transfers">Airport Transfers</a></li>', '<li><a href="/airport-transfers">Airport Transfers</a></li>\n<li><a href="/maxi-taxi">Maxi Taxi</a></li>')
    return html


def create_page():
    src = (PUBLIC / 'services.html').read_text()
    head_header, footer_tail = extract_header_footer(src)
    head_header = set_head_meta(head_header)
    page = head_header + '\n' + MAIN + '\n' + footer_tail
    page = update_nav(page)
    page = page.replace('</body>', FAQ_SCHEMA + '\n</body>')
    (PUBLIC / 'maxi-taxi.html').write_text(page)


def update_static_html():
    for path in PUBLIC.rglob('*.html'):
        if path.name == 'maxi-taxi.html':
            continue
        text = path.read_text(errors='ignore')
        new = update_nav(text)
        # Turn existing Services page Maxi Taxi card CTAs into links to the new dedicated page where relevant.
        if path.name == 'services.html':
            new = new.replace('href="/book" class="service-cta"', 'href="/maxi-taxi" class="service-cta"', 1) if 'Maxi Taxi' in new else new
        if new != text:
            path.write_text(new)


def update_generator():
    path = ROOT / 'scripts' / 'generate-pages.js'
    if not path.exists():
        return
    text = path.read_text()
    new = update_nav(text)
    if new != text:
        path.write_text(new)


def update_sitemaps():
    sm = PUBLIC / 'sitemap.xml'
    if sm.exists():
        text = sm.read_text()
        if '<loc>https://silverserviceonline.com.au/maxi-taxi</loc>' not in text:
            insert = f'''  <url>\n    <loc>https://silverserviceonline.com.au/maxi-taxi</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.95</priority>\n  </url>\n'''
            text = text.replace('  <url>\n    <loc>https://silverserviceonline.com.au/airport-transfers</loc>', insert + '  <url>\n    <loc>https://silverserviceonline.com.au/airport-transfers</loc>')
            sm.write_text(text)
    hs = PUBLIC / 'sitemap-html.html'
    if hs.exists():
        text = hs.read_text()
        if 'href="/maxi-taxi"' not in text:
            text = text.replace('<a href="/airport-transfers">Airport Transfers</a>', '<a href="/maxi-taxi">Maxi Taxi Sydney</a>\n<a href="/airport-transfers">Airport Transfers</a>')
            hs.write_text(text)


def update_robots():
    # no robots changes needed; placeholder keeps script explicit
    pass

create_page()
update_static_html()
update_generator()
update_sitemaps()
update_robots()
print('Created public/maxi-taxi.html and integrated Maxi Taxi navigation/footer/sitemap links.')

# Dedicated Maxi Taxi logo/menu, SVG constraints, and SEO dashboard registration are finalized by scripts/patch_maxi_dedicated_section.py.
