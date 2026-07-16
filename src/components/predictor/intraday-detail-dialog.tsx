'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Bar, BarChart,
} from 'recharts'
import { TrendingUp, TrendingDown, Activity, Gauge } from 'lucide-react'
import { formatINR, formatPct } from './types'
import type { IntradayAnalysis } from './intraday-types'

interface Props {
  symbol: string | null
  onClose: () => void
}

export function IntradayDetailDialog({ symbol, onClose }: Props) {
  const [data, setData] = useState<IntradayAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await fetch(`/api/intraday/${encodeURIComponent(symbol)}`, { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d: IntradayAnalysis = await r.json()
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [symbol])

  const chartData = data?.todayCandles.map((c, i) => {
    // Compute running VWAP up to this candle
    let pv = 0
    let v = 0
    for (let j = 0; j <= i; j++) {
      const typical = (data.todayCandles[j].high + data.todayCandles[j].low + data.todayCandles[j].close) / 3
      pv += typical * data.todayCandles[j].volume
      v += data.todayCandles[j].volume
    }
    const runningVwap = v > 0 ? pv / v : c.close
    return {
      time: c.time,
      close: c.close,
      volume: c.volume,
      vwap: +runningVwap.toFixed(2),
    }
  }) ?? []

  return (
    <Dialog open={symbol !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
            {data?.symbol ?? symbol}
            {data && <Badge variant="secondary" className="text-[10px]">{data.sector}</Badge>}
            {data && (
              <Badge
                variant="outline"
                className={`text-[9px] font-mono ${
                  data.action === 'BUY_NOW'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : data.action === 'SELL_WATCH'
                    ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300 dark:border-red-800'
                    : data.action === 'WAIT_BREAKOUT'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {data.action.replace('_', ' ')} — Intraday
              </Badge>
            )}
            {data && <span className="text-sm font-normal text-muted-foreground">{data.name}</span>}
          </DialogTitle>
          <DialogDescription className="sr-only">Intraday analysis for {symbol}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-[280px] w-full" />
          </div>
        )}
        {err && !loading && (
          <div className="p-8 text-center text-sm text-red-600 dark:text-red-400">{err}</div>
        )}
        {data && !loading && (
          <ScrollArea className="max-h-[calc(92vh-60px)]">
            <div className="p-4 space-y-3">
              {/* Top stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <Card><CardContent className="p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">LTP</div>
                  <div className="font-bold tabular-nums">{formatINR(data.ltp)}</div>
                </CardContent></Card>
                <Card><CardContent className="p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Change</div>
                  <div className={`font-bold tabular-nums ${data.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatPct(data.changePct)}
                  </div>
                </CardContent></Card>
                <Card><CardContent className="p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">VWAP</div>
                  <div className="font-bold tabular-nums">{formatINR(data.vwap)}</div>
                  <div className="text-[10px] text-muted-foreground">{data.vwapPosition}</div>
                </CardContent></Card>
                <Card><CardContent className="p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">ORB Range</div>
                  <div className="font-bold tabular-nums text-[11px]">
                    {formatINR(data.orLow, { compact: true })} – {formatINR(data.orHigh, { compact: true })}
                  </div>
                </CardContent></Card>
                <Card><CardContent className="p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Day Range</div>
                  <div className="font-bold tabular-nums text-[11px]">
                    {formatINR(data.dayLow, { compact: true })} – {formatINR(data.dayHigh, { compact: true })}
                  </div>
                </CardContent></Card>
              </div>

              {/* Today's intraday chart with VWAP overlay */}
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5" /> Today's intraday (5-min candles + VWAP)
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="intradayPriceFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="oklch(0.646 0.222 41.116)" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="oklch(0.646 0.222 41.116)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.922 0 0)" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="oklch(0.556 0 0)" minTickGap={30} />
                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} stroke="oklch(0.556 0 0)" tickFormatter={(v) => formatINR(v, { compact: true })} width={60} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'oklch(0.985 0 0)', border: '1px solid oklch(0.922 0 0)', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(v: number, name: string) => [formatINR(v), name === 'close' ? 'Close' : 'VWAP']}
                        />
                        <Area type="monotone" dataKey="close" stroke="oklch(0.646 0.222 41.116)" strokeWidth={2} fill="url(#intradayPriceFill)" name="Close" />
                        <Line type="monotone" dataKey="vwap" stroke="oklch(0.488 0.243 264.376)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="VWAP" />
                        {/* ORB high/low reference lines */}
                        <ReferenceLine y={data.orHigh} stroke="oklch(0.769 0.188 70.08)" strokeDasharray="2 2" />
                        <ReferenceLine y={data.orLow} stroke="oklch(0.704 0.191 22.216)" strokeDasharray="2 2" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[oklch(0.646_0.222_41.116)]" /> Close</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[oklch(0.488_0.243_264.376)] border-dashed" /> VWAP</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[oklch(0.769_0.188_70.08)]" /> ORB High</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[oklch(0.704_0.191_22.216)]" /> ORB Low</span>
                  </div>
                </CardContent>
              </Card>

              {/* Reasoning */}
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs font-semibold flex items-center gap-2">
                    <Gauge className="h-3.5 w-3.5" /> Intraday signal analysis
                  </div>
                  <div className="text-xs">{data.reason}</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] pt-2 border-t border-border/40">
                    <div><span className="text-muted-foreground">Momentum (today):</span> <span className={`tabular-nums font-medium ${data.momentumPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatPct(data.momentumPct)}</span></div>
                    <div><span className="text-muted-foreground">Last 15 min:</span> <span className={`tabular-nums font-medium ${data.recentMomentum >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatPct(data.recentMomentum)}</span></div>
                    <div><span className="text-muted-foreground">EMA9 vs EMA21:</span> <span className={`tabular-nums font-medium ${data.ema9 > data.ema21 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{data.ema9 > data.ema21 ? 'Bullish' : 'Bearish'}</span></div>
                    <div><span className="text-muted-foreground">VWAP position:</span> <span className={`font-medium ${data.vwapPosition === 'above' ? 'text-emerald-600 dark:text-emerald-400' : data.vwapPosition === 'below' ? 'text-red-600 dark:text-red-400' : ''}`}>{data.vwapPosition}</span></div>
                    <div><span className="text-muted-foreground">ORB status:</span> <span className={`font-medium ${data.orbStatus === 'breakout_up' ? 'text-emerald-600 dark:text-emerald-400' : data.orbStatus === 'breakout_down' ? 'text-red-600 dark:text-red-400' : ''}`}>{data.orbStatus.replace('_', ' ')}</span></div>
                    <div><span className="text-muted-foreground">Day volume:</span> <span className="tabular-nums">{(data.dayVolume / 1e6).toFixed(2)}M</span></div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-[10px] text-muted-foreground">
                Data from Yahoo Finance, ~15-min delayed during market hours. As of {new Date(data.asOf).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
