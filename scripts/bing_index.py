#!/usr/bin/env python3
"""
Bing IndexNow Batch Submission Script
Fetches all URLs from the live sitemap and submits them to Bing via IndexNow API.
Usage: python3 bing_index.py [optional_url_list_file]
"""

import json
import subprocess
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import sys
from datetime import datetime

SITEMAP_URL = "https://silverserviceonline.com.au/sitemap.xml"
INDEXNOW_KEY = "myIndexNowKey63638"
KEY_LOCATION = f"https://silverserviceonline.com.au/{INDEXNOW_KEY}.txt"
HOST = "silverserviceonline.com.au"
BING_ENDPOINT = "https://api.indexnow.org/indexnow"


def fetch_sitemap_urls(sitemap_url):
    """Fetch all URLs from the sitemap using curl (bypasses TLS fingerprint blocks)."""
    print(f"Fetching sitemap: {sitemap_url}")
    try:
        result = subprocess.run(
            ["curl", "-s", "-A", "Mozilla/5.0 (compatible; IndexNow/1.0)", sitemap_url],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise RuntimeError(f"curl failed: {result.stderr}")
        content = result.stdout.encode("utf-8")
        root = ET.fromstring(content)
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [loc.text.strip() for loc in root.findall(".//sm:loc", ns) if loc.text]
        print(f"Found {len(urls)} URLs in sitemap")
        return urls
    except Exception as e:
        print(f"ERROR fetching sitemap: {e}")
        sys.exit(1)


def load_urls_from_file(filepath):
    """Load URLs from a pre-fetched URL list file (one URL per line)."""
    print(f"Loading URLs from file: {filepath}")
    try:
        with open(filepath) as f:
            urls = [line.strip() for line in f if line.strip().startswith("http")]
        print(f"Loaded {len(urls)} URLs from file")
        return urls
    except Exception as e:
        print(f"ERROR loading URL file: {e}")
        sys.exit(1)


def submit_to_bing(urls):
    """Submit all URLs to Bing via IndexNow batch API."""
    payload = {
        "host": HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BING_ENDPOINT,
        data=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "Mozilla/5.0 (compatible; IndexNow/1.0)"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            body = resp.read().decode("utf-8", errors="replace")
            return status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)


def main():
    print("=" * 60)
    print(f"Bing IndexNow Submission — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Accept optional URL list file as argument
    if len(sys.argv) > 1:
        urls = load_urls_from_file(sys.argv[1])
    else:
        urls = fetch_sitemap_urls(SITEMAP_URL)

    if not urls:
        print("No URLs found. Exiting.")
        sys.exit(1)

    print(f"\nSubmitting {len(urls)} URLs to Bing IndexNow API...")
    status, body = submit_to_bing(urls)

    print(f"\nBing API response: HTTP {status}")

    if status == 200:
        print(f"  SUCCESS — All {len(urls)} URLs accepted by Bing")
    elif status == 202:
        print(f"  SUCCESS — All {len(urls)} URLs accepted (queued for processing)")
    elif status == 400:
        print(f"  ERROR — Bad request: {body}")
    elif status == 403:
        print(f"  ERROR — Forbidden (key verification failed): {body}")
    elif status == 422:
        print(f"  ERROR — URLs don't belong to host or key invalid: {body}")
    elif status == 429:
        print(f"  WARNING — Too many requests (rate limited). Try again later.")
    else:
        print(f"  UNEXPECTED response {status}: {body}")

    print("\nURLs submitted:")
    for url in urls:
        print(f"  {url}")

    print("\n" + "=" * 60)
    print(f"Bing IndexNow complete: {len(urls)} URLs submitted, HTTP {status}")
    print("=" * 60)

    # Exit with error code if submission failed
    if status not in (200, 202):
        sys.exit(1)


if __name__ == "__main__":
    main()
