import { NextResponse } from 'next/server'
import { getAuthorizeUrl } from '@/lib/stocks/upstox'

export const dynamic = 'force-dynamic'

// GET /api/upstox/connect
// Redirects the user to Upstox's OAuth login page.
export async function GET() {
  const url = await getAuthorizeUrl()
  if (!url) {
    return NextResponse.json(
      { error: 'Upstox not configured. Save API credentials first.' },
      { status: 400 },
    )
  }
  return NextResponse.redirect(url)
}
