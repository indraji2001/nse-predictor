'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp, TrendingDown, Minus, Target, ShieldAlert, Clock, Activity,
} from 'lucide-react'
import { StockDetail, Timeframe, formatINR, formatPct, confidenceColor, actionBadge, TIMEFRAME_LABELS, dataSourceBadge } from './types'
import { StockChart } from '@/components/charts/stock-chart'
import { IndicatorPanel } from './indicator-panel'

interface Props {
  symbol: string | null
  onClose: () => void
}

interface LoadState {
  symbol: string
  data: StockDetail | null
  err: string | null
}

export function StockDetailDialog({ symbol, onClose }: Props) {
  // LoadState is keyed by the requested symbol — when `symbol` changes, the
  // previous LoadState is stale and we treat it as "loading" until the new
  // fetch resolves. This avoids calling setState synchronously inside the
  // effect body (which Next.js 16 disallows).
  const [state, setState] = useState<LoadState | null>(null)

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/stock/${encodeURIComponent(symbol)}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d: StockDetail = await r.json()
        if (!cancelled) setState({ symbol, data: d, err: null })
      } catch (e) {
        if (!cancelled) setState({ symbol, data: null, err: e instanceof Error ? e.message : 'Failed to load' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [symbol])

  // Derive loading & data: we're "loading" if symbol is set but the current
  // LoadState doesn't match (or doesn't exist yet).
  const data = state?.symbol === symbol ? state.data : null
  const err = state?.symbol === symbol ? state.err : null
  const loading = symbol !== null && !data && !err

  return (
    <Dialog open={symbol !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
            {data?.symbol ?? symbol}
            {data && <Badge variant="secondary" className="text-[10px]">{data.sector}</Badge>}
            {data?.dataSource && (() => {
              const ds = dataSourceBadge(data.dataSource)
              return (
                <Badge
                  variant="outline"
                  className={`text-[9px] font-mono ${ds.className}`}
                  title={ds.title}
                >
                  {ds.label}{data.dataSource === 'NSE' ? ' — NSE Bhavcopy' : data.dataSource === 'YAHOO' ? ' — Yahoo Finance' : ' — synthetic data'}
                </Badge>
              )
            })()}
            {data && (
              <span className="text-sm font-normal text-muted-foreground">{data.name}</span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed technical analysis for {symbol}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {err && !loading && (
          <div className="p-8 text-center text-sm text-red-600 dark:text-red-400">{err}</div>
        )}
        {data && !loading && (
          <ScrollArea className="max-h-[calc(92vh-60px)]">
            <div className="p-4 space-y-4">
              {/* Price header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold tabular-nums">{formatINR(data.indicators.price)}</span>
                  <span className={`text-sm tabular-nums ${data.indicators.ret5d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatPct(data.indicators.ret5d)} (5d) · {formatPct(data.indicators.ret20d)} (20d) · {formatPct(data.indicators.ret50d)} (50d)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Dist. from 200 EMA:</span>
                  <span className={`tabular-nums font-medium ${data.indicators.distFrom200 >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatPct(data.indicators.distFrom200)}
                  </span>
                </div>
              </div>

              {/* Chart */}
              <StockChart candles={data.candles} indicators={data.indicators} />

              {/* Signals across all 4 timeframes */}
              <Tabs defaultValue="BTST" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  {(['BTST', 'SHORT_TERM', 'MIDTERM', 'LONG_TERM'] as Timeframe[]).map((tf) => (
                    <TabsTrigger key={tf} value={tf} className="text-xs">
                      {TIMEFRAME_LABELS[tf]}
                      <Badge
                        variant="outline"
                        className={`ml-1.5 text-[9px] ${actionBadge(data.signals[tf].action)}`}
                      >
                        {data.signals[tf].action}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {(['BTST', 'SHORT_TERM', 'MIDTERM', 'LONG_TERM'] as Timeframe[]).map((tf) => {
                  const sig = data.signals[tf]
                  return (
                    <TabsContent key={tf} value={tf} className="space-y-3 mt-2">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div className="rounded border border-border/60 p-2">
                          <div className="text-[10px] uppercase text-muted-foreground">Action</div>
                          <div className={`font-bold ${sig.action === 'BUY' ? 'text-emerald-600 dark:text-emerald-400' : sig.action === 'SELL' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {sig.action}
                          </div>
                        </div>
                        <div className="rounded border border-border/60 p-2">
                          <div className="text-[10px] uppercase text-muted-foreground">Confidence</div>
                          <div className={`font-bold tabular-nums ${confidenceColor(sig.confidence)}`}>{sig.confidence}/100</div>
                        </div>
                        <div className="rounded border border-border/60 p-2">
                          <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Target className="h-2.5 w-2.5" /> Entry</div>
                          <div className="font-bold tabular-nums">{formatINR(sig.entry)}</div>
                        </div>
                        <div className="rounded border border-border/60 p-2">
                          <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><ShieldAlert className="h-2.5 w-2.5" /> Stop</div>
                          <div className="font-bold tabular-nums text-red-600 dark:text-red-400">{formatINR(sig.stopLoss)}</div>
                        </div>
                        <div className="rounded border border-border/60 p-2">
                          <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Target className="h-2.5 w-2.5" /> T1 / T2 / T3</div>
                          <div className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400 text-[11px]">
                            {formatINR(sig.target1, { compact: true })} / {formatINR(sig.target2, { compact: true })} / {formatINR(sig.target3, { compact: true })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {sig.holdingPeriod}
                        <Separator orientation="vertical" className="h-3" />
                        <span>RR 1:{(sig.riskReward ?? 0).toFixed(1)}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Factor breakdown
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {sig.factors.map((f, i) => (
                            <div
                              key={i}
                              className={`flex items-start gap-2 p-2 rounded border text-xs ${
                                f.direction === 'bullish' && f.hit
                                  ? 'border-emerald-300/50 bg-emerald-50/50 dark:bg-emerald-950/20'
                                  : f.direction === 'bearish'
                                  ? 'border-red-300/50 bg-red-50/50 dark:bg-red-950/20'
                                  : 'border-border/60 bg-muted/30'
                              }`}
                            >
                              {f.direction === 'bullish' && f.hit ? (
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              ) : f.direction === 'bearish' ? (
                                <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                              ) : (
                                <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{f.name}</span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    ×{(f.weight ?? 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground">{f.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  )
                })}
              </Tabs>

              {/* Full indicator snapshot */}
              <Separator />
              <IndicatorPanel ind={data.indicators} />
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
