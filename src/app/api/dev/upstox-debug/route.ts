import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getStatus,
  refreshInstrumentMaster,
  bulkGetInstrumentKeys,
  getAccessToken,
  fetchHistorical,
} from '@/lib/stocks/upstox'
import { NSE_UNIVERSE } from '@/lib/stocks/universe'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/dev/upstox-debug
// Full diagnostic of the Upstox pipeline. Safe read-only except for
// instrument master refresh if DB is empty.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const forceRefresh = url.searchParams.get('refresh') === '1'

  const report: Record<string, unknown> = {}

  // ── Step 1: OAuth status from DB ────────────────────────────────────────
  try {
    const status = await getStatus()
    report.step1_oauth_status = status
  } catch (e) {
    report.step1_oauth_status = { error: String(e) }
  }

  // ── Step 2: Raw DB token check ───────────────────────────────────────────
  try {
    const cfg = await db.upstoxConfig.findUnique({ where: { id: 1 } })
    report.step2_db_config = {
      hasApiKey: !!cfg?.apiKey,
      hasApiSecret: !!cfg?.apiSecret,
      hasAccessToken: !!cfg?.accessToken,
      accessTokenLength: cfg?.accessToken?.length ?? 0,
      tokenExpiresAt: cfg?.tokenExpiresAt?.toISOString() ?? null,
      tokenExpired: cfg?.tokenExpiresAt ? cfg.tokenExpiresAt.getTime() < Date.now() : null,
      redirectUri: cfg?.redirectUri ?? null,
    }
  } catch (e) {
    report.step2_db_config = { error: String(e) }
  }

  // ── Step 3: getAccessToken() result ─────────────────────────────────────
  try {
    const token = await getAccessToken()
    report.step3_access_token = {
      obtained: !!token,
      length: token?.length ?? 0,
      prefix: token ? token.slice(0, 20) + '...' : null,
    }
  } catch (e) {
    report.step3_access_token = { error: String(e) }
  }

  // ── Step 4: Instrument master DB count ──────────────────────────────────
  try {
    const count = await db.upstoxInstrument.count()
    report.step4_instrument_db_count = count

    if (count === 0 || forceRefresh) {
      // Try to refresh
      const refreshResult = await refreshInstrumentMaster()
      report.step4_instrument_refresh = refreshResult
      const newCount = await db.upstoxInstrument.count()
      report.step4_instrument_db_count_after_refresh = newCount
    }
  } catch (e) {
    report.step4_instrument_db_count = { error: String(e) }
  }

  // ── Step 5: Bulk key lookup for first 5 universe symbols ─────────────────
  try {
    const testSymbols = NSE_UNIVERSE.slice(0, 10).map(m => m.symbol)
    const keys = await bulkGetInstrumentKeys(testSymbols)
    report.step5_bulk_key_sample = {
      requestedSymbols: testSymbols,
      foundCount: Object.keys(keys).length,
      sample: keys,
    }
  } catch (e) {
    report.step5_bulk_key_sample = { error: String(e) }
  }

  // ── Step 6: Test known symbols (RELIANCE, INFY, TCS) ────────────────────
  const testSymbols = ['RELIANCE', 'INFY', 'TCS']
  try {
    const keys = await bulkGetInstrumentKeys(testSymbols)
    report.step6_known_symbols_keys = keys
  } catch (e) {
    report.step6_known_symbols_keys = { error: String(e) }
  }

  // ── Step 7: Fetch 1Y historical for RELIANCE ─────────────────────────────
  try {
    const meta = NSE_UNIVERSE.find(m => m.symbol === 'RELIANCE')
    if (meta) {
      const result = await fetchHistorical(meta, '1y')
      report.step7_reliance_1y = result
        ? {
            success: true,
            candleCount: result.candles.length,
            firstDate: result.candles[0]?.date,
            lastDate: result.candles[result.candles.length - 1]?.date,
            lastClose: result.candles[result.candles.length - 1]?.close,
          }
        : { success: false, result: null }
    } else {
      report.step7_reliance_1y = { error: 'RELIANCE not found in NSE_UNIVERSE' }
    }
  } catch (e) {
    report.step7_reliance_1y = { error: String(e) }
  }

  // ── Step 8: Direct Upstox API call (raw) ─────────────────────────────────
  try {
    const token = await getAccessToken()
    if (token) {
      const profileRes = await fetch('https://api.upstox.com/v2/user/profile', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      const profileJson = await profileRes.json()
      report.step8_raw_profile_api = {
        httpStatus: profileRes.status,
        ok: profileRes.ok,
        data: profileRes.ok ? { email: profileJson?.data?.email, name: profileJson?.data?.user_name, broker: profileJson?.data?.broker } : profileJson,
      }
    } else {
      report.step8_raw_profile_api = { skipped: 'no token' }
    }
  } catch (e) {
    report.step8_raw_profile_api = { error: String(e) }
  }

  // ── Step 9: Direct Upstox instrument master URL check ────────────────────
  try {
    const INSTRUMENT_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz'
    const headRes = await fetch(INSTRUMENT_URL, { method: 'HEAD', cache: 'no-store' })
    report.step9_instrument_url_check = {
      url: INSTRUMENT_URL,
      status: headRes.status,
      ok: headRes.ok,
      contentType: headRes.headers.get('content-type'),
      contentLength: headRes.headers.get('content-length'),
    }
  } catch (e) {
    report.step9_instrument_url_check = { error: String(e) }
  }

  return NextResponse.json(report, { status: 200 })
}
