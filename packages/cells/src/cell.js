import { resource } from '@bassline/core'
import { getLattice, lattices } from './lattices.js'

/**
 * Create cell routes for lattice-based CRDT cells.
 *
 * Cells are ACI (associative, commutative, idempotent) so:
 * - Values only move "up" in the lattice
 * - Order/timing of operations doesn't matter
 * - PUT to /value merges using lattice join
 *
 * Resource structure:
 * - GET  /cells/:name       → directory of cell sub-resources
 * - PUT  /cells/:name       → create/configure cell (lattice, label)
 * - GET  /cells/:name/value → current value
 * - PUT  /cells/:name/value → merge value (lattice join)
 * - PUT  /cells/:name/reset → reset to bottom
 * @param {object} [options] - Configuration options
 * @param {Function} [options.onCellChange] - Callback when a cell value changes
 * @returns {object} Cell routes and store
 */
export function createCellRoutes(options = {}) {
  const { onCellChange, onCellKill, onContradiction } = options

  /** @type {Map<string, {lattice: string, value: any, label?: string}>} */
  const store = new Map()

  /**
   * Get a cell by name
   * @param {string} name
   * @returns {object|null}
   */
  function getCell(name) {
    return store.get(name) || null
  }

  /**
   * Create or configure a cell (without merging value)
   * @param {string} name - Cell name
   * @param {object} config - Cell config (lattice, label)
   * @returns {object} The cell
   */
  function createCell(name, config) {
    const existing = store.get(name)
    const latticeName = config.lattice || existing?.lattice || 'maxNumber'
    const lattice = getLattice(latticeName)

    if (!lattice) {
      throw new Error(`Unknown lattice: ${latticeName}`)
    }

    const cell = {
      lattice: latticeName,
      value: existing?.value ?? lattice.bottom(),
      label: config.label || existing?.label || name,
    }

    store.set(name, cell)
    return cell
  }

  /**
   * Merge a value into a cell using lattice join
   * @param {string} name - Cell name
   * @param {any} newValue - Value to merge
   * @returns {{changed: boolean, cell: object}}
   */
  function mergeValue(name, newValue) {
    let cell = store.get(name)

    // Auto-create cell with default lattice if it doesn't exist
    if (!cell) {
      cell = createCell(name, {})
    }

    const lattice = getLattice(cell.lattice)
    const oldValue = cell.value

    // For LWW lattice, auto-wrap raw values with current timestamp
    let valueToMerge = newValue
    if (cell.lattice === 'lww' && typeof newValue?.timestamp !== 'number') {
      valueToMerge = { value: newValue, timestamp: Date.now() }
    }

    const joinedValue = lattice.join(oldValue, valueToMerge)

    // Check if value actually moved up
    const changed = !lattice.lte(joinedValue, oldValue)

    // Detect contradiction for setIntersection lattice
    // Contradiction: join produces empty set from two non-empty, non-null sets
    if (cell.lattice === 'setIntersection' && onContradiction) {
      const isContradiction =
        Array.isArray(joinedValue) &&
        joinedValue.length === 0 &&
        Array.isArray(oldValue) &&
        oldValue.length > 0 &&
        Array.isArray(valueToMerge) &&
        valueToMerge.length > 0
      if (isContradiction) {
        onContradiction({
          uri: `bl:///cells/${name}`,
          cell,
          previousValue: oldValue,
          incomingValue: valueToMerge,
          result: joinedValue,
        })
      }
    }

    if (changed) {
      cell.value = joinedValue
    }

    return { changed, cell }
  }

  /**
   * Reset a cell to bottom
   * @param {string} name - Cell name
   * @returns {object|null} The reset cell
   */
  function resetCell(name) {
    const cell = store.get(name)
    if (cell) {
      const lattice = getLattice(cell.lattice)
      cell.value = lattice.bottom()
    }
    return cell
  }

  /**
   * Kill (remove) a cell
   * @param {string} name - Cell name
   * @returns {boolean} Whether the cell existed and was removed
   */
  function killCell(name) {
    const existed = store.has(name)
    if (existed) {
      store.delete(name)
      if (onCellKill) {
        onCellKill({ uri: `bl:///cells/${name}` })
      }
    }
    return existed
  }

  /**
   * List all cells
   * @returns {string[]}
   */
  function listCells() {
    return [...store.keys()]
  }

  const cellResource = resource((r) => {
    // List all cells
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listCells().map((name) => ({
          name,
          type: 'cell',
          uri: `bl:///cells/${name}`,
        })),
      },
    }))

    // Get cell as a directory of sub-resources
    r.get('/:name', ({ params }) => {
      const cell = getCell(params.name)
      if (!cell) return null

      return {
        headers: { type: 'bl:///types/cell' },
        body: {
          lattice: cell.lattice,
          label: cell.label,
          entries: [
            { name: 'value', uri: `bl:///cells/${params.name}/value` },
            { name: 'reset', uri: `bl:///cells/${params.name}/reset` },
          ],
        },
      }
    })

    // Create/configure a cell
    r.put('/:name', ({ params, body }) => {
      const cell = createCell(params.name, body)

      return {
        headers: { type: 'bl:///types/cell' },
        body: {
          lattice: cell.lattice,
          label: cell.label,
          entries: [
            { name: 'value', uri: `bl:///cells/${params.name}/value` },
            { name: 'reset', uri: `bl:///cells/${params.name}/reset` },
          ],
        },
      }
    })

    // Get the current value
    r.get('/:name/value', ({ params }) => {
      const cell = getCell(params.name)
      if (!cell) return null

      return {
        headers: { type: 'bl:///types/cell-value' },
        body: cell.value,
      }
    })

    // Merge a value (lattice join)
    r.put('/:name/value', async ({ params, body }) => {
      const { changed, cell } = mergeValue(params.name, body)

      // Notify on change (for propagator integration)
      // Await callback to support propagation chains
      if (changed && onCellChange) {
        await onCellChange({
          uri: `bl:///cells/${params.name}`,
          cell,
        })
      }

      return {
        headers: {
          type: 'bl:///types/cell-value',
          changed,
        },
        body: cell.value,
      }
    })

    // Reset a cell to bottom
    r.put('/:name/reset', ({ params }) => {
      const cell = resetCell(params.name)

      if (cell && onCellChange) {
        onCellChange({
          uri: `bl:///cells/${params.name}`,
          cell,
        })
      }

      return {
        headers: { type: 'bl:///types/cell-value' },
        body: cell?.value ?? null,
      }
    })

    // Kill (remove) a cell
    r.put('/:name/kill', ({ params }) => {
      const existed = killCell(params.name)
      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri: `bl:///cells/${params.name}` },
      }
    })
  })

  /**
   * Install cell routes into a Bassline instance
   * @param {import('@bassline/core').Bassline} bl
   * @param {object} [options] - Options
   * @param {string} [options.prefix] - Mount prefix
   */
  function install(bl, { prefix = '/cells' } = {}) {
    bl.mount(prefix, cellResource)
  }

  return {
    routes: cellResource,
    install,
    getCell,
    createCell,
    mergeValue,
    resetCell,
    killCell,
    listCells,
    lattices,
    _store: store,
  }
}
