import { createCellRoutes } from './cell.js'
import { createFuzzyCellRoutes } from './fuzzy-routes.js'

/**
 * Install cells into a Bassline instance.
 * Uses plumber for notifications (cell changes, removals, contradictions).
 * Propagators now create their own plumber rules for inputs they watch.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default async function installCells(bl) {
  const cells = createCellRoutes({ bl })

  cells.install(bl)
  bl.setModule('cells', cells)

  // Install fuzzy cells (requires bl for compactor access to Claude)
  const fuzzyCells = createFuzzyCellRoutes({ bl })
  fuzzyCells.install(bl)
  bl.setModule('fuzzyCells', fuzzyCells)
}
