#!/usr/bin/env python3
"""
Replace old-style <footer>...</footer> (without class) with the premium footer.
Also removes old ss-nav-wrap if still present (since new navbar was already added).
"""
import re, sys

NEW_FOOTER = '''<footer class="footer-premium">
<div class="container">
<div class="footer-top">
<div class="footer-brand">
<div class="footer-brand-logo-wrap">
<div class="footer-brand-emblem"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
<div class="footer-brand-name"><span class="footer-brand-name-top">Silver Service</span><span class="footer-brand-name-sub">Taxi Sydney</span></div>
</div>
<p class="footer-brand-desc">Sydney&rsquo;s premier Silver Service taxi and chauffeur company. Professional, reliable and luxurious transport &mdash; 24/7.</p>
</div>
<div class="footer-cta">
<span class="footer-cta-text">24/7 Dispatch</span>
<a href="tel:1800173171" class="footer-cta-phone"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg><span class="footer-cta-phone-number">1800 173 171</span></a>
<a href="/book" class="footer-cta-book"><svg viewBox="0 0 24 24" stroke="var(--navy,#0f1f3d)" fill="none" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Book Now</a>
</div>
</div>
<div class="footer-main">
<div>
<div class="footer-col-title-premium"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Quick Links</div>
<ul class="footer-links-premium">
<li><a href="/"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Home</a></li>
<li><a href="/services"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Services</a></li>
<li><a href="/airport-transfers"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Airport Transfers</a></li>
<li><a href="/about"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>About Us</a></li>
<li><a href="/contact"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Contact</a></li>
<li><a href="/book"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Book Online</a></li>
</ul>
</div>
<div>
<div class="footer-col-title-premium"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>Services</div>
<ul class="footer-links-premium">
<li><a href="/airport-transfers"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Airport Transfers</a></li>
<li><a href="/services#corporate"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Corporate Travel</a></li>
<li><a href="/services#chauffeur"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Chauffeur Service</a></li>
<li><a href="/services#events"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Event Transfers</a></li>
<li><a href="/services#vip"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>VIP Luxury</a></li>
</ul>
</div>
<div>
<div class="footer-col-title-premium"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>Areas</div>
<ul class="footer-links-premium">
<li><a href="/locations/sydney-cbd/"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Sydney CBD</a></li>
<li><a href="/locations/parramatta/"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Parramatta</a></li>
<li><a href="/locations/bondi/"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Eastern Suburbs</a></li>
<li><a href="/locations/cronulla/"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>Sutherland Shire</a></li>
<li><a href="/locations/"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>All 400+ Areas</a></li>
</ul>
</div>
<div>
<div class="footer-col-title-premium"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>Contact</div>
<div class="footer-contact-premium">
<div class="footer-contact-row"><div class="footer-contact-icon"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg></div><div class="footer-contact-info"><span class="footer-contact-label">Phone</span><a href="tel:1800173171" class="footer-contact-value">1800 173 171</a></div></div>
<div class="footer-contact-row"><div class="footer-contact-icon"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><div class="footer-contact-info"><span class="footer-contact-label">Email</span><a href="mailto:info@silverserviceonline.com.au" class="footer-contact-value">info@silverserviceonline.com.au</a></div></div>
<div class="footer-contact-row"><div class="footer-contact-icon"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="footer-contact-info"><span class="footer-contact-label">Hours</span><span class="footer-contact-value">24/7 &mdash; 365 Days</span></div></div>
</div>
</div>
</div>
<div class="footer-bottom-premium">
<div class="footer-bottom-left">&copy; 2026 Silver Service Taxi Sydney &mdash; All Rights Reserved</div>
<div class="footer-bottom-right"><a href="/privacy-policy">Privacy</a><a href="/terms-and-conditions">Terms</a><a href="/sitemap.xml">Sitemap</a></div>
</div>
</div>
</footer>'''

def upgrade_old_footer(filepath):
    """Replace old-style <footer>...</footer> with premium footer."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Skip if already has premium footer
    if 'footer-premium' in content:
        return False
    
    # Add mega-menu.css if not present
    if 'mega-menu.css' not in content:
        content = content.replace('</head>', '<link rel="stylesheet" href="/mega-menu.css">\n</head>')
    
    # Replace <footer>...</footer> (no class attribute)
    footer_pattern = r'<footer>.*?</footer>'
    match = re.search(footer_pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + NEW_FOOTER + content[match.end():]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False


if __name__ == '__main__':
    count = 0
    for f in sys.argv[1:]:
        try:
            if upgrade_old_footer(f):
                count += 1
                print(f'✓ Footer upgraded: {f}')
            else:
                print(f'- Skipped (already done): {f}')
        except Exception as e:
            print(f'✗ Error on {f}: {e}')
    print(f'\nTotal upgraded: {count}')
