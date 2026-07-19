'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Play, TrendingUp, TrendingDown, Percent, Calendar, ShieldAlert, Award, FileText, Loader2, Sparkles, Plus, X, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import Link from 'next/link'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid, Legend } from 'recharts'
import { NSE_UNIVERSE } from '@/lib/stocks/universe'

interface PortfolioTrade {
  symbol: string
  entryDate: string
  entryPrice: number
  exitDate: string
  exitPrice: number
  status: 'HIT_TARGET' | 'STOPPED_OUT' | 'TIME_EXIT'
  pnlPct: number
  holdingDays: number
  entryCapital: number
  exitValue: number
}

interface PortfolioEquityPoint {
  date: string
  equity: number
  cash: number
  positionsValue: number
}

interface PortfolioBacktestResult {
  startDate: string
  endDate: string
  initialCapital: number
  finalValue: number
  totalReturnPct: number
  winRate: number
  totalTrades: number
  maxDrawdown: number
  averageHoldingDays: number
  trades: PortfolioTrade[]
  equityCurve: PortfolioEquityPoint[]
}

const QUICK_SETS = {
  nifty5: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'],
  nifty10: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'SBIN', 'BHARTIARTL', 'LT', 'ITC'],
  itPack: ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'KPITTECH', 'COFORGE'],
  banks: ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'BANKBARODA', 'PNB', 'BAJFINANCE'],
  auto: ['MARUTI', 'TATAMOTORS', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'ASHOKLEY', 'TVSMOTOR'],
  energy: ['RELIANCE', 'ONGC', 'NTPC', 'POWERGRID', 'COALINDIA', 'GAIL', 'BPCL', 'TATAPOWER'],
  pharma: ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'APOLLOHOSP', 'AUROPHARMA', 'LUPIN', 'TORNTPHARM'],
  metals: ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'JINDALSTEL', 'SAIL', 'NATIONALUM'],
  fmcg: ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'GODREJCP', 'TATACONSUM'],
  diversified: ['RELIANCE', 'TCS', 'HDFCBANK', 'SUNPHARMA', 'TATAMOTORS', 'MARUTI', 'JSWSTEEL', 'COALINDIA', 'ULTRACEMCO', 'TITAN']
}

export default function PortfolioBacktestDashboard() {
  const [symbolsString, setSymbolsString] = useState('RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK')
  const [timeframe, setTimeframe] = useState('SHORT_TERM')
  const [target, setTarget] = useState('T2')
  const [startingCapital, setStartingCapital] = useState(100000)
  const [maxPositions, setMaxPositions] = useState(5)
  const [allocation, setAllocation] = useState(20)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PortfolioBacktestResult | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const runSimulation = async () => {
    // Parse symbols
    const symbols = symbolsString
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0)

    if (symbols.length === 0) {
      toast.error('Missing Stock Symbols', {
        description: 'Please input at least one stock symbol to backtest.'
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/portfolio-backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbols,
          timeframe,
          target,
          startingCapital,
          maxPositions,
          allocationPerTrade: allocation
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const data: PortfolioBacktestResult = await res.json()
      setResult(data)
      toast.success('Portfolio Backtest complete!', {
        description: `Simulated ${data.totalTrades} trades. Net Return: ${data.totalReturnPct}%`
      })
    } catch (err: any) {
      toast.error('Portfolio Simulation failed', {
        description: err.message || 'An error occurred during calculation.'
      })
    } finally {
      setLoading(false)
    }
  }

  const applyQuickSet = (key: keyof typeof QUICK_SETS) => {
    setSymbolsString(QUICK_SETS[key].join(', '))
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-950 px-4 py-4 md:px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-indigo-500" />
              Portfolio Backtester
            </h1>
            <p className="text-xs text-muted-foreground">Simulate concurrent multi-stock trading with capital constraints</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Controls Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Play className="h-4 w-4 text-indigo-500 fill-current" />
                Backtest Config
              </CardTitle>
              <CardDescription>Setup allocation and parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Symbols */}
              <div className="space-y-1.5">
                <Label htmlFor="symbols" className="text-xs font-semibold">Stock Symbols (Comma separated)</Label>
                <Input
                  id="symbols"
                  value={symbolsString}
                  onChange={(e) => setSymbolsString(e.target.value)}
                  placeholder="RELIANCE, TCS, INFY"
                  className="font-mono text-xs"
                />
              </div>

              {/* Quick Sets */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quick Sets</span>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('nifty5')}>Nifty Top 5</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('nifty10')}>Nifty Top 10</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('itPack')}>IT Pack</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('banks')}>Banking</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('auto')}>Auto Pack</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('energy')}>Energy</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('pharma')}>Pharma</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('metals')}>Metals</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('fmcg')}>FMCG Pack</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] py-0 px-2" onClick={() => applyQuickSet('diversified')}>Diversified</Button>
                </div>
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="timeframe" className="text-xs font-semibold">Timeframe</Label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger id="timeframe" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BTST">BTST</SelectItem>
                      <SelectItem value="SHORT_TERM">Short Term</SelectItem>
                      <SelectItem value="MIDTERM">Midterm</SelectItem>
                      <SelectItem value="LONG_TERM">Long Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="target" className="text-xs font-semibold">Exit Target</Label>
                  <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger id="target" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T1">Target 1 (Conservative)</SelectItem>
                      <SelectItem value="T2">Target 2 (Balanced)</SelectItem>
                      <SelectItem value="T3">Target 3 (Aggressive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Capital Inputs */}
              <div className="space-y-1.5">
                <Label htmlFor="capital" className="text-xs font-semibold">Starting Capital (₹)</Label>
                <Input
                  id="capital"
                  type="number"
                  value={startingCapital}
                  onChange={(e) => setStartingCapital(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="maxPos" className="text-xs font-semibold">Max Positions</Label>
                  <Input
                    id="maxPos"
                    type="number"
                    min={1}
                    max={20}
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alloc" className="text-xs font-semibold">Allocation %</Label>
                  <Input
                    id="alloc"
                    type="number"
                    min={5}
                    max={100}
                    value={allocation}
                    onChange={(e) => setAllocation(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <Button
                onClick={runSimulation}
                disabled={loading}
                className="w-full h-10 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Start Portfolio Simulation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Columns */}
        <div className="lg:col-span-3 space-y-6">
          {!result && !loading && (
            <Card className="h-[400px] flex items-center justify-center text-center p-6 border-dashed">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6 text-indigo-500" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Ready to Backtest</h3>
                <p className="text-xs text-muted-foreground max-w-sm">Select a stock quick-set or type custom symbols on the left, configure starting capital constraints, and run the simulator.</p>
              </div>
            </Card>
          )}

          {loading && (
            <Card className="h-[400px] flex flex-col items-center justify-center text-center p-6 gap-3">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
              <h3 className="text-sm font-semibold">Running Multi-Stock Quantitative Simulation</h3>
              <p className="text-xs text-muted-foreground max-w-sm">Fetching historical daily candles for universe and benchmark Nifty index, aligning calendar timelines, and executing daily position management.</p>
            </Card>
          )}

          {result && !loading && (
            <>
              {/* Stats overview */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      Net Return
                    </div>
                    <div className={`text-xl font-bold ${result.totalReturnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                      {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct}%
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Percent className="h-3 w-3 text-indigo-500" />
                      Win Rate
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{result.winRate}%</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3 text-red-500" />
                      Max Drawdown
                    </div>
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">{result.maxDrawdown}%</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Award className="h-3 w-3 text-blue-500" />
                      Total Trades
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{result.totalTrades}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-amber-500" />
                      Holding Days
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{result.averageHoldingDays} days</div>
                  </CardContent>
                </Card>
              </div>

              {/* Equity curve chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Portfolio Growth Curve</CardTitle>
                  <CardDescription>Daily combined valuation index vs initial cash allocation</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.equityCurve}>
                        <defs>
                          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis dataKey="date" className="text-[10px] text-muted-foreground" />
                        <YAxis className="text-[10px] text-muted-foreground" />
                        <ChartTooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Area type="monotone" dataKey="equity" name="Net Worth (₹)" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" />
                        <Area type="monotone" dataKey="cash" name="Unused Cash (₹)" stroke="#94a3b8" strokeDasharray="5 5" fill="none" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Trade Log */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-indigo-500" />
                    Portfolio Simulation Trade Log
                  </CardTitle>
                  <CardDescription>Detailed chronological record of executed entries and exits</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                        <TableRow>
                          <TableHead className="text-xs">Symbol</TableHead>
                          <TableHead className="text-xs">Entry Date</TableHead>
                          <TableHead className="text-xs">Entry Price</TableHead>
                          <TableHead className="text-xs">Allocation</TableHead>
                          <TableHead className="text-xs">Exit Date</TableHead>
                          <TableHead className="text-xs">Exit Price</TableHead>
                          <TableHead className="text-xs">Exit Status</TableHead>
                          <TableHead className="text-xs text-right">PnL (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.trades.map((t, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-semibold text-xs">{t.symbol}</TableCell>
                            <TableCell className="text-xs font-mono">{t.entryDate}</TableCell>
                            <TableCell className="text-xs tabular-nums">₹{t.entryPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-xs tabular-nums">₹{t.entryCapital.toLocaleString()}</TableCell>
                            <TableCell className="text-xs font-mono">{t.exitDate}</TableCell>
                            <TableCell className="text-xs tabular-nums">₹{t.exitPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold ${
                                  t.status === 'HIT_TARGET'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border-emerald-200'
                                    : t.status === 'STOPPED_OUT'
                                    ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300 border-red-200'
                                    : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200'
                                }`}
                              >
                                {t.status}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-xs tabular-nums text-right font-bold ${t.pnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                            </TableCell>
                          </TableRow>
                        ))}
                        {result.trades.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-6 text-xs text-muted-foreground">
                              No trades were executed during this simulation period.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
