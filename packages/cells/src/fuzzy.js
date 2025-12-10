/**
 * FuzzyCell - A cell with intelligent compaction.
 *
 * Unlike lattice cells which only grow monotonically,
 * fuzzy cells can reorganize their structure while
 * preserving semantic information.
 *
 * Key properties:
 * - Accumulation: restructuring IS still accumulation, information isn't lost
 * - Conservative: don't over-compact, preserve detail that matters
 * - Idempotent: no change if nothing new has been added
 * - Tunable rate: not every write triggers restructuring
 */
export class FuzzyCell {
  /**
   * @param {object} options
   * @param {number} [options.compactThreshold=100] - Entries before considering compaction
   * @param {number} [options.compactProbability=0.1] - Random chance per write after threshold
   * @param {number} [options.minCompactInterval=60000] - Minimum ms between compactions
   * @param {function} [options.compactor] - async (accumulated, delta, context) => newAccumulated
   */
  constructor(options = {}) {
    const {
      compactThreshold = 100,
      compactProbability = 0.1,
      minCompactInterval = 60000,
      compactor = null
    } = options

    this.accumulated = []
    this.pendingDelta = []
    this.lastCompactedAt = 0
    this.compactThreshold = compactThreshold
    this.compactProbability = compactProbability
    this.minCompactInterval = minCompactInterval
    this.compactor = compactor
    this.stats = { writes: 0, compactions: 0 }
  }

  /**
   * Write a value to the cell (accumulates)
   * @param {*} value - Value to accumulate
   * @param {object} [context] - Context passed to compactor
   */
  async write(value, context = {}) {
    this.accumulated.push(value)
    this.pendingDelta.push(value)
    this.stats.writes++

    if (this._shouldCompact()) {
      await this.compact(context)
    }

    return {
      accumulated: this.accumulated,
      pending: this.pendingDelta.length,
      stats: this.stats
    }
  }

  /**
   * Read the current accumulated state
   */
  read() {
    return {
      accumulated: this.accumulated,
      pending: this.pendingDelta.length,
      stats: this.stats
    }
  }

  /**
   * Force compaction
   * @param {object} [context] - Context passed to compactor
   */
  async compact(context = {}) {
    // Idempotent - no delta means no work
    if (this.pendingDelta.length === 0) {
      return { compacted: false, reason: 'no_delta' }
    }

    if (!this.compactor) {
      // Clear pending delta even without compactor
      this.pendingDelta = []
      return { compacted: false, reason: 'no_compactor' }
    }

    const delta = [...this.pendingDelta]
    const before = this.accumulated.length

    try {
      this.accumulated = await this.compactor(this.accumulated, delta, context)
      this.pendingDelta = []
      this.lastCompactedAt = Date.now()
      this.stats.compactions++

      return {
        compacted: true,
        before,
        after: this.accumulated.length,
        deltaSize: delta.length
      }
    } catch (err) {
      return { compacted: false, reason: 'error', error: err.message }
    }
  }

  /**
   * Check if we should trigger automatic compaction
   */
  _shouldCompact() {
    // Not enough entries yet
    if (this.accumulated.length < this.compactThreshold) {
      return false
    }

    // Too soon since last compaction
    const elapsed = Date.now() - this.lastCompactedAt
    if (elapsed < this.minCompactInterval) {
      return false
    }

    // Random chance
    return Math.random() < this.compactProbability
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      type: 'fuzzy',
      accumulated: this.accumulated,
      pendingDelta: this.pendingDelta,
      lastCompactedAt: this.lastCompactedAt,
      stats: this.stats,
      config: {
        compactThreshold: this.compactThreshold,
        compactProbability: this.compactProbability,
        minCompactInterval: this.minCompactInterval
      }
    }
  }

  /**
   * Restore from JSON
   * @param {object} data - Serialized data
   * @param {object} options - Options including compactor
   */
  static fromJSON(data, options = {}) {
    const cell = new FuzzyCell({
      ...data.config,
      ...options
    })
    cell.accumulated = data.accumulated || []
    cell.pendingDelta = data.pendingDelta || []
    cell.lastCompactedAt = data.lastCompactedAt || 0
    cell.stats = data.stats || { writes: 0, compactions: 0 }
    return cell
  }
}
