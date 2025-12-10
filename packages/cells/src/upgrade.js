import { createCellRoutes } from './cell.js'

/**
 * Install cells into a Bassline instance.
 * Uses bl._propagators for reactive updates if available.
 * Uses bl._plumber for resource removal notifications if available.
 *
 * Also sets up plumber rules to wire cell changes to propagators.
 *
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 * @param {object} [config] - Configuration options (unused)
 */
export default function installCells(bl, config = {}) {
  const cells = createCellRoutes({
    onCellChange: ({ uri }) => {
      bl._propagators?.onCellChange(uri)
    },
    onCellKill: ({ uri }) => {
      bl._plumber?.dispatch({
        uri,
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri }
      })
    }
  })

  cells.install(bl)
  bl._cells = cells

  // Wire up plumber: cell changes → propagators
  if (bl._plumber && bl._propagators) {
    bl._plumber.addRule('cell-to-propagators', {
      match: { headers: { type: 'bl:///types/cell-value', changed: true } },
      port: 'cell-changes'
    })

    bl._plumber.listen('cell-changes', (msg) => {
      // Extract cell URI from the message URI (remove /value suffix)
      const cellUri = msg.uri.replace(/\/value$/, '')
      bl._propagators.onCellChange(cellUri)
    })
  }
}
