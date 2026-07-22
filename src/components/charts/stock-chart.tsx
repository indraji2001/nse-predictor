'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Bar, BarChart, Cell, Brush,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Candle, IndicatorSnapshot, formatINR } from '@/components/predictor/types'

// Mathematically correct Recharts custom candlestick shape renderer.
// Translates rupee highs, lows, opens, and closes into accurate pixel coordinate dimensions.
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props
  if (x == null || y == null || width == null || height == null || !payload) return null

  const { open, close, high, low, candleColor } = payload
  const absBody = Math.abs(close - open)
  const bodyVal = absBody || 0.01 // avoid division by zero
  const pixelsPerUnit = height / bodyVal

  const maxBody = Math.max(open, close)
  const minBody = Math.min(open, close)

  // Compute wicks relative to body pixel positions (y is maxBody, y+height is minBody)
  const yHigh = y - (high - maxBody) * pixelsPerUnit
  const yLow = y + height + (minBody - low) * pixelsPerUnit

  const cx = x + width / 2

  return (
    <g>
      {/* Wick (High-Low Line) */}
      <line
        x1={cx}
        y1={yHigh}
        x2={cx}
        y2={yLow}
        stroke={candleColor}
        strokeWidth={1.5}
      />
      {/* Body (Open-Close Rect) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(1.5, height)} // ensure flat candles show at least a thin line
        fill={candleColor}
        stroke={candleColor}
        strokeWidth={0.5}
      />
    </g>
  )
}

interface Props {
  candles: Candle[]
  indicators: IndicatorSnapshot
  symbol: string
}

// Color palette (consistent across chart + legend)
const COLORS = {
  close: 'oklch(0.646 0.222 41.116)',      // orange/red
  ema9: 'oklch(0.696 0.17 162.48)',         // green
  ema21: 'oklch(0.488 0.243 264.376)',      // blue
  ema50: 'oklch(0.769 0.188 70.08)',        // amber
  bb: 'oklch(0.708 0 0)',                   // gray
  volume: 'oklch(0.708 0 0)',               // gray
  bullishCandle: 'oklch(0.696 0.17 162.48)', // green
  bearishCandle: 'oklch(0.577 0.245 27.325)', // red
}

// Custom symbol mapping for TradingView
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

// Smart date label formatter — handles both ISO dates ("2026-07-22") and
// intraday time strings ("07-16 09:15") without calling new Date() which
// returns Invalid Date for the intraday format.
function formatDateLabel(d: string | number, showYear = false): string {
  if (d == null) return ''
  const s = String(d)
  // Intraday format: "MM-DD HH:MM" (no year, has a space)
  if (s.includes(' ')) return s  // already human-readable, return as-is
  // Full ISO date: "YYYY-MM-DD"
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s  // fallback: just show the raw string
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(showYear ? { year: 'numeric' } : {}),
  })
}

export function StockChart({ candles, indicators, symbol }: Props) {
  const [showEMA, setShowEMA] = useState(true)
  const [showBB, setShowBB] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const [showFib, setShowFib] = useState(false)    // Fibonacci retracement overlay
  const [showPivot, setShowPivot] = useState(false)  // Pivot levels overlay
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle')
  const [range, setRange] = useState<
    '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y' | '10Y' | 'MAX'
  >('3M')
  const [viewSource, setViewSource] = useState<'custom' | 'tradingview'>('custom')
  const [intradayCandles, setIntradayCandles] = useState<any[] | null>(null)
  const [loadingIntraday, setLoadingIntraday] = useState(false)

  const baseSymbol = symbol.toUpperCase().replace('.NS', '').trim()
  const mappedSymbol = TV_MAPPINGS[baseSymbol] || baseSymbol.replace(/[&\-]/g, '_')

  // Fetch intraday candles when an intraday timeframe is selected
  useEffect(() => {
    if (['5m', '15m', '30m', '1H', '4H'].includes(range)) {
      setLoadingIntraday(true)
      fetch(`/api/intraday/${encodeURIComponent(symbol)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.candles && Array.isArray(data.candles)) {
            setIntradayCandles(data.candles)
          } else {
            setIntradayCandles(null)
          }
        })
        .catch(() => setIntradayCandles(null))
        .finally(() => setLoadingIntraday(false))
    }
  }, [symbol, range])

  // Slice or aggregate candles based on range
  const data = useMemo(() => {
    const isIntraday = ['5m', '15m', '30m', '1H', '4H'].includes(range)

    if (isIntraday && intradayCandles && intradayCandles.length > 0) {
      let groupSize = 1
      switch (range) {
        case '5m':  groupSize = 1;  break
        case '15m': groupSize = 3;  break
        case '30m': groupSize = 6;  break
        case '1H':  groupSize = 12; break
        case '4H':  groupSize = 48; break
      }
      const aggregated: Candle[] = []
      for (let i = 0; i < intradayCandles.length; i += groupSize) {
        const group = intradayCandles.slice(i, i + groupSize)
        if (group.length === 0) continue
        const open = group[0].open
        const close = group[group.length - 1].close
        const high = Math.max(...group.map((g) => g.high))
        const low = Math.min(...group.map((g) => g.low))
        const volume = group.reduce((sum, g) => sum + (g.volume || 0), 0)
        const timeLabel = group[0].time || (group[0].date ? group[0].date.slice(5) : '')
        const dateLabel = group[0].date ? `${group[0].date.slice(5)} ${timeLabel}` : timeLabel
        aggregated.push({
          date: dateLabel,
          open,
          high,
          low,
          close,
          volume,
        })
      }
      return aggregated.map((c) => {
        const close = c.close || 0
        const open = c.open || close
        const high = c.high || close
        const low = c.low || close
        return {
          date: c.date,
          close,
          open,
          high,
          low,
          volume: c.volume || 0,
          candleColor: close >= open ? COLORS.bullishCandle : COLORS.bearishCandle,
          bodyRange: [Math.min(open, close), Math.max(open, close)] as [number, number],
          isBullish: close >= open,
        }
      })
    }

    const n = candles.length
    let take = 66
    switch (range) {
      case '5m':  take = 30;  break
      case '15m': take = 45;  break
      case '30m': take = 60;  break
      case '1H':  take = 90;  break
      case '4H':  take = 120; break
      case '1D':  take = 22;  break
      case '1M':  take = 22;  break
      case '3M':  take = 66;  break
      case '6M':  take = 132; break
      case '1Y':  take = 250; break
      case '2Y':  take = 500; break
      case '3Y':  take = 750; break
      case '5Y':  take = 1300; break
      case '10Y': take = 2600; break
      case 'MAX': take = 99999; break
      default:    take = 66;  break
    }
    return candles.slice(Math.max(0, n - take)).map((c) => {
      const close = c.close || 0
      const open = c.open || close
      const high = c.high || close
      const low = c.low || close
      return {
        date: c.date,
        close,
        open,
        high,
        low,
        volume: c.volume || 0,
        // candle body color: green if close >= open, red otherwise
        candleColor: close >= open ? COLORS.bullishCandle : COLORS.bearishCandle,
        // For candle rendering: body coordinates mapping range
        bodyRange: [Math.min(open, close), Math.max(open, close)] as [number, number],
        isBullish: close >= open,
      }
    })
  }, [candles, intradayCandles, range])

  // Compute EMA series locally for the visible window
  const ema9Series = useMemo(() => computeEMA(data.map((d) => d.close), 9), [data])
  const ema21Series = useMemo(() => computeEMA(data.map((d) => d.close), 21), [data])
  const ema50Series = useMemo(() => computeEMA(data.map((d) => d.close), 50), [data])
  const bbSeries = useMemo(() => computeBollinger(data.map((d) => d.close), 20, 2), [data])

  const chartData = data.map((d, i) => ({
    ...d,
    ema9: ema9Series[i],
    ema21: ema21Series[i],
    ema50: ema50Series[i],
    bbUpper: bbSeries.upper[i],
    bbLower: bbSeries.lower[i],
    bbMiddle: bbSeries.middle[i],
    bbRange: bbSeries.upper[i] != null && bbSeries.lower[i] != null
      ? [bbSeries.lower[i], bbSeries.upper[i]] as [number, number]
      : null,
  }))

  // ─────────────────────────────────────────────────────────────────────────
  // Direction-aware Fibonacci Retracement (per Zerodha Varsity Chapter 16)
  // Direction-aware Fibonacci Retracement
  //
  // UPTREND  (price > midpoint):
  //   100% anchor at HIGH (top)   — peak of the uptrend
  //   23.6% just below HIGH       — small pullback (support)
  //   61.8% near LOW              — deep pullback, golden ratio support
  //   0%   anchor at LOW  (bottom) — where the uptrend started
  //
  // DOWNTREND (price ≤ midpoint):
  //   0%   anchor at HIGH (top)   — where the decline started
  //   23.6% just below HIGH       — needs big bounce to reach (resistance)
  //   61.8% near LOW              — first real bounce resistance target
  //   100% anchor at LOW  (bottom) — trough of the decline
  // ─────────────────────────────────────────────────────────────────────────
  const fibLevels = useMemo(() => {
    const f = indicators.fib
    if (!f) return null
    const isUp = !f.trend || f.trend === 'uptrend'
    if (isUp) {
      // UPTREND (StarTrader/TradingView): 100% at HIGH (top), 0% at LOW (bottom)
      // Levels descend from High: 23.6% = small pullback (near top), 78.6% = deep pullback (near bottom)
      return [
        { label: '100% (High)', val: +f.high.toFixed(2),    color: '#94a3b8', dash: '2 4' as const },
        { label: '23.6%',       val: +f.fib236.toFixed(2),  color: '#3b82f6', dash: '5 3' as const },
        { label: '38.2%',       val: +f.fib382.toFixed(2),  color: '#22c55e', dash: '5 3' as const },
        { label: '50.0%',       val: +f.fib500.toFixed(2),  color: '#eab308', dash: '5 3' as const },
        { label: '61.8% ★',    val: +f.fib618.toFixed(2),  color: '#f97316', dash: '8 3' as const },
        { label: '78.6%',       val: +f.fib786.toFixed(2),  color: '#f43f5e', dash: '5 3' as const },
        { label: '0% (Low)',    val: +f.low.toFixed(2),     color: '#94a3b8', dash: '2 4' as const },
      ]
    } else {
      // DOWNTREND (StarTrader/TradingView): 0% at HIGH (top), 100% at LOW (bottom)
      // Same price levels — 23.6% near High (big bounce needed), 61.8% near Low (first bounce resistance)
      return [
        { label: '0% (High)',   val: +f.high.toFixed(2),    color: '#94a3b8', dash: '2 4' as const },
        { label: '23.6%',       val: +f.fib236.toFixed(2),  color: '#3b82f6', dash: '5 3' as const },
        { label: '38.2%',       val: +f.fib382.toFixed(2),  color: '#22c55e', dash: '5 3' as const },
        { label: '50.0%',       val: +f.fib500.toFixed(2),  color: '#eab308', dash: '5 3' as const },
        { label: '61.8% ★',    val: +f.fib618.toFixed(2),  color: '#f97316', dash: '8 3' as const },
        { label: '78.6%',       val: +f.fib786.toFixed(2),  color: '#f43f5e', dash: '5 3' as const },
        { label: '100% (Low)',  val: +f.low.toFixed(2),     color: '#94a3b8', dash: '2 4' as const },
      ]
    }
  }, [indicators.fib])

  const lastClose = candles[candles.length - 1].close


  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Price chart</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <ToggleGroup type="single" value={viewSource} onValueChange={(v) => v && setViewSource(v as 'custom' | 'tradingview')} size="sm" className="border border-indigo-100 dark:border-indigo-900/60 rounded bg-indigo-50/20 dark:bg-indigo-950/10 p-0.5">
              <ToggleGroupItem value="custom" className="text-[10px] h-6 px-2 font-semibold" title="Custom Predictor Chart">Custom</ToggleGroupItem>
              <ToggleGroupItem value="tradingview" className="text-[10px] h-6 px-2 font-semibold" title="Interactive TradingView Chart">TradingView</ToggleGroupItem>
            </ToggleGroup>

            {viewSource === 'custom' && (
              <>
                {/* Chart type toggle */}
                <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v as 'line' | 'candle')} size="sm">
                  <ToggleGroupItem value="candle" className="text-[10px] h-7 px-2" title="Candlestick chart">Candle</ToggleGroupItem>
                  <ToggleGroupItem value="line" className="text-[10px] h-7 px-2" title="Line chart">Line</ToggleGroupItem>
                </ToggleGroup>
                {/* Time range toggle — Intraday & Multi-Horizon */}
                <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as any)} size="sm" className="flex-wrap">
                  {/* Intraday timeframes */}
                  <ToggleGroupItem value="5m" className="text-[10px] h-7 px-1.5 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10" title="5-minute intraday chart">5m</ToggleGroupItem>
                  <ToggleGroupItem value="15m" className="text-[10px] h-7 px-1.5 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10" title="15-minute intraday chart">15m</ToggleGroupItem>
                  <ToggleGroupItem value="30m" className="text-[10px] h-7 px-1.5 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10" title="30-minute intraday chart">30m</ToggleGroupItem>
                  <ToggleGroupItem value="1H" className="text-[10px] h-7 px-1.5 font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10" title="1-hour chart">1H</ToggleGroupItem>
                  <ToggleGroupItem value="4H" className="text-[10px] h-7 px-1.5 font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10" title="4-hour chart">4H</ToggleGroupItem>
                  {/* Daily & Historical timeframes */}
                  <ToggleGroupItem value="1D" className="text-[10px] h-7 px-1.5 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" title="1-Day Daily candles chart">1D</ToggleGroupItem>
                  <ToggleGroupItem value="1M" className="text-[10px] h-7 px-1.5">1M</ToggleGroupItem>
                  <ToggleGroupItem value="3M" className="text-[10px] h-7 px-1.5">3M</ToggleGroupItem>
                  <ToggleGroupItem value="6M" className="text-[10px] h-7 px-1.5">6M</ToggleGroupItem>
                  <ToggleGroupItem value="1Y" className="text-[10px] h-7 px-1.5">1Y</ToggleGroupItem>
                  {candles.length > 280  && <ToggleGroupItem value="2Y"  className="text-[10px] h-7 px-1.5">2Y</ToggleGroupItem>}
                  {candles.length > 530  && <ToggleGroupItem value="3Y"  className="text-[10px] h-7 px-1.5">3Y</ToggleGroupItem>}
                  {candles.length > 800  && <ToggleGroupItem value="5Y"  className="text-[10px] h-7 px-1.5">5Y</ToggleGroupItem>}
                  {candles.length > 1200 && <ToggleGroupItem value="10Y" className="text-[10px] h-7 px-1.5">10Y</ToggleGroupItem>}
                  <ToggleGroupItem value="MAX" className="text-[10px] h-7 px-1.5">MAX</ToggleGroupItem>
                </ToggleGroup>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {viewSource === 'tradingview' ? (
          <div className="h-[440px] w-full p-4">
            <TradingViewPortalCard symbol={symbol} />
          </div>
        ) : (
          <>
            {/* ── Layout: [Left overlay panel] + [Chart area] ── */}
            <div className="flex flex-row h-[500px]">

              {/* Left-side overlay checkboxes */}
              <div className="flex flex-col gap-2 justify-start pt-3 px-2 border-r border-border/40 bg-muted/10 min-w-[76px]"
                   style={{ fontSize: '11px' }}>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide pb-1">Overlays</span>
                {[
                  { id: 'ema',   label: 'EMA',   color: '#6366f1', val: showEMA,   set: setShowEMA,   title: 'EMA 9 / 21 / 50' },
                  { id: 'bb',    label: 'BB',    color: '#a855f7', val: showBB,    set: setShowBB,    title: 'Bollinger Bands (20, 2σ)' },
                  { id: 'vol',   label: 'Volume',color: '#64748b', val: showVolume,set: setShowVolume, title: 'Volume bars' },
                  { id: 'fib',   label: 'Fib',   color: '#f97316', val: showFib,   set: setShowFib,   title: 'Fibonacci Retracement' },
                  { id: 'pivot', label: 'Pivot', color: '#a855f7', val: showPivot, set: setShowPivot, title: 'Pivot Levels (P, R1-3, S1-3)' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-1.5 cursor-pointer select-none group"
                    title={item.title}
                  >
                    <input
                      type="checkbox"
                      checked={item.val}
                      onChange={() => item.set((v) => !v)}
                      className="w-3 h-3 cursor-pointer accent-indigo-500"
                    />
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className="text-[10px] font-medium leading-none"
                      style={{ color: item.val ? item.color : undefined }}
                    >
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Main chart — fills remaining width */}
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 50, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.close} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={COLORS.close} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.922 0 0)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => {
                      const s = String(d)
                      // Intraday format "MM-DD HH:MM" — show just time part
                      if (s.includes(' ')) return s.split(' ')[1] ?? s
                      const dt = new Date(s)
                      if (isNaN(dt.getTime())) return s
                      return `${dt.getDate()}/${dt.getMonth() + 1}`
                    }}
                    tick={{ fontSize: 10 }}
                    minTickGap={30}
                    stroke="oklch(0.556 0 0)"
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10 }}
                    stroke="oklch(0.556 0 0)"
                    tickFormatter={(v) => formatINR(v, { compact: true })}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'oklch(0.985 0 0)',
                      border: '1px solid oklch(0.922 0 0)',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                    labelFormatter={(d) => formatDateLabel(String(d), true)}
                    formatter={(v: number | number[], name: string) => {
                      if (Array.isArray(v)) return [`${formatINR(v[0])} – ${formatINR(v[1])}`, name]
                      return [formatINR(v), name]
                    }}
                  />

                  {/* Bollinger bands (under price) */}
                  {showBB && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="bbUpper"
                        stroke={COLORS.bb}
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        fill="none"
                        name="BB Upper"
                      />
                      <Area
                        type="monotone"
                        dataKey="bbLower"
                        stroke={COLORS.bb}
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        fill="none"
                        name="BB Lower"
                      />
                    </>
                  )}

                  {/* Price: either candlestick or line */}
                  {chartType === 'line' ? (
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke={COLORS.close}
                      strokeWidth={2}
                      fill="url(#priceFill)"
                      name="Close"
                    />
                  ) : (
                    <Bar
                      dataKey="bodyRange"
                      name="Price"
                      shape={<CandlestickShape />}
                      isAnimationActive={false}
                    />
                  )}

                  {/* EMAs */}
                  {showEMA && (
                    <>
                      <Line type="monotone" dataKey="ema9" stroke={COLORS.ema9} strokeWidth={1} dot={false} name="EMA 9" />
                      <Line type="monotone" dataKey="ema21" stroke={COLORS.ema21} strokeWidth={1} dot={false} name="EMA 21" />
                      <Line type="monotone" dataKey="ema50" stroke={COLORS.ema50} strokeWidth={1} dot={false} name="EMA 50" />
                    </>
                  )}

                  {/* Last close reference */}
                  <ReferenceLine y={lastClose} stroke={COLORS.close} strokeDasharray="4 2" />

                  {/* ── Fibonacci Retracement Overlays ─────────────────────
                      Formula (StockCharts verified, uptrend):
                        Level = High − (Range × Ratio)
                      0% = High (top), 100% = Low (bottom)
                      Labels alternate Left/Right by index to prevent overlap.
                      61.8% ★ = Golden Ratio = thickest, most important line.
                  ─────────────────────────────────────────────────────────── */}
                  {showFib && fibLevels && fibLevels.map((fl, idx) => (
                    <ReferenceLine
                      key={fl.label}
                      y={fl.val}
                      stroke={fl.color}
                      strokeDasharray={fl.dash}
                      strokeWidth={fl.label.includes('61.8%') ? 2.5 : fl.label.includes('0%') ? 1 : 1.5}
                      strokeOpacity={fl.label.includes('0%') ? 0.4 : 0.9}
                      label={{
                        value: `${fl.label}  ₹${fl.val.toFixed(0)}`,
                        position: idx % 2 === 0 ? 'insideTopRight' : 'insideTopLeft',
                        offset: 4,
                        fontSize: fl.label.includes('0%') ? 9 : 10,
                        fill: fl.color,
                        fontWeight: fl.label.includes('61.8%') ? 700 : 600,
                      }}
                    />
                  ))}

                  {/* ── Pivot Levels Overlays ───────────────────────────────
                      Source: indicators.pivots (same as Pivot Levels panel)
                      P  = Central Pivot (purple, solid, thickest)
                      R1/R2/R3 = Resistance levels (red shades, right labels)
                      S1/S2/S3 = Support levels    (green shades, left labels)
                  ─────────────────────────────────────────────────────────── */}
                  {showPivot && indicators.pivots && (() => {
                    const pv = indicators.pivots
                    // Alternate label position (top/bottom) for adjacent lines
                    // so they never overlap even when prices are very close.
                    // R-levels: labels on RIGHT, S-levels: labels on LEFT
                    const lines = [
                      { label: 'R3', val: pv.r3,    color: '#be123c', width: 1,   pos: 'insideBottomRight' as const },
                      { label: 'R2', val: pv.r2,    color: '#e11d48', width: 1,   pos: 'insideTopRight'    as const },
                      { label: 'R1', val: pv.r1,    color: '#fb7185', width: 1.5, pos: 'insideBottomRight' as const },
                      { label: 'P',  val: pv.pivot,  color: '#a855f7', width: 2.5, pos: 'insideTopRight'    as const },
                      { label: 'S1', val: pv.s1,    color: '#4ade80', width: 1.5, pos: 'insideBottomLeft'  as const },
                      { label: 'S2', val: pv.s2,    color: '#16a34a', width: 1,   pos: 'insideTopLeft'     as const },
                      { label: 'S3', val: pv.s3,    color: '#14532d', width: 1,   pos: 'insideBottomLeft'  as const },
                    ]
                    return lines.map((pl) => (
                      <ReferenceLine
                        key={pl.label}
                        y={pl.val}
                        stroke={pl.color}
                        strokeDasharray={pl.label === 'P' ? '0' : '5 3'}
                        strokeWidth={pl.width}
                        strokeOpacity={0.85}
                        label={{
                          value: `${pl.label} ₹${pl.val.toFixed(0)}`,
                          position: pl.pos,
                          offset: 3,
                          fontSize: 9,
                          fill: pl.color,
                          fontWeight: pl.label === 'P' ? 700 : 600,
                        }}
                      />
                    ))
                  })()}


                  {/* ── Brush / Zoom navigator ──────────────────────────────
                      Shows ALL candles for the selected range (startIndex=0).
                      User drags handles to zoom into a sub-range.
                      NOTE: Do NOT set startIndex here — it locks the view.
                  ─────────────────────────────────────────────────────────── */}
                  <Brush
                    dataKey="date"
                    height={34}
                    stroke="#6366f1"
                    fill="rgba(99,102,241,0.05)"
                    travellerWidth={8}
                    tickFormatter={(v) => formatDateLabel(String(v))}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>{/* end flex-1 chart */}
          </div>{/* end flex-row */}

            {/* Volume strip */}
            {showVolume && (
              <div className="h-[80px] w-full mt-1 pl-[76px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={false}
                      height={0}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'oklch(0.985 0 0)',
                        border: '1px solid oklch(0.922 0 0)',
                        borderRadius: '6px',
                        fontSize: '11px',
                      }}
                      formatter={(v: number) => [`${(v / 1e6).toFixed(2)}M shares`, 'Volume']}
                      labelFormatter={(d) => formatDateLabel(String(d))}
                    />
                    {/* Color volume bars by candle direction (green=up day, red=down day) */}
                    <Bar dataKey="volume" opacity={0.7} name="Volume">
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.isBullish ? COLORS.bullishCandle : COLORS.bearishCandle} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Legend (P2-6: already existed, now made clearer with color dots and includes Volume + Candle) */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              {chartType === 'candle' ? (
                <>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: COLORS.bullishCandle }} /> Bullish candle
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: COLORS.bearishCandle }} /> Bearish candle
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5" style={{ backgroundColor: COLORS.close }} /> Close
                </span>
              )}
              {showEMA && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5" style={{ backgroundColor: COLORS.ema9 }} /> EMA 9
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5" style={{ backgroundColor: COLORS.ema21 }} /> EMA 21
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5" style={{ backgroundColor: COLORS.ema50 }} /> EMA 50
                  </span>
                </>
              )}
              {showBB && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: COLORS.bb }} /> Bollinger (20,2)
                </span>
              )}
              {showVolume && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: COLORS.volume, opacity: 0.7 }} /> Volume
                </span>
              )}
              {showFib && fibLevels && fibLevels.map((fl) => (
                <span key={fl.label} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5" style={{ borderTop: `2px dashed ${fl.color}` }} />
                  <span style={{ color: fl.color }}>{fl.label}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// --- Local lightweight EMA / Bollinger for the visible chart window ---------
function computeEMA(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (values.length === 0) return out
  const k = 2 / (period + 1)
  let prev = NaN
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i === period - 1) {
      prev = sum / period
      out[i] = prev
    } else if (i >= period) {
      prev = values[i] * k + prev * (1 - k)
      out[i] = prev
    }
  }
  return out
}

function computeBollinger(values: number[], period: number, mult: number) {
  const n = values.length
  const middle: number[] = new Array(n).fill(NaN)
  const upper: number[] = new Array(n).fill(NaN)
  const lower: number[] = new Array(n).fill(NaN)
  for (let i = period - 1; i < n; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += values[j]
    const m = sum / period
    let varSum = 0
    for (let j = i - period + 1; j <= i; j++) varSum += (values[j] - m) ** 2
    const sd = Math.sqrt(varSum / period)
    middle[i] = m
    upper[i] = m + mult * sd
    lower[i] = m - mult * sd
  }
  return { middle, upper, lower }
}

// --- TradingView Portal Redirect Component ----------------------------------
function TradingViewPortalCard({ symbol }: { symbol: string }) {
  const baseSymbol = symbol.toUpperCase().replace('.NS', '').trim()
  const mapped = TV_MAPPINGS[baseSymbol] || baseSymbol.replace(/[&\-]/g, '_')
  
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[380px] p-6 text-center bg-indigo-50/5 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/40 dark:border-indigo-950/40 shadow-inner">
      <div className="p-4 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full mb-6 text-indigo-500">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      </div>
      
      <h3 className="text-md font-bold text-foreground mb-2">Interactive TradingView Terminal</h3>
      
      <p className="text-[11px] text-muted-foreground max-w-sm mb-6 leading-relaxed">
        NSE licensing guidelines restrict embedding live interactive charts for individual equities on third-party websites. 
        Access the full charting terminal with support for technical indicators directly on TradingView.
      </p>

      <a
        href={`https://www.tradingview.com/symbols/NSE-${mapped}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 gap-2 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] border border-indigo-500"
      >
        <span>Open {baseSymbol} Chart on TradingView</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  )
}
