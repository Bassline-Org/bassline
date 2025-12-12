import { createCellRoutes } from './cell.js'
import { createFuzzyCellRoutes } from './fuzzy-routes.js'

/**
 * Install cells into a Bassline instance.
 * Uses plumber for notifications (cell changes, removals, contradictions).
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default async function installCells(bl) {
  const cells = createCellRoutes({ bl })

  cells.install(bl)
  bl._cells = cells

  // Wire up plumber: cell changes → propagators via /on-cell-change route
  if (bl._propagators) {
    await bl.put(
      'bl:///plumb/rules/cell-to-propagators',
      {},
      {
        match: { type: 'bl:///types/cell-value' },
        to: 'bl:///propagators/on-cell-change',
      }
    )
  }

  // Install fuzzy cells (requires bl for compactor access to Claude)
  const fuzzyCells = createFuzzyCellRoutes({ bl })
  fuzzyCells.install(bl)
  bl._fuzzyCells = fuzzyCells
}
