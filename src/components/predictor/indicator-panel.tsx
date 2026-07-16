'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Gauge, BarChart3, Activity } from 'lucide-react'
import { IndicatorSnapshot, formatINR } from './types'

interface Props {
  ind: IndicatorSnapshot
}

// Safe number formatter — returns '—' for NaN/null/undefined so the panel never
// crashes when an indicator value can't be computed (e.g. not enough history).
const f = (n: number | null | undefined, digits = 2): string => {
  if (n == null || !isFinite(n)) return '—'
  return n.toFixed(digits)
}

export function IndicatorPanel({ ind }: Props) {
  const rows: Array<{ label: string; value: string; tag?: 'bull' | 'bear' | 'neutral'; hint?: string }> = [
    { label: 'RSI (14)', value: f(ind.rsi14, 1), tag: ind.rsi14 > 70 ? 'bear' : ind.rsi14 >= 50 ? 'bull' : 'neutral', hint: ind.rsi14 > 70 ? 'Overbought' : ind.rsi14 < 30 ? 'Oversold' : 'Neutral-momentum' },
    { label: 'MACD', value: f(ind.macd), tag: ind.macd > ind.macdSignal ? 'bull' : 'bear' },
    { label: 'MACD Signal', value: f(ind.macdSignal) },
    { label: 'MACD Hist', value: f(ind.macdHist), tag: ind.macdHist > 0 ? 'bull' : 'bear' },
    { label: 'MACD Cross', value: ind.macdCross, tag: ind.macdCross === 'bullish' ? 'bull' : ind.macdCross === 'bearish' ? 'bear' : 'neutral' },
    { label: 'Stochastic %K', value: f(ind.stochK, 1), tag: ind.stochK > 80 ? 'bear' : ind.stochK < 20 ? 'bull' : 'neutral' },
    { label: 'Stochastic %D', value: f(ind.stochD, 1) },
    { label: 'ADX (14)', value: f(ind.adx, 1), tag: ind.adx >= 25 ? 'bull' : 'neutral', hint: ind.adx >= 25 ? 'Strong trend' : 'Weak/choppy' },
    { label: '+DI', value: f(ind.plusDI, 1), tag: ind.plusDI > ind.minusDI ? 'bull' : 'bear' },
    { label: '-DI', value: f(ind.minusDI, 1) },
    { label: 'ATR (14)', value: f(ind.atr14), hint: isFinite(ind.atr14) && ind.price ? `~${((ind.atr14 / ind.price) * 100).toFixed(2)}% of price` : undefined },
    { label: 'Volume ratio', value: `${f(ind.volumeRatio, 2)}×`, tag: ind.volumeRatio >= 1.5 ? 'bull' : 'neutral' },
    { label: 'EMA 9', value: formatINR(ind.ema9) },
    { label: 'EMA 21', value: formatINR(ind.ema21) },
    { label: 'EMA 50', value: formatINR(ind.ema50), tag: ind.price > ind.ema50 ? 'bull' : 'bear' },
    { label: 'EMA 200', value: formatINR(ind.ema200), tag: ind.price > ind.ema200 ? 'bull' : 'bear', hint: ind.ema200Rising ? 'Rising' : 'Falling' },
    { label: 'SMA 20', value: formatINR(ind.sma20) },
    { label: 'SMA 50', value: formatINR(ind.sma50) },
    { label: 'SMA 100', value: formatINR(ind.sma100) },
    { label: 'SMA 200', value: formatINR(ind.sma200) },
    { label: 'BB Upper', value: formatINR(ind.bbUpper) },
    { label: 'BB Middle', value: formatINR(ind.bbMiddle) },
    { label: 'BB Lower', value: formatINR(ind.bbLower) },
    { label: 'BB %B', value: `${f(ind.bbPercentB * 100, 0)}%`, tag: ind.bbPercentB >= 1 ? 'bear' : ind.bbPercentB >= 0.8 ? 'bull' : 'neutral', hint: ind.bbPercentB >= 1 ? 'Above upper band' : ind.bbPercentB <= 0 ? 'Below lower band' : 'Inside bands' },
    { label: 'BB Bandwidth', value: `${f(ind.bbBandwidth * 100, 2)}%` },
    { label: 'VWAP 20', value: formatINR(ind.vwap20), tag: ind.price > ind.vwap20 ? 'bull' : 'bear' },
    { label: 'Supertrend', value: ind.supertrendTrend === 1 ? 'UP' : 'DOWN', tag: ind.supertrendTrend === 1 ? 'bull' : 'bear' },
    { label: 'Supertrend val', value: formatINR(ind.supertrendValue) },
    // Long-term indicators
    { label: '125-day return', value: `${f(ind.ret125d, 2)}%`, tag: ind.ret125d > 5 ? 'bull' : ind.ret125d < -5 ? 'bear' : 'neutral', hint: '~6 months' },
    { label: '250-day return', value: `${f(ind.ret250d, 2)}%`, tag: ind.ret250d > 15 ? 'bull' : ind.ret250d < 0 ? 'bear' : 'neutral', hint: '~1 year' },
    { label: 'Max DD (250d)', value: `${f(ind.maxDrawdown250, 1)}%`, tag: ind.maxDrawdown250 >= -25 ? 'bull' : ind.maxDrawdown250 < -40 ? 'bear' : 'neutral', hint: 'Worst peak-to-trough in last year' },
    { label: 'Off 250d high', value: `${f(ind.drawdownFrom250High, 1)}%`, hint: 'Negative = below peak' },
    { label: 'Vol accumulation', value: `${f(ind.volumeAccumulation, 2)}×`, tag: ind.volumeAccumulation >= 1.05 ? 'bull' : ind.volumeAccumulation < 0.85 ? 'bear' : 'neutral', hint: '60d avg / 250d avg vol' },
  ]

  const tagColor = (t?: 'bull' | 'bear' | 'neutral') => {
    if (t === 'bull') return 'text-emerald-600 dark:text-emerald-400'
    if (t === 'bear') return 'text-red-600 dark:text-red-400'
    return 'text-muted-foreground'
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Gauge className="h-4 w-4" /> Indicator snapshot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {rows.map((r) => (
            <div key={r.label} className="rounded border border-border/60 p-2 space-y-0.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.label}</div>
              <div className={`text-sm font-semibold tabular-nums ${tagColor(r.tag)}`}>{r.value}</div>
              {r.hint && <div className="text-[10px] text-muted-foreground">{r.hint}</div>}
            </div>
          ))}
        </div>

        {/* Patterns + Pivots + Swings */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded border border-border/60 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" /> Candlestick patterns
            </div>
            {ind.patterns.length === 0 ? (
              <div className="text-xs text-muted-foreground">No notable pattern today</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {ind.patterns.map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="rounded border border-border/60 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Pivot levels
            </div>
            <div className="text-xs space-y-0.5 tabular-nums">
              <div className="flex justify-between"><span className="text-muted-foreground">R2</span><span>{formatINR(ind.pivots.r2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">R1</span><span>{formatINR(ind.pivots.r1)}</span></div>
              <div className="flex justify-between font-medium"><span>Pivot</span><span>{formatINR(ind.pivots.pivot)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">S1</span><span>{formatINR(ind.pivots.s1)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">S2</span><span>{formatINR(ind.pivots.s2)}</span></div>
            </div>
          </div>

          <div className="rounded border border-border/60 p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Swing levels (20d)</div>
            <div className="text-xs space-y-0.5 tabular-nums">
              <div className="text-[10px] text-muted-foreground">Resistances:</div>
              {ind.swings.resistances.length === 0 ? (
                <div className="text-[11px] text-muted-foreground">—</div>
              ) : (
                ind.swings.resistances.slice(-3).map((r, i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">R{i + 1}</span><span className="text-red-600 dark:text-red-400">{formatINR(r)}</span></div>
                ))
              )}
              <div className="text-[10px] text-muted-foreground mt-1">Supports:</div>
              {ind.swings.supports.length === 0 ? (
                <div className="text-[11px] text-muted-foreground">—</div>
              ) : (
                ind.swings.supports.slice(-3).reverse().map((s, i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">S{i + 1}</span><span className="text-emerald-600 dark:text-emerald-400">{formatINR(s)}</span></div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
