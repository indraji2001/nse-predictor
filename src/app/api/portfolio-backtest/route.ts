import { NextRequest, NextResponse } from 'next/server'
import { fetchStockWithFallback, fetchNiftyIndex } from '@/lib/stocks/data-source'
import { runPortfolioBacktest } from '@/lib/predictor/portfolio-backtest'
import { Timeframe } from '@/lib/predictor/engine'
import { StockSeries } from '@/lib/stocks/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Run parallel tasks with concurrency limit
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return results
}

// POST /api/portfolio-backtest
// Request Body:
// {
//   "symbols": ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"],
//   "timeframe": "SHORT_TERM",
//   "target": "T2",
//   "startingCapital": 100000,
//   "maxPositions": 5,
//   "allocationPerTrade": 20
// }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      symbols,
      timeframe = 'SHORT_TERM',
      target = 'T2',
      startingCapital = 100000,
      maxPositions = 5,
      allocationPerTrade = 20
    } = body

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid symbols array parameter' }, { status: 400 })
    }

    // Clean symbols list (dedup and limit to maximum 25 stocks to prevent Vercel execution timeouts)
    const activeSymbols = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).slice(0, 25)

    // 1. Fetch historical series for all requested stocks concurrently (cap at 4 threads)
    const fetchedResults = await mapWithConcurrency(activeSymbols, 4, async (sym) => {
      try {
        const res = await fetchStockWithFallback(sym, new Date())
        return res ? res.series : null
      } catch {
        return null
      }
    })

    const stockSeriesList = fetchedResults.filter((s): s is StockSeries => s !== null && s.candles && s.candles.length >= 30)

    if (stockSeriesList.length === 0) {
      return NextResponse.json({ error: 'None of the requested stocks had valid historical data.' }, { status: 404 })
    }

    // 2. Fetch Nifty 50 index benchmark
    let niftySeries: StockSeries | undefined
    try {
      const nifty = await fetchNiftyIndex()
      if (nifty) niftySeries = nifty
    } catch (err) {
      console.warn('Failed to fetch Nifty 50 index for portfolio backtester:', err)
    }

    // 3. Execute the simulation
    const result = runPortfolioBacktest(
      stockSeriesList,
      timeframe as Timeframe,
      target as 'T1' | 'T2' | 'T3',
      Number(startingCapital),
      Number(maxPositions),
      Number(allocationPerTrade),
      niftySeries
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error('Error running portfolio backtester:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 })
  }
}
