'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, TrendingDown, Activity, Target, Clock, ChevronRight, Zap, Gauge,
} from 'lucide-react'
import { formatINR, formatPct } from './types'
import type { IntradayAnalysis } from './intraday-types'

interface Props {
  signal: IntradayAnalysis
  rank: number
  onOpen: () => void
}

export function IntradayCard({ signal, rank, onOpen }: Props) {
  const actionColor =
    signal.action === 'BUY_NOW'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
      : signal.action === 'SELL_WATCH'
      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800'
      : signal.action === 'WAIT_BREAKOUT'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
      : 'bg-muted text-muted-foreground border-border'

  const orbLabel =
    signal.orbStatus === 'breakout_up' ? '▲ ORB Up'
    : signal.orbStatus === 'breakout_down' ? '▼ ORB Down'
    : signal.orbStatus === 'inside' ? 'Inside ORB'
    : 'No ORB'

  return (
    <Card className="overflow-hidden border-border/60 hover:border-emerald-400/60 hover:shadow-md transition-all group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">#{rank}</span>
              <CardTitle className="text-base font-bold tracking-tight">{signal.symbol}</CardTitle>
              <Badge variant="outline" className={`text-[10px] font-semibold ${actionColor}`}>
                {signal.action.replace('_', ' ')}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-medium">{signal.sector}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{signal.name}</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-2xl font-bold tabular-nums ${
              signal.confidence >= 70 ? 'text-emerald-600 dark:text-emerald-400'
              : signal.confidence >= 40 ? 'text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground'
            }`}>
              {signal.confidence}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Confidence</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* LTP + change */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">LTP (15-min delayed)</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{formatINR(signal.ltp)}</span>
            <span className={`text-xs tabular-nums ${signal.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatPct(signal.changePct)}
            </span>
          </div>
        </div>

        {/* Intraday metrics grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div className="space-y-0.5">
            <div className="text-muted-foreground">VWAP</div>
            <div className={`font-semibold tabular-nums ${
              signal.vwapPosition === 'above' ? 'text-emerald-600 dark:text-emerald-400'
              : signal.vwapPosition === 'below' ? 'text-red-600 dark:text-red-400'
              : ''
            }`}>
              {formatINR(signal.vwap)}
            </div>
            <div className="text-[10px] text-muted-foreground">{signal.vwapPosition} VWAP</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> ORB</div>
            <div className={`font-semibold ${
              signal.orbStatus === 'breakout_up' ? 'text-emerald-600 dark:text-emerald-400'
              : signal.orbStatus === 'breakout_down' ? 'text-red-600 dark:text-red-400'
              : ''
            }`}>
              {orbLabel}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatINR(signal.orLow)} – {formatINR(signal.orHigh)}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-muted-foreground">Day OHLC</div>
            <div className="font-semibold tabular-nums text-[11px]">
              O: {formatINR(signal.dayOpen, { compact: true })} · H: {formatINR(signal.dayHigh, { compact: true })}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              L: {formatINR(signal.dayLow, { compact: true })} · Prev: {formatINR(signal.prevClose, { compact: true })}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1"><Gauge className="h-3 w-3" /> 5m EMA</div>
            <div className={`font-semibold tabular-nums text-[11px] ${
              !isNaN(signal.ema9) && !isNaN(signal.ema21) && signal.ema9 > signal.ema21
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
            }`}>
              EMA9: {isNaN(signal.ema9) ? '—' : formatINR(signal.ema9, { compact: true })}
              {' · '}
              EMA21: {isNaN(signal.ema21) ? '—' : formatINR(signal.ema21, { compact: true })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {signal.emaCross === 'bullish' && <span className="text-emerald-600 dark:text-emerald-400">▲ bullish cross</span>}
              {signal.emaCross === 'bearish' && <span className="text-red-600 dark:text-red-400">▼ bearish cross</span>}
              {signal.emaCross === 'none' && 'no cross today'}
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="text-[11px] bg-muted/40 rounded p-2 border border-border/40">
          <div className="font-medium mb-0.5 flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" /> Signal reason
          </div>
          <div className="text-muted-foreground">{signal.reason}</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Updated {new Date(signal.asOf).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 group-hover:gap-2 transition-all" onClick={onOpen}>
            Chart <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
