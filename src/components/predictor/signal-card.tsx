'use client'

import { memo } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  TrendingUp, TrendingDown, Target, ShieldAlert, Clock, ChevronRight, Activity, Bookmark, Sparkles,
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
  direction?: 'BUY' | 'SELL'
}

function SignalCardInner({ signal, rank, onOpen, onTrack, isTracked, direction = 'BUY' }: Props) {
  const isSell = direction === 'SELL'
  const bullFactors = signal.factors.filter((f) => f.hit && f.direction === 'bullish')
  const bearFactors = signal.factors.filter((f) => f.hit && f.direction === 'bearish')
  const keyFactors = isSell ? bearFactors : bullFactors
  // For SELL: upside is price going DOWN toward T2, downside is SL above entry
  const targetPct = isSell
    ? ((signal.entry - signal.target2) / signal.entry) * 100   // profit toward T2 = entry minus target
    : ((signal.target2 - signal.entry) / signal.entry) * 100   // profit toward T2 = target minus entry
  const slPct = isSell
    ? ((signal.stopLoss - signal.entry) / signal.entry) * 100  // SL above entry = positive % for SELL
    : ((signal.stopLoss - signal.entry) / signal.entry) * 100  // SL below entry = negative % for BUY

  return (
    <Card className={`overflow-hidden border-border/60 hover:shadow-md transition-all group ${
      isSell
        ? 'hover:border-red-400/60 dark:hover:border-red-500/50'
        : 'hover:border-emerald-400/60'
    }`}>
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
              {signal.mlProbability !== undefined && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900 gap-1"
                  title="Probability of >=5% gain in 10 days calculated by LightGBM machine learning model"
                >
                  <Sparkles className="h-2.5 w-2.5 fill-current" />
                  ML Prob: {signal.mlProbability}%
                </Badge>
              )}
              {signal.targetPrice && (
                (() => {
                  const targetUpside = ((signal.targetPrice - signal.entry) / signal.entry) * 100
                  const isPositive = targetUpside >= 0
                  return (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold gap-1 ${
                        isPositive 
                          ? 'bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900' 
                          : 'bg-rose-50/50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                      }`}
                      title={`Average broker price target is ₹${signal.targetPrice.toFixed(2)} (${isPositive ? '+' : ''}${targetUpside.toFixed(1)}% vs entry)`}
                    >
                      <Target className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />
                      Broker Target: {isPositive ? '+' : ''}{targetUpside.toFixed(1)}%
                    </Badge>
                  )
                })()
              )}
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
            <span>
              {isSell
                ? `${bearFactors.length} bearish factors hit`
                : `${bullFactors.length} bullish / ${bearFactors.length} bearish factors`}
            </span>
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
              {isSell ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />} Entry
            </div>
            <div className="font-semibold tabular-nums">{formatINR(signal.entry)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatINR(signal.entryRangeLow)} – {formatINR(signal.entryRangeHigh)}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <ShieldAlert className={`h-3 w-3 ${isSell ? 'text-orange-500' : 'text-red-500'}`} /> Stop Loss
            </div>
            <div className="font-semibold tabular-nums text-red-600 dark:text-red-400">{formatINR(signal.stopLoss)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {isSell ? '+' : ''}{formatPct(slPct)}
              {isSell && <span className="text-orange-500 ml-1">(above entry)</span>}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className={`h-3 w-3 ${isSell ? 'text-red-500' : 'text-emerald-500'}`} /> Target 1
            </div>
            <div className={`font-semibold tabular-nums ${isSell ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatINR(signal.target1)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatPct(isSell
                ? ((signal.entry - signal.target1) / signal.entry) * 100
                : ((signal.target1 - signal.entry) / signal.entry) * 100)}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className={`h-3 w-3 ${isSell ? 'text-red-600' : 'text-emerald-600'}`} /> Target 2
            </div>
            <div className={`font-semibold tabular-nums ${isSell ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{formatINR(signal.target2)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">{formatPct(targetPct)}</div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className={`h-3 w-3 ${isSell ? 'text-red-700' : 'text-emerald-700'}`} /> Target 3
            </div>
            <div className={`font-semibold tabular-nums ${isSell ? 'text-red-800 dark:text-red-200' : 'text-emerald-800 dark:text-emerald-200'}`}>{formatINR(signal.target3)}</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatPct(isSell
                ? ((signal.entry - signal.target3) / signal.entry) * 100
                : ((signal.target3 - signal.entry) / signal.entry) * 100)}
            </div>
          </div>
        </div>

        {/* Top reasons */}
        <div className="space-y-1 pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" /> Key triggers
          </div>
          <div className="flex flex-wrap gap-1">
            {keyFactors.slice(0, 4).map((f, i) => (
              <TooltipProvider key={i} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border ${
                      isSell
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                    }`}>
                      {isSell ? <TrendingDown className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />} {f.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {f.detail}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {keyFactors.length > 4 && (
              <span className="text-[10px] text-muted-foreground px-1 py-0.5">+{keyFactors.length - 4} more</span>
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
                      className={`h-7 text-xs gap-1 ${isTracked
                        ? (isSell ? 'text-red-600 dark:text-red-400' : 'text-violet-600 dark:text-violet-400')
                        : ''}`}
                      onClick={() => onTrack(signal)}
                      disabled={isTracked}
                    >
                      <Bookmark className={`h-3 w-3 ${isTracked ? 'fill-current' : ''}`} />
                      {isTracked ? 'Tracked' : (isSell ? 'Short' : 'Track')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isTracked
                      ? 'Already tracking this trade'
                      : (isSell ? 'Add to paper trades as SHORT — track if T1/T2/T3 hit below entry' : 'Add to paper trades — track if T1/T2/T3 hit')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-emerald-600 dark:text-emerald-400"
                    onClick={() => {
                      window.location.href = `/backtest?symbol=${signal.symbol}&timeframe=${signal.timeframe}`
                    }}
                  >
                    <Activity className="h-3 w-3" />
                    Backtest
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Run historical backtest for this signal
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 group-hover:gap-2 transition-all" onClick={onOpen}>
              Analysis <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const SignalCard = memo(SignalCardInner)
