import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/papertrade/list?status=ACTIVE&timeframe=BTST
// Returns all paper trades, optionally filtered by status and/or timeframe.
// Sorted: ACTIVE first (by trackedAt desc), then HIT_T3, HIT_T2, HIT_T1, STOPPED_OUT, CLOSED.
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status')
  const timeframe = req.nextUrl.searchParams.get('timeframe')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (timeframe) where.timeframe = timeframe

  const trades = await db.paperTrade.findMany({
    where,
    orderBy: [
      // ACTIVE first, then by trackedAt desc
      { status: 'asc' },
      { trackedAt: 'desc' },
    ],
    take: 500,
  })

  // Compute summary stats
  const stats = {
    total: trades.length,
    active: trades.filter((t) => t.status === 'ACTIVE').length,
    hitT1: trades.filter((t) => t.hitTargets.includes('T1')).length,
    hitT2: trades.filter((t) => t.hitTargets.includes('T2')).length,
    hitT3: trades.filter((t) => t.hitTargets.includes('T3')).length,
    stoppedOut: trades.filter((t) => t.status === 'STOPPED_OUT').length,
    avgPnl: trades.length > 0
      ? trades.reduce((s, t) => s + (t.pnlPct || 0), 0) / trades.length
      : 0,
    winRate: trades.length > 0
      ? (trades.filter((t) => t.pnlPct > 0).length / trades.length) * 100
      : 0,
  }

  return NextResponse.json({ trades, stats })
}
