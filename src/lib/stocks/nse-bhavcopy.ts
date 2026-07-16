// NSE bhavcopy integration — fetches daily EOD CSV from NSE, parses it into
// Candle objects, and stores locally for archive building.
//
// NSE publishes two daily files:
//   1. "Bhavcopy full" — https://archives.nseindia.com/products/content/sec_bhavdata_full_DDMMMYYYY.csv
//      (uppercase month, e.g. 14JUL2025). Columns include SYMBOL, SERIES, OPEN,
//      HIGH, LOW, CLOSE, LAST, PREVCLOSE, TOTTRDQTY, TOTTRDVAL, TIMESTAMP,
//      TOTALTRADES, ISIN. Includes EQ + BE + BZ series.
//
//   2. "Bhavcopy zip archive" — https://www1.nseindia.com/content/historical/EQUITIES/YYYY/MMM/cmDDMMMYYYYbhav.csv.zip
//      Older format, zipped, same content.
//
// Both URLs are bot-protected. We need:
//   - A real-browser User-Agent
//   - Visit https://www.nseindia.com first to grab session cookies
//   - Send Referer header on subsequent requests
//
// Even with all that, NSE blocks most cloud datacenter IPs. So this module is
// designed to fail gracefully — when NSE blocks us, we return null and the
// caller falls back to Yahoo. The user can also manually upload bhavcopy CSV
// files via the /api/bhavcopy/upload endpoint to build the local archive.

import { promises as fs } from 'fs'
import path from 'path'
import { Candle } from './engine'

const ARCHIVE_DIR = path.join(process.cwd(), 'data', 'bhavcopy')
const NSE_HOME = 'https://www.nseindia.com'
const NSE_BHAVCOPY_URL = 'https://archives.nseindia.com/products/content/sec_bhavdata_full_DDMMMYYYY.csv'

// In-memory cookie jar (session cookies from nseindia.com homepage).
let _nseCookies: string | null = null
let _nseCookiesTs = 0
const COOKIE_TTL_MS = 10 * 60 * 1000 // refresh every 10 min

// Standard browser headers — NSE blocks anything that looks like a bot.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
}

async function getNSESession(): Promise<string> {
  if (_nseCookies && Date.now() - _nseCookiesTs < COOKIE_TTL_MS) {
    return _nseCookies
  }
  try {
    const res = await fetch(NSE_HOME, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
    })
    // Headers.getSetCookie() is supported in modern runtimes and returns an array
    const setCookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
    if (setCookies.length > 0) {
      // Strip attributes (Path, Domain, Expires, etc.) — keep only name=value pairs
      const cookiePairs = setCookies.map((c) => c.split(';')[0]).filter(Boolean)
      _nseCookies = cookiePairs.join('; ')
      _nseCookiesTs = Date.now()
      return _nseCookies
    }
  } catch {
    // ignore — will fall through to no-cookie request
  }
  return ''
}

// Format a Date as DDMMMYYYY (e.g. 14JUL2025) — NSE's filename convention.
function formatNSEDate(d: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const dd = String(d.getDate()).padStart(2, '0')
  const mmm = months[d.getMonth()]
  const yyyy = d.getFullYear()
  return `${dd}${mmm}${yyyy}`
}

// Format a Date as YYYY-MM-DD (ISO) — used for our local archive filenames.
function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Skip weekends — NSE doesn't publish bhavcopy on Saturdays/Sundays.
function isTradingDay(d: Date): boolean {
  const day = d.getDay()
  return day !== 0 && day !== 6
}

// --- Archive helpers ------------------------------------------------------
async function ensureArchiveDir(): Promise<void> {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true })
}

export interface ArchivedFile {
  date: string // YYYY-MM-DD
  filename: string
  sizeBytes: number
  stockCount: number
  source: 'NSE' | 'UPLOAD' // fetched from NSE directly, or uploaded by user
}

export async function listArchive(): Promise<ArchivedFile[]> {
  await ensureArchiveDir()
  const files = await fs.readdir(ARCHIVE_DIR)
  const out: ArchivedFile[] = []
  // Track dates we've already seen so we don't double-count (uploads override NSE for same date)
  const seenDates = new Set<string>()
  for (const filename of files) {
    if (!filename.endsWith('.csv')) continue
    // Match YYYY-MM-DD.csv OR YYYY-MM-DD-upload.csv
    const m = filename.match(/^(\d{4}-\d{2}-\d{2})(?:-upload)?\.csv$/)
    if (!m) continue
    const date = m[1]
    const isUpload = filename.includes('-upload')
    // If we already have an NSE version of this date and this is also NSE, skip duplicates
    if (seenDates.has(date) && !isUpload) continue
    seenDates.add(date)
    const filePath = path.join(ARCHIVE_DIR, filename)
    const stat = await fs.stat(filePath)
    let stockCount = 0
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      stockCount = content.split('\n').filter((l) => l.trim().length > 0).length - 1
    } catch {}
    out.push({
      date,
      filename,
      sizeBytes: stat.size,
      stockCount: Math.max(0, stockCount),
      source: isUpload ? 'UPLOAD' : 'NSE',
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export async function deleteArchivedFile(date: string): Promise<void> {
  // Delete both the NSE-fetched and uploaded versions if they exist
  for (const name of [`${date}.csv`, `${date}-upload.csv`]) {
    const filePath = path.join(ARCHIVE_DIR, name)
    try {
      await fs.unlink(filePath)
    } catch {
      // ignore
    }
  }
}

export async function getArchivedFile(date: string): Promise<string | null> {
  // Prefer the NSE-fetched version; fall back to the uploaded version
  for (const name of [`${date}.csv`, `${date}-upload.csv`]) {
    const filePath = path.join(ARCHIVE_DIR, name)
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch {
      // continue to next
    }
  }
  return null
}

// Save raw CSV content to the archive with the given date.
export async function saveArchivedFile(date: string, csvContent: string, source: 'NSE' | 'UPLOAD' = 'NSE'): Promise<void> {
  await ensureArchiveDir()
  const suffix = source === 'UPLOAD' ? '-upload' : ''
  const filePath = path.join(ARCHIVE_DIR, `${date}${suffix}.csv`)
  await fs.writeFile(filePath, csvContent, 'utf-8')
}

// --- Fetch today's (or a specific date's) bhavcopy from NSE ---------------
export interface FetchResult {
  ok: boolean
  date: string
  stockCount?: number
  error?: string
  savedTo?: string
}

export async function fetchBhavcopyFromNSE(targetDate: Date): Promise<FetchResult> {
  if (!isTradingDay(targetDate)) {
    return { ok: false, date: formatISODate(targetDate), error: 'Not a trading day (weekend)' }
  }
  const isoDate = formatISODate(targetDate)
  const nseDate = formatNSEDate(targetDate)
  const url = NSE_BHAVCOPY_URL.replace('DDMMMYYYY', nseDate)

  // Get session cookies
  const cookies = await getNSESession()
  try {
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Referer: NSE_HOME,
        Cookie: cookies,
        Accept: 'text/csv,application/csv,text/plain,*/*',
      },
      cache: 'no-store',
    })
    if (res.status === 404) {
      return { ok: false, date: isoDate, error: `No bhavcopy published for ${isoDate} (might be a holiday)` }
    }
    if (res.status === 403 || res.status === 429) {
      return { ok: false, date: isoDate, error: `NSE blocked the request (HTTP ${res.status}). Try uploading the file manually.` }
    }
    if (!res.ok) {
      return { ok: false, date: isoDate, error: `HTTP ${res.status} from NSE` }
    }
    const csv = await res.text()
    if (!csv.startsWith('SYMBOL')) {
      return { ok: false, date: isoDate, error: 'Unexpected response (not a CSV). NSE may be redirecting to a captcha page.' }
    }
    await saveArchivedFile(isoDate, csv, 'NSE')
    const stockCount = csv.split('\n').filter((l) => l.trim().length > 0).length - 1
    return { ok: true, date: isoDate, stockCount, savedTo: `${ARCHIVE_DIR}/${isoDate}.csv` }
  } catch (e) {
    return { ok: false, date: isoDate, error: e instanceof Error ? e.message : 'Network error' }
  }
}

// Fetch the most recent N trading days' bhavcopies. Useful for backfilling.
// Skips weekends and holidays (404 = holiday, treated as skip).
export async function backfillBhavcopy(days: number): Promise<{ fetched: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  let fetched = 0
  let skipped = 0
  // Walk backwards from today
  const d = new Date()
  let attempts = 0
  while (fetched < days && attempts < days * 2) {
    if (isTradingDay(d)) {
      // Skip if already archived
      const existing = await getArchivedFile(formatISODate(d))
      if (existing) {
        skipped++
      } else {
        const r = await fetchBhavcopyFromNSE(new Date(d))
        if (r.ok) fetched++
        else if (r.error?.includes('404') || r.error?.includes('holiday')) skipped++
        else errors.push(`${r.date}: ${r.error}`)
        // Be polite — 1 req per 2 seconds
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
    d.setDate(d.getDate() - 1)
    attempts++
  }
  return { fetched, skipped, errors }
}

// --- Parse bhavcopy CSV into candles --------------------------------------
// CSV columns (sec_bhavdata_full format):
//   SYMBOL, SERIES, OPEN, HIGH, LOW, CLOSE, LAST, PREVCLOSE, TOTTRDQTY,
//   TOTTRDVAL, TIMESTAMP, TOTALTRADES, ISIN
//
// We only keep SERIES=EQ (and optionally BE, BZ for some illiquid stocks).
export interface ParsedBhavcopyRow {
  symbol: string
  series: string
  open: number
  high: number
  low: number
  close: number
  prevClose: number
  volume: number
  timestamp: string // DD-MMM-YYYY
  isin: string
}

export function parseBhavcopyCSV(csv: string): ParsedBhavcopyRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  // First line is the header
  const header = lines[0].split(',').map((s) => s.trim().toUpperCase())
  const idx = (name: string) => header.indexOf(name)
  const SYMBOL = idx('SYMBOL')
  const SERIES = idx('SERIES')
  const OPEN = idx('OPEN')
  const HIGH = idx('HIGH')
  const LOW = idx('LOW')
  const CLOSE = idx('CLOSE')
  const PREVCLOSE = idx('PREVCLOSE')
  const TOTTRDQTY = idx('TOTTRDQTY')
  const TIMESTAMP = idx('TIMESTAMP')
  const ISIN = idx('ISIN')
  if (SYMBOL < 0 || CLOSE < 0) return []

  const rows: ParsedBhavcopyRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 8) continue
    const series = (cols[SERIES] ?? '').trim().toUpperCase()
    // Only keep EQ series (regular equity). Skip BE/BZ/SM/ST to avoid duplicates.
    if (series !== 'EQ' && series !== 'BE' && series !== 'BZ') continue
    const symbol = (cols[SYMBOL] ?? '').trim().toUpperCase()
    if (!symbol) continue
    const num = (s: string) => {
      const v = parseFloat(s)
      return isNaN(v) ? 0 : v
    }
    rows.push({
      symbol,
      series,
      open: num(cols[OPEN] ?? '0'),
      high: num(cols[HIGH] ?? '0'),
      low: num(cols[LOW] ?? '0'),
      close: num(cols[CLOSE] ?? '0'),
      prevClose: num(cols[PREVCLOSE] ?? '0'),
      volume: num(cols[TOTTRDQTY] ?? '0'),
      timestamp: (cols[TIMESTAMP] ?? '').trim(),
      isin: (cols[ISIN] ?? '').trim(),
    })
  }
  return rows
}

// Find the most recent archived bhavcopy date for a given symbol.
// Walks backwards from `endDate` looking for an archived file that contains
// the symbol. Returns the parsed row or null.
export async function findLatestBhavcopyForSymbol(symbol: string, endDate: Date = new Date(), maxLookback = 10): Promise<{ date: string; row: ParsedBhavcopyRow } | null> {
  const d = new Date(endDate)
  for (let i = 0; i < maxLookback * 2; i++) {
    if (isTradingDay(d)) {
      const iso = formatISODate(d)
      const csv = await getArchivedFile(iso)
      if (csv) {
        const rows = parseBhavcopyCSV(csv)
        const row = rows.find((r) => r.symbol === symbol.toUpperCase())
        if (row) {
          // Normalize the timestamp: bhavcopy uses DD-MMM-YYYY (e.g. 14-JUL-2025)
          return { date: iso, row }
        }
      }
    }
    d.setDate(d.getDate() - 1)
    if (i >= maxLookback * 2) break
  }
  return null
}

// Build a list of all archived dates that contain data for a given symbol.
// Returns candles oldest-first.
export async function buildHistoryFromArchive(symbol: string, minCandles = 30): Promise<Candle[] | null> {
  const archive = await listArchive()
  if (archive.length === 0) return null
  // Sort oldest first
  const sorted = [...archive].sort((a, b) => a.date.localeCompare(b.date))
  const candles: Candle[] = []
  for (const f of sorted) {
    const csv = await getArchivedFile(f.date)
    if (!csv) continue
    const rows = parseBhavcopyCSV(csv)
    const row = rows.find((r) => r.symbol === symbol.toUpperCase())
    if (!row) continue
    candles.push({
      date: f.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      adjClose: row.close,
    })
  }
  return candles.length >= minCandles ? candles : null
}
