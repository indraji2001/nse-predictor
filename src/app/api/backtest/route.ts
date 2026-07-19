import { NextRequest, NextResponse } from 'next/server'
import { fetchStockWithFallback, fetchNiftyIndex } from '@/lib/stocks/data-source'
import { runBacktest } from '@/lib/predictor/backtest'
import { Timeframe } from '@/lib/predictor/engine'

export const dynamic = 'force-dynamic'

// GET /api/backtest?symbol=RELIANCE&timeframe=SHORT_TERM&target=T2
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  const timeframe = req.nextUrl.searchParams.get('timeframe') as Timeframe | null
  const target = req.nextUrl.searchParams.get('target') as 'T1' | 'T2' | 'T3' | null

  if (!symbol) {
    return NextResponse.json({ error: 'Missing stock symbol parameter' }, { status: 400 })
  }

  const activeTimeframe = timeframe || 'SHORT_TERM'
  const activeTarget = target || 'T2'

  if (!['BTST', 'SHORT_TERM', 'MIDTERM', 'LONG_TERM'].includes(activeTimeframe)) {
    return NextResponse.json({ error: 'Invalid timeframe parameter' }, { status: 400 })
  }

  if (!['T1', 'T2', 'T3'].includes(activeTarget)) {
    return NextResponse.json({ error: 'Invalid target parameter' }, { status: 400 })
  }

  try {
    const fetched = await fetchStockWithFallback(symbol.toUpperCase(), new Date())
    if (!fetched || !fetched.series) {
      return NextResponse.json({ error: `Could not fetch historical data for stock: ${symbol}` }, { status: 404 })
    }

    const nifty = await fetchNiftyIndex()
    const backtestResult = runBacktest(fetched.series, activeTimeframe, activeTarget, nifty || undefined)

    return NextResponse.json({
      ...backtestResult,
      dataSource: fetched.source
    })
  } catch (error: any) {
    console.error('Error running backtest:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
