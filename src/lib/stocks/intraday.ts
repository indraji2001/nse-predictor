// Yahoo Finance intraday data fetcher — uses 5-min interval candles for the
// last 5 trading days. Yahoo's free endpoint supports this with a 15-minute
// delay during market hours (post-close data is immediate).
//
// Use cases:
//   - "Live scan" mode during market hours (9:15 AM - 3:30 PM IST)
//   - Opening Range Breakout (ORB) detection (first 15 min high/low)
//   - Intraday VWAP cross signals
//   - 5-min EMA9/EMA21 momentum
//
// Yahoo endpoint:
//   https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}.NS?range=5d&interval=5m
// Returns ~390 candles (5 days × 78 candles/day for NSE's 6h 15m session)

import { Candle } from './engine'
import { NSE_UNIVERSE, StockMeta } from './universe'

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']
const UA = 'Mozilla/5.0' // Yahoo rate-limits the full Chrome UA aggressively

let hostIdx = 0

// Cache: symbol -> { ts, candles }. 5-min TTL — intraday data goes stale fast.
const cache = new Map<string, { ts: number; candles: IntradayCandle[] | null }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface IntradayCandle {
  timestamp: number // Unix seconds
  date: string // ISO date (yyyy-mm-dd)
  time: string // HH:MM in IST
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface YahooIntradayResponse {
  chart: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number
        previousClose?: number
        chartPreviousClose?: number
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
      }
    }>
    error?: { code?: string; description?: string }
  }
}

async function fetchIntradayRaw(meta: StockMeta, range = '5d', interval = '5m'): Promise<IntradayCandle[] | null> {
  const key = `${meta.symbol}-${range}-${interval}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.candles
  }

  const yahooSym = meta.yahooSymbol ?? `${meta.symbol}.NS`
  const host = YAHOO_HOSTS[hostIdx++ % YAHOO_HOSTS.length]
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${range}&interval=${interval}&includeAdjustedClose=true`

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      } as RequestInit)
      clearTimeout(timeout)

      if (res.status === 429) {
        if (attempt < 1) {
          await new Promise((r) => setTimeout(r, 1500 + Math.random() * 500))
          continue
        }
        cache.set(key, { ts: Date.now(), candles: null })
        return null
      }
      if (!res.ok) {
        cache.set(key, { ts: Date.now(), candles: null })
        return null
      }

      const json: YahooIntradayResponse = await res.json()
      const result = json.chart?.result?.[0]
      if (!result?.timestamp || !result.indicators?.quote?.[0]) {
        cache.set(key, { ts: Date.now(), candles: null })
        return null
      }

      const ts = result.timestamp
      const q = result.indicators.quote[0]
      const candles: IntradayCandle[] = []
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i]
        const h = q.high?.[i]
        const l = q.low?.[i]
        const c = q.close?.[i]
        const v = q.volume?.[i]
        if (o == null || h == null || l == null || c == null) continue
        const d = new Date(ts[i] * 1000)
        // Yahoo returns UTC; convert to IST (UTC+5:30) for display
        const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
        candles.push({
          timestamp: ts[i],
          date: istTime.toISOString().slice(0, 10),
          time: istTime.toISOString().slice(11, 16),
          open: +o.toFixed(2),
          high: +h.toFixed(2),
          low: +l.toFixed(2),
          close: +c.toFixed(2),
          volume: v ?? 0,
        })
      }

      if (candles.length === 0) {
        cache.set(key, { ts: Date.now(), candles: null })
        return null
      }

      cache.set(key, { ts: Date.now(), candles })
      return candles
    } catch {
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 800))
        continue
      }
      cache.set(key, { ts: Date.now(), candles: null })
      return null
    }
  }
  return null
}

// --- Intraday analytics ---------------------------------------------------

export interface IntradayAnalysis {
  symbol: string
  name: string
  sector: string
  ltp: number // last traded price
  prevClose: number
  changePct: number
  dayOpen: number
  dayHigh: number
  dayLow: number
  dayVolume: number
  // Today's VWAP (intraday, volume-weighted average price)
  vwap: number
  vwapPosition: 'above' | 'below' | 'at'
  // Opening Range Breakout (first 15 min = 3 candles of 5-min)
  orHigh: number
  orLow: number
  orbStatus: 'breakout_up' | 'breakout_down' | 'inside' | 'no_data'
  // 5-min EMA9 and EMA21 (today's session)
  ema9: number
  ema21: number
  emaCross: 'bullish' | 'bearish' | 'none'
  // Today's momentum (% change from open to LTP)
  momentumPct: number
  // Last 3 candles momentum
  recentMomentum: number
  // Action recommendation
  action: 'BUY_NOW' | 'WAIT_BREAKOUT' | 'AVOID' | 'SELL_WATCH'
  confidence: number // 0-100
  reason: string
  // Intraday risk management levels (NEW — P1-4 fix)
  // For BUY_NOW: SL below dayLow or recent swing, targets above dayHigh
  // For SELL_WATCH: SL above dayHigh, targets below dayLow
  // For WAIT_BREAKOUT: SL below ORB low, target = breakout level + 1×ATR
  intradayStopLoss: number | null
  intradayTarget1: number | null
  intradayTarget2: number | null
  intradayTarget3: number | null
  // 5-min ATR (average true range) — used for SL/target calc and display
  atr5m: number
  // All candles for charting
  candles: IntradayCandle[]
  // Today's candles only (for the live chart strip)
  todayCandles: IntradayCandle[]
  // Last updated time
  asOf: string
}

// Compute EMA on a series of numbers
function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (values.length === 0) return out
  const k = 2 / (period + 1)
  let prev = NaN
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i === period - 1) {
      prev = sum / period
      out[i] = prev
    } else if (i >= period) {
      prev = values[i] * k + prev * (1 - k)
      out[i] = prev
    }
  }
  return out
}

// Analyze intraday candles for a single stock
function analyzeIntraday(meta: StockMeta, candles: IntradayCandle[]): IntradayAnalysis | null {
  if (candles.length < 10) return null

  // Find today's candles (latest date)
  const lastDate = candles[candles.length - 1].date
  const todayCandles = candles.filter((c) => c.date === lastDate)
  if (todayCandles.length < 3) return null

  const ltp = todayCandles[todayCandles.length - 1].close
  const dayOpen = todayCandles[0].open
  const dayHigh = Math.max(...todayCandles.map((c) => c.high))
  const dayLow = Math.min(...todayCandles.map((c) => c.low))
  const dayVolume = todayCandles.reduce((s, c) => s + c.volume, 0)

  // Previous close = last candle of yesterday (or the day before)
  const prevCandles = candles.filter((c) => c.date !== lastDate)
  const prevClose = prevCandles.length > 0 ? prevCandles[prevCandles.length - 1].close : dayOpen
  const changePct = prevClose ? ((ltp - prevClose) / prevClose) * 100 : 0

  // Today's VWAP = sum(typical * vol) / sum(vol)
  let pvSum = 0
  let vSum = 0
  for (const c of todayCandles) {
    const typical = (c.high + c.low + c.close) / 3
    pvSum += typical * c.volume
    vSum += c.volume
  }
  const vwap = vSum > 0 ? pvSum / vSum : ltp
  const vwapPosition: 'above' | 'below' | 'at' =
    ltp > vwap * 1.001 ? 'above' : ltp < vwap * 0.999 ? 'below' : 'at'

  // Opening Range Breakout (first 3 candles = 15 minutes)
  const orCandles = todayCandles.slice(0, Math.min(3, todayCandles.length))
  const orHigh = Math.max(...orCandles.map((c) => c.high))
  const orLow = Math.min(...orCandles.map((c) => c.low))
  let orbStatus: 'breakout_up' | 'breakout_down' | 'inside' | 'no_data' = 'inside'
  if (ltp > orHigh * 1.001) orbStatus = 'breakout_up'
  else if (ltp < orLow * 0.999) orbStatus = 'breakout_down'

  // 5-min EMA9 and EMA21 on today's closes
  const todayCloses = todayCandles.map((c) => c.close)
  const ema9Arr = ema(todayCloses, Math.min(9, todayCloses.length))
  const ema21Arr = ema(todayCloses, Math.min(21, todayCloses.length))
  const ema9Val = ema9Arr[ema9Arr.length - 1]
  const ema21Val = ema21Arr[ema21Arr.length - 1]
  let emaCross: 'bullish' | 'bearish' | 'none' = 'none'
  if (ema9Arr.length >= 2 && ema21Arr.length >= 2) {
    const e9Prev = ema9Arr[ema9Arr.length - 2]
    const e21Prev = ema21Arr[ema21Arr.length - 2]
    if (!isNaN(e9Prev) && !isNaN(e21Prev) && e9Prev <= e21Prev && ema9Val > ema21Val) emaCross = 'bullish'
    else if (!isNaN(e9Prev) && !isNaN(e21Prev) && e9Prev >= e21Prev && ema9Val < ema21Val) emaCross = 'bearish'
  }

  // Momentum: % change from open to LTP
  const momentumPct = dayOpen ? ((ltp - dayOpen) / dayOpen) * 100 : 0
  // Last 3 candles momentum
  const last3 = todayCandles.slice(-3)
  const recentMomentum = last3.length === 3
    ? ((last3[2].close - last3[0].open) / last3[0].open) * 100
    : 0

  // --- Action decision (intraday, conservative) ---
  let action: 'BUY_NOW' | 'WAIT_BREAKOUT' | 'AVOID' | 'SELL_WATCH' = 'AVOID'
  let confidence = 0
  let reason = ''

  const bullishSignals: string[] = []
  const bearishSignals: string[] = []

  // Above VWAP = bullish
  if (vwapPosition === 'above') bullishSignals.push('above VWAP')
  else if (vwapPosition === 'below') bearishSignals.push('below VWAP')

  // ORB breakout
  if (orbStatus === 'breakout_up') bullishSignals.push('ORB breakout up')
  else if (orbStatus === 'breakout_down') bearishSignals.push('ORB breakdown')

  // EMA cross
  if (emaCross === 'bullish') bullishSignals.push('5m EMA9>EMA21 cross')
  else if (emaCross === 'bearish') bearishSignals.push('5m EMA9<EMA21 cross')

  // EMA alignment
  if (!isNaN(ema9Val) && !isNaN(ema21Val)) {
    if (ema9Val > ema21Val) bullishSignals.push('EMA9>EMA21')
    else bearishSignals.push('EMA9<EMA21')
  }

  // Momentum
  if (momentumPct > 0.5) bullishSignals.push(`+${momentumPct.toFixed(2)}% today`)
  else if (momentumPct < -0.5) bearishSignals.push(`${momentumPct.toFixed(2)}% today`)

  if (recentMomentum > 0.3) bullishSignals.push('last 15min rising')
  else if (recentMomentum < -0.3) bearishSignals.push('last 15min falling')

  // Decide action
  if (bullishSignals.length >= 3 && bearishSignals.length === 0) {
    action = 'BUY_NOW'
    confidence = Math.min(95, 50 + bullishSignals.length * 10)
    reason = `Strong intraday: ${bullishSignals.join(', ')}`
  } else if (bullishSignals.length >= 2 && bearishSignals.length <= 1) {
    action = 'WAIT_BREAKOUT'
    confidence = Math.min(70, 30 + bullishSignals.length * 10)
    reason = `Building strength: ${bullishSignals.join(', ')}. Wait for clean breakout above ₹${dayHigh.toFixed(2)}`
  } else if (bearishSignals.length >= 3 && bullishSignals.length === 0) {
    action = 'SELL_WATCH'
    confidence = Math.min(85, 50 + bearishSignals.length * 8)
    reason = `Weak intraday: ${bearishSignals.join(', ')}`
  } else {
    action = 'AVOID'
    confidence = 0
    reason = 'Mixed signals — no clear intraday edge'
  }

  // --- Compute 5-min ATR (last 14 candles) for risk management ---
  const last14 = candles.slice(-14)
  let atrSum = 0
  let atrCount = 0
  for (let i = 1; i < last14.length; i++) {
    const c = last14[i]
    const p = last14[i - 1]
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close))
    atrSum += tr
    atrCount++
  }
  const atr5m = atrCount > 0 ? atrSum / atrCount : ltp * 0.005 // fallback: 0.5% of price

  // --- Intraday SL & targets (P1-4 fix) ---
  // BUY_NOW: SL = max(dayLow, ltp - 1.5×ATR), Targets = ltp + 1×, 2×, 3× ATR (intraday scalps)
  // SELL_WATCH: SL = min(dayHigh, ltp + 1.5×ATR), Targets = ltp - 1×, 2×, 3× ATR
  // WAIT_BREAKOUT: SL = orLow, Targets = dayHigh + 1×, 2×, 3× ATR (post-breakout)
  // AVOID: all null
  let intradayStopLoss: number | null = null
  let intradayTarget1: number | null = null
  let intradayTarget2: number | null = null
  let intradayTarget3: number | null = null

  if (action === 'BUY_NOW') {
    const slByATR = ltp - 1.5 * atr5m
    intradayStopLoss = +Math.min(dayLow, slByATR).toFixed(2) // tighter of dayLow or ATR-based
    // Ensure SL is below LTP by at least 0.3%
    if (intradayStopLoss >= ltp * 0.997) intradayStopLoss = +(ltp * 0.997).toFixed(2)
    intradayTarget1 = +(ltp + 1.0 * atr5m).toFixed(2)
    intradayTarget2 = +(ltp + 2.0 * atr5m).toFixed(2)
    intradayTarget3 = +(ltp + 3.0 * atr5m).toFixed(2)
  } else if (action === 'SELL_WATCH') {
    const slByATR = ltp + 1.5 * atr5m
    intradayStopLoss = +Math.max(dayHigh, slByATR).toFixed(2)
    if (intradayStopLoss <= ltp * 1.003) intradayStopLoss = +(ltp * 1.003).toFixed(2)
    intradayTarget1 = +(ltp - 1.0 * atr5m).toFixed(2)
    intradayTarget2 = +(ltp - 2.0 * atr5m).toFixed(2)
    intradayTarget3 = +(ltp - 3.0 * atr5m).toFixed(2)
  } else if (action === 'WAIT_BREAKOUT') {
    intradayStopLoss = +orLow.toFixed(2)
    intradayTarget1 = +(dayHigh + 0.5 * atr5m).toFixed(2)
    intradayTarget2 = +(dayHigh + 1.5 * atr5m).toFixed(2)
    intradayTarget3 = +(dayHigh + 3.0 * atr5m).toFixed(2)
  }

  return {
    symbol: meta.symbol,
    name: meta.name,
    sector: meta.sector,
    ltp,
    prevClose,
    changePct,
    dayOpen,
    dayHigh,
    dayLow,
    dayVolume,
    vwap,
    vwapPosition,
    orHigh,
    orLow,
    orbStatus,
    ema9: ema9Val,
    ema21: ema21Val,
    emaCross,
    momentumPct,
    recentMomentum,
    action,
    confidence,
    reason,
    intradayStopLoss,
    intradayTarget1,
    intradayTarget2,
    intradayTarget3,
    atr5m,
    candles,
    todayCandles,
    asOf: new Date().toISOString(),
  }
}

// Fetch intraday analysis for one symbol
export async function fetchIntradayForSymbol(symbol: string): Promise<IntradayAnalysis | null> {
  const meta = NSE_UNIVERSE.find((m) => m.symbol === symbol.toUpperCase())
  if (!meta) return null
  const candles = await fetchIntradayRaw(meta, '5d', '5m')
  if (!candles) return null
  return analyzeIntraday(meta, candles)
}

// --- Batch scan the universe for intraday signals -------------------------
// Concurrency-limited batch fetch. Returns sorted by confidence desc.
export interface IntradayScanResult {
  asOf: string
  totalScanned: number
  buyNowCount: number
  waitCount: number
  avoidCount: number
  sellWatchCount: number
  failedCount: number
  signals: IntradayAnalysis[]
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

export async function scanIntradayUniverse(limit = 80): Promise<IntradayScanResult> {
  // Limit scan to the top `limit` most liquid stocks to keep response time under 60s.
  // Yahoo's 5-min interval is rate-limited more aggressively than daily.
  const stocksToScan = NSE_UNIVERSE.slice(0, limit)

  const results = await mapWithConcurrency(stocksToScan, 3, async (meta) => {
    const candles = await fetchIntradayRaw(meta, '5d', '5m')
    if (!candles) return null
    return analyzeIntraday(meta, candles)
  })

  const valid = results.filter((r): r is IntradayAnalysis => r !== null)
  // Sort: BUY_NOW first (by confidence), then WAIT_BREAKOUT, then SELL_WATCH, then AVOID
  const order = { BUY_NOW: 0, WAIT_BREAKOUT: 1, SELL_WATCH: 2, AVOID: 3 }
  const sorted = valid.sort((a, b) => {
    if (order[a.action] !== order[b.action]) return order[a.action] - order[b.action]
    return b.confidence - a.confidence
  })

  return {
    asOf: new Date().toISOString(),
    totalScanned: stocksToScan.length,
    buyNowCount: valid.filter((v) => v.action === 'BUY_NOW').length,
    waitCount: valid.filter((v) => v.action === 'WAIT_BREAKOUT').length,
    avoidCount: valid.filter((v) => v.action === 'AVOID').length,
    sellWatchCount: valid.filter((v) => v.action === 'SELL_WATCH').length,
    failedCount: results.filter((r) => r === null).length,
    signals: sorted,
  }
}
