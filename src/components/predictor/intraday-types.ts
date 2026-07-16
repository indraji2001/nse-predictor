// Shared types for intraday analysis — mirrors src/lib/stocks/intraday.ts
// but lives in components/ for client-side use.

export interface IntradayCandle {
  timestamp: number
  date: string
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IntradayAnalysis {
  symbol: string
  name: string
  sector: string
  ltp: number
  prevClose: number
  changePct: number
  dayOpen: number
  dayHigh: number
  dayLow: number
  dayVolume: number
  vwap: number
  vwapPosition: 'above' | 'below' | 'at'
  orHigh: number
  orLow: number
  orbStatus: 'breakout_up' | 'breakout_down' | 'inside' | 'no_data'
  ema9: number
  ema21: number
  emaCross: 'bullish' | 'bearish' | 'none'
  momentumPct: number
  recentMomentum: number
  action: 'BUY_NOW' | 'WAIT_BREAKOUT' | 'AVOID' | 'SELL_WATCH'
  confidence: number
  reason: string
  // Intraday risk management levels (P1-4 fix)
  intradayStopLoss: number | null
  intradayTarget1: number | null
  intradayTarget2: number | null
  intradayTarget3: number | null
  atr5m: number
  candles: IntradayCandle[]
  todayCandles: IntradayCandle[]
  asOf: string
}

export interface IntradayScanResult {
  asOf: string
  totalScanned: number
  buyNowCount: number
  waitCount: number
  avoidCount: number
  sellWatchCount: number
  failedCount: number
  signals: IntradayAnalysis[]
}

// IST market hours: 9:15 AM - 3:30 PM
export function isMarketOpen(date = new Date()): boolean {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
  const day = ist.getUTCDay()
  if (day === 0 || day === 6) return false // Sun/Sat
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30
}

export function marketStatus(date = new Date()): { open: boolean; label: string; nextEvent: string } {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
  const day = ist.getUTCDay()
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  if (day === 0 || day === 6) {
    return { open: false, label: 'Weekend — market closed', nextEvent: 'Opens Monday 9:15 AM IST' }
  }
  if (minutes < 9 * 60 + 15) {
    return { open: false, label: 'Pre-market — market closed', nextEvent: 'Opens at 9:15 AM IST' }
  }
  if (minutes > 15 * 60 + 30) {
    return { open: false, label: 'Post-close — market closed', nextEvent: 'Opens tomorrow 9:15 AM IST' }
  }
  return { open: true, label: 'Market OPEN', nextEvent: 'Closes at 3:30 PM IST' }
}
