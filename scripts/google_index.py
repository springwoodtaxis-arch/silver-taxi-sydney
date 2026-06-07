#!/usr/bin/env python3
"""
Google Indexing API — Force re-crawl of all sitemap URLs.

Usage:
  python3 scripts/google_index.py <urls_file> <credentials_json>

Requires:
  - Google service account JSON with Search Console Owner permission
  - google-auth package: pip install google-auth requests
"""

import sys
import time
import json
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SCOPES   = ["https://www.googleapis.com/auth/indexing"]
ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"


def main():
    if len(sys.argv) < 3:
        print("Usage: google_index.py <urls_file> <credentials_json>")
        sys.exit(1)

    urls_file  = sys.argv[1]
    creds_file = sys.argv[2]

    # Load credentials
    try:
        creds = service_account.Credentials.from_service_account_file(
            creds_file, scopes=SCOPES
        )
        creds.refresh(Request())
        print("Google credentials loaded successfully")
    except Exception as e:
        print(f"Could not load Google credentials: {e}")
        sys.exit(0)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {creds.token}"
    }

    # Load URLs
    with open(urls_file) as f:
        urls = [line.strip() for line in f if line.strip()]

    print(f"Submitting {len(urls)} URLs to Google Indexing API...")
    success, failed, skipped = 0, 0, 0

    for i, url in enumerate(urls):
        try:
            r = requests.post(
                ENDPOINT,
                headers=headers,
                json={"url": url, "type": "URL_UPDATED"},
                timeout=15
            )
            if r.status_code in (200, 202):
                success += 1
                print(f"  OK  [{i+1}/{len(urls)}] {url}")
            elif r.status_code == 429:
                print(f"  RATE LIMIT — waiting 10s...")
                time.sleep(10)
                skipped += 1
            else:
                body = {}
                try:
                    body = r.json()
                except Exception:
                    pass
                msg = body.get("error", {}).get("message", "")
                print(f"  WARN [{i+1}/{len(urls)}] HTTP {r.status_code}: {url} — {msg}")
                failed += 1
        except Exception as e:
            print(f"  ERR  [{i+1}/{len(urls)}] {url}: {e}")
            failed += 1

        # Respect Google's daily quota (200 req/day for free tier)
        if i < len(urls) - 1:
            time.sleep(0.5)

    print(f"\nGoogle Indexing API complete:")
    print(f"  Success : {success}")
    print(f"  Failed  : {failed}")
    print(f"  Skipped : {skipped}")


if __name__ == "__main__":
    main()
