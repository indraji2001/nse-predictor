import { NextRequest, NextResponse } from 'next/server'
import { fetchUnifiedUniverse, fetchNiftyIndex } from '@/lib/stocks/data-source'
import { evaluateUniverse, tagSignalSources } from '@/lib/predictor/engine'
import { generateUniverse } from '@/lib/stocks/engine'
import { computeIndicators } from '@/lib/indicators'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 300s = Vercel Pro max — needed for 512-stock Upstox batch

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
  const providerParam = req.nextUrl.searchParams.get('provider')
  const provider = (providerParam === 'UPSTOX' || providerParam === 'YAHOO' || providerParam === 'NSE') ? providerParam : undefined
  const range = req.nextUrl.searchParams.get('range') || '1y'
  const asOf = asOfParam ? new Date(asOfParam) : new Date()
  if (isNaN(asOf.getTime())) {
    return NextResponse.json({ error: 'Invalid asOf date' }, { status: 400 })
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
      const live = await fetchUnifiedUniverse(asOf, provider, range)
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

  // Fetch TradingView consensus ratings for all symbols in batch (only when using live data)
  const tvConsensusMap = useLive ? await fetchTradingViewConsensusBatch(series.map((s) => s.symbol)) : {}

  const result = evaluateUniverse(series, asOf, isNiftyBullish, tvConsensusMap)
  // Attach per-stock data source to every signal so the UI can badge each card.
  tagSignalSources(result, sources)
  return NextResponse.json({
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
  })
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
    
    for (let i = 0; i < tickers.length; i += chunkSize) {
      const chunk = tickers.slice(i, i + chunkSize)
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

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify(payload),
        next: { revalidate: 3600 }
      })

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
    }
  } catch (e) {
    console.error('TradingView batch scanner error:', e)
  }

  return map
}
