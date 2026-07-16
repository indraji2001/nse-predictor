import { NextResponse } from 'next/server'
import { NSE_UNIVERSE } from '@/lib/stocks/universe'

export const dynamic = 'force-dynamic'

// GET /api/screener
// Returns the static universe list (symbol + name + sector) for client-side search.
export async function GET() {
  return NextResponse.json(
    NSE_UNIVERSE.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
    })),
  )
}
