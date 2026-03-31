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
 * Undo/redo supported via captured prev state on each mutation.
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
    /** @type {Array<object>} */
    this._undoStack = []
    /** @type {Array<object>} */
    this._redoStack = []
    /** @type {boolean} */
    this._recording = true
  }

  // --- Events ---

  on(fn) {
    this._listeners.push(fn)
    return () => {
      this._listeners = this._listeners.filter(f => f !== fn)
    }
  }

  _emit(msg) {
    for (const fn of this._listeners) fn(msg)
  }

  _record(entry) {
    if (!this._recording) return
    this._undoStack.push(entry)
    this._redoStack.length = 0
  }

  // --- Undo / Redo ---

  undo() {
    const entry = this._undoStack.pop()
    if (!entry) return null
    this._recording = false
    switch (entry.op) {
      case 'set':
        this.cells.delete(key(entry.r, entry.c))
        this.values.delete(entry.id)
        this._emit({ type: 'clear', r: entry.r, c: entry.c })
        break
      case 'update':
        this.values.set(entry.id, entry.prev)
        this._emit({ type: 'update', id: entry.id, value: entry.prev })
        break
      case 'clear':
        this.cells.set(key(entry.r, entry.c), entry.prevId)
        this._emit({ type: 'link', r: entry.r, c: entry.c, id: entry.prevId })
        break
      case 'link': {
        const k = key(entry.r, entry.c)
        if (entry.prevId != null) {
          this.cells.set(k, entry.prevId)
          this._emit({ type: 'link', r: entry.r, c: entry.c, id: entry.prevId })
        } else {
          this.cells.delete(k)
          this._emit({ type: 'clear', r: entry.r, c: entry.c })
        }
        break
      }
    }
    this._redoStack.push(entry)
    this._recording = true
    return entry
  }

  redo() {
    const entry = this._redoStack.pop()
    if (!entry) return null
    this._recording = false
    switch (entry.op) {
      case 'set':
        this.values.set(entry.id, entry.value)
        this.cells.set(key(entry.r, entry.c), entry.id)
        this._emit({ type: 'set', r: entry.r, c: entry.c, id: entry.id })
        break
      case 'update':
        this.values.set(entry.id, entry.value)
        this._emit({ type: 'update', id: entry.id, value: entry.value })
        break
      case 'clear':
        this.cells.delete(key(entry.r, entry.c))
        this._emit({ type: 'clear', r: entry.r, c: entry.c })
        break
      case 'link':
        this.cells.set(key(entry.r, entry.c), entry.id)
        this._emit({ type: 'link', r: entry.r, c: entry.c, id: entry.id })
        break
    }
    this._undoStack.push(entry)
    this._recording = true
    return entry
  }

  // --- Values ---

  put(value) {
    const vid = id()
    this.values.set(vid, value)
    return vid
  }

  resolve(vid) {
    return this.values.get(vid)
  }

  update(vid, value) {
    const prev = this.values.get(vid)
    this.values.set(vid, value)
    this._record({ op: 'update', id: vid, value, prev })
    this._emit({ type: 'update', id: vid, value })
  }

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

  get([r, c]) {
    const vid = this.cells.get(key(r, c))
    return vid != null ? this.values.get(vid) : undefined
  }

  ref([r, c]) {
    return this.cells.get(key(r, c))
  }

  set([r, c], value) {
    const k = key(r, c)
    const existing = this.cells.get(k)
    if (existing != null) {
      const prev = this.values.get(existing)
      this.values.set(existing, value)
      this._record({ op: 'update', id: existing, value, prev })
      this._emit({ type: 'update', id: existing, value })
      return existing
    }
    const vid = this.put(value)
    this.cells.set(k, vid)
    this._record({ op: 'set', r, c, id: vid, value })
    this._emit({ type: 'set', r, c, id: vid })
    return vid
  }

  link([r, c], vid) {
    const k = key(r, c)
    const prevId = this.cells.get(k) ?? null
    this.cells.set(k, vid)
    this._record({ op: 'link', r, c, id: vid, prevId })
    this._emit({ type: 'link', r, c, id: vid })
  }

  clear([r, c]) {
    const k = key(r, c)
    const prevId = this.cells.get(k)
    if (prevId == null) return
    this.cells.delete(k)
    this._record({ op: 'clear', r, c, prevId })
    this._emit({ type: 'clear', r, c })
  }

  // --- Selections ---

  select(name, region) {
    this.selections.set(name, region)
    this._emit({ type: 'select', name, region })
  }

  selection(name) {
    return this.selections.get(name)
  }

  // --- Iteration ---

  *range(r0, c0, r1, c1) {
    for (const [k, vid] of this.cells) {
      const { r, c } = parseKey(k)
      if (r >= r0 && r <= r1 && c >= c0 && c <= c1) {
        yield { r, c, id: vid, value: this.values.get(vid) }
      }
    }
  }

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
