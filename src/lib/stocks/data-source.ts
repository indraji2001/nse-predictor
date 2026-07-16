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

export type DataSource = 'NSE' | 'YAHOO' | 'DEMO'

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
export async function fetchStockWithFallback(symbol: string, asOf: Date): Promise<FetchedSeries | null> {
  const meta = NSE_UNIVERSE.find((m) => m.symbol === symbol.toUpperCase())
  if (!meta) return null

  // 1. Try NSE bhavcopy archive (if user has uploaded/fetched files)
  const nseSeries = await fetchFromNSEArchive(meta, 30)
  if (nseSeries) return { series: nseSeries, source: 'NSE' }

  // 2. Try Yahoo
  const y = await fetchYahooStock(symbol, asOf)
  if (y) return { series: y.series, source: y.source === 'LIVE' ? 'YAHOO' : 'DEMO' }

  // 3. Synthetic fallback
  return { series: generateOHLCSeries(meta, asOf, 250), source: 'DEMO' }
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

export async function fetchUnifiedUniverse(asOf: Date): Promise<UnifiedUniverseResult> {
  const nseActive = await hasBhavcopyArchive()

  const series: StockSeries[] = new Array(NSE_UNIVERSE.length)
  const sources: Record<string, DataSource> = {}
  let nseCount = 0
  let yahooCount = 0
  let demoCount = 0

  // Phase 1: NSE bhavcopy archive (if user has uploaded/fetched files)
  const nseFailed: Array<{ meta: StockMeta; idx: number }> = []
  if (nseActive) {
    const nseResults = await mapWithConcurrency(NSE_UNIVERSE, 8, async (meta, idx) => {
      const s = await fetchFromNSEArchive(meta, 30)
      return { idx, meta, s }
    })
    for (const r of nseResults) {
      if (r.s) {
        series[r.idx] = r.s
        sources[r.meta.symbol] = 'NSE'
        nseCount++
      } else {
        nseFailed.push({ meta: r.meta, idx: r.idx })
      }
    }
  } else {
    for (let i = 0; i < NSE_UNIVERSE.length; i++) {
      nseFailed.push({ meta: NSE_UNIVERSE[i], idx: i })
    }
  }

  // Phase 2: Yahoo Finance — fetch all stocks (Yahoo's fetcher already has
  // probe + fallback logic internally). We pick the ones we still need.
  if (nseFailed.length > 0) {
    const yahooResult = await fetchYahooUniverse(asOf)
    for (const { meta, idx } of nseFailed) {
      const y = yahooResult.series.find((s) => s.symbol === meta.symbol)
      if (y) {
        series[idx] = y
        const ySource = yahooResult.sources[meta.symbol]
        if (ySource === 'LIVE') {
          sources[meta.symbol] = 'YAHOO'
          yahooCount++
        } else {
          sources[meta.symbol] = 'DEMO'
          demoCount++
        }
      } else {
        // Total failure — synthetic
        series[idx] = generateOHLCSeries(meta, asOf, 250)
        sources[meta.symbol] = 'DEMO'
        demoCount++
      }
    }
  }

  return {
    series,
    sources,
    liveCount: nseCount + yahooCount, // backward compat for UI banner
    demoCount,
    nseCount,
    yahooCount,
    nseActive,
    fetchedAt: new Date().toISOString(),
  }
}
