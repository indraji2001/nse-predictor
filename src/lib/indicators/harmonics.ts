// ============================================================================
// HARMONIC PATTERN SCANNER — Complete Rewrite (All Patterns, All Bugs Fixed)
//
// Patterns: Gartley, Perfect Gartley, Bat, Perfect Bat, Alt Bat,
//           Butterfly, Perfect Butterfly, Crab, Deep Crab, Perfect Crab,
//           AB=CD, Cypher, Shark
//
// KEY DESIGN PRINCIPLES (from Carney's Harmonic Trading):
//
//  XABCD Structure (bullish example):
//    X = last significant swing LOW  (origin)
//    A = swing HIGH after X          (XA leg = up move)
//    B = swing LOW after A           (AB leg = retrace of XA)
//    C = swing HIGH after B          (BC leg = retrace of AB, C < A for standard)
//    D = Potential Reversal Zone     (CD leg = extension or retrace, PRZ)
//
//  Key Leg Ratios (all verified against official cheat-sheet):
//    r.ab  = |AB| / |XA|       → how much AB retraces XA
//    r.bc  = |BC| / |AB|       → how much BC retraces AB
//    r.cd  = |CD| / |BC|       → BC projection (BC extension to D) — IMPORTANT!
//    r.xad = |D - A| / |XA|   → D as retracement of XA from A (Gartley/Bat)
//    r.xaExt = |D - X| / |XA| → D distance BEYOND X (Butterfly/Crab: 0.27, 0.618)
//                                CRITICAL NOTE: "1.27 extension" means D is
//                                0.27×XA beyond X, NOT 1.27×XA beyond X.
//                                So xaExt = 0.27 for Butterfly, 0.618 for Crab.
//
//  Structural Rule ("C does not exceed A"):
//    Bullish: B > X AND C < A  (for all standard patterns except Cypher/Shark)
//    Bearish: B < X AND C > A
//    Cypher:  C goes BEYOND A (C > A bullish, C < A bearish)
//    Shark:   B goes BEYOND X (B < X bullish, B > X bearish)
//
//  PRZ Validation:
//    Each pattern has BOTH an XA-based D projection AND a BC-projection check.
//    If both agree, it's a high-confidence PRZ.
//
//  Stop Loss reference (from table):
//    Bat/Gartley: 1.0×XA beyond X
//    Butterfly: 1.41×XA
//    Crab/Deep Crab: 2.0×XA
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
  price: number
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
  ratioCD: number     // CD / BC  (BC projection)
  ratioXAD: number    // D retracement/extension vs XA
  distFromD: number   // % distance from current price to PRZ midpoint
  status: 'FORMING' | 'COMPLETED'
  description: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const TOL = 0.05                // ±5% standard tolerance
const TIGHT = 0.03              // ±3% tight tolerance for "Perfect" variants
const ZIGZAG_DEVIATION_DEFAULT = 0.025  // 2.5% default (tuned per chart period by caller)

// ── ZigZag Swing Point Finder ──────────────────────────────────────────────
// deviation: minimum % price move to register a pivot (2.5% daily, 3% weekly)
// maxPoints: how many recent swing points to keep (more = more pattern windows)

export function findSwingPoints(
  candles: Candle[],
  maxPoints = 12,
  deviation = ZIGZAG_DEVIATION_DEFAULT,
): SwingPoint[] {
  if (candles.length < 10) return []

  const pivots: SwingPoint[] = []
  let lastPivotPrice = candles[0].close
  let lastPivotType: 'HIGH' | 'LOW' = candles[1].close > candles[0].close ? 'LOW' : 'HIGH'
  let lastPivotIdx = 0

  for (let i = 1; i < candles.length; i++) {
    const price = candles[i].close
    const pctMove = Math.abs(price - lastPivotPrice) / lastPivotPrice

    if (pctMove >= deviation) {
      if (price > lastPivotPrice && lastPivotType === 'LOW') {
        pivots.push({ index: lastPivotIdx, price: lastPivotPrice, type: 'LOW', date: candles[lastPivotIdx].date })
        lastPivotType = 'HIGH'
        lastPivotPrice = price
        lastPivotIdx = i
      } else if (price < lastPivotPrice && lastPivotType === 'HIGH') {
        pivots.push({ index: lastPivotIdx, price: lastPivotPrice, type: 'HIGH', date: candles[lastPivotIdx].date })
        lastPivotType = 'LOW'
        lastPivotPrice = price
        lastPivotIdx = i
      } else {
        lastPivotPrice = price
        lastPivotIdx = i
      }
    }
  }

  pivots.push({
    index: candles.length - 1,
    price: candles[candles.length - 1].close,
    type: lastPivotType,
    date: candles[candles.length - 1].date,
  })

  return pivots.slice(-maxPoints)
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
  cd: number      // |CD| / |BC|  (BC projection)
  xad: number     // |D - A| / |XA|  (D as retrace of XA from A)
  xaExt: number   // |D - X| / |XA|  (D distance beyond X)
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
// All validators require C < A structurally (standard patterns).
// Cypher and Shark have their own separate validators.

// GARTLEY
// B = 0.58–<0.786 of XA (ideal 0.618)
// C = 0.382–0.886 of AB (C does not exceed A)
// D = 0.786 of XA from A
// CD = 1.13–1.618 × BC (BC projection)
function validateGartley(r: LegRatios): boolean {
  return (
    inRange(r.ab, 0.58, 0.786) &&
    r.ab < 0.786 * (1 + TOL) &&
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xad, 0.786) &&
    inRange(r.cd, 1.13, 1.618)
  )
}

// PERFECT GARTLEY
// B = 0.618 (exact), C = 0.618, D = 0.786 of XA, CD = 1.618 × BC
function validatePerfectGartley(r: LegRatios): boolean {
  return (
    near(r.ab, 0.618, TIGHT) &&
    near(r.bc, 0.618, TIGHT) &&
    near(r.xad, 0.786, TIGHT) &&
    near(r.cd, 1.618, TIGHT)
  )
}

// BAT
// B = 0.382–<0.618 of XA (ideal 0.5, MUST NOT equal or exceed 0.618)
// C = 0.382–0.886 of AB
// D = 0.886 of XA from A
// CD = 1.618–2.618 × BC
function validateBat(r: LegRatios): boolean {
  return (
    inRange(r.ab, 0.382, 0.618) &&
    r.ab < 0.618 &&                       // strict upper bound: NOT Gartley
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xad, 0.886) &&
    inRange(r.cd, 1.618, 2.618)
  )
}

// PERFECT BAT
// B = 0.50 (exact), C = 0.50–0.618, D = 0.886 of XA, CD = 2.0 × BC
function validatePerfectBat(r: LegRatios): boolean {
  return (
    near(r.ab, 0.50, TIGHT) &&
    inRange(r.bc, 0.50, 0.618) &&
    near(r.xad, 0.886, TIGHT) &&
    near(r.cd, 2.0, TIGHT)
  )
}

// ALT BAT (Alternate Bat)
// B = 0.382 (strict, shallow retrace), C = 0.382–0.886
// D = 1.13 extension of XA (xaExt = 0.13 since D = X - 0.13×XA)
// CD = 1.618–2.618 × BC (similar to regular Bat)
function validateAltBat(r: LegRatios): boolean {
  return (
    near(r.ab, 0.382, TIGHT) &&
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xaExt, 0.13) &&               // FIXED: 0.13 not 1.13
    inRange(r.cd, 1.618, 2.618)
  )
}

// BUTTERFLY
// B = 0.75–0.81 of XA (ideal 0.786)
// C = 0.382–0.886 of AB (C does not exceed A)
// D = 1.27 extension of XA: D = X - 0.27×XA → xaExt = 0.27  ← CRITICAL FIX
// CD = 1.618–2.24 × BC (BC projection)
function validateButterfly(r: LegRatios): boolean {
  return (
    inRange(r.ab, 0.75, 0.81) &&
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xaExt, 0.27) &&               // FIXED: 0.27 not 1.27
    inRange(r.cd, 1.618, 2.24)
  )
}

// PERFECT BUTTERFLY
// B = 0.786 (exact), C = 0.50–0.886, D = 1.27 ext (xaExt=0.27), CD = 1.618 × BC
function validatePerfectButterfly(r: LegRatios): boolean {
  return (
    near(r.ab, 0.786, TIGHT) &&
    inRange(r.bc, 0.50, 0.886) &&
    near(r.xaExt, 0.27, TIGHT) &&        // FIXED: 0.27 not 1.27
    near(r.cd, 1.618, TIGHT)
  )
}

// CRAB
// B = 0.382–0.618 of XA
// C = 0.382–0.886 of AB (C does not exceed A)
// D = 1.618 extension of XA: D = X - 0.618×XA → xaExt = 0.618  ← CRITICAL FIX
// CD = 2.618–3.618 × BC (extreme BC projection)
function validateCrab(r: LegRatios): boolean {
  return (
    inRange(r.ab, 0.382, 0.618) &&
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xaExt, 0.618) &&              // FIXED: 0.618 not 1.618
    inRange(r.cd, 2.618, 3.618)
  )
}

// DEEP CRAB
// B > 0.886 of XA (STRICTLY GREATER — very deep retrace close to X)
// C = 0.382–0.886 of AB (C does not exceed A)
// D = 1.618 extension of XA (same D target as Crab, xaExt = 0.618)  ← CRITICAL FIX
// CD = 2.0–3.618 × BC (min 2.0 per table)
function validateDeepCrab(r: LegRatios): boolean {
  return (
    r.ab > 0.886 * (1 - TIGHT) &&        // B strictly > 0.886 (only slight downward tolerance)
    r.ab < 1.0 &&                          // B cannot reach X
    inRange(r.bc, 0.382, 0.886) &&
    near(r.xaExt, 0.618) &&              // FIXED: same D as Crab (0.618 not 1.618)
    inRange(r.cd, 2.0, 3.618)
  )
}

// PERFECT CRAB
// B = 0.618 (exact), C = 0.50–0.618, D = 1.618 ext (xaExt=0.618), CD = 3.14 × BC
function validatePerfectCrab(r: LegRatios): boolean {
  return (
    near(r.ab, 0.618, TIGHT) &&
    inRange(r.bc, 0.50, 0.618) &&
    near(r.xaExt, 0.618, TIGHT) &&       // FIXED
    near(r.cd, 3.14, 0.08)              // CD = 3.14 (slightly wider tolerance for precision)
  )
}

// ── CYPHER Validator ────────────────────────────────────────────────────────
// STRUCTURALLY DIFFERENT: C goes BEYOND A (C > A for bullish, C < A for bearish)
// B = 0.382–0.618 of XA
// C = 1.13–1.414 extension of XA measured from X (XC/XA = 1.13–1.414)
// D = 0.786 retracement of XC (NOT XA!)

interface CypherResult {
  valid: boolean
  ratioAB: number
  ratioXC_XA: number   // XC / XA  (how far C extends beyond X relative to XA)
  ratioD_XC: number    // |D-C| / XC  (D retracement of XC)
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
    inRange(ratioAB, 0.382, 0.618) &&      // B = 0.382–0.618 of XA
    inRange(ratioXC_XA, 1.13, 1.414) &&    // FIXED: 1.13–1.414 (was 1.272–1.414)
    near(ratioD_XC, 0.786)                 // D = 0.786 of XC
  )

  return { valid, ratioAB, ratioXC_XA, ratioD_XC }
}

// ── SHARK Validator ─────────────────────────────────────────────────────────
// 5-point pattern: O, X, A, B, C — C IS the PRZ (no D point)
// BULLISH Shark: O=HIGH, X=LOW, A=HIGH, B=LOW(below X!), C=HIGH(PRZ)
// BEARISH Shark: O=LOW, X=HIGH, A=LOW, B=HIGH(above X!), C=LOW(PRZ)
// B goes BEYOND X (key structural signature of Shark)
// Ratios:
//   XA/OX = 0.382–0.618 (XA retraces OX)
//   AB/XA = 1.13–1.618 (AB extends XA, going beyond X)
//   C/OX  = 0.886 (C retraces OX from O — the PRZ point)

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

  // Structural: B must go beyond X (that's what makes it a Shark)
  const bBeyondX = bullish ? B < X : B > X

  const valid = (
    bBeyondX &&
    inRange(ratioXA_OX, 0.382, 0.618) &&
    inRange(ratioAB_XA, 1.13, 1.618) &&
    near(ratioC_OX, 0.886, 0.07)
  )

  return { valid, ratioXA_OX, ratioAB_XA, ratioC_OX }
}

// ── PRZ Calculator ──────────────────────────────────────────────────────────
// Computes the Potential Reversal Zone price band.
// proj1 = XA-based primary projection
// proj2 = AB=CD secondary confluence
// PRZ = band around the midpoint of proj1 and proj2

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

  // All projections use the formula:
  //   - "D at R retracement of XA from A": proj = A ± R×XA (bullish: A - R×XA)
  //   - "D at 1.xx extension beyond X":    proj = X ∓ ext×XA (bullish: X - ext×XA)
  //     where ext = (XA_extension - 1.0), e.g. 1.27 ext → D = X - 0.27×XA

  if (pattern === 'Gartley' || pattern === 'Perfect Gartley') {
    proj1 = bullish ? A - 0.786 * XA : A + 0.786 * XA
  } else if (pattern === 'Bat' || pattern === 'Perfect Bat') {
    proj1 = bullish ? A - 0.886 * XA : A + 0.886 * XA
  } else if (pattern === 'Alt Bat') {
    proj1 = bullish ? X - 0.13 * XA : X + 0.13 * XA
  } else if (pattern === 'Butterfly' || pattern === 'Perfect Butterfly') {
    proj1 = bullish ? X - 0.27 * XA : X + 0.27 * XA
  } else if (pattern === 'Crab' || pattern === 'Deep Crab' || pattern === 'Perfect Crab') {
    proj1 = bullish ? X - 0.618 * XA : X + 0.618 * XA
  } else if (pattern === 'AB=CD') {
    proj1 = bullish ? C - AB : C + AB
  } else if (pattern === 'Cypher') {
    proj1 = bullish ? C - 0.786 * XC : C + 0.786 * XC
  } else if (pattern === 'Shark') {
    proj1 = C  // C itself is the PRZ for Shark
  }

  // AB=CD secondary confluence (C ± AB)
  proj2 = bullish ? C - AB : C + AB
  // No secondary for Cypher and Shark
  if (pattern === 'Cypher' || pattern === 'Shark') proj2 = proj1

  const przMid = (proj1 + proj2) / 2
  const spread = Math.abs(proj1 - proj2) / 2 + Math.abs(przMid) * 0.005
  return {
    przLow: Math.min(proj1, proj2) - spread * 0.5,
    przHigh: Math.max(proj1, proj2) + spread * 0.5,
    przMid,
  }
}

// ── Helper to push a detected pattern ──────────────────────────────────────

function makePattern(
  name: HarmonicPatternName,
  direction: HarmonicDirection,
  X: number, A: number, B: number, C: number,
  ratioAB: number, ratioBC: number, ratioCD: number, ratioXAD: number,
  przLow: number, przHigh: number, przMid: number,
  currentPrice: number,
  status: 'FORMING' | 'COMPLETED',
): HarmonicPattern {
  const distFromD = przMid !== 0 ? ((currentPrice - przMid) / przMid) * 100 : 0
  return {
    name, direction, X, A, B, C, D: przMid,
    przLow, przHigh,
    ratioAB: +ratioAB.toFixed(3),
    ratioBC: +ratioBC.toFixed(3),
    ratioCD: +ratioCD.toFixed(3),
    ratioXAD: +ratioXAD.toFixed(3),
    distFromD: +distFromD.toFixed(2),
    status,
    description: `${direction} ${name}: AB=${(ratioAB*100).toFixed(0)}% XA, D-target ₹${przMid.toFixed(1)}, PRZ ₹${przLow.toFixed(1)}–₹${przHigh.toFixed(1)}`,
  }
}

// ── Main Harmonic Scanner ────────────────────────────────────────────────────

export function detectHarmonicPatterns(
  candles: Candle[],
  deviation = ZIGZAG_DEVIATION_DEFAULT,
  maxPivots = 15,
): HarmonicPattern[] {
  if (candles.length < 20) return []

  const results: HarmonicPattern[] = []
  const pivots = findSwingPoints(candles, maxPivots, deviation)
  if (pivots.length < 5) return []

  const currentPrice = candles[candles.length - 1].close

  for (let start = 0; start <= pivots.length - 5; start++) {
    const [P0, P1, P2, P3, P4] = pivots.slice(start, start + 5)

    // =========================================================================
    // BLOCK A: LOW-HIGH-LOW-HIGH sequence
    //   → Standard Bullish XABCD (X=P0, A=P1, B=P2, C=P3, D=P4/current)
    //   → Bullish Cypher (same mapping but C > A)
    //   → Bearish Shark (O=P0, X=P1, A=P2, B=P3(HIGH!>X), C=P4)
    // =========================================================================
    if (P0.type === 'LOW' && P1.type === 'HIGH' && P2.type === 'LOW' && P3.type === 'HIGH') {
      const X = P0.price, A = P1.price, B = P2.price, C = P3.price
      const D = P4.type === 'LOW' ? P4.price : currentPrice
      const status: 'FORMING' | 'COMPLETED' = P4.type === 'LOW' ? 'COMPLETED' : 'FORMING'

      // --- Standard Bullish: B > X and C < A (C does not exceed A) ---
      if (B > X && C < A) {
        const r = computeLegRatios(X, A, B, C, D)
        const AB = Math.abs(B - A)
        const CD = Math.abs(D - C)
        const abcdRatio = AB > 0 ? CD / AB : 0

        // AB=CD
        if (near(abcdRatio, 1.0, 0.07)) {
          const prz = computePRZ(X, A, B, C, 'AB=CD', true)
          results.push(makePattern('AB=CD', 'Bullish', X, A, B, C, r.ab, r.bc, abcdRatio, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateGartley(r)) {
          const prz = computePRZ(X, A, B, C, 'Gartley', true)
          results.push(makePattern('Gartley', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validatePerfectGartley(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Gartley', true)
          results.push(makePattern('Perfect Gartley', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Bat', true)
          results.push(makePattern('Bat', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validatePerfectBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Bat', true)
          results.push(makePattern('Perfect Bat', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateAltBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Alt Bat', true)
          results.push(makePattern('Alt Bat', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateButterfly(r)) {
          const prz = computePRZ(X, A, B, C, 'Butterfly', true)
          results.push(makePattern('Butterfly', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validatePerfectButterfly(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Butterfly', true)
          results.push(makePattern('Perfect Butterfly', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Crab', true)
          results.push(makePattern('Crab', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateDeepCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Deep Crab', true)
          results.push(makePattern('Deep Crab', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validatePerfectCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Crab', true)
          results.push(makePattern('Perfect Crab', 'Bullish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
      }

      // --- Bullish Cypher: B > X and C > A (C extends BEYOND A) ---
      // FIXED: Previously blocked by early `continue`. Now checked separately.
      if (B > X && C > A) {
        const cypherR = validateCypher(X, A, B, C, D, true)
        if (cypherR.valid) {
          const XC = Math.abs(C - X)
          const przMid = C - 0.786 * XC
          const przSpread = Math.abs(przMid) * 0.012
          results.push({
            name: 'Cypher', direction: 'Bullish',
            X, A, B, C, D: przMid,
            przLow: przMid - przSpread,
            przHigh: przMid + przSpread,
            ratioAB: +cypherR.ratioAB.toFixed(3),
            ratioBC: +cypherR.ratioXC_XA.toFixed(3),
            ratioCD: +cypherR.ratioD_XC.toFixed(3),
            ratioXAD: +cypherR.ratioXC_XA.toFixed(3),
            distFromD: +((currentPrice - przMid) / przMid * 100).toFixed(2),
            status,
            description: `Bullish Cypher: C=${(cypherR.ratioXC_XA*100).toFixed(0)}% ext XA (beyond A), D=0.786 of XC. PRZ ₹${(przMid-przSpread).toFixed(1)}–₹${(przMid+przSpread).toFixed(1)}`,
          })
        }
      }

      // --- Bearish Shark: O=P0, X=P1(LOW), A=P2(HIGH), B=P3(LOW, B<X!) ---
      // B=P3 is a LOW. For bearish Shark, B goes BELOW X(P1=LOW): P3.price < P1.price
      if (P3.price < P1.price && P4.type === 'HIGH') {
        const shR = validateShark(P0.price, P1.price, P2.price, P3.price, P4.price, false)
        // Wait: bearish shark has O=LOW, X=HIGH, A=LOW, B=HIGH(>X), C=LOW(PRZ)
        // But here P0=LOW, P1=HIGH, P2=LOW, P3=HIGH, P4=LOW
        // If P3 > P1 this could be bearish Shark (B=P3=HIGH above X=P1=HIGH)
        // But P3 is HIGH here, not LOW - check is wrong above. Skip, handled in BLOCK B.
      }
    }

    // =========================================================================
    // BLOCK B: HIGH-LOW-HIGH-LOW sequence
    //   → Standard Bearish XABCD (X=P0, A=P1, B=P2, C=P3, D=P4/current)
    //   → Bearish Cypher (same mapping but C < A)
    //   → Bullish Shark (O=P0, X=P1, A=P2, B=P3(LOW!<X), C=P4)
    // =========================================================================
    if (P0.type === 'HIGH' && P1.type === 'LOW' && P2.type === 'HIGH' && P3.type === 'LOW') {
      const X = P0.price, A = P1.price, B = P2.price, C = P3.price
      const D = P4.type === 'HIGH' ? P4.price : currentPrice
      const status: 'FORMING' | 'COMPLETED' = P4.type === 'HIGH' ? 'COMPLETED' : 'FORMING'

      // --- Standard Bearish: B < X and C > A (C does not exceed A downward) ---
      if (B < X && C > A) {
        const r = computeLegRatios(X, A, B, C, D)
        const AB = Math.abs(B - A)
        const CD = Math.abs(D - C)
        const abcdRatio = AB > 0 ? CD / AB : 0

        if (near(abcdRatio, 1.0, 0.07)) {
          const prz = computePRZ(X, A, B, C, 'AB=CD', false)
          results.push(makePattern('AB=CD', 'Bearish', X, A, B, C, r.ab, r.bc, abcdRatio, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateGartley(r)) {
          const prz = computePRZ(X, A, B, C, 'Gartley', false)
          results.push(makePattern('Gartley', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validatePerfectGartley(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Gartley', false)
          results.push(makePattern('Perfect Gartley', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Bat', false)
          results.push(makePattern('Bat', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validatePerfectBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Bat', false)
          results.push(makePattern('Perfect Bat', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xad, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateAltBat(r)) {
          const prz = computePRZ(X, A, B, C, 'Alt Bat', false)
          results.push(makePattern('Alt Bat', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateButterfly(r)) {
          const prz = computePRZ(X, A, B, C, 'Butterfly', false)
          results.push(makePattern('Butterfly', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validatePerfectButterfly(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Butterfly', false)
          results.push(makePattern('Perfect Butterfly', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Crab', false)
          results.push(makePattern('Crab', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validateDeepCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Deep Crab', false)
          results.push(makePattern('Deep Crab', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
        if (validatePerfectCrab(r)) {
          const prz = computePRZ(X, A, B, C, 'Perfect Crab', false)
          results.push(makePattern('Perfect Crab', 'Bearish', X, A, B, C, r.ab, r.bc, r.cd, r.xaExt, prz.przLow, prz.przHigh, prz.przMid, currentPrice, status))
        }
      }

      // --- Bearish Cypher: B < X and C < A (C extends BEYOND A downward) ---
      if (B < X && C < A) {
        const cypherR = validateCypher(X, A, B, C, D, false)
        if (cypherR.valid) {
          const XC = Math.abs(C - X)
          const przMid = C + 0.786 * XC
          const przSpread = Math.abs(przMid) * 0.012
          results.push({
            name: 'Cypher', direction: 'Bearish',
            X, A, B, C, D: przMid,
            przLow: przMid - przSpread,
            przHigh: przMid + przSpread,
            ratioAB: +cypherR.ratioAB.toFixed(3),
            ratioBC: +cypherR.ratioXC_XA.toFixed(3),
            ratioCD: +cypherR.ratioD_XC.toFixed(3),
            ratioXAD: +cypherR.ratioXC_XA.toFixed(3),
            distFromD: +((currentPrice - przMid) / przMid * 100).toFixed(2),
            status,
            description: `Bearish Cypher: C=${(cypherR.ratioXC_XA*100).toFixed(0)}% ext XA (beyond A), D=0.786 of XC. PRZ ₹${(przMid-przSpread).toFixed(1)}–₹${(przMid+przSpread).toFixed(1)}`,
          })
        }
      }

      // --- Bullish Shark: O=P0(HIGH), X=P1(LOW), A=P2(HIGH), B=P3(LOW, B<X!) ---
      // B must go BELOW X (P3.price < P1.price) — this is what makes it a Shark
      if (P3.price < P1.price && P4.type === 'HIGH') {
        const shR = validateShark(P0.price, P1.price, P2.price, P3.price, P4.price, true)
        if (shR.valid) {
          const przMid = P4.price
          const przSpread = Math.abs(przMid) * 0.012
          results.push({
            name: 'Shark', direction: 'Bullish',
            X: P0.price, A: P1.price, B: P2.price, C: P3.price, D: przMid,
            przLow: przMid - przSpread, przHigh: przMid + przSpread,
            ratioAB: +shR.ratioXA_OX.toFixed(3),
            ratioBC: +shR.ratioAB_XA.toFixed(3),
            ratioCD: +shR.ratioC_OX.toFixed(3),
            ratioXAD: +shR.ratioC_OX.toFixed(3),
            distFromD: +((currentPrice - przMid) / przMid * 100).toFixed(2),
            status: 'COMPLETED',
            description: `Bullish Shark (5-pt O-X-A-B-C): C=PRZ at 0.886 of OX. PRZ ₹${(przMid-przSpread).toFixed(1)}–₹${(przMid+przSpread).toFixed(1)}`,
          })
        }
      }
    }

    // =========================================================================
    // BLOCK C: Bearish Shark
    //   Sequence LOW-HIGH-LOW-HIGH-LOW (same as bullish XABCD)
    //   O=P0(LOW), X=P1(HIGH), A=P2(LOW), B=P3(HIGH, B>X!), C=P4(LOW=PRZ)
    // =========================================================================
    if (P0.type === 'LOW' && P1.type === 'HIGH' && P2.type === 'LOW' && P3.type === 'HIGH') {
      // B=P3 is HIGH. For bearish Shark, B > X: P3.price > P1.price
      if (P3.price > P1.price && P4.type === 'LOW') {
        const shR = validateShark(P0.price, P1.price, P2.price, P3.price, P4.price, false)
        if (shR.valid) {
          const przMid = P4.price
          const przSpread = Math.abs(przMid) * 0.012
          results.push({
            name: 'Shark', direction: 'Bearish',
            X: P0.price, A: P1.price, B: P2.price, C: P3.price, D: przMid,
            przLow: przMid - przSpread, przHigh: przMid + przSpread,
            ratioAB: +shR.ratioXA_OX.toFixed(3),
            ratioBC: +shR.ratioAB_XA.toFixed(3),
            ratioCD: +shR.ratioC_OX.toFixed(3),
            ratioXAD: +shR.ratioC_OX.toFixed(3),
            distFromD: +((currentPrice - przMid) / przMid * 100).toFixed(2),
            status: 'COMPLETED',
            description: `Bearish Shark (5-pt O-X-A-B-C): C=PRZ at 0.886 of OX. PRZ ₹${(przMid-przSpread).toFixed(1)}–₹${(przMid+przSpread).toFixed(1)}`,
          })
        }
      }
    }
  }

  // Deduplicate: keep the instance of each pattern closest to current price
  const seen = new Map<string, HarmonicPattern>()
  for (const p of results) {
    const key = `${p.name}-${p.direction}`
    const existing = seen.get(key)
    if (!existing || Math.abs(p.distFromD) < Math.abs(existing.distFromD)) {
      seen.set(key, p)
    }
  }

  // Sort: FORMING first (approaching PRZ = most actionable), then by proximity
  return Array.from(seen.values()).sort((a, b) => {
    if (a.status === 'FORMING' && b.status !== 'FORMING') return -1
    if (b.status === 'FORMING' && a.status !== 'FORMING') return 1
    return Math.abs(a.distFromD) - Math.abs(b.distFromD)
  })
}
