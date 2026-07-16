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

  useEffect(() => {
    if (open) refresh()
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
      } else {
        toast.error(`NSE fetch failed`, { description: j.error ?? 'Unknown' })
      }
    } finally {
      setFetching(false)
    }
  }

  const handleBackfill = async () => {
    setBackfilling(true)
    try {
      const r = await fetch(`/api/bhavcopy/backfill?days=${backfillDays}`, { method: 'POST' })
      const j = await r.json()
      toast.success(`Backfill complete`, {
        description: `Fetched ${j.fetched} new, skipped ${j.skipped} existing${j.errors?.length ? `, ${j.errors.length} errors` : ''}`,
      })
      await refresh()
    } finally {
      setBackfilling(false)
    }
  }

  const handleDelete = async (date: string) => {
    if (!confirm(`Delete archived bhavcopy for ${date}?`)) return
    await fetch(`/api/bhavcopy/list?delete=${date}`)
    toast.success(`Deleted ${date}`)
    await refresh()
  }

  const fmtSize = (b: number) => {
    if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`
    if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`
    return `${b} B`
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-blue-600" />
            NSE Bhavcopy Archive
            {archive && (
              <Badge variant="outline" className="ml-2 text-[10px] font-mono">
                {archive.count} files · {fmtSize(archive.totalSizeBytes)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Local archive of NSE daily bhavcopy files. The predictor uses this as the primary data source
            (before Yahoo Finance). Upload files you've downloaded from NSE, or auto-fetch from NSE
            (may be blocked from cloud IPs — upload is the reliable path).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)]">
          <div className="p-4 space-y-4">
            {/* How-to card */}
            <Alert className="border-blue-300/60 bg-blue-50/40 dark:bg-blue-950/20">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-xs text-blue-800 dark:text-blue-300">How to download bhavcopy from NSE</AlertTitle>
              <AlertDescription className="text-[11px] text-blue-700 dark:text-blue-400 space-y-1">
                <div>1. Open <a href="https://www.nseindia.com/all-reports" target="_blank" rel="noreferrer" className="underline">https://www.nseindia.com/all-reports</a></div>
                <div>2. Navigate to <strong>Equities → Daily Reports → Bhavcopy</strong></div>
                <div>3. Pick a date → download <strong>"Securities - full bhavcopy"</strong> CSV</div>
                <div>4. Drag & drop the file below (or click Upload). The date is auto-detected from the filename.</div>
                <div>5. After ~30 days of archives, the predictor can run on NSE data alone (no Yahoo needed).</div>
              </AlertDescription>
            </Alert>

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Upload */}
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

              {/* Fetch today */}
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

              {/* Backfill */}
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

            {/* Archive list */}
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

            <Separator />

            {/* Help text */}
            <div className="text-[10px] text-muted-foreground space-y-1">
              <p><strong>Why upload manually?</strong> NSE blocks cloud IPs aggressively. Auto-fetch may return HTTP 403. Manual upload is the reliable path — once you've uploaded ~30 days, the predictor runs on NSE data alone.</p>
              <p><strong>What about history?</strong> You can backfill up to 60 days. For older data, download monthly archives from NSE and upload them one by one. After ~120 days archived, the predictor's full indicator suite (RSI 14, MACD 12/26, EMA 200, etc.) becomes available.</p>
              <p><strong>Storage:</strong> Each bhavcopy is ~5-10 MB. One year ≈ 2.5 GB. Files live in <code>/data/bhavcopy/</code> inside the app's working directory.</p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-3 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
