/**
 * Built-in compactor strategies for FuzzyCell.
 *
 * A compactor is an async function: (accumulated, delta, context) => newAccumulated
 * - accumulated: the current full state
 * - delta: new entries since last compaction
 * - context: optional context from the cell
 */

/**
 * Create a Claude-powered knowledge compactor.
 * Uses the Claude service to intelligently consolidate information.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance with Claude service
 * @param {object} [options]
 * @param {number} [options.preserveRecent=10] - Always keep N most recent entries verbatim
 * @param {string} [options.systemPrompt] - Custom system prompt for Claude
 */
export function createKnowledgeCompactor(bl, options = {}) {
  const {
    preserveRecent = 10,
    systemPrompt = `You are a knowledge consolidation assistant.
Your task is to restructure and consolidate information while preserving all important details.
- Merge redundant information
- Keep recent items more detailed
- Organize by topic or theme
- Never discard unique information
- Return valid JSON array only, no markdown, no explanation`,
  } = options

  return async (accumulated, delta, context) => {
    // Short-circuit if nothing to compact
    if (delta.length === 0) return accumulated

    // Separate recent from older entries
    const cutoff = Math.max(0, accumulated.length - preserveRecent)
    const toCompact = accumulated.slice(0, cutoff)
    const recent = accumulated.slice(cutoff)

    // If not enough to compact, just return as-is
    if (toCompact.length < preserveRecent) {
      return accumulated
    }

    try {
      const result = await bl.put(
        'bl:///services/claude/complete',
        {},
        {
          prompt: `Current knowledge base (to consolidate):
${JSON.stringify(toCompact, null, 2)}

Recent entries (preserve verbatim, shown for context only):
${JSON.stringify(recent, null, 2)}

Consolidate the "Current knowledge base" into a more organized structure.
Return ONLY a JSON array of the consolidated entries.`,
          system: systemPrompt,
        }
      )

      // Parse response - look for JSON array
      const text = result.body.text.trim()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn('Compactor: Invalid JSON response, keeping original')
        return accumulated
      }

      const compacted = JSON.parse(jsonMatch[0])
      return [...compacted, ...recent]
    } catch (err) {
      console.warn('Compactor: Error during compaction:', err.message)
      return accumulated
    }
  }
}

/**
 * Simple deduplication compactor (no LLM needed).
 * Removes duplicate entries based on a key function.
 *
 * @param {object} [options]
 * @param {function} [options.keyFn] - Function to extract dedup key from entry
 */
export function createDedupeCompactor(options = {}) {
  const { keyFn = JSON.stringify } = options

  return async (accumulated, delta) => {
    const seen = new Set()
    return accumulated.filter((item) => {
      const key = keyFn(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

/**
 * Time-window compactor - keeps only recent entries.
 * Filters out entries older than maxAge.
 *
 * @param {object} [options]
 * @param {number} [options.maxAge=86400000] - Maximum age in ms (default 24 hours)
 * @param {string[]} [options.timestampFields] - Fields to check for timestamp
 */
export function createTimeWindowCompactor(options = {}) {
  const {
    maxAge = 24 * 60 * 60 * 1000,
    timestampFields = ['timestamp', 'createdAt', 'at', 'time'],
  } = options

  return async (accumulated) => {
    const cutoff = Date.now() - maxAge
    return accumulated.filter((item) => {
      // Find timestamp in item
      for (const field of timestampFields) {
        if (item[field] !== undefined) {
          const ts = typeof item[field] === 'string' ? new Date(item[field]).getTime() : item[field]
          return ts > cutoff
        }
      }
      // No timestamp found - keep the entry
      return true
    })
  }
}

/**
 * Sliding window compactor - keeps only the N most recent entries.
 *
 * @param {object} [options]
 * @param {number} [options.maxEntries=100] - Maximum entries to keep
 */
export function createSlidingWindowCompactor(options = {}) {
  const { maxEntries = 100 } = options

  return async (accumulated) => {
    if (accumulated.length <= maxEntries) {
      return accumulated
    }
    return accumulated.slice(-maxEntries)
  }
}

/**
 * Composite compactor - chains multiple compactors together.
 *
 * @param {...function} compactors - Compactor functions to chain
 */
export function createCompositeCompactor(...compactors) {
  return async (accumulated, delta, context) => {
    let result = accumulated
    for (const compactor of compactors) {
      result = await compactor(result, delta, context)
    }
    return result
  }
}
