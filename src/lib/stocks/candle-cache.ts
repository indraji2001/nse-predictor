import { db } from '../db'
import { Candle, StockSeries } from './engine'
import { StockMeta } from './universe'

export interface CachedCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Reads cached EOD or Intraday candles from the database.
 * Returns sorted candles by date ascending.
 */
export async function getCachedCandles(
  symbol: string,
  interval: string,
  source: string,
  fromDate?: string,
  toDate?: string
): Promise<Candle[]> {
  try {
    const where: any = {
      symbol,
      interval,
      source,
    }

    if (fromDate || toDate) {
      where.date = {}
      if (fromDate) where.date.gte = fromDate
      if (toDate) where.date.lte = toDate
    }

    const rows = await db.stockCandle.findMany({
      where,
      orderBy: { date: 'asc' },
    })

    return rows.map(r => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }))
  } catch (err) {
    console.error(`[candle-cache] Error reading cache for ${symbol}:`, err)
    return []
  }
}

/**
 * Saves a batch of candles to the database.
 * Uses an upsert-equivalent or bulk insert ignoring duplicates.
 */
export async function saveCandlesToCache(
  symbol: string,
  interval: string,
  source: string,
  candles: Candle[]
): Promise<number> {
  if (!candles || candles.length === 0) return 0

  try {
    let savedCount = 0
    const chunkSize = 50 // smaller chunk size for transactional safety
    for (let i = 0; i < candles.length; i += chunkSize) {
      const chunk = candles.slice(i, i + chunkSize)
      
      // Perform database upsert in a single transaction
      const operations = chunk.map(c => {
        const uniqueKey = `${symbol}_${c.date}_${interval}_${source}`
        return db.stockCandle.upsert({
          where: {
            symbol_date_interval_source: {
              symbol,
              date: c.date,
              interval,
              source
            }
          },
          update: {
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume
          },
          create: {
            symbol,
            date: c.date,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            interval,
            source
          }
        })
      })

      await db.$transaction(operations)
      savedCount += chunk.length
    }
    
    if (savedCount > 0) {
      console.log(`[candle-cache] Cached ${savedCount} candles for ${symbol} (${interval}) via transaction`)
    }
    return savedCount
  } catch (err) {
    console.error(`[candle-cache] Error saving cache for ${symbol}:`, err)
    return 0
  }
}

/**
 * Deletes cached candles within a specific date range.
 */
export async function pruneCachedCandles(
  interval: string,
  beforeDate: string,
  symbol?: string
): Promise<number> {
  try {
    const where: any = {
      interval,
      date: { lt: beforeDate },
    }
    if (symbol) {
      where.symbol = symbol
    }

    const result = await db.stockCandle.deleteMany({ where })
    console.log(`[candle-cache] Pruned ${result.count} candles before ${beforeDate} (${interval})`)
    return result.count
  } catch (err) {
    console.error(`[candle-cache] Error pruning cache:`, err)
    return 0
  }
}

/**
 * Gets database cache storage stats (approximate sizes).
 */
export async function getCacheStats() {
  try {
    const totalCount = await db.stockCandle.count()
    const eodCount = await db.stockCandle.count({ where: { interval: 'day' } })
    const intradayCount = await db.stockCandle.count({ where: { interval: '5m' } })
    
    // Estimate size: SQLite rows are approx 80 bytes each
    const estimatedSizeMB = Number(((totalCount * 80) / (1024 * 1024)).toFixed(2))
    
    return {
      totalCount,
      eodCount,
      intradayCount,
      estimatedSizeMB,
      maxLimitMB: 5000, // Turso 5GB free tier
      percentUsed: Number(((estimatedSizeMB / 5000) * 100).toFixed(2)),
    }
  } catch (err) {
    console.error('[candle-cache] Error reading stats:', err)
    return {
      totalCount: 0,
      eodCount: 0,
      intradayCount: 0,
      estimatedSizeMB: 0,
      maxLimitMB: 5000,
      percentUsed: 0,
    }
  }
}
