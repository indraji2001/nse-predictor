# NSE Predictor — Cloud Deployment Guide (Turso + Vercel)

This guide walks you through deploying the app to the cloud so you (and only you, if you keep the link private) can access it from anywhere, 24/7, even when your computer is off.

**Time required:** ~15 minutes.
**Total cost:** $0 (both Turso and Vercel have free tiers that are plenty for personal use).

---

## Architecture Overview

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│  Your browser (anywhere)        │         │  Vercel (Next.js host)           │
│  https://nse-predictor.vercel.app│◀──────▶│  - Static + serverless functions │
└─────────────────────────────────┘         │  - Auto-deploys from GitHub      │
                                            │  - Free Hobby tier               │
                                            └──────────────┬───────────────────┘
                                                           │
                                          HTTPS (libSQL   │
                                          wire protocol)  │
                                                           ▼
                                            ┌──────────────────────────────────┐
                                            │  Turso (libSQL database)         │
                                            │  - Stores paper trades           │
                                            │  - Stores Upstox tokens          │
                                            │  - Free 9 GB, 1B reads/month     │
                                            └──────────────────────────────────┘
```

**Why this stack?**
- Vercel is the official Next.js host — zero-config deployment, automatic HTTPS, GitHub push-to-deploy.
- Turso is a hosted SQLite (libSQL) service — your existing Prisma schema works as-is, no SQL dialect migration needed.
- Both have generous free tiers and work fine for a single-user personal app.

---

## Step 1 — Push the updated code to GitHub

You should have received an updated `nse-predictor-deploy.zip` from your assistant. Extract it on top of your existing local `nse-predictor` folder, then push to GitHub:

**Option A — Use `push-to-github.bat` (Windows)**

1. Make sure the extracted files replaced the old ones in your project folder.
2. Double-click `push-to-github.bat` on your Desktop.
3. It will commit and push the changes.

**Option B — Manual git commands**

```bash
cd nse-predictor
git add .
git commit -m "Migrate to Turso + Vercel-ready config"
git push origin main
```

**What changed in this version:**
- `prisma/schema.prisma` — added missing `UpstoxConfig` and `UpstoxInstrument` models.
- `src/lib/db.ts` — now auto-detects Turso vs SQLite at runtime.
- `src/lib/stocks/nse-bhavcopy.ts` — gracefully degrades on Vercel's read-only filesystem (the bhavcopy archive is a local-only feature).
- `package.json` — build script no longer references `.next/standalone` (which Vercel doesn't use).
- `next.config.ts` — removed `output: "standalone"` (Vercel uses its own build pipeline).
- `vercel.json` — added with explicit `maxDuration` for each API route.
- `.env.example` — now documents both local SQLite and Turso modes.

---

## Step 2 — Create a Turso database (free)

Turso is the cloud database that will store your paper trades and Upstox tokens.

1. **Sign up** at [https://turso.tech](https://turso.tech) — click **Sign Up** and use the GitHub button for the fastest path. No credit card needed.

2. **Install the Turso CLI** (one-time setup). Open a terminal and run:
   ```bash
   # macOS / Linux
   curl -sSfL https://get.tur.so/install.sh | bash

   # Windows (PowerShell)
   iwr https://get.tur.so/install.ps1 -useb | iex
   ```
   If you prefer not to install anything, you can do everything from the Turso web dashboard — see the "Web-only alternative" note at the end of this section.

3. **Log in**:
   ```bash
   turso auth login
   ```
   This opens a browser window to authorize the CLI.

4. **Create your database**:
   ```bash
   turso db create nse-predictor
   ```
   Takes about 5 seconds. You'll see output like:
   ```
   Created database nse-predictor at group default in 4.2s.
   ```

5. **Get your database URL**:
   ```bash
   turso db show nse-predictor --url
   ```
   Copy the output — it looks like `libsql://nse-predictor-<your-org>.turso.io`. Save it somewhere.

6. **Create an auth token** (this is the password your app will use):
   ```bash
   turso db tokens create nse-predictor
   ```
   Copy the long string — it starts with `eyJ...`. **Treat this like a password — never commit it to git.**

7. **Initialize the schema** — run this to create all the tables (PaperTrade, UpstoxConfig, etc.):
   ```bash
   # From your project root, with DATABASE_URL set to the Turso URL:
   # On macOS/Linux:
   export DATABASE_URL="libsql://nse-predictor-<your-org>.turso.io"
   export TURSO_AUTH_TOKEN="<your-token>"
   npx prisma db push

   # On Windows PowerShell:
   $env:DATABASE_URL="libsql://nse-predictor-<your-org>.turso.io"
   $env:TURSO_AUTH_TOKEN="<your-token>"
   npx prisma db push
   ```
   You should see `Your database is now in sync with your Prisma schema.`

> **Web-only alternative (no CLI):**
> 1. After signing up at turso.tech, click **New Database** → name it `nse-predictor` → Create.
> 2. Click the database name → **Settings** → copy the **URL** and generate a **Token**.
> 3. For schema setup, use the Turso web shell: open your database → **Edit** → paste the SQL from `prisma/migrations/init.sql` (you can generate this with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`).

---

## Step 3 — Deploy to Vercel (free)

1. **Go to** [https://vercel.com](https://vercel.com) and click **Sign Up** → **Continue with GitHub**.

2. Authorize Vercel to access your GitHub account (you can choose "Only select repositories" → pick `nse-predictor`).

3. Once logged in, click **Add New...** → **Project**.

4. Under "Import Git Repository", find your `nse-predictor` repo and click **Import**.

5. **Configure the project** (Vercel auto-detects Next.js, but you need to set env vars):
   - **Framework Preset**: Next.js (auto-detected, leave it)
   - **Root Directory**: `./` (default)
   - **Build Command**: leave as `npm run build` (or just leave it auto)
   - **Install Command**: leave as `npm install` (or auto)
   - Click **Environment Variables** and add these two:
     - **Key**: `DATABASE_URL`  
       **Value**: `libsql://nse-predictor-<your-org>.turso.io`  
       **Environments**: check Production, Preview, and Development
     - **Key**: `TURSO_AUTH_TOKEN`  
       **Value**: `eyJ...` (your token from step 2.6)  
       **Environments**: check Production, Preview, and Development

6. Click **Deploy**.

7. **Wait ~2–3 minutes.** Vercel will install dependencies, run `prisma generate`, build the Next.js app, and deploy. You'll see live build logs.

8. When it's done, you'll see a big **Congratulations** page with your live URL:  
   `https://nse-predictor.vercel.app` (or similar — the subdomain is based on your GitHub username).  
   Click **Visit** to open your app.

9. **Test it**: 
   - Open the BTST tab — you should see signal cards load (using Yahoo Finance data).
   - Click **Track** on a signal → go to **Trades** tab → verify the trade was saved.
   - Refresh the page → the trade should still be there (this proves the Turso DB is working).

---

## Step 4 — (Optional) Configure Upstox for live intraday data

The app works out-of-the-box with Yahoo Finance (free, 15-min delayed). For real-time intraday data, connect Upstox:

1. Sign up for a free Upstox developer account at [https://upstox.com/developer/](https://upstox.com/developer/).
2. Create an app — you'll get an **API Key** and **API Secret**.
3. Set the **Redirect URI** to: `https://nse-predictor.vercel.app/api/upstox/callback` (replace with your actual Vercel URL).
4. In your deployed app, click the **Settings** (gear) icon → enter the API Key, API Secret, and Redirect URI → Save.
5. Click **Connect Upstox** → log in with your Upstox account → you'll be redirected back.
6. Done — the app will now use Upstox for live intraday candles.

---

## Step 5 — Keep the app updated

Every time you push code to your GitHub repo's `main` branch, Vercel automatically rebuilds and deploys. You'll see a new "deployment" entry in your Vercel dashboard each time. If a build fails, Vercel keeps the previous working version live — so you never have downtime from a bad push.

To check deploy status: [https://vercel.com/dashboard](https://vercel.com/dashboard) → click your project → **Deployments** tab.

---

## Important limitations on Vercel free tier

| Limit | Free tier (Hobby) | Affects you? |
|-------|-------------------|--------------|
| Function duration | 60 seconds max | Yes — the `predict` route fetches data for 512 stocks. It usually completes in ~5s, but on slow days it might hit 60s. If you see 504 errors, upgrade to Pro ($20/mo, 300s limit). |
| Bandwidth | 100 GB/month | No — personal use is well under 1 GB. |
| Build time | 45 minutes | No — your build is ~3 min. |
| Function invocations | 100,000/month | No — even at 100 page views/day you'd use 3,000/month. |
| Filesystem | Read-only (except `/tmp`) | Yes — that's why the bhavcopy archive feature is disabled on Vercel. Run locally if you need it. |

---

## Cost summary

| Service | Free tier | Your likely usage |
|---------|-----------|-------------------|
| Vercel Hobby | $0 | <1% of free limits |
| Turso | 9 GB storage, 1B reads/month, 25M writes/month | <0.1% of free limits |
| GitHub | Unlimited private repos | ✓ |
| **Total** | **$0/month** | |

If you ever outgrow the free tiers (very unlikely for a personal app), Turso's paid plan starts at $29/mo and Vercel Pro is $20/mo.

---

## Troubleshooting

### Build fails on Vercel with "Prisma can't reach database"
You forgot to set the `DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables in the Vercel project settings. Add them (Step 3.5 above), then trigger a redeploy: Vercel dashboard → Deployments → click the latest → **Redeploy**.

### App loads but "Track trade" returns 500 error
Check the Vercel function logs: Dashboard → your project → **Logs** tab. Most likely the Prisma schema isn't synced to Turso — re-run `npx prisma db push` locally with the Turso env vars set (Step 2.7).

### Yahoo Finance data not loading
Yahoo occasionally rate-limits cloud IPs. The app has built-in caching and fallbacks — wait 5 minutes and refresh. If it persists, consider connecting Upstox (Step 4) which has higher rate limits.

### Upstox OAuth returns "redirect_uri mismatch"
The Redirect URI in your Upstox developer console must EXACTLY match `https://<your-vercel-subdomain>.vercel.app/api/upstox/callback` — including `https://` and no trailing slash. Update it in the Upstox developer console and in the app's Settings dialog.

### How do I get a custom domain like `nse.indraji.com`?
1. Buy a domain from any registrar (Namecheap, GoDaddy, etc.) — ~$10/year.
2. In Vercel: Project → **Settings** → **Domains** → add your domain.
3. Follow Vercel's instructions to add the DNS records at your registrar.
4. Vercel auto-renews SSL certificates.

### I want to reset the database (delete all paper trades)
```bash
turso db shell nse-predictor
# In the shell:
DELETE FROM PaperTrade;
DELETE FROM UpstoxInstrument;
DELETE FROM UpstoxConfig;
.quit
```
Or just drop and recreate the whole DB:
```bash
turso db destroy nse-predictor
turso db create nse-predictor
# Then re-run prisma db push from Step 2.7
```

---

## Quick reference — env vars

| Variable | Where to set | Example value |
|----------|--------------|---------------|
| `DATABASE_URL` | Local `.env` + Vercel project settings | `libsql://nse-predictor-yourorg.turso.io` (or `file:./db/custom.db` for local dev) |
| `TURSO_AUTH_TOKEN` | Local `.env` + Vercel project settings | `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...` |

That's it — no other env vars are needed for the basic deployment.

---

## What's intentionally NOT working on Vercel

1. **NSE bhavcopy archive** — requires writing CSV files to disk. Vercel's filesystem is read-only. The app gracefully falls back to Yahoo Finance. To use this feature, run the app locally with `npm run dev`.

2. **Bhavcopy backfill** (`/api/bhavcopy/backfill`) — same reason. The endpoint returns a clear error message on Vercel.

3. **Intraday live scanning** (`/api/intraday-scan`) — works on Vercel but depends on Yahoo Finance's intraday API, which is rate-limited and occasionally blocked from cloud IPs. For reliable intraday, connect Upstox.

Everything else — the 4 EOD timeframe predictions, paper trade tracking, P&L updates, and the dashboard UI — works fully on Vercel.

# Trigger deployment
