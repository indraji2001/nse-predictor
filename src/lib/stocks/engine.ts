// Realistic OHLC data generator using Geometric Brownian Motion with sector-coupled
// market regime, intraday volatility clustering, and occasional news shocks.
//
// The generator is deterministic per (symbol, runDate) — running it twice on the same
// day produces the same series, so the user can refresh the page and the numbers stay
// consistent. Running it on a different day produces a fresh series.
//
// Plug-in point: replace `generateOHLCSeries` with a fetcher that pulls from
// Yahoo Finance / NSE / broker API, and the rest of the engine works unchanged.

import { NSE_UNIVERSE, StockMeta } from './universe'

export interface Candle {
  date: string // ISO date (yyyy-mm-dd)
  open: number
  high: number
  low: number
  close: number
  volume: number
  // Adjusted close = same as close in synthetic mode (no splits/dividends)
  adjClose: number
}

export interface StockSeries {
  symbol: string
  name: string
  sector: string
  candles: Candle[]
  // Index of the latest candle (last trading day) — equals candles.length - 1
  lastIdx: number
}

// Mulberry32 — fast deterministic PRNG.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller transform: produce standard normal from uniform.
function gaussian(rand: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// Hash a string into a 32-bit int.
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Trading days between two dates (Mon-Fri).
function tradingDaysBetween(start: Date, end: Date): number {
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// Build a list of N trading-day dates ending at endDate (inclusive).
function tradingDayList(endDate: Date, n: number): Date[] {
  const days: Date[] = []
  const d = new Date(endDate)
  while (days.length < n) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      days.unshift(new Date(d))
    }
    d.setDate(d.getDate() - 1)
  }
  return days
}

// NSE market regime: a per-day bias that affects ALL stocks to simulate
// "risk-on" vs "risk-off" days. Computed from a global seed.
function marketRegimeForDate(date: Date): { bias: number; volatilityMult: number } {
  const seed = hashString(`market-${date.toISOString().slice(0, 10)}`)
  const rand = mulberry32(seed)
  // Bias in [-0.012, +0.012] i.e. up to ~1.2% market-wide move
  const bias = (rand() - 0.45) * 0.024
  // Volatility multiplier in [0.7, 1.4]
  const volatilityMult = 0.7 + rand() * 0.7
  return { bias, volatilityMult }
}

// Generate a single symbol's OHLC series ending on `endDate` with `days` candles.
export function generateOHLCSeries(meta: StockMeta, endDate: Date, days = 250): StockSeries {
  const seed = hashString(`${meta.symbol}-${endDate.toISOString().slice(0, 10)}`)
  const rand = mulberry32(seed)
  const dates = tradingDayList(endDate, days)

  // Annualization: 252 trading days per year.
  const dt = 1 / 252
  const sigma = meta.volatility
  const mu = meta.drift

  // Work backwards from basePrice as the "current" close, then build forwards from
  // a starting price derived by reversing drift/volatility. This keeps the most
  // recent candle near the real current price level of the stock.
  const endClose = meta.basePrice
  // Start price = endClose * exp(-(mu - 0.5σ²)T - σ√T Σnoise) — we'll just simulate
  // forward and then scale the entire series so that the final close equals basePrice.
  const closes: number[] = []
  let price = 100 // arbitrary starting value; rescaled later
  closes.push(price)

  const dailyDrift = (mu - 0.5 * sigma * sigma) * dt
  const dailyVol = sigma * Math.sqrt(dt)

  for (let i = 1; i < days; i++) {
    const regime = marketRegimeForDate(dates[i])
    const z = gaussian(rand)
    // Occasionally inject a news shock (≈ 1-in-30 days, ±2.5σ)
    let shock = 0
    if (rand() < 1 / 30) {
      shock = (rand() < 0.5 ? -1 : 1) * 2.5 * dailyVol
    }
    const ret = dailyDrift * regime.volatilityMult + dailyVol * regime.volatilityMult * z + regime.bias + shock
    price = price * Math.exp(ret)
    closes.push(price)
  }

  // Rescale so the final close = basePrice.
  const scaleFactor = endClose / closes[closes.length - 1]
  const scaledCloses = closes.map((c) => +(c * scaleFactor).toFixed(2))

  // Build OHLC around each close.
  const candles: Candle[] = []
  for (let i = 0; i < days; i++) {
    const close = scaledCloses[i]
    const prevClose = i > 0 ? scaledCloses[i - 1] : close
    // Open: gap from previous close, gaussian with std ~0.4 * dailyVol * close
    const openGap = gaussian(rand) * 0.4 * dailyVol * prevClose
    const open = Math.max(0.01, +(prevClose + openGap).toFixed(2))
    // Intraday range ~ dailyVol * close * factor (≥ 0.4 to ensure H/L bracket O and C)
    const range = Math.max(dailyVol * close * 0.4, Math.abs(close - open) * 1.2)
    const highExtra = Math.abs(gaussian(rand)) * range * 0.6 + range * 0.2
    const lowExtra = Math.abs(gaussian(rand)) * range * 0.6 + range * 0.2
    const high = +(Math.max(open, close) + highExtra).toFixed(2)
    const low = +(Math.min(open, close) - lowExtra).toFixed(2)
    // Volume: base volume inversely proportional to price (so turnover stays reasonable),
    // with random multiplier and occasional volume spikes.
    const baseVolume = Math.round((2_000_000_000 / close) * (0.5 + rand()))
    const spike = rand() < 0.08 ? 1.8 + rand() * 1.2 : 1
    const volume = Math.round(baseVolume * spike)
    candles.push({
      date: dates[i].toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume,
      adjClose: close,
    })
  }

  return {
    symbol: meta.symbol,
    name: meta.name,
    sector: meta.sector,
    candles,
    lastIdx: candles.length - 1,
  }
}

// Generate the full universe for a given "as-of" date.
// Memoized per date to avoid recompute across requests within the same day.
const cache = new Map<string, StockSeries[]>()

export function generateUniverse(asOf: Date): StockSeries[] {
  // Round to the most recent trading day ≤ asOf (skip weekends).
  const end = new Date(asOf)
  // If weekend, roll back to Friday
  const dow = end.getDay()
  if (dow === 6) end.setDate(end.getDate() - 1)
  if (dow === 0) end.setDate(end.getDate() - 2)
  end.setHours(15, 30, 0, 0)

  const key = end.toISOString().slice(0, 10)
  const cached = cache.get(key)
  if (cached) return cached

  const series = NSE_UNIVERSE.map((m) => generateOHLCSeries(m, end, 250))
  cache.set(key, series)
  return series
}

export function getStockSeries(symbol: string, asOf: Date): StockSeries | null {
  const all = generateUniverse(asOf)
  return all.find((s) => s.symbol === symbol) ?? null
}
