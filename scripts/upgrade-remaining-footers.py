#!/usr/bin/env python3
"""
Replace ANY remaining footer format with the premium footer.
Handles: <footer class="ss-footer">, <footer class="footer">, <footer>, etc.
"""
import re, sys, glob

NEW_FOOTER = '''<footer class="footer-premium">
<div class="container">
<div class="footer-top">
<div class="footer-brand">
<div class="footer-brand-logo-wrap">
<div class="footer-brand-emblem"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
<div class="footer-brand-name"><span class="footer-brand-name-top">Silver Service</span><span class="footer-brand-name-sub">Taxi Sydney</span></div>
</div>
<p class="footer-brand-desc">Sydney&rsquo;s premier Silver Service taxi and chauffeur company &mdash; 24/7.</p>
</div>
<div class="footer-cta">
<a href="tel:1800173171" class="footer-cta-phone"><svg viewBox="0 0 24 24" stroke="var(--gold,#c9a84c)" fill="none" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg><span class="footer-cta-phone-number">1800 173 171</span></a>
<a href="/book" class="footer-cta-book">Book Now</a>
</div>
</div>
<div class="footer-bottom-premium">
<div class="footer-bottom-left">&copy; 2026 Silver Service Taxi Sydney &mdash; All Rights Reserved</div>
<div class="footer-bottom-right"><a href="/">Home</a><a href="/privacy-policy">Privacy</a><a href="/terms-and-conditions">Terms</a><a href="/sitemap.xml">Sitemap</a></div>
</div>
</div>
</footer>'''

def upgrade(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'footer-premium' in content:
        return False
    
    # Add mega-menu.css if not present
    if 'mega-menu.css' not in content:
        content = content.replace('</head>', '<link rel="stylesheet" href="/mega-menu.css">\n</head>')
    
    # Match any <footer ...>...</footer>
    footer_pattern = r'<footer[^>]*>.*?</footer>'
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
            if upgrade(f):
                count += 1
        except Exception as e:
            print(f'Error: {f}: {e}')
    print(f'Upgraded {count} files')
