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
    return new NextResponse(
      `<html>
        <body style="font-family: sans-serif; padding: 2rem; background: #fafafa;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 4px solid #ef4444;">
            <h2 style="color: #dc2626; margin-top: 0;">Upstox OAuth Error</h2>
            <p>Upstox returned an error during authorization.</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;" />
            <p style="font-size: 0.9rem; color: #4b5563;"><strong>Error details:</strong></p>
            <pre style="background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 0.85rem; color: #1f2937; border: 1px solid #e5e7eb;">${errParam}</pre>
            <div style="margin-top: 2rem;">
              <a href="/" style="display: inline-block; background: #6d28d9; color: white; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; font-size: 0.9rem; font-weight: 500;">Back to Dashboard</a>
            </div>
          </div>
        </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }

  if (!code) {
    return new NextResponse(
      `<html>
        <body style="font-family: sans-serif; padding: 2rem; background: #fafafa;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 4px solid #ef4444;">
            <h2 style="color: #dc2626; margin-top: 0;">Missing Code</h2>
            <p>No authorization code was found in the redirect URL parameters.</p>
            <div style="margin-top: 2rem;">
              <a href="/" style="display: inline-block; background: #6d28d9; color: white; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; font-size: 0.9rem; font-weight: 500;">Back to Dashboard</a>
            </div>
          </div>
        </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }

  const result = await exchangeCodeForToken(code)
  if (result.success) {
    return NextResponse.redirect(new URL('/?upstox=connected', req.url))
  }

  return new NextResponse(
    `<html>
      <body style="font-family: sans-serif; padding: 2rem; background: #fafafa;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 4px solid #ef4444;">
          <h2 style="color: #dc2626; margin-top: 0;">Upstox Token Exchange Failed</h2>
          <p>The authorization code could not be exchanged for an access token. This usually happens if the <strong>API Secret</strong> or <strong>API Key</strong> is incorrect, or if the Redirect URL is mismatched.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;" />
          <p style="font-size: 0.9rem; color: #4b5563;"><strong>Error details:</strong></p>
          <pre style="background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 0.85rem; color: #1f2937; border: 1px solid #e5e7eb;">${result.error ?? 'Unknown error'}</pre>
          <div style="margin-top: 2rem;">
            <a href="/" style="display: inline-block; background: #6d28d9; color: white; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; font-size: 0.9rem; font-weight: 500;">Back to Dashboard</a>
          </div>
        </div>
      </body>
    </html>`,
    {
      headers: { 'Content-Type': 'text/html' }
    }
  )
}
