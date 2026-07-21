// Yahoo Finance live data fetcher for NSE stocks.
//
// Yahoo provides free EOD OHLCV via the `/v8/finance/chart/{symbol}.NS` endpoint.
// No API key required. We use it server-side only (CORS would block browser calls).
//
// Rate-limit strategy:
//   - Batch parallel fetches (≤8 concurrent) to avoid hammering Yahoo
//   - Cache per-symbol results in memory for 4 hours
//   - On any failure (network/HTTP/parse), return null so the caller can fall
//     back to the synthetic engine — never crash the API

import { Candle, StockSeries } from './engine'
import { NSE_UNIVERSE, StockMeta } from './universe'

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']
// Yahoo rate-limits the full Chrome UA aggressively. A minimal "Mozilla/5.0"
// UA is treated more leniently — verified empirically (Chrome UA → HTTP 429,
// Mozilla/5.0 → HTTP 200 from the same IP within the same second).
const UA = 'Mozilla/5.0'

// 4-hour in-memory cache for successful fetches; 1-minute cache for nulls so
// we retry quickly after a transient 429 storm.
const cache = new Map<string, { ts: number; series: StockSeries | null }>()
const CACHE_TTL_HITS_MS = 4 * 60 * 60 * 1000
const CACHE_TTL_NULLS_MS = 60 * 1000
// Round-robin host counter (alternates between query1 and query2)
let hostIdx = 0

function cacheFresh(cached: { ts: number; series: StockSeries | null } | undefined): boolean {
  if (!cached) return false
  const ttl = cached.series ? CACHE_TTL_HITS_MS : CACHE_TTL_NULLS_MS
  return Date.now() - cached.ts < ttl
}

interface YahooResponse {
  chart: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number
        longName?: string
        shortName?: string
      }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: number[]
          high?: number[]
          low?: number[]
          close?: number[]
          volume?: number[]
        }>
        adjclose?: Array<{ adjclose?: number[] }>
      }
    }>
    error?: { code?: string; description?: string }
  }
}

async function fetchOne(meta: StockMeta, range = '1y', interval = '1d', retries = 2): Promise<StockSeries | null> {
  const isShortRange = range === '1mo' || range === '3mo' || range === '6mo'
  const apiRange = isShortRange ? '1y' : ((range === '3y' || range === '4y') ? '5y' : range)
  
  // Resolve range or days to total calendar days to calculate start date
  let tradingDays = 252
  switch (apiRange) {
    case '1mo':  tradingDays = 21;   break
    case '3mo':  tradingDays = 63;   break
    case '6mo':  tradingDays = 126;  break
    case '1y':   tradingDays = 252;  break
    case '2y':   tradingDays = 504;  break
    case '3y':   tradingDays = 756;  break
    case '5y':   tradingDays = 1260; break
    case '10y':  tradingDays = 2520; break
  }
  const totalCalendarDays = Math.ceil(tradingDays * 1.5)
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  
  const absoluteStart = new Date(now)
  absoluteStart.setDate(absoluteStart.getDate() - totalCalendarDays)
  const wantedFromStr = absoluteStart.toISOString().slice(0, 10)

  // 1. Check local DB cache first
  const { getCachedCandles, saveCandlesToCache } = require('./candle-cache')
  const cached = await getCachedCandles(meta.symbol, 'day', 'YAHOO')

  let candles: Candle[] = []
  let apiFetchRequired = false
  let fetchRange = apiRange

  if (cached.length > 0) {
    const cacheFirstDate = cached[0].date
    const cacheLastDate = cached[cached.length - 1].date

    const newCandlesMap = new Map<string, Candle>()
    for (const c of cached) {
      newCandlesMap.set(c.date, c)
    }

    // A. Check if we need to backfill older historical data
    if (cacheFirstDate > wantedFromStr) {
      apiFetchRequired = true
      fetchRange = '5y' // Fetch larger range to fill historical gaps
    }

    // B. Check if we need to fetch updates up to today
    if (cacheLastDate < todayStr) {
      apiFetchRequired = true
    }

    if (!apiFetchRequired) {
      candles = Array.from(newCandlesMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    }
  } else {
    apiFetchRequired = true
  }

  if (apiFetchRequired) {
    const yahooSym = meta.yahooSymbol ?? `${meta.symbol}.NS`
    const host = YAHOO_HOSTS[hostIdx++ % YAHOO_HOSTS.length]
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${fetchRange}&interval=${interval}&includeAdjustedClose=true`

    const maxRetries = retries
    let apiCandles: Candle[] = []
    let fetchSuccess = false

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          signal: controller.signal,
          cache: 'no-store',
        } as RequestInit)
        clearTimeout(timeout)

        if (res.status === 429) {
          if (attempt < maxRetries) {
            const waitMs = 2000 * Math.pow(2, attempt) + Math.random() * 1000
            await new Promise((r) => setTimeout(r, waitMs))
            continue
          }
          break
        }

        if (!res.ok) {
          if (attempt < maxRetries && res.status >= 500) {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
            continue
          }
          break
        }

        const json: YahooResponse = await res.json()
        const result = json.chart?.result?.[0]
        if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
          break
        }
        const ts = result.timestamp
        const q = result.indicators.quote[0]
        const adj = result.indicators.adjclose?.[0]?.adjclose
        
        for (let i = 0; i < ts.length; i++) {
          const o = q.open?.[i]
          const h = q.high?.[i]
          const l = q.low?.[i]
          const c = q.close?.[i]
          const v = q.volume?.[i]
          if (o == null || h == null || l == null || c == null) continue
          const d = new Date(ts[i] * 1000)
          apiCandles.push({
            date: d.toISOString().slice(0, 10),
            open: +o.toFixed(2),
            high: +h.toFixed(2),
            low: +l.toFixed(2),
            close: +c.toFixed(2),
            volume: v ?? 0,
            adjClose: adj?.[i] != null ? +adj[i]!.toFixed(2) : +c.toFixed(2),
          })
        }
        fetchSuccess = true
        break
      } catch (e) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
          continue
        }
        break
      }
    }

    if (fetchSuccess && apiCandles.length >= 30) {
      // Merge with cache or save fresh
      const newCandlesMap = new Map<string, Candle>()
      for (const c of cached) newCandlesMap.set(c.date, c)
      for (const c of apiCandles) newCandlesMap.set(c.date, c)

      candles = Array.from(newCandlesMap.values()).sort((a, b) => a.date.localeCompare(b.date))
      
      // Save new ones to cache
      await saveCandlesToCache(meta.symbol, 'day', 'YAHOO', apiCandles)
    } else if (cached.length > 0) {
      // Fallback to cache if Yahoo API failed but we have cached data
      candles = cached
    } else {
      return null
    }
  }

  // Filter to the requested range
  candles = candles.filter(c => c.date >= wantedFromStr)

  if (candles.length < 30) return null

  return {
    symbol: meta.symbol,
    name: meta.name,
    sector: meta.sector,
    candles,
    lastIdx: candles.length - 1,
  }
}

// Run async tasks with a concurrency cap. Preserves input order in output.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

// Fetch the full universe, falling back to synthetic data per-stock when Yahoo
// is unavailable. Returns the array of series plus a per-symbol data-source map.
export interface UniverseResult {
  series: StockSeries[]
  sources: Record<string, 'LIVE' | 'DEMO'>
  liveCount: number
  demoCount: number
  fetchedAt: string
}

// Defer the synthetic import to avoid a circular dep at module load time.
async function synthFor(meta: StockMeta, asOf: Date): Promise<StockSeries> {
  const { generateOHLCSeries } = await import('./engine')
  return generateOHLCSeries(meta, asOf, 250)
}

export async function fetchLiveUniverse(asOf: Date, range = '1y'): Promise<UniverseResult> {
  const series: StockSeries[] = new Array(NSE_UNIVERSE.length)
  const sources: Record<string, 'LIVE' | 'DEMO'> = {}
  let liveCount = 0
  let demoCount = 0

  // Phase 1: probe Yahoo with the first 5 stocks, 0 retries (fail fast in ~10s).
  // If ≥4 fail, Yahoo is rate-limiting us hard — skip the rest of the universe
  // fetch and use synthetic data for everything. This prevents 3+ minute API calls.
  const probeSize = 5
  const probe = NSE_UNIVERSE.slice(0, probeSize)
  const probeResults = await mapWithConcurrency(probe, 2, async (meta) => fetchOne(meta, range, '1d', 0))
  const probeHits = probeResults.filter((s) => s !== null).length
  if (probeHits < 2) {
    // Yahoo is unavailable — use synthetic for the entire universe
    const allSynth = await mapWithConcurrency(NSE_UNIVERSE, 8, async (meta, idx) => {
      const s = await synthFor(meta, asOf)
      return { idx, s }
    })
    for (const r of allSynth) {
      series[r.idx] = r.s
      sources[NSE_UNIVERSE[r.idx].symbol] = 'DEMO'
      demoCount++
    }
    return { series, sources, liveCount, demoCount, fetchedAt: new Date().toISOString() }
  }

  // Phase 2: Yahoo is responsive — fetch the rest, using the probe results.
  // Insert probe results into the final array.
  for (let i = 0; i < probeSize; i++) {
    if (probeResults[i]) {
      series[i] = probeResults[i]!
      sources[NSE_UNIVERSE[i].symbol] = 'LIVE'
      liveCount++
    }
  }
  // Fetch the remaining stocks (excluding the probe set)
  const remaining = NSE_UNIVERSE.slice(probeSize).map((meta, j) => ({ meta, idx: j + probeSize }))
  const fetchedRest = await mapWithConcurrency(remaining, 2, async (item) => {
    const s = await fetchOne(item.meta, range, '1d')
    return { idx: item.idx, meta: item.meta, s }
  })

  // For any stock where Yahoo returned null, generate synthetic data in parallel
  const fallbacks = fetchedRest.filter((f) => !f.s)
  // Also include probe misses
  for (let i = 0; i < probeSize; i++) {
    if (!probeResults[i]) fallbacks.push({ idx: i, meta: NSE_UNIVERSE[i], s: null as unknown as StockSeries })
  }
  const synthResults = await mapWithConcurrency(fallbacks, 8, async (f) => ({
    idx: f.idx,
    s: await synthFor(f.meta, asOf),
  }))

  const synthMap = new Map<number, StockSeries>()
  for (const r of synthResults) synthMap.set(r.idx, r.s)

  for (const f of fetchedRest) {
    if (f.s) {
      series[f.idx] = f.s
      sources[f.meta.symbol] = 'LIVE'
      liveCount++
    } else {
      const s = synthMap.get(f.idx)!
      series[f.idx] = s
      sources[f.meta.symbol] = 'DEMO'
      demoCount++
    }
  }
  // Fill probe misses with synth
  for (let i = 0; i < probeSize; i++) {
    if (!probeResults[i]) {
      series[i] = synthMap.get(i)!
      sources[NSE_UNIVERSE[i].symbol] = 'DEMO'
      demoCount++
    }
  }

  return {
    series,
    sources,
    liveCount,
    demoCount,
    fetchedAt: new Date().toISOString(),
  }
}

export interface LiveStockResult {
  series: StockSeries
  source: 'LIVE' | 'DEMO'
}

export async function fetchLiveStock(symbol: string, asOf: Date, range = '1y'): Promise<LiveStockResult | null> {
  const meta = NSE_UNIVERSE.find((m) => m.symbol === symbol.toUpperCase())
  if (!meta) return null
  const s = await fetchOne(meta, range, '1d')
  if (s) return { series: s, source: 'LIVE' }
  // Fallback to synthetic
  return { series: await synthFor(meta, asOf), source: 'DEMO' }
}

export async function fetchNiftyIndex(): Promise<StockSeries | null> {
  const meta: StockMeta = {
    symbol: 'NIFTY50',
    name: 'Nifty 50 Index',
    sector: 'Financials',
    basePrice: 24000,
    volatility: 0.15,
    drift: 0.05
  }
  return fetchOne({ ...meta, yahooSymbol: '^NSEI' }, '1y', '1d')
}

// Test helper — fetch a single symbol and print a summary
export async function testFetchOne(symbol: string) {
  const meta = NSE_UNIVERSE.find((m) => m.symbol === symbol.toUpperCase())
  if (!meta) {
    console.log(`Unknown symbol: ${symbol}`)
    return
  }
  const s = await fetchOne(meta, '1y', '1d')
  if (!s) {
    console.log(`Failed to fetch ${symbol}`)
    return
  }
  console.log(`${s.symbol} (${s.name}) — ${s.candles.length} candles`)
  const last = s.candles[s.candles.length - 1]
  console.log(`Last: ${last.date} O=${last.open} H=${last.high} L=${last.low} C=${last.close} V=${last.volume}`)
}
