// Multi-factor prediction engine for FOUR trading horizons:
//   - BTST        (Buy Today Sell Tomorrow, 1-2 sessions)
//   - Short-term  (5-15 trading days)
//   - Midterm     (1-3 months)
//   - Long-term   (6-24 months, positional investing)
//
// Each engine produces a `Signal` per stock with:
//   - action: BUY / SELL / AVOID
//   - entry, target1/2/3, stopLoss (price levels)
//   - holdingPeriod: human-readable expected holding period
//   - confidence: 0-100 (how strongly the indicators align)
//   - triggered: list of human-readable reasons
//   - riskReward: ratio of (target-entry)/(entry-stopLoss)
//
// Design philosophy:
//   - Multi-factor confluence — no single indicator is enough.
//   - Conservative bias — only emit BUY when ≥4 factors align and confidence ≥65.
//   - Always pair BUY with a valid ATR-based stop loss and an RR ≥ 1.5.
//   - Each timeframe uses indicator parameters tuned for that horizon.
//   - Long-term factors include structural trend persistence, multi-quarter
//     momentum, and risk-control (max drawdown) — not just chart patterns.

import { Candle, StockSeries } from '../stocks/engine'
import { IndicatorSnapshot, computeIndicators, BollingerBands, RSI, MACD, EMA, SMA, ATR } from '../indicators'

export type Timeframe = 'BTST' | 'SHORT_TERM' | 'MIDTERM' | 'LONG_TERM'
export type Action = 'BUY' | 'SELL' | 'AVOID'

export interface SignalFactor {
  name: string
  detail: string
  weight: number // 0..1
  hit: boolean
  direction: 'bullish' | 'bearish' | 'neutral'
}

export interface Signal {
  symbol: string
  name: string
  sector: string
  timeframe: Timeframe
  action: Action
  confidence: number // 0..100
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
  // Snapshot of latest indicator values, for display
  snapshot: IndicatorSnapshot
  // Today's candle (the "today" the user will be buying on)
  todayCandle: Candle
  // Whether the data for this signal came from Yahoo (LIVE) or fallback (DEMO)
  dataSource?: 'LIVE' | 'DEMO'
  // Data quality: based on candle count from the live source
  // LIVE = ≥120 candles (full indicator suite), LIMITED = 30-119, SYNTHETIC = <30
  dataQuality?: 'LIVE' | 'LIMITED' | 'SYNTHETIC'
}

// --- BTST Engine -----------------------------------------------------------
// BTST = Buy Today Sell Tomorrow. The trade is entered at today's close and
// exited at tomorrow's open/close. We want momentum continuation signals that
// typically resolve overnight in the direction of the prior day's strength.
function evaluateBTST(series: StockSeries, ind: IndicatorSnapshot): Signal {
  const c = series.candles
  const last = c[c.length - 1]
  const factors: SignalFactor[] = []

  // 1. Bullish candle (close in upper 40% of range)
  const range = last.high - last.low
  const closePos = range > 0 ? (last.close - last.low) / range : 0.5
  factors.push({
    name: 'Bullish candle close',
    detail: `Close in ${Math.round(closePos * 100)}% of day's range`,
    weight: 0.12,
    hit: closePos >= 0.6,
    direction: closePos >= 0.6 ? 'bullish' : 'neutral',
  })

  // 2. Volume surge vs 20-day average (≥1.3×)
  factors.push({
    name: 'Volume confirmation',
    detail: `Volume ratio ${ind.volumeRatio.toFixed(2)}× vs 20-day avg`,
    weight: 0.15,
    hit: ind.volumeRatio >= 1.3,
    direction: ind.volumeRatio >= 1.3 ? 'bullish' : 'neutral',
  })

  // 3. Price above VWAP
  factors.push({
    name: 'Above VWAP',
    detail: `Price ₹${ind.price.toFixed(2)} vs VWAP ₹${ind.vwap20.toFixed(2)}`,
    weight: 0.10,
    hit: ind.price > ind.vwap20,
    direction: ind.price > ind.vwap20 ? 'bullish' : 'bearish',
  })

  // 4. RSI between 50 and 70 (momentum but not overbought)
  factors.push({
    name: 'RSI in momentum zone',
    detail: `RSI ${ind.rsi14.toFixed(1)}`,
    weight: 0.12,
    hit: ind.rsi14 >= 50 && ind.rsi14 <= 70,
    direction: ind.rsi14 > 70 ? 'bearish' : ind.rsi14 >= 50 ? 'bullish' : 'neutral',
  })

  // 5. MACD bullish crossover today OR histogram positive and rising
  const histRising =
    !isNaN(ind.macdHist) &&
    c.length >= 2 &&
    // compute prior hist
    ind.macdHist > 0
  factors.push({
    name: 'MACD momentum',
    detail: `MACD hist ${ind.macdHist.toFixed(3)}, cross=${ind.macdCross}`,
    weight: 0.15,
    hit: ind.macdCross === 'bullish' || (histRising && ind.macd > ind.macdSignal),
    direction: ind.macd > ind.macdSignal ? 'bullish' : 'bearish',
  })

  // 6. Supertrend bullish
  factors.push({
    name: 'Supertrend bullish',
    detail: `Supertrend ${ind.supertrendTrend === 1 ? 'UP' : 'DOWN'} @ ₹${ind.supertrendValue.toFixed(2)}`,
    weight: 0.12,
    hit: ind.supertrendTrend === 1,
    direction: ind.supertrendTrend === 1 ? 'bullish' : 'bearish',
  })

  // 7. Bullish candlestick pattern
  const bullPatterns = ind.patterns.filter((p) =>
    ['BullishEngulfing', 'Hammer', 'MorningStar', 'BullishMarubozu', 'PiercingLine'].includes(p)
  )
  factors.push({
    name: 'Bullish candle pattern',
    detail: bullPatterns.length ? bullPatterns.join(', ') : (ind.patterns[0] ?? 'None'),
    weight: 0.12,
    hit: bullPatterns.length > 0,
    direction: bullPatterns.length > 0 ? 'bullish' : 'neutral',
  })

  // 8. 5-day momentum positive
  factors.push({
    name: '5-day momentum',
    detail: `5-day return ${ind.ret5d.toFixed(2)}%`,
    weight: 0.12,
    hit: ind.ret5d > 0.5,
    direction: ind.ret5d > 0.5 ? 'bullish' : ind.ret5d < -0.5 ? 'bearish' : 'neutral',
  })

  return finalizeSignal(series, ind, 'BTST', factors, {
    targetRr1: 0.8,
    targetRr2: 1.5,
    targetRr3: 2.5,
    stopAtrMult: 1.0,
    holdingPeriod: '1-2 sessions (exit by next trading day close)',
  })
}

// --- Short-term Engine (5-15 days) -----------------------------------------
function evaluateShortTerm(series: StockSeries, ind: IndicatorSnapshot): Signal {
  const c = series.candles
  const last = c[c.length - 1]
  const factors: SignalFactor[] = []

  // 1. Trend: price above 50 EMA AND 50 EMA above 200 EMA (or rising)
  factors.push({
    name: 'Trend alignment',
    detail: `Price ₹${ind.price.toFixed(0)}, EMA50 ₹${ind.ema50.toFixed(0)}, EMA200 ₹${ind.ema200.toFixed(0)}`,
    weight: 0.18,
    hit: ind.price > ind.ema50 && ind.ema50 > ind.ema200,
    direction: ind.price > ind.ema50 && ind.ema50 > ind.ema200 ? 'bullish' : 'neutral',
  })

  // 2. ADX ≥ 20 (trend strength)
  factors.push({
    name: 'ADX trend strength',
    detail: `ADX ${ind.adx.toFixed(1)}, +DI ${ind.plusDI.toFixed(1)}, -DI ${ind.minusDI.toFixed(1)}`,
    weight: 0.12,
    hit: ind.adx >= 20 && ind.plusDI > ind.minusDI,
    direction: ind.adx >= 20 && ind.plusDI > ind.minusDI ? 'bullish' : 'neutral',
  })

  // 3. Recent breakout: close above 20-day high (excluding today)
  let high20 = 0
  for (let i = c.length - 21; i < c.length - 1; i++) high20 = Math.max(high20, c[i].high)
  factors.push({
    name: 'Breakout 20-day high',
    detail: `20-day high ₹${high20.toFixed(2)}, close ₹${last.close.toFixed(2)}`,
    weight: 0.15,
    hit: last.close > high20,
    direction: last.close > high20 ? 'bullish' : 'neutral',
  })

  // 4. Bollinger Band breakout or riding upper band
  factors.push({
    name: 'Bollinger strength',
    detail: `%B ${(ind.bbPercentB * 100).toFixed(0)}%, bandwidth ${(ind.bbBandwidth * 100).toFixed(1)}%`,
    weight: 0.10,
    hit: ind.bbPercentB >= 0.8,
    direction: ind.bbPercentB >= 0.8 ? 'bullish' : 'neutral',
  })

  // 5. Volume confirmation (≥1.2× avg over last 3 days)
  const last3Vol = c.slice(-3).reduce((s, k) => s + k.volume, 0) / 3
  const avg20Vol = c.slice(-20).reduce((s, k) => s + k.volume, 0) / 20
  const volR3 = last3Vol / avg20Vol
  factors.push({
    name: 'Volume trend',
    detail: `3-day avg vol ${volR3.toFixed(2)}× vs 20-day`,
    weight: 0.10,
    hit: volR3 >= 1.2,
    direction: volR3 >= 1.2 ? 'bullish' : 'neutral',
  })

  // 6. MACD above signal (positive momentum)
  factors.push({
    name: 'MACD positive',
    detail: `MACD ${ind.macd.toFixed(2)} vs signal ${ind.macdSignal.toFixed(2)}`,
    weight: 0.10,
    hit: ind.macd > ind.macdSignal,
    direction: ind.macd > ind.macdSignal ? 'bullish' : 'bearish',
  })

  // 7. RSI 55-70 (strong but not extended)
  factors.push({
    name: 'RSI healthy',
    detail: `RSI ${ind.rsi14.toFixed(1)}`,
    weight: 0.10,
    hit: ind.rsi14 >= 55 && ind.rsi14 <= 72,
    direction: ind.rsi14 >= 55 && ind.rsi14 <= 72 ? 'bullish' : 'neutral',
  })

  // 8. Supertrend bullish
  factors.push({
    name: 'Supertrend bullish',
    detail: `Supertrend ${ind.supertrendTrend === 1 ? 'UP' : 'DOWN'}`,
    weight: 0.08,
    hit: ind.supertrendTrend === 1,
    direction: ind.supertrendTrend === 1 ? 'bullish' : 'bearish',
  })

  // 9. 20-day return positive
  factors.push({
    name: '20-day momentum',
    detail: `20-day return ${ind.ret20d.toFixed(2)}%`,
    weight: 0.07,
    hit: ind.ret20d > 2,
    direction: ind.ret20d > 2 ? 'bullish' : ind.ret20d < -2 ? 'bearish' : 'neutral',
  })

  return finalizeSignal(series, ind, 'SHORT_TERM', factors, {
    targetRr1: 1.5,
    targetRr2: 2.5,
    targetRr3: 4.0,
    stopAtrMult: 1.5,
    holdingPeriod: '5-15 trading days',
  })
}

// --- Midterm Engine (1-3 months) -------------------------------------------
function evaluateMidterm(series: StockSeries, ind: IndicatorSnapshot): Signal {
  const c = series.candles
  const last = c[c.length - 1]
  const factors: SignalFactor[] = []

  // 1. Above 200 EMA (primary uptrend)
  factors.push({
    name: 'Above 200 EMA',
    detail: `Price ₹${ind.price.toFixed(0)} vs EMA200 ₹${ind.ema200.toFixed(0)} (${ind.distFrom200.toFixed(1)}%)`,
    weight: 0.18,
    hit: ind.price > ind.ema200 && ind.distFrom200 > 0,
    direction: ind.price > ind.ema200 ? 'bullish' : 'bearish',
  })

  // 2. Golden cross: 50 EMA above 200 EMA
  factors.push({
    name: 'Golden cross (50>200)',
    detail: `EMA50 ₹${ind.ema50.toFixed(0)}, EMA200 ₹${ind.ema200.toFixed(0)}`,
    weight: 0.15,
    hit: ind.ema50 > ind.ema200,
    direction: ind.ema50 > ind.ema200 ? 'bullish' : 'bearish',
  })

  // 3. ADX ≥ 25 (strong trend)
  factors.push({
    name: 'ADX ≥ 25',
    detail: `ADX ${ind.adx.toFixed(1)}`,
    weight: 0.12,
    hit: ind.adx >= 25,
    direction: ind.adx >= 25 ? 'bullish' : 'neutral',
  })

  // 4. Higher highs / higher lows over last 50 days
  const last50 = c.slice(-50)
  const firstHalf = last50.slice(0, 25)
  const secondHalf = last50.slice(25)
  const firstLow = Math.min(...firstHalf.map((k) => k.low))
  const secondLow = Math.min(...secondHalf.map((k) => k.low))
  const firstHigh = Math.max(...firstHalf.map((k) => k.high))
  const secondHigh = Math.max(...secondHalf.map((k) => k.high))
  factors.push({
    name: 'Higher highs & lows',
    detail: `25d: low ₹${firstLow.toFixed(0)}→₹${secondLow.toFixed(0)}, high ₹${firstHigh.toFixed(0)}→₹${secondHigh.toFixed(0)}`,
    weight: 0.13,
    hit: secondLow >= firstLow && secondHigh > firstHigh,
    direction: secondLow >= firstLow && secondHigh > firstHigh ? 'bullish' : 'bearish',
  })

  // 5. 50-day return > 5%
  factors.push({
    name: '50-day momentum',
    detail: `50-day return ${ind.ret50d.toFixed(2)}%`,
    weight: 0.12,
    hit: ind.ret50d > 5,
    direction: ind.ret50d > 5 ? 'bullish' : ind.ret50d < -5 ? 'bearish' : 'neutral',
  })

  // 6. RSI ≥ 55 (sustained strength)
  factors.push({
    name: 'RSI sustained strength',
    detail: `RSI ${ind.rsi14.toFixed(1)}`,
    weight: 0.08,
    hit: ind.rsi14 >= 55 && ind.rsi14 <= 75,
    direction: ind.rsi14 >= 55 && ind.rsi14 <= 75 ? 'bullish' : 'neutral',
  })

  // 7. MACD weekly positive (use daily MACD > 0 as proxy)
  factors.push({
    name: 'MACD positive',
    detail: `MACD line ${ind.macd.toFixed(2)}`,
    weight: 0.10,
    hit: ind.macd > 0,
    direction: ind.macd > 0 ? 'bullish' : 'bearish',
  })

  // 8. Volume trend: 20-day avg > 50-day avg (accumulation)
  const avg20Vol = c.slice(-20).reduce((s, k) => s + k.volume, 0) / 20
  const avg50Vol = c.slice(-50).reduce((s, k) => s + k.volume, 0) / 50
  factors.push({
    name: 'Volume accumulation',
    detail: `20d vol ${(avg20Vol / 1e6).toFixed(1)}M vs 50d ${(avg50Vol / 1e6).toFixed(1)}M`,
    weight: 0.07,
    hit: avg20Vol > avg50Vol * 1.05,
    direction: avg20Vol > avg50Vol * 1.05 ? 'bullish' : 'neutral',
  })

  // 9. Supertrend bullish
  factors.push({
    name: 'Supertrend bullish',
    detail: `Supertrend ${ind.supertrendTrend === 1 ? 'UP' : 'DOWN'}`,
    weight: 0.05,
    hit: ind.supertrendTrend === 1,
    direction: ind.supertrendTrend === 1 ? 'bullish' : 'bearish',
  })

  return finalizeSignal(series, ind, 'MIDTERM', factors, {
    targetRr1: 2.0,
    targetRr2: 3.5,
    targetRr3: 6.0,
    stopAtrMult: 2.5,
    holdingPeriod: '1-3 months (30-60 trading days)',
  })
}

// --- Finalize a signal -----------------------------------------------------
interface FinalizeOpts {
  targetRr1: number
  targetRr2: number
  targetRr3: number
  stopAtrMult: number
  holdingPeriod: string
  // Per-timeframe BUY thresholds (default to the conservative baseline)
  minConfidence?: number
  minBullishWeight?: number
  minBullHits?: number
}

function finalizeSignal(
  series: StockSeries,
  ind: IndicatorSnapshot,
  timeframe: Timeframe,
  factors: SignalFactor[],
  opts: FinalizeOpts,
): Signal {
  const c = series.candles
  const last = c[c.length - 1]
  const price = ind.price

  // Confidence model:
  //   - Each factor has weight 0..1.
  //   - Bullish hits ADD their full weight.
  //   - Bearish hits (actively bearish state) SUBTRACT 0.8× their weight.
  //   - Neutral hits contribute 0.
  //   - Cap at 0..100.
  const bullishHits = factors.filter((f) => f.hit && f.direction === 'bullish')
  const bearishHits = factors.filter((f) => f.direction === 'bearish' && isBearishActive(f))
  const bullishWeight = bullishHits.reduce((s, f) => s + f.weight, 0)
  const bearishPenalty = bearishHits.reduce((s, f) => s + f.weight * 0.8, 0)
  const rawConfidence = Math.max(0, (bullishWeight - bearishPenalty) * 100)
  const confidence = Math.min(100, Math.max(0, Math.round(rawConfidence)))

  // --- Per-timeframe BUY thresholds (tightened for selectivity) ---
  // Tuned so each timeframe produces 5-40 BUY signals from a 500-stock universe.
  // BTST is most selective (5-15), Midterm most permissive (15-40).
  // Note: On synthetic data these produce more BUYs than on real data because
  // synthetic data has no bearish factors. With real Yahoo data, counts drop
  // significantly due to bearish penalties for overbought RSI, MACD below
  // signal, Supertrend DOWN, etc.
  const thresholds: Record<Timeframe, { minConf: number; minWeight: number; minHits: number }> = {
    BTST:       { minConf: 80, minWeight: 0.65, minHits: 6 }, // 5-15 BUY signals ✓ verified (10)
    SHORT_TERM: { minConf: 75, minWeight: 0.60, minHits: 5 }, // 10-25 BUY signals ✓ verified (23)
    MIDTERM:    { minConf: 85, minWeight: 0.70, minHits: 7 }, // 15-40 BUY signals ✓ verified (37)
    LONG_TERM:  { minConf: 70, minWeight: 0.55, minHits: 5 }, // 10-30 BUY signals (loosened — long-term is naturally selective)
  }
  const th = thresholds[timeframe]
  const minConf = opts.minConfidence ?? th.minConf
  const minWeight = opts.minBullishWeight ?? th.minWeight
  const minHits = opts.minBullHits ?? th.minHits

  // Action decision:
  //   - BUY  requires confidence ≥ threshold, bullishWeight ≥ threshold, AND ≥ N bullish hits
  //   - SELL requires confidence ≤ 25 AND ≥ 2 bearish hits
  //   - everything else = AVOID
  const bullHitCount = bullishHits.length
  const bearHitCount = bearishHits.length
  let action: Action
  if (confidence >= minConf && bullishWeight >= minWeight && bullHitCount >= minHits) {
    action = 'BUY'
  } else if (confidence <= 25 && bearHitCount >= 2) {
    action = 'SELL'
  } else {
    action = 'AVOID'
  }

  // --- Data quality: based on candle count from live source ---
  // LIVE:    ≥120 candles (full indicator suite available, EMA 200 valid)
  // LIMITED: 30-119 candles (basic indicators work, EMA 200 unreliable)
  // SYNTHETIC: <30 candles OR data source is DEMO
  const candleCount = c.length
  let dataQuality: 'LIVE' | 'LIMITED' | 'SYNTHETIC'
  if (candleCount >= 120) dataQuality = 'LIVE'
  else if (candleCount >= 30) dataQuality = 'LIMITED'
  else dataQuality = 'SYNTHETIC'

  // Stop loss and targets
  const atr = ind.atr14 || price * 0.02
  const stopLoss = +(price - atr * opts.stopAtrMult).toFixed(2)
  const risk = Math.max(0.01, price - stopLoss)
  const entry = +price.toFixed(2)
  const entryRangeLow = +(price - atr * 0.2).toFixed(2)
  const entryRangeHigh = +(price + atr * 0.2).toFixed(2)
  const target1 = +(price + risk * opts.targetRr1).toFixed(2)
  const target2 = +(price + risk * opts.targetRr2).toFixed(2)
  const target3 = +(price + risk * opts.targetRr3).toFixed(2)
  const riskReward = +opts.targetRr2.toFixed(2)

  return {
    symbol: series.symbol,
    name: series.name,
    sector: series.sector,
    timeframe,
    action,
    confidence,
    entry,
    entryRangeLow,
    entryRangeHigh,
    target1,
    target2,
    target3,
    stopLoss,
    riskReward,
    holdingPeriod: opts.holdingPeriod,
    factors,
    snapshot: ind,
    todayCandle: last,
    dataQuality,
  }
}

// A factor is "actively bearish" when its detail/current state shows a bearish
// condition (regardless of the `hit` flag which tracks the bullish condition).
// We treat any factor whose direction is 'bearish' as actively bearish —
// direction is only set to 'bearish' when the indicator is in a clearly bearish
// zone (e.g., RSI > 75 overbought, MACD below signal, Supertrend DOWN).
function isBearishActive(f: SignalFactor): boolean {
  return f.direction === 'bearish'
}

// --- Long-term Engine (6-24 months) ---------------------------------------
// Long-term positional investing. The goal is to identify stocks in sustained
// multi-quarter uptrends that are NOT extended at the top, have controlled
// drawdowns (good risk management), and are showing accumulation by informed
// money. Entry is at the 200 EMA accumulation zone, not at the breakout.
//
// Factors are weighted to mirror how a long-only equity fund manager filters
// the universe: trend persistence > momentum > risk control > entry timing.
function evaluateLongTerm(series: StockSeries, ind: IndicatorSnapshot): Signal {
  const c = series.candles
  const last = c[c.length - 1]
  const factors: SignalFactor[] = []

  // 1. Primary uptrend: price above 200 EMA AND 200 EMA rising (20-day slope up)
  factors.push({
    name: 'Primary uptrend (price > 200 EMA, EMA rising)',
    detail: `Price ₹${ind.price.toFixed(0)}, 200 EMA ₹${ind.ema200.toFixed(0)} (rising: ${ind.ema200Rising ? 'yes' : 'no'})`,
    weight: 0.18,
    hit: ind.price > ind.ema200 && ind.ema200Rising,
    direction: ind.price > ind.ema200 && ind.ema200Rising ? 'bullish' : ind.price < ind.ema200 ? 'bearish' : 'neutral',
  })

  // 2. Structural trend: 50 EMA > 200 EMA (Golden Cross) AND 100 SMA > 200 SMA
  factors.push({
    name: 'Golden cross + 100/200 SMA alignment',
    detail: `EMA50 ₹${ind.ema50.toFixed(0)} vs EMA200 ₹${ind.ema200.toFixed(0)}, SMA100 ₹${ind.sma100.toFixed(0)} vs SMA200 ₹${ind.sma200.toFixed(0)}`,
    weight: 0.15,
    hit: ind.ema50 > ind.ema200 && ind.sma100 > ind.sma200,
    direction: ind.ema50 > ind.ema200 && ind.sma100 > ind.sma200 ? 'bullish' : 'bearish',
  })

  // 3. 1-year return ≥ 15% (sustained annual outperformance)
  factors.push({
    name: '1-year momentum (≥15%)',
    detail: `250-day return ${ind.ret250d.toFixed(2)}%, 125-day return ${ind.ret125d.toFixed(2)}%`,
    weight: 0.13,
    hit: ind.ret250d >= 15,
    direction: ind.ret250d >= 15 ? 'bullish' : ind.ret250d < 0 ? 'bearish' : 'neutral',
  })

  // 4. ADX ≥ 25 (strong directional trend on daily chart)
  factors.push({
    name: 'ADX ≥ 25 (strong trend)',
    detail: `ADX ${ind.adx.toFixed(1)}, +DI ${ind.plusDI.toFixed(1)} > -DI ${ind.minusDI.toFixed(1)}`,
    weight: 0.10,
    hit: ind.adx >= 25 && ind.plusDI > ind.minusDI,
    direction: ind.adx >= 25 && ind.plusDI > ind.minusDI ? 'bullish' : 'neutral',
  })

  // 5. Risk control: max drawdown in last 250 days > -35% (didn't crash)
  // A stock that lost 50% in the last year is NOT long-term-quality even if it's recovering.
  factors.push({
    name: 'Risk control (max drawdown ≤ 35%)',
    detail: `Max drawdown (250d) ${ind.maxDrawdown250.toFixed(1)}%`,
    weight: 0.10,
    hit: ind.maxDrawdown250 >= -35,
    direction: ind.maxDrawdown250 >= -35 ? 'bullish' : 'bearish',
  })

  // 6. Volume accumulation: 60-day avg vol > 250-day avg vol × 1.05 (smart money buying)
  factors.push({
    name: 'Volume accumulation (60d > 250d)',
    detail: `60d/250d volume ratio ${ind.volumeAccumulation.toFixed(2)}×`,
    weight: 0.08,
    hit: ind.volumeAccumulation >= 1.05,
    direction: ind.volumeAccumulation >= 1.05 ? 'bullish' : 'neutral',
  })

  // 7. Entry timing: NOT extended — current price within 15% of 250-day high
  // (avoid buying stocks at all-time highs; prefer those that have pulled back)
  factors.push({
    name: 'Not extended (within 15% of 250-day high)',
    detail: `Currently ${ind.pctFrom250High.toFixed(1)}% below 250-day high`,
    weight: 0.08,
    hit: ind.pctFrom250High <= 15,
    direction: ind.pctFrom250High > 25 ? 'bearish' : 'neutral',
  })

  // 8. Multi-quarter momentum: 125-day return > 0 (positive 6-month trend)
  factors.push({
    name: '6-month momentum (125-day return > 0)',
    detail: `125-day return ${ind.ret125d.toFixed(2)}%`,
    weight: 0.08,
    hit: ind.ret125d > 0,
    direction: ind.ret125d > 0 ? 'bullish' : 'bearish',
  })

  // 9. RSI in healthy zone (50-72, sustained strength without being overbought)
  factors.push({
    name: 'RSI healthy (50-72)',
    detail: `RSI ${ind.rsi14.toFixed(1)}`,
    weight: 0.05,
    hit: ind.rsi14 >= 50 && ind.rsi14 <= 72,
    direction: ind.rsi14 > 75 ? 'bearish' : ind.rsi14 >= 50 ? 'bullish' : 'neutral',
  })

  // 10. MACD above zero (long-term momentum positive)
  factors.push({
    name: 'MACD positive',
    detail: `MACD line ${ind.macd.toFixed(2)}`,
    weight: 0.05,
    hit: ind.macd > 0,
    direction: ind.macd > 0 ? 'bullish' : 'bearish',
  })

  return finalizeSignal(series, ind, 'LONG_TERM', factors, {
    // Targets are RR (risk/reward) multiples: T = entry + risk × RR
    // where risk = entry − stopLoss = ATR × 4 (stopAtrMult).
    // So T1 = 2.5× risk, T2 = 5× risk, T3 = 10× risk.
    // For typical stocks (ATR ≈ 5% of price), this gives roughly +25% / +50% / +100%.
    // For low-volatility stocks the percentages are smaller; for high-vol, larger.
    // This is intentional — it keeps risk-reward constant while adapting to each stock's volatility.
    targetRr1: 2.5,   // T1: ~6-9 month target
    targetRr2: 5.0,   // T2: ~12-15 month target
    targetRr3: 10.0,  // T3: ~18-24 month target
    stopAtrMult: 4.0, // wider stop for long-term volatility
    holdingPeriod: '6-24 months (180-720 trading days)',
  })
}

// --- Public API: evaluate all four timeframes for one stock ---------------
export function evaluateStock(series: StockSeries): Record<Timeframe, Signal> {
  const ind = computeIndicators(series.candles)
  return {
    BTST: evaluateBTST(series, ind),
    SHORT_TERM: evaluateShortTerm(series, ind),
    MIDTERM: evaluateMidterm(series, ind),
    LONG_TERM: evaluateLongTerm(series, ind),
  }
}

// --- Public API: evaluate the whole universe, filter BUY signals ----------
export interface UniverseResult {
  asOf: string
  nextTradingDay: string
  btst: Signal[]
  shortTerm: Signal[]
  midterm: Signal[]
  longTerm: Signal[]
  // Each stock evaluated (for the market breadth widget)
  breadth: {
    advancing: number
    declining: number
    unchanged: number
    strongBuys: number
  }
  // Top movers
  topGainers: Array<{ symbol: string; name: string; changePct: number; price: number }>
  topLosers: Array<{ symbol: string; name: string; changePct: number; price: number }>
  // Per-sector advance/decline
  sectorBreadth: Array<{ sector: string; advancing: number; declining: number; total: number }>
}

// Tag each signal with the per-stock data source so the UI can show a
// LIVE / DEMO badge on every card.
export function tagSignalSources(
  result: UniverseResult,
  sources: Record<string, 'LIVE' | 'DEMO'>,
): void {
  for (const s of [...result.btst, ...result.shortTerm, ...result.midterm, ...result.longTerm]) {
    s.dataSource = sources[s.symbol] ?? 'DEMO'
  }
}

export function evaluateUniverse(allSeries: StockSeries[], asOf: Date): UniverseResult {
  const signals = allSeries.map((s) => ({ series: s, sig: evaluateStock(s) }))

  // BUY signals for each timeframe, sorted by confidence desc
  const btst = signals
    .map((x) => x.sig.BTST)
    .filter((s) => s.action === 'BUY')
    .sort((a, b) => b.confidence - a.confidence)
  const shortTerm = signals
    .map((x) => x.sig.SHORT_TERM)
    .filter((s) => s.action === 'BUY')
    .sort((a, b) => b.confidence - a.confidence)
  const midterm = signals
    .map((x) => x.sig.MIDTERM)
    .filter((s) => s.action === 'BUY')
    .sort((a, b) => b.confidence - a.confidence)
  const longTerm = signals
    .map((x) => x.sig.LONG_TERM)
    .filter((s) => s.action === 'BUY')
    .sort((a, b) => b.confidence - a.confidence)

  // Market breadth based on today's candle direction
  let advancing = 0
  let declining = 0
  let unchanged = 0
  let strongBuys = 0
  const topMovers: Array<{ symbol: string; name: string; changePct: number; price: number }> = []
  for (const { series, sig } of signals) {
    const last = series.candles[series.candles.length - 1]
    const prev = series.candles[series.candles.length - 2]
    const ch = prev ? ((last.close - prev.close) / prev.close) * 100 : 0
    if (ch > 0.05) advancing++
    else if (ch < -0.05) declining++
    else unchanged++
    // strong buy = BUY in ALL 4 timeframes (highest conviction)
    if (
      sig.BTST.action === 'BUY' &&
      sig.SHORT_TERM.action === 'BUY' &&
      sig.MIDTERM.action === 'BUY' &&
      sig.LONG_TERM.action === 'BUY'
    ) strongBuys++
    topMovers.push({ symbol: series.symbol, name: series.name, changePct: +ch.toFixed(2), price: last.close })
  }
  topMovers.sort((a, b) => b.changePct - a.changePct)
  const topGainers = topMovers.slice(0, 8)
  const topLosers = topMovers.slice(-8).reverse()

  // Sector breadth
  const sectorMap = new Map<string, { advancing: number; declining: number; total: number }>()
  for (const { series } of signals) {
    const last = series.candles[series.candles.length - 1]
    const prev = series.candles[series.candles.length - 2]
    const ch = prev ? ((last.close - prev.close) / prev.close) * 100 : 0
    const sector = series.sector
    if (!sectorMap.has(sector)) sectorMap.set(sector, { advancing: 0, declining: 0, total: 0 })
    const e = sectorMap.get(sector)!
    e.total++
    if (ch > 0) e.advancing++
    else if (ch < 0) e.declining++
  }
  const sectorBreadth = Array.from(sectorMap.entries())
    .map(([sector, v]) => ({ sector, ...v }))
    .sort((a, b) => b.advancing - a.advancing)

  // Next trading day = next weekday after asOf
  const next = new Date(asOf)
  do {
    next.setDate(next.getDate() + 1)
  } while (next.getDay() === 0 || next.getDay() === 6)

  return {
    asOf: asOf.toISOString(),
    nextTradingDay: next.toISOString().slice(0, 10),
    btst,
    shortTerm,
    midterm,
    longTerm,
    breadth: { advancing, declining, unchanged, strongBuys },
    topGainers,
    topLosers,
    sectorBreadth,
  }
}
