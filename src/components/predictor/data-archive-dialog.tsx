'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Database, Upload, Download, Trash2, Loader2, FileText, Calendar, HardDrive, CheckCircle2, XCircle, Info,
} from 'lucide-react'

interface ArchivedFile {
  date: string
  filename: string
  sizeBytes: number
  stockCount: number
  source: 'NSE' | 'UPLOAD'
}

interface ArchiveList {
  files: ArchivedFile[]
  count: number
  totalSizeBytes: number
  oldestDate: string | null
  newestDate: string | null
}

interface Props {
  open: boolean
  onClose: () => void
}

export function DataArchiveDialog({ open, onClose }: Props) {
  const [archive, setArchive] = useState<ArchiveList | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillDays, setBackfillDays] = useState(5)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [activeTab, setActiveTab] = useState<'bhavcopy' | 'database'>('bhavcopy')
  const [dbStats, setDbStats] = useState<{ totalCount: number; eodCount: number; intradayCount: number; estimatedSizeMB: number; maxLimitMB: number; percentUsed: number } | null>(null)
  const [dbLoading, setDbLoading] = useState(false)
  const [pruneDays, setPruneDays] = useState(90)
  const [pruneEodYear, setPruneEodYear] = useState('2020')

  const refresh = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/bhavcopy/list', { cache: 'no-store' })
      const j = await r.json()
      setArchive(j)
    } catch (e) {
      toast.error('Failed to load archive')
    } finally {
      setLoading(false)
    }
  }

  const refreshDbStats = async () => {
    setDbLoading(true)
    try {
      const r = await fetch('/api/admin/storage', { cache: 'no-store' })
      const j = await r.json()
      setDbStats(j)
    } catch (e) {
      console.error('Failed to load storage stats')
    } finally {
      setDbLoading(false)
    }
  }

  const handlePruneIntraday = async () => {
    if (!confirm(`Are you sure you want to delete all 5m intraday data older than ${pruneDays} days?`)) return
    try {
      const r = await fetch('/api/admin/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prune', days: pruneDays })
      })
      const j = await r.json()
      if (r.ok) {
        toast.success(j.message || 'Pruning successful')
        refreshDbStats()
      } else {
        toast.error(j.error || 'Pruning failed')
      }
    } catch (e) {
      toast.error('Network error during pruning')
    }
  }

  const handlePruneEod = async () => {
    const beforeDate = `${pruneEodYear}-01-01`
    if (!confirm(`Are you sure you want to permanently delete all EOD historical candles older than ${beforeDate}?`)) return
    try {
      const r = await fetch('/api/admin/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_eod', beforeDate })
      })
      const j = await r.json()
      if (r.ok) {
        toast.success(j.message || 'Pruning successful')
        refreshDbStats()
      } else {
        toast.error(j.error || 'Pruning failed')
      }
    } catch (e) {
      toast.error('Network error during pruning')
    }
  }

  const handleResetCache = async () => {
    if (!confirm('WARNING: Are you sure you want to clear the ENTIRE database cache? This will delete all 10-year historical EOD data and require a full rebuild.')) return
    try {
      const r = await fetch('/api/admin/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })
      const j = await r.json()
      if (r.ok) {
        toast.success('Database cache reset successfully')
        refreshDbStats()
      } else {
        toast.error(j.error || 'Reset failed')
      }
    } catch (e) {
      toast.error('Network error during reset')
    }
  }

  useEffect(() => {
    if (open) {
      refresh()
      refreshDbStats()
    }
  }, [open])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    let success = 0
    let failed = 0
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetch('/api/bhavcopy/upload', { method: 'POST', body: fd })
        const j = await r.json()
        if (r.ok && j.ok) {
          success++
        } else {
          failed++
          toast.error(`Failed: ${file.name}`, { description: j.error ?? 'Unknown error' })
        }
      } catch (e) {
        failed++
      }
    }
    setUploading(false)
    if (success > 0) {
      toast.success(`Uploaded ${success} file${success > 1 ? 's' : ''}`, {
        description: failed > 0 ? `${failed} failed` : 'Archive updated',
      })
      await refresh()
      await refreshDbStats()
    }
  }

  const handleFetchToday = async () => {
    setFetching(true)
    try {
      const r = await fetch('/api/bhavcopy/fetch', { cache: 'no-store' })
      const j = await r.json()
      if (j.ok) {
        toast.success(`Fetched ${j.date}`, { description: `${j.stockCount} stocks saved to archive` })
        await refresh()
        await refreshDbStats()
      } else {
        toast.error(`Fetch failed`, { description: j.error })
      }
    } catch (e) {
      toast.error('Network error fetching bhavcopy')
    } finally {
      setFetching(false)
    }
  }

  const handleBackfill = async () => {
    setBackfilling(true)
    try {
      const r = await fetch(`/api/bhavcopy/backfill?days=${backfillDays}`, { cache: 'no-store' })
      const j = await r.json()
      if (j.fetched > 0 || j.skipped > 0) {
        toast.success(`Backfill complete`, {
          description: `Fetched ${j.fetched} days, skipped ${j.skipped} days. ${j.errors?.length || 0} errors.`,
        })
        await refresh()
        await refreshDbStats()
      } else {
        toast.error(`Backfill failed`, { description: j.errors?.[0] || 'Unknown' })
      }
    } catch (e) {
      toast.error('Network error backfilling')
    } finally {
      setBackfilling(false)
    }
  }

  const handleDelete = async (date: string) => {
    if (!confirm(`Delete archived bhavcopy for ${date}?`)) return
    try {
      const r = await fetch(`/api/bhavcopy/delete?date=${date}`, { method: 'DELETE' })
      const j = await r.json()
      if (j.ok) {
        toast.success(`Deleted ${date}`)
        await refresh()
        await refreshDbStats()
      } else {
        toast.error(`Delete failed`, { description: j.error })
      }
    } catch (e) {
      toast.error('Network error deleting')
    }
  }

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden sm:rounded-lg">
        <DialogHeader className="p-4 border-b border-border/60">
          <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Database className="h-4 w-4 text-blue-600" /> Storage & Archive Manager
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage your local NSE Bhavcopy archives and cloud database candle cache.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex border-b border-border/40 bg-muted/40 p-1 gap-1">
          <button
            onClick={() => setActiveTab('bhavcopy')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'bhavcopy'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/20 hover:text-foreground'
            }`}
          >
            File Archive (NSE)
          </button>
          <button
            onClick={() => {
              setActiveTab('database')
              refreshDbStats()
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'database'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/20 hover:text-foreground'
            }`}
          >
            Database Cache (Turso)
          </button>
        </div>

        <ScrollArea className="max-h-[calc(90vh-210px)]">
          <div className="p-4 space-y-4">
            {activeTab === 'bhavcopy' ? (
              <>
                <Alert className="border-blue-300/60 bg-blue-50/40 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-xs text-blue-800 dark:text-blue-300">How to download bhavcopy from NSE</AlertTitle>
                  <AlertDescription className="text-[11px] text-blue-700 dark:text-blue-400 space-y-1">
                    <div>1. Open <a href="https://www.nseindia.com/all-reports" target="_blank" rel="noreferrer" className="underline font-semibold">https://www.nseindia.com/all-reports</a></div>
                    <div>2. Navigate to <strong>Equities → Daily Reports → Bhavcopy</strong></div>
                    <div>3. Pick a date → download <strong>"Securities - full bhavcopy"</strong> CSV</div>
                    <div>4. Drag & drop the file below (or click Upload). Date is auto-detected.</div>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    className="border-2 border-dashed border-border/60 rounded-lg p-3 text-center hover:border-blue-400/60 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400') }}
                    onDragLeave={(e) => e.currentTarget.classList.remove('border-blue-400')}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-blue-400')
                      handleUpload(e.dataTransfer.files)
                    }}
                  >
                    <Upload className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                    <div className="text-xs font-medium">
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                      Upload CSV
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Drag & drop or click</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                  </div>

                  <button
                    onClick={handleFetchToday}
                    disabled={fetching}
                    className="border border-border/60 rounded-lg p-3 text-center hover:border-blue-400/60 transition-colors disabled:opacity-50"
                  >
                    <Download className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs font-medium">
                      {fetching ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                      Fetch today
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Auto-download from NSE</div>
                  </button>

                  <button
                    onClick={handleBackfill}
                    disabled={backfilling}
                    className="border border-border/60 rounded-lg p-3 text-center hover:border-blue-400/60 transition-colors disabled:opacity-50"
                  >
                    <Calendar className="h-5 w-5 mx-auto mb-1 text-violet-600" />
                    <div className="text-xs font-medium">
                      {backfilling ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                      Backfill {backfillDays}d
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={backfillDays}
                        onChange={(e) => setBackfillDays(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-12 inline bg-transparent border-b border-border text-center text-[10px]"
                      /> days
                    </div>
                  </button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium flex items-center gap-1">
                      <HardDrive className="h-3.5 w-3.5" /> Archived files
                    </span>
                    {archive && archive.count > 0 && (
                      <span className="text-muted-foreground text-[11px]">
                        {archive.oldestDate} → {archive.newestDate}
                      </span>
                    )}
                  </div>

                  {loading && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Loading archive…
                    </div>
                  )}

                  {!loading && archive && archive.count === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                      <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      No archived files yet. Upload a bhavcopy CSV above to get started.
                    </div>
                  )}

                  {!loading && archive && archive.files.length > 0 && (
                    <div className="max-h-64 overflow-y-auto border border-border/40 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">Date</th>
                            <th className="text-right p-2 font-medium">Stocks</th>
                            <th className="text-right p-2 font-medium">Size</th>
                            <th className="text-center p-2 font-medium">Source</th>
                            <th className="p-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {archive.files.map((f) => (
                            <tr key={f.date} className="border-t border-border/30 hover:bg-muted/30">
                              <td className="p-2 font-mono">{f.date}</td>
                              <td className="p-2 text-right tabular-nums">{f.stockCount.toLocaleString()}</td>
                              <td className="p-2 text-right tabular-nums text-muted-foreground">{fmtSize(f.sizeBytes)}</td>
                              <td className="p-2 text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] font-mono ${
                                    f.source === 'NSE'
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  }`}
                                >
                                  {f.source}
                                </Badge>
                              </td>
                              <td className="p-1 text-right">
                                <button
                                  onClick={() => handleDelete(f.date)}
                                  className="text-muted-foreground hover:text-red-600 p-1"
                                  title={`Delete ${f.date}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="border border-border/60 rounded-lg p-3 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Turso Cloud Storage Status</span>
                    <button
                      onClick={refreshDbStats}
                      className="text-blue-600 hover:underline flex items-center gap-1 font-normal"
                    >
                      {dbLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Refresh
                    </button>
                  </div>

                  {dbStats ? (
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Used: {dbStats.estimatedSizeMB.toFixed(2)} MB</span>
                          <span>Limit: 5,000 MB (5 GB)</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/40">
                          <div
                            className={`h-full transition-all duration-300 ${
                              dbStats.percentUsed > 80
                                ? 'bg-red-500'
                                : dbStats.percentUsed > 50
                                ? 'bg-amber-500'
                                : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.max(1, Math.min(100, dbStats.percentUsed))}%` }}
                          />
                        </div>
                        <div className="text-right text-[9px] text-muted-foreground">
                          {dbStats.percentUsed}% of storage quota used
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-background rounded p-2 border border-border/40">
                          <div className="text-[10px] text-muted-foreground">EOD Candles</div>
                          <div className="font-semibold font-mono mt-0.5">{dbStats.eodCount.toLocaleString()}</div>
                        </div>
                        <div className="bg-background rounded p-2 border border-border/40">
                          <div className="text-[10px] text-muted-foreground">Intraday (5m)</div>
                          <div className="font-semibold font-mono mt-0.5">{dbStats.intradayCount.toLocaleString()}</div>
                        </div>
                        <div className="bg-background rounded p-2 border border-border/40">
                          <div className="text-[10px] text-muted-foreground">Total Rows</div>
                          <div className="font-semibold font-mono mt-0.5">{dbStats.totalCount.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Fetching database metrics…
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" /> Pruning & Maintenance Tools
                  </div>

                  <div className="border border-border/60 rounded-lg p-3 space-y-2 text-xs">
                    <div className="font-semibold flex justify-between items-center">
                      <span>Prune Intraday (5m) Candles</span>
                      <Badge className="bg-violet-50 text-violet-700 dark:bg-violet-950/40 border-violet-300">Intraday Only</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Deletes raw 5-minute candles older than the selected timeframe to keep your storage usage small. EOD daily candles are preserved.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={pruneDays}
                        onChange={(e) => setPruneDays(parseInt(e.target.value))}
                        className="bg-background border border-border rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="30">Older than 30 Days (Recommended)</option>
                        <option value="60">Older than 60 Days</option>
                        <option value="90">Older than 90 Days</option>
                        <option value="180">Older than 180 Days</option>
                      </select>
                      <Button
                        onClick={handlePruneIntraday}
                        variant="outline"
                        size="sm"
                        className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
                      >
                        Prune Intraday
                      </Button>
                    </div>
                  </div>

                  <div className="border border-border/60 rounded-lg p-3 space-y-2 text-xs">
                    <div className="font-semibold flex justify-between items-center">
                      <span>Prune Historical EOD Candles</span>
                      <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 border-blue-300">EOD History</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Deletes EOD daily candles stored before a specific year. Useful if you want to free up space from very old years.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={pruneEodYear}
                        onChange={(e) => setPruneEodYear(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="2016">Before 2016-01-01</option>
                        <option value="2018">Before 2018-01-01</option>
                        <option value="2020">Before 2020-01-01</option>
                        <option value="2022">Before 2022-01-01</option>
                      </select>
                      <Button
                        onClick={handlePruneEod}
                        variant="outline"
                        size="sm"
                        className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
                      >
                        Prune History
                      </Button>
                    </div>
                  </div>

                  <div className="border border-red-200 dark:border-red-950/60 rounded-lg p-3 space-y-2 bg-red-500/5 text-xs">
                    <div className="font-semibold text-red-600 dark:text-red-400">Danger Zone — Clear Database Cache</div>
                    <p className="text-[10px] text-muted-foreground">
                      Deletes ALL candle cache data (both EOD and Intraday) for all sources. Your database will be completely emptied. Gaps will be re-downloaded incrementally on the next Refresh.
                    </p>
                    <div className="pt-1">
                      <Button
                        onClick={handleResetCache}
                        variant="destructive"
                        size="sm"
                        className="text-xs font-semibold bg-red-600 hover:bg-red-700"
                      >
                        Reset Entire Cache
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-3 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
