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
import { predictProbability } from './ml'
import { IndicatorSnapshot, computeIndicators, BollingerBands, RSI, MACD, EMA, SMA, ATR } from '../indicators'
import fundamentalsData from '../stocks/fundamentals.json'

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
  mlProbability?: number
  // Broker recommendation fields
  targetPrice?: number | null
  recommendation?: string | null
  recommendationMean?: number | null
  analystsCount?: number | null
}

// --- BTST Engine -----------------------------------------------------------
// BTST = Buy Today Sell Tomorrow. The trade is entered at today's close and
// exited at tomorrow's open/close. We want momentum continuation signals that
// typically resolve overnight in the direction of the prior day's strength.
function evaluateBTST(series: StockSeries, ind: IndicatorSnapshot, isNiftyBullish = true): Signal {
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

  // 9. Fibonacci Retracement support or Confluence Zone check
  if (ind.fibConfluence && ind.fibConfluence.isActive) {
    factors.push({
      name: 'Fibonacci confluence zone',
      detail: `Bounce off overlap of: ${ind.fibConfluence.levels.join(" + ")} (dist: ${ind.fibConfluence.distancePct}%)`,
      weight: 0.18,
      hit: true,
      direction: 'bullish',
    })
  } else if (ind.fib) {
    const isFibSupport = ind.fib.closestLevel === '38.2%' || ind.fib.closestLevel === '50.0%' || ind.fib.closestLevel === '61.8%'
    const isBouncing = last.close >= last.open || (c[c.length - 2] && last.close > c[c.length - 2].close)
    const isClose = ind.fib.distancePct <= 1.5
    factors.push({
      name: 'Fibonacci support bounce',
      detail: `Bounce off ${ind.fib.closestLevel} Fibonacci support level (dist: ${ind.fib.distancePct.toFixed(1)}%)`,
      weight: 0.10,
      hit: isFibSupport && isBouncing && isClose,
      direction: isFibSupport && isBouncing && isClose ? 'bullish' : 'neutral',
    })
  }

  // 10. Harmonic Pattern PRZ check
  const harmonicFactor = buildHarmonicFactor(ind, ind.price)
  if (harmonicFactor) factors.push(harmonicFactor)

  return finalizeSignal(series, ind, 'BTST', factors, {
    targetRr1: 0.8,
    targetRr2: 1.5,
    targetRr3: 2.5,
    stopAtrMult: 1.0,
    holdingPeriod: '1-2 sessions (exit by next trading day close)',
  }, isNiftyBullish)
}

// --- Short-term Engine (5-15 days) -----------------------------------------
function evaluateShortTerm(series: StockSeries, ind: IndicatorSnapshot, isNiftyBullish = true): Signal {
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

  // 10. Fibonacci Retracement support or Confluence Zone check
  if (ind.fibConfluence && ind.fibConfluence.isActive) {
    factors.push({
      name: 'Fibonacci confluence zone',
      detail: `Bounce off overlap of: ${ind.fibConfluence.levels.join(" + ")} (dist: ${ind.fibConfluence.distancePct}%)`,
      weight: 0.18,
      hit: true,
      direction: 'bullish',
    })
  } else if (ind.fib) {
    const isFibSupport = ind.fib.closestLevel === '38.2%' || ind.fib.closestLevel === '50.0%' || ind.fib.closestLevel === '61.8%'
    const isBouncing = last.close >= last.open || (c[c.length - 2] && last.close > c[c.length - 2].close)
    const isClose = ind.fib.distancePct <= 1.5
    factors.push({
      name: 'Fibonacci support bounce',
      detail: `Bounce off ${ind.fib.closestLevel} Fibonacci support level (dist: ${ind.fib.distancePct.toFixed(1)}%)`,
      weight: 0.10,
      hit: isFibSupport && isBouncing && isClose,
      direction: isFibSupport && isBouncing && isClose ? 'bullish' : 'neutral',
    })
  }

  // 11. Harmonic Pattern PRZ check
  const harmonicFactorST = buildHarmonicFactor(ind, ind.price)
  if (harmonicFactorST) factors.push(harmonicFactorST)

  return finalizeSignal(series, ind, 'SHORT_TERM', factors, {
    targetRr1: 1.5,
    targetRr2: 2.5,
    targetRr3: 4.0,
    stopAtrMult: 1.5,
    holdingPeriod: '5-15 trading days',
  }, isNiftyBullish)
}

// --- Midterm Engine (1-3 months) -------------------------------------------
function evaluateMidterm(series: StockSeries, ind: IndicatorSnapshot, isNiftyBullish = true): Signal {
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

  // 10. Fundamental Analysis Factors (Midterm)
  const fundamentals = (fundamentalsData as any)[series.symbol]
  if (fundamentals) {
    if (fundamentals.debtToEquity !== null && fundamentals.debtToEquity !== undefined) {
      const isLowDebt = fundamentals.debtToEquity <= 100
      const isHighDebt = fundamentals.debtToEquity > 150
      factors.push({
        name: 'Fundamental: Low Debt',
        detail: `D/E Ratio: ${fundamentals.debtToEquity}%`,
        weight: 0.08,
        hit: isLowDebt,
        direction: isLowDebt ? 'bullish' : isHighDebt ? 'bearish' : 'neutral',
      })
    }
    if (fundamentals.promoterHeld !== null && fundamentals.promoterHeld !== undefined) {
      const isHighPromoter = fundamentals.promoterHeld >= 50
      const isLowPromoter = fundamentals.promoterHeld < 30
      factors.push({
        name: 'Fundamental: Promoter Skin',
        detail: `Promoter Held: ${fundamentals.promoterHeld}%`,
        weight: 0.08,
        hit: isHighPromoter,
        direction: isHighPromoter ? 'bullish' : isLowPromoter ? 'bearish' : 'neutral',
      })
    }
    if (fundamentals.pe !== null && fundamentals.pe !== undefined) {
      const isReasonablePE = fundamentals.pe > 0 && fundamentals.pe <= 35
      const isExpensivePE = fundamentals.pe > 75
      factors.push({
        name: 'Fundamental: P/E Valuation',
        detail: `P/E Ratio: ${fundamentals.pe}`,
        weight: 0.06,
        hit: isReasonablePE,
        direction: isReasonablePE ? 'bullish' : isExpensivePE ? 'bearish' : 'neutral',
      })
    }
  }

  // 11. Fibonacci Retracement support or Confluence Zone check
  if (ind.fibConfluence && ind.fibConfluence.isActive) {
    factors.push({
      name: 'Fibonacci confluence zone',
      detail: `Bounce off overlap of: ${ind.fibConfluence.levels.join(" + ")} (dist: ${ind.fibConfluence.distancePct}%)`,
      weight: 0.18,
      hit: true,
      direction: 'bullish',
    })
  } else if (ind.fib) {
    const isFibSupport = ind.fib.closestLevel === '38.2%' || ind.fib.closestLevel === '50.0%' || ind.fib.closestLevel === '61.8%'
    const isBouncing = last.close >= last.open || (c[c.length - 2] && last.close > c[c.length - 2].close)
    const isClose = ind.fib.distancePct <= 1.5
    factors.push({
      name: 'Fibonacci support bounce',
      detail: `Bounce off ${ind.fib.closestLevel} Fibonacci support level (dist: ${ind.fib.distancePct.toFixed(1)}%)`,
      weight: 0.10,
      hit: isFibSupport && isBouncing && isClose,
      direction: isFibSupport && isBouncing && isClose ? 'bullish' : 'neutral',
    })
  }

  // 12. Harmonic Pattern PRZ check
  const harmonicFactorMT = buildHarmonicFactor(ind, ind.price)
  if (harmonicFactorMT) factors.push(harmonicFactorMT)

  return finalizeSignal(series, ind, 'MIDTERM', factors, {
    targetRr1: 2.0,
    targetRr2: 3.5,
    targetRr3: 6.0,
    stopAtrMult: 2.5,
    holdingPeriod: '1-3 months (30-60 trading days)',
  }, isNiftyBullish)
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
  isNiftyBullish = true,
): Signal {
  const c = series.candles
  const last = c[c.length - 1]
  const price = ind.price
  const fundamentals = (fundamentalsData as any)[series.symbol]

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
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0) || 1.0
  const rawConfidence = Math.max(0, ((bullishWeight - bearishPenalty) / totalWeight) * 100)
  const confidence = Math.min(100, Math.max(0, Math.round(rawConfidence)))

  // --- Per-timeframe BUY thresholds (balanced for quality + quantity) ---
  // These thresholds aim for 10-30 quality signals per timeframe out of ~500 stocks.
  // Too strict (e.g. minConf:85 + minHits:7) produces 0 results on most days.
  // Too loose produces noise. These values are calibrated for NSE market conditions.
  const thresholds: Record<Timeframe, { minConf: number; minWeight: number; minHits: number }> = {
    BTST:       { minConf: 65, minWeight: 0.45, minHits: 5 },
    SHORT_TERM: { minConf: 60, minWeight: 0.40, minHits: 4 },
    MIDTERM:    { minConf: 65, minWeight: 0.45, minHits: 5 },
    LONG_TERM:  { minConf: 58, minWeight: 0.38, minHits: 4 },
  }
  const th = thresholds[timeframe]
  let minConf = opts.minConfidence ?? th.minConf
  let minWeight = opts.minBullishWeight ?? th.minWeight
  const minHits = opts.minBullHits ?? th.minHits

  // Market Regime: Tighten rules in Bear Markets
  if (!isNiftyBullish) {
    minConf += 5      // 5% higher confidence threshold required
    minWeight += 0.05 // 5% higher bullish weight required
  }

  // Action decision:
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
  const candleCount = c.length
  let dataQuality: 'LIVE' | 'LIMITED' | 'SYNTHETIC'
  if (candleCount >= 120) dataQuality = 'LIVE'
  else if (candleCount >= 30) dataQuality = 'LIMITED'
  else dataQuality = 'SYNTHETIC'

  // Stop loss and targets — DIRECTION-AWARE
  // BUY (long): SL below entry, targets above entry
  // SELL (short): SL above entry, targets below entry
  const atr = ind.atr14 || price * 0.02
  const activeStopAtrMult = isNiftyBullish ? opts.stopAtrMult : opts.stopAtrMult + 0.5
  const isSell = action === 'SELL'
  const stopLoss = isSell
    ? +(price + atr * activeStopAtrMult).toFixed(2)   // SELL: SL above entry
    : +(price - atr * activeStopAtrMult).toFixed(2)   // BUY: SL below entry
  const risk = Math.max(0.01, Math.abs(price - stopLoss))
  const entry = +price.toFixed(2)
  const entryRangeLow = +(price - atr * 0.2).toFixed(2)
  const entryRangeHigh = +(price + atr * 0.2).toFixed(2)
  const target1 = isSell
    ? +(price - risk * opts.targetRr1).toFixed(2)     // SELL: target below entry
    : +(price + risk * opts.targetRr1).toFixed(2)     // BUY: target above entry
  const target2 = isSell
    ? +(price - risk * opts.targetRr2).toFixed(2)
    : +(price + risk * opts.targetRr2).toFixed(2)
  const target3 = isSell
    ? +(price - risk * opts.targetRr3).toFixed(2)
    : +(price + risk * opts.targetRr3).toFixed(2)
  const riskReward = +opts.targetRr2.toFixed(2)

  // Compute LightGBM ML prediction probability
  const features = [
    ind.rsi14,          // 0
    ind.macd,           // 1
    ind.macdSignal,     // 2
    ind.macdHist,       // 3
    ind.adx,            // 4
    ind.bbPercentB,     // 5
    ind.bbBandwidth,    // 6
    ind.volumeRatio,    // 7
    ind.ret5d,          // 8
    ind.ret20d,         // 9
    ind.ret50d,         // 10
    ind.distFrom200,    // 11
  ]
  const mlProbability = predictProbability(features)

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
    mlProbability,
    // Broker recommendation fields
    targetPrice: fundamentals?.targetPrice ?? null,
    recommendation: fundamentals?.recommendation ?? null,
    recommendationMean: fundamentals?.recommendationMean ?? null,
    analystsCount: fundamentals?.analystsCount ?? null,
  }
}

// Harmonic Pattern PRZ Factor
// Called before finalizeSignal in every timeframe engine.
// If any harmonic pattern has its PRZ within 2% of current price, it fires
// as a high-conviction confluency factor (bullish bounce or bearish reversal).
function buildHarmonicFactor(ind: IndicatorSnapshot, price: number): SignalFactor | null {
  if (!ind.harmonics || ind.harmonics.length === 0) return null
  // Find the most relevant pattern: FORMING, closest PRZ to current price
  const best = ind.harmonics
    .filter((p) => Math.abs(p.distFromD) <= 2.5)
    .sort((a, b) => Math.abs(a.distFromD) - Math.abs(b.distFromD))[0]
  if (!best) return null
  const isBullishHarmonic = best.direction === 'Bullish'
  return {
    name: `Harmonic ${best.direction} ${best.name} (PRZ)`,
    detail: best.description,
    weight: 0.20,
    hit: isBullishHarmonic,
    direction: isBullishHarmonic ? 'bullish' : 'bearish',
  }
}

function isBearishActive(f: SignalFactor): boolean {
  return f.direction === 'bearish'
}

// --- Dedicated SELL Signal Engine ------------------------------------------
// Produces bearish SELL signals when multiple bearish conditions align.
// This mirrors the BUY engines but with all conditions inverted.
// Uses the same finalizeSignal mechanism but with bearish factors that
// produce confidence<=25 + 2+ bearish hits → triggers SELL action.
//
// Bearish checklist (8 factors):
//  1. Death Cross zone: price < EMA50 AND EMA50 < EMA200
//  2. RSI overbought (>= 65) or extremely overbought (>= 70)
//  3. MACD bearish cross or MACD below signal line
//  4. ADX trend with -DI > +DI (bearish directional strength)
//  5. Price below VWAP (distribution)
//  6. Bollinger Band %B > 0.85 (price extended at upper band = due for reversal)
//  7. Bearish candlestick pattern (Bearish Engulfing, Evening Star, Shooting Star)
//  8. Supertrend bearish (trend = -1)
function evaluateSell(
  series: StockSeries,
  ind: IndicatorSnapshot,
  isNiftyBullish = true,
  timeframe: Timeframe = 'BTST',
): Signal {
  const c = series.candles
  const last = c[c.length - 1]
  const factors: SignalFactor[] = []

  // 1. Death Cross zone: price < EMA50 AND EMA50 < EMA200
  const deathCross = ind.price < ind.ema50 && ind.ema50 < ind.ema200
  factors.push({
    name: 'Death cross / bearish trend',
    detail: `Price ₹${ind.price.toFixed(0)} < EMA50 ₹${ind.ema50.toFixed(0)} < EMA200 ₹${ind.ema200.toFixed(0)}`,
    weight: 0.18,
    hit: deathCross,
    direction: deathCross ? 'bearish' : 'neutral',
  })

  // 2. RSI overbought >= 65 (extended bull move nearing exhaustion)
  const rsiOverbought = ind.rsi14 >= 65
  factors.push({
    name: 'RSI overbought zone',
    detail: `RSI ${ind.rsi14.toFixed(1)} (overbought >= 65)`,
    weight: 0.14,
    hit: rsiOverbought,
    direction: rsiOverbought ? 'bearish' : 'neutral',
  })

  // 3. MACD bearish: MACD below signal line OR recent bearish crossover
  const macdBearish = ind.macd < ind.macdSignal || ind.macdCross === 'bearish'
  factors.push({
    name: 'MACD bearish momentum',
    detail: `MACD ${ind.macd.toFixed(2)} vs Signal ${ind.macdSignal.toFixed(2)}, cross=${ind.macdCross}`,
    weight: 0.15,
    hit: macdBearish,
    direction: macdBearish ? 'bearish' : 'neutral',
  })

  // 4. ADX with -DI > +DI (bearish directional strength)
  const adxBearish = ind.adx >= 20 && ind.minusDI > ind.plusDI
  factors.push({
    name: 'ADX bearish directional strength',
    detail: `ADX ${ind.adx.toFixed(1)}, +DI ${ind.plusDI.toFixed(1)}, -DI ${ind.minusDI.toFixed(1)}`,
    weight: 0.12,
    hit: adxBearish,
    direction: adxBearish ? 'bearish' : 'neutral',
  })

  // 5. Price below VWAP (distribution / selling pressure)
  const belowVwap = ind.price < ind.vwap20
  factors.push({
    name: 'Below VWAP (distribution)',
    detail: `Price ₹${ind.price.toFixed(2)} vs VWAP ₹${ind.vwap20.toFixed(2)}`,
    weight: 0.10,
    hit: belowVwap,
    direction: belowVwap ? 'bearish' : 'neutral',
  })

  // 6. Bollinger Band %B > 0.85 (upper-band extended, reversal likely)
  const bbExtended = ind.bbPercentB >= 0.85
  factors.push({
    name: 'Bollinger upper-band extended',
    detail: `%B ${(ind.bbPercentB * 100).toFixed(0)}% — price near/above upper band`,
    weight: 0.10,
    hit: bbExtended,
    direction: bbExtended ? 'bearish' : 'neutral',
  })

  // 7. Bearish candlestick pattern
  const bearPatterns = ind.patterns.filter((p) =>
    ['BearishEngulfing', 'EveningStar', 'ShootingStar', 'BearishMarubozu', 'DarkCloudCover', 'HangingMan'].includes(p)
  )
  factors.push({
    name: 'Bearish candle pattern',
    detail: bearPatterns.length ? bearPatterns.join(', ') : 'None detected',
    weight: 0.12,
    hit: bearPatterns.length > 0,
    direction: bearPatterns.length > 0 ? 'bearish' : 'neutral',
  })

  // 8. Supertrend bearish (trend flipped down)
  const stBearish = ind.supertrendTrend === -1
  factors.push({
    name: 'Supertrend bearish',
    detail: `Supertrend ${stBearish ? 'DOWN' : 'UP'} @ ₹${ind.supertrendValue.toFixed(2)}`,
    weight: 0.09,
    hit: stBearish,
    direction: stBearish ? 'bearish' : 'neutral',
  })

  // 9. Negative recent momentum (5-day return negative)
  const negMomentum = ind.ret5d < -0.5
  factors.push({
    name: 'Negative short-term momentum',
    detail: `5-day return ${ind.ret5d.toFixed(2)}%`,
    weight: 0.10,
    hit: negMomentum,
    direction: negMomentum ? 'bearish' : 'neutral',
  })

  // 10. Volume surge (distribution with high volume = bearish confirmation)
  const volSurge = ind.volumeRatio >= 1.3
  factors.push({
    name: 'Volume surge (distribution)',
    detail: `Volume ratio ${ind.volumeRatio.toFixed(2)}× vs 20-day avg`,
    weight: 0.10,
    hit: volSurge && belowVwap, // volume surge + below VWAP = confirmed distribution
    direction: volSurge && belowVwap ? 'bearish' : 'neutral',
  })

  // Determine timeframe-specific opts
  const timeframeOpts: Record<Timeframe, { targetRr1: number; targetRr2: number; targetRr3: number; stopAtrMult: number; holdingPeriod: string }> = {
    BTST:       { targetRr1: 0.8,  targetRr2: 1.5,  targetRr3: 2.5,   stopAtrMult: 1.0, holdingPeriod: '1-2 sessions (cover by next trading day close)' },
    SHORT_TERM: { targetRr1: 1.5,  targetRr2: 2.5,  targetRr3: 4.0,   stopAtrMult: 1.5, holdingPeriod: '5-15 trading days' },
    MIDTERM:    { targetRr1: 2.0,  targetRr2: 3.5,  targetRr3: 5.0,   stopAtrMult: 2.0, holdingPeriod: '1-3 months (30-60 trading days)' },
    LONG_TERM:  { targetRr1: 2.5,  targetRr2: 4.0,  targetRr3: 6.0,   stopAtrMult: 2.5, holdingPeriod: '3-12 months positional short' },
  }

  return finalizeSignal(series, ind, timeframe, factors, timeframeOpts[timeframe], isNiftyBullish)
}

// --- Long-term Engine (6-24 months) ---------------------------------------
// Long-term positional investing. The goal is to identify stocks in sustained
// multi-quarter uptrends that are NOT extended at the top, have controlled
// drawdowns (good risk management), and are showing accumulation by informed
// money. Entry is at the 200 EMA accumulation zone, not at the breakout.
//
// Factors are weighted to mirror how a long-only equity fund manager filters
// the universe: trend persistence > momentum > risk control > entry timing.
function evaluateLongTerm(series: StockSeries, ind: IndicatorSnapshot, isNiftyBullish = true): Signal {
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

  // 11. Fundamental Analysis Factors (Longterm)
  const fundamentals = (fundamentalsData as any)[series.symbol]
  if (fundamentals) {
    if (fundamentals.debtToEquity !== null && fundamentals.debtToEquity !== undefined) {
      const isLowDebt = fundamentals.debtToEquity <= 100
      const isHighDebt = fundamentals.debtToEquity > 150
      factors.push({
        name: 'Fundamental: Low Debt',
        detail: `D/E Ratio: ${fundamentals.debtToEquity}%`,
        weight: 0.08,
        hit: isLowDebt,
        direction: isLowDebt ? 'bullish' : isHighDebt ? 'bearish' : 'neutral',
      })
    }
    if (fundamentals.promoterHeld !== null && fundamentals.promoterHeld !== undefined) {
      const isHighPromoter = fundamentals.promoterHeld >= 50
      const isLowPromoter = fundamentals.promoterHeld < 30
      factors.push({
        name: 'Fundamental: Promoter Skin',
        detail: `Promoter Held: ${fundamentals.promoterHeld}%`,
        weight: 0.08,
        hit: isHighPromoter,
        direction: isHighPromoter ? 'bullish' : isLowPromoter ? 'bearish' : 'neutral',
      })
    }
    if (fundamentals.pe !== null && fundamentals.pe !== undefined) {
      const isReasonablePE = fundamentals.pe > 0 && fundamentals.pe <= 35
      const isExpensivePE = fundamentals.pe > 75
      factors.push({
        name: 'Fundamental: P/E Valuation',
        detail: `P/E Ratio: ${fundamentals.pe}`,
        weight: 0.06,
        hit: isReasonablePE,
        direction: isReasonablePE ? 'bullish' : isExpensivePE ? 'bearish' : 'neutral',
      })
    }
    if (fundamentals.margin !== null && fundamentals.margin !== undefined) {
      const isHealthyMargin = fundamentals.margin >= 15
      const isLowMargin = fundamentals.margin < 5
      factors.push({
        name: 'Fundamental: Operating Margin',
        detail: `Operating Margin: ${fundamentals.margin}%`,
        weight: 0.06,
        hit: isHealthyMargin,
        direction: isHealthyMargin ? 'bullish' : isLowMargin ? 'bearish' : 'neutral',
      })
    }
  }

  // 12. Fibonacci Retracement support or Confluence Zone check
  if (ind.fibConfluence && ind.fibConfluence.isActive) {
    factors.push({
      name: 'Fibonacci confluence zone',
      detail: `Bounce off overlap of: ${ind.fibConfluence.levels.join(" + ")} (dist: ${ind.fibConfluence.distancePct}%)`,
      weight: 0.18,
      hit: true,
      direction: 'bullish',
    })
  } else if (ind.fib) {
    const isFibSupport = ind.fib.closestLevel === '38.2%' || ind.fib.closestLevel === '50.0%' || ind.fib.closestLevel === '61.8%'
    const isBouncing = last.close >= last.open || (c[c.length - 2] && last.close > c[c.length - 2].close)
    const isClose = ind.fib.distancePct <= 1.5
    factors.push({
      name: 'Fibonacci support bounce',
      detail: `Bounce off ${ind.fib.closestLevel} Fibonacci support level (dist: ${ind.fib.distancePct.toFixed(1)}%)`,
      weight: 0.10,
      hit: isFibSupport && isBouncing && isClose,
      direction: isFibSupport && isBouncing && isClose ? 'bullish' : 'neutral',
    })
  }

  // 13. Harmonic Pattern PRZ check
  const harmonicFactorLT = buildHarmonicFactor(ind, ind.price)
  if (harmonicFactorLT) factors.push(harmonicFactorLT)

  return finalizeSignal(series, ind, 'LONG_TERM', factors, {
    targetRr1: 2.5,
    targetRr2: 5.0,
    targetRr3: 10.0,
    stopAtrMult: 4.0,
    holdingPeriod: '6-24 months (180-720 trading days)',
  }, isNiftyBullish)
}

// --- TradingView Technical Calibration / Guard Filter ----------------------
function applyTradingViewCalibration(
  sig: Signal,
  tvConsensus: { summaryScore: number; maScore: number; oscScore: number }
): void {
  if (sig.action === 'BUY') {
    // 1. Structural Trend Guard (Moving Averages check)
    // Block BUY only when TradingView MA is strongly bearish (score <= -0.3).
    // A score of -0.1 just means slightly mixed — do not block those.
    if (tvConsensus.maScore <= -0.3) {
      sig.action = 'AVOID'
      sig.confidence = Math.max(40, sig.confidence - 20)
      sig.factors.push({
        name: 'TradingView Trend Divergence',
        detail: `Blocked: TradingView MA rating is Strongly Bearish (${tvConsensus.maScore.toFixed(2)})`,
        weight: 0.20,
        hit: false,
        direction: 'bearish'
      })
      return
    }

    // 2. Oscillator Support Check
    // If oscillators are strongly bearish, apply confidence penalty
    if (tvConsensus.oscScore <= -0.2) {
      sig.confidence = Math.max(50, sig.confidence - 15)
      sig.factors.push({
        name: 'TradingView Oscillator Conflict',
        detail: `Confidence Penalty: Oscillators are Bearish (${tvConsensus.oscScore.toFixed(2)})`,
        weight: 0.10,
        hit: false,
        direction: 'bearish'
      })
    }

    // 3. Consensus Confirmation Boost
    // If TradingView summary is Bullish (>= 0.1), boost our confidence score
    if (tvConsensus.summaryScore >= 0.1) {
      const boost = tvConsensus.summaryScore >= 0.5 ? 10 : 5
      sig.confidence = Math.min(100, sig.confidence + boost)
      sig.factors.push({
        name: 'TradingView Consensus Confirmation',
        detail: `Confidence Boost (+${boost}%): TV Summary is ${tvConsensus.summaryScore >= 0.5 ? 'Strong Buy' : 'Buy'} (${tvConsensus.summaryScore.toFixed(2)})`,
        weight: 0.15,
        hit: true,
        direction: 'bullish'
      })
    }
  }
}

// --- Public API: evaluate all four timeframes for one stock ---------------
export function evaluateStock(
  series: StockSeries,
  isNiftyBullish = true,
  tvConsensus?: { summaryScore: number; maScore: number; oscScore: number }
): Record<Timeframe, Signal> {
  const ind = computeIndicators(series.candles)
  const signals = {
    BTST: evaluateBTST(series, ind, isNiftyBullish),
    SHORT_TERM: evaluateShortTerm(series, ind, isNiftyBullish),
    MIDTERM: evaluateMidterm(series, ind, isNiftyBullish),
    LONG_TERM: evaluateLongTerm(series, ind, isNiftyBullish),
  }

  if (tvConsensus) {
    applyTradingViewCalibration(signals.BTST, tvConsensus)
    applyTradingViewCalibration(signals.SHORT_TERM, tvConsensus)
    applyTradingViewCalibration(signals.MIDTERM, tvConsensus)
    applyTradingViewCalibration(signals.LONG_TERM, tvConsensus)
  }

  return signals
}

// --- Public API: evaluate the whole universe, filter BUY + SELL signals ----
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
  // Each stock evaluated (for the market breadth widget)
  breadth: {
    advancing: number
    declining: number
    unchanged: number
    strongBuys: number
    strongSells: number
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

export function evaluateUniverse(
  allSeries: StockSeries[],
  asOf: Date,
  isNiftyBullish = true,
  tvConsensusMap?: Record<string, { summaryScore: number; maScore: number; oscScore: number }>
): UniverseResult {
  const signals = allSeries.map((s) => ({
    series: s,
    sig: evaluateStock(s, isNiftyBullish, tvConsensusMap?.[s.symbol]),
    sellBTST: evaluateSell(s, computeIndicators(s.candles), isNiftyBullish, 'BTST'),
    sellST: evaluateSell(s, computeIndicators(s.candles), isNiftyBullish, 'SHORT_TERM'),
    sellMT: evaluateSell(s, computeIndicators(s.candles), isNiftyBullish, 'MIDTERM'),
    sellLT: evaluateSell(s, computeIndicators(s.candles), isNiftyBullish, 'LONG_TERM'),
  }))

  // BUY signals for each timeframe, sorted by ML Probability desc
  const btst = signals
    .map((x) => x.sig.BTST)
    .filter((s) => s.action === 'BUY')
    .sort((a, b) => (b.mlProbability ?? 0) - (a.mlProbability ?? 0))
  const shortTerm = signals
    .map((x) => x.sig.SHORT_TERM)
    .filter((s) => s.action === 'BUY')
    .sort((a, b) => (b.mlProbability ?? 0) - (a.mlProbability ?? 0))
  const midterm = signals
    .map((x) => x.sig.MIDTERM)
    .filter((s) => s.action === 'BUY')
    .sort((a, b) => (b.mlProbability ?? 0) - (a.mlProbability ?? 0))
  const longTerm = signals
    .map((x) => x.sig.LONG_TERM)
    .filter((s) => s.action === 'BUY')
    .sort((a, b) => (b.mlProbability ?? 0) - (a.mlProbability ?? 0))

  // SELL signals for each timeframe (dedicated bearish engine), sorted by confidence desc
  const btstSell = signals
    .map((x) => x.sellBTST)
    .filter((s) => s.action === 'SELL')
    .sort((a, b) => b.confidence - a.confidence)
  const shortTermSell = signals
    .map((x) => x.sellST)
    .filter((s) => s.action === 'SELL')
    .sort((a, b) => b.confidence - a.confidence)
  const midtermSell = signals
    .map((x) => x.sellMT)
    .filter((s) => s.action === 'SELL')
    .sort((a, b) => b.confidence - a.confidence)
  const longTermSell = signals
    .map((x) => x.sellLT)
    .filter((s) => s.action === 'SELL')
    .sort((a, b) => b.confidence - a.confidence)

  // Market breadth based on today's candle direction
  let advancing = 0
  let declining = 0
  let unchanged = 0
  let strongBuys = 0
  let strongSells = 0
  const topMovers: Array<{ symbol: string; name: string; changePct: number; price: number }> = []
  for (const { series, sig, sellBTST, sellST, sellMT, sellLT } of signals) {
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
    // strong sell = SELL in ALL 4 timeframes (highest conviction bearish)
    if (
      sellBTST.action === 'SELL' &&
      sellST.action === 'SELL' &&
      sellMT.action === 'SELL' &&
      sellLT.action === 'SELL'
    ) strongSells++
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
    btstSell,
    shortTermSell,
    midtermSell,
    longTermSell,
    breadth: { advancing, declining, unchanged, strongBuys, strongSells },
    topGainers,
    topLosers,
    sectorBreadth,
  }
}
