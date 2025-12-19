import { resource, routes, bind } from './resource.js'

/**
 * Built-in lattices for cells
 */
export const lattices = {
  maxNumber: {
    initial: -Infinity,
    merge: (a, b) => Math.max(a ?? -Infinity, b ?? -Infinity)
  },
  minNumber: {
    initial: Infinity,
    merge: (a, b) => Math.min(a ?? Infinity, b ?? Infinity)
  },
  setUnion: {
    initial: [],
    merge: (a, b) => [...new Set([...(a ?? []), ...(b ?? [])])]
  },
  counter: {
    initial: 0,
    merge: (a, b) => (a ?? 0) + (b ?? 0)
  },
  lww: {
    initial: { value: null, timestamp: 0 },
    merge: (a, b) => {
      const ta = a?.timestamp ?? 0
      const tb = b?.timestamp ?? Date.now()
      return tb >= ta ? { value: b?.value ?? b, timestamp: tb } : a
    }
  },
  boolean: {
    initial: false,
    merge: (a, b) => a || b
  },
  object: {
    initial: {},
    merge: (a, b) => ({ ...(a ?? {}), ...(b ?? {}) })
  }
}

/**
 * Create a cells resource for lattice-based state
 *
 * Routes:
 *   GET  /            → bassline describing cells
 *   GET  /:name       → get cell config and value
 *   PUT  /:name       → create cell { lattice: 'maxNumber' }
 *   GET  /:name/value → get cell value
 *   PUT  /:name/value → merge value into cell, notify via kit /changed
 */
export const createCells = () => {
  const cells = new Map()

  const cellResource = resource({
    get: async (h) => {
      const cell = cells.get(h.params.name)
      if (!cell) return { headers: { status: 404 }, body: null }
      return { headers: { type: '/types/cell' }, body: cell }
    },
    put: async (h, body) => {
      const lattice = lattices[body.lattice]
      if (!lattice) return { headers: { status: 400 }, body: { error: `Unknown lattice: ${body.lattice}` } }
      cells.set(h.params.name, { lattice: body.lattice, value: lattice.initial })
      return { headers: {}, body: { lattice: body.lattice, value: lattice.initial } }
    }
  })

  const valueResource = resource({
    get: async (h) => {
      const cell = cells.get(h.params.name)
      if (!cell) return { headers: { status: 404 }, body: null }
      return { headers: { type: '/types/cell-value' }, body: cell.value }
    },
    put: async (h, body) => {
      const cell = cells.get(h.params.name)
      if (!cell) return { headers: { status: 404 }, body: null }

      const lattice = lattices[cell.lattice]
      const oldValue = cell.value
      cell.value = lattice.merge(cell.value, body)
      const changed = cell.value !== oldValue

      // Notify via kit (semantic: "I changed")
      if (changed && h.kit) {
        await h.kit.put({ path: '/changed' }, { value: cell.value })
      }

      return { headers: { changed }, body: cell.value }
    }
  })

  return routes({
    '': resource({
      get: async () => ({
        headers: { type: '/types/bassline' },
        body: {
          name: 'cells',
          description: 'Lattice-based state accumulation',
          lattices: Object.keys(lattices),
          resources: Object.fromEntries([...cells.keys()].map(k => [`/${k}`, {}]))
        }
      })
    }),
    unknown: bind('name', routes({
      '': cellResource,
      value: valueResource
    }))
  })
}

export default createCells
