import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/stocks/upstox'

export const dynamic = 'force-dynamic'

// GET /api/upstox/callback?code=XXX
// OAuth callback — exchanges the auth code for an access token, then redirects
// back to the home page with a status flag in the query string.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const errParam = req.nextUrl.searchParams.get('error')

  if (errParam) {
    return NextResponse.redirect(
      new URL(`/?upstox=error&msg=${encodeURIComponent(errParam)}`, req.url),
    )
  }
  if (!code) {
    return NextResponse.redirect(
      new URL('/?upstox=error&msg=missing_code', req.url),
    )
  }

  const result = await exchangeCodeForToken(code)
  if (result.success) {
    return NextResponse.redirect(new URL('/?upstox=connected', req.url))
  }
  return NextResponse.redirect(
    new URL(`/?upstox=error&msg=${encodeURIComponent(result.error ?? 'unknown')}`, req.url),
  )
}
