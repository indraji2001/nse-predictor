'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Gauge, BarChart3, Activity, Target, Sparkles, Hexagon } from 'lucide-react'
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

        {/* Patterns + Pivots + Swings + Fibonacci */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
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

          {ind.fib && (
            <div className="rounded border border-border/60 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3 text-indigo-500" />
                Fibonacci Retracement
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  ind.fib.trend === 'downtrend'
                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}>
                  {ind.fib.trend === 'downtrend' ? '↓ DOWNTREND — RESISTANCE' : '↑ UPTREND — SUPPORT'}
                </span>
              </div>
              <div className="text-xs space-y-0.5 tabular-nums">
                {/* Top anchor */}
                {ind.fib.trend === 'downtrend' ? (
                  <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">0% — High (start of decline)</span><span className="text-muted-foreground">{formatINR(ind.fib.high)}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">100% — High (peak)</span><span className="text-muted-foreground">{formatINR(ind.fib.high)}</span></div>
                )}
                <div className="flex justify-between"><span className={`text-[10px] ${ind.fib.closestLevel === '23.6%' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-muted-foreground'}`}>23.6%</span><span>{formatINR(ind.fib.fib236)}</span></div>
                <div className="flex justify-between"><span className={`text-[10px] ${ind.fib.closestLevel === '38.2%' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-muted-foreground'}`}>38.2%</span><span>{formatINR(ind.fib.fib382)}</span></div>
                <div className="flex justify-between"><span className={`text-[10px] ${ind.fib.closestLevel === '50.0%' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-muted-foreground'}`}>50.0%</span><span>{formatINR(ind.fib.fib500)}</span></div>
                <div className="flex justify-between"><span className={`text-[10px] ${ind.fib.closestLevel === '61.8%' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-muted-foreground'}`}>61.8% ★</span><span>{formatINR(ind.fib.fib618)}</span></div>
                <div className="flex justify-between"><span className={`text-[10px] ${ind.fib.closestLevel === '78.6%' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-muted-foreground'}`}>78.6%</span><span>{formatINR(ind.fib.fib786)}</span></div>
                {/* Bottom anchor */}
                {ind.fib.trend === 'downtrend' ? (
                  <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">100% — Low (trough)</span><span className="text-muted-foreground">{formatINR(ind.fib.low)}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">0% — Low (start of uptrend)</span><span className="text-muted-foreground">{formatINR(ind.fib.low)}</span></div>
                )}
              </div>
            </div>
          )}


        </div>

        {/* Fibonacci Confluence Alert Box */}
        {ind.fibConfluence?.isActive && (
          <div className="mt-4 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all">
            <div>
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-500 fill-current" />
                Active Fibonacci Confluence Zone Detected!
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Current price is reacting inside a strong confluence of: <strong className="text-slate-700 dark:text-slate-200">{ind.fibConfluence.levels.join(" + ")}</strong> near {formatINR(ind.fibConfluence.priceZone)}.
              </p>
            </div>
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-[9px] w-fit">
              ZONE DIST: {ind.fibConfluence.distancePct}%
            </Badge>
          </div>
        )}

        {/* Harmonic Patterns Panel */}
        {ind.harmonics && ind.harmonics.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-2">
              <Hexagon className="h-3 w-3 text-violet-500" /> Harmonic Patterns Detected
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ind.harmonics.map((p, idx) => {
                const isBull = p.direction === 'Bullish'
                const isNearPRZ = Math.abs(p.distFromD) <= 2.5
                return (
                  <div key={idx} className={`rounded border p-2 space-y-1 ${
                    isBull
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/10'
                      : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/10'
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold ${isBull ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                          {isBull ? '▲' : '▼'} {p.direction} {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={`text-[9px] px-1 py-0 ${
                          p.status === 'FORMING'
                            ? 'bg-violet-500 text-white'
                            : 'bg-slate-400 text-white'
                        }`}>{p.status}</Badge>
                        {isNearPRZ && (
                          <Badge className="text-[9px] px-1 py-0 bg-amber-500 text-white">⚡ IN PRZ</Badge>
                        )}
                      </div>
                    </div>
                    {/* PRZ Zone */}
                    <div className="text-[10px] space-y-0.5 tabular-nums">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PRZ Zone</span>
                        <span className="font-semibold">{formatINR(p.przLow)} – {formatINR(p.przHigh)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dist from PRZ</span>
                        <span className={isNearPRZ ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
                          {p.distFromD > 0 ? '+' : ''}{p.distFromD}%
                        </span>
                      </div>
                    </div>
                    {/* Fibonacci Ratios */}
                    <div className="text-[9px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
                      <div className="flex gap-2 flex-wrap">
                        <span>AB/XA: <strong>{(p.ratioAB * 100).toFixed(0)}%</strong></span>
                        <span>BC/AB: <strong>{(p.ratioBC * 100).toFixed(0)}%</strong></span>
                        <span>D/XA: <strong>{(p.ratioXAD * 100).toFixed(0)}%</strong></span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
