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
import { isReady as isUpstoxReady, fetchHistorical as fetchFromUpstox } from './upstox'

export type DataSource = 'NSE' | 'YAHOO' | 'DEMO' | 'UPSTOX'

export interface FetchedSeries {
  series: StockSeries
  source: DataSource
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
    providers.push('UPSTOX', 'YAHOO', 'NSE')
  } else if (providerOverride === 'NSE') {
    providers.push('NSE', 'UPSTOX', 'YAHOO')
  } else if (providerOverride === 'YAHOO') {
    providers.push('YAHOO', 'UPSTOX', 'NSE')
  } else {
    // Default Auto priority
    providers.push('UPSTOX', 'NSE', 'YAHOO')
  }

  // 2. Start with the entire universe as failed, and fill them in iteratively
  let failed = NSE_UNIVERSE.map((meta, idx) => ({ meta, idx }))

  for (const prov of providers) {
    if (failed.length === 0) break

    if (prov === 'UPSTOX') {
      try {
        if (await isUpstoxReady()) {
          const upstoxResults = await mapWithConcurrency(failed, 4, async (item) => {
            const s = await fetchFromUpstox(item.meta, range)
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
        // Concurrently fetch failed stocks using fetchYahooStock to utilize cache
        const yahooResults = await mapWithConcurrency(failed, 4, async (item) => {
          const y = await fetchYahooStock(item.meta.symbol, asOf, range)
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

import { fetchNiftyIndex as fetchYahooNifty } from './yahoo'

export async function fetchNiftyIndex(): Promise<StockSeries | null> {
  try {
    return await fetchYahooNifty()
  } catch {
    return null
  }
}
