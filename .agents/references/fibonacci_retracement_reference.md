# Fibonacci Retracement — Verified Reference
**Sources:** StockCharts ChartSchool, Zerodha Varsity (Chapter 16), StockGro, Investing.com
**Date verified:** 2026-07-21

---

## Core Formula

```
Price Range = |High - Low|
```

### For UPTREND (BUY setup) — Finding SUPPORT levels during pullback
Tool is drawn: Swing Low to Swing High

```
Retracement Level = High - (Range x Fibonacci Ratio)
```

| Level | Price Formula       | Meaning                              |
|-------|---------------------|--------------------------------------|
| 0%    | = High              | Start of retracement (current peak)  |
| 23.6% | High - 0.236xRange  | Shallowest pullback — strong uptrend |
| 38.2% | High - 0.382xRange  | Moderate support                     |
| 50.0% | High - 0.500xRange  | Mid-point (Dow Theory, not Fib math) |
| 61.8% | High - 0.618xRange  | GOLDEN RATIO — strongest support     |
| 78.6% | High - 0.786xRange  | Deepest pullback before trend fails  |
| 100%  | = Low               | Full retracement (trend broken)      |

### For DOWNTREND (SELL setup) — Finding RESISTANCE levels during bounce
Tool is drawn: Swing High to Swing Low

```
Retracement Level = Low + (Range x Fibonacci Ratio)
```

---

## Fibonacci Ratios (How derived)

Fibonacci sequence: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144...

- 61.8% = Any number / next number: 89/144 = 0.6180 (Golden Ratio phi)
- 38.2% = 1 - 0.618 = 0.382 (complement of Golden Ratio)
- 23.6% = Any number / number 3 places ahead: 34/144 = 0.236
- 78.6% = sqrt(0.618) = 0.786 (square root of Golden Ratio)
- 50.0% = NOT a Fibonacci number — from Dow Theory

---

## Rules for Use (Zerodha Varsity)

1. Identify a significant trending move (clear swing low to swing high for uptrend)
2. Retracement levels are SUPPORT ZONES not exact points — treat as alert areas
3. Combine with confirmation: candlestick patterns, RSI, volume
4. Most reliable levels: 38.2%, 50%, 61.8% — especially 61.8% (Golden Ratio)
5. End-of-day (EOD) charts give cleaner signals than intraday
6. If price breaks 100% level — trend is considered reversed

---

## Common Mistakes to Avoid

| WRONG                              | CORRECT                               |
|------------------------------------|---------------------------------------|
| low + ratio x range (for uptrend)  | high - ratio x range (for uptrend)    |
| high - ratio x range (for downtrend)| low + ratio x range (for downtrend)  |
| 50% is a Fibonacci ratio           | 50% is from Dow Theory                |
| All 5 levels equally important     | 61.8% is the most important           |

---

## Implementation in This App (stock-chart.tsx)

UPTREND formula — verified correct per StockCharts ChartSchool:

```typescript
const diff = high - low
return [
  { label: '0%   (High)', val: high               },  // anchor top
  { label: '23.6%',       val: high - 0.236 * diff },
  { label: '38.2%',       val: high - 0.382 * diff },
  { label: '50.0%',       val: high - 0.500 * diff },
  { label: '61.8% Star',  val: high - 0.618 * diff },  // GOLDEN RATIO — KEY
  { label: '78.6%',       val: high - 0.786 * diff },
  { label: '100% (Low)',  val: low                 },  // anchor bottom
]
```

Range used: Visible window high/low (same range trader sees on screen)
Context: BUY signals = uptrend formula used throughout
