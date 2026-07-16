'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Search, TrendingUp, Sparkles, ShieldCheck, AlertTriangle, X, Flame, Clock, Database, Zap, Activity, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  UniverseResult, Signal, Timeframe, TIMEFRAME_LABELS, TIMEFRAME_DESCRIPTIONS,
} from '@/components/predictor/types'
import {
  IntradayScanResult, IntradayAnalysis, marketStatus,
} from '@/components/predictor/intraday-types'
import { MarketSummary } from '@/components/predictor/market-summary'
import { SignalCard } from '@/components/predictor/signal-card'
import { StockDetailDialog } from '@/components/predictor/stock-detail-dialog'
import { DataArchiveDialog } from '@/components/predictor/data-archive-dialog'
import { IntradayCard } from '@/components/predictor/intraday-card'
import { IntradayDetailDialog } from '@/components/predictor/intraday-detail-dialog'
import { PaperTradeCard, type PaperTrade } from '@/components/predictor/paper-trade-card'
import { PaperTradesView } from '@/components/predictor/paper-trades-view'

export type TabKey = Timeframe | 'INTRADAY' | 'PAPER_TRADES'

export default function Home() {
  const [result, setResult] = useState<UniverseResult | null>(null)
  const [intradayResult, setIntradayResult] = useState<IntradayScanResult | null>(null)
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([])
  const [paperStats, setPaperStats] = useState<{ total: number; active: number; hitT1: number; hitT2: number; hitT3: number; stoppedOut: number; avgPnl: number; winRate: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [intradayLoading, setIntradayLoading] = useState(false)
  const [paperLoading, setPaperLoading] = useState(false)
  const [paperUpdating, setPaperUpdating] = useState(false)
  const [trackedKeys, setTrackedKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('BTST')
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState<string>('ALL')
  const [minConfidence, setMinConfidence] = useState<number>(0)
  const [onlyTripleBuy, setOnlyTripleBuy] = useState(false)
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null)
  const [intradaySymbol, setIntradaySymbol] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const loadIntraday = useCallback(async (showToast = true) => {
    setIntradayLoading(true)
    try {
      const res = await fetch('/api/intraday-scan?limit=80', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: IntradayScanResult = await res.json()
      setIntradayResult(data)
      if (showToast) {
        toast.success('Intraday scan complete', {
          description: `${data.buyNowCount} BUY · ${data.waitCount} WAIT · ${data.sellWatchCount} SHORT · ${data.avoidCount} AVOID (of ${data.totalScanned} scanned)`,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load intraday'
      if (showToast) toast.error('Intraday scan failed', { description: msg })
    } finally {
      setIntradayLoading(false)
    }
  }, [])

  const loadPaperTrades = useCallback(async (showToast = false) => {
    setPaperLoading(true)
    try {
      const res = await fetch('/api/papertrade/list', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPaperTrades(data.trades)
      setPaperStats(data.stats)
      // Build set of tracked keys: `${symbol}-${timeframe}`
      const keys = new Set<string>()
      for (const t of data.trades) {
        if (t.status === 'ACTIVE') keys.add(`${t.symbol}-${t.timeframe}`)
      }
      setTrackedKeys(keys)
      if (showToast) {
        toast.success('Paper trades loaded', { description: `${data.stats.active} active · ${data.stats.total} total` })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load paper trades'
      if (showToast) toast.error('Failed to load paper trades', { description: msg })
    } finally {
      setPaperLoading(false)
    }
  }, [])

  const updatePaperPrices = useCallback(async () => {
    setPaperUpdating(true)
    try {
      const res = await fetch('/api/papertrade/update', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      toast.success('Paper trades updated', {
        description: `${data.updated} trades updated · ${data.hits.hitT1} hit T1 · ${data.hits.hitT2} hit T2 · ${data.hits.hitT3} hit T3 · ${data.hits.stoppedOut} stopped`,
      })
      await loadPaperTrades(false)
    } catch (e) {
      toast.error('Update failed', { description: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setPaperUpdating(false)
    }
  }, [loadPaperTrades])

  const trackSignal = useCallback(async (signal: Signal) => {
    const key = `${signal.symbol}-${signal.timeframe}`
    if (trackedKeys.has(key)) return
    try {
      const res = await fetch('/api/papertrade/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: signal.symbol,
          name: signal.name,
          sector: signal.sector,
          timeframe: signal.timeframe,
          entryPrice: signal.entry,
          stopLoss: signal.stopLoss,
          target1: signal.target1,
          target2: signal.target2,
          target3: signal.target3,
          riskReward: signal.riskReward,
          holdingPeriod: signal.holdingPeriod,
          confidence: signal.confidence,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Already tracking', { description: data.error ?? 'Failed' })
        return
      }
      toast.success(`Tracking ${signal.symbol}`, {
        description: `${TIMEFRAME_LABELS[signal.timeframe]} · Entry ₹${signal.entry} · T1 ₹${signal.target1} · SL ₹${signal.stopLoss}`,
      })
      setTrackedKeys((prev) => new Set([...prev, key]))
      await loadPaperTrades(false)
    } catch (e) {
      toast.error('Track failed', { description: e instanceof Error ? e.message : 'Unknown' })
    }
  }, [trackedKeys, loadPaperTrades])

  const deletePaperTrade = useCallback(async (id: string) => {
    if (!confirm('Delete this paper trade permanently?')) return
    try {
      await fetch(`/api/papertrade/delete?id=${id}`, { method: 'DELETE' })
      toast.success('Trade deleted')
      await loadPaperTrades(false)
    } catch (e) {
      toast.error('Delete failed')
    }
  }, [loadPaperTrades])

  const closePaperTrade = useCallback(async (id: string) => {
    try {
      await fetch('/api/papertrade/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'close' }),
      })
      toast.success('Trade closed')
      await loadPaperTrades(false)
    } catch (e) {
      toast.error('Close failed')
    }
  }, [loadPaperTrades])

  const load = useCallback(async (showToast = true) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/predict', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: UniverseResult = await res.json()
      setResult(data)
      if (showToast) {
        const ds = data.dataSource
        let srcSummary = ''
        if (ds) {
          const parts: string[] = []
          if (ds.nseCount) parts.push(`${ds.nseCount} nse`)
          if (ds.yahooCount) parts.push(`${ds.yahooCount} yahoo`)
          if (ds.demoCount) parts.push(`${ds.demoCount} demo`)
          srcSummary = parts.length ? ` · ${parts.join(' · ')}` : ''
        }
        toast.success(`Predictions ready for ${new Date(data.nextTradingDay).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`, {
          description: `${data.btst.length} BTST · ${data.shortTerm.length} ST · ${data.midterm.length} MT · ${data.longTerm.length} LT BUY signals${srcSummary}`,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load predictions'
      setError(msg)
      if (showToast) toast.error('Failed to load predictions', { description: msg })
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    load(false)
  }, [load])

  // Load intraday scan when INTRADAY tab is first selected
  useEffect(() => {
    if (activeTab === 'INTRADAY' && !intradayResult && !intradayLoading) {
      loadIntraday(false)
    }
    if (activeTab === 'PAPER_TRADES' && paperTrades.length === 0 && !paperLoading) {
      loadPaperTrades(false)
    }
  }, [activeTab, intradayResult, intradayLoading, loadIntraday, paperTrades.length, paperLoading, loadPaperTrades])

  // P3-10: Auto-refresh intraday scan every 2 minutes while on the Intraday tab
  // AND market is open (IST 9:15 AM - 3:30 PM, Mon-Fri). Stops refreshing when
  // the user switches tabs or market closes.
  useEffect(() => {
    if (activeTab !== 'INTRADAY') return
    // Check market status client-side using same logic as intraday-types
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const day = ist.getUTCDay()
    const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
    const isMarketOpen = day !== 0 && day !== 6 && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30
    if (!isMarketOpen) return

    const intervalMs = 2 * 60 * 1000 // 2 minutes
    const interval = setInterval(() => {
      // Re-check market status at fire time (in case market closed between mount and fire)
      const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      const nowDay = nowIst.getUTCDay()
      const nowMin = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes()
      const stillOpen = nowDay !== 0 && nowDay !== 6 && nowMin >= 9 * 60 + 15 && nowMin <= 15 * 60 + 30
      if (stillOpen && activeTab === 'INTRADAY') {
        loadIntraday(false)
      }
    }, intervalMs)

    return () => clearInterval(interval)
  }, [activeTab, loadIntraday])

  const signalsForTab: Signal[] = useMemo(() => {
    if (!result) return []
    if (activeTab === 'BTST') return result.btst
    if (activeTab === 'SHORT_TERM') return result.shortTerm
    if (activeTab === 'MIDTERM') return result.midterm
    if (activeTab === 'LONG_TERM') return result.longTerm
    return [] // INTRADAY handled separately
  }, [result, activeTab])

  const intradayFiltered = useMemo(() => {
    if (!intradayResult) return []
    let list = intradayResult.signals
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
    }
    if (sectorFilter !== 'ALL') {
      list = list.filter((s) => s.sector === sectorFilter)
    }
    if (minConfidence > 0) {
      list = list.filter((s) => s.confidence >= minConfidence)
    }
    return list
  }, [intradayResult, search, sectorFilter, minConfidence])

  const filtered = useMemo(() => {
    let list = signalsForTab
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      list = list.filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
    }
    if (sectorFilter !== 'ALL') {
      list = list.filter((s) => s.sector === sectorFilter)
    }
    if (minConfidence > 0) {
      list = list.filter((s) => s.confidence >= minConfidence)
    }
    if (onlyTripleBuy && result) {
      // A signal is "all-timeframe-buy" if its symbol appears in all 4 lists
      const btstSyms = new Set(result.btst.map((s) => s.symbol))
      const stSyms = new Set(result.shortTerm.map((s) => s.symbol))
      const mtSyms = new Set(result.midterm.map((s) => s.symbol))
      const ltSyms = new Set(result.longTerm.map((s) => s.symbol))
      list = list.filter((s) => btstSyms.has(s.symbol) && stSyms.has(s.symbol) && mtSyms.has(s.symbol) && ltSyms.has(s.symbol))
    }
    return list
  }, [signalsForTab, search, sectorFilter, minConfidence, onlyTripleBuy, result])

  const sectorOptions = useMemo(() => {
    if (!result) return ['ALL']
    const set = new Set<string>()
    ;[...result.btst, ...result.shortTerm, ...result.midterm].forEach((s) => set.add(s.sector))
    return ['ALL', ...Array.from(set).sort()]
  }, [result])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">NSE Predictor</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">BTST · Short-term · Midterm technical screener</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mr-2">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Updated {new Date(result.asOf).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            <Button
              onClick={() => setArchiveOpen(true)}
              size="sm"
              variant="outline"
              className="gap-1.5"
              title="Manage local NSE bhavcopy archive"
            >
              <Database className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Archive</span>
            </Button>
            <Button onClick={() => load(true)} disabled={loading} size="sm" className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Fetching live data…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-5 space-y-5">
        {/* Disclaimer banner */}
        <Alert className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/60">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm">Educational tool — not investment advice</AlertTitle>
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
            Scanning <strong>{result?.dataSource?.total ?? 512} stocks</strong> across 15 sectors · 4 timeframes + intraday.
            Data priority: <strong>NSE bhavcopy</strong> → <strong>Yahoo Finance</strong> → synthetic.
            Always confirm with your broker's research before placing trades. Capital is at risk.
          </AlertDescription>
        </Alert>

        {/* Loading skeleton */}
        {loading && !result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72" />)}
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Failed to generate predictions</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {result && !loading && (
          <>
            {/* Market summary */}
            <MarketSummary result={result} />

            {/* Timeframe tabs + filters */}
            <div className="space-y-3">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Timeframe)}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <TabsList className="grid grid-cols-6 w-full max-w-4xl">
                      <TabsTrigger value="INTRADAY" className="text-xs gap-1.5">
                        <Zap className="h-3 w-3" /> Intraday
                        {intradayResult && (
                          <Badge variant="secondary" className="text-[10px] ml-1">{intradayResult.buyNowCount}</Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="BTST" className="text-xs gap-1.5">
                        <Flame className="h-3 w-3" /> BTST
                        <Badge variant="secondary" className="text-[10px] ml-1">{result.btst.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="SHORT_TERM" className="text-xs gap-1.5">
                        <Sparkles className="h-3 w-3" /> Short
                        <Badge variant="secondary" className="text-[10px] ml-1">{result.shortTerm.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="MIDTERM" className="text-xs gap-1.5">
                        <ShieldCheck className="h-3 w-3" /> Mid
                        <Badge variant="secondary" className="text-[10px] ml-1">{result.midterm.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="LONG_TERM" className="text-xs gap-1.5">
                        <Clock className="h-3 w-3" /> Long
                        <Badge variant="secondary" className="text-[10px] ml-1">{result.longTerm.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="PAPER_TRADES" className="text-xs gap-1.5">
                        <Award className="h-3 w-3" /> Trades
                        {paperStats && paperStats.active > 0 && (
                          <Badge variant="secondary" className="text-[10px] ml-1">{paperStats.active}</Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                    <p className="text-[11px] text-muted-foreground">
                      {activeTab === 'INTRADAY'
                        ? 'Live intraday scan (15-min delayed) — BUY / WAIT / SHORT signals for today\'s session. 5-min candles with VWAP, ORB, EMA9/21.'
                        : activeTab === 'PAPER_TRADES'
                        ? 'Paper trades you\'re tracking — click "Track" on any signal to add it here. Update prices daily to see if T1/T2/T3 hit.'
                        : TIMEFRAME_DESCRIPTIONS[activeTab]}
                    </p>
                    {activeTab === 'INTRADAY' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const ms = marketStatus()
                          return (
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold px-2.5 py-1 gap-1.5 ${
                                ms.open
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                              title={ms.nextEvent}
                            >
                              {ms.open ? (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/60" />
                              )}
                              {ms.label}
                              <span className="text-[9px] font-normal opacity-70">· {ms.nextEvent}</span>
                            </Badge>
                          )
                        })()}
                        {intradayResult && (
                          <span className="text-[11px] text-muted-foreground">
                            Scanned <span className="font-semibold text-foreground tabular-nums">{intradayResult.totalScanned}</span> stocks ·
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium"> {intradayResult.buyNowCount} BUY</span> ·
                            <span className="text-amber-600 dark:text-amber-400 font-medium"> {intradayResult.waitCount} WAIT</span> ·
                            <span className="text-red-600 dark:text-red-400 font-medium"> {intradayResult.sellWatchCount} SHORT</span>
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => loadIntraday(true)}
                          disabled={intradayLoading}
                        >
                          <RefreshCw className={`h-3 w-3 ${intradayLoading ? 'animate-spin' : ''}`} />
                          {intradayLoading ? 'Scanning…' : 'Refresh intraday'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search symbol…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 w-44 pl-7 text-xs"
                      />
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <Select value={sectorFilter} onValueChange={setSectorFilter}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="Sector" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectorOptions.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s === 'ALL' ? 'All sectors' : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(minConfidence)} onValueChange={(v) => setMinConfidence(Number(v))}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="Min confidence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0" className="text-xs">Any confidence</SelectItem>
                        <SelectItem value="65" className="text-xs">≥ 65</SelectItem>
                        <SelectItem value="75" className="text-xs">≥ 75</SelectItem>
                        <SelectItem value="85" className="text-xs">≥ 85</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5 px-2 h-8 rounded border border-border bg-card">
                      <Switch
                        id="triple"
                        checked={onlyTripleBuy}
                        onCheckedChange={setOnlyTripleBuy}
                        className="scale-75"
                      />
                      <Label htmlFor="triple" className="text-[11px] cursor-pointer">All-timeframe BUY only</Label>
                    </div>
                  </div>
                </div>
              </Tabs>

              {/* Results grid — INTRADAY mode */}
              {activeTab === 'INTRADAY' && (
                intradayLoading && !intradayResult ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72" />)}
                  </div>
                ) : intradayFiltered.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-sm text-muted-foreground">
                      {intradayResult
                        ? 'No intraday signals match the current filters. Try widening your criteria.'
                        : 'Click "Refresh intraday" above to scan stocks for live intraday signals.'}
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                      <span>
                        Showing <span className="font-semibold text-foreground tabular-nums">{intradayFiltered.length}</span> of{' '}
                        <span className="tabular-nums">{intradayResult?.signals.length ?? 0}</span> intraday signals
                      </span>
                      <span className="text-[10px]">
                        Sorted by: <span className="text-foreground font-medium">BUY → WAIT → SHORT → AVOID</span>, then confidence ↓
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {intradayFiltered.map((sig, i) => (
                        <IntradayCard
                          key={sig.symbol}
                          signal={sig}
                          rank={i + 1}
                          onOpen={() => setIntradaySymbol(sig.symbol)}
                        />
                      ))}
                    </div>
                  </>
                )
              )}

              {/* Results grid — PAPER TRADES mode */}
              {activeTab === 'PAPER_TRADES' && (
                <PaperTradesView
                  trades={paperTrades}
                  stats={paperStats}
                  loading={paperLoading}
                  updating={paperUpdating}
                  onUpdate={updatePaperPrices}
                  onDelete={deletePaperTrade}
                  onClose={closePaperTrade}
                />
              )}

              {/* Results grid — EOD timeframes */}
              {activeTab !== 'INTRADAY' && activeTab !== 'PAPER_TRADES' && (
                filtered.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center text-sm text-muted-foreground">
                      No signals match the current filters. Try widening your criteria.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Showing <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span> of{' '}
                        <span className="tabular-nums">{signalsForTab.length}</span> {TIMEFRAME_LABELS[activeTab as Timeframe]} BUY signals
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filtered.map((sig, i) => (
                        <SignalCard
                          key={`${sig.symbol}-${sig.timeframe}`}
                          signal={sig}
                          rank={i + 1}
                          onOpen={() => setDetailSymbol(sig.symbol)}
                          onTrack={trackSignal}
                          isTracked={trackedKeys.has(`${sig.symbol}-${sig.timeframe}`)}
                        />
                      ))}
                    </div>
                  </>
                )
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 py-4 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>
            Multi-factor engine · RSI · MACD · EMA · Bollinger · ATR · Stochastic · ADX · Supertrend · VWAP · Pivots · Candlestick patterns
          </span>
          <span>Run daily at 8 PM IST · Next trading day: {result?.nextTradingDay ?? '—'}</span>
        </div>
      </footer>

      <StockDetailDialog symbol={detailSymbol} onClose={() => setDetailSymbol(null)} />
      <IntradayDetailDialog symbol={intradaySymbol} onClose={() => setIntradaySymbol(null)} />
      <DataArchiveDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} />
    </div>
  )
}
