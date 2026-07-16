import { NextRequest, NextResponse } from 'next/server'
import { fetchUnifiedUniverse } from '@/lib/stocks/data-source'
import { evaluateUniverse, tagSignalSources } from '@/lib/predictor/engine'
import { generateUniverse } from '@/lib/stocks/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/predict
// Returns the full prediction result for all four timeframes:
//   BTST · SHORT_TERM · MIDTERM · LONG_TERM
//
// Optional query:
//   ?live=false  → force synthetic data (skip all live providers)
//   ?asOf=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const asOfParam = req.nextUrl.searchParams.get('asOf')
  const useLive = req.nextUrl.searchParams.get('live') !== 'false'
  const asOf = asOfParam ? new Date(asOfParam) : new Date()
  if (isNaN(asOf.getTime())) {
    return NextResponse.json({ error: 'Invalid asOf date' }, { status: 400 })
  }

  let series
  let sources: Record<string, 'NSE' | 'YAHOO' | 'DEMO'> = {}
  let nseCount = 0
  let yahooCount = 0
  let demoCount = 0
  let fetchedAt: string | null = null
  let nseActive = false

  if (useLive) {
    try {
      const live = await fetchUnifiedUniverse(asOf)
      series = live.series
      sources = live.sources
      nseCount = live.nseCount
      yahooCount = live.yahooCount
      demoCount = live.demoCount
      fetchedAt = live.fetchedAt
      nseActive = live.nseActive
    } catch {
      // All providers failed — fall back to full synthetic
      series = generateUniverse(asOf)
      demoCount = series.length
    }
  } else {
    series = generateUniverse(asOf)
    demoCount = series.length
  }

  const result = evaluateUniverse(series, asOf)
  // Attach per-stock data source to every signal so the UI can badge each card.
  tagSignalSources(result, sources as Record<string, 'LIVE' | 'DEMO'>)
  return NextResponse.json({
    ...result,
    dataSource: {
      nseActive,
      nseCount,
      yahooCount,
      demoCount,
      liveCount: nseCount + yahooCount, // backward compat
      total: series.length,
      sources,
      fetchedAt,
    },
  })
}
