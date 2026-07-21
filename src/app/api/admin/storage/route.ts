import { NextRequest, NextResponse } from 'next/server'
import { getCacheStats, pruneCachedCandles } from '@/lib/stocks/candle-cache'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/storage
// Returns cache database stats
export async function GET() {
  try {
    const stats = await getCacheStats()
    return NextResponse.json(stats)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/storage
// Performs cleanups (prune, clear, reset)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'prune') {
      const { days = 90 } = body
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - days)
      const dateStr = dateLimit.toISOString().slice(0, 10)

      const count = await pruneCachedCandles('5m', dateStr)
      return NextResponse.json({ success: true, prunedCount: count, message: `Pruned intraday data older than ${days} days (before ${dateStr})` })
    }

    if (action === 'clear_eod') {
      const { beforeDate } = body
      if (!beforeDate || !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) {
        return NextResponse.json({ error: 'Invalid beforeDate (must be YYYY-MM-DD)' }, { status: 400 })
      }
      
      const count = await pruneCachedCandles('day', beforeDate)
      return NextResponse.json({ success: true, prunedCount: count, message: `Pruned EOD data before ${beforeDate}` })
    }

    if (action === 'reset') {
      // Deletes all rows in the StockCandle table
      const result = await db.stockCandle.deleteMany({})
      return NextResponse.json({ success: true, prunedCount: result.count, message: 'All cached candles cleared successfully!' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
