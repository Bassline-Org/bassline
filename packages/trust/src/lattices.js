/**
 * Trust estimate lattice
 *
 * Tracks trust as a statistical estimate with:
 * - value: The estimated trust level (0-1)
 * - samples: Number of observations
 * - variance: Statistical variance (confidence)
 *
 * Merge combines observations using weighted average,
 * increasing confidence as samples grow.
 */

/**
 * @typedef {Object} TrustEstimate
 * @property {number} value - Trust value (0-1)
 * @property {number} samples - Number of observations
 * @property {number} variance - Statistical variance
 */

/**
 * Create initial trust estimate (no observations)
 * @returns {TrustEstimate}
 */
export function initial() {
  return { value: 0.5, samples: 0, variance: 0.25 }
}

/**
 * Merge two trust estimates using weighted combination
 * More samples = more weight in the merge
 *
 * @param {TrustEstimate} a - First estimate
 * @param {TrustEstimate} b - Second estimate
 * @returns {TrustEstimate} Combined estimate
 */
export function merge(a, b) {
  // Empty states
  if (!a || a.samples === 0) return b || initial()
  if (!b || b.samples === 0) return a

  const totalSamples = a.samples + b.samples

  // Weighted average of values
  const value = (a.value * a.samples + b.value * b.samples) / totalSamples

  // Combined variance (simplified - pools variance and adds cross-term)
  const variance = (
    (a.variance * a.samples + b.variance * b.samples) / totalSamples +
    (a.samples * b.samples * Math.pow(a.value - b.value, 2)) / (totalSamples * totalSamples)
  )

  return { value, samples: totalSamples, variance }
}

/**
 * Add a single observation to a trust estimate
 * outcome: 1 = positive, 0 = negative
 *
 * @param {TrustEstimate} estimate - Current estimate
 * @param {number} outcome - Observation (0 or 1)
 * @returns {TrustEstimate} Updated estimate
 */
export function observe(estimate, outcome) {
  const current = estimate || initial()
  const n = current.samples + 1

  // Welford's online algorithm for mean and variance
  const delta = outcome - current.value
  const newValue = current.value + delta / n
  const delta2 = outcome - newValue
  const newVariance = current.samples === 0
    ? 0.25 // High initial variance
    : ((current.variance * (current.samples - 1)) + delta * delta2) / (n - 1)

  return {
    value: newValue,
    samples: n,
    variance: Math.max(0.001, newVariance) // Floor to prevent zero variance
  }
}

/**
 * Decay trust over time (reduce confidence without changing value)
 * Used when peer hasn't been seen recently
 *
 * @param {TrustEstimate} estimate - Current estimate
 * @param {number} factor - Decay factor (0-1, lower = more decay)
 * @returns {TrustEstimate} Decayed estimate
 */
export function decay(estimate, factor = 0.9) {
  if (!estimate) return initial()
  return {
    value: estimate.value,
    samples: Math.floor(estimate.samples * factor),
    variance: Math.min(0.25, estimate.variance / factor) // Increase variance as samples decay
  }
}

/**
 * Check if trust meets a threshold
 *
 * @param {TrustEstimate} estimate - Trust estimate
 * @param {number} threshold - Required trust level (0-1)
 * @param {number} [minSamples=3] - Minimum samples required
 * @returns {boolean} Whether trust exceeds threshold
 */
export function meetsThreshold(estimate, threshold, minSamples = 3) {
  if (!estimate || estimate.samples < minSamples) return false
  return estimate.value >= threshold
}

/**
 * Get confidence interval for the trust value
 *
 * @param {TrustEstimate} estimate - Trust estimate
 * @param {number} [z=1.96] - Z-score (1.96 for 95% CI)
 * @returns {{low: number, high: number}} Confidence interval
 */
export function confidenceInterval(estimate, z = 1.96) {
  if (!estimate || estimate.samples === 0) {
    return { low: 0, high: 1 }
  }
  const se = Math.sqrt(estimate.variance / estimate.samples)
  return {
    low: Math.max(0, estimate.value - z * se),
    high: Math.min(1, estimate.value + z * se)
  }
}

export const trustEstimate = {
  initial,
  merge,
  observe,
  decay,
  meetsThreshold,
  confidenceInterval
}
