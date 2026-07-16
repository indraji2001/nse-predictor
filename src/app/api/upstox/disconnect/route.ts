import { NextResponse } from 'next/server'
import { disconnect } from '@/lib/stocks/upstox'

export const dynamic = 'force-dynamic'

// POST /api/upstox/disconnect
// Clears the access token but keeps the API credentials (so reconnect is one click).
export async function POST() {
  await disconnect()
  return NextResponse.json({ ok: true })
}
