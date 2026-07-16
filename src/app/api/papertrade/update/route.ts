import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { NSE_UNIVERSE } from '@/lib/stocks/universe'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/papertrade/update
// Walks all ACTIVE paper trades, fetches the latest close for each unique
// symbol, and updates status: ACTIVE | HIT_T1 | HIT_T2 | HIT_T3 | STOPPED_OUT.
// Called when the user clicks "Update prices" in the Paper Trades tab.
export async function POST() {
  const activeTrades = await db.paperTrade.findMany({
    where: { status: 'ACTIVE' },
  })

  if (activeTrades.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: 'No active trades to update' })
  }

  // Group by symbol (one fetch per symbol even if multiple trades)
  const symbols = [...new Set(activeTrades.map((t) => t.symbol))]
  const meta = new Map<string, (typeof NSE_UNIVERSE)[number]>()
  for (const s of symbols) {
    const m = NSE_UNIVERSE.find((x) => x.symbol === s.toUpperCase())
    if (m) meta.set(s, m)
  }

  // Fetch latest price for each symbol from Yahoo
  const prices = new Map<string, number>()
  for (const sym of symbols) {
    const m = meta.get(sym)
    if (!m) continue
    const yahooSym = m.yahooSymbol ?? `${m.symbol}.NS`
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=5d&interval=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      )
      if (!res.ok) continue
      const json = await res.json()
      const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      // Find the latest non-null close
      for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] != null) {
          prices.set(sym, closes[i])
          break
        }
      }
      // Be polite — 0.5s between requests
      await new Promise((r) => setTimeout(r, 500))
    } catch {
      // skip on error
    }
  }

  // Update each trade
  let updated = 0
  let hitT1 = 0, hitT2 = 0, hitT3 = 0, stoppedOut = 0
  for (const trade of activeTrades) {
    const currentPrice = prices.get(trade.symbol)
    if (currentPrice == null) continue // couldn't fetch

    // Update max/min
    const maxPrice = Math.max(trade.maxPrice, currentPrice)
    const minPrice = trade.minPrice === 0 ? currentPrice : Math.min(trade.minPrice, currentPrice)
    const pnlPct = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100

    // Check target hits (in order T1 → T2 → T3)
    const hitTargets: string[] = JSON.parse(trade.hitTargets || '[]')
    if (currentPrice >= trade.target1 && !hitTargets.includes('T1')) hitTargets.push('T1')
    if (currentPrice >= trade.target2 && !hitTargets.includes('T2')) hitTargets.push('T2')
    if (currentPrice >= trade.target3 && !hitTargets.includes('T3')) hitTargets.push('T3')

    // Check stop loss
    let status = 'ACTIVE'
    if (currentPrice <= trade.stopLoss) {
      status = 'STOPPED_OUT'
      stoppedOut++
    } else if (hitTargets.includes('T3')) {
      status = 'HIT_T3'
      hitT3++
    } else if (hitTargets.includes('T2')) {
      status = 'HIT_T2'
      hitT2++
    } else if (hitTargets.includes('T1')) {
      status = 'HIT_T1'
      hitT1++
    }

    await db.paperTrade.update({
      where: { id: trade.id },
      data: {
        currentPrice,
        maxPrice,
        minPrice,
        pnlPct,
        hitTargets: JSON.stringify(hitTargets),
        status,
        updatedAt: new Date(),
        closedAt: status !== 'ACTIVE' ? new Date() : null,
      },
    })
    updated++
  }

  return NextResponse.json({
    ok: true,
    updated,
    fetchedPrices: prices.size,
    totalActive: activeTrades.length,
    hits: { hitT1, hitT2, hitT3, stoppedOut },
  })
}
