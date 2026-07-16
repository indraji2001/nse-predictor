import { NextRequest, NextResponse } from 'next/server'
import { fetchBhavcopyFromNSE } from '@/lib/stocks/nse-bhavcopy'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/bhavcopy/fetch?date=YYYY-MM-DD
// Fetches a single day's bhavcopy from NSE and saves to archive.
// If date is omitted, uses today (or most recent trading day).
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date')
  const targetDate = dateParam ? new Date(dateParam) : new Date()
  if (isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
  }
  const result = await fetchBhavcopyFromNSE(targetDate)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
