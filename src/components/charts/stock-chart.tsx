'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Bar, BarChart, Cell,
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

export function StockChart({ candles, indicators, symbol }: Props) {
  const [showEMA, setShowEMA] = useState(true)
  const [showBB, setShowBB] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const [showFib, setShowFib] = useState(false)  // Fibonacci retracement overlay
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle')
  const [range, setRange] = useState<'1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y' | '10Y'>('3M')
  const [viewSource, setViewSource] = useState<'custom' | 'tradingview'>('custom')

  const baseSymbol = symbol.toUpperCase().replace('.NS', '').trim()
  const mappedSymbol = TV_MAPPINGS[baseSymbol] || baseSymbol.replace(/[&\-]/g, '_')

  // Slice based on range
  const data = useMemo(() => {
    const n = candles.length
    let take = 66
    switch (range) {
      case '1M': take = 22; break
      case '3M': take = 66; break
      case '6M': take = 132; break
      case '1Y': take = 250; break
      case '2Y': take = 500; break
      case '3Y': take = 750; break
      case '5Y': take = 1250; break
      case '10Y': take = 2500; break
      default: take = 66; break
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
  }, [candles, range])

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

  // Fibonacci Retracement — standard uptrend convention (draw from LOW → HIGH):
  //   0%   = Swing Low  (bottom)
  //   100% = Swing High (top)
  // Retracement levels mark potential SUPPORT during pullback:
  //   78.6% level = low + 0.786 × range  → near the HIGH  (shallow pullback support)
  //   61.8% level = low + 0.618 × range  → golden ratio    (KEY support, most important)
  //   50.0% level = low + 0.500 × range  → mid-point
  //   38.2% level = low + 0.382 × range  → moderate support
  //   23.6% level = low + 0.236 × range  → near the LOW   (deep retracement)
  // This matches TradingView's default Fibonacci tool for bullish setups.
  const fibLevels = useMemo(() => {
    let high = -Infinity, low = Infinity
    for (const d of data) { if (d.high > high) high = d.high; if (d.low < low) low = d.low }
    if (high === -Infinity || high === low) return null
    const diff = high - low
    return [
      { label: '78.6%', val: +(low + 0.786 * diff).toFixed(2), color: '#f43f5e' },   // rose   — near HIGH
      { label: '61.8%', val: +(low + 0.618 * diff).toFixed(2), color: '#f97316' },   // orange — golden ratio KEY
      { label: '50.0%', val: +(low + 0.500 * diff).toFixed(2), color: '#eab308' },   // yellow — midpoint
      { label: '38.2%', val: +(low + 0.382 * diff).toFixed(2), color: '#22c55e' },   // green
      { label: '23.6%', val: +(low + 0.236 * diff).toFixed(2), color: '#3b82f6' },   // blue   — near LOW
    ]
  }, [data])

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
                {/* P3-14: Chart type toggle (Line vs Candlestick) */}
                <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v as 'line' | 'candle')} size="sm">
                  <ToggleGroupItem value="candle" className="text-[10px] h-7 px-2" title="Candlestick chart">Candle</ToggleGroupItem>
                  <ToggleGroupItem value="line" className="text-[10px] h-7 px-2" title="Line chart">Line</ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as any)} size="sm">
                  <ToggleGroupItem value="1M" className="text-[10px] h-7 px-2">1M</ToggleGroupItem>
                  <ToggleGroupItem value="3M" className="text-[10px] h-7 px-2">3M</ToggleGroupItem>
                  <ToggleGroupItem value="6M" className="text-[10px] h-7 px-2">6M</ToggleGroupItem>
                  <ToggleGroupItem value="1Y" className="text-[10px] h-7 px-2">1Y</ToggleGroupItem>
                  {candles.length > 280 && (
                    <ToggleGroupItem value="2Y" className="text-[10px] h-7 px-2">2Y</ToggleGroupItem>
                  )}
                  {candles.length > 530 && (
                    <ToggleGroupItem value="3Y" className="text-[10px] h-7 px-2">3Y</ToggleGroupItem>
                  )}
                  {candles.length > 800 && (
                    <ToggleGroupItem value="5Y" className="text-[10px] h-7 px-2">5Y</ToggleGroupItem>
                  )}
                  {candles.length > 1500 && (
                    <ToggleGroupItem value="10Y" className="text-[10px] h-7 px-2">10Y</ToggleGroupItem>
                  )}
                </ToggleGroup>
                <ToggleGroup type="multiple" size="sm">
                  <ToggleGroupItem
                    value="ema"
                    data-state={showEMA ? 'on' : 'off'}
                    onClick={() => setShowEMA((v) => !v)}
                    className="text-[10px] h-7 px-2"
                    title="Exponential Moving Averages (9, 21, 50)"
                  >
                    EMA
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="bb"
                    data-state={showBB ? 'on' : 'off'}
                    onClick={() => setShowBB((v) => !v)}
                    className="text-[10px] h-7 px-2"
                    title="Bollinger Bands (20, 2σ)"
                  >
                    BB
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="vol"
                    data-state={showVolume ? 'on' : 'off'}
                    onClick={() => setShowVolume((v) => !v)}
                    className="text-[10px] h-7 px-2"
                    title="Volume bars"
                  >
                    Vol
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="fib"
                    data-state={showFib ? 'on' : 'off'}
                    onClick={() => setShowFib((v) => !v)}
                    className="text-[10px] h-7 px-2"
                    title="Fibonacci Retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%) of visible range"
                    style={showFib ? { color: '#f97316', fontWeight: 700 } : {}}
                  >
                    Fib
                  </ToggleGroupItem>
                </ToggleGroup>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewSource === 'tradingview' ? (
          <div className="h-[440px] w-full">
            <TradingViewPortalCard symbol={symbol} />
          </div>
        ) : (
          <>
            {/* Main chart — tall to fill the enlarged dialog */}
            <div className="h-[460px] w-full">
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
                      const dt = new Date(d)
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
                    labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                      Labels alternate Left/Right by index so they NEVER overlap:
                        78.6% → Right   (index 0)
                        61.8% → Left    (index 1, golden ratio — most important)
                        50.0% → Right   (index 2)
                        38.2% → Left    (index 3)
                        23.6% → Right   (index 4)
                  ─────────────────────────────────────────────────────────── */}
                  {showFib && fibLevels && fibLevels.map((fl, idx) => (
                    <ReferenceLine
                      key={fl.label}
                      y={fl.val}
                      stroke={fl.color}
                      strokeDasharray={fl.label === '61.8%' ? '8 3' : '5 3'}
                      strokeWidth={fl.label === '61.8%' ? 2 : 1.5}
                      strokeOpacity={0.9}
                      label={{
                        value: `${fl.label}  ₹${fl.val.toFixed(0)}`,
                        position: idx % 2 === 0 ? 'insideTopRight' : 'insideTopLeft',
                        offset: 4,
                        fontSize: 10,
                        fill: fl.color,
                        fontWeight: fl.label === '61.8%' ? 700 : 600,
                      }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Volume strip — increased height (P2-9 fix: was 80px, now 100px) */}
            {showVolume && (
              <div className="h-[100px] w-full mt-2">
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
                      labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
