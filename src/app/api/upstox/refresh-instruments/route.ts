import { NextResponse } from 'next/server'
import { refreshInstrumentMaster } from '@/lib/stocks/upstox'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/upstox/refresh-instruments
// Downloads the Upstox instrument master and caches NSE equity entries.
export async function POST() {
  const result = await refreshInstrumentMaster()
  return NextResponse.json(result, { status: result.error ? 500 : 200 })
}
