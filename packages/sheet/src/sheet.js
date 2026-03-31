let _id = 0
const id = () => (++_id).toString(36) + Math.random().toString(36).slice(2, 6)
function key(r, c) {
  if (!Number.isFinite(r) || !Number.isFinite(c)) throw new SheetError(`invalid coordinates: [${r}, ${c}]`)
  return `${r},${c}`
}
const parseKey = k => {
  const [r, c] = k.split(',').map(Number)
  return { r, c }
}

export class SheetError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'SheetError'
  }
}

/**
 * A sparse 2D coordinate plane with pointer-based values.
 *
 * Values live in a flat store keyed by short random IDs.
 * Cells map [row, col] coordinates to value IDs.
 * Multiple cells can point to the same value (shared variables).
 * Selections name regions of the coordinate space with metadata.
 * All mutations emit messages to registered listeners.
 */
export class Sheet {
  constructor() {
    /** @type {Map<string, string|number>} */
    this.values = new Map()
    /** @type {Map<string, string>} "r,c" → valueId */
    this.cells = new Map()
    /** @type {Map<string, object>} name → region + meta */
    this.selections = new Map()
    /** @type {Array<Function>} */
    this._listeners = []
  }

  // --- Events ---

  /**
   * Register a change listener. Returns unsubscribe function.
   * @param fn
   */
  on(fn) {
    this._listeners.push(fn)
    return () => {
      this._listeners = this._listeners.filter(f => f !== fn)
    }
  }

  /**
   * @param msg
   * @private
   */
  _emit(msg) {
    for (const fn of this._listeners) fn(msg)
  }

  // --- Values ---

  /**
   * Store a value, return its ID.
   * @param value
   */
  put(value) {
    const vid = id()
    this.values.set(vid, value)
    return vid
  }

  /**
   * Look up a value by ID.
   * @param vid
   */
  resolve(vid) {
    return this.values.get(vid)
  }

  /**
   * Update a value in-place. All cells pointing to it reflect the change.
   * @param vid
   * @param value
   */
  update(vid, value) {
    this.values.set(vid, value)
    this._emit({ type: 'update', id: vid, value })
  }

  /** Remove values not referenced by any cell. Returns collected IDs. */
  gc() {
    const referenced = new Set(this.cells.values())
    const collected = []
    for (const vid of this.values.keys()) {
      if (!referenced.has(vid)) {
        collected.push({ id: vid, value: this.values.get(vid) })
        this.values.delete(vid)
      }
    }
    if (collected.length > 0) {
      this._emit({ type: 'gc', collected })
    }
    return collected
  }

  // --- Cells ---

  /**
   * Resolve a cell to its value.
   * @param root0
   * @param root0."0"
   * @param root0."1"
   */
  get([r, c]) {
    const vid = this.cells.get(key(r, c))
    return vid != null ? this.values.get(vid) : undefined
  }

  /**
   * Get the value ID (pointer) for a cell.
   * @param root0
   * @param root0."0"
   * @param root0."1"
   */
  ref([r, c]) {
    return this.cells.get(key(r, c))
  }

  /**
   * Set a cell's value. Reuses existing value ID if cell already has one.
   * @param root0
   * @param root0."0"
   * @param root0."1"
   * @param value
   */
  set([r, c], value) {
    const k = key(r, c)
    const existing = this.cells.get(k)
    if (existing != null) {
      this.values.set(existing, value)
      this._emit({ type: 'update', id: existing, value })
      return existing
    }
    const vid = this.put(value)
    this.cells.set(k, vid)
    this._emit({ type: 'set', r, c, id: vid })
    return vid
  }

  /**
   * Point a cell to an existing value ID.
   * @param root0
   * @param root0."0"
   * @param root0."1"
   * @param vid
   */
  link([r, c], vid) {
    this.cells.set(key(r, c), vid)
    this._emit({ type: 'link', r, c, id: vid })
  }

  /**
   * Remove a cell entry.
   * @param root0
   * @param root0."0"
   * @param root0."1"
   */
  clear([r, c]) {
    this.cells.delete(key(r, c))
    this._emit({ type: 'clear', r, c })
  }

  // --- Selections ---

  /**
   * Name a region with optional metadata.
   * @param name
   * @param region
   */
  select(name, region) {
    this.selections.set(name, region)
    this._emit({ type: 'select', name, region })
  }

  /**
   * Get a named selection.
   * @param name
   */
  selection(name) {
    return this.selections.get(name)
  }

  // --- Iteration ---

  /**
   * Yield occupied cells in a rectangular region.
   * @param r0
   * @param c0
   * @param r1
   * @param c1
   */
  *range(r0, c0, r1, c1) {
    for (const [k, vid] of this.cells) {
      const { r, c } = parseKey(k)
      if (r >= r0 && r <= r1 && c >= c0 && c <= c1) {
        yield { r, c, id: vid, value: this.values.get(vid) }
      }
    }
  }

  /** Yield all occupied cells. */
  *entries() {
    for (const [k, vid] of this.cells) {
      const { r, c } = parseKey(k)
      yield { r, c, id: vid, value: this.values.get(vid) }
    }
  }

  // --- Serialization ---

  toJSON() {
    return {
      values: Object.fromEntries(this.values),
      cells: [...this.cells.entries()].map(([k, vid]) => {
        const { r, c } = parseKey(k)
        return [r, c, vid]
      }),
      selections: Object.fromEntries(this.selections),
    }
  }

  static fromJSON(json) {
    const obj = typeof json === 'string' ? JSON.parse(json) : json
    const sheet = new Sheet()
    for (const [vid, value] of Object.entries(obj.values)) {
      sheet.values.set(vid, value)
    }
    for (const [r, c, vid] of obj.cells) {
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue
      sheet.cells.set(key(r, c), vid)
    }
    if (obj.selections) {
      for (const [name, region] of Object.entries(obj.selections)) {
        sheet.selections.set(name, region)
      }
    }
    return sheet
  }
}
