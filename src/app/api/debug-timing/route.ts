import { NextRequest, NextResponse } from 'next/server'
import { fetchUnifiedUniverseCached, fetchNiftyIndex } from '@/lib/stocks/data-source'
import { evaluateUniverse, tagSignalSources } from '@/lib/predictor/engine'
import { computeIndicators } from '@/lib/indicators'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const step = req.nextUrl.searchParams.get('step') || '1'
  const t0 = Date.now()

  if (step === '1') {
    const live = await fetchUnifiedUniverseCached(new Date(), 'UPSTOX', '1y')
    const timeMs = Date.now() - t0
    return NextResponse.json({
      step: '1_fetchUnifiedUniverseCached',
      timeMs,
      timeSec: (timeMs / 1000).toFixed(2),
      stockCount: live.series.length,
      upstoxCount: live.upstoxCount,
      yahooCount: live.yahooCount,
    })
  }

  if (step === '2') {
    const nifty = await fetchNiftyIndex()
    const timeMs = Date.now() - t0
    return NextResponse.json({
      step: '2_fetchNiftyIndex',
      timeMs,
      timeSec: (timeMs / 1000).toFixed(2),
      hasNifty: !!nifty,
    })
  }

  if (step === '3') {
    const { generateUniverse } = await import('@/lib/stocks/engine')
    const synthSeries = generateUniverse(new Date())
    const result = evaluateUniverse(synthSeries, new Date(), true, {})
    const timeMs = Date.now() - t0
    return NextResponse.json({
      step: '3_evaluateUniverse',
      timeMs,
      timeSec: (timeMs / 1000).toFixed(2),
      btstCount: result.btst.length,
    })
  }

  return NextResponse.json({ error: 'Invalid step (use 1, 2, or 3)' })
}
