'use client'

import { useMemo, useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Bar, BarChart, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Candle, IndicatorSnapshot, formatINR } from '@/components/predictor/types'

interface Props {
  candles: Candle[]
  indicators: IndicatorSnapshot
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

export function StockChart({ candles, indicators }: Props) {
  const [showEMA, setShowEMA] = useState(true)
  const [showBB, setShowBB] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle') // P3-14: candlestick option
  const [range, setRange] = useState<'1M' | '3M' | '6M'>('3M')

  // Slice based on range
  const data = useMemo(() => {
    const n = candles.length
    const take = range === '1M' ? 22 : range === '3M' ? 66 : 132
    return candles.slice(Math.max(0, n - take)).map((c) => ({
      date: c.date,
      close: c.close,
      open: c.open,
      high: c.high,
      low: c.low,
      volume: c.volume,
      // candle body color: green if close >= open, red otherwise
      candleColor: c.close >= c.open ? COLORS.bullishCandle : COLORS.bearishCandle,
      // For candle rendering: body height and wick range
      bodyBase: Math.min(c.open, c.close),
      bodyHeight: Math.abs(c.close - c.open),
      wickLow: c.low,
      wickHigh: c.high,
      isBullish: c.close >= c.open,
    }))
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
    // For Bollinger Band shaded area (need single value for Area with range)
    bbRange: bbSeries.upper[i] != null && bbSeries.lower[i] != null
      ? [bbSeries.lower[i], bbSeries.upper[i]] as [number, number]
      : null,
  }))

  const lastClose = candles[candles.length - 1].close

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Price chart</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* P3-14: Chart type toggle (Line vs Candlestick) */}
            <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v as 'line' | 'candle')} size="sm">
              <ToggleGroupItem value="candle" className="text-[10px] h-7 px-2" title="Candlestick chart">Candle</ToggleGroupItem>
              <ToggleGroupItem value="line" className="text-[10px] h-7 px-2" title="Line chart">Line</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as '1M' | '3M' | '6M')} size="sm">
              <ToggleGroupItem value="1M" className="text-[10px] h-7 px-2">1M</ToggleGroupItem>
              <ToggleGroupItem value="3M" className="text-[10px] h-7 px-2">3M</ToggleGroupItem>
              <ToggleGroupItem value="6M" className="text-[10px] h-7 px-2">6M</ToggleGroupItem>
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
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Main chart — increased height (P2-8 fix: was 300px, now 340px to use space better) */}
        <div className="h-[340px] w-full">
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
                <>
                  {/* Candlestick: wicks (high-low) as thin lines, bodies (open-close) as bars */}
                  {/* Wicks: rendered as a thin bar from low to high, transparent fill */}
                  <Bar
                    dataKey="wickHigh"
                    fill="transparent"
                    stackId="candle"
                    name=""
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="bodyHeight"
                    name="Body"
                    stackId="candle"
                    isAnimationActive={false}
                  >
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.candleColor} />
                    ))}
                  </Bar>
                  {/* Hide the wick trick — actually use Line for wicks since Bar can't do ranges easily */}
                </>
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
        </div>
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
