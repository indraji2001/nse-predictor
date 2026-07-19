'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Play, TrendingUp, TrendingDown, Percent, Calendar, ShieldAlert, Award, FileText, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import Link from 'next/link'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid } from 'recharts'
import { NSE_UNIVERSE } from '@/lib/stocks/universe'

interface BacktestTrade {
  symbol: string
  entryDate: string
  entryPrice: number
  exitDate: string
  exitPrice: number
  status: 'HIT_TARGET' | 'STOPPED_OUT' | 'TIME_EXIT'
  pnlPct: number
  holdingDays: number
}

interface EquityPoint {
  date: string
  equity: number
}

interface BacktestResult {
  symbol: string
  timeframe: string
  startDate: string
  endDate: string
  totalTrades: number
  winRate: number
  totalPnLPct: number
  maxDrawdown: number
  averageHoldingDays: number
  trades: BacktestTrade[]
  equityCurve: EquityPoint[]
  dataSource?: string
}

export default function BacktestDashboard() {
  const [symbol, setSymbol] = useState('RELIANCE')
  const [timeframe, setTimeframe] = useState('SHORT_TERM')
  const [target, setTarget] = useState('T2')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [mounted, setMounted] = useState(false)
  
  // Strategy optimization state variables
  const [optimization, setOptimization] = useState<any[] | null>(null)
  const [optimizing, setOptimizing] = useState(false)

  const runSimulation = async (sym: string, tf: string, tg: string) => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/backtest?symbol=${sym}&timeframe=${tf}&target=${tg}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data: BacktestResult = await res.json()
      setResult(data)
      toast.success('Backtest complete!', {
        description: `Ran ${data.totalTrades} trades for ${sym}. Win rate: ${data.winRate}%`,
      })
    } catch (err: any) {
      toast.error('Backtest failed', {
        description: err.message || 'An error occurred',
      })
    } finally {
      setLoading(false)
    }
  }

  const runOptimizer = async () => {
    setOptimizing(true)
    setOptimization(null)
    try {
      const targets = ['T1', 'T2', 'T3']
      const promises = targets.map(async (tg) => {
        const res = await fetch(`/api/backtest?symbol=${symbol}&timeframe=${timeframe}&target=${tg}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        return {
          target: tg,
          winRate: data.winRate,
          totalPnL: data.totalPnLPct,
          maxDrawdown: data.maxDrawdown,
          totalTrades: data.totalTrades
        }
      })
      const results = await Promise.all(promises)
      setOptimization(results)
      toast.success('Strategy optimization complete!', {
        description: `Compared performance parameters for ${symbol} under ${timeframe}.`
      })
    } catch {
      toast.error('Optimization failed', {
        description: 'An error occurred during target analysis.'
      })
    } finally {
      setOptimizing(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    
    // Parse URL search parameters on load
    const params = new URLSearchParams(window.location.search)
    const paramSymbol = params.get('symbol')
    const paramTimeframe = params.get('timeframe')
    const paramTarget = params.get('target')

    let activeSymbol = 'RELIANCE'
    let activeTimeframe = 'SHORT_TERM'
    let activeTarget = 'T2'

    if (paramSymbol) {
      activeSymbol = paramSymbol.toUpperCase()
      setSymbol(activeSymbol)
    }
    if (paramTimeframe) {
      activeTimeframe = paramTimeframe
      setTimeframe(activeTimeframe)
    }
    if (paramTarget) {
      activeTarget = paramTarget
      setTarget(activeTarget)
    }

    if (paramSymbol && paramTimeframe) {
      runSimulation(activeSymbol, activeTimeframe, activeTarget)
    }
  }, [])

  const handleRunBacktest = async () => {
    await runSimulation(symbol, timeframe, target)
  }

  // Format currency
  const formatVal = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="h-9 w-9 rounded-lg hover:bg-accent flex items-center justify-center border border-border/50 text-muted-foreground hover:text-foreground transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold tracking-tight">Strategy Backtester</h1>
              <p className="text-[11px] text-muted-foreground">Verify signal performance on historical market data</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700 gap-1">
            <Sparkles className="h-3 w-3" /> Technical Backtesting
          </Badge>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-5 space-y-6">
        {/* Settings & Controls */}
        <Card className="border-border/60">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold">Backtest Configuration</CardTitle>
            <CardDescription className="text-[11px]">Select parameters to run the historical trading simulation.</CardDescription>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="symbol" className="text-xs">Stock Symbol</Label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger id="symbol" className="h-9 text-xs">
                    <SelectValue placeholder="Select stock" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {NSE_UNIVERSE.map((stock) => (
                      <SelectItem key={stock.symbol} value={stock.symbol} className="text-xs">
                        {stock.symbol} <span className="text-[10px] text-muted-foreground">({stock.name})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timeframe" className="text-xs">Trading Horizon</Label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger id="timeframe" className="h-9 text-xs">
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTST" className="text-xs">BTST (1-2 days)</SelectItem>
                    <SelectItem value="SHORT_TERM" className="text-xs">Short-term (5-15 days)</SelectItem>
                    <SelectItem value="MIDTERM" className="text-xs">Midterm (1-3 months)</SelectItem>
                    <SelectItem value="LONG_TERM" className="text-xs">Long-term (6-24 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target" className="text-xs">Target Exit Strategy</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger id="target" className="h-9 text-xs">
                    <SelectValue placeholder="Select exit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T1" className="text-xs">Target 1 (Fast Exit)</SelectItem>
                    <SelectItem value="T2" className="text-xs">Target 2 (Balanced Exit)</SelectItem>
                    <SelectItem value="T3" className="text-xs">Target 3 (Positional Exit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full">
                <Button onClick={handleRunBacktest} disabled={loading || optimizing} className="h-9 gap-1.5 text-xs">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" /> Run Backtest
                    </>
                  )}
                </Button>
                <Button
                  onClick={runOptimizer}
                  disabled={loading || optimizing}
                  variant="outline"
                  className="h-9 gap-1.5 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50/50 dark:border-indigo-900 dark:text-indigo-300"
                >
                  {optimizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Optimizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" /> Optimize Target
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strategy Optimization Card */}
        {(optimizing || optimization) && (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                Target Strategy Optimizer
              </CardTitle>
              <CardDescription className="text-[11px]">Grid search comparing target exit levels for {symbol} under {timeframe} timeframe.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              {optimizing && (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <span className="text-xs text-muted-foreground">Running target simulations (T1, T2, T3)...</span>
                </div>
              )}
              {optimization && !optimizing && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Exit Target</TableHead>
                        <TableHead className="text-xs">Total Trades</TableHead>
                        <TableHead className="text-xs">Win Rate</TableHead>
                        <TableHead className="text-xs">Max Drawdown</TableHead>
                        <TableHead className="text-xs">Total Return</TableHead>
                        <TableHead className="text-xs text-right">Recommendation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {optimization.map((opt) => {
                        const isBest = opt.totalPnL === Math.max(...optimization.map(o => o.totalPnL))
                        return (
                          <TableRow key={opt.target}>
                            <TableCell className="font-semibold text-xs">{opt.target === 'T1' ? 'Target 1 (Fast Exit)' : opt.target === 'T2' ? 'Target 2 (Balanced)' : 'Target 3 (Positional)'}</TableCell>
                            <TableCell className="text-xs">{opt.totalTrades}</TableCell>
                            <TableCell className="text-xs font-mono">{opt.winRate}%</TableCell>
                            <TableCell className="text-xs text-red-600 dark:text-red-400 font-mono">{opt.maxDrawdown}%</TableCell>
                            <TableCell className={`text-xs font-bold font-mono ${opt.totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                              {opt.totalPnL >= 0 ? '+' : ''}{opt.totalPnL}%
                            </TableCell>
                            <TableCell className="text-right">
                              {isBest ? (
                                <Badge className="bg-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 text-white text-[9px] font-semibold border-indigo-200">🏆 Best Performance</Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-6">
            {/* Stats Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border/60">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${result.totalPnLPct >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                    {result.totalPnLPct >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Total Return</p>
                    <h3 className={`text-base font-bold ${result.totalPnLPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {result.totalPnLPct >= 0 ? '+' : ''}{result.totalPnLPct}%
                    </h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                    <Percent className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Win Rate</p>
                    <h3 className="text-base font-bold text-indigo-600 dark:text-indigo-400">{result.winRate}%</h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Max Drawdown</p>
                    <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">{result.maxDrawdown}%</h3>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg Holding Days</p>
                    <h3 className="text-base font-bold text-amber-600 dark:text-amber-400">{result.averageHoldingDays} days</h3>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Overview & Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-border/60">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-semibold">Equity Growth Chart</CardTitle>
                  <CardDescription className="text-[11px]">Cumulative returns starting with index 100.</CardDescription>
                </CardHeader>
                <CardContent className="h-[280px] p-0 pr-4 pb-4">
                  {mounted && result.equityCurve.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.equityCurve}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                        <XAxis dataKey="date" tickFormatter={(str) => {
                          const date = new Date(str)
                          return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                        }} style={{ fontSize: 10 }} stroke="rgba(128,128,128,0.5)" />
                        <YAxis domain={['auto', 'auto']} style={{ fontSize: 10 }} stroke="rgba(128,128,128,0.5)" />
                        <ChartTooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as EquityPoint
                            return (
                              <div className="p-2 border border-border/80 bg-popover rounded-md shadow-md text-xs text-popover-foreground">
                                <p className="font-semibold">{new Date(data.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                <p className="mt-0.5 text-emerald-600 dark:text-emerald-400 font-bold">Equity: {data.equity.toFixed(2)}</p>
                              </div>
                            )
                          }
                          return null
                        }} />
                        <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                      No chart data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Statistics Details */}
              <Card className="border-border/60">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-semibold">Simulation Analysis</CardTitle>
                  <CardDescription className="text-[11px]">Performance details for {symbol} ({result.dataSource} data).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Date Range</span>
                    <span className="font-medium">{new Date(result.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – {new Date(result.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Total Signals Traded</span>
                    <span className="font-semibold">{result.totalTrades}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Win / Loss Ratio</span>
                    <span className="font-semibold">
                      {result.trades.filter((t) => t.pnlPct > 0).length} W / {result.trades.filter((t) => t.pnlPct <= 0).length} L
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Max Profit in single trade</span>
                    <span className="text-emerald-600 font-bold">
                      +{result.trades.length > 0 ? Math.max(...result.trades.map((t) => t.pnlPct)) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Max Loss in single trade</span>
                    <span className="text-red-600 font-bold">
                      {result.trades.length > 0 ? Math.min(...result.trades.map((t) => t.pnlPct)) : 0}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Trade Logs */}
            <Card className="border-border/60">
              <CardHeader className="py-4 flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold">Simulation Trade Log</CardTitle>
                  <CardDescription className="text-[11px]">List of all simulated trades triggered during the backtest period.</CardDescription>
                </div>
                <Badge variant="secondary" className="text-[10px] py-0.5 px-2 gap-1">
                  <FileText className="h-3 w-3" /> {result.totalTrades} Trades
                </Badge>
              </CardHeader>
              <CardContent className="p-0 border-t border-border/40">
                {result.trades.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                          <TableHead className="text-xs py-2">Entry Date</TableHead>
                          <TableHead className="text-xs py-2">Entry Price</TableHead>
                          <TableHead className="text-xs py-2">Exit Date</TableHead>
                          <TableHead className="text-xs py-2">Exit Price</TableHead>
                          <TableHead className="text-xs py-2">Holding</TableHead>
                          <TableHead className="text-xs py-2">Exit Status</TableHead>
                          <TableHead className="text-xs py-2 text-right">PnL (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.trades.map((trade, idx) => (
                          <TableRow key={idx} className="border-b border-border/40 hover:bg-accent/30 text-xs">
                            <TableCell className="py-2.5 font-medium">{new Date(trade.entryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                            <TableCell className="py-2.5">{formatVal(trade.entryPrice)}</TableCell>
                            <TableCell className="py-2.5">{new Date(trade.exitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                            <TableCell className="py-2.5">{formatVal(trade.exitPrice)}</TableCell>
                            <TableCell className="py-2.5">{trade.holdingDays} days</TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="outline" className={`text-[10px] font-normal px-2 py-0.5 ${
                                trade.status === 'HIT_TARGET' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                  : trade.status === 'STOPPED_OUT'
                                  ? 'bg-rose-50 text-rose-700 border-rose-400 dark:bg-rose-950/20 dark:text-rose-400'
                                  : 'bg-amber-50 text-amber-700 border-amber-400 dark:bg-amber-950/20 dark:text-amber-400'
                              }`}>
                                {trade.status === 'HIT_TARGET' ? 'Hit Target' : trade.status === 'STOPPED_OUT' ? 'Stopped Out' : 'Time Exit'}
                              </Badge>
                            </TableCell>
                            <TableCell className={`py-2.5 text-right font-bold ${trade.pnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {trade.pnlPct >= 0 ? '+' : ''}{trade.pnlPct}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No trades were triggered during the backtest period. Try broadening your criteria or selecting a different timeframe.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
