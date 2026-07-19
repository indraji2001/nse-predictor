import { NextRequest, NextResponse } from 'next/server'
import { detectHarmonicPatterns, HarmonicPattern } from '@/lib/indicators/harmonics'
import { NSE_UNIVERSE, StockMeta } from '@/lib/stocks/universe'
import { Candle } from '@/lib/stocks/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Chart period → Yahoo config map ────────────────────────────────────────
// Standard harmonic timeframe mapping:
//   Daily  (1D chart) → Short Term trades (5–15 days) → fetch 1yr daily
//   Weekly (1W chart) → Mid/Long Term trades (15–60D+) → fetch 2yr daily, resample→weekly
const CHART_CONFIGS: Record<string, { yahooRange: string; interval: string; pivotN: number; label: string; suitableFor: string }> = {
  DAILY: {
    yahooRange: '5y',    // 5 years = ~1260 daily candles — rich pivot history
    interval: '1d',
    pivotN: 5,           // 5-bar high/low lookback (equivalent to TradingView ta.pivothigh(5,5))
    label: 'Daily (1D)',
    suitableFor: 'Short Term (5–15 days)',
  },
  WEEKLY: {
    yahooRange: '3y',    // 3 years = ~156 weekly bars
    interval: '1wk',
    pivotN: 3,           // 3-bar high/low lookback (suitable for weekly candles)
    label: 'Weekly (1W)',
    suitableFor: 'Mid Term (15–60 days) & Long Term (60+ days)',
  },
}

// ── Yahoo Finance direct fetch ──────────────────────────────────────────────
// The harmonic scanner needs MORE history than the main predict route.
// We call Yahoo directly per-stock with the required range + interval.

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']
let hostIdx = 0

// Simple per-request in-memory cache (resets each cold start, TTL = 10 min)
const scanCache = new Map<string, { ts: number; candles: Candle[] }>()
const SCAN_CACHE_TTL = 10 * 60 * 1000

async function fetchCandlesForStock(
  meta: StockMeta,
  range: string,
  interval: string,
): Promise<Candle[]> {
  const cacheKey = `${meta.symbol}-${range}-${interval}`
  const cached = scanCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < SCAN_CACHE_TTL) return cached.candles

  const yahooSym = meta.yahooSymbol ?? `${meta.symbol}.NS`
  const host = YAHOO_HOSTS[hostIdx++ % YAHOO_HOSTS.length]
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${range}&interval=${interval}&includeAdjustedClose=true`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    } as RequestInit)
    clearTimeout(timeout)

    if (!res.ok) return []

    const json = await res.json() as {
      chart: {
        result?: Array<{
          timestamp?: number[]
          indicators?: {
            quote?: Array<{ open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[] }>
          }
        }>
      }
    }
    const result = json.chart?.result?.[0]
    if (!result?.timestamp || !result.indicators?.quote?.[0]) return []

    const ts = result.timestamp
    const q = result.indicators.quote[0]
    const candles: Candle[] = []

    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i]
      if (o == null || h == null || l == null || c == null) continue
      candles.push({
        date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
        open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2),
        close: +c.toFixed(2), volume: v ?? 0, adjClose: +c.toFixed(2),
      })
    }

    scanCache.set(cacheKey, { ts: Date.now(), candles })
    return candles
  } catch {
    return []
  }
}

// NOTE: resampleToWeekly() removed — WEEKLY config now fetches interval='1wk' directly from Yahoo,
// so no resampling is needed. Yahoo returns native weekly bars.


// ── Trade levels from pattern ──────────────────────────────────────────────
// SL: 1.2% beyond the PRZ boundary (clean, pattern-independent buffer)
//   Bullish: SL = 1.2% below przLow  (price closes below PRZ = pattern invalidated)
//   Bearish: SL = 1.2% above przHigh (price closes above PRZ = pattern invalidated)
// Targets: 38.2% and 61.8% of the CD leg from entry (per Carney PRZ trade management)
//   Bullish: price should move UP from PRZ → targets above entry
//   Bearish: price should move DOWN from PRZ → targets below entry
function computeTradeLevels(p: HarmonicPattern) {
  const bullish = p.direction === 'Bullish'
  const przMid = p.D
  const SL_BUFFER = 0.012  // 1.2% beyond PRZ boundary

  const stopLoss = bullish
    ? p.przLow * (1 - SL_BUFFER)      // 1.2% below PRZ Low
    : p.przHigh * (1 + SL_BUFFER)     // 1.2% above PRZ High

  const CD = Math.abs(p.D - p.C)
  const target1 = bullish ? przMid + 0.382 * CD : przMid - 0.382 * CD
  const target2 = bullish ? przMid + 0.618 * CD : przMid - 0.618 * CD

  const risk = Math.abs(przMid - stopLoss)
  const reward = Math.abs(target1 - przMid)
  const riskReward = risk > 0 ? +(reward / risk).toFixed(2) : 0

  return {
    suggestedEntry: +przMid.toFixed(2),
    stopLoss: +stopLoss.toFixed(2),
    target1: +target1.toFixed(2),
    target2: +target2.toFixed(2),
    riskReward,
  }
}

export interface HarmonicScanEntry {
  symbol: string
  name: string
  sector: string
  currentPrice: number
  chartPeriod: string
  patterns: HarmonicPattern[]
  bestPattern: HarmonicPattern | null
  inPRZ: boolean
  nearPRZ: boolean
  suggestedEntry: number
  stopLoss: number
  target1: number
  target2: number
  riskReward: number
}

// ── Run 3-stock probe to check Yahoo availability ─────────────────────────
async function checkYahooAvailable(range: string, interval: string): Promise<boolean> {
  const probe = NSE_UNIVERSE.slice(0, 3)
  const results = await Promise.all(
    probe.map(m => fetchCandlesForStock(m, range, interval))
  )
  return results.filter(r => r.length >= 20).length >= 2
}

// ── Main GET handler ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const chartPeriod = (req.nextUrl.searchParams.get('chartPeriod') || 'DAILY').toUpperCase()
  const sectorFilter = req.nextUrl.searchParams.get('sector') || 'ALL'
  const directionFilter = req.nextUrl.searchParams.get('direction') || 'ALL'
  const przOnly = req.nextUrl.searchParams.get('przOnly') === 'true'

  const cfg = CHART_CONFIGS[chartPeriod] ?? CHART_CONFIGS.DAILY

  // Apply sector filter
  const universe = sectorFilter === 'ALL'
    ? NSE_UNIVERSE
    : NSE_UNIVERSE.filter(m => m.sector === sectorFilter)

  // Probe Yahoo first (fast fail)
  const yahooAvailable = await checkYahooAvailable(cfg.yahooRange, cfg.interval)

  const results: HarmonicScanEntry[] = []
  let scannedCount = 0
  let liveCount = 0
  let demoCount = 0

  // Scan up to 150 stocks per request (stay within 60s Vercel limit)
  // Universe is already sorted by liquidity/importance so top stocks come first.
  const MAX_STOCKS = 150
  const universeSlice = universe.slice(0, MAX_STOCKS)
  const BATCH_SIZE = 10  // Increased batch size for faster throughput
  for (let i = 0; i < universeSlice.length; i += BATCH_SIZE) {
    const batch = universeSlice.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (meta) => {
      scannedCount++

      // Get candles
      let candles: Candle[] = []
      if (yahooAvailable) {
        candles = await fetchCandlesForStock(meta, cfg.yahooRange, cfg.interval)
        if (candles.length >= 20) liveCount++
        else {
          // Fallback to demo synthetic
          demoCount++
          return // skip synthetic for harmonic scan (no real patterns)
        }
      } else {
        demoCount++
        return // skip — synthetic data won't have real harmonic patterns
      }

      // Detect patterns using N-bar high/low pivot detection
      // Use 30 pivot windows for maximum pattern coverage
      const patterns = detectHarmonicPatterns(candles, cfg.pivotN, 30)
      if (patterns.length === 0) return

      const currentPrice = candles[candles.length - 1].close

      // Direction filter
      const fp = directionFilter === 'ALL'
        ? patterns
        : patterns.filter(p => p.direction === directionFilter)
      if (fp.length === 0) return

      // Best = closest to PRZ
      const bestPattern = fp.reduce((best, p) =>
        Math.abs(p.distFromD) < Math.abs(best.distFromD) ? p : best
      )

      const inPRZ = Math.abs(bestPattern.distFromD) <= 3.0
      const nearPRZ = Math.abs(bestPattern.distFromD) <= 8.0

      if (przOnly && !nearPRZ) return

      const levels = computeTradeLevels(bestPattern)

      results.push({
        symbol: meta.symbol,
        name: meta.name,
        sector: meta.sector,
        currentPrice: +currentPrice.toFixed(2),
        chartPeriod: cfg.label,
        patterns: fp,
        bestPattern,
        inPRZ,
        nearPRZ,
        ...levels,
      })
    }))
  }

  // Sort: RSI-confluent in-PRZ first, then in-PRZ, then RSI-confluent near-PRZ, then near-PRZ, then by distance
  results.sort((a, b) => {
    const aConfl = !!(a.bestPattern?.rsiBullish || a.bestPattern?.rsiBearish)
    const bConfl = !!(b.bestPattern?.rsiBullish || b.bestPattern?.rsiBearish)
    // Tier 1: in PRZ with RSI confluence
    if (a.inPRZ && aConfl && !(b.inPRZ && bConfl)) return -1
    if (b.inPRZ && bConfl && !(a.inPRZ && aConfl)) return 1
    // Tier 2: in PRZ without RSI confluence
    if (a.inPRZ && !b.inPRZ) return -1
    if (b.inPRZ && !a.inPRZ) return 1
    // Tier 3: near PRZ with RSI confluence
    if (a.nearPRZ && aConfl && !(b.nearPRZ && bConfl)) return -1
    if (b.nearPRZ && bConfl && !(a.nearPRZ && aConfl)) return 1
    // Tier 4: near PRZ without RSI confluence
    if (a.nearPRZ && !b.nearPRZ) return -1
    if (b.nearPRZ && !a.nearPRZ) return 1
    // Within same tier: sort by RSI confluence first, then by proximity
    if (aConfl && !bConfl) return -1
    if (bConfl && !aConfl) return 1
    return Math.abs(a.bestPattern!.distFromD) - Math.abs(b.bestPattern!.distFromD)
  })

  const sectors = [...new Set(NSE_UNIVERSE.map(s => s.sector))].sort()

  // Direction-split stats for UI (tabs show bullish vs bearish separately)
  const bullishResults = results.filter(r => r.bestPattern?.direction === 'Bullish')
  const bearishResults = results.filter(r => r.bestPattern?.direction === 'Bearish')

  const rsiConfluenceCount = results.filter(r =>
    r.bestPattern?.rsiBullish || r.bestPattern?.rsiBearish
  ).length

  return NextResponse.json({
    total: results.length,
    scannedCount,
    liveCount,
    demoCount,
    // Combined stats
    inPRZ: results.filter(r => r.inPRZ).length,
    nearPRZ: results.filter(r => r.nearPRZ && !r.inPRZ).length,
    rsiConfluenceCount,
    // Direction-split stats for BUY/SELL tabs
    bullishCount: bullishResults.length,
    bearishCount: bearishResults.length,
    bullishInPRZ: bullishResults.filter(r => r.inPRZ).length,
    bearishInPRZ: bearishResults.filter(r => r.inPRZ).length,
    bullishNearPRZ: bullishResults.filter(r => r.nearPRZ && !r.inPRZ).length,
    bearishNearPRZ: bearishResults.filter(r => r.nearPRZ && !r.inPRZ).length,
    bullishRsiCount: bullishResults.filter(r => r.bestPattern?.rsiBullish).length,
    bearishRsiCount: bearishResults.filter(r => r.bestPattern?.rsiBearish).length,
    yahooAvailable,
    chartPeriod: cfg.label,
    suitableFor: cfg.suitableFor,
    sectors,
    results,
    universeSize: universe.length,
    scannedAt: new Date().toISOString(),
  })
}
