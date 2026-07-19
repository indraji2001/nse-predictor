// ============================================================================
// HARMONIC PATTERN SCANNER v2 — Fixed Pivot Detection + RSI Confluence
//
// CRITICAL FIXES vs v1:
//  1. Pivot detection uses N-bar HIGH/LOW lookback (NOT close price % deviation)
//     Swing HIGH = bar where candle.high is the highest of surrounding N bars
//     Swing LOW  = bar where candle.low is the lowest of surrounding N bars
//     (Equivalent to TradingView's ta.pivothigh() / ta.pivotlow())
//  2. XABCD prices use candle.HIGH for swing highs, candle.LOW for swing lows
//  3. RSI(14) Wilder-smoothing confluence added to every pattern result
//  4. Fixed Butterfly B: near(0.786) not inRange(0.75, 0.81)
//  5. Fixed Crab CD range: 2.24–3.618 (was 2.618–3.618)
//
// VERIFIED RATIO TABLE (Scott Carney + luckyJeffy PineScript + djoffrey Python):
//
//  Pattern      | AB/XA      | BC/AB      | CD/BC       | D-target
//  -------------|------------|------------|-------------|---------------------
//  Gartley      | 0.618      | 0.382-0.886| 1.27-1.618  | 0.786 XA retrace from A
//  Bat          | 0.382-0.50 | 0.382-0.886| 1.618-2.618 | 0.886 XA retrace from A
//  Perfect Bat  | 0.50       | 0.50-0.618 | 2.0         | 0.886 XA retrace from A
//  Alt Bat      | 0.382      | 0.382-0.886| 2.0-3.618   | 1.13× XA from A (D beyond X)
//  Butterfly    | 0.786      | 0.382-0.886| 1.618-2.618 | 1.27× XA from A (D beyond X)
//  Crab         | 0.382-0.618| 0.382-0.886| 2.24-3.618  | 1.618× XA from A (D beyond X)
//  Deep Crab    | 0.886      | 0.382-0.886| 2.0-3.618   | 1.618× XA from A (D beyond X)
//  Cypher       | 0.382-0.618| 1.272-1.414×XA | 0.786×XC | measured from XC leg
//  Shark        | —          | 1.13-1.618×XA | 1.618-2.24 | 0.886-1.13 of OX (5-pt)
//  AB=CD        | —          | 0.382-0.886| ≈1.0        | CD ≈ AB in length
//
// NOTE on "D beyond X" patterns (Butterfly, Crab, Alt Bat, Deep Crab):
//   xaExt = |D - X| / |XA| represents how far D went past X.
//   Alt Bat: xaExt ≈ 0.13 (D is 0.13×XA beyond X, i.e. 1.13× XA from A)
//   Butterfly: xaExt ≈ 0.27 (D is 0.27×XA beyond X, i.e. 1.27× XA from A)
//   Crab: xaExt ≈ 0.618 (D is 0.618×XA beyond X, i.e. 1.618× XA from A)
// ============================================================================

import { Candle } from '../stocks/engine'

// ── Types ──────────────────────────────────────────────────────────────────

export type HarmonicPatternName =
  | 'Gartley' | 'Perfect Gartley'
  | 'Bat' | 'Perfect Bat' | 'Alt Bat'
  | 'Butterfly' | 'Perfect Butterfly'
  | 'Crab' | 'Deep Crab' | 'Perfect Crab'
  | 'AB=CD'
  | 'Cypher'
  | 'Shark'

export type HarmonicDirection = 'Bullish' | 'Bearish'

export interface SwingPoint {
  index: number
  price: number     // HIGH for swing highs, LOW for swing lows
  type: 'HIGH' | 'LOW'
  date: string
}

export interface HarmonicPattern {
  name: HarmonicPatternName
  direction: HarmonicDirection
  X: number
  A: number
  B: number
  C: number
  D: number           // PRZ midpoint
  przLow: number
  przHigh: number
  ratioAB: number     // AB / XA
  ratioBC: number     // BC / AB
  ratioCD: number     // CD / BC
  ratioXAD: number    // D retracement/extension vs XA
  distFromD: number   // % distance from current price to PRZ midpoint
  status: 'FORMING' | 'COMPLETED'
  description: string
  rsi: number         // RSI(14) at time of scan (current last candle)
  rsiBullish: boolean // Bullish RSI confluence: direction=Bullish AND rsi ≤ 40
  rsiBearish: boolean // Bearish RSI confluence: direction=Bearish AND rsi ≥ 60
}

// ── Constants ──────────────────────────────────────────────────────────────

const TOL = 0.05                // ±5% standard tolerance (verified from all sources)
const TIGHT = 0.03              // ±3% for "Perfect" variants

// ── RSI Calculator (Wilder's Smoothing Method) ─────────────────────────────

export function computeRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 2) return 50

  let avgGain = 0
  let avgLoss = 0

  // Initial average (simple average of first `period` changes)
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  // Wilder's smoothing for subsequent bars
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return +(100 - 100 / (1 + rs)).toFixed(2)
}

// ── N-Bar High/Low Pivot Detection ─────────────────────────────────────────
// Equivalent to TradingView's ta.pivothigh(high, N, N) / ta.pivotlow(low, N, N)
// A pivot HIGH at index i: candles[i].high is the highest of candles[i-N..i+N]
// A pivot LOW  at index i: candles[i].low  is the lowest  of candles[i-N..i+N]

function findPivotHighs(candles: Candle[], N: number): SwingPoint[] {
  const pivots: SwingPoint[] = []
  for (let i = N; i < candles.length - N; i++) {
    const h = candles[i].high
    let isPivot = true
    for (let j = i - N; j <= i + N; j++) {
      if (j !== i && candles[j].high >= h) { isPivot = false; break }
    }
    if (isPivot) {
      pivots.push({ index: i, price: h, type: 'HIGH', date: candles[i].date })
    }
  }
  return pivots
}

function findPivotLows(candles: Candle[], N: number): SwingPoint[] {
  const pivots: SwingPoint[] = []
  for (let i = N; i < candles.length - N; i++) {
    const l = candles[i].low
    let isPivot = true
    for (let j = i - N; j <= i + N; j++) {
      if (j !== i && candles[j].low <= l) { isPivot = false; break }
    }
    if (isPivot) {
      pivots.push({ index: i, price: l, type: 'LOW', date: candles[i].date })
    }
  }
  return pivots
}

// Merge pivot highs and lows into an alternating sequence.
// When two pivots of the same type are adjacent, keep the more extreme one.
function mergeAndAlternatePivots(highs: SwingPoint[], lows: SwingPoint[]): SwingPoint[] {
  const all = [...highs, ...lows].sort((a, b) => a.index - b.index)
  if (all.length === 0) return []

  const result: SwingPoint[] = [all[0]]
  for (let i = 1; i < all.length; i++) {
    const last = result[result.length - 1]
    const curr = all[i]
    if (curr.type === last.type) {
      // Same type: keep the more extreme pivot
      if (curr.type === 'HIGH' && curr.price > last.price) result[result.length - 1] = curr
      else if (curr.type === 'LOW' && curr.price < last.price) result[result.length - 1] = curr
    } else {
      result.push(curr)
    }
  }
  return result
}

// Public: find alternating swing points using N-bar high/low lookback
// N=5 is standard for daily charts; N=3 works well for weekly
export function findSwingPoints(
  candles: Candle[],
  maxPoints = 30,
  pivotN = 5,
): SwingPoint[] {
  if (candles.length < pivotN * 2 + 5) return []

  const highs = findPivotHighs(candles, pivotN)
  const lows = findPivotLows(candles, pivotN)
  const merged = mergeAndAlternatePivots(highs, lows)
  return merged.slice(-maxPoints)
}

// ── Ratio helpers ──────────────────────────────────────────────────────────

function near(value: number, target: number, tol = TOL): boolean {
  return value >= target * (1 - tol) && value <= target * (1 + tol)
}

function inRange(value: number, lo: number, hi: number, tol = TOL): boolean {
  return value >= lo * (1 - tol) && value <= hi * (1 + tol)
}

// ── Leg Ratio Calculator ────────────────────────────────────────────────────

interface LegRatios {
  ab: number      // |AB| / |XA|
  bc: number      // |BC| / |AB|
  cd: number      // |CD| / |BC|  (BC extension projection)
  xad: number     // |D - A| / |XA|  (D retracement/extension from A)
  xaExt: number   // |D - X| / |XA|  (how far D went past X)
}

function computeLegRatios(X: number, A: number, B: number, C: number, D: number): LegRatios {
  const XA = Math.abs(A - X)
  const AB = Math.abs(B - A)
  const BC = Math.abs(C - B)
  const CD = Math.abs(D - C)

  const ab = XA > 0 ? AB / XA : 0
  const bc = AB > 0 ? BC / AB : 0
  const cd = BC > 0 ? CD / BC : 0
  const xad = XA > 0 ? Math.abs(D - A) / XA : 0
  const xaExt = XA > 0 ? Math.abs(D - X) / XA : 0

  return { ab, bc, cd, xad, xaExt }
}

// ── Pattern Validators ──────────────────────────────────────────────────────
// All tolerances ±5% (TOL=0.05), per Scott Carney and community implementations.
// "Perfect" variants use ±3% (TIGHT=0.03).

// GARTLEY: B = 0.618 of XA, D = 0.786 of XA from A (inside XA range)
function validateGartley(r: LegRatios): boolean {
  return (
    near(r.ab, 0.618) &&
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xad, 0.786) &&
    inRange(r.cd, 1.27, 1.618)
  )
}

// PERFECT GARTLEY: B=0.618 exact, D=0.786 exact, CD=1.618 exact
function validatePerfectGartley(r: LegRatios): boolean {
  return (
    near(r.ab, 0.618, TIGHT) &&
    near(r.bc, 0.618, TIGHT) &&
    near(r.xad, 0.786, TIGHT) &&
    near(r.cd, 1.618, TIGHT)
  )
}

// BAT: B = 0.382–0.500 of XA (must be < 0.618), D = 0.886 of XA from A
function validateBat(r: LegRatios): boolean {
  return (
    inRange(r.ab, 0.382, 0.500) &&
    r.ab < 0.618 &&                    // strict: B must not reach Gartley territory
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xad, 0.886) &&
    inRange(r.cd, 1.618, 2.618)
  )
}

// PERFECT BAT: B=0.50 exact, D=0.886 exact, CD=2.0 exact
function validatePerfectBat(r: LegRatios): boolean {
  return (
    near(r.ab, 0.50, TIGHT) &&
    inRange(r.bc, 0.50, 0.618) &&
    near(r.xad, 0.886, TIGHT) &&
    near(r.cd, 2.0, TIGHT)
  )
}

// ALT BAT: B = 0.382 (shallow retrace), D = 1.13 extension from A (xaExt = 0.13)
// Note: "1.13 extension" means D = A - 1.13*XA = X - 0.13*XA → xaExt = 0.13
function validateAltBat(r: LegRatios): boolean {
  return (
    near(r.ab, 0.382, TIGHT) &&
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xaExt, 0.13) &&             // D is 0.13×XA beyond X (= 1.13 XA from A)
    inRange(r.cd, 2.0, 3.618)
  )
}

// BUTTERFLY: B = 0.786 of XA (key signature), D = 1.27 extension from A (xaExt = 0.27)
// FIXED: B must be near 0.786, not a range of 0.75-0.81
function validateButterfly(r: LegRatios): boolean {
  return (
    near(r.ab, 0.786) &&               // FIXED: exact 0.786 ±5%, not 0.75-0.81
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xaExt, 0.27) &&             // D = 0.27×XA beyond X (= 1.27 XA from A)
    inRange(r.cd, 1.618, 2.618)
  )
}

// PERFECT BUTTERFLY: B=0.786 tight, D=1.27 ext tight, CD=1.618 tight
function validatePerfectButterfly(r: LegRatios): boolean {
  return (
    near(r.ab, 0.786, TIGHT) &&
    inRange(r.bc, 0.50, 0.886) &&
    near(r.xaExt, 0.27, TIGHT) &&
    near(r.cd, 1.618, TIGHT)
  )
}

// CRAB: B = 0.382–0.618, D = 1.618 extension from A (xaExt = 0.618)
// FIXED CD range: 2.24–3.618 (was 2.618–3.618, missing the 2.24–2.618 band)
function validateCrab(r: LegRatios): boolean {
  return (
    inRange(r.ab, 0.382, 0.618) &&
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xaExt, 0.618) &&            // D = 0.618×XA beyond X (= 1.618 XA from A)
    inRange(r.cd, 2.24, 3.618)         // FIXED: was 2.618-3.618
  )
}

// DEEP CRAB: B = 0.886 (very deep retrace, key differentiator), D same as Crab
function validateDeepCrab(r: LegRatios): boolean {
  return (
    near(r.ab, 0.886) &&               // B must be very near 0.886
    r.ab < 1.0 &&                      // B cannot reach X
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xaExt, 0.618) &&            // Same D as Crab
    inRange(r.cd, 2.0, 3.618)
  )
}

// PERFECT CRAB: B=0.618 exact, D=1.618 ext exact, CD=3.14 exact
function validatePerfectCrab(r: LegRatios): boolean {
  return (
    near(r.ab, 0.618, TIGHT) &&
    inRange(r.bc, 0.50, 0.618) &&
    near(r.xaExt, 0.618, TIGHT) &&
    near(r.cd, 3.14, 0.08)
  )
}

// ── CYPHER Validator ────────────────────────────────────────────────────────
// Structurally unique: C goes BEYOND A (C > A for bullish, C < A for bearish)
// BC/XA (XC/XA) = 1.272–1.414 (C extends 1.272–1.414× XA from X)
// D = 0.786 retracement of the XC leg (NOT XA)

interface CypherResult {
  valid: boolean
  ratioAB: number
  ratioXC_XA: number   // |XC| / |XA| — how far C extends past X relative to XA
  ratioD_XC: number    // |D - C| / |XC| — D retracement of XC
}

function validateCypher(
  X: number, A: number, B: number, C: number, D: number, bullish: boolean
): CypherResult {
  const XA = Math.abs(A - X)
  const AB = Math.abs(B - A)
  const XC = Math.abs(C - X)

  const ratioAB = XA > 0 ? AB / XA : 0
  const ratioXC_XA = XA > 0 ? XC / XA : 0
  const ratioD_XC = XC > 0 ? Math.abs(D - C) / XC : 0

  // Structural: C must have gone beyond A
  const cExceedsA = bullish ? C > A : C < A

  const valid = (
    cExceedsA &&
    inRange(ratioAB, 0.382, 0.618) &&
    inRange(ratioXC_XA, 1.272, 1.414) &&   // C extends 1.272–1.414× XA from X
    near(ratioD_XC, 0.786)                  // D = 0.786 of XC
  )

  return { valid, ratioAB, ratioXC_XA, ratioD_XC }
}

// ── SHARK Validator ─────────────────────────────────────────────────────────
// 5-point pattern: O, X, A, B, C — C IS the PRZ (no D point)
// BULLISH Shark:  O=HIGH, X=LOW, A=HIGH, B=LOW(below X!), C=HIGH(PRZ)
// BEARISH Shark:  O=LOW, X=HIGH, A=LOW, B=HIGH(above X!), C=LOW(PRZ)
// B goes BEYOND X (key structural signature of Shark)
// Ratios:
//   XA/OX = 0.382–0.618 (XA leg retraces OX)
//   AB/XA = 1.13–1.618 (AB extends XA, going beyond X)
//   C/OX  = 0.886–1.13 (C retraces OX from O — the PRZ point)

interface SharkResult {
  valid: boolean
  ratioXA_OX: number
  ratioAB_XA: number
  ratioC_OX: number
}

function validateShark(O: number, X: number, A: number, B: number, C: number, bullish: boolean): SharkResult {
  const OX = Math.abs(X - O)
  const XA = Math.abs(A - X)
  const AB = Math.abs(B - A)

  const ratioXA_OX = OX > 0 ? XA / OX : 0
  const ratioAB_XA = XA > 0 ? AB / XA : 0
  const ratioC_OX = OX > 0 ? Math.abs(C - O) / OX : 0

  // Structural: B must go beyond X
  const bBeyondX = bullish ? B < X : B > X

  const valid = (
    bBeyondX &&
    inRange(ratioXA_OX, 0.382, 0.618) &&
    inRange(ratioAB_XA, 1.13, 1.618) &&
    inRange(ratioC_OX, 0.886, 1.13)    // FIXED: 0.886-1.13 range (was 0.886 ±7%)
  )

  return { valid, ratioXA_OX, ratioAB_XA, ratioC_OX }
}

// ── PRZ Calculator ──────────────────────────────────────────────────────────

function computePRZ(
  X: number, A: number, B: number, C: number,
  pattern: HarmonicPatternName,
  bullish: boolean,
): { przLow: number; przHigh: number; przMid: number } {
  const XA = Math.abs(A - X)
  const AB = Math.abs(B - A)
  const XC = Math.abs(C - X)

  let proj1 = 0  // primary XA-based projection
  let proj2 = 0  // secondary AB=CD projection

  if (pattern === 'Gartley' || pattern === 'Perfect Gartley') {
    proj1 = bullish ? A - 0.786 * XA : A + 0.786 * XA
  } else if (pattern === 'Bat' || pattern === 'Perfect Bat') {
    proj1 = bullish ? A - 0.886 * XA : A + 0.886 * XA
  } else if (pattern === 'Alt Bat') {
    proj1 = bullish ? A - 1.13 * XA : A + 1.13 * XA   // D = 1.13 XA from A = X ∓ 0.13 XA
  } else if (pattern === 'Butterfly' || pattern === 'Perfect Butterfly') {
    proj1 = bullish ? A - 1.27 * XA : A + 1.27 * XA   // D = 1.27 XA from A = X ∓ 0.27 XA
  } else if (pattern === 'Crab' || pattern === 'Deep Crab' || pattern === 'Perfect Crab') {
    proj1 = bullish ? A - 1.618 * XA : A + 1.618 * XA // D = 1.618 XA from A = X ∓ 0.618 XA
  } else if (pattern === 'AB=CD') {
    proj1 = bullish ? C - AB : C + AB
  } else if (pattern === 'Cypher') {
    proj1 = bullish ? C - 0.786 * XC : C + 0.786 * XC
  } else if (pattern === 'Shark') {
    proj1 = C  // C itself is the PRZ for Shark
  }

  // AB=CD secondary confluence (C ± AB)
  proj2 = bullish ? C - AB : C + AB
  if (pattern === 'Cypher' || pattern === 'Shark') proj2 = proj1  // no secondary

  const przMid = (proj1 + proj2) / 2
  const spread = Math.abs(proj1 - proj2) / 2 + Math.abs(przMid) * 0.005
  return {
    przLow: Math.min(proj1, proj2) - spread * 0.5,
    przHigh: Math.max(proj1, proj2) + spread * 0.5,
    przMid,
  }
}

// ── Helper to build a pattern result ───────────────────────────────────────

function makePattern(
  name: HarmonicPatternName,
  direction: HarmonicDirection,
  X: number, A: number, B: number, C: number,
  ratioAB: number, ratioBC: number, ratioCD: number, ratioXAD: number,
  przLow: number, przHigh: number, przMid: number,
  currentPrice: number,
  status: 'FORMING' | 'COMPLETED',
  rsi: number,
): HarmonicPattern {
  const distFromD = przMid !== 0 ? ((currentPrice - przMid) / przMid) * 100 : 0
  const rsiBullish = direction === 'Bullish' && rsi <= 40
  const rsiBearish = direction === 'Bearish' && rsi >= 60
  return {
    name, direction, X, A, B, C, D: przMid,
    przLow, przHigh,
    ratioAB: +ratioAB.toFixed(3),
    ratioBC: +ratioBC.toFixed(3),
    ratioCD: +ratioCD.toFixed(3),
    ratioXAD: +ratioXAD.toFixed(3),
    distFromD: +distFromD.toFixed(2),
    status,
    description: `${direction} ${name}: AB=${(ratioAB * 100).toFixed(0)}% XA, D-target ₹${przMid.toFixed(1)}, PRZ ₹${przLow.toFixed(1)}–₹${przHigh.toFixed(1)}`,
    rsi: +rsi.toFixed(1),
    rsiBullish,
    rsiBearish,
  }
}

// ── Main Harmonic Scanner ────────────────────────────────────────────────────

export function detectHarmonicPatterns(
  candles: Candle[],
  pivotN = 5,          // N-bar lookback for pivot detection (5 for daily, 3 for weekly)
  maxPivots = 30,      // max pivot points to keep (more = more pattern windows)
): HarmonicPattern[] {
  if (candles.length < 30) return []

  const rsi = computeRSI(candles, 14)
  const results: HarmonicPattern[] = []
  const pivots = findSwingPoints(candles, maxPivots, pivotN)
  if (pivots.length < 5) return []

  const currentPrice = candles[candles.length - 1].close

  for (let start = 0; start <= pivots.length - 5; start++) {
    const [P0, P1, P2, P3, P4] = pivots.slice(start, start + 5)

    // =========================================================================
    // BLOCK A: LOW-HIGH-LOW-HIGH sequence
    //   → Standard Bullish XABCD: X=P0(LOW), A=P1(HIGH), B=P2(LOW), C=P3(HIGH)
    //   → Bullish Cypher: C > A (C exceeds A)
    //   → Bearish Shark: handled in BLOCK C
    // =========================================================================
    if (P0.type === 'LOW' && P1.type === 'HIGH' && P2.type === 'LOW' && P3.type === 'HIGH') {
      const X = P0.price  // actual LOW price
      const A = P1.price  // actual HIGH price
      const B = P2.price  // actual LOW price
      const C = P3.price  // actual HIGH price

      // D: use P4 LOW price if confirmed, else current close (forming)
      const D = P4.type === 'LOW' ? P4.price : currentPrice
      const status: 'FORMING' | 'COMPLETED' = P4.type === 'LOW' ? 'COMPLETED' : 'FORMING'

      // ─── Standard Bullish: B > X (higher low) and C < A (lower high) ───
      if (B > X && C < A) {
        const r = computeLegRatios(X, A, B, C, D)
        const AB = Math.abs(B - A)
        const CD = Math.abs(D - C)
        const abcdRatio = AB > 0 ? CD / AB : 0

        if (near(abcdRatio, 1.0, 0.07)) {
          const prz = computePRZ(X, A, B, C, 'AB=CD', true)
          results.push(makePattern('AB=CD', 'Bullish', X, A, B, C, r.ab, r.bc, abcdRatio, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateGartley(r)) {
          const prz = computePRZ(X, A, B, C, 'Gartley', true)
          results.push(makePattern('Gartley', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validatePerfectGartley(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Gartley', true)
          results.push(makePattern('Perfect Gartley', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Bat', true)
          results.push(makePattern('Bat', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validatePerfectBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Bat', true)
          results.push(makePattern('Perfect Bat', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateAltBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Alt Bat', true)
          results.push(makePattern('Alt Bat', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateButterfly(r)) {
          const prz = computePRZ(X, A, B, C, 'Butterfly', true)
          results.push(makePattern('Butterfly', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validatePerfectButterfly(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Butterfly', true)
          results.push(makePattern('Perfect Butterfly', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Crab', true)
          results.push(makePattern('Crab', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateDeepCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Deep Crab', true)
          results.push(makePattern('Deep Crab', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validatePerfectCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Crab', true)
          results.push(makePattern('Perfect Crab', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
      }

      // ─── Bullish Cypher: B > X and C > A (C goes BEYOND A) ───
      if (B > X && C > A) {
        const cypherR = validateCypher(X, A, B, C, D, true)
        if (cypherR.valid) {
          const XC = Math.abs(C - X)
          const przMid = C - 0.786 * XC
          const przSpread = Math.abs(przMid) * 0.012
          const distFromD = przMid !== 0 ? ((currentPrice - przMid) / przMid) * 100 : 0
          results.push({
            name: 'Cypher', direction: 'Bullish',
            X, A, B, C, D: przMid,
            przLow: przMid - przSpread, przHigh: przMid + przSpread,
            ratioAB: +cypherR.ratioAB.toFixed(3),
            ratioBC: +cypherR.ratioXC_XA.toFixed(3),
            ratioCD: +cypherR.ratioD_XC.toFixed(3),
            ratioXAD: +cypherR.ratioXC_XA.toFixed(3),
            distFromD: +distFromD.toFixed(2), status,
            description: `Bullish Cypher: C=${(cypherR.ratioXC_XA * 100).toFixed(0)}% ext XA, D=0.786 of XC. PRZ ₹${(przMid - przSpread).toFixed(1)}–₹${(przMid + przSpread).toFixed(1)}`,
            rsi: +rsi.toFixed(1), rsiBullish: rsi <= 40, rsiBearish: false,
          })
        }
      }
    }

    // =========================================================================
    // BLOCK B: HIGH-LOW-HIGH-LOW sequence
    //   → Standard Bearish XABCD: X=P0(HIGH), A=P1(LOW), B=P2(HIGH), C=P3(LOW)
    //   → Bearish Cypher: C < A (C goes below A)
    //   → Bullish Shark: B goes below X
    // =========================================================================
    if (P0.type === 'HIGH' && P1.type === 'LOW' && P2.type === 'HIGH' && P3.type === 'LOW') {
      const X = P0.price  // actual HIGH price
      const A = P1.price  // actual LOW price
      const B = P2.price  // actual HIGH price
      const C = P3.price  // actual LOW price

      // D: use P4 HIGH price if confirmed, else current close (forming)
      const D = P4.type === 'HIGH' ? P4.price : currentPrice
      const status: 'FORMING' | 'COMPLETED' = P4.type === 'HIGH' ? 'COMPLETED' : 'FORMING'

      // ─── Standard Bearish: B < X (lower high) and C > A (higher low) ───
      if (B < X && C > A) {
        const r = computeLegRatios(X, A, B, C, D)
        const AB = Math.abs(B - A)
        const CD = Math.abs(D - C)
        const abcdRatio = AB > 0 ? CD / AB : 0

        if (near(abcdRatio, 1.0, 0.07)) {
          const prz = computePRZ(X, A, B, C, 'AB=CD', false)
          results.push(makePattern('AB=CD', 'Bearish', X, A, B, C, r.ab, r.bc, abcdRatio, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateGartley(r)) {
          const prz = computePRZ(X, A, B, C, 'Gartley', false)
          results.push(makePattern('Gartley', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validatePerfectGartley(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Gartley', false)
          results.push(makePattern('Perfect Gartley', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Bat', false)
          results.push(makePattern('Bat', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validatePerfectBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Bat', false)
          results.push(makePattern('Perfect Bat', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateAltBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Alt Bat', false)
          results.push(makePattern('Alt Bat', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateButterfly(r)) {
          const prz = computePRZ(X, A, B, C, 'Butterfly', false)
          results.push(makePattern('Butterfly', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validatePerfectButterfly(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Butterfly', false)
          results.push(makePattern('Perfect Butterfly', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Crab', false)
          results.push(makePattern('Crab', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validateDeepCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Deep Crab', false)
          results.push(makePattern('Deep Crab', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
        if (validatePerfectCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Crab', false)
          results.push(makePattern('Perfect Crab', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status, rsi))
        }
      }

      // ─── Bearish Cypher: B < X and C < A (C goes below A) ───
      if (B < X && C < A) {
        const cypherR = validateCypher(X, A, B, C, D, false)
        if (cypherR.valid) {
          const XC = Math.abs(C - X)
          const przMid = C + 0.786 * XC
          const przSpread = Math.abs(przMid) * 0.012
          const distFromD = przMid !== 0 ? ((currentPrice - przMid) / przMid) * 100 : 0
          results.push({
            name: 'Cypher', direction: 'Bearish',
            X, A, B, C, D: przMid,
            przLow: przMid - przSpread, przHigh: przMid + przSpread,
            ratioAB: +cypherR.ratioAB.toFixed(3),
            ratioBC: +cypherR.ratioXC_XA.toFixed(3),
            ratioCD: +cypherR.ratioD_XC.toFixed(3),
            ratioXAD: +cypherR.ratioXC_XA.toFixed(3),
            distFromD: +distFromD.toFixed(2), status,
            description: `Bearish Cypher: C=${(cypherR.ratioXC_XA * 100).toFixed(0)}% ext XA, D=0.786 of XC. PRZ ₹${(przMid - przSpread).toFixed(1)}–₹${(przMid + przSpread).toFixed(1)}`,
            rsi: +rsi.toFixed(1), rsiBullish: false, rsiBearish: rsi >= 60,
          })
        }
      }

      // ─── Bullish Shark: O=P0(HIGH), X=P1(LOW), A=P2(HIGH), B=P3(LOW, below X) ───
      // P3 is a LOW. For bullish Shark: B (P3) goes below X (P1=LOW). P3.price < P1.price.
      if (P3.price < P1.price && P4.type === 'HIGH') {
        const shR = validateShark(P0.price, P1.price, P2.price, P3.price, P4.price, true)
        if (shR.valid) {
          const przMid = P4.price
          const przSpread = Math.abs(przMid) * 0.015
          const distFromD = przMid !== 0 ? ((currentPrice - przMid) / przMid) * 100 : 0
          results.push({
            name: 'Shark', direction: 'Bullish',
            X: P0.price, A: P1.price, B: P2.price, C: P3.price, D: przMid,
            przLow: przMid - przSpread, przHigh: przMid + przSpread,
            ratioAB: +shR.ratioXA_OX.toFixed(3),
            ratioBC: +shR.ratioAB_XA.toFixed(3),
            ratioCD: +shR.ratioC_OX.toFixed(3),
            ratioXAD: +shR.ratioC_OX.toFixed(3),
            distFromD: +distFromD.toFixed(2),
            status: 'COMPLETED',
            description: `Bullish Shark (5-pt O-X-A-B-C): C=PRZ at ${(shR.ratioC_OX * 100).toFixed(0)}% of OX. PRZ ₹${(przMid - przSpread).toFixed(1)}–₹${(przMid + przSpread).toFixed(1)}`,
            rsi: +rsi.toFixed(1), rsiBullish: rsi <= 40, rsiBearish: false,
          })
        }
      }
    }

    // =========================================================================
    // BLOCK C: Bearish Shark
    //   Sequence: LOW-HIGH-LOW-HIGH-LOW
    //   O=P0(LOW), X=P1(HIGH), A=P2(LOW), B=P3(HIGH, above X!), C=P4(LOW=PRZ)
    // =========================================================================
    if (P0.type === 'LOW' && P1.type === 'HIGH' && P2.type === 'LOW' && P3.type === 'HIGH') {
      // B=P3 is HIGH. For bearish Shark, B > X (P3.price > P1.price)
      if (P3.price > P1.price && P4.type === 'LOW') {
        const shR = validateShark(P0.price, P1.price, P2.price, P3.price, P4.price, false)
        if (shR.valid) {
          const przMid = P4.price
          const przSpread = Math.abs(przMid) * 0.015
          const distFromD = przMid !== 0 ? ((currentPrice - przMid) / przMid) * 100 : 0
          results.push({
            name: 'Shark', direction: 'Bearish',
            X: P0.price, A: P1.price, B: P2.price, C: P3.price, D: przMid,
            przLow: przMid - przSpread, przHigh: przMid + przSpread,
            ratioAB: +shR.ratioXA_OX.toFixed(3),
            ratioBC: +shR.ratioAB_XA.toFixed(3),
            ratioCD: +shR.ratioC_OX.toFixed(3),
            ratioXAD: +shR.ratioC_OX.toFixed(3),
            distFromD: +distFromD.toFixed(2),
            status: 'COMPLETED',
            description: `Bearish Shark (5-pt O-X-A-B-C): C=PRZ at ${(shR.ratioC_OX * 100).toFixed(0)}% of OX. PRZ ₹${(przMid - przSpread).toFixed(1)}–₹${(przMid + przSpread).toFixed(1)}`,
            rsi: +rsi.toFixed(1), rsiBullish: false, rsiBearish: rsi >= 60,
          })
        }
      }
    }
  }

  // Deduplicate: per pattern+direction, keep the instance closest to current price
  const seen = new Map<string, HarmonicPattern>()
  for (const p of results) {
    const key = `${p.name}-${p.direction}`
    const existing = seen.get(key)
    if (!existing || Math.abs(p.distFromD) < Math.abs(existing.distFromD)) {
      seen.set(key, p)
    }
  }

  // Sort: FORMING first (actively approaching PRZ = most actionable), then by proximity
  return Array.from(seen.values()).sort((a, b) => {
    if (a.status === 'FORMING' && b.status !== 'FORMING') return -1
    if (b.status === 'FORMING' && a.status !== 'FORMING') return 1
    return Math.abs(a.distFromD) - Math.abs(b.distFromD)
  })
}
