import { NextResponse } from 'next/server'
import { getStatus } from '@/lib/stocks/upstox'

export const dynamic = 'force-dynamic'

// GET /api/upstox/status
// Returns whether Upstox is configured + connected.
export async function GET() {
  const status = await getStatus()
  return NextResponse.json(status)
}
