/**
 * Integer-based strength system to avoid floating point errors
 * 
 * Similar to Ethereum's wei system:
 * - 1 STRENGTH = 10000 units (basis points)
 * - This gives us 0.01% granularity
 * - All internal calculations use integers
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Base unit for strength calculations
 * 10000 = 1.0 strength (100%)
 * 100 = 0.01 strength (1%)  
 * 1 = 0.0001 strength (0.01%)
 */
export const STRENGTH_BASE = 10000

/**
 * Maximum strength value (10x base = 1000%)
 */
export const MAX_STRENGTH = STRENGTH_BASE * 10

/**
 * Special value to completely kill/mute a signal
 */
export const KILL_SIGNAL = Number.MIN_SAFE_INTEGER

/**
 * Hysteresis in strength units (0 = no hysteresis by default)
 * Users can implement hysteresis in userspace if needed
 */
export const HYSTERESIS_UNITS = 0

// ============================================================================
// Conversion functions
// ============================================================================

/**
 * Convert a decimal strength (0.0 to 1.0+) to integer units
 */
export function toUnits(decimal: number): number {
  return Math.round(decimal * STRENGTH_BASE)
}

/**
 * Convert integer units back to decimal for display
 */
export function fromUnits(units: number): number {
  return units / STRENGTH_BASE
}

/**
 * Format strength units for display
 */
export function formatStrength(units: number): string {
  const decimal = fromUnits(units)
  return decimal.toFixed(4).replace(/\.?0+$/, '')
}

// ============================================================================
// Arithmetic operations
// ============================================================================

/**
 * Adjust strength by a control value (additive)
 * Negative values reduce, positive values boost
 * Clamped to [0, MAX_STRENGTH]
 */
export function adjustStrength(strength: number, control: number): number {
  if (control === KILL_SIGNAL) {
    return 0  // Complete mute
  }
  const adjusted = strength + control
  return Math.max(0, Math.min(adjusted, MAX_STRENGTH))
}

/**
 * Calculate minimum of multiple strengths
 */
export function minStrength(...strengths: number[]): number {
  return Math.min(...strengths)
}

/**
 * Check if new signal should replace current signal
 * Uses > semantics for proper halting
 */
export function shouldPropagate(newStrength: number, currentStrength: number): boolean {
  return newStrength > currentStrength
}

// ============================================================================
// Common strength values as constants
// ============================================================================

export const STRENGTH_ZERO = 0
export const STRENGTH_MIN = 1  // 0.01%
export const STRENGTH_QUARTER = STRENGTH_BASE / 4  // 25%
export const STRENGTH_HALF = STRENGTH_BASE / 2  // 50%
export const STRENGTH_FULL = STRENGTH_BASE  // 100%
export const STRENGTH_DOUBLE = STRENGTH_BASE * 2  // 200%