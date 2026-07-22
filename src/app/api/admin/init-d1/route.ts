import { NextResponse } from 'next/server'
import { D1_SCHEMA } from '@/lib/d1-client'

export const dynamic = 'force-dynamic'

// GET /api/admin/init-d1
// Creates all tables in Cloudflare D1 on first deploy.
// Safe to call multiple times — all statements use CREATE TABLE IF NOT EXISTS.
export async function GET() {
  const accountId  = process.env.CLOUDFLARE_ACCOUNT_ID
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
  const apiToken   = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !databaseId || !apiToken) {
    return NextResponse.json(
      { error: 'Missing Cloudflare D1 env vars. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN.' },
      { status: 500 }
    )
  }

  // Split schema into individual statements and execute each one
  const statements = D1_SCHEMA
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const results: { sql: string; ok: boolean; error?: string }[] = []

  for (const sql of statements) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql, params: [] }),
          cache: 'no-store',
        }
      )
      const data = await res.json() as any
      if (!data.success) {
        results.push({ sql: sql.slice(0, 80), ok: false, error: data.errors?.[0]?.message })
      } else {
        results.push({ sql: sql.slice(0, 80), ok: true })
      }
    } catch (e: any) {
      results.push({ sql: sql.slice(0, 80), ok: false, error: e.message })
    }
  }

  const allOk = results.every(r => r.ok)
  return NextResponse.json({
    success: allOk,
    message: allOk ? '✅ D1 schema initialised — all tables created.' : '⚠️ Some statements failed — check results.',
    results,
  }, { status: allOk ? 200 : 500 })
}
