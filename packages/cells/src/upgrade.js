import { createCellRoutes } from './cell.js'
import { createFuzzyCellRoutes } from './fuzzy-routes.js'

/**
 * Install cells into a Bassline instance.
 * Uses bl._propagators for reactive updates if available.
 * Uses plumber for resource removal notifications and cell→propagator wiring.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default async function installCells(bl) {
  const cells = createCellRoutes({
    onCellChange: ({ uri }) => {
      bl._propagators?.onCellChange(uri)
    },
    onCellKill: ({ uri }) => {
      bl.put(
        'bl:///plumb/send',
        { source: uri, port: 'resource-removed' },
        { headers: { type: 'bl:///types/resource-removed' }, body: { uri } }
      )
    },
    onContradiction: ({ uri, cell, previousValue, incomingValue, result }) => {
      bl.put(
        'bl:///plumb/send',
        { source: uri, port: 'contradictions' },
        {
          headers: { type: 'bl:///types/contradiction' },
          body: { uri, lattice: cell.lattice, previousValue, incomingValue, result },
        }
      )
    },
  })

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
