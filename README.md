# NSE Stock Buy/Sell Predictor

A professional NSE stock prediction web app with 512 stocks scanned across 4 EOD timeframes (BTST, Short-term, Mid-term, Long-term) plus an Intraday mode. Each signal shows Entry, Stop Loss, T1/T2/T3 targets, holding period, confidence score, and all triggered factors. Includes paper trade tracking with SQLite persistence.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Prisma ORM + SQLite
- **Charts**: Recharts
- **Data**: Yahoo Finance (free, no API key required)

## Quick Start (Local)

### Prerequisites

- **Node.js 18+** — Download from https://nodejs.org/

### Windows

1. Download this project as a ZIP from GitHub and extract it
2. Double-click `start-windows.bat`
3. First run takes 2-3 minutes (installs dependencies + sets up database)
4. Browser opens automatically at `http://localhost:3000`

### Mac / Linux

1. Download and extract the ZIP
2. Open Terminal in the project folder
3. Run: `./start-unix.sh`
4. Browser opens at `http://localhost:3000`

## GitHub Setup (First Time)

### Step 1 — Create a GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `nse-predictor`
3. **Description**: `NSE Stock Buy/Sell Predictor`
4. **Visibility**: Private (recommended) or Public
5. **DO NOT** check "Add a README" or "Add .gitignore" (we have our own)
6. Click **Create repository**
7. GitHub will show you a page with a URL like `https://github.com/USERNAME/nse-predictor.git` — copy this URL

### Step 2 — Save the Project Files Locally

1. Download this entire folder to your computer (e.g., to `Desktop/nse-predictor`)
2. Make sure the folder contains: `package.json`, `src/`, `prisma/`, `.gitignore`, etc.

### Step 3 — Initial Upload to GitHub

**Option A — Use the Desktop Batch File (Windows, recommended)**

1. Move the file `push-to-github.bat` (from the `desktop-tools` folder) to your Desktop
2. Right-click → Edit (or open in Notepad)
3. Find the line `set REPO_URL=` and paste your GitHub URL between the quotes
   - Example: `set REPO_URL=https://github.com/johndoe/nse-predictor.git`
4. Save the file
5. Double-click `push-to-github.bat`
6. The first time, it will:
   - Ask you to install Git if not already installed
   - Initialize git in the project folder
   - Configure your GitHub username/email
   - Upload all files to GitHub
7. You'll be prompted for your GitHub username and Personal Access Token (see below)

**Option B — Manual Upload via GitHub Web**

1. Go to your empty GitHub repository
2. Click **uploading an existing file**
3. Drag ALL files from the project folder (except `node_modules/` and `.next/`)
4. Commit with message: "Initial commit"
5. Click **Commit changes**

### Step 4 — Get a Personal Access Token (PAT)

GitHub no longer accepts passwords for git push. You need a PAT:

1. Go to https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. **Note**: `NSE Predictor Upload`
4. **Expiration**: 90 days (or No expiration for convenience)
5. **Scopes**: Check `repo` (full repository access)
6. Click **Generate token**
7. **COPY THE TOKEN NOW** — you won't see it again
8. Save it somewhere safe (e.g., a password manager)

When the batch file asks for your password, paste this token instead of your GitHub password.

## Updating the Project After Modifications

When you ask the assistant (me) to modify the app:

1. You'll receive an updated ZIP or set of files
2. Extract/replace the files in your local `nse-predictor` folder
3. Double-click `push-to-github.bat` on your Desktop
4. The script will automatically:
   - Detect the changes
   - Commit them with a timestamped message
   - Push to GitHub
5. Refresh your GitHub repo page to see the changes

## Deploying to Cloud (Optional)

If you want a permanent URL (not localhost):

### Vercel (Free, Recommended)

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New Project**
3. Import your `nse-predictor` repository
4. Vercel auto-detects Next.js — leave all settings default
5. Click **Deploy**
6. After ~2 minutes, you'll get a permanent URL like `https://nse-predictor.vercel.app`
7. Every time you push to GitHub, Vercel auto-deploys the update

**Note**: Vercel uses ephemeral filesystem — SQLite data won't persist in production. For production use, switch to a hosted Postgres (Vercel Postgres, Neon, Supabase) by updating `prisma/schema.prisma` (change `sqlite` to `postgresql`) and `DATABASE_URL` in Vercel env vars.

## Features

### 6 Dashboard Tabs

1. **Intraday** — Live 5-min candle signals during market hours
2. **BTST** — Buy Today Sell Tomorrow (1-2 sessions), 8 factors, confidence ≥ 80
3. **Short-term** — 5-15 trading days, 9 factors, confidence ≥ 75
4. **Midterm** — 1-3 months, 9 factors, confidence ≥ 85
5. **Long-term** — 6-24 months, 10 factors (incl. drawdown, momentum), confidence ≥ 70
6. **Trades** — Paper trade tracking with T1/T2/T3 hit tracking

### Each Signal Card Shows

- Entry price + entry range
- Stop Loss (ATR-based)
- Target 1, 2, 3 (R:R based)
- Holding period (e.g., "6-24 months")
- Confidence score (0-100)
- All triggered factors with details
- Data source badge (NSE / YAHOO / DEMO)
- Data quality badge (LIVE / LIMITED / SYNTHETIC)
- **Track** button — adds to paper trades
- **Analysis** button — opens full chart + factor breakdown

### Data Source Priority Chain

1. **NSE bhavcopy** (local archive) — official NSE EOD
2. **Yahoo Finance** — free EOD + 15-min delayed intraday
3. **Synthetic fallback** — for tickers neither covers

## Daily Routine (8 PM IST)

1. Open the app (double-click `start-windows.bat`)
2. Click **Refresh** button (top-right) — fetches live Yahoo data for 512 stocks (~5 seconds)
3. Review the 5 signal tabs (BTST / Short / Mid / Long / Intraday)
4. Click **Track** on signals you want to paper-trade
5. Go to **Trades** tab → click **Update prices** → see if T1/T2/T3 hit or SL triggered

## Optional: NSE Bhavcopy Archive

1. Click **Archive** button in header
2. Visit https://www.nseindia.com/all-reports
3. Download daily bhavcopy CSV
4. Drag-and-drop into the upload zone
5. After ~30 days of uploads, NSE becomes the primary data source

## Troubleshooting

### Dev server won't start
- Make sure Node.js 18+ is installed: `node --version`
- Delete `node_modules` folder and `package-lock.json`, then re-run `start-windows.bat`
- If port 3000 is in use: edit `package.json`, change `next dev -p 3000` to `next dev -p 3001`

### Git push fails with "Authentication failed"
- Your Personal Access Token may have expired — generate a new one (Step 4 above)
- Make sure you're pasting the TOKEN, not your GitHub password

### Yahoo data not loading
- Wait 5 minutes (rate limit cooldown)
- The app caches for 4 hours, refreshes within that window are instant

## Project Structure

```
nse-predictor/
├── package.json              # Dependencies + scripts
├── .env.example              # Environment template
├── .gitignore                # Git ignore rules
├── start-windows.bat         # Windows one-click start
├── start-unix.sh             # Mac/Linux one-click start
├── prisma/
│   └── schema.prisma         # PaperTrade model
├── src/
│   ├── app/
│   │   ├── page.tsx          # 6-tab dashboard
│   │   ├── layout.tsx
│   │   └── api/              # 15+ API routes
│   ├── components/
│   │   ├── predictor/        # 12 predictor components
│   │   ├── ui/               # shadcn/ui components
│   │   └── charts/           # Recharts components
│   ├── lib/
│   │   ├── stocks/           # Universe, Yahoo, NSE, intraday
│   │   ├── predictor/        # 4 timeframe engines
│   │   ├── indicators/       # 12 indicators + patterns
│   │   └── db.ts             # Prisma client
│   └── hooks/
└── public/
```

## License

Personal use. Not for redistribution. Market data provided by Yahoo Finance (free tier) and NSE (bhavcopy archive).

## Disclaimer

This tool is for educational and research purposes only. Stock market investments are subject to market risks. Always consult a SEBI-registered investment advisor before making investment decisions.
