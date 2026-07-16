import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/papertrade/track
// Body: { symbol, name, sector, timeframe, entryPrice, stopLoss, target1, target2, target3, riskReward, holdingPeriod, confidence }
// Saves a new paper trade to track.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    symbol, name, sector, timeframe,
    entryPrice, stopLoss, target1, target2, target3,
    riskReward, holdingPeriod, confidence,
  } = body as Record<string, unknown>

  // Validate required fields
  if (!symbol || !timeframe || typeof entryPrice !== 'number') {
    return NextResponse.json({ error: 'Missing required fields: symbol, timeframe, entryPrice' }, { status: 400 })
  }
  const validTimeframes = ['BTST', 'SHORT_TERM', 'MIDTERM', 'LONG_TERM']
  if (!validTimeframes.includes(String(timeframe))) {
    return NextResponse.json({ error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}` }, { status: 400 })
  }

  // Check if there's already an active trade for this symbol+timeframe
  const existing = await db.paperTrade.findFirst({
    where: {
      symbol: String(symbol).toUpperCase(),
      timeframe: String(timeframe),
      status: 'ACTIVE',
    },
  })
  if (existing) {
    return NextResponse.json({
      error: `Already tracking an active ${timeframe} trade for ${symbol}. Close it first or use a different timeframe.`,
      existingId: existing.id,
    }, { status: 409 })
  }

  const trade = await db.paperTrade.create({
    data: {
      symbol: String(symbol).toUpperCase(),
      name: String(name ?? symbol),
      sector: String(sector ?? 'Unknown'),
      timeframe: String(timeframe),
      entryPrice: Number(entryPrice),
      stopLoss: Number(stopLoss),
      target1: Number(target1),
      target2: Number(target2),
      target3: Number(target3),
      riskReward: Number(riskReward ?? 0),
      holdingPeriod: String(holdingPeriod ?? ''),
      confidence: Number(confidence ?? 0),
      currentPrice: Number(entryPrice), // start at entry
      maxPrice: Number(entryPrice),
      minPrice: Number(entryPrice),
      pnlPct: 0,
    },
  })

  return NextResponse.json({ ok: true, trade })
}
