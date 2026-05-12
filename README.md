# 🛒 VulnShop — Intentionally Vulnerable Ecommerce App

> Penetration testing practice lab built with **React + FastAPI**.
> Contains intentional OWASP Top 10 (2025) vulnerabilities. **Run locally only.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router |
| Backend | FastAPI, Python 3.11+ |
| Database | SQLite (file: `backend/shop.db`) |
| Auth | JWT (HS256, intentionally weak secret) |

---

## Quick Start

### 1. Backend

```bash
cd vulnshop/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server (auto-creates shop.db with seed data)
python main.py
# → API running at http://localhost:8000
# → Docs at http://localhost:8000/docs
```

### 2. Frontend

```bash
cd vulnshop/frontend

npm install
npm run dev
# → App running at http://localhost:3000
```

### 3. Open `http://localhost:3000`

---

## Default Accounts

| Username | Password | Role |
|----------|----------|------|
| `admin`  | `admin123` | Admin |
| `alice`  | `alice123` | User |
| `bob`    | `bob123`   | User |

---

## Vulnerabilities (OWASP Top 10 — 2025)

| OWASP 2025 | Vulnerability | Where |
|------------|--------------|-------|
| **A01:2025** | IDOR — view any user's order | `GET /api/orders/{id}` |
| **A01:2025** | Privilege escalation via JWT forgery | `GET /api/admin/*` |
| **A01:2025** | Mass assignment — set your own balance | `PUT /api/profile` |
| **A02:2025** | Unauthenticated debug endpoints | `/api/debug/config`, `/api/debug/users` |
| **A02:2025** | Permissive CORS (`*` + credentials) | All endpoints |
| **A04:2025** | Plaintext password storage | SQLite `users` table |
| **A04:2025** | Weak JWT secret `"secret"` | All auth endpoints |
| **A05:2025** | SQL Injection in product search | `GET /api/products?search=` |
| **A06:2025** | Payment bypass (client-supplied price) | `POST /api/orders` |
| **A07:2025** | No rate limiting on login (brute-force) | `POST /api/auth/login` |
| **A09:2025** | No security event logging anywhere | All endpoints |
| **A10:2025** | Stack traces returned in 500 responses | `POST /api/auth/register` |

See **[VULNERABILITIES.md](VULNERABILITIES.md)** for full exploitation walkthroughs, PoC commands, and fix code.

---

## API Reference

```
POST /api/auth/register     Register new user
POST /api/auth/login        Login → returns JWT
GET  /api/products          List products (SQLi here: ?search=)
GET  /api/products/{id}     Single product
POST /api/orders            Place order (payment bypass here)
GET  /api/orders            My orders
GET  /api/orders/{id}       Single order (IDOR here)
GET  /api/profile           My profile
PUT  /api/profile           Update profile (mass assignment here)
GET  /api/admin/users       All users — admin JWT required
DELETE /api/admin/users/{id} Delete user
GET  /api/admin/orders      All orders
GET  /api/debug/config      ⚠️  No auth — exposes secret key
GET  /api/debug/users       ⚠️  No auth — exposes all passwords
GET  /api/debug/orders      ⚠️  No auth — exposes all orders
```

Interactive API docs: `http://localhost:8000/docs`

---

## Project Structure

```
vulnshop/
├── backend/
│   ├── main.py              ← FastAPI app (all vulnerabilities here)
│   ├── requirements.txt
│   └── shop.db              ← auto-created on first run
├── frontend/
│   ├── src/
│   │   ├── App.jsx          ← routing, auth context
│   │   ├── api.js           ← axios client
│   │   └── components/
│   │       ├── Login.jsx
│   │       ├── Register.jsx
│   │       ├── Products.jsx ← search (SQLi) + cart (payment bypass)
│   │       ├── Orders.jsx   ← IDOR probe panel
│   │       ├── Profile.jsx  ← mass assignment demo
│   │       └── AdminPanel.jsx ← JWT forgery target
│   ├── vite.config.js
│   └── package.json
├── VULNERABILITIES.md       ← Full pentest guide with PoC
└── README.md
```

---

> **Disclaimer:** This application is intentionally insecure. Only run it on your local machine or an isolated network. Never deploy to the public internet.
