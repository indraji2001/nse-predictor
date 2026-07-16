import { NextRequest, NextResponse } from 'next/server'
import { backfillBhavcopy } from '@/lib/stocks/nse-bhavcopy'

export const dynamic = 'force-dynamic'
// Vercel Hobby tier max function duration is 60 seconds.
// Vercel Pro tier supports up to 300s — bump this if you upgrade.
export const maxDuration = 60

// POST /api/bhavcopy/backfill?days=30
// Walks backwards from today, fetching up to N bhavcopy files from NSE.
// Skips already-archived dates and weekends/holidays. Returns counts.
//
// NOTE: On Vercel this endpoint always returns an error because the bhavcopy
// archive requires a writable filesystem (see src/lib/stocks/nse-bhavcopy.ts).
// Run the app locally to use the backfill feature.
export async function POST(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '10', 10)
  if (isNaN(days) || days < 1 || days > 60) {
    return NextResponse.json({ error: 'days must be between 1 and 60' }, { status: 400 })
  }
  const result = await backfillBhavcopy(days)
  return NextResponse.json(result)
}
