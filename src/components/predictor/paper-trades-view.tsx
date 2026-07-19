'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Award, TrendingUp, TrendingDown, Target, Activity } from 'lucide-react'
import { PaperTradeCard, type PaperTrade } from './paper-trade-card'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface Props {
  trades: PaperTrade[]
  stats: {
    total: number
    active: number
    hitT1: number
    hitT2: number
    hitT3: number
    stoppedOut: number
    avgPnl: number
    winRate: number
  } | null
  loading: boolean
  updating: boolean
  onUpdate: () => void
  onDelete: (id: string) => void
  onClose: (id: string) => void
}

export function PaperTradesView({ trades, stats, loading, updating, onUpdate, onDelete, onClose }: Props) {
  if (loading && trades.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64" />)}
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center space-y-3">
          <Award className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
          <div className="text-sm font-medium">No paper trades yet</div>
          <div className="text-xs text-muted-foreground max-w-md mx-auto">
            Go to any of the BTST, Short, Mid, or Long tabs and click the{" "}
            <strong className="text-foreground">"Track"</strong> button on a signal card
            to start paper-trading it. Come back here to see if T1, T2, T3 hit
            or the stop loss triggered.
          </div>
        </CardContent>
      </Card>
    )
  }

  // Generate cumulative P&L chart data
  const chartData = (() => {
    const sortedForChart = [...trades]
      .sort((a, b) => new Date(a.trackedAt).getTime() - new Date(b.trackedAt).getTime())
    
    let cumulativePnl = 0
    return sortedForChart.map((t) => {
      cumulativePnl += t.pnlPct
      return {
        date: new Date(t.trackedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        pnl: +cumulativePnl.toFixed(2),
        symbol: t.symbol,
      }
    })
  })()

  // Group trades: Active first, then by status
  const statusOrder = { ACTIVE: 0, HIT_T1: 1, HIT_T2: 2, HIT_T3: 3, STOPPED_OUT: 4, CLOSED: 5 }
  const sorted = [...trades].sort((a, b) => {
    const so = statusOrder[a.status as keyof typeof statusOrder] ?? 99
    const bo = statusOrder[b.status as keyof typeof statusOrder] ?? 99
    if (so !== bo) return so - bo
    return new Date(b.trackedAt).getTime() - new Date(a.trackedAt).getTime()
  })

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <StatCard label="Total" value={String(stats.total)} icon={<Award className="h-3 w-3" />} />
          <StatCard label="Active" value={String(stats.active)} icon={<Activity className="h-3 w-3" />} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Hit T1" value={String(stats.hitT1)} icon={<Target className="h-3 w-3" />} color="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Hit T2" value={String(stats.hitT2)} icon={<Target className="h-3 w-3" />} color="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Hit T3" value={String(stats.hitT3)} icon={<Target className="h-3 w-3" />} color="text-violet-600 dark:text-violet-400" />
          <StatCard
            label="Avg P&L"
            value={`${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}%`}
            icon={stats.avgPnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            color={stats.avgPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
          />
          <StatCard
            label="Win Rate"
            value={`${stats.winRate.toFixed(0)}%`}
            icon={stats.winRate >= 50 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            color={stats.winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
          />
        </div>
      )}

      {/* Performance Curve Chart */}
      {trades.length >= 2 && chartData.length >= 2 && (
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Paper Trading Cumulative Growth</h4>
                <p className="text-[10px] text-muted-foreground">Historical aggregate sum of tracked P&L (%) over time</p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300">
                Net P&L: {(stats?.avgPnl ?? 0) * (stats?.total ?? 0) >= 0 ? '+' : ''}{((stats?.avgPnl ?? 0) * (stats?.total ?? 0)).toFixed(2)}%
              </Badge>
            </div>
            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="date" className="text-[9px] text-muted-foreground" />
                  <YAxis className="text-[9px] text-muted-foreground" tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ fontSize: 10, borderRadius: 4 }}
                    formatter={(value: any, name: any, props: any) => [`${value}%`, `P&L (${props.payload.symbol})`]}
                  />
                  <Area type="monotone" dataKey="pnl" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPnl)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Update prices button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{sorted.length}</span> paper trade{sorted.length !== 1 ? 's' : ''} ·{' '}
          {stats?.active ?? 0} active · {stats?.stoppedOut ?? 0} stopped out
        </div>
        <Button onClick={onUpdate} disabled={updating} size="sm" className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} />
          {updating ? 'Updating prices…' : 'Update prices'}
        </Button>
      </div>

      {/* Trades grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((trade) => (
          <PaperTradeCard
            key={trade.id}
            trade={trade}
            onDelete={onDelete}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-2.5 space-y-0.5">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </div>
        <div className={`text-base font-bold tabular-nums ${color ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
