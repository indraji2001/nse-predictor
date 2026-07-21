import { NextRequest, NextResponse } from 'next/server'
import { fetchUnifiedUniverseCached, fetchNiftyIndex } from '@/lib/stocks/data-source'
import { evaluateUniverse, tagSignalSources } from '@/lib/predictor/engine'
import { computeIndicators } from '@/lib/indicators'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const timings: Record<string, number> = {}

  let t0 = Date.now()
  const live = await fetchUnifiedUniverseCached(new Date(), 'UPSTOX', '1y')
  timings['1_fetchUnifiedUniverse'] = Date.now() - t0

  t0 = Date.now()
  let isNiftyBullish = true
  try {
    const nifty = await fetchNiftyIndex()
    if (nifty && nifty.candles && nifty.candles.length >= 30) {
      const niftyInd = computeIndicators(nifty.candles)
      const lastNiftyClose = nifty.candles[nifty.candles.length - 1].close
      const benchmarkEma = niftyInd.ema200 || niftyInd.ema50 || lastNiftyClose
      isNiftyBullish = lastNiftyClose >= benchmarkEma
    }
  } catch (e) {}
  timings['2_fetchNiftyIndex'] = Date.now() - t0

  t0 = Date.now()
  const result = evaluateUniverse(live.series, new Date(), isNiftyBullish, {})
  timings['3_evaluateUniverse'] = Date.now() - t0

  return NextResponse.json({
    timings,
    totalTimeSec: ((Object.values(timings).reduce((a, b) => a + b, 0)) / 1000).toFixed(2),
    stockCount: live.series.length,
    upstoxCount: live.upstoxCount,
  })
}
