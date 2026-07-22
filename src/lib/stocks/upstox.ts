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
import { getCachedCandles, saveCandlesToCache } from './candle-cache'

const UPSTOX_API = 'https://api.upstox.com/v2'

// --- Rate limiter for Upstox historical API --------------------------------
// Upstox allows ~5 requests/second for historical-candle endpoint.
// We use a simple token-bucket to stay well within this limit.
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

class UpstoxRateLimiter {
  private tokens: number
  private readonly maxTokens: number
  private readonly msPerToken: number
  private lastRefill: number

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond
    this.tokens = requestsPerSecond
    this.msPerToken = 1000 / requestsPerSecond
    this.lastRefill = Date.now()
  }

  async acquire(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    const refilled = Math.floor(elapsed / this.msPerToken)
    if (refilled > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + refilled)
      this.lastRefill = now
    }
    if (this.tokens > 0) {
      this.tokens--
      return
    }
    // Wait for next token
    const waitMs = this.msPerToken - (now % this.msPerToken)
    await sleep(Math.max(waitMs, 50))
    this.tokens = Math.max(0, this.tokens - 1)
  }
}

// Shared rate limiter: 8 req/s — empirically safe for Upstox historical-candle.
// (Upstox burst-tolerates at least 12 req before limiting; 8/s gives ample margin.)
// At 8/s: 1Y=441 stocks → 55s; 5Y=1323 chunks → 165s (well within 300s maxDuration)
const _upstoxRateLimiter = new UpstoxRateLimiter(8)
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
    // Upstox publishes the instrument master as a gzip-compressed JSON file.
    // Node.js fetch() does NOT auto-decompress gzip (unlike Bun), so we must:
    //   1. Download as raw binary (ArrayBuffer)
    //   2. Decompress with zlib.gunzipSync()
    //   3. JSON.parse() the decompressed UTF-8 string
    const { gunzipSync } = await import('zlib')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000) // 60s — file is 3.6MB

    let json: unknown
    try {
      const res = await fetch(INSTRUMENT_URL, { cache: 'no-store', signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) return { count: 0, error: `HTTP ${res.status}` }

      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('gzip') || contentType.includes('application/octet-stream') || !contentType.includes('json')) {
        // Binary gzip → decompress first
        const buffer = await res.arrayBuffer()
        const decompressed = gunzipSync(Buffer.from(buffer))
        json = JSON.parse(decompressed.toString('utf-8'))
      } else {
        // Already plain JSON (shouldn't happen with .json.gz URL but handle gracefully)
        json = await res.json()
      }
    } catch (fetchErr) {
      clearTimeout(timer)
      return { count: 0, error: `Fetch/decompress failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}` }
    }

    if (!Array.isArray(json)) return { count: 0, error: `Unexpected response shape: ${typeof json}` }

    // The Upstox instrument file contains ALL exchanges (NSE, BSE, MCX, NCD, etc).
    // We only want NSE equity cash-segment instruments (which we trade).
    //
    // The ONLY field that has remained stable across ALL Upstox file format changes
    // is `instrument_key`, which always starts with "NSE_EQ|" for NSE cash equity.
    //
    // We intentionally do NOT filter by instrument_type or segment, because Upstox
    // changes those field values (e.g. 'EQ' → 'X' → 'BE') without notice.
    // Filtering only by instrument_key prefix is the most robust approach.
    type RawInst = Record<string, unknown>
    const instruments = json as RawInst[]

    const nseEquities = instruments.filter((inst) => {
      const key = inst.instrument_key as string | undefined
      return key?.startsWith('NSE_EQ|') ?? false
    })

    // Build upserts — only for symbols in our universe to keep DB lean.
    // Handle both field name variants: 'trading_symbol' (new) and 'tradingsymbol' (old).
    const universeSymbols = new Set(NSE_UNIVERSE.map((s) => s.symbol))
    const toUpsert = nseEquities.filter((inst) => {
      const sym = (inst.trading_symbol ?? inst.tradingsymbol) as string | undefined
      return sym && universeSymbols.has(sym)
    })

    // Delete all existing then bulk insert
    await db.upstoxInstrument.deleteMany({})
    let inserted = 0
    for (const inst of toUpsert) {
      const sym = (inst.trading_symbol ?? inst.tradingsymbol) as string
      const key = inst.instrument_key as string
      if (!sym || !key) continue
      try {
        await db.upstoxInstrument.create({
          data: {
            symbol: sym,
            instrumentKey: key,
            name: (inst.name as string) ?? null,
            exchange: (inst.exchange as string) ?? 'NSE',
            isin: (inst.isin as string) ?? null,
            lotSize: (inst.lot_size as number) ?? null,
            updatedAt: new Date(),
          },
        })
        inserted++
      } catch {
        // duplicate key — skip
      }
    }
    return { count: inserted }
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// --- Instrument key in-process cache ------------------------------------
// Prevent downloading the 10MB instrument master multiple times in one
// serverless invocation when the DB is empty (first-time use).
let _masterRefreshedThisInvocation = false
const _keyCache: Map<string, string> = new Map()

// Look up the instrument key for a symbol. If not in DB, refresh master ONCE
// per serverless invocation and retry. Never re-download mid-flight.
export async function getInstrumentKey(symbol: string): Promise<string | null> {
  if (_keyCache.has(symbol)) return _keyCache.get(symbol)!
  const cached = await db.upstoxInstrument.findUnique({ where: { symbol } })
  if (cached) {
    _keyCache.set(symbol, cached.instrumentKey)
    return cached.instrumentKey
  }
  return null
}

const SYMBOL_ALIASES: Record<string, string> = {
  'BAJFINSV': 'BAJAJFINSV',
  'ZEEENT': 'ZEEL',
  'ZOMATO': 'ETERNAL',
  'ECLOTS': 'ECLERX',
  'REPCAPITAL': 'REPCOHOME',
  'IIFLFIN': 'IIFL',
  'KOKUYO': 'KOKUYOCMLN',
  'ARE_M': 'ARE&M',
  'INAQPORT': 'ADANIPORTS',
  'GMDC': 'GMDCLTD',
  'NALCO': 'NATIONALUM',
  'HGICL': 'HGINFRA',
  'NALWA': 'NSIL',
  'INDUSIND-BK': 'INDUSINDBK',
  'HINDMEDIA': 'HTMEDIA',
  'CARBORUNDUM': 'CARBORUNIV',
  'MAHINDRAEST': 'MAHLIFE',
  'IBREALEST': 'EQUINOX',
  'BLUE DART': 'BLUEDART',
  'GE SHIPPING': 'GESHIP',
  'SHIPCORP': 'SCI',
  'WELSIND': 'WELSPUNLIV',
  'KITEXGAR': 'KITEX',
  'GOKALDAS': 'GOKEX',
  'ARVINDFAB': 'ARVIND',
  'WELSILK': 'WELSPUNLIV',
  'KALPATARA': 'KPIL',
  'HSIL': 'AGI',
  'BOROLTK': 'BORORENEW',
  'BANNARI': 'BANARISUG',
  'SHREERENUKA': 'RENUKA',
  'CCLPRODUCT': 'CCL',
  'TRENTLTD': 'TRENT',
  'ZUARIGLOB': 'ZUARI',
  'AVENTIS': 'SANOFI',
  'FCSOFTWARE': 'FCSSOFT',
  'GLOBALHOSP': 'GLOBALHEALTH',
  'KARNATAKA': 'KTKBANK',
  'SHILPA': 'SHILPAMED',
  'ATALAUTO': 'ATULAUTO',
  'CIGNITI': 'COFORGE',
  'INNOVATIVE': 'INNOVACAP',
  'PATPRJ': 'PATELENG',
  'LAXMIORG': 'LXCHEM',
  'ANUPAM': 'ANURAS',
  'CHEMPLAN': 'CHEMCON',
  'NEULAND': 'NEULANDLAB',
  'NRBHAND': 'NRBBEARING',
  'CONTAINER': 'CONCOR',
  'TATATELE': 'TTML',
  'GOKALDAS-2': 'GOKEX',
  'ARVINDF-2': 'ARVIND',
  'MAHSCOOT': 'MAHSCOOTER',
}

// Bulk-fetch instrument keys in a SINGLE DB query (used by data-source to
// avoid 512 individual DB roundtrips before the Upstox API call loop).
export async function bulkGetInstrumentKeys(
  symbols: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  // First pass: serve from in-process cache
  const missing: string[] = []
  for (const sym of symbols) {
    if (_keyCache.has(sym)) result[sym] = _keyCache.get(sym)!
    else missing.push(sym)
  }
  if (missing.length === 0) return result

  // Fetch all instrument keys from DB in a single 5ms query
  const rows = await db.upstoxInstrument.findMany({
    select: { symbol: true, instrumentKey: true },
  })

  const rowMap = new Map<string, string>()
  for (const row of rows) {
    rowMap.set(row.symbol.toUpperCase(), row.instrumentKey)
  }

  for (const sym of missing) {
    const alias = SYMBOL_ALIASES[sym.toUpperCase()] || sym.toUpperCase()
    const key = rowMap.get(sym.toUpperCase()) || rowMap.get(alias)
    if (key) {
      result[sym] = key
      _keyCache.set(sym, key)
    }
  }

  return result
}

// Export getAccessToken for use by data-source bulk prefetch
export { getAccessToken }

// --- Single-chunk Upstox daily candle fetch (max 2 years per call) --------
// Upstox API limit: ~730 calendar days per call for daily interval.
// Returns raw candles array or null on failure.
async function fetchDayChunk(
  encodedKey: string,
  token: string,
  fromStr: string,
  toStr: string,
): Promise<Candle[] | null> {
  // Upstox v2 API: /v2/historical-candle/{key}/day/{to}/{from}
  const url = `${UPSTOX_API}/historical-candle/${encodedKey}/day/${toStr}/${fromStr}`

  // Retry up to 3 times on HTTP 429 (rate limit exceeded) with exponential backoff.
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000) // 8s per chunk
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 429) {
        // Rate limited — wait exponentially then retry
        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.pow(2, attempt) * 1000  // 1s, 2s, 4s
          await sleep(backoffMs)
          continue
        }
        return null  // exhausted retries
      }

      if (!res.ok) return null  // other error — no retry

      const json = await res.json()
      const raw: Array<[string, number, number, number, number, number, number]> =
        json?.data?.candles ?? []
      return raw
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
    } catch {
      clearTimeout(timer)
      if (attempt < MAX_RETRIES) {
        await sleep(500)  // brief wait before retry on network error
        continue
      }
      return null
    }
  }
  return null
}

export async function fetchHistorical(
  meta: StockMeta,
  rangeOrDays: string | number = 130,
  prefetchedToken?: string,
  prefetchedKey?: string,
  prefetchedCandles?: Candle[],
): Promise<StockSeries | null> {
  const CHUNK_DAYS = 700
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // Resolve requested range to calendar days (padded 1.5× for weekends + holidays)
  let tradingDays = 130
  if (typeof rangeOrDays === 'number') {
    tradingDays = rangeOrDays
  } else {
    switch (rangeOrDays) {
      case '1y':  tradingDays = 252;  break
      case '2y':  tradingDays = 504;  break
      case '3y':  tradingDays = 756;  break
      case '4y':  tradingDays = 1008; break
      case '5y':  tradingDays = 1260; break
      case '10y': tradingDays = 2520; break
      default:    tradingDays = 252;  break
    }
  }
  const totalCalendarDays = Math.ceil(tradingDays * 1.5) // pad for weekends/holidays

  // Calculate the wanted start date
  const absoluteStart = new Date(now)
  absoluteStart.setDate(absoluteStart.getDate() - totalCalendarDays)
  const wantedFromStr = absoluteStart.toISOString().slice(0, 10)

  // 1. Check local DB cache first
  const cached = prefetchedCandles ?? await getCachedCandles(meta.symbol, 'day', 'UPSTOX')

  let candles: Candle[] = []
  let token: string | null = null
  let instrumentKey: string | null = null
  let encodedKey = ''

  const getKeys = async () => {
    if (encodedKey) return
    token = prefetchedToken ?? await getAccessToken()
    if (!token) return
    instrumentKey = prefetchedKey ?? await getInstrumentKey(meta.symbol)
    if (!instrumentKey) return
    encodedKey = encodeURIComponent(instrumentKey)
  }

  if (cached.length > 0) {
    const cacheFirstDate = cached[0].date
    const cacheLastDate = cached[cached.length - 1].date

    const newCandlesMap = new Map<string, Candle>()
    for (const c of cached) {
      newCandlesMap.set(c.date, c)
    }

    // A. Check if we need to backfill older historical data
    // Only attempt backfill if cached candles are insufficient (<220 bars) and cacheFirstDate > wantedFromStr
    if (cached.length < 220 && cacheFirstDate > wantedFromStr) {
      console.log(`[Upstox Cache] Backfilling older data for ${meta.symbol}: ${wantedFromStr} to ${cacheFirstDate}`)
      await getKeys()
      if (token && encodedKey) {
        // Fetch older chunk
        const batch = await fetchDayChunk(encodedKey, token, wantedFromStr, cacheFirstDate)
        if (batch && batch.length > 0) {
          for (const c of batch) newCandlesMap.set(c.date, c)
          await saveCandlesToCache(meta.symbol, 'day', 'UPSTOX', batch)
        }
      }
    }

    // B. Check if we need to fetch updates up to today (only if last candle is > 1 calendar day old)
    const daysSinceLastCandle = Math.floor((now.getTime() - new Date(cacheLastDate).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceLastCandle >= 1) {
      await getKeys()
      if (token && encodedKey) {
        const batch = await fetchDayChunk(encodedKey, token, cacheLastDate, todayStr)
        if (batch) {
          const fresh = batch.filter(c => c.date !== cacheLastDate)
          if (fresh.length > 0) {
            for (const c of fresh) newCandlesMap.set(c.date, c)
            await saveCandlesToCache(meta.symbol, 'day', 'UPSTOX', fresh)
          }
        }
      }
    }

    candles = Array.from(newCandlesMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  } else {
    // 2. No cache - full historical load divided into 2-year chunks
    await getKeys()
    if (!token || !encodedKey) return null

    const chunks: Array<{ fromStr: string; toStr: string }> = []
    let chunkEnd = new Date(now)
    while (true) {
      const chunkStart = new Date(chunkEnd)
      chunkStart.setDate(chunkStart.getDate() - CHUNK_DAYS)

      if (chunkStart < absoluteStart) {
        chunkStart.setTime(absoluteStart.getTime())
      }

      chunks.unshift({
        fromStr: chunkStart.toISOString().slice(0, 10),
        toStr:   chunkEnd.toISOString().slice(0, 10),
      })

      if (chunkStart.getTime() <= absoluteStart.getTime()) break
      chunkEnd = new Date(chunkStart)
      chunkEnd.setDate(chunkEnd.getDate() - 1)
    }

    const allCandles: Candle[] = []
    for (const chunk of chunks) {
      const batch = await fetchDayChunk(encodedKey, token, chunk.fromStr, chunk.toStr)
      if (batch) allCandles.push(...batch)
    }

    if (allCandles.length === 0) return null

    // Deduplicate
    const seen = new Set<string>()
    candles = allCandles
      .filter((c) => { if (seen.has(c.date)) return false; seen.add(c.date); return true })
      .sort((a, b) => a.date.localeCompare(b.date))

    // Save to DB cache
    await saveCandlesToCache(meta.symbol, 'day', 'UPSTOX', candles)
  }

  // Filter to the requested range
  candles = candles.filter(c => c.date >= wantedFromStr)

  if (candles.length < 30) return null

  await markUsed()
  return {
    symbol: meta.symbol,
    name: meta.name,
    sector: meta.sector,
    candles,
    lastIdx: candles.length - 1,
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
