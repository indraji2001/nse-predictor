'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ShieldCheck, AlertTriangle, Loader2, RefreshCw, CheckCircle2, HelpCircle, XCircle
} from 'lucide-react'

interface DiagnosticReport {
  totalMasterCount: number
  totalActiveCount: number
  missingFromUniverse: Array<{ providedName: string; symbol: string }>
  extraInUniverse: Array<{ symbol: string; name: string }>
  duplicates: string[]
  provider: string
  range: string
  demoCount: number
  demoSymbols: string[]
  error: string | null
  ok: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  provider: string
  range: string
}

export function UniverseHealthDialog({ open, onClose, provider, range }: Props) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<DiagnosticReport | null>(null)

  const runDiagnostic = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dev/health-check?provider=${provider}&range=${range}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (err) {
      console.error('Failed to run diagnostics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      runDiagnostic()
    }
  }, [open, provider, range])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-4 overflow-hidden">
        <DialogHeader className="px-1">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="h-6 w-6 text-emerald-500 fill-emerald-100 dark:fill-emerald-950/30" />
            NSE 500 Universe Health Check
          </DialogTitle>
          <DialogDescription>
            Validates local stock database mappings against the NSE 500 Master Reference list and checks live data health.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-muted-foreground animate-pulse">Running live diagnostics across {provider} feed...</p>
          </div>
        ) : report ? (
          <ScrollArea className="flex-1 pr-3 overflow-y-auto max-h-[55vh]">
            <div className="space-y-4 py-2">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 border rounded-xl bg-card flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Master List Match</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-bold">
                      {report.totalMasterCount - report.missingFromUniverse.length}
                    </span>
                    <span className="text-xs text-muted-foreground">/ {report.totalMasterCount}</span>
                  </div>
                  {report.missingFromUniverse.length === 0 ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 inline" /> 100% Mapped
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 inline" /> {report.missingFromUniverse.length} Missing
                    </span>
                  )}
                </div>

                <div className="p-3 border rounded-xl bg-card flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Live Feed Quality</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-bold">
                      {report.totalActiveCount - report.demoCount}
                    </span>
                    <span className="text-xs text-muted-foreground">/ {report.totalActiveCount}</span>
                  </div>
                  {report.demoCount === 0 ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 inline" /> 0 Demo Fallbacks
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-500 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 inline" /> {report.demoCount} on DEMO
                    </span>
                  )}
                </div>

                <div className="p-3 border rounded-xl bg-card flex flex-col justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Duplicates & Health</span>
                  <div className="mt-2 text-2xl font-bold">
                    {report.duplicates.length === 0 ? 'Clean' : `${report.duplicates.length} Dups`}
                  </div>
                  {report.duplicates.length === 0 ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 inline" /> No duplicate symbols
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 inline" /> Resolve duplicates
                    </span>
                  )}
                </div>
              </div>

              {/* Status Alerts */}
              {report.ok ? (
                <Alert className="border-emerald-200 bg-emerald-50/20 dark:bg-emerald-950/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <AlertTitle className="text-emerald-700 dark:text-emerald-300 font-semibold">All Systems Operational</AlertTitle>
                  <AlertDescription className="text-emerald-600 dark:text-emerald-400 text-xs">
                    All 500 stocks mapped correctly. Historical EOD candles successfully retrieved from {report.provider} for {report.range} range. Zero DEMO fallback values.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="font-semibold">Attention Required</AlertTitle>
                  <AlertDescription className="text-xs">
                    Diagnostics detected issues with symbol mapping or EOD data completeness. See breakdown details below.
                  </AlertDescription>
                </Alert>
              )}

              {/* DEMO Fallbacks breakdown */}
              {report.demoSymbols.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    DEMO Fallback Symbols ({report.demoSymbols.length})
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    These stocks could not fetch {report.range} daily data from Yahoo Finance. Common reasons: stock listed on NSE less than {report.range} ago, ticker was recently changed/merged, or Yahoo database is missing data.
                  </p>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-lg border max-h-40 overflow-y-auto">
                    {report.demoSymbols.map((sym) => (
                      <Badge key={sym} variant="outline" className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 font-mono text-xs">
                        {sym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing mapping breakdown */}
              {report.missingFromUniverse.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-rose-600 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-rose-500" />
                    Missing from Stock Database ({report.missingFromUniverse.length})
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    These stocks are defined in your NSE 500 Master Reference list but are missing in the local database files:
                  </p>
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <table className="min-w-full divide-y text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Company Name</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mapped Symbol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {report.missingFromUniverse.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium">{item.providedName}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-rose-600 dark:text-rose-400">{item.symbol}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Duplicates breakdown */}
              {report.duplicates.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-rose-600 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    Duplicate Database Symbols ({report.duplicates.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-red-50/20 dark:bg-red-950/5 border border-red-200 dark:border-red-950 rounded-lg">
                    {report.duplicates.map((sym, idx) => (
                      <Badge key={idx} variant="destructive" className="font-mono text-xs">
                        {sym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Educational troubleshooting section */}
              <div className="p-3 border bg-muted/20 rounded-xl space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" /> Symbol Mapping FAQ
                </h4>
                <div className="text-xs space-y-2 text-muted-foreground leading-relaxed">
                  <p>
                    <strong>Q: Why do some stocks show DEMO in lookbacks like 2 Years?</strong><br />
                    A: Modern companies like Swiggy, Ather, or Hyundai listed on the stock market recently. Since they don&apos;t have 2 years of trading history, Yahoo Finance returns empty historical prices, causing a fallback. Reducing lookback to 3 Months or 1 Month will load them correctly.
                  </p>
                  <p>
                    <strong>Q: What if a company changes its name?</strong><br />
                    A: If an NSE company changes its symbol (e.g. from <code>ASTERDM</code> to a new ticker), you can edit the symbol mapping in the local file <code>src/lib/stocks/nifty500.ts</code> or add a <code>yahooSymbol</code> override in <code>universe.ts</code>.
                  </p>
                </div>
              </div>

            </div>
          </ScrollArea>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No diagnostic report available.
          </div>
        )}

        <DialogFooter className="border-t pt-3 sm:justify-between px-1 gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={runDiagnostic} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Run Diagnostics Again
          </Button>
          <Button onClick={onClose} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
            Close Dialog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
