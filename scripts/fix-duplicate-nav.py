#!/usr/bin/env python3
"""
Remove duplicate old nav from taxi-* and similar pages.
These pages have:
1. New mega-menu nav (correct)
2. Old nav with .top-bar + nav.nav + .nav-links (needs removal)
3. Mobile panel (correct)

Pattern to remove: <!-- Top Bar --> ... </nav> (the old nav block)
"""
import re, sys, glob

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern: The old nav starts with "<!-- Top Bar -->" and ends with "</nav>"
    # followed by "<!-- Hero -->" or similar content section
    # It contains class="nav" and class="nav-links"
    
    # Remove the old top-bar + old nav block
    # Pattern: <!-- Top Bar -->\n<div class="top-bar">...</div>\n<!-- Nav -->\n<nav>\n<div class="nav">...</div>\n</nav>
    pattern = r'<!-- Top Bar -->\s*<div class="top-bar">.*?</div>\s*<!-- Nav -->\s*<nav>\s*<div class="nav">.*?</div>\s*</nav>'
    
    new_content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

if __name__ == '__main__':
    files = sys.argv[1:] if len(sys.argv) > 1 else glob.glob('public/taxi-*.html') + glob.glob('public/sydney-airport-*.html') + glob.glob('public/terrey-hills-*.html') + glob.glob('public/warriewood-*.html') + glob.glob('public/whale-beach-*.html')
    count = 0
    for f in files:
        try:
            if fix_file(f):
                count += 1
        except Exception as e:
            print(f'Error: {f}: {e}')
    print(f'Fixed {count} files')
