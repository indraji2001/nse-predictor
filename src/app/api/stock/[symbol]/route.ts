import { NextRequest, NextResponse } from 'next/server'
import { fetchStockWithFallback } from '@/lib/stocks/data-source'
import { getStockSeries } from '@/lib/stocks/engine'
import { evaluateStock } from '@/lib/predictor/engine'
import { computeIndicators } from '@/lib/indicators'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/stock/[symbol]
// Returns full detail for one symbol: candles + indicators + 4 timeframe signals.
// Priority: NSE archive → Yahoo → synthetic
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()
  const useLive = req.nextUrl.searchParams.get('live') !== 'false'
  const asOf = new Date()

  let series
  let source: 'NSE' | 'YAHOO' | 'DEMO' = 'DEMO'
  if (useLive) {
    try {
      const r = await fetchStockWithFallback(sym, asOf)
      if (r) {
        series = r.series
        source = r.source
      }
    } catch {
      // fall through to synthetic
    }
  }
  if (!series) {
    series = getStockSeries(sym, asOf)
  }
  if (!series) {
    return NextResponse.json({ error: `Symbol ${sym} not found` }, { status: 404 })
  }

  const indicators = computeIndicators(series.candles)
  const signals = evaluateStock(series)
  // Trim candles to last 120 days for response payload
  const candles = series.candles.slice(-120)
  return NextResponse.json({
    symbol: series.symbol,
    name: series.name,
    sector: series.sector,
    candles,
    indicators,
    signals,
    dataSource: source,
  })
}
