// Upstox API v2 client — OAuth flow, instrument master, historical candles.
//
// Upstox provides free historical + live data for personal trading apps.
// Docs: https://upstox.com/developer/api-documentation
//
// Flow:
//   1. User enters API key + secret + redirect URI in the settings modal.
//   2. User clicks "Connect Upstox" → we redirect to Upstox login.
//   3. Upstox redirects back with ?code=XXX → we exchange for access_token.
//   4. We store the token in the DB and use it for all subsequent API calls.
//   5. Tokens last ~24h; if a call returns 401, we use refresh_token to renew.
//
// This module is server-side only — never import in client components.

import { db } from '@/lib/db'
import { Candle, StockSeries } from './engine'
import { NSE_UNIVERSE, StockMeta } from './universe'

const UPSTOX_API = 'https://api.upstox.com/v2'
const UPSTOX_AUTH = 'https://api.upstox.com/v2/login/authorization'

export interface UpstoxStatus {
  configured: boolean // API key + secret are set
  connected: boolean  // access token is valid
  tokenExpiresAt: string | null
  lastUsedAt: string | null
  redirectUri: string | null
}

// --- Status ---------------------------------------------------------------
export async function getStatus(): Promise<UpstoxStatus> {
  const cfg = await db.upstoxConfig.findUnique({ where: { id: 1 } })
  if (!cfg) {
    return {
      configured: false,
      connected: false,
      tokenExpiresAt: null,
      lastUsedAt: null,
      redirectUri: null,
    }
  }
  const connected =
    !!cfg.accessToken &&
    (!cfg.tokenExpiresAt || cfg.tokenExpiresAt.getTime() > Date.now())
  return {
    configured: !!cfg.apiKey && !!cfg.apiSecret,
    connected,
    tokenExpiresAt: cfg.tokenExpiresAt?.toISOString() ?? null,
    lastUsedAt: cfg.lastUsedAt?.toISOString() ?? null,
    redirectUri: cfg.redirectUri,
  }
}

// --- Save API credentials (before OAuth) ---------------------------------
export async function saveCredentials(apiKey: string, apiSecret: string, redirectUri: string): Promise<void> {
  await db.upstoxConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      apiKey,
      apiSecret,
      redirectUri,
    },
    update: {
      apiKey,
      apiSecret,
      redirectUri,
      // Clear any existing tokens when credentials change
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    },
  })
}

// --- Build the OAuth authorize URL ---------------------------------------
export async function getAuthorizeUrl(): Promise<string | null> {
  const cfg = await db.upstoxConfig.findUnique({ where: { id: 1 } })
  if (!cfg) return null
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.apiKey,
    redirect_uri: cfg.redirectUri,
  })
  return `${UPSTOX_AUTH}/dialog?${params.toString()}`
}

// --- Exchange authorization code for access token ------------------------
export async function exchangeCodeForToken(code: string): Promise<{ success: boolean; error?: string }> {
  const cfg = await db.upstoxConfig.findUnique({ where: { id: 1 } })
  if (!cfg) return { success: false, error: 'Upstox not configured' }

  try {
    const body = new URLSearchParams({
      code,
      client_id: cfg.apiKey,
      client_secret: cfg.apiSecret,
      grant_type: 'authorization_code',
      redirect_uri: cfg.redirectUri,
    })
    const res = await fetch(`${UPSTOX_AUTH}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` }
    }
    const json = await res.json()
    if (!json.access_token) {
      return { success: false, error: `No access_token in response: ${JSON.stringify(json).slice(0, 300)}` }
    }
    // expires_in is in seconds (typically 86400 = 24h)
    const expiresAt = new Date(Date.now() + (json.expires_in ?? 86400) * 1000)
    await db.upstoxConfig.update({
      where: { id: 1 },
      data: {
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
      },
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// --- Refresh access token using refresh_token -----------------------------
async function refreshAccessToken(): Promise<boolean> {
  const cfg = await db.upstoxConfig.findUnique({ where: { id: 1 } })
  if (!cfg || !cfg.refreshToken) return false
  try {
    const body = new URLSearchParams({
      refresh_token: cfg.refreshToken,
      client_id: cfg.apiKey,
      client_secret: cfg.apiSecret,
      grant_type: 'refresh_token',
    })
    const res = await fetch(`${UPSTOX_AUTH}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      cache: 'no-store',
    })
    if (!res.ok) return false
    const json = await res.json()
    if (!json.access_token) return false
    const expiresAt = new Date(Date.now() + (json.expires_in ?? 86400) * 1000)
    await db.upstoxConfig.update({
      where: { id: 1 },
      data: {
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? cfg.refreshToken,
        tokenExpiresAt: expiresAt,
      },
    })
    return true
  } catch {
    return false
  }
}

// --- Disconnect (clear tokens, keep credentials) -------------------------
export async function disconnect(): Promise<void> {
  await db.upstoxConfig.update({
    where: { id: 1 },
    data: {
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      lastUsedAt: null,
    },
  })
}

// --- Get a valid access token (refresh if needed) ------------------------
async function getAccessToken(): Promise<string | null> {
  const cfg = await db.upstoxConfig.findUnique({ where: { id: 1 } })
  if (!cfg || !cfg.accessToken) return null
  // If token expires within next 5 minutes, try to refresh
  if (cfg.tokenExpiresAt && cfg.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) return null
    const fresh = await db.upstoxConfig.findUnique({ where: { id: 1 } })
    return fresh?.accessToken ?? null
  }
  return cfg.accessToken
}

// --- Mark last used ------------------------------------------------------
async function markUsed(): Promise<void> {
  await db.upstoxConfig.update({
    where: { id: 1 },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})
}

// --- Instrument master: download + cache ---------------------------------
// Upstox publishes a ~10MB JSON file with all instruments. We cache the NSE
// equity entries in the DB and refresh daily.
const INSTRUMENT_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz'

export async function refreshInstrumentMaster(): Promise<{ count: number; error?: string }> {
  try {
    // Fetch the gzipped JSON. Bun's fetch handles gzip transparently.
    const res = await fetch(INSTRUMENT_URL, { cache: 'no-store' })
    if (!res.ok) return { count: 0, error: `HTTP ${res.status}` }
    const json = await res.json()
    if (!Array.isArray(json)) return { count: 0, error: 'Unexpected response shape' }

    // Filter to NSE_EQ (equities) only — that's what we trade.
    const nseEquities = json.filter((inst: { exchange?: string; instrument_type?: string; segment?: string }) =>
      inst.exchange === 'NSE_EQ' &&
      inst.instrument_type === 'EQ' &&
      inst.segment === 'EQ'
    )

    // Build upserts — only for symbols in our universe to keep DB lean
    const universeSymbols = new Set(NSE_UNIVERSE.map((s) => s.symbol))
    const toUpsert = nseEquities.filter((inst: { tradingsymbol?: string }) =>
      inst.tradingsymbol && universeSymbols.has(inst.tradingsymbol)
    )

    // Delete all existing then bulk insert (simpler than per-row upsert)
    await db.upstoxInstrument.deleteMany({})
    for (const inst of toUpsert) {
      try {
        await db.upstoxInstrument.create({
          data: {
            symbol: inst.tradingsymbol,
            instrumentKey: inst.instrument_key,
            name: inst.name ?? null,
            exchange: inst.exchange ?? 'NSE_EQ',
            isin: inst.isin ?? null,
            lotSize: inst.lot_size ?? null,
            updatedAt: new Date(),
          },
        })
      } catch {
        // duplicate key — skip
      }
    }
    return { count: toUpsert.length }
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Look up the instrument key for a symbol. If not in DB, refresh master and retry.
export async function getInstrumentKey(symbol: string): Promise<string | null> {
  const cached = await db.upstoxInstrument.findUnique({ where: { symbol } })
  if (cached) return cached.instrumentKey
  // Try refreshing the master once
  await refreshInstrumentMaster()
  const fresh = await db.upstoxInstrument.findUnique({ where: { symbol } })
  return fresh?.instrumentKey ?? null
}

// --- Historical candles ---------------------------------------------------
// Upstox endpoint: GET /historical/candle/{instrument_key}/{interval}/{to_date}/{from_date}
//   interval: 1minute | 30minute | day | week
//   dates: YYYY-MM-DD
//   Max range per call: depends on interval. For `day`, you can fetch up to ~1 year.
// Returns candles oldest-first.
export async function fetchHistorical(
  meta: StockMeta,
  rangeOrDays: string | number = 130,
): Promise<StockSeries | null> {
  const token = await getAccessToken()
  if (!token) return null

  const instrumentKey = await getInstrumentKey(meta.symbol)
  if (!instrumentKey) return null

  let days = 130
  if (typeof rangeOrDays === 'number') {
    days = rangeOrDays
  } else {
    switch (rangeOrDays) {
      case '1y': days = 252; break
      case '2y': days = 504; break
      case '3y': days = 756; break
      case '4y': days = 1008; break
      case '5y': days = 1260; break
      case '10y': days = 2520; break
      default: days = 252; break
    }
  }

  // Encode the instrument key (it contains a pipe) for URL
  const encodedKey = encodeURIComponent(instrumentKey)
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - Math.ceil(days * 1.5)) // pad for weekends/holidays
  const toStr = toDate.toISOString().slice(0, 10)
  const fromStr = fromDate.toISOString().slice(0, 10)
  const url = `${UPSTOX_API}/historical/candle/${encodedKey}/day/${toStr}/${fromStr}`

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (res.status === 401) {
      // Token expired mid-call — try refresh once
      const refreshed = await refreshAccessToken()
      if (!refreshed) return null
      return fetchHistorical(meta, days) // retry
    }
    if (!res.ok) return null
    const json = await res.json()
    // Response shape: { status: 'success', data: { candles: [[ts, o, h, l, c, v, oi], ...] } }
    const candlesRaw: Array<[string, number, number, number, number, number, number]> =
      json?.data?.candles ?? []
    if (candlesRaw.length === 0) return null

    const candles: Candle[] = candlesRaw
      .map((c) => ({
        date: c[0].slice(0, 10),
        open: +c[1].toFixed(2),
        high: +c[2].toFixed(2),
        low: +c[3].toFixed(2),
        close: +c[4].toFixed(2),
        volume: c[5] ?? 0,
        adjClose: +c[4].toFixed(2),
      }))
      .filter((c) => isFinite(c.open) && isFinite(c.close))
      // Sort oldest first
      .sort((a, b) => a.date.localeCompare(b.date))

    if (candles.length < 30) return null

    await markUsed()
    return {
      symbol: meta.symbol,
      name: meta.name,
      sector: meta.sector,
      candles,
      lastIdx: candles.length - 1,
    }
  } catch {
    return null
  }
}

// --- Live quote (snapshot) -----------------------------------------------
// GET /market-quote/lite?instrument_key=NSE_EQ|INE002A01018
// Returns the latest available quote (real-time during market hours, last close otherwise).
export interface LiveQuote {
  symbol: string
  ltp: number
  open: number
  high: number
  low: number
  close: number
  prevClose: number
  volume: number
  changePct: number
}

export async function fetchLiveQuote(symbol: string): Promise<LiveQuote | null> {
  const token = await getAccessToken()
  if (!token) return null
  const instrumentKey = await getInstrumentKey(symbol)
  if (!instrumentKey) return null
  const url = `${UPSTOX_API}/market-quote/lite?instrument_key=${encodeURIComponent(instrumentKey)}`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    const d = json?.data
    if (!d) return null
    const ltp = d.last_price ?? 0
    const prevClose = d.ohlc?.close ?? ltp
    await markUsed()
    return {
      symbol,
      ltp,
      open: d.ohlc?.open ?? 0,
      high: d.ohlc?.high ?? 0,
      low: d.ohlc?.low ?? 0,
      close: d.ohlc?.close ?? 0,
      prevClose,
      volume: d.volume ?? 0,
      changePct: prevClose ? ((ltp - prevClose) / prevClose) * 100 : 0,
    }
  } catch {
    return null
  }
}

// --- Test the connection --------------------------------------------------
export async function testConnection(): Promise<{ ok: boolean; profile?: { email?: string; name?: string }; error?: string }> {
  const token = await getAccessToken()
  if (!token) return { ok: false, error: 'No access token — complete OAuth first' }
  try {
    const res = await fetch(`${UPSTOX_API}/user/profile`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const json = await res.json()
    await markUsed()
    return {
      ok: true,
      profile: {
        email: json?.data?.email,
        name: json?.data?.user_name,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// --- Is Upstox ready to be used as a data source? ------------------------
export async function isReady(): Promise<boolean> {
  const status = await getStatus()
  return status.configured && status.connected
}
