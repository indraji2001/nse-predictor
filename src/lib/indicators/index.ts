// Technical indicator library — pure functions, no I/O.
// All functions take a Candle array (chronological order, oldest first) and return
// either a single number (the latest value) or a parallel array of values.
//
// Conventions:
//   - Period defaults match the most common NSE trading practice.
//   - "Series" returns are aligned to the input length — leading values that can't
//     be computed yet are filled with `NaN`.

import { Candle } from '../stocks/engine'
import { detectHarmonicPatterns, HarmonicPattern } from './harmonics'

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close)
}

export function highs(candles: Candle[]): number[] {
  return candles.map((c) => c.high)
}

export function lows(candles: Candle[]): number[] {
  return candles.map((c) => c.low)
}

export function volumes(candles: Candle[]): number[] {
  return candles.map((c) => c.volume)
}

// --- Simple Moving Average -------------------------------------------------
export function SMA(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (period <= 0) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

// --- Exponential Moving Average --------------------------------------------
export function EMA(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (period <= 0 || values.length === 0) return out
  const k = 2 / (period + 1)
  // Seed with SMA of first `period` values
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

// --- RSI (Wilder) ----------------------------------------------------------
export function RSI(candles: Candle[], period = 14): number[] {
  const out: number[] = new Array(candles.length).fill(NaN)
  if (candles.length <= period) return out
  const c = closes(candles)
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const ch = c[i] - c[i - 1]
    if (ch > 0) avgGain += ch
    else avgLoss -= ch
  }
  avgGain /= period
  avgLoss /= period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < c.length; i++) {
    const ch = c[i] - c[i - 1]
    const gain = ch > 0 ? ch : 0
    const loss = ch < 0 ? -ch : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

// --- MACD (12, 26, 9) ------------------------------------------------------
export interface MACDResult {
  macd: number[]
  signal: number[]
  histogram: number[]
}
export function MACD(candles: Candle[], fast = 12, slow = 26, signalP = 9): MACDResult {
  const c = closes(candles)
  const emaFast = EMA(c, fast)
  const emaSlow = EMA(c, slow)
  const macd = c.map((_, i) => (isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]))
  // Signal = EMA of MACD (ignoring NaN at the front by treating them as NaN — EMA seeds at first valid)
  const firstValid = macd.findIndex((v) => !isNaN(v))
  const signal: number[] = new Array(c.length).fill(NaN)
  if (firstValid >= 0) {
    const sliced = macd.slice(firstValid)
    const emaSignal = EMA(sliced, signalP)
    for (let i = 0; i < emaSignal.length; i++) signal[firstValid + i] = emaSignal[i]
  }
  const histogram = macd.map((v, i) => (isNaN(v) || isNaN(signal[i]) ? NaN : v - signal[i]))
  return { macd, signal, histogram }
}

// --- Bollinger Bands (20, 2σ) ----------------------------------------------
export interface BollingerResult {
  middle: number[]
  upper: number[]
  lower: number[]
  bandwidth: number[] // (upper - lower) / middle
  percentB: number[] // (close - lower) / (upper - lower)
}
export function BollingerBands(candles: Candle[], period = 20, mult = 2): BollingerResult {
  const c = closes(candles)
  const middle = SMA(c, period)
  const upper: number[] = new Array(c.length).fill(NaN)
  const lower: number[] = new Array(c.length).fill(NaN)
  const bandwidth: number[] = new Array(c.length).fill(NaN)
  const percentB: number[] = new Array(c.length).fill(NaN)
  for (let i = period - 1; i < c.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += (c[j] - middle[i]) ** 2
    const sd = Math.sqrt(sum / period)
    upper[i] = middle[i] + mult * sd
    lower[i] = middle[i] - mult * sd
    bandwidth[i] = middle[i] === 0 ? NaN : (upper[i] - lower[i]) / middle[i]
    percentB[i] = upper[i] === lower[i] ? 0.5 : (c[i] - lower[i]) / (upper[i] - lower[i])
  }
  return { middle, upper, lower, bandwidth, percentB }
}

// --- ATR (Wilder) ----------------------------------------------------------
export function ATR(candles: Candle[], period = 14): number[] {
  const out: number[] = new Array(candles.length).fill(NaN)
  if (candles.length <= period) return out
  const tr: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low)
    } else {
      const h = candles[i].high
      const l = candles[i].low
      const pc = candles[i - 1].close
      tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
    }
  }
  // Wilder smoothing
  let sum = 0
  for (let i = 1; i <= period; i++) sum += tr[i]
  let prev = sum / period
  out[period] = prev
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period
    out[i] = prev
  }
  return out
}

// --- Stochastic (14, 3, 3) -------------------------------------------------
export interface StochasticResult {
  k: number[]
  d: number[]
}
export function Stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): StochasticResult {
  const k: number[] = new Array(candles.length).fill(NaN)
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let hh = -Infinity
    let ll = Infinity
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hh = Math.max(hh, candles[j].high)
      ll = Math.min(ll, candles[j].low)
    }
    k[i] = hh === ll ? 50 : ((candles[i].close - ll) / (hh - ll)) * 100
  }
  // %D = SMA of %K
  const d = SMA(k.map((v) => (isNaN(v) ? 0 : v)), dPeriod).map((v, i) => (isNaN(k[i]) ? NaN : v))
  return { k, d }
}

// --- ADX (Wilder, 14) ------------------------------------------------------
export interface ADXResult {
  adx: number[]
  plusDI: number[]
  minusDI: number[]
}
export function ADX(candles: Candle[], period = 14): ADXResult {
  const n = candles.length
  const adx: number[] = new Array(n).fill(NaN)
  const plusDI: number[] = new Array(n).fill(NaN)
  const minusDI: number[] = new Array(n).fill(NaN)
  if (n <= period * 2) return { adx, plusDI, minusDI }

  const plusDM: number[] = new Array(n).fill(0)
  const minusDM: number[] = new Array(n).fill(0)
  const tr: number[] = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const upMove = candles[i].high - candles[i - 1].high
    const downMove = candles[i - 1].low - candles[i].low
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0
    const h = candles[i].high
    const l = candles[i].low
    const pc = candles[i - 1].close
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
  }
  // Wilder smoothing
  let tr14 = 0
  let plusDM14 = 0
  let minusDM14 = 0
  for (let i = 1; i <= period; i++) {
    tr14 += tr[i]
    plusDM14 += plusDM[i]
    minusDM14 += minusDM[i]
  }
  const dxArr: number[] = []
  for (let i = period + 1; i < n; i++) {
    tr14 = tr14 - tr14 / period + tr[i]
    plusDM14 = plusDM14 - plusDM14 / period + plusDM[i]
    minusDM14 = minusDM14 - minusDM14 / period + minusDM[i]
    const pdi = tr14 === 0 ? 0 : (plusDM14 / tr14) * 100
    const mdi = tr14 === 0 ? 0 : (minusDM14 / tr14) * 100
    plusDI[i] = pdi
    minusDI[i] = mdi
    const dx = pdi + mdi === 0 ? 0 : (Math.abs(pdi - mdi) / (pdi + mdi)) * 100
    dxArr.push(dx)
    if (i >= period * 2) {
      // ADX = Wilder SMA of last `period` DXs
      const slice = dxArr.slice(dxArr.length - period)
      adx[i] = slice.reduce((a, b) => a + b, 0) / period
    }
  }
  return { adx, plusDI, minusDI }
}

// --- Supertrend (10, 3) ----------------------------------------------------
export interface SupertrendResult {
  trend: number[] // +1 = uptrend (green), -1 = downtrend (red)
  value: number[] // the supertrend line value
}
export function Supertrend(candles: Candle[], period = 10, mult = 3): SupertrendResult {
  const n = candles.length
  const trend: number[] = new Array(n).fill(0)
  const value: number[] = new Array(n).fill(NaN)
  const finalUpper: number[] = new Array(n).fill(NaN)
  const finalLower: number[] = new Array(n).fill(NaN)
  if (n <= period) return { trend, value }
  const atr = ATR(candles, period)
  for (let i = period; i < n; i++) {
    if (isNaN(atr[i])) continue
    const hl2 = (candles[i].high + candles[i].low) / 2
    const basicUpper = hl2 + mult * atr[i]
    const basicLower = hl2 - mult * atr[i]
    let curUpper = basicUpper
    let curLower = basicLower
    if (i > period && !isNaN(finalUpper[i - 1])) {
      const prevClose = candles[i - 1].close
      const prevUpper = finalUpper[i - 1]
      const prevLower = finalLower[i - 1]
      curUpper = basicUpper < prevUpper || prevClose > prevUpper ? basicUpper : prevUpper
      curLower = basicLower > prevLower || prevClose < prevLower ? basicLower : prevLower
    }
    finalUpper[i] = curUpper
    finalLower[i] = curLower
    if (i === period) {
      trend[i] = candles[i].close <= curUpper ? -1 : 1
    } else {
      const prevTrend = trend[i - 1]
      if (prevTrend === 1) {
        trend[i] = candles[i].close < curLower ? -1 : 1
      } else {
        trend[i] = candles[i].close > curUpper ? 1 : -1
      }
    }
    value[i] = trend[i] === 1 ? curLower : curUpper
  }
  return { trend, value }
}

// --- VWAP (cumulative intraday) -------------------------------------------
// For daily candles we use a rolling 20-day VWAP (more useful on daily charts).
export function VWAP(candles: Candle[], period = 20): number[] {
  const out: number[] = new Array(candles.length).fill(NaN)
  for (let i = period - 1; i < candles.length; i++) {
    let pv = 0
    let vol = 0
    for (let j = i - period + 1; j <= i; j++) {
      const typical = (candles[j].high + candles[j].low + candles[j].close) / 3
      pv += typical * candles[j].volume
      vol += candles[j].volume
    }
    out[i] = vol === 0 ? NaN : pv / vol
  }
  return out
}

// --- Pivot levels (classic) -----------------------------------------------
export interface Pivots {
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
}
export function classicPivots(prevCandle: Candle): Pivots {
  const p = (prevCandle.high + prevCandle.low + prevCandle.close) / 3
  const r1 = 2 * p - prevCandle.low
  const s1 = 2 * p - prevCandle.high
  const r2 = p + (prevCandle.high - prevCandle.low)
  const s2 = p - (prevCandle.high - prevCandle.low)
  const r3 = prevCandle.high + 2 * (p - prevCandle.low)
  const s3 = prevCandle.low - 2 * (prevCandle.high - p)
  return { pivot: p, r1, r2, r3, s1, s2, s3 }
}

// --- Volume analysis -------------------------------------------------------
export interface VolumeAnalysis {
  avg20: number
  latest: number
  ratio: number // latest / avg20
  surge: boolean // ratio > 1.5
  dryup: boolean // ratio < 0.5
}
export function volumeAnalysis(candles: Candle[]): VolumeAnalysis {
  const v = volumes(candles)
  const last20 = v.slice(-20)
  const avg20 = last20.reduce((a, b) => a + b, 0) / Math.max(last20.length, 1)
  const latest = v[v.length - 1] || 0
  const ratio = avg20 === 0 ? 0 : latest / avg20
  return {
    avg20: Math.round(avg20),
    latest,
    ratio: +ratio.toFixed(2),
    surge: ratio > 1.5,
    dryup: ratio < 0.5,
  }
}

// --- Candlestick patterns (single-candle & two-candle) --------------------
export type Pattern =
  | 'BullishEngulfing'
  | 'BearishEngulfing'
  | 'Hammer'
  | 'ShootingStar'
  | 'Doji'
  | 'MorningStar'
  | 'EveningStar'
  | 'BullishMarubozu'
  | 'BearishMarubozu'
  | 'PiercingLine'
  | 'DarkCloudCover'
  | 'ThreeWhiteSoldiers'
  | 'ThreeBlackCrows'
  | 'InvertedHammer'
  | 'HangingMan'

export function detectPatterns(candles: Candle[]): Pattern[] {
  const found: Pattern[] = []
  const n = candles.length
  if (n < 3) return found
  const c1 = candles[n - 3]
  const c2 = candles[n - 2]
  const c3 = candles[n - 1]
  const body = (c: Candle) => Math.abs(c.close - c.open)
  const range = (c: Candle) => c.high - c.low
  const upperWick = (c: Candle) => c.high - Math.max(c.close, c.open)
  const lowerWick = (c: Candle) => Math.min(c.close, c.open) - c.low
  const isBull = (c: Candle) => c.close > c.open
  const isBear = (c: Candle) => c.close < c.open

  // 5-day context: prior trend for reversal pattern validation
  const priorClose5 = n >= 6 ? candles[n - 6].close : candles[0].close
  const priorDowntrend = c3.close < priorClose5 * 0.97  // down >=3% in 5 days
  const priorUptrend = c3.close > priorClose5 * 1.03    // up >=3% in 5 days

  // Bullish Engulfing: prior bearish, current bullish, body engulfs prior body
  if (isBear(c2) && isBull(c3) && c3.open <= c2.close && c3.close >= c2.open) found.push('BullishEngulfing')
  if (isBull(c2) && isBear(c3) && c3.open >= c2.close && c3.close <= c2.open) found.push('BearishEngulfing')

  // Hammer: small body at top, long lower wick (>=2x body), after downtrend
  if (lowerWick(c3) >= 2 * body(c3) && upperWick(c3) < body(c3) && body(c3) / range(c3) < 0.4 && priorDowntrend) found.push('Hammer')

  // Shooting Star: small body at bottom, long upper wick, after uptrend
  if (upperWick(c3) >= 2 * body(c3) && lowerWick(c3) < body(c3) && body(c3) / range(c3) < 0.4 && priorUptrend) found.push('ShootingStar')

  // Inverted Hammer: like shooting star shape but after downtrend (bullish reversal)
  if (upperWick(c3) >= 2 * body(c3) && lowerWick(c3) < body(c3) && body(c3) / range(c3) < 0.4 && priorDowntrend && isBull(c3)) found.push('InvertedHammer')

  // Hanging Man: like hammer shape but after uptrend (bearish reversal)
  if (lowerWick(c3) >= 2 * body(c3) && upperWick(c3) < body(c3) && body(c3) / range(c3) < 0.4 && priorUptrend && isBear(c3)) found.push('HangingMan')

  // Doji: body <= 10% of range
  if (range(c3) > 0 && body(c3) / range(c3) < 0.1) found.push('Doji')

  // Morning Star: bearish, small body, bullish with close above midpoint of first
  if (
    isBear(c1) &&
    body(c2) < body(c1) * 0.5 &&
    isBull(c3) &&
    c3.close > (c1.open + c1.close) / 2
  ) found.push('MorningStar')
  if (
    isBull(c1) &&
    body(c2) < body(c1) * 0.5 &&
    isBear(c3) &&
    c3.close < (c1.open + c1.close) / 2
  ) found.push('EveningStar')

  // Marubozu: very small wicks (<=5% of range)
  if (isBull(c3) && upperWick(c3) < 0.05 * range(c3) && lowerWick(c3) < 0.05 * range(c3)) found.push('BullishMarubozu')
  if (isBear(c3) && upperWick(c3) < 0.05 * range(c3) && lowerWick(c3) < 0.05 * range(c3)) found.push('BearishMarubozu')

  // Piercing Line
  if (
    isBear(c2) &&
    isBull(c3) &&
    c3.open < c2.low &&
    c3.close > (c2.open + c2.close) / 2 &&
    c3.close < c2.open
  ) found.push('PiercingLine')

  // Dark Cloud Cover
  if (
    isBull(c2) &&
    isBear(c3) &&
    c3.open > c2.high &&
    c3.close < (c2.open + c2.close) / 2 &&
    c3.close > c2.open
  ) found.push('DarkCloudCover')

  // Three White Soldiers: 3 consecutive bullish candles with higher closes, small upper wicks
  if (n >= 3 && isBull(c1) && isBull(c2) && isBull(c3) &&
      c2.close > c1.close && c3.close > c2.close &&
      c2.open > c1.open && c3.open > c2.open &&
      upperWick(c1) < body(c1) * 0.3 && upperWick(c2) < body(c2) * 0.3 && upperWick(c3) < body(c3) * 0.3
  ) found.push('ThreeWhiteSoldiers')

  // Three Black Crows: 3 consecutive bearish candles with lower closes, small lower wicks
  if (n >= 3 && isBear(c1) && isBear(c2) && isBear(c3) &&
      c2.close < c1.close && c3.close < c2.close &&
      c2.open < c1.open && c3.open < c2.open &&
      lowerWick(c1) < body(c1) * 0.3 && lowerWick(c2) < body(c2) * 0.3 && lowerWick(c3) < body(c3) * 0.3
  ) found.push('ThreeBlackCrows')

  return found
}

// --- Support / Resistance (recent swing highs/lows) -----------------------
export interface SwingLevels {
  supports: number[]
  resistances: number[]
}
export function swingLevels(candles: Candle[], lookback = 20): SwingLevels {
  const slice = candles.slice(-lookback)
  const supports: number[] = []
  const resistances: number[] = []
  for (let i = 2; i < slice.length - 2; i++) {
    const c = slice[i]
    if (c.low < slice[i - 1].low && c.low < slice[i - 2].low && c.low < slice[i + 1].low && c.low < slice[i + 2].low) {
      supports.push(c.low)
    }
    if (c.high > slice[i - 1].high && c.high > slice[i - 2].high && c.high > slice[i + 1].high && c.high > slice[i + 2].high) {
      resistances.push(c.high)
    }
  }
  // De-dup nearby levels (within 0.5%)
  const dedup = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b)
    const out: number[] = []
    for (const v of sorted) {
      if (out.length === 0 || Math.abs(v - out[out.length - 1]) / out[out.length - 1] > 0.005) out.push(v)
    }
    return out
  }
  return { supports: dedup(supports), resistances: dedup(resistances) }
}

// --- Convenience: latest values of all indicators --------------------------
export interface IndicatorSnapshot {
  price: number
  rsi14: number
  macd: number
  macdSignal: number
  macdHist: number
  macdCross: 'bullish' | 'bearish' | 'none' // today's crossover direction
  ema9: number
  ema21: number
  ema50: number
  ema200: number
  sma20: number
  sma50: number
  sma200: number
  bbUpper: number
  bbMiddle: number
  bbLower: number
  bbPercentB: number
  bbBandwidth: number
  atr14: number
  stochK: number
  stochD: number
  adx: number
  plusDI: number
  minusDI: number
  supertrendTrend: 1 | -1
  supertrendValue: number
  vwap20: number
  volumeRatio: number
  patterns: Pattern[]
  pivots: Pivots
  swings: SwingLevels
  // 5-day, 20-day, 50-day returns (short/mid-term momentum)
  ret5d: number
  ret20d: number
  ret50d: number
  // Distance from 200 DMA in %
  distFrom200: number
  // --- Long-term indicators (added for LONG_TERM engine) ---
  // 125-day (~6-month) and 250-day (~1-year) returns
  ret125d: number
  ret250d: number
  // 100-day and 250-day SMAs (long-term trend)
  sma100: number
  // Maximum drawdown over the last 250 trading days (% peak-to-trough)
  // Lower = better risk control. Stocks with <30% drawdowns are long-term-quality.
  maxDrawdown250: number
  // Current drawdown from 250-day high (negative number, e.g. -8.5 means 8.5% off high)
  drawdownFrom250High: number
  // 60-day average volume vs 250-day average volume (accumulation signal if >1.05)
  volumeAccumulation: number
  // 200 EMA slope (rising/falling over last 20 days) — true if 200 EMA rising
  ema200Rising: boolean
  // Distance from 250-day high (how extended the stock is from its peak)
  pctFrom250High: number
  fib?: {
    high: number
    low: number
    fib236: number
    fib382: number
    fib500: number
    fib618: number
    fib786: number
    closestLevel: string
    distancePct: number
  }
  fibConfluence?: {
    isActive: boolean
    levels: string[]
    priceZone: number
    distancePct: number
  }
  harmonics?: HarmonicPattern[]
}

export interface FibonacciLevels {
  high: number
  low: number
  fib236: number
  fib382: number
  fib500: number
  fib618: number
  fib786: number
  closestLevel: string
  distancePct: number
}

export function computeFibonacci(candles: Candle[], lookback = 100): FibonacciLevels {
  const slice = candles.slice(-Math.min(lookback, candles.length))
  let high = -Infinity
  let low = Infinity
  for (const c of slice) {
    if (c.high > high) high = c.high
    if (c.low < low) low = c.low
  }
  const diff = high - low
  const fib236 = high - 0.236 * diff
  const fib382 = high - 0.382 * diff
  const fib500 = high - 0.500 * diff
  const fib618 = high - 0.618 * diff
  const fib786 = high - 0.786 * diff

  const currentPrice = candles[candles.length - 1]?.close ?? 0
  const levels = [
    { name: '23.6%', val: fib236 },
    { name: '38.2%', val: fib382 },
    { name: '50.0%', val: fib500 },
    { name: '61.8%', val: fib618 },
    { name: '78.6%', val: fib786 }
  ]
  let closest = levels[0]
  let minDistance = Math.abs(currentPrice - closest.val)
  for (let i = 1; i < levels.length; i++) {
    const dist = Math.abs(currentPrice - levels[i].val)
    if (dist < minDistance) {
      minDistance = dist
      closest = levels[i]
    }
  }
  const distancePct = currentPrice > 0 ? (minDistance / currentPrice) * 100 : 0
  return {
    high,
    low,
    fib236,
    fib382,
    fib500,
    fib618,
    fib786,
    closestLevel: closest.name,
    distancePct
  }
}

export interface FibConfluence {
  isActive: boolean
  levels: string[]
  priceZone: number
  distancePct: number
}

export function detectFibConfluence(
  candles: Candle[],
  ema50: number,
  ema200: number,
  swings: SwingLevels
): FibConfluence {
  const currentPrice = candles[candles.length - 1]?.close ?? 0
  if (currentPrice === 0) return { isActive: false, levels: [], priceZone: 0, distancePct: 0 }

  const fib50 = computeFibonacci(candles, 50)
  const fib150 = computeFibonacci(candles, 150)

  // Aggregate all major support reference lines
  const refLines = [
    { name: '38.2% (50d)', val: fib50.fib382 },
    { name: '50.0% (50d)', val: fib50.fib500 },
    { name: '61.8% (50d)', val: fib50.fib618 },
    { name: '38.2% (150d)', val: fib150.fib382 },
    { name: '50.0% (150d)', val: fib150.fib500 },
    { name: '61.8% (150d)', val: fib150.fib618 },
    { name: '78.6% (150d)', val: fib150.fib786 },
    { name: 'EMA50', val: ema50 },
    { name: 'EMA200', val: ema200 }
  ]

  // Add the closest swing supports
  swings.supports.forEach((s, idx) => {
    refLines.push({ name: `Swing Support ${idx + 1}`, val: s })
  })

  // We look for overlaps: two reference lines that are within 1.2% of each other
  // AND the current price is within 1.5% of this overlap zone.
  let bestZone: { val1: number; val2: number; name1: string; name2: string; distanceToPrice: number } | null = null
  let minPriceDist = Infinity

  for (let i = 0; i < refLines.length; i++) {
    for (let j = i + 1; j < refLines.length; j++) {
      const line1 = refLines[i]
      const line2 = refLines[j]
      
      if (isNaN(line1.val) || isNaN(line2.val)) continue

      // Check if lines overlap within 1.2%
      const overlapPct = (Math.abs(line1.val - line2.val) / ((line1.val + line2.val) / 2)) * 100
      if (overlapPct <= 1.2) {
        // Average price of the confluence zone
        const zonePrice = (line1.val + line2.val) / 2
        const priceDistPct = (Math.abs(currentPrice - zonePrice) / currentPrice) * 100
        
        // If price is within 1.5% of this confluence zone
        if (priceDistPct <= 1.5 && priceDistPct < minPriceDist) {
          minPriceDist = priceDistPct
          bestZone = {
            val1: line1.val,
            val2: line2.val,
            name1: line1.name,
            name2: line2.name,
            distanceToPrice: priceDistPct
          }
        }
      }
    }
  }

  if (bestZone) {
    return {
      isActive: true,
      levels: [bestZone.name1, bestZone.name2],
      priceZone: +((bestZone.val1 + bestZone.val2) / 2).toFixed(2),
      distancePct: +bestZone.distanceToPrice.toFixed(2)
    }
  }

  return { isActive: false, levels: [], priceZone: 0, distancePct: 0 }
}

export function computeIndicators(candles: Candle[]): IndicatorSnapshot {
  const c = closes(candles)
  const n = c.length
  const last = n - 1
  const rsiArr = RSI(candles, 14)
  const macdRes = MACD(candles)
  const bb = BollingerBands(candles, 20, 2)
  const atrArr = ATR(candles, 14)
  const stoch = Stochastic(candles, 14, 3)
  const adxRes = ADX(candles, 14)
  const supertrend = Supertrend(candles, 10, 3)
  const vwapArr = VWAP(candles, 20)
  const ema9 = EMA(c, 9)
  const ema21 = EMA(c, 21)
  const ema50 = EMA(c, 50)
  const ema200 = EMA(c, 200)
  const sma20 = SMA(c, 20)
  const sma50 = SMA(c, 50)
  const sma100 = SMA(c, 100)
  const sma200 = SMA(c, 200)

  const v = (a: number[]) => a[last]
  const macdPrev = macdRes.macd[last - 1]
  const macdSigPrev = macdRes.signal[last - 1]
  const macdCur = macdRes.macd[last]
  const macdSigCur = macdRes.signal[last]
  let macdCross: 'bullish' | 'bearish' | 'none' = 'none'
  if (!isNaN(macdPrev) && !isNaN(macdSigPrev) && !isNaN(macdCur) && !isNaN(macdSigCur)) {
    if (macdPrev <= macdSigPrev && macdCur > macdSigCur) macdCross = 'bullish'
    else if (macdPrev >= macdSigPrev && macdCur < macdSigCur) macdCross = 'bearish'
  }

  const vol = volumeAnalysis(candles)
  const pivots = classicPivots(candles[last - 1])
  const swings = swingLevels(candles, 20)

  const ret = (p: number) => (c[last - p] ? (c[last] / c[last - p] - 1) * 100 : NaN)
  const distFrom200 = !isNaN(sma200[last]) ? ((c[last] - sma200[last]) / sma200[last]) * 100 : NaN

  // --- Long-term indicators ---
  const ret125d = ret(125)
  const ret250d = ret(250)
  // 200 EMA slope — compare current 200 EMA to 20 days ago
  const ema200Rising = !isNaN(ema200[last]) && !isNaN(ema200[Math.max(0, last - 20)]) && ema200[last] > ema200[Math.max(0, last - 20)]
  // Max drawdown over last 250 trading days
  const lookback250 = Math.max(0, n - 250)
  let peak = c[lookback250]
  let maxDD = 0
  for (let i = lookback250; i <= last; i++) {
    if (c[i] > peak) peak = c[i]
    const dd = ((c[i] - peak) / peak) * 100
    if (dd < maxDD) maxDD = dd
  }
  const maxDrawdown250 = maxDD // negative number, e.g. -25.5 = 25.5% peak-to-trough
  // Current drawdown from 250-day high
  let high250 = 0
  for (let i = lookback250; i <= last; i++) high250 = Math.max(high250, c[i])
  const drawdownFrom250High = high250 > 0 ? ((c[last] - high250) / high250) * 100 : 0
  const pctFrom250High = -drawdownFrom250High // positive number, e.g. 8.5 = 8.5% below peak
  // Volume accumulation: 60-day avg vs 250-day avg
  const allVol = candles.map((cd) => cd.volume)
  const avg60 = allVol.slice(Math.max(0, last - 60)).reduce((s, x) => s + x, 0) / Math.min(60, last + 1)
  const avg250 = allVol.slice(lookback250).reduce((s, x) => s + x, 0) / Math.max(1, last - lookback250 + 1)
  const volumeAccumulation = avg250 > 0 ? avg60 / avg250 : 1

  return {
    price: c[last],
    rsi14: v(rsiArr),
    macd: macdCur,
    macdSignal: macdSigCur,
    macdHist: macdRes.histogram[last],
    macdCross,
    ema9: v(ema9),
    ema21: v(ema21),
    ema50: v(ema50),
    ema200: v(ema200),
    sma20: v(sma20),
    sma50: v(sma50),
    sma100: v(sma100),
    sma200: v(sma200),
    bbUpper: v(bb.upper),
    bbMiddle: v(bb.middle),
    bbLower: v(bb.lower),
    bbPercentB: v(bb.percentB),
    bbBandwidth: v(bb.bandwidth),
    atr14: v(atrArr),
    stochK: v(stoch.k),
    stochD: v(stoch.d),
    adx: v(adxRes.adx),
    plusDI: v(adxRes.plusDI),
    minusDI: v(adxRes.minusDI),
    supertrendTrend: (v(supertrend.trend) === 1 ? 1 : -1),
    supertrendValue: v(supertrend.value),
    vwap20: v(vwapArr),
    volumeRatio: vol.ratio,
    patterns: detectPatterns(candles),
    pivots,
    swings,
    ret5d: ret(5),
    ret20d: ret(20),
    ret50d: ret(50),
    distFrom200,
    // Long-term
    ret125d,
    ret250d,
    maxDrawdown250,
    drawdownFrom250High,
    volumeAccumulation,
    ema200Rising,
    pctFrom250High,
    fib: computeFibonacci(candles, 100),
    fibConfluence: detectFibConfluence(candles, v(ema50), v(ema200), swings),
    harmonics: detectHarmonicPatterns(candles),
  }
}
