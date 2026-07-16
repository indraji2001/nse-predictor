'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Wifi, WifiOff, ExternalLink, Loader2, CheckCircle2, XCircle, ShieldCheck, Zap, KeyRound, RefreshCw,
} from 'lucide-react'

interface UpstoxStatus {
  configured: boolean
  connected: boolean
  tokenExpiresAt: string | null
  lastUsedAt: string | null
  redirectUri: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onConnected?: () => void // refresh parent state if connection changes
}

export function UpstoxSettingsDialog({ open, onClose, onConnected }: Props) {
  const [status, setStatus] = useState<UpstoxStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [refreshingInstruments, setRefreshingInstruments] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; profile?: { email?: string; name?: string }; error?: string } | null>(null)

  // Form state
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [saving, setSaving] = useState(false)

  // Detect current host for the redirect URI suggestion
  useEffect(() => {
    if (typeof window !== 'undefined' && !redirectUri) {
      setRedirectUri(`${window.location.origin}/api/upstox/callback`)
    }
  }, [redirectUri])

  const refreshStatus = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/upstox/status', { cache: 'no-store' })
      const s: UpstoxStatus = await r.json()
      setStatus(s)
      // Pre-fill the form with the existing redirect URI
      if (s.redirectUri && !redirectUri) setRedirectUri(s.redirectUri)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) refreshStatus()
  }, [open])

  const handleSave = async () => {
    if (!apiKey.trim() || !apiSecret.trim() || !redirectUri.trim()) {
      toast.error('All three fields are required')
      return
    }
    if (!redirectUri.startsWith('https://')) {
      toast.error('Redirect URI must be HTTPS')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/upstox/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret, redirectUri }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error ?? 'Failed to save')
      }
      toast.success('Credentials saved. Now click "Authorize with Upstox" to login.')
      setApiKey('')
      setApiSecret('')
      await refreshStatus()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleConnect = () => {
    // Trigger the OAuth flow in the same tab — the callback will redirect back here
    window.location.href = '/api/upstox/connect'
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await fetch('/api/upstox/disconnect', { method: 'POST' })
      toast.success('Disconnected from Upstox')
      setTestResult(null)
      await refreshStatus()
      onConnected?.()
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch('/api/upstox/test', { cache: 'no-store' })
      const json = await r.json()
      setTestResult(json)
      if (json.ok) {
        toast.success(`Connected as ${json.profile?.name ?? json.profile?.email ?? 'Upstox user'}`)
      } else {
        toast.error(`Test failed: ${json.error ?? 'unknown'}`)
      }
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Unknown' })
      toast.error('Test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleRefreshInstruments = async () => {
    setRefreshingInstruments(true)
    try {
      const r = await fetch('/api/upstox/refresh-instruments', { method: 'POST' })
      const json = await r.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Instrument master refreshed (${json.count} NSE stocks mapped)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshingInstruments(false)
    }
  }

  const isConnected = status?.configured && status?.connected

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-violet-600" />
            Upstox Data Integration
            {status && (
              <Badge
                variant="outline"
                className={`ml-2 text-[10px] font-mono ${
                  isConnected
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : status.configured
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isConnected ? '● CONNECTED' : status.configured ? '◐ NEEDS AUTH' : '○ NOT CONFIGURED'}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Connect your free Upstox developer account for real-time + EOD data across all NSE stocks.
            No monthly fees. Falls back to Yahoo Finance when not connected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Connection status card */}
          {status && (
            <Alert className={isConnected ? 'border-emerald-300/60 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20'}>
              {isConnected ? (
                <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <AlertTitle className="text-xs">
                {isConnected ? 'Upstox is connected' : status.configured ? 'Credentials saved — authorize to connect' : 'Not configured yet'}
              </AlertTitle>
              <AlertDescription className="text-[11px] space-y-1">
                {status.tokenExpiresAt && (
                  <div>Token expires: {new Date(status.tokenExpiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                )}
                {status.lastUsedAt && (
                  <div>Last used: {new Date(status.lastUsedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                )}
                {isConnected && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={handleTest} disabled={testing} className="h-7 text-xs gap-1">
                      {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Test connection
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleRefreshInstruments} disabled={refreshingInstruments} className="h-7 text-xs gap-1">
                      {refreshingInstruments ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Refresh instruments
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={loading} className="h-7 text-xs gap-1 text-red-600 dark:text-red-400">
                      <XCircle className="h-3 w-3" /> Disconnect
                    </Button>
                  </div>
                )}
                {testResult && (
                  <div className={`mt-2 text-[11px] ${testResult.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                    {testResult.ok
                      ? `✓ Authenticated as ${testResult.profile?.name ?? testResult.profile?.email ?? 'Upstox user'}`
                      : `✗ ${testResult.error}`}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Step 1: Get credentials from Upstox */}
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px]">1</span>
              Get your free API credentials
            </div>
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside ml-2">
              <li>Open the <a href="https://upstox.com/developer/api-console" target="_blank" rel="noreferrer" className="text-violet-600 dark:text-violet-400 underline inline-flex items-center gap-0.5">Upstox Developer Portal <ExternalLink className="h-2.5 w-2.5 inline" /></a> and log in with your Upstox account</li>
              <li>Click <strong>"Create new app"</strong> and pick <strong>Redirect URL</strong> = the URL shown below</li>
              <li>After creating the app, copy your <strong>API Key</strong> and <strong>API Secret</strong></li>
              <li>You must have an Upstox demat account (free to open if you don't have one)</li>
            </ol>
            <div className="bg-muted/50 rounded p-2 text-[11px]">
              <div className="text-muted-foreground mb-0.5">Redirect URL to use in Upstox portal:</div>
              <code className="text-violet-700 dark:text-violet-300 break-all">{redirectUri || `${typeof window !== 'undefined' ? window.location.origin : 'https://your-app.com'}/api/upstox/callback`}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] ml-2"
                onClick={() => {
                  navigator.clipboard.writeText(redirectUri || `${window.location.origin}/api/upstox/callback`)
                  toast.success('Redirect URL copied')
                }}
              >
                Copy
              </Button>
            </div>
          </div>

          {/* Step 2: Enter credentials */}
          <div className="rounded-lg border border-border/60 p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px]">2</span>
              Enter your API credentials
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="upstox-key" className="text-[11px] flex items-center gap-1"><KeyRound className="h-3 w-3" /> API Key</Label>
                <Input
                  id="upstox-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. 7402ab..."
                  className="h-8 text-xs font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="upstox-secret" className="text-[11px] flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> API Secret</Label>
                <Input
                  id="upstox-secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="e.g. 9k2l3..."
                  type="password"
                  className="h-8 text-xs font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="upstox-redirect" className="text-[11px]">Redirect URI</Label>
                <Input
                  id="upstox-redirect"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="https://your-app.com/api/upstox/callback"
                />
              </div>
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs gap-1 w-full">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Save credentials
              </Button>
            </div>
          </div>

          {/* Step 3: Authorize */}
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px]">3</span>
              Authorize the app
            </div>
            <p className="text-[11px] text-muted-foreground ml-2">
              Click the button below to log into Upstox and grant this app access to your account.
              You'll be redirected back here once authorized.
            </p>
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={!status?.configured}
              className="h-8 text-xs gap-1 w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              <ExternalLink className="h-3 w-3" />
              Authorize with Upstox
            </Button>
            {!status?.configured && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 ml-2">Save credentials in step 2 first.</p>
            )}
          </div>

          <Separator />

          <div className="text-[10px] text-muted-foreground space-y-1">
            <p><strong>Privacy:</strong> Your API secret and access token are stored only in this app's local database (SQLite). They are never sent to any third party except Upstox's own API servers.</p>
            <p><strong>Cost:</strong> Upstox API is free for personal trading applications. No monthly fees, no per-call charges.</p>
            <p><strong>Fallback:</strong> If Upstox isn't connected or a stock isn't available there, the predictor automatically falls back to Yahoo Finance (also free) and finally to synthetic data.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
