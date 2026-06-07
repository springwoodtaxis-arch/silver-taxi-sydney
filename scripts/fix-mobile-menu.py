#!/usr/bin/env python3
"""
Fix mobile menu issues:
1. Remove duplicate old mobile menu items that appear AFTER the mob-panel closing </div>
2. The pattern is: after </div>\n</div> (closing mob-footer + mob-panel), 
   there's leftover old menu HTML (Book Now, About, Contact, Manage, </nav>, mob-footer, </div>)
"""
import re, sys, glob

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern: After the mob-panel's mob-footer closes (</div>\n</div>), 
    # there's leftover old nav items followed by another </nav> and mob-footer
    # The duplicate starts with "  <!-- Book Now -->" right after "</div>\n</div>"
    # and ends with another "</div>\n</div>" (the old mob-footer + mob-panel close)
    
    # Look for the pattern: mob-call-btn...1800 173 171...</a>\n</div>\n</div>\n  <!-- Book Now -->
    # followed by old nav items until the second </div>\n</div>
    
    # More robust: find the SECOND occurrence of "<!-- Footer call button -->" 
    # and remove from "  <!-- Book Now -->" before it up through the second "</div>\n</div>"
    
    # Strategy: Find the pattern where after "</div>\n</div>" there are orphan mob-nav-items
    # These are NOT inside any <nav> tag (they're between the first mob-panel close and the old nav)
    
    # Pattern to match the duplicate block
    pattern = r'</div>\n</div>\n  <!-- Book Now -->\n  <a href="/book" class="mob-nav-item mob-book-link">.*?</nav>\n<!-- Footer call button -->\n<div class="mob-footer">\n  <a class="mob-call-btn" href="tel:1800173171">.*?</a>\n</div>\n</div>'
    
    new_content = re.sub(pattern, '</div>\n</div>', content, flags=re.DOTALL)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

if __name__ == '__main__':
    files = sys.argv[1:] if len(sys.argv) > 1 else glob.glob('public/**/*.html', recursive=True)
    count = 0
    for f in files:
        try:
            if fix_file(f):
                count += 1
        except Exception as e:
            print(f'Error: {f}: {e}')
    print(f'Fixed {count} files')
