from pathlib import Path
from datetime import date
import re
import html
import subprocess

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

IMG = '/images/maxi-taxi/'


def slugify(name: str) -> str:
    s = name.lower().replace('&', 'and')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

MAXI_SECTION_CSS = f'''
<style id="maxi-dedicated-section-style">
html{{scroll-behavior:smooth}}.maxi-site-header{{position:sticky;top:0;z-index:999;background:#07111f;box-shadow:0 18px 42px rgba(2,8,18,.24)}}.maxi-site-header .maxi-container{{width:min(1180px,calc(100% - 36px));margin:0 auto}}.maxi-top-bar{{min-height:30px;border-bottom:1px solid rgba(255,255,255,.08);background:#0b1627;color:rgba(255,255,255,.72);font-size:12px;font-weight:800;letter-spacing:.04em}}.maxi-top-bar-inner{{min-height:30px;display:flex;align-items:center;justify-content:space-between;gap:20px}}.maxi-top-bar-left,.maxi-top-bar-right{{display:flex;align-items:center;gap:22px;flex-wrap:wrap}}.maxi-top-item{{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}}.maxi-top-item svg{{width:14px!important;height:14px!important;color:#d6aa2f;flex:0 0 14px}}.maxi-top-item a{{color:#f4d263;text-decoration:none}}.maxi-main-nav{{background:rgba(19,29,48,.98);border-bottom:1px solid rgba(255,255,255,.12)}}.maxi-nav-shell{{min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:28px}}.maxi-brand{{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;min-width:190px}}.maxi-brand-mark{{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(145deg,#fff0a8,#d6aa2f 54%,#9d6d12);box-shadow:0 14px 26px rgba(214,170,47,.24);border:1px solid rgba(255,255,255,.24);flex:0 0 44px}}.maxi-brand-mark svg{{width:28px!important;height:28px!important;display:block!important;max-width:28px!important;max-height:28px!important;color:#07111f;stroke:#07111f}}.maxi-brand-text strong{{display:block;font-family:var(--ff-head,var(--font-display,Georgia,serif));font-size:17px;line-height:.98;text-transform:uppercase;letter-spacing:.03em}}.maxi-brand-text span{{display:block;margin-top:4px;color:#f4d263;font-size:9px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}}.maxi-primary-menu{{display:flex;align-items:center;justify-content:center;gap:8px;list-style:none;margin:0;padding:0;flex:1 1 auto;min-width:0}}.maxi-primary-menu a{{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 10px;border-radius:10px;color:rgba(255,255,255,.88);text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap;line-height:1;transition:.2s ease}}.maxi-primary-menu a:hover,.maxi-primary-menu a.active{{background:rgba(255,255,255,.07);color:#f4d263}}.maxi-primary-menu a.original-home{{color:#fff}}.maxi-nav-actions{{display:flex;align-items:center;gap:10px;flex:0 0 auto}}.maxi-nav-book{{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border-radius:12px;text-decoration:none;font-weight:900;font-size:12px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;padding:0 18px;background:linear-gradient(135deg,#f2d469,#c89623);color:#07111f;box-shadow:0 14px 30px rgba(214,170,47,.28)}}.maxi-section-links{{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:20px}}.maxi-section-links a{{display:inline-flex;align-items:center;min-height:38px;padding:0 13px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#fff;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}}.maxi-section-links a:hover{{color:#f4d263;border-color:rgba(214,170,47,.38)}}.maxi-return-strip{{background:linear-gradient(90deg,rgba(214,170,47,.16),rgba(12,45,83,.08));border-bottom:1px solid rgba(214,170,47,.18)}}.maxi-return-strip .maxi-container{{display:flex;align-items:center;justify-content:center;gap:12px;min-height:42px;flex-wrap:wrap;color:#d7e0ef;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}}.maxi-return-strip a{{color:#f4d263;text-decoration:none}}.maxi-page .btn::before,.maxi-page .btn::after{{display:none!important}}.maxi-page svg,.maxi-site-header svg,.maxi-footer svg{{display:block;max-width:100%;height:auto}}.maxi-page .maxi-eyebrow svg,.maxi-page .maxi-feature-pill svg,.maxi-page .maxi-stat svg,.maxi-page .maxi-icon-box svg,.maxi-page .maxi-brand-mark svg{{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;flex:0 0 22px!important}}.maxi-page .maxi-logo-svg{{width:72px!important;height:72px!important;max-width:72px!important;max-height:72px!important;flex:0 0 72px!important}}.maxi-page .maxi-icon-box{{overflow:hidden}}.maxi-page .maxi-logo-lockup{{overflow:hidden}}.maxi-page .maxi-hero{{padding-top:118px;background:linear-gradient(135deg,rgba(7,17,31,.94),rgba(12,45,83,.86)),url('{IMG}hero-airport-kia-carnival-full.webp') center/cover no-repeat!important}}.maxi-page .maxi-area-hero{{padding-top:118px}}.maxi-hero-photo{{margin:0 0 20px;border-radius:26px;overflow:hidden;border:1px solid rgba(214,170,47,.28);box-shadow:0 28px 70px rgba(0,0,0,.32)}}.maxi-hero-photo img{{display:block;width:100%;height:280px;object-fit:cover}}.maxi-hero-photo figcaption{{padding:12px 16px;background:rgba(2,8,18,.68);color:#f4d263;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}}.maxi-card-image{{margin:-12px -12px 20px;border-radius:22px;overflow:hidden;border:1px solid rgba(8,26,51,.08);background:#07111f}}.maxi-card-image img{{display:block;width:100%;height:178px;object-fit:cover;transition:transform .35s ease}}.maxi-service-card:hover .maxi-card-image img,.maxi-card:hover .maxi-card-image img{{transform:scale(1.035)}}.maxi-image-band{{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:36px}}.maxi-image-band figure{{margin:0;border-radius:24px;overflow:hidden;background:#07111f;border:1px solid rgba(255,255,255,.13)}}.maxi-image-band img{{width:100%;height:210px;object-fit:cover;display:block}}.maxi-image-band figcaption{{padding:13px 15px;color:#f4d263;font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.1em}}.maxi-footer.footer-premium{{margin-top:0;background:radial-gradient(circle at 18% 0%,rgba(214,170,47,.18),transparent 34%),linear-gradient(135deg,#07111f 0%,#0b1b31 48%,#06101e 100%);color:#e9eef8;border-top:1px solid rgba(214,170,47,.22);position:relative;overflow:hidden}}.maxi-footer.footer-premium::before{{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.04),transparent 24%,transparent 76%,rgba(255,255,255,.03));pointer-events:none}}.maxi-footer .container{{position:relative;z-index:1;width:min(1180px,calc(100% - 36px));margin:0 auto;padding:0}}.maxi-footer .footer-top{{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:34px;align-items:center;padding:46px 0 30px;border-bottom:1px solid rgba(255,255,255,.10)}}.maxi-footer .footer-brand-logo-wrap{{display:flex;align-items:center;gap:16px;margin-bottom:16px}}.maxi-footer .footer-brand-emblem{{width:54px;height:54px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#fff2ad,#d6aa2f 55%,#986711);box-shadow:0 18px 36px rgba(214,170,47,.28)}}.maxi-footer .footer-brand-emblem svg{{width:31px!important;height:31px!important;color:#07111f;stroke:#07111f}}.maxi-footer .footer-brand-name-top{{display:block;font-family:var(--ff-head,var(--font-display,Georgia,serif));font-size:24px;line-height:1;text-transform:uppercase;letter-spacing:.05em;color:#fff}}.maxi-footer .footer-brand-name-sub{{display:block;margin-top:5px;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#f4d263}}.maxi-footer .footer-brand-desc{{max-width:680px;margin:0;color:rgba(233,238,248,.78);font-size:15px;line-height:1.75}}.maxi-footer .footer-cta{{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end;padding:18px;border:1px solid rgba(214,170,47,.24);border-radius:24px;background:rgba(255,255,255,.055);box-shadow:0 22px 54px rgba(0,0,0,.24)}}.maxi-footer .footer-cta-text{{width:100%;color:#f4d263;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;text-align:right}}.maxi-footer .footer-cta-phone,.maxi-footer .footer-cta-book{{display:inline-flex;align-items:center;gap:9px;min-height:42px;padding:0 14px;border-radius:12px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}}.maxi-footer .footer-cta-phone{{color:#fff;border:1px solid rgba(255,255,255,.20);background:rgba(255,255,255,.06)}}.maxi-footer .footer-cta-book{{color:#07111f;background:linear-gradient(135deg,#f2d469,#c89623);box-shadow:0 14px 26px rgba(214,170,47,.24)}}.maxi-footer .footer-main{{display:grid;grid-template-columns:1.05fr 1.1fr 1.1fr 1.25fr;gap:28px;padding:34px 0}}.maxi-footer .footer-col-title-premium{{display:flex;align-items:center;gap:10px;margin:0 0 16px;color:#fff;font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}}.maxi-footer .footer-col-title-premium svg{{width:18px!important;height:18px!important;color:#f4d263;stroke:#f4d263;fill:none}}.maxi-footer .footer-links-premium{{display:grid;gap:9px;list-style:none!important;margin:0!important;padding:0!important}}.maxi-footer .footer-links-premium li{{list-style:none!important;margin:0!important;padding:0!important}}.maxi-footer .footer-links-premium a{{display:flex;align-items:center;gap:8px;color:rgba(233,238,248,.76);text-decoration:none;font-size:13px;font-weight:700;line-height:1.35;transition:.18s ease}}.maxi-footer .footer-links-premium a:hover{{color:#f4d263;transform:translateX(3px)}}.maxi-footer .footer-links-premium svg{{width:13px!important;height:13px!important;flex:0 0 13px;stroke:#d6aa2f;fill:none}}.maxi-footer .footer-contact-premium{{display:grid;gap:12px}}.maxi-footer .footer-contact-row{{display:grid;grid-template-columns:38px 1fr;gap:12px;align-items:center;padding:12px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}}.maxi-footer .footer-contact-icon{{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:rgba(214,170,47,.14);color:#f4d263}}.maxi-footer .footer-contact-icon svg,.maxi-footer .footer-cta svg{{width:17px!important;height:17px!important;stroke:currentColor;fill:none}}.maxi-footer .footer-contact-label{{display:block;color:rgba(233,238,248,.58);font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}}.maxi-footer .footer-contact-value{{display:block;color:#fff;text-decoration:none;font-size:13px;font-weight:800;word-break:break-word}}.maxi-footer .footer-bottom-premium{{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 0 28px;border-top:1px solid rgba(255,255,255,.10);color:rgba(233,238,248,.62);font-size:12px;font-weight:700}}.maxi-footer .footer-bottom-right{{display:flex;align-items:center;gap:18px;flex-wrap:wrap}}.maxi-footer .footer-bottom-right a{{color:rgba(233,238,248,.72);text-decoration:none}}.maxi-footer .footer-bottom-right a:hover{{color:#f4d263}}@media(max-width:1160px){{.maxi-nav-shell{{gap:14px}}.maxi-brand{{min-width:170px}}.maxi-primary-menu{{gap:2px}}.maxi-primary-menu a{{font-size:10px;padding:0 7px;letter-spacing:.07em}}.maxi-footer .footer-main{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}@media(max-width:980px){{.maxi-top-bar-inner{{align-items:flex-start;flex-direction:column;padding:8px 0}}.maxi-nav-shell{{align-items:flex-start;flex-direction:column;padding:16px 0}}.maxi-primary-menu{{width:100%;justify-content:flex-start;overflow-x:auto;padding-bottom:4px}}.maxi-nav-actions{{width:100%}}.maxi-nav-book{{width:100%}}.maxi-image-band{{grid-template-columns:1fr}}.maxi-footer .footer-top{{grid-template-columns:1fr;align-items:start}}.maxi-footer .footer-cta{{justify-content:flex-start}}.maxi-footer .footer-cta-text{{text-align:left}}.maxi-footer .footer-main{{grid-template-columns:1fr}}.maxi-footer .footer-bottom-premium{{align-items:flex-start;flex-direction:column}}}}@media(max-width:640px){{.maxi-site-header .maxi-container{{width:min(100% - 24px,1180px)}}.maxi-brand-text strong{{font-size:16px}}.maxi-primary-menu a{{font-size:10px;padding:0 8px}}.maxi-hero-photo img{{height:220px}}.maxi-card-image img{{height:160px}}}}
/* Maxi dedicated mobile menu v6 */.maxi-mob-toggle{{display:none;align-items:center;justify-content:center;width:46px;height:46px;margin-left:auto;border-radius:16px;border:1px solid rgba(214,170,47,.34);background:linear-gradient(135deg,rgba(214,170,47,.2),rgba(255,255,255,.07));color:#f4d263;box-shadow:inset 0 1px 0 rgba(255,255,255,.1);cursor:pointer}}.maxi-mob-toggle svg{{width:24px!important;height:24px!important;stroke:currentColor}}.maxi-mob-overlay,.maxi-mob-panel{{display:none}}@media(max-width:768px){{.maxi-top-bar{{display:none}}.maxi-nav-shell{{min-height:66px!important;padding:9px 0!important;flex-direction:row!important;align-items:center!important}}.maxi-brand{{min-width:0}}.maxi-brand-mark{{width:40px;height:40px;border-radius:14px;flex-basis:40px}}.maxi-brand-text strong{{font-size:15px}}.maxi-primary-menu,.maxi-nav-actions{{display:none!important}}.maxi-mob-toggle{{display:inline-flex}}.maxi-mob-overlay{{position:fixed;inset:0;display:block;opacity:0;visibility:hidden;pointer-events:none;background:rgba(2,8,18,.72);z-index:2000;transition:.18s ease}}.maxi-mob-overlay.open{{opacity:1;visibility:visible;pointer-events:auto}}.maxi-mob-panel{{position:fixed;top:0;right:0;bottom:0;width:min(92vw,420px);display:flex;flex-direction:column;transform:translateX(105%);visibility:hidden;z-index:2001;color:#fff;background:linear-gradient(180deg,#101d31,#07111f);border-left:1px solid rgba(214,170,47,.34);box-shadow:-24px 0 60px rgba(0,0,0,.44);transition:transform .22s ease,visibility .22s ease}}.maxi-mob-panel.open{{transform:translateX(0);visibility:visible}}.maxi-mob-head{{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(18px + env(safe-area-inset-top)) 18px 16px;border-bottom:1px solid rgba(214,170,47,.18);background:rgba(255,255,255,.045)}}.maxi-mob-title strong{{display:block;font-family:var(--ff-head,var(--font-display,Georgia,serif));font-size:22px;letter-spacing:.04em;text-transform:uppercase}}.maxi-mob-title span{{display:block;margin-top:5px;color:#f4d263;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}}.maxi-mob-close{{width:44px;height:44px;border-radius:999px;border:1px solid rgba(214,170,47,.36);background:rgba(255,255,255,.07);color:#f4d263;display:grid;place-items:center;cursor:pointer}}.maxi-mob-links{{display:grid;gap:9px;padding:16px;overflow-y:auto;-webkit-overflow-scrolling:touch}}.maxi-mob-links a{{display:grid;grid-template-columns:38px 1fr;gap:12px;align-items:center;min-height:58px;padding:10px 12px;border-radius:17px;border:1px solid rgba(214,170,47,.16);background:linear-gradient(135deg,rgba(255,255,255,.075),rgba(255,255,255,.025));color:#fff;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}}.maxi-mob-links a.is-book{{background:linear-gradient(135deg,#f2d469,#c89623);color:#07111f;border-color:rgba(242,212,105,.7)}}.maxi-mob-icon{{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:rgba(214,170,47,.12);color:#f4d263}}.maxi-mob-links a.is-book .maxi-mob-icon{{background:rgba(7,17,31,.1);color:#07111f}}.maxi-mob-icon svg{{width:19px!important;height:19px!important;stroke:currentColor;fill:none}}.maxi-mob-call{{margin:0 16px calc(18px + env(safe-area-inset-bottom));min-height:56px;border-radius:18px;background:linear-gradient(135deg,#f2d469,#c89623);color:#07111f;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:10px;font-size:16px;font-weight:950;letter-spacing:.08em}}.maxi-page .maxi-hero,.maxi-page .maxi-area-hero{{padding-top:88px}}}}@media(max-width:640px){{.maxi-mob-panel{{width:100vw}}}}

</style>
'''

BRAND_SVG = '''<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 36h48l-5-17H13L8 36Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M16 36v9M48 36v9M20 19V11h24v8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="47" r="5" fill="currentColor"/><circle cx="44" cy="47" r="5" fill="currentColor"/><path d="M18 28h28" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'''
CHEVRON_SVG = '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>'

DEDICATED_HEADER = f'''
<header class="maxi-site-header" aria-label="Silver Service and Maxi Taxi navigation">
  <div class="maxi-top-bar">
    <div class="maxi-container maxi-top-bar-inner">
      <div class="maxi-top-bar-left"><span class="maxi-top-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>Sydney, NSW, Australia</span><span class="maxi-top-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Available 24/7 — 365 Days</span></div>
      <div class="maxi-top-bar-right"><span class="maxi-top-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z"/></svg><a href="tel:1800173171">1800 173 171</a></span><span class="maxi-top-item"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:info@silverserviceonline.com.au">info@silverserviceonline.com.au</a></span></div>
    </div>
  </div>
  <nav class="maxi-main-nav" aria-label="Main Silver Service navigation">
    <div class="maxi-container maxi-nav-shell">
      <a class="maxi-brand" href="/" aria-label="Silver Service Taxi Sydney home"><span class="maxi-brand-mark">{BRAND_SVG}</span><span class="maxi-brand-text"><strong>Silver Service</strong><span>Taxi Sydney</span></span></a>
      <ul class="maxi-primary-menu">
        <li><a class="original-home" href="/">Home</a></li><li><a href="/services">Services</a></li><li><a href="/airport-transfers">Airport</a></li><li><a href="/locations/">Areas</a></li><li><a href="/about">About</a></li><li><a href="/contact">Contact</a></li><li><a href="/manage">Manage Booking</a></li><li><a class="active" href="/maxi-taxi/">Maxi Taxi</a></li>
      </ul>
      <div class="maxi-nav-actions"><a class="maxi-nav-book" href="/maxi-taxi/book/">Book Now</a></div><button class="maxi-mob-toggle" id="maxi-mob-toggle" type="button" aria-label="Open menu" aria-controls="maxi-mob-panel" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
    </div>
  </nav>
  <div class="maxi-mob-overlay" id="maxi-mob-overlay" aria-hidden="true"></div>
  <aside class="maxi-mob-panel" id="maxi-mob-panel" aria-hidden="true" aria-label="Maxi Taxi mobile menu">
    <div class="maxi-mob-head"><div class="maxi-mob-title"><strong>Silver Service</strong><span>Maxi Taxi Sydney</span></div><button class="maxi-mob-close" id="maxi-mob-close" type="button" aria-label="Close menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
    <nav class="maxi-mob-links">
      <a href="/"><span class="maxi-mob-icon">{BRAND_SVG}</span><span>Original Home</span></a>
      <a href="/maxi-taxi/" class="active"><span class="maxi-mob-icon">{BRAND_SVG}</span><span>Maxi Taxi Sydney</span></a>
      <a href="/maxi-taxi/book/" class="is-book"><span class="maxi-mob-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span><span>Book Now</span></a>
      <a href="/maxi-taxi/#maxi-airport"><span class="maxi-mob-icon"><svg viewBox="0 0 24 24"><path d="M2 17h2.4L9 10.5 6 6h3l3 4.5L15 6h3l-3 4.5L19.6 17H22"/></svg></span><span>Airport Maxi Taxi</span></a>
      <a href="/maxi-taxi/#maxi-family"><span class="maxi-mob-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span><span>Family & Baby Seats</span></a>
      <a href="/maxi-taxi/#maxi-accessible"><span class="maxi-mob-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span><span>Accessible Requests</span></a>
      <a href="/maxi-taxi/#maxi-councils"><span class="maxi-mob-icon"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></span><span>Service Areas</span></a>
      <a href="/contact"><span class="maxi-mob-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg></span><span>Contact</span></a>
      <a href="/manage"><span class="maxi-mob-icon"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span><span>Manage Booking</span></a>
    </nav>
    <a class="maxi-mob-call" href="tel:1800173171"><span>1800 173 171</span></a>
  </aside>
  <script>(function(){{function r(f){{document.readyState==='loading'?document.addEventListener('DOMContentLoaded',f,{{once:true}}):f()}}r(function(){{var b=document.getElementById('maxi-mob-toggle'),p=document.getElementById('maxi-mob-panel'),o=document.getElementById('maxi-mob-overlay'),c=document.getElementById('maxi-mob-close');if(!b||!p||!o)return;function s(open){{p.classList.toggle('open',open);o.classList.toggle('open',open);p.setAttribute('aria-hidden',open?'false':'true');o.setAttribute('aria-hidden',open?'false':'true');b.setAttribute('aria-expanded',open?'true':'false');document.documentElement.style.overflow=open?'hidden':''}}b.addEventListener('click',function(){{s(!p.classList.contains('open'))}});if(c)c.addEventListener('click',function(){{s(false)}});o.addEventListener('click',function(){{s(false)}});p.querySelectorAll('a').forEach(function(a){{a.addEventListener('click',function(){{s(false)}})}});document.addEventListener('keydown',function(e){{if(e.key==='Escape')s(false)}})}})}})();</script>
</header>
<div class="maxi-return-strip" aria-label="Return to original Silver Service pages"><div class="maxi-container">You are viewing Maxi Taxi Sydney <span>•</span> <a href="/">Original Home</a> <span>•</span> <a href="/services">All Silver Service Pages</a> <span>•</span> <a href="/airport-transfers">Airport Transfers</a></div></div>
'''


def footer_link(href: str, label: str) -> str:
    return f'<li><a href="{href}">{CHEVRON_SVG}{html.escape(label)}</a></li>'


def dedicated_footer() -> str:
    quick_links = ''.join([
        footer_link('/', 'Original Home'), footer_link('/services', 'Our Services'), footer_link('/airport-transfers', 'Airport Transfers'), footer_link('/about', 'About Us'), footer_link('/contact', 'Contact'), footer_link('/maxi-taxi/book/', 'Book Maxi Taxi'), footer_link('/manage', 'Manage Booking')
    ])
    maxi_links = ''.join([
        footer_link('/maxi-taxi/', 'Maxi Taxi Sydney'), footer_link('/maxi-taxi/#maxi-airport', 'Airport Maxi Taxi'), footer_link('/maxi-taxi/#maxi-family', 'Baby Seat Maxi Taxi'), footer_link('/maxi-taxi/#maxi-accessible', 'Accessible Maxi Taxi'), footer_link('/maxi-taxi/#maxi-corporate', 'Corporate Groups'), footer_link('/maxi-taxi/#maxi-councils', 'Council Service Areas'), footer_link('/maxi-taxi/book/', 'Book Online')
    ])
    area_links = ''.join(footer_link(f'/maxi-taxi/{slugify(name)}/', f'Maxi Taxi {name}') for name, _ in COUNCILS[:7])
    return f'''
<footer class="footer-premium maxi-footer" aria-label="Silver Service Maxi Taxi footer">
<div class="container">
<div class="footer-top">
<div class="footer-brand"><div class="footer-brand-logo-wrap"><div class="footer-brand-emblem">{BRAND_SVG}</div><div class="footer-brand-name"><span class="footer-brand-name-top">Silver Service</span><span class="footer-brand-name-sub">Maxi Taxi Sydney</span></div></div><p class="footer-brand-desc">Premium Maxi Taxi Sydney bookings for 7 to 11 seater airport transfers, family travel, accessible taxi requests, cruise terminals, corporate groups and council-area maxi cab service. Use the original Silver Service links or stay inside the Maxi Taxi section.</p></div>
<div class="footer-cta"><span class="footer-cta-text">24/7 Maxi Taxi Dispatch Available</span><a href="tel:1800173171" class="footer-cta-phone"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg><span class="footer-cta-phone-number">1800 173 171</span></a><a href="/maxi-taxi/book/" class="footer-cta-book"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Book Maxi Taxi Now</a></div>
</div>
<div class="footer-main"><div><div class="footer-col-title-premium"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Original Site Links</div><ul class="footer-links-premium">{quick_links}</ul></div><div><div class="footer-col-title-premium"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>Maxi Taxi Services</div><ul class="footer-links-premium">{maxi_links}</ul></div><div><div class="footer-col-title-premium"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>Maxi Taxi Areas</div><ul class="footer-links-premium">{area_links}{footer_link('/maxi-taxi/#maxi-councils', 'View All Council Areas')}</ul></div><div><div class="footer-col-title-premium"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>Contact Us</div><div class="footer-contact-premium"><div class="footer-contact-row"><div class="footer-contact-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg></div><div class="footer-contact-info"><span class="footer-contact-label">Phone</span><a href="tel:1800173171" class="footer-contact-value">1800 173 171</a></div></div><div class="footer-contact-row"><div class="footer-contact-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><div class="footer-contact-info"><span class="footer-contact-label">Email</span><a href="mailto:info@silverserviceonline.com.au" class="footer-contact-value">info@silverserviceonline.com.au</a></div></div><div class="footer-contact-row"><div class="footer-contact-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="footer-contact-info"><span class="footer-contact-label">Hours</span><span class="footer-contact-value">24/7 — 365 Days</span></div></div></div></div></div>
<div class="footer-bottom-premium"><div class="footer-bottom-left">&copy; 2026 Silver Service Taxi Sydney — Maxi Taxi Service</div><div class="footer-bottom-right"><a href="/privacy-policy">Privacy Policy</a><a href="/terms-and-conditions">Terms &amp; Conditions</a><a href="/sitemap.xml">Sitemap</a></div></div>
</div>
</footer>
'''

MAIN_META = {
    'title': 'Maxi Taxi Sydney | Premium 7-11 Seater Maxi Cab Service',
    'desc': 'Book Maxi Taxi Sydney service for 7 to 11 seater maxi cab transfers, Sydney Airport, Western Sydney Airport, baby seats, wheelchair requests, cruise transfers and group travel.',
    'canonical': f'{BASE}/maxi-taxi/'
}


def ensure_absolute_assets(head: str) -> str:
    head = re.sub(r'href="(?:/|\./)*style\.css\?v=\d+"', 'href="/style.css?v=7"', head)
    head = re.sub(r'\n?\s*<link rel="stylesheet" href="/(?:mega-menu|mobile-menu)\.css(?:\?v=\d+)?">', '', head)
    head = head.replace('href="images/logo.png"', 'href="/images/logo.png"')
    head = head.replace('src="images/', 'src="/images/')
    return head


def strip_inherited_jsonld(head: str) -> str:
    return re.sub(r'\n\s*<script type="application/ld\+json">.*?</script>', '', head, flags=re.S)


def set_meta(head: str, title: str, desc: str, canonical: str, keywords: str) -> str:
    head = ensure_absolute_assets(head)
    head = strip_inherited_jsonld(head)
    head = re.sub(r'<title>.*?</title>', f'<title>{html.escape(title)}</title>', head, flags=re.S)
    if re.search(r'<meta name="description"', head):
        head = re.sub(r'<meta name="description" content="[^"]*"\s*/?>', f'<meta name="description" content="{html.escape(desc)}">', head)
    else:
        head = head.replace('</head>', f'<meta name="description" content="{html.escape(desc)}">\n</head>')
    if re.search(r'<meta name="keywords"', head):
        head = re.sub(r'<meta name="keywords" content="[^"]*"\s*/?>', f'<meta name="keywords" content="{html.escape(keywords)}">', head)
    else:
        head = head.replace('</head>', f'<meta name="keywords" content="{html.escape(keywords)}">\n</head>')
    head = re.sub(r'<link rel="canonical" href="[^"]*"\s*/?>', f'<link rel="canonical" href="{canonical}">', head)
    head = re.sub(r'<meta property="og:title" content="[^"]*"\s*/?>', f'<meta property="og:title" content="{html.escape(title)}">', head)
    head = re.sub(r'<meta property="og:description" content="[^"]*"\s*/?>', f'<meta property="og:description" content="{html.escape(desc)}">', head)
    head = re.sub(r'<meta property="og:url" content="[^"]*"\s*/?>', f'<meta property="og:url" content="{canonical}">', head)
    head = re.sub(r'<meta property="og:image" content="[^"]*"\s*/?>', f'<meta property="og:image" content="{BASE}{IMG}hero-airport-kia-carnival-full.webp">', head)
    head = re.sub(r'<meta name="twitter:title" content="[^"]*"\s*/?>', f'<meta name="twitter:title" content="{html.escape(title)}">', head)
    head = re.sub(r'<meta name="twitter:description" content="[^"]*"\s*/?>', f'<meta name="twitter:description" content="{html.escape(desc)}">', head)
    head = re.sub(r'<meta name="twitter:image" content="[^"]*"\s*/?>', f'<meta name="twitter:image" content="{BASE}{IMG}hero-airport-kia-carnival-full.webp">', head)
    if 'maxi-dedicated-section-style' not in head:
        head = head.replace('</head>', MAXI_SECTION_CSS + '\n</head>')
    return head


def main_schema() -> str:
    return f'''
<script type="application/ld+json" id="maxi-service-schema">
{{"@context":"https://schema.org","@type":"Service","name":"Maxi Taxi Sydney","serviceType":"Premium 7 to 11 Seater Maxi Taxi and Maxi Cab Group Transport","provider":{{"@type":"LocalBusiness","name":"Silver Service Online","telephone":"1800 173 171","url":"{BASE}"}},"areaServed":["Sydney","Greater Sydney","Sydney Airport","Western Sydney Airport","Central Coast","Blue Mountains"],"description":"Premium Maxi Taxi Sydney service for airport transfers, 7 to 11 seater maxi cab bookings, baby seat taxi requests, wheelchair accessible taxi requests, cruise transfers, corporate groups and event transport.","url":"{BASE}/maxi-taxi/","image":"{BASE}{IMG}hero-airport-kia-carnival-full.webp"}}
</script>
'''


def council_schema(council: str, suburbs: int, slug: str) -> str:
    safe = html.escape(council)
    url = f'{BASE}/maxi-taxi/{slug}/'
    return f'''
<script type="application/ld+json" id="maxi-council-service-schema">
{{"@context":"https://schema.org","@type":"Service","name":"Maxi Taxi {safe}","serviceType":"Premium 7 to 11 Seater Maxi Taxi and Maxi Cab Group Transport","provider":{{"@type":"LocalBusiness","name":"Silver Service Online","telephone":"1800 173 171","url":"{BASE}"}},"areaServed":"{safe}","description":"Premium Maxi Taxi {safe} service across {suburbs} suburbs for airport transfers, group maxi cab bookings, baby seat taxi requests, wheelchair accessible taxi requests, cruise transfers and event transport.","url":"{url}","image":"{BASE}{IMG}group-hiace-bondi-full.webp"}}
</script>
'''


def replace_header_with_dedicated(text: str, *, title: str, desc: str, canonical: str, keywords: str, schema: str) -> str:
    m = re.search(r'<body([^>]*)>', text, flags=re.I)
    if not m:
        raise RuntimeError('No body tag found')
    body_start_end = m.end()
    head = text[:body_start_end]
    rest = text[body_start_end:]
    head = set_meta(head, title, desc, canonical, keywords)
    main_match = re.search(r'<main\b', rest, flags=re.I)
    if not main_match:
        raise RuntimeError('No main tag found')
    main_and_after = rest[main_match.start():]
    main_and_after = re.sub(r'<main\b[^>]*>', '<main class="maxi-page">', main_and_after, count=1, flags=re.I)
    main_and_after = re.sub(r'\n\s*<script type="application/ld\+json">.*?</script>', '', main_and_after, flags=re.S)
    main_and_after = re.sub(r'\n\s*<script\s+src=["\']/mobile-menu\.js\?v=5["\']></script>', '', main_and_after, flags=re.I)
    main_and_after = re.sub(r'\n\s*<div\s+id=["\']mob-overlay["\']></div>', '', main_and_after, flags=re.I)
    main_and_after = re.sub(r'\n\s*<div\s+id=["\']mob-panel["\']>.*?(?=\n\s*<!-- Click Fraud|\n\s*<script type="application/ld\+json"|\n\s*</body>)', '', main_and_after, flags=re.S|re.I)
    main_and_after = re.sub(r'\n\s*<!-- Click Fraud\s*', '\n', main_and_after, flags=re.I)
    main_and_after = re.sub(r'<script\s+src=["\']shared\.js["\']></script>', '<script src="/shared.js"></script>', main_and_after, flags=re.I)
    main_and_after = re.sub(r'<footer\b.*?</footer>', dedicated_footer(), main_and_after, flags=re.S|re.I)
    if '<footer' not in main_and_after:
        main_and_after = main_and_after.replace('</body>', dedicated_footer() + '\n</body>')
    if schema not in main_and_after:
        main_and_after = main_and_after.replace('</body>', schema + '\n</body>')
    return head + '\n' + DEDICATED_HEADER + '\n' + main_and_after


def image_figure(slug: str, alt: str, caption: str = '') -> str:
    cap = f'<figcaption>{html.escape(caption)}</figcaption>' if caption else ''
    return f'<figure class="maxi-card-image"><picture><source srcset="{IMG}{slug}-thumb.webp" media="(max-width: 640px)"><img src="{IMG}{slug}-card.webp" alt="{html.escape(alt)}" loading="lazy" decoding="async" width="900" height="510"></picture>{cap}</figure>'


def add_section_links(text: str) -> str:
    links = '<div class="maxi-section-links" aria-label="Maxi Taxi page sections"><a href="/maxi-taxi/#maxi-airport">Airport</a><a href="/maxi-taxi/#maxi-family">Baby Seats</a><a href="/maxi-taxi/#maxi-accessible">Accessible</a><a href="/maxi-taxi/#maxi-corporate">Corporate</a><a href="/maxi-taxi/#maxi-councils">Service Areas</a><a href="/">Original Home</a></div>'
    if 'class="maxi-section-links"' in text:
        return text
    return text.replace('</div>\n        <div class="maxi-trust">', '</div>\n        ' + links + '\n        <div class="maxi-trust">', 1)


def patch_main_images(text: str) -> str:
    text = text.replace("url('/images/hero-sydney.jpg')", f"url('{IMG}hero-airport-kia-carnival-full.webp')")
    text = add_section_links(text)
    text = re.sub(r'<aside class="maxi-logo-card" aria-label="Maxi Taxi Sydney service highlights">.*?</aside>', f'''<aside class="maxi-logo-card" aria-label="Maxi Taxi Sydney service highlights">
        <figure class="maxi-hero-photo"><picture><source srcset="{IMG}hero-airport-kia-carnival-card.webp" media="(max-width: 900px)"><img src="{IMG}hero-airport-kia-carnival-full.webp" alt="Premium Kia Carnival maxi taxi at Sydney Airport" loading="eager" decoding="async" width="1440" height="816"></picture><figcaption>Premium Maxi Taxi Sydney Airport Transfers</figcaption></figure>
        <div class="maxi-logo-lockup"><span class="maxi-brand-mark">{BRAND_SVG}</span><div class="maxi-logo-text"><strong>Maxi Taxi</strong><span>Silver Service Sydney</span></div></div>
        <div class="maxi-feature-stack">
          <div class="maxi-feature-pill"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>Group maxi cab bookings for up to 11 passengers</span></div>
          <div class="maxi-feature-pill"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg><span>Sydney Airport and Western Sydney Airport transfers</span></div>
          <div class="maxi-feature-pill"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg><span>Fixed fare quotes before pickup</span></div>
          <div class="maxi-feature-pill"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg><span>Corporate, cruise, event and family transport</span></div>
        </div>
      </aside>''', text, count=1, flags=re.S)
    mapping = {
        'Airport Maxi Taxi Transfers': ('airport-night-hiace', 'Airport maxi taxi transfer vehicle at night in Sydney'),
        '7 to 11 Seater Maxi Cabs': ('group-hiace-bondi', 'Large maxi taxi for group transfers in Bondi Sydney'),
        'Family Taxi With Baby Seats': ('family-baby-seat-kia', 'Family maxi taxi with baby seat in a Kia Carnival'),
        'Accessible Maxi Taxi Requests': ('wheelchair-ramp-airport', 'Wheelchair accessible maxi taxi ramp at Sydney Airport'),
        'Cruise, Wedding and Event Transfers': ('sydney-cruise-hiace', 'Sydney cruise terminal maxi taxi group transfer'),
        'Corporate Group Transport': ('corporate-kia-barangaroo', 'Corporate maxi taxi transfer near Barangaroo Sydney'),
    }
    for title, (slug, alt) in mapping.items():
        if f'alt="{html.escape(alt)}"' in text:
            continue
        pattern = r'(<article[^>]*>\s*<div class="maxi-icon-box">.*?</div>)(<h3>' + re.escape(title) + r'</h3>)'
        text = re.sub(pattern, r'\1' + image_figure(slug, alt) + r'\2', text, count=1, flags=re.S)
    if 'class="maxi-image-band"' not in text:
        band = f'''<div class="maxi-image-band" aria-label="More Maxi Taxi Sydney vehicle images">
      <figure><img src="{IMG}luxury-sprinter-cbd-card.webp" alt="Luxury Mercedes Sprinter maxi taxi in Sydney CBD" loading="lazy" decoding="async" width="900" height="510"><figcaption>Luxury Sprinter CBD Transfers</figcaption></figure>
      <figure><img src="{IMG}randwick-sprinter-race-card.webp" alt="Randwick race day maxi taxi transfer" loading="lazy" decoding="async" width="900" height="510"><figcaption>Race Day Group Transport</figcaption></figure>
      <figure><img src="{IMG}whitebay-sprinter-cruise-card.webp" alt="White Bay cruise terminal maxi taxi transfer" loading="lazy" decoding="async" width="900" height="510"><figcaption>White Bay Cruise Transfers</figcaption></figure>
    </div>'''
        text = text.replace('</div>\n</section>\n\n\n<section class="maxi-section dark">', band + '\n  </div>\n</section>\n\n\n<section class="maxi-section dark">', 1)
    return text


def council_image_slug(slug: str) -> str:
    if 'randwick' in slug:
        return 'randwick-sprinter-race'
    if 'parramatta' in slug or 'rosehill' in slug or 'cumberland' in slug:
        return 'rosehill-hiace-raceday'
    if 'north' in slug or 'willoughby' in slug or 'ku-ring' in slug or 'lane-cove' in slug:
        return 'luxury-sprinter-cbd'
    if 'bayside' in slug or 'sydney' in slug:
        return 'hero-airport-kia-carnival'
    if 'woollahra' in slug or 'waverley' in slug:
        return 'group-hiace-bondi'
    if 'wollongong' in slug or 'central-coast' in slug or 'blue-mountains' in slug:
        return 'school-minibus'
    return 'airport-night-hiace'


def patch_council_images(text: str, council: str, slug: str) -> str:
    hero_slug = council_image_slug(slug)
    text = text.replace("url('/images/hero-sydney.jpg')", f"url('{IMG}{hero_slug}-full.webp')")
    if 'class="maxi-section-links"' not in text:
        links = '<div class="maxi-section-links" aria-label="Maxi Taxi page sections"><a href="/maxi-taxi/">Maxi Taxi Sydney</a><a href="/maxi-taxi/#maxi-airport">Airport</a><a href="/maxi-taxi/#maxi-family">Baby Seats</a><a href="/maxi-taxi/#maxi-accessible">Accessible</a><a href="/maxi-taxi/#maxi-councils">Service Areas</a><a href="/">Original Home</a></div>'
        text = re.sub(r'(<div class="maxi-area-ctas">.*?</div>)', r'\1' + links, text, count=1)
    if 'class="maxi-hero-photo"' not in text:
        photo = f'''<figure class="maxi-hero-photo"><picture><source srcset="{IMG}{hero_slug}-card.webp" media="(max-width: 900px)"><img src="{IMG}{hero_slug}-full.webp" alt="Premium Maxi Taxi {html.escape(council)} service vehicle" loading="eager" decoding="async" width="1440" height="816"></picture><figcaption>Maxi Taxi {html.escape(council)} Service</figcaption></figure>'''
        text = re.sub(r'(<aside class="maxi-area-card">)', r'\1' + photo, text, count=1)
    card_map = [
        ('Airport Maxi Taxi Transfers', 'airport-night-hiace', f'Airport Maxi Taxi {council} transfer vehicle'),
        ('7 to 11 Seater Maxi Cabs', 'group-hiace-bondi', f'7 to 11 seater Maxi Taxi {council} group vehicle'),
        ('Family and Baby Seat Requests', 'family-baby-seat-kia', f'Family Maxi Taxi {council} with baby seat'),
        ('Wheelchair Accessible Requests', 'wheelchair-ramp-airport', f'Wheelchair accessible Maxi Taxi {council} ramp request'),
        ('Events, Weddings and Cruise Transfers', 'sydney-cruise-hiace', f'Cruise event and wedding Maxi Taxi {council} transfer'),
        ('Direct Booking and Fixed Fare Quotes', 'hero-airport-kia-carnival', f'Fixed fare Maxi Taxi {council} airport booking'),
    ]
    for title, img_slug, alt in card_map:
        if f'alt="{html.escape(alt)}"' in text:
            continue
        pattern = r'(<article class="maxi-card">\s*<div class="maxi-icon-box">.*?</div>)(<h3>' + re.escape(title) + r'</h3>)'
        text = re.sub(pattern, r'\1' + image_figure(img_slug, alt) + r'\2', text, count=1, flags=re.S)
    return text


def add_ids_to_main_page(text: str) -> str:
    replacements = {
        '<section class="maxi-section">\n  <div class="container">\n    <div class="maxi-section-head"><span class="maxi-kicker">Maxi Taxi Booking Features</span>': '<section id="maxi-airport" class="maxi-section">\n  <div class="container">\n    <div class="maxi-section-head"><span class="maxi-kicker">Maxi Taxi Booking Features</span>',
        '<article class="maxi-service-card"><div class="maxi-icon-box"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"': '<article id="maxi-family" class="maxi-service-card"><div class="maxi-icon-box"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"',
        '<article class="maxi-service-card"><div class="maxi-icon-box"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"': '<article id="maxi-accessible" class="maxi-service-card"><div class="maxi-icon-box"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"',
        '<article class="maxi-service-card"><div class="maxi-icon-box"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"': '<article id="maxi-corporate" class="maxi-service-card"><div class="maxi-icon-box"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"',
        '<section class="maxi-section dark">\n  <div class="container">': '<section id="maxi-councils" class="maxi-section dark">\n  <div class="container">',
    }
    for old, new in replacements.items():
        text = text.replace(old, new, 1)
    return text


def ensure_main_council_directory(text: str) -> str:
    if 'Sydney Maxi Taxi Service Areas' in text:
        return text
    links = ''.join(f'<a href="/maxi-taxi/{slugify(name)}/">{html.escape(name)} <span>{count} suburbs</span></a>' for name, count in COUNCILS)
    directory = f'''
    <div class="maxi-section-head" style="margin-top:52px"><span class="maxi-kicker">Sydney Maxi Taxi Service Areas</span><h2 class="maxi-section-title">Book a Maxi Taxi in your <span>local area</span></h2><p class="maxi-section-copy">Select your area below to arrange a Maxi Taxi for airport transfers, group travel, baby seat requests, accessible taxi requests, events, cruise transfers and corporate transport.</p></div>
    <div class="maxi-council-directory">{links}</div>
'''
    return text.replace('</div>\n</section>\n\n<section class="maxi-section">', directory + '</div>\n</section>\n\n<section class="maxi-section">', 1)


def rewrite_maxi_booking_links(text: str, slug: str = '') -> str:
    """Route every Maxi Taxi-specific booking CTA to the dedicated Maxi Taxi booking page."""
    area_qs = ('?area=' + slug) if slug else ''
    replacements = {
        'href="/book?vehicle=maxi"': 'href="/maxi-taxi/book/"',
        "href='/book?vehicle=maxi'": "href='/maxi-taxi/book/'",
        'href="/book?vehicle=maxi&': 'href="/maxi-taxi/book/?',
        "href='/book?vehicle=maxi&": "href='/maxi-taxi/book/?",
        'href="/book?vehicle=Maxi%20Taxi"': 'href="/maxi-taxi/book/"',
        "href='/book?vehicle=Maxi%20Taxi'": "href='/maxi-taxi/book/'",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r'href=["\']/book["\']', lambda m: 'href="' + '/maxi-taxi/book/' + area_qs + '"', text)
    return text


def patch_main_page():
    path = PUBLIC / 'maxi-taxi.html'
    text = path.read_text()
    keywords = 'maxi taxi Sydney, maxi cab Sydney, 11 seater taxi Sydney, airport maxi taxi Sydney, baby seat maxi taxi Sydney, wheelchair accessible maxi taxi Sydney, group taxi Sydney, cruise transfer maxi cab Sydney'
    text = replace_header_with_dedicated(text, title=MAIN_META['title'], desc=MAIN_META['desc'], canonical=MAIN_META['canonical'], keywords=keywords, schema=main_schema())
    text = add_ids_to_main_page(text)
    text = ensure_main_council_directory(text)
    text = patch_main_images(text)
    text = rewrite_maxi_booking_links(text)
    path.write_text(text)
    clean_index = PUBLIC / 'maxi-taxi' / 'index.html'
    clean_index.parent.mkdir(parents=True, exist_ok=True)
    clean_index.write_text(text)


def patch_council_pages():
    for council, suburbs in COUNCILS:
        slug = slugify(council)
        path = PUBLIC / 'maxi-taxi' / slug / 'index.html'
        if not path.exists():
            continue
        text = path.read_text()
        title = f'Maxi Taxi {council} | 7-11 Seater Maxi Cab & Airport Transfers'
        desc = f'Book Maxi Taxi {council} service across {suburbs} suburbs for 7 to 11 seater maxi cab trips, Sydney Airport transfers, baby seats, wheelchair accessible taxi requests, cruise transfers and group travel.'
        keywords = f'maxi taxi {council}, maxi cab {council}, 11 seater taxi {council}, airport maxi taxi {council}, baby seat taxi {council}, wheelchair accessible maxi taxi {council}, group taxi {council}'
        canonical = f'{BASE}/maxi-taxi/{slug}/'
        text = replace_header_with_dedicated(text, title=title, desc=desc, canonical=canonical, keywords=keywords, schema=council_schema(council, suburbs, slug))
        text = patch_council_images(text, council, slug)
        text = rewrite_maxi_booking_links(text, slug)
        path.write_text(text)


def create_maxi_booking_page():
    src = PUBLIC / 'book.html'
    dst = PUBLIC / 'maxi-taxi' / 'book' / 'index.html'
    if not src.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    text = src.read_text()
    text = re.sub(r'<title>.*?</title>', '<title>Maxi Taxi Online Booking Sydney | Silver Service 7-11 Seater Booking</title>', text, count=1)
    text = re.sub(r'<meta name="description" content="[^"]*"\s*/?>', '<meta name="description" content="Book a Maxi Taxi online with Silver Service Sydney for 7 to 11 seater airport transfers, family travel, cruise terminals, accessible requests and group transport.">', text, count=1)
    text = re.sub(r'<link rel="canonical" href="[^"]*"\s*/?>', '<link rel="canonical" href="https://silverserviceonline.com.au/maxi-taxi/book/">', text, count=1)
    text = re.sub(r'<meta property="og:title" content="[^"]*"\s*/?>', '<meta property="og:title" content="Maxi Taxi Online Booking Sydney | Silver Service">', text)
    text = re.sub(r'<meta property="og:description" content="[^"]*"\s*/?>', '<meta property="og:description" content="Dedicated Maxi Taxi online booking for Sydney group transfers, airport maxi cabs and 7 to 11 seater travel.">', text)
    text = re.sub(r'<meta property="og:url" content="[^"]*"\s*/?>', '<meta property="og:url" content="https://silverserviceonline.com.au/maxi-taxi/book/">', text)
    text = re.sub(r'<meta name="twitter:title" content="[^"]*"\s*/?>', '<meta name="twitter:title" content="Maxi Taxi Online Booking Sydney">', text)
    text = re.sub(r'<meta name="twitter:description" content="[^"]*"\s*/?>', '<meta name="twitter:description" content="Book your Maxi Taxi Sydney online with the Maxi Taxi vehicle selected by default.">', text)
    text = text.replace('href="style.css', 'href="/style.css')
    text = text.replace('src="images/', 'src="/images/')
    text = text.replace('href="images/', 'href="/images/')
    text = text.replace('src="shared.js"', 'src="/shared.js"')
    text = text.replace('src="mobile-menu.js', 'src="/mobile-menu.js')
    text = text.replace('href="mobile-menu.css', 'href="/mobile-menu.css')
    text = text.replace('href="mega-menu.css', 'href="/mega-menu.css')
    text = text.replace('href="/book"', 'href="/maxi-taxi/book/"')
    text = text.replace("href='/book'", "href='/maxi-taxi/book/'")
    text = text.replace('href="/book?vehicle=maxi"', 'href="/maxi-taxi/book/"')
    text = text.replace('<input checked="" class="veh-radio" id="v-sedan" name="vehicle" type="radio" value="Silver Service Sedan"/>', '<input class="veh-radio" id="v-sedan" name="vehicle" type="radio" value="Silver Service Sedan"/>')
    text = text.replace('<input class="veh-radio" id="v-maxi" name="vehicle" type="radio" value="Maxi Taxi"/>', '<input checked="" class="veh-radio" id="v-maxi" name="vehicle" type="radio" value="Maxi Taxi"/>')
    text = text.replace("vehicle: 'Silver Service Sedan',\n  vehicleKey: 'sedan',", "vehicle: 'Maxi Taxi',\n  vehicleKey: 'maxi',")
    text = text.replace('Book Your Ride', 'Book Your Maxi Taxi Ride')
    text = text.replace('<h1>Book Your Premium Taxi</h1>', '<h1>Book Your Maxi Taxi</h1>')
    text = text.replace('<p>Instant confirmation via SMS • Transparent pricing • Professional drivers</p>', '<p>Dedicated 7-11 seater Maxi Taxi booking • Instant confirmation via SMS • Transparent pricing</p>')
    banner = ('\n<section class="booking-maxi-intro" style="background:linear-gradient(135deg,#07111f,#13233d);color:#fff;padding:26px 18px;text-align:center;border-bottom:1px solid rgba(214,170,47,.28)"><div class="container"><p style="margin:0 0 8px;color:#f4d263;font-weight:900;letter-spacing:.14em;text-transform:uppercase">Dedicated Maxi Taxi Online Booking</p><h1 style="margin:0;font-size:clamp(28px,4vw,46px)">Book a 7-11 Seater Maxi Taxi Online</h1><p style="max-width:780px;margin:12px auto 0;color:#d7e0ef">This booking page is set for Maxi Taxi trips by default. For standard Silver Service sedan, Lexus or SUV bookings, use the original booking page from the main site navigation.</p></div></section>\n')
    if 'class="booking-maxi-intro"' not in text:
        if '<!-- BOOKING -->' in text:
            text = text.replace('<!-- BOOKING -->', banner + '<!-- BOOKING -->', 1)
        else:
            text = text.replace('<body>', '<body>' + banner, 1)
    init_patch = """\n  if (!params.get('vehicle')) {\n    const maxi = document.getElementById('v-maxi');\n    if (maxi) maxi.checked = true;\n    state.vehicle = 'Maxi Taxi';\n    state.vehicleKey = 'maxi';\n  }\n"""
    if 'Dedicated page default: Maxi Taxi' not in text:
        text = text.replace('  // Pre-fill from URL params\n  const params = new URLSearchParams(window.location.search);', '  // Pre-fill from URL params\n  const params = new URLSearchParams(window.location.search);\n  // Dedicated page default: Maxi Taxi' + init_patch, 1)
    dst.write_text(text)


def update_sitemaps():
    sm = PUBLIC / 'sitemap.xml'
    if sm.exists():
        text = sm.read_text()
        urls = [('maxi-taxi/', '0.95'), ('maxi-taxi/book/', '0.94')] + [(f'maxi-taxi/{slugify(name)}/', '0.82') for name, _ in COUNCILS]
        for rel, priority in urls:
            loc = f'{BASE}/{rel}'
            if f'<loc>{loc}</loc>' not in text and f'<loc>{loc.rstrip("/")}</loc>' not in text:
                block = f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>{priority}</priority>\n  </url>\n'
                text = text.replace('</urlset>', block + '</urlset>')
        sm.write_text(text)
    hs = PUBLIC / 'sitemap-html.html'
    if hs.exists():
        text = hs.read_text()
        if 'Maxi Taxi Council Areas' not in text:
            links = '\n'.join(f'<a href="/maxi-taxi/{slugify(name)}/">Maxi Taxi {html.escape(name)}</a>' for name, _ in COUNCILS)
            block = f'<h2>Maxi Taxi Council Areas</h2>\n<a href="/maxi-taxi/">Maxi Taxi Sydney</a>\n{links}\n'
            text = text.replace('</main>', block + '</main>') if '</main>' in text else text + block
        hs.write_text(text)


def dashboard_url_entry(url: str, title: str, keywords: str) -> str:
    return "  { url: '" + url + "', title: '" + title.replace("'", "\\'") + "', type: 'maxi-taxi', priority: 'High', keywords: '" + keywords.replace("'", "\\'") + "' }"


def update_dashboard():
    path = PUBLIC / 'seo-dashboard.html'
    if not path.exists():
        return
    text = path.read_text()
    entries = [dashboard_url_entry('/maxi-taxi/', 'Maxi Taxi Sydney', 'maxi taxi Sydney, maxi cab Sydney, 11 seater taxi Sydney, airport maxi taxi Sydney'), dashboard_url_entry('/maxi-taxi/book/', 'Maxi Taxi Online Booking Sydney', 'book maxi taxi Sydney, maxi taxi online booking, 11 seater taxi booking Sydney')]
    for council, suburbs in COUNCILS:
        slug = slugify(council)
        entries.append(dashboard_url_entry(f'/maxi-taxi/{slug}/', f'Maxi Taxi {council}', f'maxi taxi {council}, maxi cab {council}, 11 seater taxi {council}, {suburbs} suburbs'))
    marker = '  // Maxi Taxi dedicated service pages - managed by scripts/patch_maxi_dedicated_section.py\n'
    block = marker + ',\n'.join(entries) + ',\n'
    if marker in text:
        text = re.sub(re.escape(marker) + r'.*?\n\s*// END Maxi Taxi dedicated service pages\n', block + '  // END Maxi Taxi dedicated service pages\n', text, flags=re.S)
    else:
        text = re.sub(r'(const\s+ALL_URLS\s*=\s*\[\s*)', r'\1\n' + block + '  // END Maxi Taxi dedicated service pages\n', text, count=1)
    text = text.replace("url:'/maxi-taxi-sydney'", "url:'/maxi-taxi/'")
    text = text.replace("url: '/maxi-taxi-sydney'", "url: '/maxi-taxi/'")
    extra_keywords = "\n  {kw:'maxi taxi Sydney', intent:'Commercial', difficulty:42, volume:1900, url:'/maxi-taxi/'},\n  {kw:'maxi cab Sydney', intent:'Commercial', difficulty:39, volume:1300, url:'/maxi-taxi/'},\n  {kw:'11 seater taxi Sydney', intent:'Commercial', difficulty:36, volume:700, url:'/maxi-taxi/'},\n  {kw:'wheelchair accessible maxi taxi Sydney', intent:'Commercial', difficulty:34, volume:450, url:'/maxi-taxi/'},"
    if "kw:'maxi taxi Sydney'" not in text and 'const TARGET_KEYWORDS' in text:
        text = re.sub(r'(const\s+TARGET_KEYWORDS\s*=\s*\[)', r'\1' + extra_keywords, text, count=1)
    path.write_text(text)


def update_dashboard_script_copy():
    src = PUBLIC / 'seo-dashboard.html'
    dst = ROOT / 'scripts' / 'all-urls-dashboard.js'
    if not src.exists() or not dst.exists():
        return
    html_text = src.read_text()
    m = re.search(r'const\s+ALL_URLS\s*=\s*\[(.*?)\];', html_text, flags=re.S)
    if not m:
        return
    dashboard_text = dst.read_text()
    dashboard_text = re.sub(r'const\s+ALL_URLS\s*=\s*\[.*?\];', 'const ALL_URLS = [' + m.group(1) + '];', dashboard_text, flags=re.S)
    dst.write_text(dashboard_text)


def patch_generator_scripts():
    for path in [ROOT / 'scripts' / 'create_maxi_taxi_page.py', ROOT / 'scripts' / 'create_maxi_taxi_council_pages.py']:
        if not path.exists():
            continue
        text = path.read_text()
        text = text.replace('style.css?v=6', 'style.css?v=7').replace('style.css?v=5', 'style.css?v=7')
        if 'patch_maxi_dedicated_section.py' not in text:
            text += "\n# Dedicated Maxi Taxi logo/menu, supplied image placement, SVG constraints, return links, and SEO dashboard registration are finalized by scripts/patch_maxi_dedicated_section.py.\n"
        path.write_text(text)


subprocess.run(['python3', str(ROOT / 'scripts' / 'create_maxi_taxi_page.py')], cwd=ROOT, check=True)
subprocess.run(['python3', str(ROOT / 'scripts' / 'create_maxi_taxi_council_pages.py')], cwd=ROOT, check=True)
patch_main_page()
patch_council_pages()
create_maxi_booking_page()
update_sitemaps()
update_dashboard()
update_dashboard_script_copy()
patch_generator_scripts()
print('Dedicated Maxi Taxi section patched: main-site-style header/footer, original-site links, supplied images, council pages, sitemap, and SEO dashboard entries updated.')
