'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  TrendingUp, TrendingDown, Target, ShieldAlert, Clock, Trash2, Activity, Award,
} from 'lucide-react'
import { formatINR, formatPct } from './types'

export interface PaperTrade {
  id: string
  symbol: string
  name: string
  sector: string
  timeframe: string
  entryPrice: number
  stopLoss: number
  target1: number
  target2: number
  target3: number
  riskReward: number
  holdingPeriod: string
  confidence: number
  status: string
  currentPrice: number | null
  maxPrice: number
  minPrice: number
  pnlPct: number
  hitTargets: string // JSON array
  trackedAt: string
  updatedAt: string
  closedAt: string | null
}

interface Props {
  trade: PaperTrade
  onDelete: (id: string) => void
  onClose: (id: string) => void
}

const TIMEFRAME_LABEL: Record<string, string> = {
  BTST: 'BTST',
  SHORT_TERM: 'Short',
  MIDTERM: 'Mid',
  LONG_TERM: 'Long',
}

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'ACTIVE':
      return { label: '● Active', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800' }
    case 'HIT_T1':
      return { label: '✓ T1 Hit', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' }
    case 'HIT_T2':
      return { label: '✓✓ T2 Hit', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' }
    case 'HIT_T3':
      return { label: '★★ T3 Hit', className: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-300 dark:border-violet-800' }
    case 'STOPPED_OUT':
      return { label: '✗ Stopped', className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300 dark:border-red-800' }
    case 'CLOSED':
      return { label: '○ Closed', className: 'bg-muted text-muted-foreground border-border' }
    default:
      return { label: status, className: 'bg-muted text-muted-foreground border-border' }
  }
}

export function PaperTradeCard({ trade, onDelete, onClose }: Props) {
  const sb = statusBadge(trade.status)
  const hitTargets: string[] = JSON.parse(trade.hitTargets || '[]')
  const isActive = trade.status === 'ACTIVE'
  // P&L color logic: strictly positive = green, strictly negative = red, exactly 0 = neutral
  // (Previously used `>= 0`, which made 0.00% show as green even when current price = entry — misleading)
  const pnlValue = trade.pnlPct || 0
  const pnlPositive = pnlValue > 0
  const pnlNegative = pnlValue < 0
  const pnlColorClass = pnlPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : pnlNegative
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground'
  const daysSinceTracked = Math.floor((Date.now() - new Date(trade.trackedAt).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <Card className={`overflow-hidden border-border/60 ${
      trade.status === 'HIT_T3' ? 'border-violet-300/60 bg-violet-50/20 dark:bg-violet-950/10' :
      trade.status === 'STOPPED_OUT' ? 'border-red-300/60 bg-red-50/20 dark:bg-red-950/10' :
      trade.status === 'HIT_T1' || trade.status === 'HIT_T2' ? 'border-emerald-300/60 bg-emerald-50/20 dark:bg-emerald-950/10' :
      ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-bold tracking-tight">{trade.symbol}</CardTitle>
              <Badge variant="outline" className={`text-[10px] font-mono ${sb.className}`}>
                {sb.label}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-medium">{TIMEFRAME_LABEL[trade.timeframe] ?? trade.timeframe}</Badge>
              <Badge variant="outline" className="text-[10px]">{trade.sector}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{trade.name}</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xl font-bold tabular-nums ${pnlColorClass}`}>
              {formatPct(trade.pnlPct || 0)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">P&L</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Price progress visualization */}
        <div className="space-y-1.5">
          {/* Targets row */}
          <div className="grid grid-cols-5 gap-1 text-[10px]">
            <div className="text-center">
              <div className="text-muted-foreground">SL</div>
              <div className="font-mono text-red-600 dark:text-red-400 tabular-nums">{formatINR(trade.stopLoss, { compact: true })}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Entry</div>
              <div className="font-mono font-semibold tabular-nums">{formatINR(trade.entryPrice, { compact: true })}</div>
            </div>
            <div className={`text-center ${hitTargets.includes('T1') ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
              <div className="text-muted-foreground">{hitTargets.includes('T1') ? '✓ T1' : 'T1'}</div>
              <div className="font-mono tabular-nums">{formatINR(trade.target1, { compact: true })}</div>
            </div>
            <div className={`text-center ${hitTargets.includes('T2') ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>
              <div className="text-muted-foreground">{hitTargets.includes('T2') ? '✓ T2' : 'T2'}</div>
              <div className="font-mono tabular-nums">{formatINR(trade.target2, { compact: true })}</div>
            </div>
            <div className={`text-center ${hitTargets.includes('T3') ? 'text-violet-600 dark:text-violet-400 font-bold' : ''}`}>
              <div className="text-muted-foreground">{hitTargets.includes('T3') ? '★ T3' : 'T3'}</div>
              <div className="font-mono tabular-nums">{formatINR(trade.target3, { compact: true })}</div>
            </div>
          </div>

          {/* Progress bar: SL (0%) → Entry (50%) → T3 (100%) */}
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            {/* Risk zone (SL to Entry) - red */}
            <div className="absolute inset-y-0 left-0 bg-red-200 dark:bg-red-950/40" style={{ width: '50%' }} />
            {/* Reward zone (Entry to T3) - green gradient */}
            <div className="absolute inset-y-0 left-1/2 bg-gradient-to-r from-emerald-300 to-violet-400 opacity-70" style={{ width: '50%' }} />
            {/* Current price marker */}
            {trade.currentPrice && (() => {
              // Map price to 0-100% on the SL → T3 scale
              const range = trade.target3 - trade.stopLoss
              if (range <= 0) return null
              const pct = ((trade.currentPrice - trade.stopLoss) / range) * 100
              const clampedPct = Math.max(0, Math.min(100, pct))
              return (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-foreground shadow-md"
                  style={{ left: `calc(${clampedPct}% - 2px)` }}
                  title={`Current: ${formatINR(trade.currentPrice)}`}
                />
              )
            })()}
          </div>
        </div>

        {/* Current price + max/min */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Current</div>
            <div className={`font-semibold tabular-nums ${pnlColorClass}`}>
              {trade.currentPrice ? formatINR(trade.currentPrice) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">High since entry</div>
            <div className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatINR(trade.maxPrice, { compact: true })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Low since entry</div>
            <div className="font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatINR(trade.minPrice, { compact: true })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{daysSinceTracked}d ago · conf {trade.confidence}</span>
          </div>
          <div className="flex items-center gap-1">
            {isActive && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onClose(trade.id)}>
                      <Award className="h-3 w-3" /> Close
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Manually close this trade (mark as CLOSED)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 dark:text-red-400" onClick={() => onDelete(trade.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete this trade permanently</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
