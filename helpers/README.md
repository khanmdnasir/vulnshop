# VulnShop — Attacker Helper Scripts

Reproducible command-line companions to the techniques documented in
[`../PENTEST_GUIDE.md`](../PENTEST_GUIDE.md). Every primary technique in the
lab report runs inside Burp Suite; these scripts exist so the same attack
can be re-executed from a terminal for batch jobs, screenshots, or CI.

| Script             | Vulnerability                              | OWASP 2025 | Purpose                                                  |
|--------------------|--------------------------------------------|------------|----------------------------------------------------------|
| `enum_orders.py`   | IDOR on `GET /api/orders/{order_id}`       | A01        | Walk all order IDs as a low-privilege user; classify.    |
| `crack_jwt.sh`     | Weak HS256 signing secret                  | A04        | Recover the secret from any captured JWT with hashcat.   |
| `forge_admin.py`   | Weak HS256 secret + JWT-claim-only role    | A04 + A01  | Issue an administrator token offline.                    |

## Quick start

```bash
# 1. Bring up VulnShop (in two other terminals — see ../README.md)

# 2. Enumerate orders as alice (A01 IDOR)
python3 helpers/enum_orders.py --base http://localhost:8000 --max 30

# 3. Capture any JWT (e.g. from your own login) and crack it offline (A04)
./helpers/crack_jwt.sh 'eyJhbGciOiJIUzI1NiIs...'

# 4. Forge an admin token and exercise the admin API (A04 chained to A01)
TOKEN=$(python3 helpers/forge_admin.py)
curl -s http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## Proxying through Burp

Both Python scripts accept `--proxy http://127.0.0.1:8080` so the traffic
appears in Burp Proxy → HTTP History. This is the recommended workflow for
the lab demo — script-driven for reproducibility, Burp-visible for evidence.

## Safety

These scripts target `localhost` by default and refuse to do anything
destructive (no DELETE calls, no writes to other users' resources). They
exist for the lab and should not be run against any system you do not own.
