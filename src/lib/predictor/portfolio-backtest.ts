import { Candle, StockSeries } from '../stocks/engine'
import { Timeframe, evaluateStock, Signal } from './engine'
import { computeIndicators } from '../indicators'

export interface PortfolioTrade {
  symbol: string
  entryDate: string
  entryPrice: number
  exitDate: string
  exitPrice: number
  status: 'HIT_TARGET' | 'STOPPED_OUT' | 'TIME_EXIT'
  pnlPct: number
  holdingDays: number
  entryCapital: number
  exitValue: number
}

export interface PortfolioEquityPoint {
  date: string
  equity: number
  cash: number
  positionsValue: number
}

export interface PortfolioBacktestResult {
  startDate: string
  endDate: string
  initialCapital: number
  finalValue: number
  totalReturnPct: number
  winRate: number
  totalTrades: number
  maxDrawdown: number
  averageHoldingDays: number
  trades: PortfolioTrade[]
  equityCurve: PortfolioEquityPoint[]
}

interface ActivePosition {
  symbol: string
  entryDate: string
  entryPrice: number
  shares: number
  stopLoss: number
  targetPrice: number
  maxDays: number
  age: number
  entryCapital: number
  series: StockSeries
}

interface PendingBuy {
  symbol: string
  stopLoss: number
  targetPrice: number
  maxDays: number
  entryCapital: number
  series: StockSeries
}

export function runPortfolioBacktest(
  seriesList: StockSeries[],
  timeframe: Timeframe,
  targetSelection: 'T1' | 'T2' | 'T3' = 'T2',
  startingCapital = 100000,
  maxPositions = 5,
  allocationPerTrade = 20,
  niftySeries?: StockSeries
): PortfolioBacktestResult {
  
  if (!seriesList || seriesList.length === 0) {
    throw new Error('Stock series list cannot be empty.')
  }

  // 1. Gather all unique dates across all stock series to build a calendar timeline.
  // We only run backtesting on dates where we have enough candles to compute indicators (typically index >= 120 or 200).
  const allDatesSet = new Set<string>()
  for (const s of seriesList) {
    for (const c of s.candles) {
      allDatesSet.add(c.date)
    }
  }
  const timeline = Array.from(allDatesSet).sort()
  const totalDays = timeline.length

  // Find the index where Nifty 50 has enough data, or default to starting after index 120 to allow EMA 50 / 200 calculations
  const startIdx = Math.min(120, Math.floor(totalDays * 0.3))

  let cash = startingCapital
  let activePositions: ActivePosition[] = []
  let pendingBuys: PendingBuy[] = []
  const trades: PortfolioTrade[] = []
  const equityCurve: PortfolioEquityPoint[] = []

  // Track daily portfolio values to compute maximum drawdown
  let peakEquity = startingCapital
  let maxDrawdown = 0

  // 2. Chronological simulation loop
  for (let i = startIdx; i < totalDays; i++) {
    const today = timeline[i]
    
    // --- Step A: Process exits for active positions based on today's prices ---
    const nextActivePositions: ActivePosition[] = []

    for (const pos of activePositions) {
      const todayCandle = pos.series.candles.find((c) => c.date === today)

      if (!todayCandle) {
        // Hold over missing trading data day
        nextActivePositions.push(pos)
        continue
      }

      pos.age++

      let exited = false
      let exitPrice = todayCandle.close
      let status: 'HIT_TARGET' | 'STOPPED_OUT' | 'TIME_EXIT' = 'TIME_EXIT'

      // Check Stop Loss (priority 1)
      if (todayCandle.low <= pos.stopLoss) {
        exited = true
        status = 'STOPPED_OUT'
        // If open was already below stop loss, execution occurs at open (gap down)
        exitPrice = todayCandle.open < pos.stopLoss ? todayCandle.open : pos.stopLoss
      }
      // Check Target Hit (priority 2)
      else if (todayCandle.high >= pos.targetPrice) {
        exited = true
        status = 'HIT_TARGET'
        // If open was already above target, execution occurs at open (gap up)
        exitPrice = todayCandle.open > pos.targetPrice ? todayCandle.open : pos.targetPrice
      }
      // Check Time Exit (priority 3)
      else if (pos.age >= pos.maxDays) {
        exited = true
        status = 'TIME_EXIT'
        exitPrice = todayCandle.close
      }

      if (exited) {
        const exitValue = exitPrice * pos.shares
        cash += exitValue
        trades.push({
          symbol: pos.symbol,
          entryDate: pos.entryDate,
          entryPrice: pos.entryPrice,
          exitDate: today,
          exitPrice,
          status,
          pnlPct: ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100,
          holdingDays: pos.age,
          entryCapital: pos.entryCapital,
          exitValue
        })
      } else {
        nextActivePositions.push(pos)
      }
    }
    activePositions = nextActivePositions

    // --- Step B: Execute pending buys from yesterday's signals ---
    const remainingPending: PendingBuy[] = []
    for (const pending of pendingBuys) {
      const todayCandle = pending.series.candles.find((c) => c.date === today)
      
      // We check if we have slot space and cash remaining
      if (todayCandle && activePositions.length < maxPositions) {
        const entryPrice = todayCandle.open
        const allocationCap = startingCapital * (allocationPerTrade / 100)
        
        if (cash >= allocationCap) {
          cash -= allocationCap
          const shares = allocationCap / entryPrice

          // Adjust target and stop levels based on execution open price vs trigger close
          // Entry price ratio
          const ratio = entryPrice / todayCandle.open // since execution is today's open

          activePositions.push({
            symbol: pending.symbol,
            entryDate: today,
            entryPrice,
            shares,
            stopLoss: pending.stopLoss,
            targetPrice: pending.targetPrice,
            maxDays: pending.maxDays,
            age: 0,
            entryCapital: allocationCap,
            series: pending.series
          })
        }
      }
    }
    // We empty pending buys because entries either happened or expired (one-day order entry windows)
    pendingBuys = []

    // --- Step C: Evaluate signals today for entries tomorrow ---
    if (activePositions.length < maxPositions && i < totalDays - 1) {
      
      // Calculate Nifty regime trend state for today
      let isNiftyBullish = true
      if (niftySeries) {
        const niftyIdx = niftySeries.candles.findIndex((nc) => nc.date === today)
        if (niftyIdx >= 30) {
          const slicedNifty = niftySeries.candles.slice(0, niftyIdx + 1)
          const niftyInd = computeIndicators(slicedNifty)
          const lastNiftyClose = slicedNifty[slicedNifty.length - 1].close
          const benchmarkEma = niftyInd.ema200 || niftyInd.ema50 || lastNiftyClose
          isNiftyBullish = lastNiftyClose >= benchmarkEma
        }
      }

      const candidates: { sig: Signal; series: StockSeries; mlProb: number }[] = []

      for (const s of seriesList) {
        // Skip if already holding this stock
        if (activePositions.some((p) => p.symbol === s.symbol)) continue

        const todayIdx = s.candles.findIndex((c) => c.date === today)
        if (todayIdx < 30) continue // Skip if insufficient data

        const slicedCandles = s.candles.slice(0, todayIdx + 1)
        const slicedSeries: StockSeries = {
          symbol: s.symbol,
          name: s.name,
          sector: s.sector,
          candles: slicedCandles,
          lastIdx: todayIdx
        }

        try {
          const signals = evaluateStock(slicedSeries, isNiftyBullish)
          const sig = signals[timeframe]

          if (sig.action === 'BUY') {
            candidates.push({
              sig,
              series: s,
              mlProb: sig.mlProbability ?? sig.confidence
            })
          }
        } catch (err) {
          // Ignore failures for specific stocks on some dates
        }
      }

      // Sort candidate signals by ML Probability desc
      candidates.sort((a, b) => b.mlProb - a.mlProb)

      // Buffer pending entries for next day's open
      const emptySlots = maxPositions - activePositions.length
      const buysToFill = Math.min(emptySlots, candidates.length)

      for (let k = 0; k < buysToFill; k++) {
        const cand = candidates[k]
        
        // Define holding periods
        const maxDays = 
          timeframe === 'BTST' ? 2 : 
          timeframe === 'SHORT_TERM' ? 15 : 
          timeframe === 'MIDTERM' ? 60 : 250
        
        const targetPrice = targetSelection === 'T1' ? cand.sig.target1 : targetSelection === 'T3' ? cand.sig.target3 : cand.sig.target2

        pendingBuys.push({
          symbol: cand.series.symbol,
          stopLoss: cand.sig.stopLoss,
          targetPrice,
          maxDays,
          entryCapital: startingCapital * (allocationPerTrade / 100),
          series: cand.series
        })
      }
    }

    // --- Step D: Calculate Daily Equity Value & Drawdowns ---
    let openPositionsValue = 0
    for (const pos of activePositions) {
      const todayCandle = pos.series.candles.find((c) => c.date === today)
      const currentPrice = todayCandle ? todayCandle.close : pos.entryPrice
      openPositionsValue += currentPrice * pos.shares
    }

    const dailyEquity = cash + openPositionsValue
    equityCurve.push({
      date: today,
      equity: +dailyEquity.toFixed(2),
      cash: +cash.toFixed(2),
      positionsValue: +openPositionsValue.toFixed(2)
    })

    // Drawdown calculation
    if (dailyEquity > peakEquity) {
      peakEquity = dailyEquity
    }
    const currentDrawdown = ((peakEquity - dailyEquity) / peakEquity) * 100
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown
    }
  }

  // 3. Formulate results
  const finalValue = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : startingCapital
  const totalReturnPct = ((finalValue - startingCapital) / startingCapital) * 100
  
  const totalTrades = trades.length
  const winningTrades = trades.filter((t) => t.pnlPct > 0).length
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
  const averageHoldingDays = totalTrades > 0 
    ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / totalTrades 
    : 0

  return {
    startDate: timeline[startIdx] || '',
    endDate: timeline[timeline.length - 1] || '',
    initialCapital: startingCapital,
    finalValue: +finalValue.toFixed(2),
    totalReturnPct: +totalReturnPct.toFixed(2),
    winRate: +winRate.toFixed(2),
    totalTrades,
    maxDrawdown: +maxDrawdown.toFixed(2),
    averageHoldingDays: Math.round(averageHoldingDays),
    trades,
    equityCurve
  }
}
