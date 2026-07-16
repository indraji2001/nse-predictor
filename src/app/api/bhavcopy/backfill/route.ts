import { NextRequest, NextResponse } from 'next/server'
import { backfillBhavcopy } from '@/lib/stocks/nse-bhavcopy'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // up to 5 minutes for backfill

// POST /api/bhavcopy/backfill?days=30
// Walks backwards from today, fetching up to N bhavcopy files from NSE.
// Skips already-archived dates and weekends/holidays. Returns counts.
export async function POST(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '10', 10)
  if (isNaN(days) || days < 1 || days > 60) {
    return NextResponse.json({ error: 'days must be between 1 and 60' }, { status: 400 })
  }
  const result = await backfillBhavcopy(days)
  return NextResponse.json(result)
}
