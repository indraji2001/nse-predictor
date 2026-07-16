import { NextRequest, NextResponse } from 'next/server'
import { saveCredentials } from '@/lib/stocks/upstox'

export const dynamic = 'force-dynamic'

// POST /api/upstox/credentials
// Body: { apiKey, apiSecret, redirectUri }
// Saves the Upstox API credentials to the DB. Does NOT initiate OAuth yet.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { apiKey, apiSecret, redirectUri } = body as {
    apiKey?: string
    apiSecret?: string
    redirectUri?: string
  }
  if (!apiKey || !apiSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing required fields: apiKey, apiSecret, redirectUri' },
      { status: 400 },
    )
  }
  // Basic shape validation
  if (!redirectUri.startsWith('https://')) {
    return NextResponse.json(
      { error: 'redirectUri must be an HTTPS URL (Upstox rejects HTTP)' },
      { status: 400 },
    )
  }
  await saveCredentials(apiKey.trim(), apiSecret.trim(), redirectUri.trim())
  return NextResponse.json({ ok: true })
}
