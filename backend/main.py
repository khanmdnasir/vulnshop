"""
VulnShop Backend — Intentionally Vulnerable FastAPI Application
FOR EDUCATIONAL / PENETRATION TESTING PRACTICE ONLY.

Vulnerabilities present (OWASP Top 10 **2025**):
  [A01:2025] Broken Access Control      — IDOR on /api/orders/{id}, JWT privilege escalation,
                                          mass assignment on /api/profile (balance field)
  [A02:2025] Security Misconfiguration  — unauthenticated /api/debug/* endpoints, permissive CORS,
                                          debug=True in production, default credentials
  [A04:2025] Cryptographic Failures     — plaintext password storage, weak JWT secret ("secret"),
                                          no token rotation
  [A05:2025] Injection                  — SQL injection on /api/products?search= (UNION-based)
  [A06:2025] Insecure Design            — client-supplied price trusted for payment (payment bypass)
  [A09:2025] Security Logging & Alerting Failures — zero security events logged (no audit trail)
  [A10:2025] Mishandling of Exceptional Conditions — raw stack traces returned to client in 500s
"""

import sqlite3
import traceback
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# App bootstrap
# ---------------------------------------------------------------------------

# [A02:2025] debug=True leaks internal error details in production
app = FastAPI(
    title="VulnShop API",
    debug=True,
    version="1.0.0-dev",
)

# [A02:2025] CORS wildcard + credentials — any origin can make credentialed requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [A04:2025] Weak, hard-coded JWT secret — trivially brute-forceable with hashcat/rockyou
SECRET_KEY = "secret"
ALGORITHM = "HS256"

DB_PATH = "shop.db"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT    UNIQUE NOT NULL,
            password TEXT    NOT NULL,
            email    TEXT,
            is_admin INTEGER DEFAULT 0,
            balance  REAL    DEFAULT 1000.0
        );

        CREATE TABLE IF NOT EXISTS products (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            description TEXT,
            price       REAL NOT NULL,
            stock       INTEGER DEFAULT 100
        );

        CREATE TABLE IF NOT EXISTS orders (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER,
            product_id  INTEGER,
            quantity    INTEGER,
            total_price REAL,
            status      TEXT DEFAULT 'pending',
            created_at  TEXT
        );

        -- Default accounts (known credentials for practice).
        -- Enlarged dataset so Burp Intruder enumeration produces realistic results.
        INSERT OR IGNORE INTO users (id, username, password, email, is_admin, balance) VALUES
            (1, 'admin',     'admin123',   'admin@vulnshop.com',     1, 99999),
            (2, 'alice',     'alice123',   'alice@example.com',      0, 1000),
            (3, 'bob',       'bob123',     'bob@example.com',        0,  500),
            (4, 'carol',     'sunshine',   'carol@example.com',      0,  750),
            (5, 'david',     'P@ssw0rd!',  'david@example.com',      0, 1200),
            (6, 'emma',      'qwerty1',    'emma@example.com',       0,  300),
            (7, 'frank',     'letmein',    'frank@example.com',      0,  900),
            (8, 'grace',     'monkey99',   'grace@example.com',      0,  450),
            (9, 'henry',     'iloveyou',   'henry@example.com',      0,  650),
            (10,'isabel',    'dragon7',    'isabel@example.com',     0,  820);

        INSERT OR IGNORE INTO products (id, name, description, price, stock) VALUES
            (1, 'Laptop',      'High-end gaming laptop',                1299.99, 10),
            (2, 'Smartphone',  'Latest flagship phone',                  899.99, 25),
            (3, 'Headphones',  'Noise-cancelling wireless headphones',   299.99, 50),
            (4, 'Keyboard',    'Mechanical gaming keyboard',             149.99,100),
            (5, 'Mouse',       'Wireless precision gaming mouse',         79.99,150);

        -- Pre-existing orders so IDOR is immediately exploitable.
        -- Spread across all 10 users so Burp Intruder shows real fan-out.
        INSERT OR IGNORE INTO orders (id, user_id, product_id, quantity, total_price, status, created_at) VALUES
            (1, 1, 1, 1, 1299.99, 'completed', '2026-01-10T10:00:00'),
            (2, 2, 2, 1,  899.99, 'completed', '2026-01-11T11:00:00'),
            (3, 3, 3, 2,  599.98, 'completed', '2026-01-12T12:00:00'),
            (4, 4, 4, 1,  149.99, 'completed', '2026-01-13T09:30:00'),
            (5, 5, 5, 3,  239.97, 'completed', '2026-01-14T14:15:00'),
            (6, 1, 2, 1,  899.99, 'completed', '2026-01-15T08:00:00'),
            (7, 2, 3, 1,  299.99, 'completed', '2026-01-16T16:45:00'),
            (8, 6, 1, 1, 1299.99, 'completed', '2026-01-17T11:20:00'),
            (9, 7, 4, 2,  299.98, 'completed', '2026-01-18T13:10:00'),
            (10,8, 5, 1,   79.99, 'completed', '2026-01-19T10:05:00'),
            (11,9, 2, 1,  899.99, 'completed', '2026-01-20T15:30:00'),
            (12,10,3, 1,  299.99, 'completed', '2026-01-21T17:00:00'),
            (13,3, 4, 1,  149.99, 'completed', '2026-01-22T09:00:00'),
            (14,4, 5, 2,  159.98, 'completed', '2026-01-23T12:30:00'),
            (15,5, 1, 1, 1299.99, 'completed', '2026-01-24T14:00:00'),
            (16,1, 3, 2,  599.98, 'completed', '2026-02-01T10:00:00'),
            (17,2, 4, 1,  149.99, 'completed', '2026-02-02T11:00:00'),
            (18,6, 2, 1,  899.99, 'completed', '2026-02-03T13:45:00'),
            (19,7, 5, 1,   79.99, 'completed', '2026-02-04T15:20:00'),
            (20,8, 1, 1, 1299.99, 'completed', '2026-02-05T16:10:00'),
            (21,9, 3, 1,  299.99, 'completed', '2026-02-06T09:15:00'),
            (22,10,4, 2,  299.98, 'completed', '2026-02-07T10:50:00'),
            (23,3, 2, 1,  899.99, 'completed', '2026-02-08T14:30:00'),
            (24,4, 1, 1, 1299.99, 'completed', '2026-02-09T11:25:00'),
            (25,5, 3, 2,  599.98, 'completed', '2026-02-10T17:00:00'),
            (26,6, 4, 1,  149.99, 'pending',   '2026-02-11T09:45:00'),
            (27,7, 1, 1, 1299.99, 'pending',   '2026-02-12T13:20:00'),
            (28,8, 2, 1,  899.99, 'completed', '2026-02-13T15:55:00'),
            (29,9, 4, 1,  149.99, 'completed', '2026-02-14T10:30:00'),
            (30,10,5, 3,  239.97, 'completed', '2026-02-15T12:15:00');
    """)
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str


class OrderRequest(BaseModel):
    product_id: int
    quantity: int
    price: float  # [BONUS] client controls the price — server trusts it blindly


class ProfileUpdateRequest(BaseModel):
    email: Optional[str] = None
    balance: Optional[float] = None  # [A01] user can modify their own balance


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def create_token(user_id: int, username: str, is_admin: bool) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "is_admin": is_admin,  # [A01:2025] role stored in client-controlled JWT claim
        "exp": datetime.utcnow() + timedelta(hours=24),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.replace("Bearer ", "")
        # [A04:2025] weak secret means anyone can forge tokens offline
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception as exc:
        # [A10:2025] leaks JWT library internals to the client
        raise HTTPException(status_code=401, detail=str(exc))


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/register")
def register(data: RegisterRequest):
    conn = get_db()
    try:
        # [A04:2025] password stored in plaintext — no hashing at all
        # [A09:2025] registration event not logged anywhere
        conn.execute(
            "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
            (data.username, data.password, data.email),
        )
        conn.commit()
        return {"message": "Registered successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")
    except Exception:
        # [A10:2025] full Python stack trace returned to client
        raise HTTPException(status_code=500, detail=traceback.format_exc())
    finally:
        conn.close()


@app.post("/api/auth/login")
def login(data: LoginRequest):
    conn = get_db()
    try:
        # [A04:2025] plain-text password comparison (no bcrypt/argon2)
        # [A09:2025] failed login attempts not logged — brute-force goes undetected
        user = conn.execute(
            "SELECT * FROM users WHERE username = ? AND password = ?",
            (data.username, data.password),
        ).fetchone()

        if not user:
            # [A09:2025] no alert fired for repeated failed logins
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = create_token(user["id"], user["username"], bool(user["is_admin"]))
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "is_admin": bool(user["is_admin"]),
                "balance": user["balance"],
            },
        }
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Products — SQL Injection
# ---------------------------------------------------------------------------

@app.get("/api/products")
def list_products(search: Optional[str] = None):
    conn = get_db()
    try:
        if search:
            # [A05:2025] SQL INJECTION — raw string interpolation, no parameterisation
            # PoC: ?search=' UNION SELECT id,username,password,email,is_admin FROM users--
            # [A09:2025] injection attempt not logged or alerted
            query = (
                f"SELECT * FROM products "
                f"WHERE name LIKE '%{search}%' OR description LIKE '%{search}%'"
            )
            products = conn.execute(query).fetchall()
        else:
            products = conn.execute("SELECT * FROM products").fetchall()

        return [dict(p) for p in products]
    except Exception as exc:
        # [A10:2025] raw SQL error message reveals schema/table details to client
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


@app.get("/api/products/{product_id}")
def get_product(product_id: int):
    conn = get_db()
    try:
        product = conn.execute(
            "SELECT * FROM products WHERE id = ?", (product_id,)
        ).fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return dict(product)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Orders — IDOR + Payment Bypass
# ---------------------------------------------------------------------------

@app.post("/api/orders")
def create_order(data: OrderRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        product = conn.execute(
            "SELECT * FROM products WHERE id = ?", (data.product_id,)
        ).fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # [A06:2025] INSECURE DESIGN / PAYMENT BYPASS — the system was designed to
        # trust the client for price, a fundamental design flaw.
        # Attacker sends {"price": 0.01} to buy a $1299.99 laptop for 1 cent.
        # [A09:2025] price manipulation not logged or alerted
        total_price = data.price * data.quantity

        user_row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user["user_id"],)
        ).fetchone()

        if user_row["balance"] < total_price:
            raise HTTPException(status_code=400, detail="Insufficient balance")

        cursor = conn.execute(
            """INSERT INTO orders (user_id, product_id, quantity, total_price, status, created_at)
               VALUES (?, ?, ?, ?, 'completed', ?)""",
            (user["user_id"], data.product_id, data.quantity, total_price,
             datetime.utcnow().isoformat()),
        )
        conn.execute(
            "UPDATE users SET balance = balance - ? WHERE id = ?",
            (total_price, user["user_id"]),
        )
        conn.commit()

        return {
            "order_id": cursor.lastrowid,
            "product": product["name"],
            "quantity": data.quantity,
            "total_price": total_price,
            "status": "completed",
        }
    finally:
        conn.close()


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        # [A01:2025] IDOR — no check that order belongs to the requesting user.
        # Any authenticated user can view any order by guessing/enumerating the ID.
        # [A09:2025] unauthorized access attempt not logged or alerted
        order = conn.execute(
            "SELECT * FROM orders WHERE id = ?", (order_id,)
        ).fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # FIX WOULD BE: if order["user_id"] != user["user_id"]: raise HTTPException(403)
        return dict(order)
    finally:
        conn.close()


@app.get("/api/orders")
def get_my_orders(user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        orders = conn.execute(
            "SELECT * FROM orders WHERE user_id = ?", (user["user_id"],)
        ).fetchall()
        return [dict(o) for o in orders]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Profile — Mass Assignment / Balance Tampering
# ---------------------------------------------------------------------------

@app.put("/api/profile")
def update_profile(data: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        # [A01:2025] Mass assignment — user can set their own balance to any value
        if data.balance is not None:
            conn.execute(
                "UPDATE users SET balance = ? WHERE id = ?",
                (data.balance, user["user_id"]),
            )
        if data.email is not None:
            conn.execute(
                "UPDATE users SET email = ? WHERE id = ?",
                (data.email, user["user_id"]),
            )
        conn.commit()
        updated = conn.execute(
            "SELECT id, username, email, balance FROM users WHERE id = ?",
            (user["user_id"],),
        ).fetchone()
        return dict(updated)
    finally:
        conn.close()


@app.get("/api/profile")
def get_profile(user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, username, email, is_admin, balance FROM users WHERE id = ?",
            (user["user_id"],),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Admin — Broken Access Control (JWT claim forgery)
# ---------------------------------------------------------------------------

@app.get("/api/admin/users")
def admin_list_users(user: dict = Depends(get_current_user)):
    # [A01:2025] Only checks the JWT claim — attacker forges is_admin=true with weak secret.
    # No server-side role lookup against the database.
    # [A09:2025] unauthorized admin access attempt not logged
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    conn = get_db()
    try:
        # Returns passwords in plaintext because they're stored that way [A04:2025]
        users = conn.execute("SELECT * FROM users").fetchall()
        return [dict(u) for u in users]
    finally:
        conn.close()


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, user: dict = Depends(get_current_user)):
    # [A01:2025] Same JWT-claim-only check — no DB role verification
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    conn = get_db()
    try:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        return {"message": f"User {user_id} deleted"}
    finally:
        conn.close()


@app.get("/api/admin/orders")
def admin_list_orders(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM orders").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# [A02:2025] Security Misconfiguration — debug endpoints with NO AUTH REQUIRED
# ---------------------------------------------------------------------------

@app.get("/api/debug/config")
def debug_config():
    """[A02:2025] Exposes secret key, DB path, admin password — classic misconfiguration."""
    return {
        "secret_key": SECRET_KEY,
        "algorithm": ALGORITHM,
        "database": DB_PATH,
        "debug_mode": True,
        "admin_default_password": "admin123",
        "version": "1.0.0-dev",
        "environment": "production",  # lying about environment
    }


@app.get("/api/debug/users")
def debug_all_users():
    """[A02:2025] Returns ALL users including plaintext passwords — no auth required."""
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM users").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.get("/api/debug/orders")
def debug_all_orders():
    """[A02:2025] Returns ALL orders — no auth required."""
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM orders").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# [A09:2025] Security Logging & Alerting Failures
# The endpoint below exists to prove there are NO security logs anywhere.
# Real events that should be logged but aren't:
#   - Failed login attempts (brute-force)
#   - IDOR access (user X reading user Y's order)
#   - Admin endpoint access
#   - SQL errors in search (injection attempts)
#   - Price manipulation in orders
# ---------------------------------------------------------------------------

@app.get("/api/logs")
def get_security_logs(user: dict = Depends(get_current_user)):
    """[A09:2025] Returns empty — no security events are ever recorded."""
    return {
        "message": "No security logging is implemented in this application.",
        "events": [],
        "note": (
            "Failed logins, IDOR attempts, admin access, and injection payloads "
            "all go completely undetected and unrecorded."
        ),
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def startup():
    init_db()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
