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
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp, TrendingDown, Minus, Target, ShieldAlert, Clock, Activity, Newspaper, ExternalLink, Database,
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
  // effect body (which Next.js 16 disallows)
  const [state, setState] = useState<LoadState | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('DEFAULT')
  const [selectedRange, setSelectedRange] = useState<string>('1y')
  const [upstoxConfigured, setUpstoxConfigured] = useState(false)

  // Load default settings from localStorage on dialog mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = localStorage.getItem('selectedProvider') || 'DEFAULT'
      const r = localStorage.getItem('selectedRange') || '1y'
      setSelectedProvider(p)
      setSelectedRange(r)
    }
  }, [symbol])

  // Check Upstox status dynamically
  useEffect(() => {
    if (!symbol) return
    fetch('/api/upstox/status', { cache: 'no-store' })
      .then(res => res.json())
      .then((data: { configured: boolean; connected: boolean }) => {
        setUpstoxConfigured(data.configured && data.connected)
      })
      .catch(() => {})
  }, [symbol])

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (selectedProvider && selectedProvider !== 'DEFAULT') {
          params.set('provider', selectedProvider)
        }
        params.set('range', selectedRange)

        const r = await fetch(`/api/stock/${encodeURIComponent(symbol)}?${params.toString()}`)
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
  }, [symbol, selectedProvider, selectedRange])

  const handleProviderChange = (p: string) => {
    setSelectedProvider(p)
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedProvider', p)
      // Reset range if switching away from Upstox and it was set to 10y
      if (p !== 'UPSTOX' && selectedRange === '10y') {
        setSelectedRange('1y')
        localStorage.setItem('selectedRange', '1y')
      }
    }
  }

  const handleRangeChange = (r: string) => {
    setSelectedRange(r)
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedRange', r)
    }
  }

  // Derive loading & data: we're "loading" if symbol is set but the current
  // LoadState doesn't match (or doesn't exist yet).
  const data = state?.symbol === symbol ? state.data : null
  const err = state?.symbol === symbol ? state.err : null
  const loading = symbol !== null && !data && !err

  return (
    <Dialog open={symbol !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="overflow-auto p-0 gap-0"
        style={{
          width: 'calc(100vw - 48px)',
          height: 'calc(100vh - 48px)',
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          minWidth: '520px',
          minHeight: '440px',
          resize: 'both',
        }}
      >
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
              </div>

              {/* Active data feed indicator */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-muted/10 text-xs flex-wrap" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                  <Database size={14} className="text-violet-500" />
                  <span>Globally Active Data Feed:</span>
                </div>
                <div className="flex items-center gap-2 font-mono font-bold text-foreground">
                  <Badge variant="outline" className={`text-[10px] uppercase ${
                    selectedProvider === 'UPSTOX' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-300 dark:border-violet-800' :
                    selectedProvider === 'NSE' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800' :
                    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  }`}>
                    {selectedProvider === 'DEFAULT' ? 'Auto Priority' : selectedProvider === 'YAHOO' ? 'Yahoo Finance' : selectedProvider}
                  </Badge>
                  <span className="text-muted-foreground font-normal">@</span>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedProvider === 'NSE' ? 'ALL LOCAL' : selectedRange.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <StockChart candles={data.candles} indicators={data.indicators} symbol={data.symbol} />

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
                  // P3-13: Generate a plain-English "Why this signal?" summary
                  const bullFactors = sig.factors.filter((f) => f.hit && f.direction === 'bullish')
                  const bearFactors = sig.factors.filter((f) => f.direction === 'bearish')
                  const totalWeight = sig.factors.reduce((s, f) => s + (f.weight || 0), 0)
                  const bullWeight = bullFactors.reduce((s, f) => s + (f.weight || 0), 0)
                  const strengthPct = totalWeight > 0 ? Math.round((bullWeight / totalWeight) * 100) : 0
                  const whySummary = sig.action === 'BUY'
                    ? `${bullFactors.length} of ${sig.factors.length} factors triggered (${strengthPct}% weight). Key drivers: ${bullFactors.slice(0, 3).map((f) => f.name.split('(')[0].split('(')[0].trim().toLowerCase()).join(', ')}.`
                    : sig.action === 'SELL'
                    ? `${bearFactors.length} bearish factors detected. Weakness in: ${bearFactors.slice(0, 3).map((f) => f.name.split('(')[0].trim().toLowerCase()).join(', ')}.`
                    : `Only ${bullFactors.length} of ${sig.factors.length} factors triggered (${strengthPct}% weight) — not enough conviction for a BUY. Needs ${Math.max(0, 5 - bullFactors.length)} more bullish confirmations.`

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

                      {/* P3-13: "Why this signal?" plain-English summary */}
                      <div className={`text-xs rounded p-2.5 border ${
                        sig.action === 'BUY'
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300/50 text-emerald-900 dark:text-emerald-200'
                          : sig.action === 'SELL'
                          ? 'bg-red-50/60 dark:bg-red-950/20 border-red-300/50 text-red-900 dark:text-red-200'
                          : 'bg-muted/40 border-border/60 text-muted-foreground'
                      }`}>
                        <div className="font-semibold mb-1 flex items-center gap-1.5">
                          <Activity className="h-3 w-3" /> Why this signal?
                        </div>
                        <div className="leading-relaxed">{whySummary}</div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {sig.holdingPeriod}
                        <Separator orientation="vertical" className="h-3" />
                        <span>RR 1:{(sig.riskReward ?? 0).toFixed(1)}</span>
                        <Separator orientation="vertical" className="h-3" />
                        <span>{bullFactors.length} bull / {bearFactors.length} bear</span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-between gap-1">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" /> Factor breakdown
                          </span>
                          <span className="text-[9px]">weight × hit/miss</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {sig.factors.map((f, i) => (
                            <div
                              key={i}
                              className={`flex items-start gap-2 p-2 rounded border text-xs ${
                                f.direction === 'bullish' && f.hit
                                  ? 'border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/25'
                                  : f.direction === 'bearish'
                                  ? 'border-red-300/60 bg-red-50/60 dark:bg-red-950/25'
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
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{f.name}</span>
                                  {/* P2-7: Make weight + hit/miss status more prominent */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className={`text-[9px] px-1 py-0.5 rounded tabular-nums font-mono ${
                                      f.hit && f.direction === 'bullish'
                                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                        : f.direction === 'bearish'
                                        ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                        : 'bg-muted text-muted-foreground'
                                    }`}>
                                      {f.hit ? '✓ HIT' : '✗ MISS'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums font-mono">
                                      ×{(f.weight ?? 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">{f.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  )
                })}
              </Tabs>

              {/* Broker Recommendations & Targets */}
              {(() => {
                const anySignal = Object.values(data.signals)[0]
                const targetPrice = anySignal?.targetPrice
                const recommendation = anySignal?.recommendation
                const recommendationMean = anySignal?.recommendationMean
                const analystsCount = anySignal?.analystsCount
                
                if (!targetPrice) {
                  return (
                    <div className="rounded-lg border border-border/50 bg-slate-50/25 dark:bg-slate-900/10 p-3 text-center">
                      <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        No active analyst ratings or broker price targets available for this symbol on Yahoo Finance.
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/15 dark:bg-indigo-950/5 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-indigo-100/50 dark:border-indigo-900/30 pb-2">
                      <div>
                        <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                          <Target className="h-4 w-4 text-indigo-500" />
                          Broker Analyst Consensus
                        </h3>
                        <p className="text-[10px] text-muted-foreground">Overall consensus targets. Scroll down to the News panel to read specific broker reports & reasons.</p>
                      </div>
                      {analystsCount && (
                        <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900">
                          Based on {analystsCount} analyst opinions
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-muted-foreground font-semibold">Average Analyst Target</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{formatINR(targetPrice)}</span>
                          {(() => {
                            const premium = ((targetPrice - data.indicators.price) / data.indicators.price) * 100
                            const isPos = premium >= 0
                            return (
                              <span className={`text-xs font-bold font-mono ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {isPos ? '+' : ''}{premium.toFixed(1)}%
                              </span>
                            )
                          })()}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-muted-foreground font-semibold">Consensus Recommendation</div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold capitalize text-slate-800 dark:text-slate-200">{recommendation || '—'}</span>
                          {recommendationMean && (
                            <span className="text-xs text-muted-foreground font-mono">({recommendationMean.toFixed(2)} score)</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] uppercase text-muted-foreground font-semibold">Consensus Score Meter</div>
                        {recommendationMean ? (
                          <div className="space-y-1">
                            <Progress 
                              value={((5 - recommendationMean) / 4) * 100} 
                              className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-indigo-500" 
                            />
                            <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                              <span>Sell (5.0)</span>
                              <span>Hold (3.0)</span>
                              <span>Buy (1.0)</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-muted-foreground">No rating score</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* TradingView Technical Consensus Radar */}
              {data.tradingViewConsensus && (
                <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/15 dark:bg-indigo-950/5 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-100/50 dark:border-indigo-900/30 pb-2">
                    <div>
                      <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-indigo-500" />
                        TradingView Technical Rating Radar
                      </h3>
                      <p className="text-[10px] text-muted-foreground">Aggregated oscillator and moving average consensus scores from TradingView</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] font-bold ${
                      data.tradingViewConsensus.summaryScore >= 0.5
                        ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                        : data.tradingViewConsensus.summaryScore >= 0.1
                        ? 'text-emerald-600 bg-emerald-50/50 dark:text-emerald-400 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50'
                        : data.tradingViewConsensus.summaryScore <= -0.5
                        ? 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                        : data.tradingViewConsensus.summaryScore <= -0.1
                        ? 'text-rose-600 bg-rose-50/50 dark:text-rose-400 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/50'
                        : 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900'
                    }`}>
                      {data.tradingViewConsensus.summary}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Oscillators Consensus</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>{data.tradingViewConsensus.oscRating}</span>
                        <span className="text-[10px] text-muted-foreground font-mono font-normal">({data.tradingViewConsensus.oscScore.toFixed(2)})</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Moving Averages Consensus</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>{data.tradingViewConsensus.maRating}</span>
                        <span className="text-[10px] text-muted-foreground font-mono font-normal">({data.tradingViewConsensus.maScore.toFixed(2)})</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Consensus Score Gauge</div>
                      <div className="space-y-1">
                        <Progress 
                          value={((data.tradingViewConsensus.summaryScore + 1) / 2) * 100} 
                          className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-indigo-500" 
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                          <span>Sell (-1.0)</span>
                          <span>Neutral (0.0)</span>
                          <span>Buy (+1.0)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Yahoo & Google News Sentiment Buzz Feed */}
              {data.news && data.news.length > 0 ? (
                (() => {
                  const positiveCount = data.news.filter(n => n.sentiment === 'positive').length
                  const negativeCount = data.news.filter(n => n.sentiment === 'negative').length
                  
                  let sentimentLabel = 'Neutral Buzz'
                  let sentimentColor = 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                  
                  if (positiveCount > negativeCount) {
                    sentimentLabel = 'Bullish News Buzz'
                    sentimentColor = 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                  } else if (negativeCount > positiveCount) {
                    sentimentLabel = 'Bearish News Buzz'
                    sentimentColor = 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                  }

                  return (
                    <div className="rounded-lg border border-border/60 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <div>
                          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Newspaper className="h-4 w-4 text-slate-500" />
                            Live Yahoo & Google News Sentiment
                          </h3>
                          <p className="text-[10px] text-muted-foreground">Aggregated news headlines analyzed by our custom sentiment engine</p>
                        </div>
                        <Badge variant="outline" className={`text-[9px] font-semibold ${sentimentColor}`}>
                          {sentimentLabel} ({positiveCount} positive / {negativeCount} negative)
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                        {data.news.map((item, index) => {
                          let dotColor = 'bg-slate-300 dark:bg-slate-700'
                          let itemBg = 'hover:bg-slate-50/50 dark:hover:bg-slate-900/20'
                          if (item.sentiment === 'positive') {
                            dotColor = 'bg-emerald-500'
                            itemBg = 'bg-emerald-50/5 dark:bg-emerald-950/5 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10'
                          } else if (item.sentiment === 'negative') {
                            dotColor = 'bg-rose-500'
                            itemBg = 'bg-rose-50/5 dark:bg-rose-950/5 hover:bg-rose-50/20 dark:hover:bg-rose-950/10'
                          }

                          return (
                            <a
                              key={index}
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-start gap-2 p-2 rounded border border-border/40 text-xs transition-colors group ${itemBg}`}
                            >
                              <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} title={`Sentiment: ${item.sentiment}`} />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 leading-snug">
                                  {item.title}
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                                  <span>{item.source}</span>
                                  {item.pubDate && (
                                    <span>{new Date(item.pubDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                  )}
                                </div>
                              </div>
                              <ExternalLink className="h-3 w-3 text-muted-foreground/60 group-hover:text-indigo-500 mt-0.5 shrink-0 transition-colors" />
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()
              ) : (
                <div className="rounded-lg border border-border/50 bg-slate-50/25 dark:bg-slate-900/10 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                    <Newspaper className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    No live news feeds found for this symbol on Google or Yahoo News.
                  </p>
                </div>
              )}

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
