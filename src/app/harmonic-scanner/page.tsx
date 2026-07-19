'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, Target, ShoppingCart, Filter, Radar, Zap,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft,
  BarChart2, Calendar, Clock, Info, TrendingUp, TrendingDown,
  Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { HarmonicPattern } from '@/lib/indicators/harmonics'

// ── Types ──────────────────────────────────────────────────────────────────

interface HarmonicScanEntry {
  symbol: string
  name: string
  sector: string
  currentPrice: number
  chartPeriod: string
  patterns: HarmonicPattern[]
  bestPattern: HarmonicPattern | null
  inPRZ: boolean
  nearPRZ: boolean
  suggestedEntry: number
  stopLoss: number
  target1: number
  target2: number
  riskReward: number
}

interface ScanResult {
  total: number
  scannedCount: number
  liveCount: number
  demoCount: number
  inPRZ: number
  nearPRZ: number
  yahooAvailable: boolean
  chartPeriod: string
  suitableFor: string
  sectors: string[]
  results: HarmonicScanEntry[]
  scannedAt: string
}

// ── Chart Period Config ────────────────────────────────────────────────────

const CHART_PERIODS = [
  {
    id: 'DAILY',
    label: 'Daily Chart (1D)',
    icon: <Calendar size={14} />,
    suitableFor: 'Short Term (5–15 days)',
    tradeTypes: ['SHORT_TERM', 'BTST'],
    description: '~252 daily candles · 2.5% ZigZag pivot · 1 year history',
    color: '#6366f1',
    bg: '#1e1b4b',
    candles: '~252 daily',
    deviation: '2.5%',
  },
  {
    id: 'WEEKLY',
    label: 'Weekly Chart (1W)',
    icon: <BarChart2 size={14} />,
    suitableFor: 'Mid Term (15–60D) & Long Term (60D+)',
    tradeTypes: ['MIDTERM', 'LONG_TERM'],
    description: '~104 weekly candles · 3.5% ZigZag pivot · 2 year history',
    color: '#0ea5e9',
    bg: '#082f49',
    candles: '~104 weekly',
    deviation: '3.5%',
  },
]

const TIMEFRAME_TABLE = [
  { chart: '5M / 15M Chart', style: 'Scalping / Intraday', holding: 'Minutes–Hours', available: false },
  { chart: '30M / 1H Chart', style: 'BTST', holding: '1–2 Days', available: false },
  { chart: '4H Chart', style: 'BTST / Short Term', holding: '2–5 Days', available: false },
  { chart: 'Daily (1D)', style: 'Short Term', holding: '5–15 Days', available: true, id: 'DAILY' },
  { chart: 'Weekly (1W)', style: 'Mid / Long Term', holding: '15–90+ Days', available: true, id: 'WEEKLY' },
  { chart: 'Monthly (1M)', style: 'Long Term / Investment', holding: '3–12 Months', available: false },
]

// ── Pattern Colors ─────────────────────────────────────────────────────────

const PATTERN_COLORS: Record<string, string> = {
  'Gartley': '#6366f1', 'Perfect Gartley': '#818cf8',
  'Bat': '#f59e0b', 'Perfect Bat': '#fbbf24', 'Alt Bat': '#d97706',
  'Butterfly': '#ec4899', 'Perfect Butterfly': '#f472b6',
  'Crab': '#ef4444', 'Deep Crab': '#dc2626', 'Perfect Crab': '#b91c1c',
  'AB=CD': '#10b981', 'Cypher': '#8b5cf6', 'Shark': '#06b6d4',
}

// ── Paper Trade Dialog ─────────────────────────────────────────────────────

function PaperTradeDialog({
  entry, onClose, onSuccess,
}: { entry: HarmonicScanEntry; onClose: () => void; onSuccess: () => void }) {
  const [timeframe, setTimeframe] = useState('SHORT_TERM')
  const [entryPrice, setEntryPrice] = useState(entry.suggestedEntry.toFixed(2))
  const [loading, setLoading] = useState(false)
  const p = entry.bestPattern!
  const isLong = p.direction === 'Bullish'

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/papertrade/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: entry.symbol,
          name: entry.name,
          sector: entry.sector,
          timeframe,
          entryPrice: parseFloat(entryPrice),
          stopLoss: entry.stopLoss,
          target1: entry.target1,
          target2: entry.target2,
          target3: entry.target2,
          riskReward: entry.riskReward,
          holdingPeriod: timeframe === 'BTST' ? '1–2D' : timeframe === 'SHORT_TERM' ? '5–15D' : timeframe === 'MIDTERM' ? '15–60D' : '60D+',
          confidence: Math.round(Math.max(30, 100 - Math.abs(p.distFromD) * 8)),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to track')
      toast.success(`📈 Paper trade added: ${entry.symbol} (${p.direction} ${p.name})`)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: '#0f172a', borderColor: '#1e293b' }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">📊 Add Paper Trade</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="mb-4 rounded-xl p-3" style={{ background: '#1e293b' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white text-lg">{entry.symbol}</span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ background: isLong ? '#064e3b' : '#450a0a', color: isLong ? '#34d399' : '#f87171' }}>
              {p.direction} {p.name}
            </span>
          </div>
          <div className="text-sm text-slate-400">{entry.name} · {entry.sector} · {entry.chartPeriod}</div>
        </div>
        <div className="mb-4 rounded-xl p-3 border"
          style={{ background: '#0f1729', borderColor: isLong ? '#065f46' : '#7f1d1d' }}>
          <div className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">PRZ Zone</div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Low: <span className="font-mono text-white">₹{p.przLow.toFixed(2)}</span></span>
            <span className="text-slate-300">Mid: <span className="font-mono font-bold" style={{ color: isLong ? '#34d399' : '#f87171' }}>₹{p.przMid.toFixed(2)}</span></span>
            <span className="text-slate-300">High: <span className="font-mono text-white">₹{p.przHigh.toFixed(2)}</span></span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Timeframe</label>
            <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white border"
              style={{ background: '#1e293b', borderColor: '#334155' }}>
              <option value="BTST">BTST (Next Day)</option>
              <option value="SHORT_TERM">Short Term (5–15 Days)</option>
              <option value="MIDTERM">Mid Term (15–60 Days)</option>
              <option value="LONG_TERM">Long Term (60+ Days)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Entry Price (₹)</label>
            <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white border font-mono"
              style={{ background: '#1e293b', borderColor: '#334155' }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg p-2 text-center" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d' }}>
              <div className="text-xs text-red-400">Stop Loss</div>
              <div className="font-mono text-sm text-red-300">₹{entry.stopLoss.toFixed(2)}</div>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#06652222', border: '1px solid #065f46' }}>
              <div className="text-xs text-emerald-400">Target 1</div>
              <div className="font-mono text-sm text-emerald-300">₹{entry.target1.toFixed(2)}</div>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#06652233', border: '1px solid #065f46' }}>
              <div className="text-xs text-emerald-400">Target 2</div>
              <div className="font-mono text-sm text-emerald-300">₹{entry.target2.toFixed(2)}</div>
            </div>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: '#1e293b' }}>
            <span className="text-xs text-slate-400">Risk : Reward = </span>
            <span className="font-bold text-lg"
              style={{ color: entry.riskReward >= 2 ? '#34d399' : entry.riskReward >= 1.5 ? '#fbbf24' : '#f87171' }}>
              1 : {entry.riskReward}
            </span>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
            style={{ background: '#1e293b' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: isLong ? 'linear-gradient(135deg,#059669,#065f46)' : 'linear-gradient(135deg,#dc2626,#7f1d1d)' }}>
            {loading ? 'Adding…' : `Track ${isLong ? 'Long' : 'Short'} Trade`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pattern Badge ──────────────────────────────────────────────────────────

function PatternBadge({ pattern }: { pattern: HarmonicPattern }) {
  const color = PATTERN_COLORS[pattern.name] || '#6366f1'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}>
      {pattern.direction === 'Bullish' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pattern.name}
    </span>
  )
}

// ── PRZ Proximity Bar ──────────────────────────────────────────────────────

function PRZBar({ entry }: { entry: HarmonicScanEntry }) {
  const p = entry.bestPattern!
  const absDist = Math.abs(p.distFromD)
  let color = '#6366f1'
  let label = `${absDist.toFixed(1)}% away`
  if (absDist <= 3) { color = '#10b981'; label = '🎯 IN PRZ' }
  else if (absDist <= 5) { color = '#f59e0b'; label = `${absDist.toFixed(1)}% away` }
  else if (absDist <= 8) { color = '#f97316'; label = `${absDist.toFixed(1)}% away` }
  const barPct = Math.min(100, Math.max(5, 100 - absDist * 7))
  return (
    <div className="w-full min-w-28">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: '#1e293b' }}>
        <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: `linear-gradient(90deg,${color}44,${color})` }} />
      </div>
    </div>
  )
}

// ── Stock Row ──────────────────────────────────────────────────────────────

function StockRow({ entry, onPaperTrade }: { entry: HarmonicScanEntry; onPaperTrade: (e: HarmonicScanEntry) => void }) {
  const [expanded, setExpanded] = useState(false)
  const p = entry.bestPattern!
  const isLong = p.direction === 'Bullish'

  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-slate-800/30 transition-colors"
        style={{ borderColor: '#1e293b' }} onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {entry.inPRZ
              ? <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" /></span>
              : entry.nearPRZ
              ? <span className="h-2.5 w-2.5 rounded-full bg-amber-400 flex-shrink-0" />
              : <span className="h-2.5 w-2.5 rounded-full bg-slate-600 flex-shrink-0" />}
            <div>
              <div className="font-bold text-white text-sm">{entry.symbol}</div>
              <div className="text-xs text-slate-400 max-w-[120px] truncate">{entry.name}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <span className="text-xs px-2 py-0.5 rounded text-slate-300" style={{ background: '#1e293b' }}>{entry.sector}</span>
        </td>
        <td className="px-4 py-3">
          <PatternBadge pattern={p} />
          <div className="text-xs text-slate-500 mt-0.5">{p.status}</div>
        </td>
        <td className="px-4 py-3">
          <div className="font-mono font-bold text-white">₹{entry.currentPrice.toFixed(2)}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-xs font-mono" style={{ color: isLong ? '#34d399' : '#f87171' }}>
            ₹{p.przLow.toFixed(1)} – ₹{p.przHigh.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500 font-mono">mid ₹{p.przMid.toFixed(1)}</div>
        </td>
        <td className="px-4 py-3">
          <div className="font-mono text-sm font-bold" style={{ color: isLong ? '#34d399' : '#f87171' }}>
            ₹{entry.suggestedEntry.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500">Limit order</div>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell"><PRZBar entry={entry} /></td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); onPaperTrade(entry) }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold hover:scale-105 transition-transform"
              style={{ background: isLong ? 'linear-gradient(135deg,#059669,#065f46)' : 'linear-gradient(135deg,#dc2626,#7f1d1d)', color: '#fff' }}>
              <ShoppingCart size={11} /> Track
            </button>
            {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ borderColor: '#1e293b' }}>
          <td colSpan={8} className="px-4 pb-4">
            <div className="rounded-xl p-4 mt-1" style={{ background: '#0f1729', border: '1px solid #1e293b' }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Trade Levels</div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Entry (PRZ mid)', val: `₹${entry.suggestedEntry.toFixed(2)}`, color: '#fff' },
                      { label: 'Stop Loss', val: `₹${entry.stopLoss.toFixed(2)}`, color: '#f87171' },
                      { label: 'Target 1 (38.2%)', val: `₹${entry.target1.toFixed(2)}`, color: '#34d399' },
                      { label: 'Target 2 (61.8%)', val: `₹${entry.target2.toFixed(2)}`, color: '#6ee7b7' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-slate-400">{row.label}</span>
                        <span className="font-mono" style={{ color: row.color }}>{row.val}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-1 border-t" style={{ borderColor: '#1e293b' }}>
                      <span className="text-slate-400">Risk : Reward</span>
                      <span className="font-bold" style={{ color: entry.riskReward >= 2 ? '#34d399' : entry.riskReward >= 1.5 ? '#fbbf24' : '#f87171' }}>
                        1 : {entry.riskReward}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pattern Ratios</div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'AB/XA', val: `${(p.ratioAB * 100).toFixed(1)}%` },
                      { label: 'BC/AB', val: `${(p.ratioBC * 100).toFixed(1)}%` },
                      { label: 'CD/BC', val: `${(p.ratioCD * 100).toFixed(1)}%` },
                      { label: 'D retrace', val: `${(p.ratioXAD * 100).toFixed(1)}%` },
                      { label: 'Status', val: p.status, special: p.status === 'FORMING' ? '#f59e0b' : '#6366f1' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-slate-400">{row.label}</span>
                        <span className="font-mono font-semibold" style={{ color: row.special || '#fff' }}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    All Patterns ({entry.patterns.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.patterns.map((pat, i) => (
                      <div key={i} className="flex flex-col items-start gap-0.5">
                        <PatternBadge pattern={pat} />
                        <span className="text-xs text-slate-500 pl-1">{pat.distFromD > 0 ? '+' : ''}{pat.distFromD.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t text-xs text-slate-500" style={{ borderColor: '#1e293b' }}>
                {p.description}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Timeframe Guide Panel ──────────────────────────────────────────────────

function TimeframeGuide({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border overflow-hidden mb-6" style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30 transition-colors">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-sky-400" />
          <span className="text-sm font-semibold text-white">Chart Timeframe Guide — Which Chart for Which Trading Style?</span>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: '#1e293b' }}>
          <p className="text-xs text-slate-400 mt-3 mb-3 leading-relaxed">
            Harmonic patterns must be read on the <strong className="text-slate-200">correct chart timeframe</strong> matching your
            intended holding period. A Butterfly on a Daily chart signals a reversal over <em>days</em>,
            while the same pattern on a Weekly chart signals a reversal over <em>weeks to months</em>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th className="px-3 py-2 text-left text-slate-400 font-semibold">Chart</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-semibold">Trading Style</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-semibold">Holding Period</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-semibold">Available</th>
                </tr>
              </thead>
              <tbody>
                {TIMEFRAME_TABLE.map((row, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: '#1e293b', background: row.available && row.id === selectedId ? '#1e1b4b33' : 'transparent' }}>
                    <td className="px-3 py-2">
                      <span className="font-mono font-semibold" style={{ color: row.available ? '#c7d2fe' : '#4b5563' }}>
                        {row.chart}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{row.style}</td>
                    <td className="px-3 py-2 text-slate-400">{row.holding}</td>
                    <td className="px-3 py-2">
                      {row.available
                        ? <button onClick={() => onSelect(row.id!)}
                            className="px-2 py-0.5 rounded text-xs font-bold"
                            style={{ background: row.id === selectedId ? '#4f46e5' : '#1e293b', color: row.id === selectedId ? '#fff' : '#818cf8' }}>
                            {row.id === selectedId ? '✓ Selected' : 'Select'}
                          </button>
                        : <span className="text-slate-600 text-xs">Coming soon*</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            * Intraday charts (5M, 15M, 30M, 1H, 4H) require a live intraday data feed (e.g., Upstox WebSocket).
            Currently we only have EOD (end-of-day) data from Yahoo Finance / NSE Bhavcopy, which supports Daily and Weekly charts.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function HarmonicScannerPage() {
  const [data, setData] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [paperTradeEntry, setPaperTradeEntry] = useState<HarmonicScanEntry | null>(null)
  const [chartPeriod, setChartPeriod] = useState('DAILY')
  const [sectorFilter, setSectorFilter] = useState('ALL')
  const [dirFilter, setDirFilter] = useState('ALL')
  const [przOnly, setPrzOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [patternFilter, setPatternFilter] = useState('ALL')

  const scan = useCallback(async (period = chartPeriod) => {
    setLoading(true)
    setData(null)
    try {
      const params = new URLSearchParams({
        chartPeriod: period,
        sector: sectorFilter,
        direction: dirFilter,
        przOnly: String(przOnly),
      })
      const res = await fetch(`/api/harmonic-scan?${params}`)
      if (!res.ok) throw new Error('Scan failed')
      const json: ScanResult = await res.json()
      setData(json)
      if (json.total > 0) {
        toast.success(`Found ${json.total} stocks with harmonic patterns (${json.inPRZ} in PRZ)`, {
          description: `Chart: ${json.chartPeriod} · ${json.liveCount} live · ${json.demoCount} demo skipped`,
        })
      } else {
        toast.info(`Scan complete — 0 patterns found on ${json.chartPeriod}`, {
          description: `Scanned ${json.scannedCount} stocks · Yahoo available: ${json.yahooAvailable}. Try different chart period or sector.`,
          duration: 8000,
        })
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }, [chartPeriod, sectorFilter, dirFilter, przOnly])

  useEffect(() => { scan() }, []) // eslint-disable-line

  const handlePeriodSelect = (id: string) => {
    setChartPeriod(id)
    scan(id)
  }

  const visibleResults = data?.results.filter(r => {
    if (search) {
      const q = search.toLowerCase()
      if (!r.symbol.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false
    }
    if (patternFilter !== 'ALL') {
      if (!r.patterns.some(p => p.name === patternFilter)) return false
    }
    return true
  }) ?? []

  const allPatternNames = data
    ? [...new Set(data.results.flatMap(r => r.patterns.map(p => p.name)))].sort()
    : []

  const selectedPeriodCfg = CHART_PERIODS.find(p => p.id === chartPeriod) ?? CHART_PERIODS[0]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#020617 0%,#0a0f1e 50%,#020617 100%)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(2,6,23,0.95)', backdropFilter: 'blur(12px)', borderColor: '#1e293b' }}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
                <ArrowLeft size={14} /> Back
              </Link>
              <div className="h-4 w-px bg-slate-700" />
              <Radar size={20} className="text-violet-400" />
              <div>
                <h1 className="text-lg font-bold text-white leading-none">Harmonic Pattern Scanner</h1>
                <p className="text-xs text-slate-400 mt-0.5">PRZ-based reversal zone detection · {selectedPeriodCfg.label} · Suitable for: {selectedPeriodCfg.suitableFor}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {data && !loading && (
                <div className="text-xs text-slate-500">
                  {new Date(data.scannedAt).toLocaleTimeString('en-IN')} · {data.liveCount} live stocks
                </div>
              )}
              <button onClick={() => scan()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:scale-105 transition-all"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Scanning…' : 'Scan Now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6">

        {/* Chart Period Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {CHART_PERIODS.map(cp => (
            <button key={cp.id} onClick={() => handlePeriodSelect(cp.id)}
              className="rounded-2xl border p-4 text-left transition-all hover:scale-[1.01]"
              style={{
                background: chartPeriod === cp.id ? cp.bg : 'rgba(15,23,42,0.8)',
                borderColor: chartPeriod === cp.id ? cp.color : '#1e293b',
                boxShadow: chartPeriod === cp.id ? `0 0 20px ${cp.color}33` : 'none',
              }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg" style={{ background: `${cp.color}22`, color: cp.color }}>
                  {cp.icon}
                </div>
                <span className="font-bold text-sm" style={{ color: chartPeriod === cp.id ? cp.color : '#fff' }}>
                  {cp.label}
                </span>
                {chartPeriod === cp.id && (
                  <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: `${cp.color}33`, color: cp.color }}>SELECTED</span>
                )}
              </div>
              <div className="text-xs text-slate-400 mb-1">✅ Best for: <span className="text-slate-200">{cp.suitableFor}</span></div>
              <div className="text-xs text-slate-500">{cp.description}</div>
            </button>
          ))}
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: <Radar size={18} className="text-violet-400" />, label: 'Stocks with Patterns', value: data ? data.total : '—', color: '#818cf8' },
            { icon: <CheckCircle2 size={18} className="text-emerald-400" />, label: 'IN PRZ Now (≤3%)', value: data ? data.inPRZ : '—', color: '#34d399', pulse: true },
            { icon: <AlertCircle size={18} className="text-amber-400" />, label: 'Near PRZ (≤8%)', value: data ? data.nearPRZ : '—', color: '#fbbf24' },
            { icon: <Activity size={18} className="text-sky-400" />, label: 'Visible Results', value: visibleResults.length, color: '#38bdf8' },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border p-4 flex items-center gap-3"
              style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
              <div className="p-2 rounded-xl" style={{ background: `${stat.color}15` }}>{stat.icon}</div>
              <div>
                <div className="text-xs text-slate-400">{stat.label}</div>
                <div className="text-2xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                  {stat.pulse && data && data.inPRZ > 0 && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Timeframe Guide */}
        <TimeframeGuide selectedId={chartPeriod} onSelect={handlePeriodSelect} />

        {/* Filters */}
        <div className="rounded-2xl border p-4 mb-6"
          style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">Filters</span>
            {data && (
              <span className="ml-auto text-xs text-slate-500">
                {data.scannedCount} stocks scanned · {data.liveCount} live · Yahoo: {data.yahooAvailable ? '✅' : '❌'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <input type="text" placeholder="Search symbol or name…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 rounded-xl text-sm text-white border placeholder-slate-500"
              style={{ background: '#0f1729', borderColor: '#334155' }} />
            <select value={patternFilter} onChange={e => setPatternFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white border"
              style={{ background: '#0f1729', borderColor: '#334155' }}>
              <option value="ALL">All Patterns</option>
              {allPatternNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={dirFilter} onChange={e => setDirFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white border"
              style={{ background: '#0f1729', borderColor: '#334155' }}>
              <option value="ALL">Both Directions</option>
              <option value="Bullish">Bullish Only</option>
              <option value="Bearish">Bearish Only</option>
            </select>
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white border"
              style={{ background: '#0f1729', borderColor: '#334155' }}>
              <option value="ALL">All Sectors</option>
              {(data?.sectors ?? []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border"
              style={{ background: przOnly ? '#1e1b4b' : '#0f1729', borderColor: przOnly ? '#6366f1' : '#334155' }}>
              <input type="checkbox" checked={przOnly} onChange={e => setPrzOnly(e.target.checked)} className="hidden" />
              <Zap size={14} style={{ color: przOnly ? '#818cf8' : '#6b7280' }} />
              <span className="text-sm font-medium" style={{ color: przOnly ? '#c7d2fe' : '#6b7280' }}>PRZ Only</span>
            </label>
            <button onClick={() => scan()} disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              Apply &amp; Rescan
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
            Price IN PRZ (≤3%)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Near PRZ (3–8%)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-600" /> Approaching PRZ
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock size={12} className="text-slate-500" />
            <span>Click any row to expand ratios</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="rounded-2xl border flex flex-col items-center justify-center py-28 gap-4"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
            <div className="relative">
              <Radar size={52} className="text-violet-400 animate-pulse" />
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#7c3aed' }} />
            </div>
            <div className="text-white font-bold text-lg">Scanning all NSE stocks…</div>
            <div className="text-slate-400 text-sm">
              {selectedPeriodCfg.label} · {selectedPeriodCfg.candles} · {selectedPeriodCfg.deviation} ZigZag
            </div>
            <div className="text-xs text-slate-500">Detecting Gartley, Bat, Butterfly, Crab, Cypher, Shark + Perfect variants</div>
          </div>
        ) : data && data.total === 0 ? (
          <div className="rounded-2xl border flex flex-col items-center justify-center py-24"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
            <Radar size={48} className="text-slate-600 mb-4" />
            <div className="text-slate-300 font-bold text-lg">No patterns found on {data.chartPeriod}</div>
            <div className="text-slate-500 text-sm mt-1 mb-4">
              Yahoo available: {data.yahooAvailable ? 'Yes' : 'No'} · Live stocks: {data.liveCount} / {data.scannedCount}
            </div>
            <div className="flex gap-2">
              {CHART_PERIODS.filter(p => p.id !== chartPeriod).map(p => (
                <button key={p.id} onClick={() => handlePeriodSelect(p.id)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-105 transition-all"
                  style={{ background: p.bg, border: `1px solid ${p.color}` }}>
                  Try {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-4 text-center max-w-md">
              Harmonic patterns are rare events. In low-volatility markets or when Yahoo Finance rate-limits our requests,
              the scanner may return 0 results. Try again later or switch chart periods.
            </p>
          </div>
        ) : visibleResults.length === 0 && data ? (
          <div className="rounded-2xl border flex flex-col items-center justify-center py-16"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
            <Filter size={36} className="text-slate-600 mb-3" />
            <div className="text-slate-300 font-semibold">No results match your filters</div>
            <div className="text-slate-500 text-sm mt-1">Clear filters to see all {data.total} detected patterns</div>
          </div>
        ) : visibleResults.length > 0 ? (
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ background: '#0f172a', borderColor: '#1e293b' }}>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Sector</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Pattern</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Current ₹</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">PRZ Zone</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1"><Target size={12} /> Entry</div>
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Proximity</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map(entry => (
                    <StockRow key={entry.symbol} entry={entry} onPaperTrade={setPaperTradeEntry} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t text-xs text-slate-500"
              style={{ borderColor: '#1e293b' }}>
              Showing {visibleResults.length} of {data?.total} stocks · {data?.chartPeriod} chart · Click row to expand · PRZ = Potential Reversal Zone
            </div>
          </div>
        ) : null}

        {/* Pattern Legend */}
        <div className="mt-6 rounded-2xl border p-4" style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pattern Color Guide</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PATTERN_COLORS).map(([name, color]) => (
              <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: `${color}20`, border: `1px solid ${color}50`, color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                {name}
              </span>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            <strong className="text-slate-400">Entry</strong> = PRZ Midpoint limit order ·
            <strong className="text-slate-400"> SL</strong>: Gartley/Bat=1×XA, Butterfly=1.41×XA, Crab=2×XA beyond PRZ ·
            <strong className="text-slate-400"> Targets</strong>: 38.2% and 61.8% retracement of CD leg
          </div>
        </div>
      </div>

      {paperTradeEntry && (
        <PaperTradeDialog entry={paperTradeEntry} onClose={() => setPaperTradeEntry(null)} onSuccess={() => {}} />
      )}
    </div>
  )
}
