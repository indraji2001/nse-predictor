import { NextRequest, NextResponse } from 'next/server'
import { fetchStockWithFallback, fetchNiftyIndex } from '@/lib/stocks/data-source'
import { getStockSeries } from '@/lib/stocks/engine'
import { evaluateStock } from '@/lib/predictor/engine'
import { computeIndicators } from '@/lib/indicators'

export const dynamic = 'force-dynamic'
export const maxDuration = 60  // single stock Upstox fetch can be slow on cold start

// GET /api/stock/[symbol]
// Returns full detail for one symbol: candles + indicators + 4 timeframe signals.
// Priority: NSE archive → Yahoo → synthetic
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()
  const useLive = req.nextUrl.searchParams.get('live') !== 'false'
  const providerParam = req.nextUrl.searchParams.get('provider')
  const provider = (providerParam === 'UPSTOX' || providerParam === 'YAHOO' || providerParam === 'NSE') ? providerParam : null
  const range = req.nextUrl.searchParams.get('range') || '1y'
  const asOf = new Date()

  let series
  let source: 'NSE' | 'YAHOO' | 'DEMO' | 'UPSTOX' = 'DEMO'
  if (useLive) {
    try {
      const r = await fetchStockWithFallback(sym, asOf, provider || undefined, range)
      if (r) {
        series = r.series
        source = r.source
      }
    } catch {
      // fall through to synthetic
    }
  }
  if (!series) {
    series = getStockSeries(sym, asOf)
  }
  if (!series) {
    return NextResponse.json({ error: `Symbol ${sym} not found` }, { status: 404 })
  }

  let isNiftyBullish = true
  try {
    const nifty = await fetchNiftyIndex()
    if (nifty && nifty.candles && nifty.candles.length >= 30) {
      const niftyInd = computeIndicators(nifty.candles)
      const lastNiftyClose = nifty.candles[nifty.candles.length - 1].close
      const benchmarkEma = niftyInd.ema200 || niftyInd.ema50 || lastNiftyClose
      isNiftyBullish = lastNiftyClose >= benchmarkEma
    }
  } catch (err) {
    console.error('Error checking Nifty regime in stock details:', err)
  }

  const indicators = computeIndicators(series.candles)
  const signals = evaluateStock(series, isNiftyBullish)
  // Trim candles based on requested historical range
  let sliceSize = 260
  switch (range) {
    case '1mo': sliceSize = 22; break
    case '3mo': sliceSize = 66; break
    case '6mo': sliceSize = 132; break
    case '1y': sliceSize = 260; break
    case '2y': sliceSize = 520; break
    case '3y': sliceSize = 780; break
    case '4y': sliceSize = 1040; break
    case '5y': sliceSize = 1300; break
    case '10y':
    case 'MAX': sliceSize = 2600; break
    default: sliceSize = 260; break
  }
  const candles = series.candles.slice(-sliceSize)

  // Fetch live news from Yahoo and Google News
  const news = await fetchNews(series.symbol, series.name)

  // Fetch TradingView technical consensus ratings
  const tradingViewConsensus = await fetchTradingViewConsensus(series.symbol)

  return NextResponse.json({
    symbol: series.symbol,
    name: series.name,
    sector: series.sector,
    candles,
    indicators,
    signals,
    dataSource: source,
    news,
    tradingViewConsensus,
  })
}

// --- Live Google & Yahoo News Fetcher with Sentiment Scoring ---
async function fetchNews(symbol: string, stockName: string) {
  const newsItems: Array<{ title: string; link: string; source: string; pubDate: string }> = []
  
  // 1. Yahoo Finance RSS Feed (Highly specific ticker news)
  try {
    const yahooUrl = `https://feeds.finance.yahoo.com/rss.2.0/headline?s=${symbol}.NS`
    const res = await fetch(yahooUrl, { next: { revalidate: 3600 } })
    if (res.ok) {
      const xml = await res.text()
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let match
      while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1]
        const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/)
        const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/)
        const dateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
        if (titleMatch && linkMatch) {
          newsItems.push({
            title: cleanXml(titleMatch[1]),
            link: cleanXml(linkMatch[1]),
            source: 'Yahoo Finance',
            pubDate: dateMatch ? dateMatch[1] : '',
          })
        }
      }
    }
  } catch (e) {
    console.error('Yahoo news fetch error:', e)
  }

  // 2. Google News RSS Search Feed (General stock market updates)
  try {
    const cleanName = stockName.replace(/Limited|Ltd|Platforms|Holdings|Industries|Enterprises/gi, '').trim()
    const query = encodeURIComponent(`${cleanName} stock`)
    const googleUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`
    const res = await fetch(googleUrl, { 
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 3600 } 
    })
    if (res.ok) {
      const xml = await res.text()
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let match
      let count = 0
      while ((match = itemRegex.exec(xml)) !== null && count < 8) {
        const content = match[1]
        const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/)
        const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/)
        const dateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
        if (titleMatch && linkMatch) {
          newsItems.push({
            title: cleanXml(titleMatch[1]),
            link: cleanXml(linkMatch[1]),
            source: 'Google News',
            pubDate: dateMatch ? dateMatch[1] : '',
          })
          count++
        }
      }
    }
  } catch (e) {
    console.error('Google news fetch error:', e)
  }

  // Deduplicate news by comparing normalized headlines
  const uniqueNews: typeof newsItems = []
  const seenTitles = new Set<string>()
  for (const item of newsItems) {
    const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
    if (!seenTitles.has(norm)) {
      seenTitles.add(norm)
      uniqueNews.push(item)
    }
  }

  // Run sentiment analyzer on news titles
  return uniqueNews.map(item => {
    const { score, sentiment } = analyzeSentiment(item.title)
    return { ...item, sentiment, score }
  })
}

function cleanXml(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

function analyzeSentiment(title: string): { score: number; sentiment: 'positive' | 'negative' | 'neutral' } {
  const text = title.toLowerCase()
  const bullishWords = [
    'buy', 'bullish', 'upgrade', 'outperform', 'gain', 'rise', 'jump', 'rally', 'surge', 
    'profit', 'growth', 'strong', 'positive', 'higher', 'beat', 'leads', 'high', 'up', 
    'highest', 'bonus', 'dividend', 'deal', 'win', 'acquire', 'acquisition', 'partner', 
    'expand', 'launch', 'record', 'orders', 'order', 'success', 'accelerate'
  ]
  const bearishWords = [
    'sell', 'bearish', 'downgrade', 'underperform', 'fall', 'drop', 'slump', 'plunge', 
    'loss', 'negative', 'decline', 'lower', 'miss', 'loses', 'down', 'lowest', 'crash', 
    'cut', 'debt', 'risk', 'warning', 'concern', 'reduce', 'shrink', 'deficit', 'penalty', 
    'fraud', 'investigation', 'probe', 'lawsuit', 'disappointment', 'weak'
  ]

  let score = 0
  bullishWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g')
    const count = (text.match(regex) || []).length
    score += count
  })
  bearishWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g')
    const count = (text.match(regex) || []).length
    score -= count
  })

  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
  if (score > 0) sentiment = 'positive'
  else if (score < 0) sentiment = 'negative'

  return { score, sentiment }
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

function scoreToRating(score: number): string {
  if (score >= 0.5) return 'Strong Buy'
  if (score >= 0.1) return 'Buy'
  if (score <= -0.5) return 'Strong Sell'
  if (score <= -0.1) return 'Sell'
  return 'Neutral'
}

async function fetchTradingViewConsensus(symbol: string) {
  const baseSymbol = symbol.toUpperCase().replace('.NS', '').trim()
  const mapped = TV_MAPPINGS[baseSymbol] || baseSymbol.replace(/[&\-]/g, '_')
  const ticker = `NSE:${mapped}`

  try {
    const url = "https://scanner.tradingview.com/india/scan"
    const payload = {
      symbols: {
        tickers: [ticker],
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

    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data?.[0]?.d
    if (!data || data.length < 3) return null

    const summaryScore = data[0] ?? 0
    const maScore = data[1] ?? 0
    const oscScore = data[2] ?? 0

    return {
      summary: scoreToRating(summaryScore),
      summaryScore,
      maRating: scoreToRating(maScore),
      maScore,
      oscRating: scoreToRating(oscScore),
      oscScore
    }
  } catch (e) {
    console.error('TradingView scanner fetch error:', e)
    return null
  }
}
