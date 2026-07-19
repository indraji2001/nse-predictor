import { NextResponse } from 'next/server'
import { testConnection } from '@/lib/stocks/upstox'

export const dynamic = 'force-dynamic'

// GET /api/upstox/test
// Tests the connection to Upstox using the stored access token.
export async function GET() {
  const result = await testConnection()
  return NextResponse.json(result)
}
