from pathlib import Path
import re

ROOT = Path('/home/ubuntu/silver-service-online')
PUBLIC = ROOT / 'public'
COUNCILS = [
    ("City of Sydney", 31), ("City of Parramatta", 27), ("City of Blacktown", 32),
    ("City of Canterbury-Bankstown", 29), ("City of Liverpool", 27), ("Cumberland City Council", 19),
    ("Bayside Council", 28), ("City of Penrith", 28), ("City of Fairfield", 25), ("City of Ryde", 16),
    ("Burwood Council", 6), ("Strathfield Council", 5), ("Sutherland Shire Council", 33),
    ("Northern Beaches Council", 35), ("Hornsby Shire Council", 35), ("Randwick City Council", 19),
    ("City of Campbelltown", 22), ("Camden Council", 13), ("Wollondilly Shire Council", 9),
    ("Inner West Council", 30), ("North Sydney Council", 13), ("City of Willoughby", 8),
    ("Ku-ring-gai Council", 12), ("Lane Cove Council", 8), ("The Hills Shire Council", 16),
    ("Georges River Council", 17), ("Waverley Council", 11), ("Woollahra Council", 10),
    ("Mosman Council", 7), ("City of Wollongong", 37), ("Central Coast Council", 45),
    ("Blue Mountains City Council", 22), ("Hawkesbury City Council", 13),
]

def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace('&', 'and')).strip('-')

errors = []
main = (PUBLIC / 'maxi-taxi.html').read_text()
checks = {
    'main_has_dedicated_header': 'maxi-site-header' in main and 'Maxi Taxi Sydney service menu' in main,
    'main_has_dedicated_brand': 'class="maxi-brand"' in main and 'Sydney Service' in main,
    'main_not_shared_header': 'class="site-header"' not in main and 'mega-menu' not in main,
    'main_absolute_css': 'href="/style.css?v=7"' in main and 'href="style.css' not in main,
    'main_svg_constraints': 'maxi-dedicated-section-style' in main and 'max-width:22px!important' in main,
    'main_service_only_menu': '#maxi-airport' in main and '#maxi-councils' in main and 'Airport Transfers</a></li>' not in main,
    'main_canonical_trailing': 'href="https://silverserviceonline.com.au/maxi-taxi/"' in main,
    'main_schema_clean': 'maxi-service-schema' in main and 'Silver Taxi Sydney Services' not in main,
    'main_council_directory': all(f'/maxi-taxi/{slugify(name)}/' in main for name, _ in COUNCILS),
}
for name, ok in checks.items():
    if not ok:
        errors.append(name)

for council, suburbs in COUNCILS:
    slug = slugify(council)
    p = PUBLIC / 'maxi-taxi' / slug / 'index.html'
    if not p.exists():
        errors.append(f'missing_council_page_{slug}')
        continue
    text = p.read_text()
    if 'maxi-site-header' not in text or 'class="maxi-brand"' not in text:
        errors.append(f'dedicated_header_missing_{slug}')
    if 'class="site-header"' in text or 'mega-menu' in text:
        errors.append(f'shared_header_present_{slug}')
    if 'href="/style.css?v=7"' not in text or 'href="style.css' in text:
        errors.append(f'absolute_css_missing_{slug}')
    if 'maxi-council-service-schema' not in text or 'Silver Taxi Sydney Services' in text:
        errors.append(f'clean_schema_missing_{slug}')
    if f'Maxi Taxi {council}' not in text or f'{suburbs} suburbs' not in text:
        errors.append(f'council_content_missing_{slug}')
    if 'max-width:22px!important' not in text:
        errors.append(f'svg_constraints_missing_{slug}')

dash = (PUBLIC / 'seo-dashboard.html').read_text()
if 'Maxi Taxi dedicated service pages' not in dash:
    errors.append('dashboard_marker_missing')
for council, _ in COUNCILS:
    if f'/maxi-taxi/{slugify(council)}/' not in dash:
        errors.append(f'dashboard_missing_{slugify(council)}')
if '/maxi-taxi-sydney' in dash:
    errors.append('dashboard_stale_maxi_taxi_sydney_url')

sitemap = (PUBLIC / 'sitemap.xml').read_text()
if 'https://silverserviceonline.com.au/maxi-taxi/' not in sitemap:
    errors.append('sitemap_main_missing')
for council, _ in COUNCILS:
    if f'https://silverserviceonline.com.au/maxi-taxi/{slugify(council)}/' not in sitemap:
        errors.append(f'sitemap_missing_{slugify(council)}')

unsafe_patterns = ['maps.google.com', 'google.com/maps', 'maps.app.goo.gl', 'business.site', 'g.page']
maxi_files = [PUBLIC / 'maxi-taxi.html'] + list((PUBLIC / 'maxi-taxi').glob('*/index.html'))
for p in maxi_files:
    lower = p.read_text(errors='ignore').lower()
    for pat in unsafe_patterns:
        if pat in lower:
            errors.append(f'unsafe_exposure_{p.relative_to(PUBLIC)}_{pat}')

print(f'maxi_pages_checked={len(maxi_files)}')
print(f'council_pages_expected={len(COUNCILS)}')
print(f'errors={len(errors)}')
for e in errors[:120]:
    print('ERROR', e)
raise SystemExit(1 if errors else 0)
