import { NextRequest, NextResponse } from 'next/server'
import { NSE_UNIVERSE } from '@/lib/stocks/universe'
import {
  isReady as isUpstoxReady,
  fetchHistorical as fetchFromUpstox,
  bulkGetInstrumentKeys,
  getAccessToken as getUpstoxToken,
} from '@/lib/stocks/upstox'
import { bulkGetCachedCandles } from '@/lib/stocks/candle-cache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel max duration limit

// GET /api/admin/initialize-cache?provider=UPSTOX&batch=0&batchSize=100
// Batch 0: stocks 0-100 (~15 seconds)
// Batch 1: stocks 100-200 (~15 seconds)
// Batch 2: stocks 200-300 (~15 seconds)
// Batch 3: stocks 300-400 (~15 seconds)
// Batch 4: stocks 400-500 (~15 seconds)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider') || 'UPSTOX'
  const batchIdx = parseInt(searchParams.get('batch') || '0')
  const batchSize = parseInt(searchParams.get('batchSize') || '100')

  const startIdx = batchIdx * batchSize
  const endIdx = Math.min(NSE_UNIVERSE.length, startIdx + batchSize)

  if (startIdx >= NSE_UNIVERSE.length) {
    return NextResponse.json({
      done: true,
      message: 'All stocks already processed!',
      totalUniverse: NSE_UNIVERSE.length,
    })
  }

  const batchUniverse = NSE_UNIVERSE.slice(startIdx, endIdx)
  console.log(`[Initialize-Cache] Processing batch ${batchIdx} (stocks ${startIdx} to ${endIdx}) for ${provider}...`)

  if (provider === 'UPSTOX') {
    const ready = await isUpstoxReady()
    if (!ready) {
      return NextResponse.json({ error: 'Upstox is not connected or configured' }, { status: 400 })
    }

    const allSymbols = batchUniverse.map(m => m.symbol)
    const [upstoxToken, instrumentKeys, bulkCandlesMap] = await Promise.all([
      getUpstoxToken(),
      bulkGetInstrumentKeys(allSymbols),
      bulkGetCachedCandles(allSymbols, 'day', 'UPSTOX'),
    ])

    if (!upstoxToken) {
      return NextResponse.json({ error: 'No Upstox access token available' }, { status: 400 })
    }

    let successCount = 0
    let cachedCount = 0
    let fetchedCount = 0

    // Process batch with concurrency 8 (safe rate limit: ~5 req/sec)
    const chunkSize = 8
    for (let i = 0; i < batchUniverse.length; i += chunkSize) {
      const chunk = batchUniverse.slice(i, i + chunkSize)
      await Promise.all(chunk.map(async (meta) => {
        const key = instrumentKeys[meta.symbol]
        if (!key) return
        const cachedCandles = bulkCandlesMap.get(meta.symbol.toUpperCase())
        if (cachedCandles && cachedCandles.length >= 200) {
          cachedCount++
        } else {
          fetchedCount++
        }
        const s = await fetchFromUpstox(meta, '1y', upstoxToken, key, cachedCandles)
        if (s && s.candles.length >= 30) {
          successCount++
        }
      }))
    }

    return NextResponse.json({
      done: endIdx >= NSE_UNIVERSE.length,
      nextBatch: endIdx < NSE_UNIVERSE.length ? batchIdx + 1 : null,
      batchIdx,
      startIdx,
      endIdx,
      processed: batchUniverse.length,
      successCount,
      cachedCount,
      fetchedCount,
      totalUniverse: NSE_UNIVERSE.length,
      progressPercent: Math.round((endIdx / NSE_UNIVERSE.length) * 100),
    })
  }

  return NextResponse.json({ error: 'Unsupported provider for initialize-cache' }, { status: 400 })
}
