'use client'

// Shared types for the predictor UI. These mirror the server-side types but
// are duplicated here so the client doesn't pull server-only modules.

export type Timeframe = 'BTST' | 'SHORT_TERM' | 'MIDTERM' | 'LONG_TERM'
export type Action = 'BUY' | 'SELL' | 'AVOID'

export type HarmonicPatternName =
  | 'Gartley' | 'Perfect Gartley'
  | 'Bat' | 'Perfect Bat' | 'Alt Bat'
  | 'Butterfly' | 'Perfect Butterfly'
  | 'Crab' | 'Deep Crab' | 'Perfect Crab'
  | 'AB=CD'
  | 'Cypher'
  | 'Shark'
export type HarmonicDirection = 'Bullish' | 'Bearish'

export interface HarmonicPattern {
  name: HarmonicPatternName
  direction: HarmonicDirection
  X: number
  A: number
  B: number
  C: number
  D: number
  przLow: number
  przHigh: number
  ratioAB: number
  ratioBC: number
  ratioCD: number
  ratioXAD: number
  distFromD: number
  status: 'FORMING' | 'COMPLETED'
  description: string
}

export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  adjClose: number
}

export interface SignalFactor {
  name: string
  detail: string
  weight: number
  hit: boolean
  direction: 'bullish' | 'bearish' | 'neutral'
}

export interface IndicatorSnapshot {
  price: number
  rsi14: number
  macd: number
  macdSignal: number
  macdHist: number
  macdCross: 'bullish' | 'bearish' | 'none'
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
  patterns: string[]
  pivots: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number }
  swings: { supports: number[]; resistances: number[] }
  ret5d: number
  ret20d: number
  ret50d: number
  distFrom200: number
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
    trend: 'uptrend' | 'downtrend'
  }
  fibConfluence?: {
    isActive: boolean
    levels: string[]
    priceZone: number
    distancePct: number
  }
  harmonics?: HarmonicPattern[]
  // --- Long-term indicators (added for LONG_TERM engine) ---
  ret125d: number
  ret250d: number
  sma100: number
  maxDrawdown250: number
  drawdownFrom250High: number
  volumeAccumulation: number
  ema200Rising: boolean
  pctFrom250High: number
}

export type DataSource = 'NSE' | 'YAHOO' | 'DEMO' | 'LIVE' | 'UPSTOX'

export interface Signal {
  symbol: string
  name: string
  sector: string
  timeframe: Timeframe
  action: Action
  confidence: number
  entry: number
  entryRangeLow: number
  entryRangeHigh: number
  target1: number
  target2: number
  target3: number
  stopLoss: number
  riskReward: number
  holdingPeriod: string
  factors: SignalFactor[]
  snapshot: IndicatorSnapshot
  todayCandle: Candle
  dataSource?: DataSource
  dataQuality?: 'LIVE' | 'LIMITED' | 'SYNTHETIC'
  mlProbability?: number
  // Broker recommendation fields
  targetPrice?: number | null
  recommendation?: string | null
  recommendationMean?: number | null
  analystsCount?: number | null
}

export interface UniverseResult {
  asOf: string
  nextTradingDay: string
  // BUY signals (long)
  btst: Signal[]
  shortTerm: Signal[]
  midterm: Signal[]
  longTerm: Signal[]
  // SELL signals (short / bearish)
  btstSell: Signal[]
  shortTermSell: Signal[]
  midtermSell: Signal[]
  longTermSell: Signal[]
  breadth: {
    advancing: number
    declining: number
    unchanged: number
    strongBuys: number
    strongSells: number
  }
  topGainers: Array<{ symbol: string; name: string; changePct: number; price: number }>
  topLosers: Array<{ symbol: string; name: string; changePct: number; price: number }>
  sectorBreadth: Array<{ sector: string; advancing: number; declining: number; total: number }>
  dataSource?: {
    nseActive: boolean
    nseCount: number
    yahooCount: number
    demoCount: number
    liveCount: number
    total: number
    sources: Record<string, DataSource>
    fetchedAt: string | null
  }
}

export interface StockDetail {
  symbol: string
  name: string
  sector: string
  candles: Candle[]
  indicators: IndicatorSnapshot
  signals: Record<Timeframe, Signal>
  dataSource?: DataSource
  news?: Array<{
    title: string
    link: string
    source: string
    pubDate: string
    sentiment: 'positive' | 'negative' | 'neutral'
    score: number
  }>
  tradingViewConsensus?: {
    summary: string
    summaryScore: number
    maRating: string
    maScore: number
    oscRating: string
    oscScore: number
  }
}

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  BTST: 'BTST',
  SHORT_TERM: 'Short-term',
  MIDTERM: 'Midterm',
  LONG_TERM: 'Long-term',
}

export const TIMEFRAME_DESCRIPTIONS: Record<Timeframe, string> = {
  BTST: 'Buy Today, Sell Tomorrow — momentum continuation plays for 1-2 sessions',
  SHORT_TERM: 'Swing trades held 5-15 trading days — breakout + trend-following setups',
  MIDTERM: 'Position trades held 1-3 months — primary uptrend + structural strength',
  LONG_TERM: 'Positional investing — 6-24 months — sustained multi-quarter uptrend + risk control',
}

// Default tab order (intraday-first during market hours, BTST-first after close)
export const TIMEFRAME_ORDER: Timeframe[] = ['BTST', 'SHORT_TERM', 'MIDTERM', 'LONG_TERM']

// --- Helpers ---------------------------------------------------------------
export function formatINR(n: number | null | undefined, opts?: { compact?: boolean }): string {
  if (n == null || !isFinite(n)) return '—'
  if (opts?.compact) {
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
    if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`
  }
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPct(n: number | null | undefined, withSign = true): string {
  if (n == null || !isFinite(n)) return '—'
  const sign = n > 0 && withSign ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function confidenceColor(c: number): string {
  if (c >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (c >= 65) return 'text-green-600 dark:text-green-400'
  if (c >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
}

export function confidenceBg(c: number): string {
  if (c >= 80) return 'bg-emerald-500'
  if (c >= 65) return 'bg-green-500'
  if (c >= 50) return 'bg-amber-500'
  return 'bg-muted-foreground'
}

export function actionColor(a: Action): string {
  switch (a) {
    case 'BUY':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'SELL':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-muted-foreground'
  }
}

export function actionBadge(a: Action): string {
  switch (a) {
    case 'BUY':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
    case 'SELL':
      return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

// Style for the NSE/YAHOO/DEMO data-source badge.
export function dataSourceBadge(s: DataSource): { label: string; className: string; title: string } {
  switch (s) {
    case 'UPSTOX':
      return {
        label: '● UPSTOX',
        className: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-300 dark:border-violet-800',
        title: 'Real-time & EOD data from Upstox API v2 (connected)',
      }
    case 'NSE':
      return {
        label: '● NSE',
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        title: 'Authoritative EOD data from NSE bhavcopy (local archive)',
      }
    case 'YAHOO':
      return {
        label: '● YAHOO',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        title: 'EOD data from Yahoo Finance (free)',
      }
    case 'LIVE':
      // Legacy alias used before NSE integration
      return {
        label: '● LIVE',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        title: 'Live data',
      }
    case 'DEMO':
    default:
      return {
        label: '◐ DEMO',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        title: 'Synthetic data — all live providers unavailable for this ticker',
      }
  }
}

// Style for the data QUALITY badge (based on candle count, separate from source).
// LIVE = ≥120 candles (full indicator suite), LIMITED = 30-119, SYNTHETIC = <30.
export function dataQualityBadge(q: 'LIVE' | 'LIMITED' | 'SYNTHETIC'): { label: string; className: string; title: string } {
  switch (q) {
    case 'LIVE':
      return {
        label: '✓ Full',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        title: 'Full data — ≥120 candles, all indicators (incl. EMA 200) are valid',
      }
    case 'LIMITED':
      return {
        label: '⚠ Limited',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        title: 'Limited data — 30-119 candles, basic indicators work but EMA 200 may be unreliable',
      }
    case 'SYNTHETIC':
    default:
      return {
        label: '✗ Synthetic',
        className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300 dark:border-red-800',
        title: 'Synthetic data — fewer than 30 candles; treat signal with caution',
      }
  }
}
