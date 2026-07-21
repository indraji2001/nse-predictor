import { NextRequest, NextResponse } from 'next/server'
import { fetchUnifiedUniverseCached, fetchNiftyIndex } from '@/lib/stocks/data-source'
import { evaluateUniverse, tagSignalSources } from '@/lib/predictor/engine'
import { generateUniverse } from '@/lib/stocks/engine'
import { computeIndicators } from '@/lib/indicators'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 300s = Vercel Pro max — needed for 512-stock Upstox batch

interface PredictionCache {
  data: any
  key: string
  cachedAt: number
}
let _predictionCache: PredictionCache | null = null
const PREDICT_CACHE_TTL = 30 * 60 * 1000 // 30 minutes in-memory cache

// GET /api/predict
// Returns the full prediction result for all four timeframes:
//   BTST · SHORT_TERM · MIDTERM · LONG_TERM
export async function GET(req: NextRequest) {
  const asOfParam = req.nextUrl.searchParams.get('asOf')
  const useLive = req.nextUrl.searchParams.get('live') !== 'false'
  const providerParam = req.nextUrl.searchParams.get('provider')
  const provider = (providerParam === 'UPSTOX' || providerParam === 'YAHOO' || providerParam === 'NSE') ? providerParam : undefined
  const range = req.nextUrl.searchParams.get('range') || '1y'
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true'
  const asOf = asOfParam ? new Date(asOfParam) : new Date()
  if (isNaN(asOf.getTime())) {
    return NextResponse.json({ error: 'Invalid asOf date' }, { status: 400 })
  }

  const cacheKey = `${provider || 'AUTO'}_${range}_${asOfParam || 'today'}`
  if (!forceRefresh && _predictionCache && _predictionCache.key === cacheKey && (Date.now() - _predictionCache.cachedAt < PREDICT_CACHE_TTL)) {
    console.log(`[predict] In-memory prediction cache HIT (${cacheKey}) — returning in 10ms`)
    return NextResponse.json(_predictionCache.data)
  }

  let series
  let sources: Record<string, 'NSE' | 'YAHOO' | 'DEMO' | 'UPSTOX'> = {}
  let nseCount = 0
  let yahooCount = 0
  let demoCount = 0
  let fetchedAt: string | null = null
  let nseActive = false

  if (useLive) {
    try {
      // Universe screener signals only require 1Y of EOD candles (252 bars for EMA200).
      // Single stock detail endpoints handle full 5Y/10Y historical charts independently.
      const universeRange = '1y'
      const live = await fetchUnifiedUniverseCached(asOf, provider, universeRange)
      series = live.series
      sources = live.sources as Record<string, 'NSE' | 'YAHOO' | 'DEMO' | 'UPSTOX'>
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

  // Determine Market Regime based on Nifty 50 Index EMA 200 trend
  let isNiftyBullish = true
  try {
    const nifty = await fetchNiftyIndex()
    if (nifty && nifty.candles && nifty.candles.length >= 30) {
      const niftyInd = computeIndicators(nifty.candles)
      const lastNiftyClose = nifty.candles[nifty.candles.length - 1].close
      const benchmarkEma = niftyInd.ema200 || niftyInd.ema50 || lastNiftyClose
      isNiftyBullish = lastNiftyClose >= benchmarkEma
      console.log(`Nifty 50 Regime Check: Last Close ₹${lastNiftyClose} vs Benchmark EMA ₹${benchmarkEma.toFixed(2)} -> Bullish: ${isNiftyBullish}`)
    }
  } catch (err) {
    console.error('Error fetching Nifty 50 index regime:', err)
  }

  // TradingView consensus ratings (bypassed external HTTP call for instant 1s response)
  const tvConsensusMap = {}

  const result = evaluateUniverse(series, asOf, isNiftyBullish, tvConsensusMap)
  // Attach per-stock data source to every signal so the UI can badge each card.
  tagSignalSources(result, sources)

  const payload = {
    ...result,
    dataSource: {
      nseActive,
      nseCount,
      yahooCount,
      upstoxCount: series.filter(s => sources[s.symbol] === 'UPSTOX').length,
      demoCount,
      liveCount: nseCount + yahooCount, // backward compat
      total: series.length,
      sources,
      fetchedAt,
    },
  }

  _predictionCache = { data: payload, key: cacheKey, cachedAt: Date.now() }
  return NextResponse.json(payload)
}

const TV_MAPPINGS: Record<string, string> = {
  'KOTAKNIFTY': 'NIFTY1',
  'WELSPUN-2': 'WELSPUNLIV',
  'BRITANNIA-2': 'BRITANNIA',
  'NESTLEIND-2': 'NESTLEIND',
  'MRSBECO': 'BECTORFOOD',
  'CHOLAFIN-HL': 'CHOLAFIN',
  'CITYUNION': 'CUB',
  'DATAPATT': 'DATAPATTNS',
  'AMARAJABAT': 'ARE_M',
  'CADILAHC': 'ZYDUSLIFE',
  'TATAGLOBAL': 'TATACONSUM',
  'ESSELPACK': 'EPL',
  'INOXLEISUR': 'PVRINOX',
  'PVR': 'PVRINOX',
  'PVR-2': 'PVRINOX',
  'ARVINDF-2': 'ARVINDFASN',
  'GOKALDAS-2': 'GOKEX',
  'GOKALDAS': 'GOKEX',
  'TATATELE': 'TTML',
  'VIJAYABANK': 'BANKBARODA',
  'DENA': 'BANKBARODA',
  'PATELINT': 'PATINTLOG'
}

async function fetchTradingViewConsensusBatch(symbols: string[]) {
  const map: Record<string, { summaryScore: number; maScore: number; oscScore: number }> = {}
  const chunkSize = 100
  const tickers: string[] = []
  const symbolToTickerMap: Record<string, string> = {}

  for (const sym of symbols) {
    const baseSymbol = sym.toUpperCase().replace('.NS', '').trim()
    const mapped = TV_MAPPINGS[baseSymbol] || baseSymbol.replace(/[&\-]/g, '_')
    const ticker = `NSE:${mapped}`
    tickers.push(ticker)
    symbolToTickerMap[ticker] = sym
  }

  try {
    const url = "https://scanner.tradingview.com/india/scan"
    const chunks: string[][] = []
    for (let i = 0; i < tickers.length; i += chunkSize) {
      chunks.push(tickers.slice(i, i + chunkSize))
    }

    // Run all chunks in parallel with a strict 1.5s timeout per request
    await Promise.all(chunks.map(async (chunk) => {
      try {
        const payload = {
          symbols: {
            tickers: chunk,
            query: { types: [] }
          },
          columns: [
            "Recommend.All",
            "Recommend.MA",
            "Recommend.Other"
          ]
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 1500) // 1.5s hard timeout

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          next: { revalidate: 3600 }
        })
        clearTimeout(timer)

        if (res.ok) {
          const json = await res.json()
          const rows = json?.data ?? []
          for (const row of rows) {
            const ticker = row.s
            const d = row.d
            const origSymbol = symbolToTickerMap[ticker]
            if (origSymbol && d && d.length >= 3) {
              map[origSymbol] = {
                summaryScore: d[0] ?? 0,
                maScore: d[1] ?? 0,
                oscScore: d[2] ?? 0
              }
            }
          }
        }
      } catch {
        // Suppress external TradingView timeouts — predictor works independently
      }
    }))
  } catch (e) {
    console.error('TradingView batch scanner error:', e)
  }

  return map
}
