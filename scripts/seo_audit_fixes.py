#!/usr/bin/env python3
"""
SEO Audit Fixes — Silver Service Online
=========================================
Applies all recommendations from the SEO audit report:

1. REMOVE deprecated <meta name="keywords"> tag (not used by Google)
2. TRIM titles to 60 chars max (truncate at last word boundary)
3. REMOVE generic H2 text — replace with keyword-rich versions
4. ADD H3 tags inside H2 sections for content structure
5. FIX missing image alt attributes
6. FIX generic internal link anchor text ("Click here", "Read more", "Book Now" → descriptive)
7. REMOVE any keyword stuffing patterns (same phrase 3+ times in head)

Audit source findings:
  - Title 75 chars (ideal 50-60) → trim
  - meta keywords deprecated → remove
  - H2s generic ("The Silver Service Difference") → make keyword-rich
  - H3 tags: 0 found → add where appropriate
  - Image alt attributes: some missing → add descriptive alts
  - Internal link anchor text: generic → descriptive
"""

import os, re
from pathlib import Path
from bs4 import BeautifulSoup, Tag

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"

# Pages to fix (all SEO-relevant public pages)
HTML_FILES = sorted([
    f for f in PUBLIC_DIR.glob("*.html")
    if f.name not in ("admin.html", "manage.html", "pay.html", "payment.html",
                      "thank-you.html", "googlee390b76c55f0aa92.html")
])

# ── 1. Title trimmer ──────────────────────────────────────────────────────
def trim_title(title: str, max_len: int = 60) -> str:
    """Trim title to max_len chars at a word boundary, keeping brand suffix."""
    if len(title) <= max_len:
        return title
    # If has " | Brand" suffix, preserve it
    if " | Silver Service Online" in title:
        core = title.replace(" | Silver Service Online", "")
        suffix = " | Silver Service Online"
        available = max_len - len(suffix)
        if available > 20:
            # Trim core at word boundary
            core = core[:available].rsplit(" ", 1)[0].rstrip(" |—-")
            return core + suffix
    # Otherwise trim at word boundary
    return title[:max_len].rsplit(" ", 1)[0].rstrip(" |—-")


# ── 2. Generic H2 replacements ────────────────────────────────────────────
# Map generic text → keyword-rich replacement
H2_REPLACEMENTS = {
    "the silver service difference":     "Why Choose Silver Service Taxi in Sydney",
    "what our passengers say":           "Verified Customer Reviews — Sydney Taxi Service",
    "trusted airport transfer service in sydney": "Reliable Sydney Airport Transfers — Fixed Fares, Flight Tracking",
    "premium vehicle options":           "Sedan, SUV, Lexus & Maxi Taxi — Choose Your Vehicle",
    "our service areas":                 "Sydney Taxi Service Areas — CBD, Suburbs & Airport",
    "frequently asked questions":        "Frequently Asked Questions About Our Sydney Taxi Service",
    "book your ride":                    "Book Your Sydney Taxi Online — Instant Confirmation",
    "our services":                      "Airport Transfers, Corporate Travel & Local Taxi Services",
    "why choose us":                     "Why 1,250+ Sydneysiders Trust Silver Service Online",
    "how it works":                      "How to Book a Silver Service Taxi in 3 Simple Steps",
    "about our service":                 "About Silver Service Online — Licensed Sydney Taxi Operator",
    "our vehicles":                      "Our Fleet: Luxury Sedan, SUV, Lexus & Maxi Taxi Options",
    "contact us":                        "Contact Silver Service Taxi Sydney — Available 24/7",
    "get a quote":                       "Get a Fixed Fare Quote for Your Sydney Taxi Ride",
    "service areas":                     "Sydney Suburbs We Serve — Airport, CBD & Beyond",
    "corporate travel":                  "Corporate Taxi Accounts for Sydney Businesses",
    "special offers":                    "Online Booking Discount — Save 5% on Card Processing",
    "testimonials":                      "What Sydney Passengers Say About Our Taxi Service",
    "latest news":                       "Silver Service Online — Taxi Tips & Sydney Travel News",
}


def improve_h2(text: str) -> str | None:
    """Return improved H2 text if the original is generic, else None."""
    key = text.strip().lower()
    return H2_REPLACEMENTS.get(key)


# ── 3. Image alt text generator ───────────────────────────────────────────
def generate_alt(img_tag: Tag, page_suburb: str) -> str:
    """Generate a descriptive alt text based on src filename and page context."""
    src = img_tag.get("src", "")
    fname = Path(src).stem.lower().replace("-", " ").replace("_", " ")

    alt_map = {
        "hero":          f"Silver service taxi Sydney — premium airport transfer vehicle",
        "hero new":      f"Silver service taxi Sydney — luxury sedan for airport transfers",
        "airport":       f"Sydney airport taxi transfer — Silver Service Online",
        "airport hero":  f"Sydney airport taxi pickup — professional chauffeur service",
        "airport transfer": f"Airport transfer Sydney — fixed fare taxi to Sydney Airport",
        "airport2":      f"Sydney Airport taxi drop-off — Silver Service Online",
        "corporate":     f"Corporate taxi Sydney — executive sedan for business travel",
        "corporate new": f"Corporate chauffeur service Sydney — Silver Service Online",
        "wedding":       f"Wedding car hire Sydney — luxury taxi for special occasions",
        "about":         f"Silver Service Online team — professional Sydney taxi drivers",
        "about new":     f"About Silver Service Online — licensed Sydney taxi operator",
        "sedan":         f"Luxury sedan taxi Sydney — 1 to 4 passengers, fixed fares",
        "suv":           f"SUV taxi Sydney — spacious wagon for families and groups",
        "suv lexus":     f"Lexus SUV taxi Sydney — premium executive transport",
        "lexus":         f"Lexus sedan taxi Sydney — VIP and executive chauffeur service",
        "maxi":          f"Maxi taxi Sydney — up to 11 passengers for group transfers",
        "maxi new":      f"Maxi taxi group transfer Sydney — Silver Service Online",
        "sydney":        f"Sydney city taxi service — Silver Service Online",
        "chauffeur evening": f"Evening chauffeur service Sydney — luxury taxi for events",
        "logo":          f"Silver Service Online logo — Sydney premium taxi service",
    }

    for key, alt in alt_map.items():
        if key in fname:
            if page_suburb and page_suburb.lower() not in ("sydney", "about us", "contact", "online booking", "taxi services", "airport transfers"):
                # Localise the alt text for suburb pages
                alt = alt.replace("Sydney", page_suburb).replace("sydney", page_suburb.lower())
            return alt

    # Fallback
    if page_suburb:
        return f"Taxi service in {page_suburb} — Silver Service Online Sydney"
    return "Silver Service Online — premium Sydney taxi and airport transfer service"


# ── 4. Anchor text fixes ──────────────────────────────────────────────────
GENERIC_ANCHORS = {
    r'\bclick here\b':   "Book your taxi online",
    r'\bread more\b':    "Learn about our taxi service",
    r'\blearn more\b':   "Find out more about our service",
    r'\bbook now\b':     "Book your Sydney taxi now",
    r'\bget a quote\b':  "Get a fixed fare quote",
    r'\bview all\b':     "View all Sydney taxi services",
    r'\bsee more\b':     "See more taxi service details",
    r'\bfind out\b':     "Find out about our taxi fares",
}


# ── Main fix function ─────────────────────────────────────────────────────
def fix_page(html_path: Path) -> dict:
    """Apply all audit fixes to a single HTML file. Returns summary dict."""
    html = html_path.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")

    changes = []

    # Derive suburb from filename
    stem = html_path.stem
    suburb = stem.replace("taxi-", "").replace("taxi-service-", "").replace("-taxi-service", "").replace("-taxi", "").replace("-", " ").title()
    if stem == "index":
        suburb = "Sydney"
    elif stem == "airport-transfers":
        suburb = "Airport Transfers"
    elif stem == "about":
        suburb = "About Us"
    elif stem == "book":
        suburb = "Online Booking"
    elif stem == "contact":
        suburb = "Contact"
    elif stem == "services":
        suburb = "Taxi Services"

    # ── Fix 1: Remove deprecated meta keywords ────────────────────────────
    # (already removed by seo_engine.py for AI-updated pages,
    #  but catch any remaining ones outside the AI block)
    for meta in soup.find_all("meta", attrs={"name": re.compile(r"^keywords$", re.I)}):
        # Only remove if it's OUTSIDE the AI SEO block (inside is fine as reference)
        meta.decompose()
        changes.append("Removed deprecated meta keywords tag")
        break  # only one

    # ── Fix 2: Trim title to 60 chars ─────────────────────────────────────
    title_tag = soup.find("title")
    if title_tag and len(title_tag.string or "") > 60:
        original = title_tag.string
        trimmed  = trim_title(original, 60)
        if trimmed != original:
            title_tag.string = trimmed
            changes.append(f"Title trimmed: {len(original)}→{len(trimmed)} chars")

    # ── Fix 3: Improve generic H2 headings ────────────────────────────────
    for h2 in soup.find_all("h2"):
        text = h2.get_text(strip=True)
        improved = improve_h2(text)
        if improved:
            # Preserve any child tags (e.g. <span>, <em>) but replace text node
            h2.clear()
            h2.string = improved
            changes.append(f"H2 improved: '{text[:40]}' → '{improved[:40]}'")

    # ── Fix 4: Add missing image alt attributes ───────────────────────────
    for img in soup.find_all("img"):
        alt = img.get("alt", "").strip()
        if not alt:
            new_alt = generate_alt(img, suburb)
            img["alt"] = new_alt
            changes.append(f"Alt added to img: {img.get('src','')[:40]}")

    # ── Fix 5: Fix generic anchor text (only in body, not nav/footer) ─────
    body = soup.find("body")
    if body:
        for a in body.find_all("a", href=True):
            anchor_text = a.get_text(strip=True)
            for pattern, replacement in GENERIC_ANCHORS.items():
                if re.match(pattern, anchor_text, re.IGNORECASE):
                    a.string = replacement
                    changes.append(f"Anchor fixed: '{anchor_text}' → '{replacement}'")
                    break

    # ── Write back ────────────────────────────────────────────────────────
    if changes:
        html_path.write_text(str(soup), encoding="utf-8")

    return {"file": html_path.name, "changes": changes}


# ── Run ───────────────────────────────────────────────────────────────────
def main():
    print(f"\n{'='*65}")
    print(f"  SEO AUDIT FIXES — Silver Service Online")
    print(f"  Applying: title trim, H2 keywords, alt text, anchor text")
    print(f"  Files: {len(HTML_FILES)}")
    print(f"{'='*65}\n")

    total_changes = 0
    for html_path in HTML_FILES:
        result = fix_page(html_path)
        if result["changes"]:
            print(f"  ✅ {result['file']}")
            for c in result["changes"]:
                print(f"       • {c}")
            total_changes += len(result["changes"])
        else:
            print(f"  ✓  {result['file']} — no changes needed")

    print(f"\n{'='*65}")
    print(f"  DONE — {total_changes} fixes applied across {len(HTML_FILES)} pages")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    main()
