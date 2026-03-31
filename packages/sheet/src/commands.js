import { SheetError } from './sheet.js'

/**
 * Create a command registry bound to a sheet.
 *
 * Commands have a rank that determines how they broadcast over regions:
 *   rank 0 (cell):   fn([r, c], sheet) — broadcasts over every cell coordinate
 *   rank 1 (row):    fn(row, rowIndex, sheet) — broadcasts over each row
 *   rank 2 (region): fn(rows, sheet) — receives the full 2D data
 *
 * Register with: register(name, { rank, fn }) or register(name, fn) for rank 2.
 * @param sheet
 */
export function createRegistry(sheet) {
  const handlers = {}

  function register(name, handlerOrDef) {
    if (typeof handlerOrDef === 'function') {
      handlers[name] = { rank: 2, fn: handlerOrDef }
    } else {
      handlers[name] = handlerOrDef
    }
  }

  function read(r0, c0, r1, c1) {
    const rows = []
    for (let r = r0; r <= r1; r++) {
      const row = []
      for (let c = c0; c <= c1; c++) row.push(sheet.get([r, c]))
      rows.push(row)
    }
    return rows
  }

  function readCoords(r0, c0, r1, c1) {
    const coords = []
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) coords.push([r, c])
    }
    return coords
  }

  /**
   * Execute a region as a command. First cell is the command name.
   * Data (with command name stripped) is passed as rank 2 regardless of handler rank.
   * This is the "typed command" path — the user explicitly structured the data.
   * @param r0
   * @param c0
   * @param r1
   * @param c1
   */
  function exec(r0, c0, r1, c1) {
    const rows = read(r0, c0, r1, c1)
    const cmd = String(rows[0][0])
    const def = handlers[cmd]
    if (!def) throw new SheetError(`unknown command: ${cmd}`)
    const args = [rows[0].slice(1), ...rows.slice(1)]
    return def.fn(args, sheet)
  }

  /**
   * Execute a named command against a region. All cells are data.
   * Broadcasting is determined by the handler's rank:
   *   rank 0 → call fn([r, c], sheet) for each coordinate in bounds
   *   rank 1 → call fn(row, rowIndex, sheet) for each row
   *   rank 2 → call fn(rows, sheet) with full 2D data
   * @param name
   * @param r0
   * @param c0
   * @param r1
   * @param c1
   */
  function execAs(name, r0, c0, r1, c1) {
    const def = handlers[name]
    if (!def) throw new SheetError(`unknown command: ${name}`)

    if (def.rank === 0) {
      const coords = readCoords(r0, c0, r1, c1)
      return coords.map(coord => def.fn(coord, sheet))
    }

    if (def.rank === 1) {
      const rows = read(r0, c0, r1, c1)
      return rows.map(row => def.fn(row, sheet))
    }

    const rows = read(r0, c0, r1, c1)
    return def.fn(rows, sheet)
  }

  function execSelection(name) {
    const sel = sheet.selection(name)
    if (!sel) throw new SheetError(`unknown selection: ${name}`)
    return exec(sel.r[0], sel.c[0], sel.r[1], sel.c[1])
  }

  function list() {
    return Object.keys(handlers)
  }

  function rankOf(name) {
    return handlers[name]?.rank
  }

  // --- Built-in commands ---

  register('clear', {
    rank: 0,
    fn: (coord, sheet) => sheet.clear(coord),
  })

  register('set', {
    rank: 1,
    fn: ([r, c, value], sheet) => {
      const rn = Number(r),
        cn = Number(c)
      if (!Number.isFinite(rn) || !Number.isFinite(cn)) {
        throw new SheetError(`set: invalid coordinates [${r}, ${c}] — expected numbers`)
      }
      sheet.set([rn, cn], value)
    },
  })

  register('link', {
    rank: 1,
    fn: ([r, c, vid], sheet) => {
      sheet.link([Number(r), Number(c)], String(vid))
    },
  })

  register('gc', (_, sheet) => sheet.gc())

  register('undo', (_, sheet) => sheet.undo())

  register('redo', (_, sheet) => sheet.redo())

  register('select', ([header, ...rows], sheet) => {
    const [name] = header
    const props = Object.fromEntries(rows.map(([k, v]) => [String(k), v]))
    const { r0, r1, c0, c1, ...meta } = props
    sheet.select(String(name), { r: [Number(r0), Number(r1)], c: [Number(c0), Number(c1)], ...meta })
  })

  register('exec', ([[name]], sheet) => {
    const sel = sheet.selection(String(name))
    if (!sel) throw new SheetError(`unknown selection: ${name}`)
    return exec(sel.r[0], sel.c[0], sel.r[1], sel.c[1])
  })

  register('batch', (rows, sheet) => {
    return rows.map(row => {
      const cmd = String(row[0])
      const def = handlers[cmd]
      if (def) return def.fn([row.slice(1)], sheet)
    })
  })

  return { register, exec, execAs, execSelection, read, list, rankOf }
}
