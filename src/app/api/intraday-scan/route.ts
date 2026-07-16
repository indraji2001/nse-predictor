import { NextRequest, NextResponse } from 'next/server'
import { scanIntradayUniverse } from '@/lib/stocks/intraday'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/intraday-scan?limit=80
// Scans the top N most-liquid stocks for intraday BUY_NOW / WAIT / SELL_WATCH signals.
// Uses Yahoo Finance 5-min interval data with ~15-min delay during market hours.
// Post-close, returns the day's final intraday picture.
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '80', 10)
  const safeLimit = Math.min(150, Math.max(20, isNaN(limit) ? 80 : limit))
  const result = await scanIntradayUniverse(safeLimit)
  return NextResponse.json(result)
}
