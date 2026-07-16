'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Activity, Layers, Flame, CalendarClock, Wifi, WifiOff } from 'lucide-react'
import { UniverseResult, formatINR, formatPct } from './types'

interface Props {
  result: UniverseResult
}

export function MarketSummary({ result }: Props) {
  const total = result.breadth.advancing + result.breadth.declining + result.breadth.unchanged
  const advPct = total > 0 ? (result.breadth.advancing / total) * 100 : 0
  const decPct = total > 0 ? (result.breadth.declining / total) * 100 : 0
  const asOf = new Date(result.asOf)
  const nextDay = new Date(result.nextTradingDay)
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  const ds = result.dataSource
  const nseActive = ds?.nseActive ?? false
  const nseCount = ds?.nseCount ?? 0
  const yahooCount = ds?.yahooCount ?? ds?.liveCount ?? 0
  const demoCount = ds?.demoCount ?? 0

  // Banner style: blue when NSE archive is active, green when only Yahoo all-live,
  // amber when partial Yahoo, gray when all synthetic
  const bannerClass = nseActive
    ? 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10'
    : yahooCount > 0 && demoCount === 0
    ? 'border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10'
    : yahooCount > 0
    ? 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10'
    : 'border-l-muted-foreground bg-muted/30'

  return (
    <div className="space-y-4">
      {/* Data source banner */}
      {ds && (
        <Card className={`border-l-4 ${bannerClass}`}>
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              {nseActive || yahooCount > 0 ? (
                <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <span className="font-semibold">
                {nseActive
                  ? `NSE bhavcopy archive (${nseCount} stocks)`
                  : yahooCount > 0
                  ? 'Yahoo Finance EOD data'
                  : 'Synthetic data (no live provider available)'}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {nseActive && nseCount > 0 && <span className="text-blue-700 dark:text-blue-300">{nseCount} nse · </span>}
                <span className="text-emerald-700 dark:text-emerald-300">{yahooCount} yahoo</span>
                {demoCount > 0 && <span className="text-amber-700 dark:text-amber-300"> · {demoCount} demo</span>}
              </Badge>
            </div>
            {ds.fetchedAt && (
              <span className="text-[11px] text-muted-foreground">
                Fetched {new Date(ds.fetchedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Signal generated for</span>
              <CalendarClock className="h-4 w-4 text-primary" />
            </div>
            <div className="text-lg font-bold tabular-nums">{fmtDate(nextDay)}</div>
            <div className="text-[11px] text-muted-foreground">As-of close: {fmtDate(asOf)}</div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Market breadth</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{result.breadth.advancing}</span>
              <span className="text-xs text-muted-foreground">adv</span>
              <span className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{result.breadth.declining}</span>
              <span className="text-xs text-muted-foreground">dec</span>
            </div>
            <Progress value={advPct} className="h-1.5 bg-red-200 dark:bg-red-950">
              <div className="h-full bg-emerald-500" style={{ width: `${advPct}%` }} />
            </Progress>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">BTST setups</span>
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums">{result.btst.length}</div>
            <div className="text-[11px] text-muted-foreground">buy signals for tomorrow</div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">All-timeframe BUY</span>
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{result.breadth.strongBuys}</div>
            <div className="text-[11px] text-muted-foreground">BUY across all 4 timeframes</div>
          </CardContent>
        </Card>
      </div>

      {/* Sector breadth + Top movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4" /> Sector breadth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {result.sectorBreadth.map((s) => {
              const advPct = s.total > 0 ? (s.advancing / s.total) * 100 : 0
              return (
                <div key={s.sector} className="grid grid-cols-[80px_1fr_60px] items-center gap-2 text-xs">
                  <span className="font-medium truncate">{s.sector}</span>
                  <div className="relative h-4 rounded bg-red-100 dark:bg-red-950/40 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${advPct}%` }} />
                  </div>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {s.advancing}/{s.total}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Top movers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-72 overflow-y-auto pr-1">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Gainers
              </div>
              <div className="space-y-1">
                {result.topGainers.slice(0, 5).map((g) => (
                  <div key={g.symbol} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{g.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">{formatINR(g.price)}</span>
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400 w-14 text-right">{formatPct(g.changePct)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> Losers
              </div>
              <div className="space-y-1">
                {result.topLosers.slice(0, 5).map((g) => (
                  <div key={g.symbol} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{g.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">{formatINR(g.price)}</span>
                      <span className="tabular-nums text-red-600 dark:text-red-400 w-14 text-right">{formatPct(g.changePct)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
