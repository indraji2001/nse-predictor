import { Candle, StockSeries } from '../stocks/engine'
import { Timeframe, evaluateStock, Signal } from './engine'
import { computeIndicators } from '../indicators'

export interface BacktestTrade {
  symbol: string
  entryDate: string
  entryPrice: number
  exitDate: string
  exitPrice: number
  status: 'HIT_TARGET' | 'STOPPED_OUT' | 'TIME_EXIT'
  pnlPct: number
  holdingDays: number
}

export interface EquityPoint {
  date: string
  equity: number
}

export interface BacktestResult {
  symbol: string
  timeframe: Timeframe
  startDate: string
  endDate: string
  totalTrades: number
  winRate: number
  totalPnLPct: number
  maxDrawdown: number
  averageHoldingDays: number
  trades: BacktestTrade[]
  equityCurve: EquityPoint[]
}

export function runBacktest(
  series: StockSeries,
  timeframe: Timeframe,
  targetSelection: 'T1' | 'T2' | 'T3' = 'T2',
  niftySeries?: StockSeries
): BacktestResult {
  const candles = series.candles
  const n = candles.length
  const trades: BacktestTrade[] = []
  
  // Starting capital for equity curve calculations (100 is base index)
  let currentEquity = 100
  const equityCurve: EquityPoint[] = []

  if (n < 50) {
    return {
      symbol: series.symbol,
      timeframe,
      startDate: n > 0 ? candles[0].date : '',
      endDate: n > 0 ? candles[n - 1].date : '',
      totalTrades: 0,
      winRate: 0,
      totalPnLPct: 0,
      maxDrawdown: 0,
      averageHoldingDays: 0,
      trades: [],
      equityCurve: [],
    }
  }

  // We need enough historical candles for indicator calculations (e.g. 200 EMA).
  // If we have fewer than 200, we start after 40 candles (unreliable indicators but works for shorter universes).
  const startIdx = n >= 200 ? 150 : Math.min(40, n - 10)
  
  // Keep track of active trade state
  let activeTrade: {
    entryIndex: number
    entryPrice: number
    stopLoss: number
    targetPrice: number
    maxDays: number
  } | null = null

  // Loop through candles historically
  for (let i = startIdx; i < n; i++) {
    const candle = candles[i]
    equityCurve.push({ date: candle.date, equity: currentEquity })

    // 1. Process active trade exits
    if (activeTrade) {
      const entryCandle = candles[activeTrade.entryIndex]
      const daysOpen = i - activeTrade.entryIndex
      
      let exitPrice = 0
      let status: 'HIT_TARGET' | 'STOPPED_OUT' | 'TIME_EXIT' | null = null

      // Check Stop Loss first (conservative)
      if (candle.low <= activeTrade.stopLoss) {
        exitPrice = Math.min(candle.open, activeTrade.stopLoss) // Handle gap-downs
        status = 'STOPPED_OUT'
      } 
      // Check Target
      else if (candle.high >= activeTrade.targetPrice) {
        exitPrice = Math.max(candle.open, activeTrade.targetPrice) // Handle gap-ups
        status = 'HIT_TARGET'
      }
      // Check Time Exit
      else if (daysOpen >= activeTrade.maxDays) {
        exitPrice = candle.close
        status = 'TIME_EXIT'
      }

      if (status !== null) {
        const pnlPct = ((exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice) * 100
        
        // Update equity (simulating investing full capital/proportion)
        currentEquity = currentEquity * (1 + pnlPct / 100)

        trades.push({
          symbol: series.symbol,
          entryDate: entryCandle.date,
          entryPrice: activeTrade.entryPrice,
          exitDate: candle.date,
          exitPrice,
          status,
          pnlPct: +pnlPct.toFixed(2),
          holdingDays: daysOpen + 1
        })

        activeTrade = null // Position closed
      }
    }

    // 2. Check for new BUY entries (only if no active trade and not on the last candle)
    if (!activeTrade && i < n - 1) {
      // Slice candles up to today (inclusive of index i)
      const slicedSeries: StockSeries = {
        symbol: series.symbol,
        name: series.name,
        sector: series.sector,
        candles: candles.slice(0, i + 1),
        lastIdx: i
      }

      let isNiftyBullish = true
      if (niftySeries) {
        const targetDate = candle.date
        const niftyIdx = niftySeries.candles.findIndex((nc) => nc.date === targetDate)
        if (niftyIdx >= 30) {
          const slicedNifty = {
            symbol: '^NSEI',
            name: 'Nifty 50',
            sector: 'Financials',
            candles: niftySeries.candles.slice(0, niftyIdx + 1),
            lastIdx: niftyIdx
          }
          const niftyInd = computeIndicators(slicedNifty.candles)
          const lastNiftyClose = slicedNifty.candles[niftyIdx].close
          const benchmarkEma = niftyInd.ema200 || niftyInd.ema50 || lastNiftyClose
          isNiftyBullish = lastNiftyClose >= benchmarkEma
        }
      }

      const signals = evaluateStock(slicedSeries, isNiftyBullish)
      const sig = signals[timeframe]

      if (sig.action === 'BUY') {
        const nextCandle = candles[i + 1]
        
        // Buy on the NEXT day's open price (highly realistic execution)
        const entryPrice = nextCandle.open

        // Adjust targets and stop loss relative to our actual entry price vs the EOD close price
        const ratio = entryPrice / sig.entry
        const stopLoss = +(sig.stopLoss * ratio).toFixed(2)
        const t1 = +(sig.target1 * ratio).toFixed(2)
        const t2 = +(sig.target2 * ratio).toFixed(2)
        const t3 = +(sig.target3 * ratio).toFixed(2)
        
        const targetPrice = targetSelection === 'T1' ? t1 : targetSelection === 'T3' ? t3 : t2
        
        // Define holding constraints based on horizon
        const maxDays = 
          timeframe === 'BTST' ? 2 : 
          timeframe === 'SHORT_TERM' ? 15 : 
          timeframe === 'MIDTERM' ? 60 : 250

        activeTrade = {
          entryIndex: i + 1,
          entryPrice,
          stopLoss,
          targetPrice,
          maxDays
        }
      }
    }
  }

  // Calculate stats
  const totalTrades = trades.length
  const winningTrades = trades.filter((t) => t.pnlPct > 0).length
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
  const totalPnLPct = totalTrades > 0 ? ((currentEquity - 100) / 100) * 100 : 0
  
  // Calculate average holding period
  const averageHoldingDays = totalTrades > 0 
    ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / totalTrades 
    : 0

  // Calculate Max Drawdown from the equity curve
  let peak = 100
  let maxDD = 0
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity
    const dd = ((pt.equity - peak) / peak) * 100
    if (dd < maxDD) maxDD = dd
  }

  return {
    symbol: series.symbol,
    timeframe,
    startDate: candles[startIdx].date,
    endDate: candles[n - 1].date,
    totalTrades,
    winRate: +winRate.toFixed(1),
    totalPnLPct: +totalPnLPct.toFixed(2),
    maxDrawdown: +maxDD.toFixed(2),
    averageHoldingDays: +averageHoldingDays.toFixed(1),
    trades,
    equityCurve
  }
}
