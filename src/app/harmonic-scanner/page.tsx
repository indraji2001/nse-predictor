'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, Target, Filter, Radar, Zap,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft,
  BarChart2, Calendar, Clock, Info, TrendingUp, TrendingDown,
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
  fibConfluence: string | null  // Fibonacci level overlapping PRZ midpoint, null if none
}

interface ScanResult {
  total: number
  scannedCount: number
  liveCount: number
  demoCount: number
  inPRZ: number
  nearPRZ: number
  rsiConfluenceCount: number
  bullishCount: number
  bearishCount: number
  bullishInPRZ: number
  bearishInPRZ: number
  bullishNearPRZ: number
  bearishNearPRZ: number
  bullishRsiCount: number
  bearishRsiCount: number
  yahooAvailable: boolean
  chartPeriod: string
  suitableFor: string
  sectors: string[]
  results: HarmonicScanEntry[]
  scannedAt: string
}

type SignalMode = 'BUY' | 'SELL' | 'ALL'

// ── Chart Period Config ────────────────────────────────────────────────────

const CHART_PERIODS = [
  {
    id: 'DAILY', label: 'Daily Chart (1D)',
    suitableFor: 'Short Term (5-15 days)',
    description: '~1260 daily candles \u00b7 5-bar high/low pivot \u00b7 5 year history',
    color: '#6366f1', bg: '#1e1b4b', candles: '~1260 daily', pivotN: '5-bar',
  },
  {
    id: 'WEEKLY', label: 'Weekly Chart (1W)',
    suitableFor: 'Mid Term (15-60D) & Long Term (60D+)',
    description: '~156 weekly candles \u00b7 3-bar high/low pivot \u00b7 3 year history',
    color: '#0ea5e9', bg: '#082f49', candles: '~156 weekly', pivotN: '3-bar',
  },
]

const TIMEFRAME_TABLE = [
  { chart: '5M / 15M Chart', style: 'Scalping / Intraday', holding: 'Minutes-Hours', available: false },
  { chart: '30M / 1H Chart', style: 'BTST', holding: '1-2 Days', available: false },
  { chart: '4H Chart', style: 'BTST / Short Term', holding: '2-5 Days', available: false },
  { chart: 'Daily (1D)', style: 'Short Term', holding: '5-15 Days', available: true, id: 'DAILY' },
  { chart: 'Weekly (1W)', style: 'Mid / Long Term', holding: '15-90+ Days', available: true, id: 'WEEKLY' },
  { chart: 'Monthly (1M)', style: 'Long Term / Investment', holding: '3-12 Months', available: false },
]

// ── Pattern Colors ─────────────────────────────────────────────────────────

const PATTERN_COLORS: Record<string, string> = {
  'Gartley': '#6366f1', 'Perfect Gartley': '#818cf8',
  'Bat': '#f59e0b', 'Perfect Bat': '#fbbf24', 'Alt Bat': '#d97706',
  'Butterfly': '#ec4899', 'Perfect Butterfly': '#f472b6',
  'Crab': '#ef4444', 'Deep Crab': '#dc2626', 'Perfect Crab': '#b91c1c',
  'AB=CD': '#10b981', 'Cypher': '#8b5cf6', 'Shark': '#06b6d4',
}

// ── Signal Mode Config ─────────────────────────────────────────────────────

const SIGNAL_CONFIG = {
  BUY:  { color: '#34d399', bg: 'rgba(5,150,105,0.12)',  border: '#059669', emoji: '\ud83d\udcc8', label: 'BUY Signals',  sub: 'Bullish patterns at support PRZ' },
  SELL: { color: '#f87171', bg: 'rgba(220,38,38,0.12)', border: '#dc2626', emoji: '\ud83d\udcc9', label: 'SELL Signals', sub: 'Bearish patterns at resistance PRZ' },
  ALL:  { color: '#818cf8', bg: 'rgba(79,70,229,0.12)', border: '#4f46e5', emoji: '\u26a1', label: 'All Patterns', sub: 'Both bullish and bearish' },
} as const

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
          symbol: entry.symbol, name: entry.name, sector: entry.sector,
          timeframe, entryPrice: parseFloat(entryPrice),
          stopLoss: entry.stopLoss, target1: entry.target1, target2: entry.target2,
          target3: entry.target2, riskReward: entry.riskReward,
          holdingPeriod: timeframe === 'BTST' ? '1-2D' : timeframe === 'SHORT_TERM' ? '5-15D' : timeframe === 'MIDTERM' ? '15-60D' : '60D+',
          confidence: Math.round(Math.max(30, 100 - Math.abs(p.distFromD) * 8)),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to track')
      toast.success(`${isLong ? '\ud83d\udcc8' : '\ud83d\udcc9'} Paper trade added: ${entry.symbol} (${p.direction} ${p.name})`)
      onSuccess(); onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: '#0f172a', borderColor: '#1e293b' }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {isLong ? '\ud83d\udcc8' : '\ud83d\udcc9'} Paper Trade &mdash; {isLong ? 'Long (BUY)' : 'Short (SELL)'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="mb-3 rounded-xl p-3" style={{ background: '#1e293b' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white text-lg">{entry.symbol}</span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ background: isLong ? '#064e3b' : '#450a0a', color: isLong ? '#34d399' : '#f87171' }}>
              {p.direction} {p.name}
            </span>
          </div>
          <div className="text-sm text-slate-400">{entry.name} &middot; {entry.sector}</div>
        </div>
        <div className="mb-3 rounded-xl p-3 border"
          style={{ background: '#0f1729', borderColor: isLong ? '#065f46' : '#7f1d1d' }}>
          <div className="text-xs text-slate-400 mb-1.5 font-semibold uppercase tracking-wider">
            PRZ Zone &mdash; {isLong ? '\ud83d\udfe2 Support (Buy Here)' : '\ud83d\udd34 Resistance (Sell Here)'}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Low: <span className="font-mono text-white">\u20b9{p.przLow.toFixed(2)}</span></span>
            <span className="text-slate-300">Mid: <span className="font-mono font-bold" style={{ color: isLong ? '#34d399' : '#f87171' }}>\u20b9{p.przMid.toFixed(2)}</span></span>
            <span className="text-slate-300">High: <span className="font-mono text-white">\u20b9{p.przHigh.toFixed(2)}</span></span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Timeframe</label>
            <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white border"
              style={{ background: '#1e293b', borderColor: '#334155' }}>
              <option value="BTST">BTST (Next Day)</option>
              <option value="SHORT_TERM">Short Term (5-15 Days)</option>
              <option value="MIDTERM">Mid Term (15-60 Days)</option>
              <option value="LONG_TERM">Long Term (60+ Days)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              {isLong ? 'Buy Entry Price (\u20b9)' : 'Sell Entry Price (\u20b9)'}
            </label>
            <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white border font-mono"
              style={{ background: '#1e293b', borderColor: '#334155' }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg p-2 text-center" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d' }}>
              <div className="text-xs text-red-400">Stop Loss</div>
              <div className="font-mono text-sm text-red-300">\u20b9{entry.stopLoss.toFixed(2)}</div>
              <div className="text-xs text-red-500 mt-0.5">{isLong ? '\u2193 1.2% below PRZ' : '\u2191 1.2% above PRZ'}</div>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#06652222', border: '1px solid #065f46' }}>
              <div className="text-xs text-emerald-400">Target 1</div>
              <div className="font-mono text-sm text-emerald-300">\u20b9{entry.target1.toFixed(2)}</div>
              <div className="text-xs text-emerald-500 mt-0.5">38.2% of CD</div>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: '#06652233', border: '1px solid #065f46' }}>
              <div className="text-xs text-emerald-400">Target 2</div>
              <div className="font-mono text-sm text-emerald-300">\u20b9{entry.target2.toFixed(2)}</div>
              <div className="text-xs text-emerald-500 mt-0.5">61.8% of CD</div>
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
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white"
            style={{ background: '#1e293b' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: isLong ? 'linear-gradient(135deg,#059669,#065f46)' : 'linear-gradient(135deg,#dc2626,#7f1d1d)' }}>
            {loading ? 'Adding...' : isLong ? '\ud83d\udcc8 Track Long Trade' : '\ud83d\udcc9 Track Short Trade'}
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
  const isLong = p.direction === 'Bullish'
  const absDist = Math.abs(p.distFromD)
  let baseColor = '#64748b'
  let label = `${absDist.toFixed(1)}% away`
  if (absDist <= 3) { baseColor = isLong ? '#10b981' : '#ef4444'; label = '\ud83c\udfaf IN PRZ' }
  else if (absDist <= 5) { baseColor = '#f59e0b' }
  else if (absDist <= 8) { baseColor = '#f97316' }
  const barPct = Math.min(100, Math.max(5, 100 - absDist * 7))
  return (
    <div className="w-full min-w-28">
      <div className="mb-1"><span className="text-xs font-semibold" style={{ color: baseColor }}>{label}</span></div>
      <div className="h-1.5 rounded-full" style={{ background: '#1e293b' }}>
        <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: `linear-gradient(90deg,${baseColor}44,${baseColor})` }} />
      </div>
    </div>
  )
}

// ── Stock Row ──────────────────────────────────────────────────────────────

function StockRow({ entry, onPaperTrade }: { entry: HarmonicScanEntry; onPaperTrade: (e: HarmonicScanEntry) => void }) {
  const [expanded, setExpanded] = useState(false)
  const p = entry.bestPattern!
  const isLong = p.direction === 'Bullish'
  const dirColor = isLong ? '#34d399' : '#f87171'

  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-slate-800/30 transition-colors"
        style={{ borderColor: '#1e293b' }} onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {entry.inPRZ
              ? <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: dirColor }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: dirColor }} />
                </span>
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
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: isLong ? '#064e3b' : '#450a0a', color: dirColor }}>
              {isLong ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {isLong ? 'BUY' : 'SELL'}
            </span>
            <PatternBadge pattern={p} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-slate-500">{p.status}</span>
            {p.rsiBullish
              ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#05966920', color: '#34d399', border: '1px solid #05966940' }}>RSI {p.rsi}</span>
              : p.rsiBearish
              ? <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#dc262620', color: '#f87171', border: '1px solid #dc262640' }}>RSI {p.rsi}</span>
              : <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1e293b', color: '#64748b' }}>RSI {p.rsi}</span>}
            {entry.fibConfluence &&
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#7c3aed20', color: '#a78bfa', border: '1px solid #7c3aed40' }}
                title={`PRZ midpoint overlaps ${entry.fibConfluence}`}>
                Fib∩PRZ
              </span>}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="font-mono font-bold text-white">\u20b9{entry.currentPrice.toFixed(2)}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-xs font-mono" style={{ color: dirColor }}>\u20b9{p.przLow.toFixed(1)} \u2013 \u20b9{p.przHigh.toFixed(1)}</div>
          <div className="text-xs text-slate-500 font-mono">mid \u20b9{p.przMid.toFixed(1)}</div>
        </td>
        <td className="px-4 py-3">
          <div className="font-mono text-sm font-bold" style={{ color: dirColor }}>\u20b9{entry.suggestedEntry.toFixed(2)}</div>
          <div className="text-xs mt-0.5" style={{ color: isLong ? '#059669' : '#dc2626' }}>
            {isLong ? '\u2191 Limit Buy' : '\u2193 Limit Sell'}
          </div>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell"><PRZBar entry={entry} /></td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); onPaperTrade(entry) }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold hover:scale-105 transition-transform"
              style={{ background: isLong ? 'linear-gradient(135deg,#059669,#065f46)' : 'linear-gradient(135deg,#dc2626,#7f1d1d)', color: '#fff' }}>
              {isLong ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {isLong ? 'Buy Signal' : 'Sell Signal'}
            </button>
            {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ borderColor: '#1e293b' }}>
          <td colSpan={8} className="px-4 pb-4">
            <div className="rounded-xl p-4 mt-1" style={{ background: '#0f1729', border: `1px solid ${isLong ? '#064e3b' : '#450a0a'}` }}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: '#1e293b' }}>
                <span className="px-2 py-1 rounded-lg text-xs font-bold"
                  style={{ background: isLong ? '#064e3b' : '#450a0a', color: dirColor }}>
                  {isLong ? '\ud83d\udcc8 BULLISH \u2014 Approaching SUPPORT PRZ' : '\ud83d\udcc9 BEARISH \u2014 Approaching RESISTANCE PRZ'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Trade Levels {isLong ? '(Long)' : '(Short)'}
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: isLong ? 'Entry (Buy at PRZ mid)' : 'Entry (Sell at PRZ mid)', val: `\u20b9${entry.suggestedEntry.toFixed(2)}`, color: dirColor },
                      { label: isLong ? 'Stop Loss (\u2193 1.2% below PRZ)' : 'Stop Loss (\u2191 1.2% above PRZ)', val: `\u20b9${entry.stopLoss.toFixed(2)}`, color: '#f87171' },
                      { label: isLong ? 'Target 1 (\u2191 38.2% of CD)' : 'Target 1 (\u2193 38.2% of CD)', val: `\u20b9${entry.target1.toFixed(2)}`, color: '#34d399' },
                      { label: isLong ? 'Target 2 (\u2191 61.8% of CD)' : 'Target 2 (\u2193 61.8% of CD)', val: `\u20b9${entry.target2.toFixed(2)}`, color: '#6ee7b7' },
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
                      { label: 'D retrace/ext', val: `${(p.ratioXAD * 100).toFixed(1)}%` },
                      { label: 'RSI(14)', val: `${p.rsi}`, special: p.rsiBullish ? '#34d399' : p.rsiBearish ? '#f87171' : '#94a3b8' },
                      { label: 'RSI Confluence', val: p.rsiBullish ? '\u2705 Bullish \u226440' : p.rsiBearish ? '\u2705 Bearish \u226560' : '\u26a0\ufe0f None', special: (p.rsiBullish || p.rsiBearish) ? '#34d399' : '#f59e0b' },
                      { label: 'Fib \u2229 PRZ', val: entry.fibConfluence ? `\u2705 ${entry.fibConfluence}` : '\u2014 No overlap', special: entry.fibConfluence ? '#a78bfa' : '#475569' },
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
              <div className="mt-3 pt-3 border-t text-xs text-slate-500" style={{ borderColor: '#1e293b' }}>{p.description}</div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Signal Mode Tabs ───────────────────────────────────────────────────────

function SignalModeTabs({ mode, onChange, data }: { mode: SignalMode; onChange: (m: SignalMode) => void; data: ScanResult | null }) {
  const counts: Record<SignalMode, number | null> = {
    BUY: data ? (data.bullishCount ?? 0) : null,
    SELL: data ? (data.bearishCount ?? 0) : null,
    ALL: data ? data.total : null,
  }
  return (
    <div className="rounded-2xl border p-2 mb-6 grid grid-cols-3 gap-2"
      style={{ background: 'rgba(15,23,42,0.95)', borderColor: '#1e293b' }}>
      {(Object.keys(SIGNAL_CONFIG) as SignalMode[]).map(m => {
        const cfg = SIGNAL_CONFIG[m]
        const active = mode === m
        const cnt = counts[m]
        return (
          <button key={m} onClick={() => onChange(m)}
            className="flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
            style={{
              background: active ? cfg.bg : 'transparent',
              border: `2px solid ${active ? cfg.border : 'transparent'}`,
              color: active ? cfg.color : '#64748b',
              boxShadow: active ? `0 0 20px ${cfg.border}33` : 'none',
            }}>
            <div className="flex items-center gap-2">
              <span>{cfg.emoji} {cfg.label}</span>
              {cnt !== null && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold min-w-6 text-center"
                  style={{ background: active ? cfg.border : '#1e293b', color: active ? '#fff' : '#94a3b8' }}>
                  {cnt}
                </span>
              )}
            </div>
            <div className="text-xs font-normal" style={{ color: active ? cfg.color : '#475569' }}>{cfg.sub}</div>
          </button>
        )
      })}
    </div>
  )
}

// ── Timeframe Guide ────────────────────────────────────────────────────────

function TimeframeGuide({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border overflow-hidden mb-6" style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30 transition-colors">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-sky-400" />
          <span className="text-sm font-semibold text-white">Chart Timeframe Guide \u2014 Which Chart for Which Trading Style?</span>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: '#1e293b' }}>
          <p className="text-xs text-slate-400 mt-3 mb-3 leading-relaxed">
            Harmonic patterns must be read on the <strong className="text-slate-200">correct chart timeframe</strong> matching your
            holding period. A Butterfly on Daily signals a reversal over <em>days</em>; on Weekly over <em>weeks to months</em>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th className="px-3 py-2 text-left text-slate-400 font-semibold">Chart</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-semibold">Style</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-semibold">Holding</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-semibold">Available</th>
                </tr>
              </thead>
              <tbody>
                {TIMEFRAME_TABLE.map((row, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: '#1e293b', background: row.available && row.id === selectedId ? '#1e1b4b33' : 'transparent' }}>
                    <td className="px-3 py-2 font-mono font-semibold" style={{ color: row.available ? '#c7d2fe' : '#4b5563' }}>{row.chart}</td>
                    <td className="px-3 py-2 text-slate-300">{row.style}</td>
                    <td className="px-3 py-2 text-slate-400">{row.holding}</td>
                    <td className="px-3 py-2">
                      {row.available
                        ? <button onClick={() => onSelect(row.id!)} className="px-2 py-0.5 rounded text-xs font-bold"
                            style={{ background: row.id === selectedId ? '#4f46e5' : '#1e293b', color: row.id === selectedId ? '#fff' : '#818cf8' }}>
                            {row.id === selectedId ? '\u2713 Selected' : 'Select'}
                          </button>
                        : <span className="text-slate-600 text-xs">Coming soon</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">* Intraday charts need a live feed. EOD data from Yahoo Finance supports Daily & Weekly only.</p>
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
  const [signalMode, setSignalMode] = useState<SignalMode>('ALL')
  const [sectorFilter, setSectorFilter] = useState('ALL')
  const [przOnly, setPrzOnly] = useState(false)
  const [rsiConfluenceOnly, setRsiConfluenceOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [patternFilter, setPatternFilter] = useState('ALL')

  const scan = useCallback(async (period = chartPeriod) => {
    setLoading(true); setData(null)
    try {
      const params = new URLSearchParams({ chartPeriod: period, sector: sectorFilter, direction: 'ALL', przOnly: String(przOnly) })
      const res = await fetch(`/api/harmonic-scan?${params}`)
      if (!res.ok) throw new Error('Scan failed')
      const json: ScanResult = await res.json()
      setData(json)
      if (json.total > 0) {
        toast.success(`Found ${json.total} harmonic patterns (${json.bullishCount} BUY / ${json.bearishCount} SELL)`, {
          description: `Chart: ${json.chartPeriod} \u00b7 ${json.liveCount} live stocks \u00b7 ${json.inPRZ} in PRZ`,
        })
      } else {
        toast.info(`Scan complete \u2014 0 patterns on ${json.chartPeriod}`, {
          description: `Scanned ${json.scannedCount} stocks \u00b7 Yahoo: ${json.yahooAvailable ? '\u2705' : '\u274c'}`,
          duration: 8000,
        })
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Scan failed')
    } finally { setLoading(false) }
  }, [chartPeriod, sectorFilter, przOnly])

  useEffect(() => { scan() }, []) // eslint-disable-line

  const handlePeriodSelect = (id: string) => { setChartPeriod(id); scan(id) }

  const visibleResults = (data?.results ?? []).filter(r => {
    if (signalMode === 'BUY' && r.bestPattern?.direction !== 'Bullish') return false
    if (signalMode === 'SELL' && r.bestPattern?.direction !== 'Bearish') return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.symbol.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false
    }
    if (patternFilter !== 'ALL' && !r.patterns.some(p => p.name === patternFilter)) return false
    if (rsiConfluenceOnly && !r.bestPattern?.rsiBullish && !r.bestPattern?.rsiBearish) return false
    return true
  })

  const allPatternNames = data ? [...new Set(data.results.flatMap(r => r.patterns.map(p => p.name)))].sort() : []
  const selectedPeriodCfg = CHART_PERIODS.find(p => p.id === chartPeriod) ?? CHART_PERIODS[0]
  const modeCfg = SIGNAL_CONFIG[signalMode]
  const modeTotal   = signalMode === 'BUY' ? (data?.bullishCount  ?? 0) : signalMode === 'SELL' ? (data?.bearishCount  ?? 0) : (data?.total           ?? 0)
  const modeInPRZ   = signalMode === 'BUY' ? (data?.bullishInPRZ  ?? 0) : signalMode === 'SELL' ? (data?.bearishInPRZ  ?? 0) : (data?.inPRZ            ?? 0)
  const modeNearPRZ = signalMode === 'BUY' ? (data?.bullishNearPRZ ?? 0) : signalMode === 'SELL' ? (data?.bearishNearPRZ ?? 0) : (data?.nearPRZ         ?? 0)
  const modeRsi     = signalMode === 'BUY' ? (data?.bullishRsiCount ?? 0) : signalMode === 'SELL' ? (data?.bearishRsiCount ?? 0) : (data?.rsiConfluenceCount ?? 0)

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#020617 0%,#0a0f1e 50%,#020617 100%)' }}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(2,6,23,0.95)', backdropFilter: 'blur(12px)', borderColor: '#1e293b' }}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <ArrowLeft size={14} /> Back
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <Radar size={20} className="text-violet-400" />
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Harmonic Pattern Scanner</h1>
              <p className="text-xs text-slate-400 mt-0.5">PRZ reversal detection \u00b7 {selectedPeriodCfg.label} \u00b7 {selectedPeriodCfg.suitableFor}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data && !loading && (
              <div className="text-xs text-slate-500">{new Date(data.scannedAt).toLocaleTimeString('en-IN')} \u00b7 {data.liveCount} live</div>
            )}
            <button onClick={() => scan()} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Scanning...' : 'Scan Now'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        {/* Chart Period Cards */}
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
                  {cp.id === 'DAILY' ? <Calendar size={14} /> : <BarChart2 size={14} />}
                </div>
                <span className="font-bold text-sm" style={{ color: chartPeriod === cp.id ? cp.color : '#fff' }}>{cp.label}</span>
                {chartPeriod === cp.id && (
                  <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: `${cp.color}33`, color: cp.color }}>SELECTED</span>
                )}
              </div>
              <div className="text-xs text-slate-400 mb-1">Best for: <span className="text-slate-200">{cp.suitableFor}</span></div>
              <div className="text-xs text-slate-500">{cp.description}</div>
            </button>
          ))}
        </div>

        {/* BUY / SELL / ALL Tabs */}
        <SignalModeTabs mode={signalMode} onChange={setSignalMode} data={data} />

        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: <Radar size={18} style={{ color: modeCfg.color }} />, label: signalMode === 'BUY' ? 'Bullish Patterns' : signalMode === 'SELL' ? 'Bearish Patterns' : 'All Patterns', value: data ? modeTotal : '\u2014', color: modeCfg.color },
            { icon: <CheckCircle2 size={18} className="text-emerald-400" />, label: 'IN PRZ (\u22643%)', value: data ? modeInPRZ : '\u2014', color: '#34d399', pulse: true },
            { icon: <AlertCircle size={18} className="text-amber-400" />, label: 'Near PRZ (3\u20138%)', value: data ? modeNearPRZ : '\u2014', color: '#fbbf24' },
            { icon: <Zap size={18} className="text-emerald-300" />, label: signalMode === 'SELL' ? 'RSI Overbought \u2713' : 'RSI Confluence \u2713', value: data ? modeRsi : '\u2014', color: '#6ee7b7', highlight: true },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border p-4 flex items-center gap-3"
              style={{ background: stat.highlight && modeRsi > 0 ? 'rgba(5,150,105,0.08)' : 'rgba(15,23,42,0.8)', borderColor: stat.highlight && modeRsi > 0 ? '#059669' : '#1e293b' }}>
              <div className="p-2 rounded-xl" style={{ background: `${stat.color}15` }}>{stat.icon}</div>
              <div>
                <div className="text-xs text-slate-400">{stat.label}</div>
                <div className="text-2xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                  {stat.pulse && modeInPRZ > 0 && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Timeframe Guide */}
        <TimeframeGuide selectedId={chartPeriod} onSelect={handlePeriodSelect} />

        {/* Filters */}
        <div className="rounded-2xl border p-4 mb-6" style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">Filters</span>
            {data && <span className="ml-auto text-xs text-slate-500">{data.scannedCount} scanned \u00b7 {data.liveCount} live \u00b7 Yahoo: {data.yahooAvailable ? '\u2705' : '\u274c'}</span>}
          </div>
          <div className="flex flex-wrap gap-3">
            <input type="text" placeholder="Search symbol or name..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 rounded-xl text-sm text-white border placeholder-slate-500"
              style={{ background: '#0f1729', borderColor: '#334155' }} />
            <select value={patternFilter} onChange={e => setPatternFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white border" style={{ background: '#0f1729', borderColor: '#334155' }}>
              <option value="ALL">All Patterns</option>
              {allPatternNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white border" style={{ background: '#0f1729', borderColor: '#334155' }}>
              <option value="ALL">All Sectors</option>
              {(data?.sectors ?? []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border"
              style={{ background: przOnly ? '#1e1b4b' : '#0f1729', borderColor: przOnly ? '#6366f1' : '#334155' }}>
              <input type="checkbox" checked={przOnly} onChange={e => setPrzOnly(e.target.checked)} className="accent-violet-500" />
              <span className="text-sm font-medium" style={{ color: przOnly ? '#c7d2fe' : '#6b7280' }}>PRZ Only</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border"
              style={{ background: rsiConfluenceOnly ? '#052e16' : '#0f1729', borderColor: rsiConfluenceOnly ? '#059669' : '#334155' }}>
              <input type="checkbox" checked={rsiConfluenceOnly} onChange={e => setRsiConfluenceOnly(e.target.checked)} className="accent-emerald-500" />
              <span className="text-sm font-semibold" style={{ color: rsiConfluenceOnly ? '#34d399' : '#cbd5e1' }}>RSI Confluence</span>
            </label>
            <button onClick={() => scan()} disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              Apply &amp; Rescan
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-4 mb-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
            Bullish IN PRZ
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
            Bearish IN PRZ
          </div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Near PRZ</div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: '#05966920', color: '#34d399', border: '1px solid #05966940', fontSize: 10 }}>RSI 28</span>
            Bullish \u226440
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: '#dc262620', color: '#f87171', border: '1px solid #dc262640', fontSize: 10 }}>RSI 72</span>
            Bearish \u226560
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock size={12} className="text-slate-500" /><span>Click row to expand</span>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="rounded-2xl border flex flex-col items-center justify-center py-28 gap-4"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
            <Radar size={52} className="text-violet-400 animate-pulse" />
            <div className="text-white font-bold text-lg">Scanning NSE stocks for Harmonic Patterns...</div>
            <div className="text-slate-400 text-sm">{selectedPeriodCfg.label} \u00b7 {selectedPeriodCfg.candles} \u00b7 {selectedPeriodCfg.pivotN} pivot</div>
            <div className="text-xs text-slate-500">Gartley, Bat, Butterfly, Crab, Cypher, Shark + variants (Bullish + Bearish)</div>
          </div>
        ) : data && modeTotal === 0 ? (
          <div className="rounded-2xl border flex flex-col items-center justify-center py-24"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
            <Radar size={48} className="text-slate-600 mb-4" />
            <div className="text-slate-300 font-bold text-lg">
              No {signalMode === 'BUY' ? 'Bullish' : signalMode === 'SELL' ? 'Bearish' : ''} patterns found on {data.chartPeriod}
            </div>
            <div className="text-slate-500 text-sm mt-1 mb-4">
              Yahoo: {data.yahooAvailable ? 'Yes' : 'No'} \u00b7 Live: {data.liveCount}/{data.scannedCount}
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {signalMode !== 'ALL' && (
                <button onClick={() => setSignalMode('ALL')} className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-105"
                  style={{ background: '#1e293b', border: '1px solid #4f46e5' }}>Try All Patterns</button>
              )}
              {CHART_PERIODS.filter(p => p.id !== chartPeriod).map(p => (
                <button key={p.id} onClick={() => handlePeriodSelect(p.id)} className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:scale-105"
                  style={{ background: p.bg, border: `1px solid ${p.color}` }}>Try {p.label}</button>
              ))}
            </div>
          </div>
        ) : visibleResults.length === 0 && data ? (
          <div className="rounded-2xl border flex flex-col items-center justify-center py-16"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
            <Filter size={36} className="text-slate-600 mb-3" />
            <div className="text-slate-300 font-semibold">No results match current filters</div>
            <div className="text-slate-500 text-sm mt-1">Clear filters to see all {modeTotal} patterns</div>
          </div>
        ) : visibleResults.length > 0 ? (
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: signalMode === 'BUY' ? '#065f46' : signalMode === 'SELL' ? '#7f1d1d' : '#1e293b' }}>
            <div className="px-4 py-2 flex items-center gap-3 border-b text-xs"
              style={{ background: signalMode === 'BUY' ? 'rgba(5,150,105,0.08)' : signalMode === 'SELL' ? 'rgba(220,38,38,0.08)' : '#0f172a', borderColor: '#1e293b' }}>
              <span className="font-bold" style={{ color: modeCfg.color }}>
                {signalMode === 'BUY' ? '\ud83d\udcc8 BUY SIGNALS \u2014 Bullish Harmonic Patterns at Support PRZ' :
                  signalMode === 'SELL' ? '\ud83d\udcc9 SELL SIGNALS \u2014 Bearish Harmonic Patterns at Resistance PRZ' :
                    '\u26a1 ALL PATTERNS \u2014 Bullish & Bearish'}
              </span>
              <span className="ml-auto text-slate-500">{visibleResults.length} stocks</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ background: '#0f172a', borderColor: '#1e293b' }}>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Sector</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Signal / Pattern</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Current \u20b9</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">PRZ Zone</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Target size={12} />
                        {signalMode === 'BUY' ? 'Buy Entry' : signalMode === 'SELL' ? 'Sell Entry' : 'Entry'}
                      </div>
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
            <div className="px-4 py-3 border-t text-xs text-slate-500" style={{ borderColor: '#1e293b' }}>
              {visibleResults.length} of {modeTotal} stocks shown \u00b7 {data?.chartPeriod} \u00b7
              SL = 1.2% beyond PRZ boundary \u00b7 Targets = 38.2% / 61.8% of CD leg \u00b7 Click row to expand
            </div>
          </div>
        ) : null}

        {/* Signal Logic Panels */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border p-4" style={{ background: 'rgba(5,150,105,0.06)', borderColor: '#065f46' }}>
            <div className="text-xs font-bold text-emerald-400 mb-2">\ud83d\udcc8 BUY Signal \u2014 How It Works</div>
            <div className="text-xs text-slate-400 space-y-1">
              <div>\u2022 Price approaching a <strong className="text-slate-200">Support PRZ</strong></div>
              <div>\u2022 Bullish harmonic pattern at Fibonacci support</div>
              <div>\u2022 <strong className="text-slate-200">Entry:</strong> PRZ midpoint (limit buy)</div>
              <div>\u2022 <strong className="text-slate-200">Stop Loss:</strong> 1.2% below PRZ Low (pattern invalidated)</div>
              <div>\u2022 <strong className="text-emerald-400">Target 1:</strong> 38.2% of CD leg above entry</div>
              <div>\u2022 <strong className="text-emerald-400">Target 2:</strong> 61.8% of CD leg above entry</div>
              <div>\u2022 <strong className="text-slate-200">RSI:</strong> \u226440 (oversold) = stronger signal</div>
            </div>
          </div>
          <div className="rounded-2xl border p-4" style={{ background: 'rgba(220,38,38,0.06)', borderColor: '#7f1d1d' }}>
            <div className="text-xs font-bold text-red-400 mb-2">\ud83d\udcc9 SELL Signal \u2014 How It Works</div>
            <div className="text-xs text-slate-400 space-y-1">
              <div>\u2022 Price approaching a <strong className="text-slate-200">Resistance PRZ</strong></div>
              <div>\u2022 Bearish harmonic pattern at Fibonacci resistance</div>
              <div>\u2022 <strong className="text-slate-200">Entry:</strong> PRZ midpoint (limit sell / short)</div>
              <div>\u2022 <strong className="text-slate-200">Stop Loss:</strong> 1.2% above PRZ High (pattern invalidated)</div>
              <div>\u2022 <strong className="text-red-400">Target 1:</strong> 38.2% of CD leg below entry</div>
              <div>\u2022 <strong className="text-red-400">Target 2:</strong> 61.8% of CD leg below entry</div>
              <div>\u2022 <strong className="text-slate-200">RSI:</strong> \u226560 (overbought) = stronger signal</div>
            </div>
          </div>
        </div>

        {/* Pattern Color Guide */}
        <div className="mt-4 rounded-2xl border p-4" style={{ background: 'rgba(15,23,42,0.8)', borderColor: '#1e293b' }}>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pattern Color Guide</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PATTERN_COLORS).map(([name, color]) => (
              <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: `${color}20`, border: `1px solid ${color}50`, color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {paperTradeEntry && (
        <PaperTradeDialog
          entry={paperTradeEntry}
          onClose={() => setPaperTradeEntry(null)}
          onSuccess={() => setPaperTradeEntry(null)}
        />
      )}
    </div>
  )
}
