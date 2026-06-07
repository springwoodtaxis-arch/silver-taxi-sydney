#!/usr/bin/env python3
"""
AI SEO Engine — Silver Service Online
======================================
Google-Safe | E-E-A-T Compliant | No Keyword Stuffing | No Generic Copy

For each page this engine:
  1. Reads the REAL page body text (so AI writes accurate, page-specific copy)
  2. Calls GPT-4.1-mini with strict Google quality guidelines enforced in the prompt
  3. Generates:
       • <title>  — unique, 55-60 chars, primary keyword first, natural language
       • <meta description> — 145-160 chars, answers user intent, one CTA
       • <meta keywords> — 8-12 natural phrases (NOT stuffed)
       • Open Graph / Twitter Card
       • JSON-LD: TaxiService + LocalBusiness (accurate data only)
       • JSON-LD: FAQPage (real questions people ask, genuine answers)
  4. Replaces existing head tags cleanly — no duplication
  5. Updates sitemap.xml lastmod to today

Google Quality Rules enforced in every prompt:
  ✅ Unique copy — never reuse sentences across pages
  ✅ Accurate — only facts present on the actual page
  ✅ User-intent matched — answers what the searcher wants
  ✅ Natural language — keywords flow naturally in sentences
  ✅ No stuffing — keyword density target <2%
  ✅ E-E-A-T signals — expertise, experience, authority, trust

Usage:
  python3 scripts/seo_engine.py            # live run
  python3 scripts/seo_engine.py --dry-run  # preview only, no files written
"""

import os, re, sys, json, datetime
from pathlib import Path
from bs4 import BeautifulSoup
from openai import OpenAI

DRY_RUN    = "--dry-run" in sys.argv
BASE_DIR   = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"
SITEMAP    = PUBLIC_DIR / "sitemap.xml"
BASE_URL   = "https://silverserviceonline.com.au"
TODAY      = datetime.date.today().isoformat()
BRAND      = "Silver Service Online"
PHONE      = "1800 173 171"

client = OpenAI()

# ── Page registry ─────────────────────────────────────────────────────────
# (slug, html_file, suburb/topic, region, approx_airport_fare)
PAGES = [
    ("",                                         "index.html",                                    "Sydney",                       "Sydney, NSW",               None),
    ("about",                                    "about.html",                                    "About Us",                     "Sydney, NSW",               None),
    ("airport-transfers",                        "airport-transfers.html",                        "Airport Transfers",            "Sydney, NSW",               None),
    ("book",                                     "book.html",                                     "Online Booking",               "Sydney, NSW",               None),
    ("contact",                                  "contact.html",                                  "Contact",                      "Sydney, NSW",               None),
    ("services",                                 "services.html",                                 "Taxi Services",                "Sydney, NSW",               None),
    ("taxi-liverpool",                           "taxi-liverpool.html",                           "Liverpool",                    "South-West Sydney, NSW",    "$150"),
    ("taxi-loftus",                              "taxi-loftus.html",                              "Loftus",                       "Sutherland Shire, NSW",     "$116"),
    ("taxi-lower-north-shore-sydney",            "taxi-lower-north-shore-sydney.html",            "Lower North Shore",            "North Shore Sydney, NSW",   "$91"),
    ("taxi-lugarno",                             "taxi-lugarno.html",                             "Lugarno",                      "Sutherland Shire, NSW",     "$105"),
    ("taxi-macquarie-fields",                    "taxi-macquarie-fields.html",                    "Macquarie Fields",             "South-West Sydney, NSW",    "$184"),
    ("taxi-manly",                               "taxi-manly.html",                               "Manly",                        "Northern Beaches, NSW",     "$133"),
    ("taxi-marsfield-all-in-one",                "taxi-marsfield-all-in-one.html",                "Marsfield",                    "North-West Sydney, NSW",    "$127"),
    ("taxi-menai",                               "taxi-menai.html",                               "Menai",                        "Sutherland Shire, NSW",     "$133"),
    ("taxi-minto",                               "taxi-minto.html",                               "Minto",                        "South-West Sydney, NSW",    "$201"),
    ("taxi-miranda",                             "taxi-miranda.html",                             "Miranda",                      "Sutherland Shire, NSW",     "$98"),
    ("taxi-mortdale",                            "taxi-mortdale.html",                            "Mortdale",                     "St George, NSW",            "$98"),
    ("taxi-mosman",                              "taxi-mosman.html",                              "Mosman",                       "Lower North Shore, NSW",    "$105"),
    ("taxi-newport",                             "taxi-newport.html",                             "Newport",                      "Northern Beaches, NSW",     "$201"),
    ("taxi-oatley",                              "taxi-oatley.html",                              "Oatley",                       "St George, NSW",            "$98"),
    ("taxi-parramatta",                          "taxi-parramatta.html",                          "Parramatta",                   "Western Sydney, NSW",       "$133"),
    ("taxi-peakhurst",                           "taxi-peakhurst.html",                           "Peakhurst",                    "St George, NSW",            "$91"),
    ("taxi-penrith",                             "taxi-penrith.html",                             "Penrith",                      "Western Sydney, NSW",       "$246"),
    ("taxi-penshurst",                           "taxi-penshurst.html",                           "Penshurst",                    "St George, NSW",            "$91"),
    ("taxi-prestons",                            "taxi-prestons.html",                            "Prestons",                     "South-West Sydney, NSW",    "$167"),
    ("taxi-riverwood",                           "taxi-riverwood.html",                           "Riverwood",                    "Canterbury-Bankstown, NSW", "$98"),
    ("taxi-sans-souci",                          "taxi-sans-souci.html",                          "Sans Souci",                   "St George, NSW",            "$70"),
    ("taxi-service-hawkesbury-windsor-richmond", "taxi-service-hawkesbury-windsor-richmond.html", "Hawkesbury / Windsor / Richmond", "North-West Sydney, NSW", "$261"),
    ("taxi-service-mona-vale",                   "taxi-service-mona-vale.html",                   "Mona Vale",                    "Northern Beaches, NSW",     "$184"),
    ("taxi-service-narellan",                    "taxi-service-narellan.html",                    "Narellan",                     "South-West Sydney, NSW",    "$231"),
    ("taxi-service-wetherill-park",              "taxi-service-wetherill-park.html",              "Wetherill Park",               "Western Sydney, NSW",       "$167"),
    ("taxi-st-leonards",                         "taxi-st-leonards.html",                         "St Leonards",                  "Lower North Shore, NSW",    "$98"),
    ("taxi-sutherland",                          "taxi-sutherland.html",                          "Sutherland",                   "Sutherland Shire, NSW",     "$116"),
    ("taxi-sutherland-shire",                    "taxi-sutherland-shire.html",                    "Sutherland Shire",             "South Sydney, NSW",         "$116"),
    ("taxi-sydney-cbd",                          "taxi-sydney-cbd.html",                          "Sydney CBD",                   "Sydney, NSW",               "$80"),
    ("taxi-sylvania",                            "taxi-sylvania.html",                            "Sylvania",                     "Sutherland Shire, NSW",     "$91"),
    ("taxi-to-sydney-airport-updated",           "taxi-to-sydney-airport-updated.html",           "Sydney Airport Taxi",          "Sydney, NSW",               None),
    ("taxi-upper-north-shore",                   "taxi-upper-north-shore.html",                   "Upper North Shore",            "North Shore Sydney, NSW",   "$150"),
    ("taxi-woolooware",                          "taxi-woolooware.html",                          "Woolooware",                   "Sutherland Shire, NSW",     "$105"),
    ("terrey-hills-taxi-service",                "terrey-hills-taxi-service.html",                "Terrey Hills",                 "Northern Beaches, NSW",     "$184"),
    ("warriewood-taxi-service",                  "warriewood-taxi-service.html",                  "Warriewood",                   "Northern Beaches, NSW",     "$184"),
    ("whale-beach-taxi",                         "whale-beach-taxi.html",                         "Whale Beach",                  "Northern Beaches, NSW",     "$216"),
]


# ── Extract real page text ────────────────────────────────────────────────
def extract_page_text(html_path: Path, max_chars: int = 1500) -> str:
    """Extract visible body text from the HTML, strip nav/footer/scripts."""
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    text = " ".join(soup.get_text(separator=" ").split())
    # Remove the existing title from the text to avoid circular reference
    return text[:max_chars]


# ── GPT-4 SEO generation ──────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a senior SEO specialist for an Australian taxi company.
You write metadata that strictly follows Google's quality guidelines:

RULES YOU MUST FOLLOW:
1. UNIQUE — every title and description must be completely different from every other page
2. ACCURATE — only reference facts that appear in the page content provided
3. USER INTENT — the title and description must directly answer what the searcher wants
4. NATURAL LANGUAGE — keywords must read naturally; never list keywords in a row
5. NO STUFFING — use the primary keyword once in the title, once in the description maximum
6. NO GENERIC PHRASES — never use "Welcome to", "Best in class", "Click here", "Learn more"
7. SPECIFIC — include the suburb name, a real fare or feature, and a genuine benefit
8. E-E-A-T — convey real expertise: mention fixed fares, licensed drivers, 24/7, or specific local knowledge
9. FAQ ACCURACY — FAQ answers must be factual, specific, and genuinely helpful to the searcher
10. AUSTRALIAN ENGLISH — use Australian spelling (e.g. "licence" not "license")

You write for humans first, search engines second."""


def generate_seo(slug: str, suburb: str, region: str, fare: str, page_text: str) -> dict:
    url = f"{BASE_URL}/{slug}" if slug else BASE_URL + "/"
    fare_note = f"Airport transfer fare from {suburb}: approximately {fare} fixed." if fare else ""

    user_prompt = f"""Generate SEO metadata for this specific page.

URL: {url}
Suburb / Topic: {suburb}
Region: {region}
{fare_note}

ACTUAL PAGE CONTENT (use this — do not invent facts):
\"\"\"{page_text}\"\"\"

Return ONLY valid JSON with these exact keys:
{{
  "title": "STRICT 55-60 chars MAX. Primary keyword first. End with | Silver Service Online. Count characters carefully.",
  "description": "145-160 chars. One primary keyword used naturally. Specific benefit. One CTA (Book online or Call {PHONE}).",
  "keywords": ["8 to 12 natural keyword phrases — no repetition, no stuffing"],
  "og_title": "50-55 chars Open Graph title — can differ slightly from title",
  "og_description": "120-135 chars — conversational, benefit-focused",
  "faq": [
    {{"question": "Real question people search about taxis in {suburb}", "answer": "Specific, accurate answer based on page content"}},
    {{"question": "How much does a taxi from {suburb} to Sydney Airport cost?", "answer": "Specific answer with fare if known"}},
    {{"question": "Another genuine question about {suburb} taxi service", "answer": "Accurate, helpful answer"}}
  ],
  "schema_name": "Silver Service Taxi {suburb}",
  "schema_description": "One accurate sentence about this specific service in {suburb}.",
  "area_served": "{suburb}, {region}"
}}

CRITICAL: The title and description must be completely unique — not a template, not generic.
Write as if you are a local expert who knows {suburb} well."""

    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.4,          # lower = more consistent, less hallucination
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


# ── Quality validation ────────────────────────────────────────────────────
def validate_seo(seo: dict, suburb: str) -> list[str]:
    """Return list of quality warnings."""
    warnings = []
    title = seo.get("title", "")
    desc  = seo.get("description", "")

    if len(title) < 40 or len(title) > 65:
        warnings.append(f"Title length {len(title)} (target 55-60)")
    if len(desc) < 130 or len(desc) > 165:
        warnings.append(f"Description length {len(desc)} (target 145-160)")

    # Check for keyword stuffing (same phrase >2 times)
    combined = (title + " " + desc).lower()
    suburb_lower = suburb.lower().split("/")[0].strip()
    count = combined.count(suburb_lower)
    if count > 3:
        warnings.append(f"Possible keyword stuffing: '{suburb_lower}' appears {count} times")

    # Check for banned generic phrases
    banned = ["welcome to", "best in class", "click here", "learn more", "number one", "#1 in"]
    for b in banned:
        if b in combined:
            warnings.append(f"Generic phrase detected: '{b}'")

    # Check FAQ has real answers
    for faq in seo.get("faq", []):
        if len(faq.get("answer", "")) < 30:
            warnings.append(f"FAQ answer too short: '{faq.get('question', '')}'")

    return warnings


# ── Build JSON-LD ─────────────────────────────────────────────────────────
def build_jsonld(slug: str, seo: dict) -> list[dict]:
    url = f"{BASE_URL}/{slug}" if slug else BASE_URL + "/"
    blocks = []

    # TaxiService + LocalBusiness — only factual, verified fields
    blocks.append({
        "@context": "https://schema.org",
        "@type": ["TaxiService", "LocalBusiness"],
        "name": seo["schema_name"],
        "url": url,
        "logo": f"{BASE_URL}/images/logo.png",
        "image": f"{BASE_URL}/images/hero.jpg",
        "description": seo["schema_description"],
        "telephone": "+611800173171",
        "priceRange": "$$",
        "currenciesAccepted": "AUD",
        "paymentAccepted": "Cash, Credit Card, EFTPOS, CabCharge",
        "areaServed": seo["area_served"],
        "openingHours": "Mo-Su 00:00-23:59",
    })

    # FAQPage — only if we have valid FAQs
    faqs = [f for f in seo.get("faq", []) if f.get("question") and f.get("answer")]
    if faqs:
        blocks.append({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": f["question"],
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": f["answer"]
                    }
                }
                for f in faqs
            ]
        })

    return blocks


# ── Build clean SEO head block ────────────────────────────────────────────
SEO_START = "<!-- SEO:AI:START -->"
SEO_END   = "<!-- SEO:AI:END -->"


def build_seo_block(slug: str, seo: dict) -> str:
    url = f"{BASE_URL}/{slug}" if slug else BASE_URL + "/"
    keywords_str = ", ".join(seo["keywords"]) if isinstance(seo["keywords"], list) else seo["keywords"]
    jsonld_blocks = build_jsonld(slug, seo)

    lines = [
        SEO_START,
        f'<title>{seo["title"]}</title>',
        f'<meta name="description" content="{seo["description"]}"/>',
        f'<meta name="keywords" content="{keywords_str}"/>',
        '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"/>',
        f'<link rel="canonical" href="{url}"/>',
        '<!-- Open Graph -->',
        '<meta property="og:type" content="website"/>',
        '<meta property="og:site_name" content="Silver Service Online"/>',
        f'<meta property="og:title" content="{seo["og_title"]}"/>',
        f'<meta property="og:description" content="{seo["og_description"]}"/>',
        f'<meta property="og:image" content="{BASE_URL}/images/hero.jpg"/>',
        f'<meta property="og:url" content="{url}"/>',
        '<!-- Twitter Card -->',
        '<meta name="twitter:card" content="summary_large_image"/>',
        f'<meta name="twitter:title" content="{seo["og_title"]}"/>',
        f'<meta name="twitter:description" content="{seo["og_description"]}"/>',
        f'<meta name="twitter:image" content="{BASE_URL}/images/hero.jpg"/>',
    ]

    for block in jsonld_blocks:
        lines.append('<script type="application/ld+json">')
        lines.append(json.dumps(block, indent=2, ensure_ascii=False))
        lines.append('</script>')

    lines.append(SEO_END)
    return "\n".join(lines)


# ── Inject SEO block into HTML ────────────────────────────────────────────
def inject_seo(html_path: Path, slug: str, seo: dict) -> None:
    html = html_path.read_text(encoding="utf-8")
    new_block = build_seo_block(slug, seo)

    if SEO_START in html and SEO_END in html:
        # Replace existing AI block
        html = re.sub(
            re.escape(SEO_START) + r".*?" + re.escape(SEO_END),
            new_block,
            html,
            flags=re.DOTALL
        )
    else:
        # Remove old individual tags cleanly
        patterns = [
            r'<title>[^<]*</title>',
            r'<meta\s+name=["\']description["\'][^>]*/?>',
            r'<meta\s+name=["\']keywords["\'][^>]*/?>',
            r'<meta\s+name=["\']robots["\'][^>]*/?>',
            r'<link\s+rel=["\']canonical["\'][^>]*/?>',
            r'<meta\s+property=["\']og:[^"\']*["\'][^>]*/?>',
            r'<meta\s+name=["\']twitter:[^"\']*["\'][^>]*/?>',
            r'<script\s+type=["\']application/ld\+json["\']>.*?</script>',
        ]
        for p in patterns:
            html = re.sub(p, '', html, flags=re.IGNORECASE | re.DOTALL)

        # Insert after <meta charset=...>
        if re.search(r'<meta\s+charset', html, re.IGNORECASE):
            html = re.sub(
                r'(<meta\s+charset[^>]*/?>)',
                r'\1\n' + new_block,
                html, count=1, flags=re.IGNORECASE
            )
        else:
            html = html.replace('<head>', '<head>\n' + new_block, 1)

    if not DRY_RUN:
        html_path.write_text(html, encoding="utf-8")


# ── Update sitemap lastmod ────────────────────────────────────────────────
def update_sitemap() -> None:
    import xml.etree.ElementTree as ET
    ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    tree = ET.parse(SITEMAP)
    ns   = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    for lm in tree.findall(".//sm:lastmod", ns):
        lm.text = TODAY
    if not DRY_RUN:
        tree.write(str(SITEMAP), xml_declaration=True, encoding="UTF-8")
    print(f"  ✅ Sitemap lastmod → {TODAY}")


# ── Main ──────────────────────────────────────────────────────────────────
def main():
    print(f"\n{'='*68}")
    print(f"  AI SEO ENGINE — Silver Service Online")
    print(f"  Google-Safe | E-E-A-T | No Keyword Stuffing | No Generic Copy")
    print(f"  Mode : {'DRY RUN (preview only)' if DRY_RUN else 'LIVE — writing to files'}")
    print(f"  Pages: {len(PAGES)}")
    print(f"{'='*68}\n")

    manifest = {}
    errors   = []
    warnings_total = []

    for slug, fname, suburb, region, fare in PAGES:
        html_path = PUBLIC_DIR / fname
        if not html_path.exists():
            print(f"  ⚠️  SKIP (no file): {fname}")
            errors.append(fname)
            continue

        print(f"  🤖 {suburb:<35}", end=" ", flush=True)

        try:
            # Step 1: read real page content
            page_text = extract_page_text(html_path)

            # Step 2: generate SEO from real content
            seo = generate_seo(slug, suburb, region, fare, page_text)

            # Step 3: validate quality
            warns = validate_seo(seo, suburb)
            if warns:
                warnings_total.extend([(suburb, w) for w in warns])
                warn_str = f"  ⚠️  {'; '.join(warns)}"
            else:
                warn_str = ""

            # Step 4: inject
            inject_seo(html_path, slug, seo)

            manifest[slug or "/"] = {
                "title": seo["title"],
                "description": seo["description"],
                "keywords": seo["keywords"],
                "warnings": warns,
            }

            print(f"✅  {seo['title'][:52]}{warn_str}")

        except Exception as e:
            print(f"❌  ERROR: {e}")
            errors.append(fname)

    # Update sitemap
    update_sitemap()

    # Save manifest
    manifest_path = BASE_DIR / "scripts" / "seo_manifest.json"
    if not DRY_RUN:
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        print(f"  📋 Manifest → scripts/seo_manifest.json")

    print(f"\n{'='*68}")
    print(f"  ✅ Pages updated : {len(manifest)}")
    print(f"  ⚠️  Warnings      : {len(warnings_total)}")
    print(f"  ❌ Errors        : {len(errors)}")
    if warnings_total:
        print(f"\n  WARNINGS:")
        for page, w in warnings_total:
            print(f"    [{page}] {w}")
    if errors:
        print(f"\n  ERRORS: {errors}")
    print(f"{'='*68}\n")


if __name__ == "__main__":
    main()
