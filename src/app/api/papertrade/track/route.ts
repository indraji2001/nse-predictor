import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { NSE_UNIVERSE } from '@/lib/stocks/universe'

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

  // Fire-and-forget: fetch the live price immediately so the user sees
  // a real P&L on the Trades tab without needing to click "Update prices".
  // This fixes the bug where freshly-tracked positions showed 0.00% P&L
  // (sometimes green) even when the actual live price was below entry.
  ;(async () => {
    try {
      const m = NSE_UNIVERSE.find((x) => x.symbol === String(symbol).toUpperCase())
      if (!m) return
      const yahooSym = m.yahooSymbol ?? `${m.symbol}.NS`
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=5d&interval=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      )
      if (!res.ok) return
      const json = await res.json()
      const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      let livePrice: number | null = null
      for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] != null) {
          livePrice = closes[i]
          break
        }
      }
      if (livePrice == null) return

      const entry = Number(entryPrice)
      const pnlPct = ((livePrice - entry) / entry) * 100
      await db.paperTrade.update({
        where: { id: trade.id },
        data: {
          currentPrice: livePrice,
          maxPrice: Math.max(entry, livePrice),
          minPrice: Math.min(entry, livePrice),
          pnlPct,
          updatedAt: new Date(),
        },
      })
    } catch {
      // Silent — live-price fetch is best-effort
    }
  })()

  return NextResponse.json({ ok: true, trade })
}
