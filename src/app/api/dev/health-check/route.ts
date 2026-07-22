import { NextRequest, NextResponse } from 'next/server'
import { NSE_UNIVERSE as ALL_STOCKS } from '@/lib/stocks/universe'
import { fetchUnifiedUniverse } from '@/lib/stocks/data-source'
import masterList from '@/lib/stocks/nifty500-master-list.json'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const providerParam = req.nextUrl.searchParams.get('provider')
  const provider = (providerParam === 'UPSTOX' || providerParam === 'YAHOO' || providerParam === 'NSE') ? providerParam : 'YAHOO'
  const range = req.nextUrl.searchParams.get('range') || '1y'

  // 1. Check for missing mappings compared to nifty500-master-list.json
  const activeSymbols = new Set(ALL_STOCKS.map(s => s.symbol.toUpperCase()))
  const missingFromUniverse = masterList.filter(
    m => !activeSymbols.has(m.symbol.toUpperCase())
  )

  // 2. Check for extra stocks in active universe not in master list
  const masterSymbols = new Set(masterList.map(m => m.symbol.toUpperCase()))
  const extraInUniverse = ALL_STOCKS.filter(
    s => !masterSymbols.has(s.symbol.toUpperCase())
  ).map(s => ({ symbol: s.symbol, name: s.name }))

  // 3. Scan for DEMO fallbacks under specified provider and range
  let demoCount = 0
  let demoSymbols: string[] = []
  let errorMsg: string | null = null

  try {
    const result = await fetchUnifiedUniverse(new Date(), provider, range)
    demoCount = result.demoCount
    demoSymbols = Object.entries(result.sources)
      .filter(([_, src]) => src === 'DEMO')
      .map(([sym]) => sym)
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Failed to scan unified universe'
  }

  // 4. Check for duplicate symbols in active universe
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const s of ALL_STOCKS) {
    if (seen.has(s.symbol.toUpperCase())) {
      duplicates.push(s.symbol)
    }
    seen.add(s.symbol.toUpperCase())
  }

  return NextResponse.json({
    totalMasterCount: masterList.length,
    totalActiveCount: ALL_STOCKS.length,
    missingFromUniverse,
    extraInUniverse,
    duplicates,
    provider,
    range,
    demoCount,
    demoSymbols,
    error: errorMsg,
    ok: missingFromUniverse.length === 0 && duplicates.length === 0 && demoCount === 0
  })
}
