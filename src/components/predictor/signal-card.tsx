'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  TrendingUp, TrendingDown, Target, ShieldAlert, Clock, ChevronRight, Activity, Bookmark,
} from 'lucide-react'
import {
  Signal, formatINR, formatPct, confidenceColor, confidenceBg, actionBadge, TIMEFRAME_LABELS, dataSourceBadge, dataQualityBadge,
} from './types'

interface Props {
  signal: Signal
  rank: number
  onOpen: () => void
  onTrack?: (signal: Signal) => void
  isTracked?: boolean
}

export function SignalCard({ signal, rank, onOpen, onTrack, isTracked }: Props) {
  const bullFactors = signal.factors.filter((f) => f.hit && f.direction === 'bullish')
  const bearFactors = signal.factors.filter((f) => f.direction === 'bearish')
  const upsidePct = ((signal.target2 - signal.entry) / signal.entry) * 100
  const downsidePct = ((signal.stopLoss - signal.entry) / signal.entry) * 100

  return (
    <Card className="overflow-hidden border-border/60 hover:border-emerald-400/60 hover:shadow-md transition-all group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">#{rank}</span>
              <CardTitle className="text-base font-bold tracking-tight">{signal.symbol}</CardTitle>
              <Badge variant="outline" className={`text-[10px] font-semibold ${actionBadge(signal.action)}`}>
                {signal.action}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-medium">{signal.sector}</Badge>
              {signal.dataSource && (() => {
                const ds = dataSourceBadge(signal.dataSource)
                return (
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-mono ${ds.className}`}
                    title={ds.title}
                  >
                    {ds.label}
                  </Badge>
                )
              })()}
              {signal.dataQuality && signal.dataSource !== 'DEMO' && (() => {
                const dq = dataQualityBadge(signal.dataQuality)
                return (
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-mono ${dq.className}`}
                    title={dq.title}
                  >
                    {dq.label}
                  </Badge>
                )
              })()}
            </div>
            <p className="text-xs text-muted-foreground truncate">{signal.name}</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-2xl font-bold tabular-nums ${confidenceColor(signal.confidence)}`}>
              {signal.confidence}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Confidence</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Confidence bar */}
        <div className="space-y-1">
          <Progress value={signal.confidence} className={`h-1.5 ${confidenceBg(signal.confidence)}`} />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{bullFactors.length} bullish / {bearFactors.length} bearish factors</span>
            <span>RR 1:{(signal.riskReward ?? 0).toFixed(1)}</span>
          </div>
        </div>

        {/* LTP + today's change */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">LTP</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{formatINR(signal.entry)}</span>
            <span className={`text-xs tabular-nums ${signal.snapshot.ret5d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatPct(signal.snapshot.ret5d)} (5d)
            </span>
          </div>
        </div>

        {/* Trade plan grid */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Entry
            </div>
            <div className="font-semibold tabular-nums">{formatINR(signal.entry)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatINR(signal.entryRangeLow)} – {formatINR(signal.entryRangeHigh)}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <ShieldAlert className="h-3 w-3 text-red-500" /> Stop Loss
            </div>
            <div className="font-semibold tabular-nums text-red-600 dark:text-red-400">{formatINR(signal.stopLoss)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">{formatPct(downsidePct)}</div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className="h-3 w-3 text-emerald-500" /> Target 1
            </div>
            <div className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatINR(signal.target1)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">{formatPct(((signal.target1 - signal.entry) / signal.entry) * 100)}</div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className="h-3 w-3 text-emerald-600" /> Target 2
            </div>
            <div className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatINR(signal.target2)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">{formatPct(upsidePct)}</div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className="h-3 w-3 text-emerald-700" /> Target 3
            </div>
            <div className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">{formatINR(signal.target3)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">{formatPct(((signal.target3 - signal.entry) / signal.entry) * 100)}</div>
          </div>
        </div>

        {/* Top reasons */}
        <div className="space-y-1 pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" /> Key triggers
          </div>
          <div className="flex flex-wrap gap-1">
            {bullFactors.slice(0, 4).map((f, i) => (
              <TooltipProvider key={i} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                      <TrendingUp className="h-2.5 w-2.5" /> {f.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {f.detail}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {bullFactors.length > 4 && (
              <span className="text-[10px] text-muted-foreground px-1 py-0.5">+{bullFactors.length - 4} more</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
          <div className="flex items-center gap-1.5 text-[11px] min-w-0">
            <Clock className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-muted-foreground truncate" title={signal.holdingPeriod}>
              <span className="font-medium text-foreground">Hold:</span> {signal.holdingPeriod}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onTrack && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-7 text-xs gap-1 ${isTracked ? 'text-violet-600 dark:text-violet-400' : ''}`}
                      onClick={() => onTrack(signal)}
                      disabled={isTracked}
                    >
                      <Bookmark className={`h-3 w-3 ${isTracked ? 'fill-current' : ''}`} />
                      {isTracked ? 'Tracked' : 'Track'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isTracked ? 'Already tracking this trade' : 'Add to paper trades — track if T1/T2/T3 hit'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 group-hover:gap-2 transition-all" onClick={onOpen}>
              Analysis <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
