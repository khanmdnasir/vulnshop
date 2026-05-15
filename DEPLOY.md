# VulnShop — Deployment Guide (Railway + Vercel)

> ⚠️ **Read this first.** VulnShop is **deliberately vulnerable**. A public deploy
> exposes plaintext passwords, an IDOR, a forgeable JWT, an SQLi, and more — to
> anyone on the Internet. Deploy only for as long as you need to grade or demo,
> add the basic-auth wrapper below if your faculty allows it, then delete the
> services. Do not put the public URL on GitHub, social media, or your CV.

This guide assumes:

- You have a GitHub account.
- You'll create free Railway and Vercel accounts (each has free tiers sufficient for this lab).
- Your local repo already includes the changes documented below (`Procfile`,
  `railway.json`, `vercel.json`, env-driven `api.js`, etc.).

---

## 0. Push the project to GitHub

From the workspace root (the folder that contains `vulnshop/`):

```bash
cd vulnshop
git init
git add .
git commit -m "Initial VulnShop commit — deploy-ready"
git branch -M main
# Create a NEW repo on GitHub — call it vulnshop or similar, mark it private
git remote add origin git@github.com:<your-username>/vulnshop.git
git push -u origin main
```

The repo's `.gitignore` already excludes `venv/`, `node_modules/`, `.env`, and
`*.db`. Confirm with `git status` that none of those slipped through.

---

## 1. Deploy the backend to Railway

### 1.1 Create the service

1. Open [railway.com](https://railway.com) → sign in with GitHub.
2. Click **New Project → Deploy from GitHub repo** → pick the `vulnshop` repo.
3. Railway will scan the repo. When it asks for a **Root Directory**, set it to:
   ```
   backend
   ```
   This makes Railway treat `vulnshop/backend/` as the deployable unit; `Procfile`,
   `requirements.txt`, and `railway.json` all live there.
4. The first deploy will start automatically. The build uses Nixpacks → it sees
   `requirements.txt` and installs Python 3.12 + the listed packages. The start
   command from `Procfile` is `uvicorn main:app --host 0.0.0.0 --port $PORT`.

### 1.2 Environment variables

In the Railway service → **Variables** tab, add:

| Key            | Value                                        | Why |
|----------------|----------------------------------------------|-----|
| `JWT_SECRET`   | `secret`                                     | Keeps the weak-key A04 exploit demonstrable. Change to a 64-char hex string ONLY if you want the "fixed" version of the deploy. |
| `CORS_ORIGINS` | `https://<your-vercel-app>.vercel.app`       | Set after the Vercel URL is known (see step 2). Use `*` until then. |
| `DB_PATH`      | `shop.db`                                    | Optional. SQLite ephemeral by default. |

You don't need to set `PORT` — Railway injects it automatically.

### 1.3 Expose the service

1. Service → **Settings** → **Networking** → **Generate Domain**.
2. Railway gives you e.g. `https://vulnshop-backend-production-XXXX.up.railway.app`.
3. Copy that URL — Vercel needs it.

### 1.4 Smoke-test

```bash
curl -s https://vulnshop-backend-production-XXXX.up.railway.app/api/products | head -c 300
```

You should see a JSON array starting with `[{"id":1,"name":"Laptop",...}`. If
you see HTML or a 500, check the Railway **Deploy Logs** — usually a missing
`requirements.txt` entry or a wrong root directory.

The Swagger UI at `https://.../docs` should also load. Both confirm the
backend is up.

---

## 2. Deploy the frontend to Vercel

### 2.1 Create the project

1. Open [vercel.com](https://vercel.com) → sign in with GitHub.
2. **Add New → Project** → pick the `vulnshop` repo.
3. On the configuration screen:
   - **Framework Preset**: `Vite` (Vercel usually auto-detects this).
   - **Root Directory**: `frontend` (click "Edit" next to Root Directory and choose `frontend`).
   - **Build Command**: leave as default (`npm run build`) — also encoded in `vercel.json`.
   - **Output Directory**: `dist` (also in `vercel.json`).

### 2.2 Environment variable

Before clicking Deploy, expand **Environment Variables** and add:

| Name            | Value                                                    |
|-----------------|----------------------------------------------------------|
| `VITE_API_URL`  | `https://vulnshop-backend-production-XXXX.up.railway.app` |

(No trailing slash, no `/api`. The SPA appends `/api/...` at request time.)

Click **Deploy**. Build takes ~60 seconds. When complete, Vercel gives you a URL
like `https://vulnshop-frontend.vercel.app` (and a preview URL per-deploy).

### 2.3 Wire CORS back to the backend

Now that you know the Vercel URL:

1. Go back to Railway → backend service → **Variables**.
2. Change `CORS_ORIGINS` from `*` to your exact Vercel URL (no trailing slash).
3. Railway redeploys automatically. Takes ~30 seconds.

For pentest demos you can also keep `CORS_ORIGINS=*` — that preserves the A02
permissive-CORS finding. Pick whichever framing serves your report better.

### 2.4 Smoke-test

Visit `https://vulnshop-frontend.vercel.app` in a normal browser. You should see:

- The dark-red "⚠️ TRAINING LAB" banner across the top.
- The VulnShop login page.

Log in with `alice` / `alice123`. The products page should appear and the
network tab should show requests going to the Railway URL.

---

## 3. Optional — Lock the deploy down

VulnShop on a public URL is a piñata. At least one of these is strongly recommended:

### 3.1 Vercel password protection (one-click, paid plans only)

Vercel Pro can add a password gate to any deployment in **Project Settings →
Deployment Protection → Vercel Authentication**. Free tier doesn't have this.

### 3.2 Cloudflare in front (free)

If you point a Cloudflare-managed domain at Vercel, you can add **Cloudflare
Access** with a one-time-email login gate. The lab demo URL becomes invisible
to passing scanners.

### 3.3 Railway private networking (free, easy)

In Railway → service → **Settings** → **Networking** you can switch from a
public domain to **Private Networking only**, then access the backend exclusively
from another Railway service. The frontend on Vercel won't be able to reach it
though — this is more for "backend-only" demos.

### 3.4 IP allow-list (most lab-friendly)

Add a small middleware in `main.py` that reads `ALLOWED_IPS` from env and rejects
anything else. Tell faculty the IP they need to send from. Three-line patch
if you want it — ask and I'll add it.

### 3.5 Tear down when done

The cleanest "lock-down" is to delete the services. Both Railway and Vercel
let you delete a project in one click. Re-deploy is a `git push` away when
you need it for the next demo.

---

## 4. Run the pentest against the deployed instance

Once both services are up, you can repeat your local demo against the public
URLs by swapping the host in Burp Repeater:

- Replace `http://127.0.0.1:8000` with `https://vulnshop-backend-...up.railway.app`
- Burp Proxy on `127.0.0.1:8080` still works (it doesn't care that the upstream
  is now HTTPS — Burp handles the TLS hop).

A useful sanity check before screenshots:

```bash
HOST=https://vulnshop-backend-...up.railway.app
TOKEN=$(curl -s -X POST $HOST/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"alice123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s $HOST/api/orders/1 -H "Authorization: Bearer $TOKEN" | head -c 200
```

If you see admin's order in the response, the IDOR works end-to-end against the
public deploy. Every other exploit in the report works the same way — just
swap the host.

---

## 5. Troubleshooting

### "Application failed to respond" on Railway

The backend bound to the wrong host. Check `Procfile` says
`--host 0.0.0.0` (not `127.0.0.1`). Railway only routes to processes on `0.0.0.0`.

### CORS error in the browser console

The Vercel domain isn't in `CORS_ORIGINS`. Either set it correctly in Railway
Variables or temporarily set it to `*` and redeploy.

### Vercel build fails with "Cannot find module 'rollup/native'"

A Vite/Rollup quirk on the build agent. Bump `rollup` in `package.json` or
just retry the deploy — usually a transient cache issue.

### Login works but the products page is blank

Almost always a wrong `VITE_API_URL`. Open DevTools → Network. If you see
404s to a `/api/...` path on the *Vercel* domain (not the Railway domain),
`VITE_API_URL` wasn't picked up at build time. Redeploy from the Vercel
dashboard with the variable correctly set.

### Burp shows ERR_TUNNEL_CONNECTION_FAILED when hitting the Railway URL

Burp's proxy is missing TLS-CA trust for Railway's cert. Visit `http://burp`
in Burp's browser → download and install the CA. Standard Burp setup.

---

## 6. Local development still works

The deploy doesn't break the local workflow. With both `.env` files unset:

- `npm run dev` in `vulnshop/frontend` → reads no `VITE_API_URL` → falls back to
  `/api` → Vite proxies to `127.0.0.1:8000` (your local FastAPI).
- `python main.py` in `vulnshop/backend` → reads no `HOST` → defaults to
  `127.0.0.1:8000`.

Burp can still proxy `localhost:3000` as before. Local and cloud workflows
coexist; the cloud setup is purely additive.
