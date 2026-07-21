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
    const sym = symbol.toUpperCase()
    // Process in batches of up to 400 candles per single SQL query (SQLite max parameters limit safety)
    const chunkSize = 400
    let savedCount = 0

    for (let i = 0; i < candles.length; i += chunkSize) {
      const chunk = candles.slice(i, i + chunkSize)
      
      // Build raw SQL multi-row insert with ON CONFLICT DO UPDATE
      const valueRows = chunk.map(c => {
        const dateEsc = `'${c.date.replace(/'/g, "''")}'`
        const symEsc = `'${sym.replace(/'/g, "''")}'`
        const intEsc = `'${interval.replace(/'/g, "''")}'`
        const srcEsc = `'${source.replace(/'/g, "''")}'`
        const open = isNaN(c.open) ? 0 : c.open
        const high = isNaN(c.high) ? 0 : c.high
        const low = isNaN(c.low) ? 0 : c.low
        const close = isNaN(c.close) ? 0 : c.close
        const vol = isNaN(c.volume) ? 0 : c.volume
        return `(${symEsc}, ${dateEsc}, ${open}, ${high}, ${low}, ${close}, ${vol}, ${intEsc}, ${srcEsc})`
      }).join(',\n')

      const sql = `
        INSERT INTO "StockCandle" ("symbol", "date", "open", "high", "low", "close", "volume", "interval", "source")
        VALUES ${valueRows}
        ON CONFLICT("symbol", "date", "interval", "source") DO UPDATE SET
          "open"=excluded."open",
          "high"=excluded."high",
          "low"=excluded."low",
          "close"=excluded."close",
          "volume"=excluded."volume";
      `

      await db.$executeRawUnsafe(sql)
      savedCount += chunk.length
    }

    return savedCount
  } catch (err) {
    console.error(`[candle-cache] Bulk save error for ${symbol}:`, err)
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
