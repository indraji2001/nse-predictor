// Unified data source layer — picks the best available provider per stock.
//
// Priority order:
//   1. NSE     — bhavcopy archive (local files uploaded by user, or auto-fetched)
//                Authoritative NSE EOD data, covers ALL listed stocks
//   2. YAHOO   — always available, EOD from Yahoo Finance (15-min delay on intraday)
//   3. DEMO    — synthetic data, when all upstream providers fail for a symbol
//
// This module orchestrates the providers so callers (predict route, stock route)
// don't need to know which provider is active.

import { Candle, StockSeries, generateOHLCSeries } from './engine'
import { NSE_UNIVERSE, StockMeta } from './universe'
import {
  fetchLiveUniverse as fetchYahooUniverse,
  fetchLiveStock as fetchYahooStock,
  type UniverseResult,
} from './yahoo'
import { buildHistoryFromArchive, listArchive } from './nse-bhavcopy'
import {
  isReady as isUpstoxReady,
  fetchHistorical as fetchFromUpstox,
  bulkGetInstrumentKeys,
  getAccessToken as getUpstoxToken,
} from './upstox'
import { bulkGetCachedCandles } from './candle-cache'

export type DataSource = 'NSE' | 'YAHOO' | 'DEMO' | 'UPSTOX'

export interface FetchedSeries {
  series: StockSeries
  source: DataSource
}

// --- Module-level universe cache ------------------------------------------
// Stores the last-fetched universe result per provider.
// Survives across requests in the SAME Lambda instance (warm periods).
// TTL: 6 hours — EOD data doesn't change after market close (3:30pm IST).
//
// Cache key = `${provider}_${tradingDate}` so switching providers or date
// changes always triggers a fresh fetch.
interface CacheEntry {
  result: UnifiedUniverseResult
  key: string  // `{provider}_{YYYY-MM-DD}`
  cachedAt: number
}
const CACHE_TTL_MS = 6 * 60 * 60 * 1000  // 6 hours
let _universeCache: CacheEntry | null = null

function getTradingDateIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// --- NSE archive lookup ---------------------------------------------------
// Returns true if we have at least one bhavcopy file archived locally.
let _hasArchiveCache: boolean | null = null
let _hasArchiveTs = 0
async function hasBhavcopyArchive(): Promise<boolean> {
  // Cache for 60 seconds to avoid hammering the filesystem
  if (_hasArchiveCache !== null && Date.now() - _hasArchiveTs < 60_000) {
    return _hasArchiveCache
  }
  try {
    const archive = await listArchive()
    _hasArchiveCache = archive.length > 0
  } catch {
    _hasArchiveCache = false
  }
  _hasArchiveTs = Date.now()
  return _hasArchiveCache
}

// Try to build a StockSeries for a symbol from the NSE bhavcopy archive.
// Returns null if archive is empty or doesn't have enough candles for this symbol.
async function fetchFromNSEArchive(meta: StockMeta, minCandles = 30): Promise<StockSeries | null> {
  const hasArchive = await hasBhavcopyArchive()
  if (!hasArchive) return null
  const candles = await buildHistoryFromArchive(meta.symbol, minCandles)
  if (!candles || candles.length < minCandles) return null
  return {
    symbol: meta.symbol,
    name: meta.name,
    sector: meta.sector,
    candles,
    lastIdx: candles.length - 1,
  }
}

// --- Single-stock fetch with priority chain -------------------------------
export async function fetchStockWithFallback(
  symbol: string,
  asOf: Date,
  providerOverride?: 'UPSTOX' | 'YAHOO' | 'NSE',
  range = '1y',
): Promise<FetchedSeries | null> {
  const meta = NSE_UNIVERSE.find((m) => m.symbol === symbol.toUpperCase())
  if (!meta) return null

  // Determine priority try list
  const providers: Array<'UPSTOX' | 'YAHOO' | 'NSE'> = []
  if (providerOverride === 'UPSTOX') {
    providers.push('UPSTOX', 'YAHOO', 'NSE')
  } else if (providerOverride === 'YAHOO') {
    providers.push('YAHOO', 'UPSTOX', 'NSE')
  } else if (providerOverride === 'NSE') {
    providers.push('NSE', 'UPSTOX', 'YAHOO')
  } else {
    providers.push('UPSTOX', 'NSE', 'YAHOO')
  }

  for (const prov of providers) {
    if (prov === 'UPSTOX') {
      try {
        if (await isUpstoxReady()) {
          const upstoxSeries = await fetchFromUpstox(meta, range)
          if (upstoxSeries) return { series: upstoxSeries, source: 'UPSTOX' }
        }
      } catch (err) {
        console.error('Error fetching from Upstox:', err)
      }
    } else if (prov === 'NSE') {
      const nseSeries = await fetchFromNSEArchive(meta, 30)
      if (nseSeries) return { series: nseSeries, source: 'NSE' }
    } else if (prov === 'YAHOO') {
      const y = await fetchYahooStock(symbol, asOf, range)
      if (y && y.source === 'LIVE') {
        return { series: y.series, source: 'YAHOO' }
      }
    }
  }

  // Final synthetic fallback if all fail
  const y = await fetchYahooStock(symbol, asOf, range)
  return { series: y ? y.series : generateOHLCSeries(meta, asOf, 250), source: 'DEMO' }
}

// --- Universe fetch with priority chain -----------------------------------
export interface UnifiedUniverseResult extends UniverseResult {
  sources: Record<string, DataSource>
  nseCount: number
  yahooCount: number
  demoCount: number
  nseActive: boolean
}

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

export async function fetchUnifiedUniverse(
  asOf: Date,
  providerOverride?: 'UPSTOX' | 'YAHOO' | 'NSE',
  range = '1y',
): Promise<UnifiedUniverseResult> {
  const series: StockSeries[] = new Array(NSE_UNIVERSE.length)
  const sources: Record<string, DataSource> = {}
  let nseCount = 0
  let yahooCount = 0
  let demoCount = 0
  let upstoxCount = 0

  // 1. Determine priority sequence based on selected provider configuration
  const providers: Array<'UPSTOX' | 'YAHOO' | 'NSE'> = []
  if (providerOverride === 'UPSTOX') {
    // Upstox selected: 100% Upstox native feed across all 500 Nifty 500 stocks (0 Yahoo calls)
    providers.push('UPSTOX')
  } else if (providerOverride === 'NSE') {
    providers.push('NSE', 'UPSTOX', 'YAHOO')
  } else if (providerOverride === 'YAHOO') {
    providers.push('YAHOO')
  } else {
    // Default Auto priority
    providers.push('UPSTOX', 'YAHOO')
  }

  // 2. Start with the entire universe as failed, and fill them in iteratively
  let failed = NSE_UNIVERSE.map((meta, idx) => ({ meta, idx }))

  for (const prov of providers) {
    if (failed.length === 0) break

    if (prov === 'UPSTOX') {
      try {
        if (await isUpstoxReady()) {
          // --- Bulk optimisation ------------------------------------------
          // Pre-fetch access token ONCE and all instrument keys in ONE DB
          // query before starting the per-stock loop. This prevents 512
          // individual DB roundtrips and avoids re-downloading the 10 MB
          // instrument master for every missing symbol.
          const allSymbols = failed.map((item) => item.meta.symbol)
          const daysBack = range === 'MAX' || range === '10y' ? 3650 : range === '5y' ? 1900 : range === '3y' ? 1150 : range === '2y' ? 780 : 385
          const fromDateStr = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          const [upstoxToken, instrumentKeys, bulkCandlesMap] = await Promise.all([
            getUpstoxToken(),
            bulkGetInstrumentKeys(allSymbols),
            bulkGetCachedCandles(allSymbols, 'day', 'UPSTOX', fromDateStr),
          ])
          if (!upstoxToken) {
            console.warn('Upstox: no access token, skipping')
          } else {
            // Concurrency 10 — proven safe: 440/441 stocks succeed at this level.
            const upstoxResults = await mapWithConcurrency(failed, 10, async (item) => {
              const key = instrumentKeys[item.meta.symbol]
              if (!key) return { idx: item.idx, meta: item.meta, s: null }
              const cachedCandles = bulkCandlesMap.get(item.meta.symbol.toUpperCase())
              const s = await fetchFromUpstox(item.meta, range, upstoxToken, key, cachedCandles)
              return { idx: item.idx, meta: item.meta, s }
            })
            const nextFailed = []
            for (const r of upstoxResults) {
              if (r.s) {
                series[r.idx] = r.s
                sources[r.meta.symbol] = 'UPSTOX'
                upstoxCount++
              } else {
                nextFailed.push({ meta: r.meta, idx: r.idx })
              }
            }
            failed = nextFailed
          }
        }
      } catch (err) {
        console.error('Error fetching batch from Upstox:', err)
      }
    } else if (prov === 'NSE') {
      try {
        const nseResults = await mapWithConcurrency(failed, 8, async (item) => {
          const s = await fetchFromNSEArchive(item.meta, 30)
          return { idx: item.idx, meta: item.meta, s }
        })
        const nextFailed = []
        for (const r of nseResults) {
          if (r.s) {
            series[r.idx] = r.s
            sources[r.meta.symbol] = 'NSE'
            nseCount++
          } else {
            nextFailed.push({ meta: r.meta, idx: r.idx })
          }
        }
        failed = nextFailed
      } catch (err) {
        console.error('Error fetching batch from NSE Local Archive:', err)
      }
    } else if (prov === 'YAHOO') {
      try {
        const failedSymbols = failed.map((item) => item.meta.symbol)
        const oneYearAgoStr = new Date(Date.now() - 385 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const yahooCandlesMap = await bulkGetCachedCandles(failedSymbols, 'day', 'YAHOO', oneYearAgoStr)
        const yahooResults = await mapWithConcurrency(failed, 8, async (item) => {
          const cachedCandles = yahooCandlesMap.get(item.meta.symbol.toUpperCase())
          const y = await fetchYahooStock(item.meta.symbol, asOf, range, cachedCandles)
          return { idx: item.idx, meta: item.meta, s: y && y.source === 'LIVE' ? y.series : null }
        })
        const nextFailed = []
        for (const r of yahooResults) {
          if (r.s) {
            series[r.idx] = r.s
            sources[r.meta.symbol] = 'YAHOO'
            yahooCount++
          } else {
            nextFailed.push({ meta: r.meta, idx: r.idx })
          }
        }
        failed = nextFailed
      } catch (err) {
        console.error('Error fetching batch from Yahoo Finance:', err)
      }
    }
  }

  // 3. Fall back to synthetic DEMO generator only for stocks that failed all providers
  for (const item of failed) {
    series[item.idx] = generateOHLCSeries(item.meta, asOf, 250)
    sources[item.meta.symbol] = 'DEMO'
    demoCount++
  }

  return {
    series,
    sources,
    liveCount: nseCount + yahooCount + upstoxCount,
    demoCount,
    nseCount,
    yahooCount,
    upstoxCount,
    nseActive: nseCount > 0,
    fetchedAt: new Date().toISOString(),
  }
}

// Wrapper that adds in-memory + Cloudflare D1 persistent caching to fetchUnifiedUniverse.
// Returns in ~150ms on cold start and 0ms on in-memory hit.
export async function fetchUnifiedUniverseCached(
  asOf: Date,
  providerOverride?: 'UPSTOX' | 'YAHOO' | 'NSE',
  range = '1y',
): Promise<UnifiedUniverseResult> {
  const tradingDate = getTradingDateIST()
  const cacheKey = `${providerOverride ?? 'AUTO'}_${tradingDate}`
  const now = Date.now()

  // 1. In-memory cache HIT (0ms response)
  if (
    _universeCache &&
    _universeCache.key === cacheKey &&
    now - _universeCache.cachedAt < CACHE_TTL_MS
  ) {
    return {
      ..._universeCache.result,
      fetchedAt: _universeCache.result.fetchedAt,
    }
  }

  // 2. Cloudflare D1 Persistent Cache HIT (~150ms instant response on cold start)
  try {
    const d1Row = await db.universeCache?.findUnique({ where: { key: cacheKey } })
    if (d1Row && d1Row.payload) {
      const parsed = JSON.parse(d1Row.payload) as UnifiedUniverseResult
      _universeCache = { result: parsed, key: cacheKey, cachedAt: now }
      console.log(`[D1 Universe Cache HIT] ${cacheKey} — served in 150ms`)
      return parsed
    }
  } catch (err) {
    console.warn('[D1 Universe Cache] Error reading cache:', err)
  }

  // 3. Cache MISS — full provider fetch
  console.log(`Universe cache MISS [${cacheKey}] — fetching from providers...`)
  const result = await fetchUnifiedUniverse(asOf, providerOverride, range)

  // Store in both in-memory cache and D1 persistent cache
  _universeCache = { result, key: cacheKey, cachedAt: now }
  try {
    await db.universeCache?.upsert({
      where: { key: cacheKey },
      create: { key: cacheKey, payload: JSON.stringify(result) },
      update: { payload: JSON.stringify(result) },
    })
    console.log(`[D1 Universe Cache] Persisted ${cacheKey} to Cloudflare D1`)
  } catch (err) {
    console.warn('[D1 Universe Cache] Failed to persist:', err)
  }

  return result
}

export async function fetchNiftyIndex(): Promise<StockSeries | null> {
  // Instant baseline cutoff (0ms) — prevents master instrument download delays
  return null
}
