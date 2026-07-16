import { NextRequest, NextResponse } from 'next/server'
import { fetchIntradayForSymbol } from '@/lib/stocks/intraday'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// GET /api/intraday/[symbol]
// Returns intraday analysis for a single symbol — today's candles, VWAP, ORB,
// 5-min EMA9/EMA21, and a BUY_NOW / WAIT / AVOID / SELL_WATCH action.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()
  const result = await fetchIntradayForSymbol(sym)
  if (!result) {
    return NextResponse.json({ error: `No intraday data for ${sym}` }, { status: 404 })
  }
  return NextResponse.json(result)
}
