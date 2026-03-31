import { SheetError } from './sheet.js'

/**
 * Create a command registry bound to a sheet.
 * Commands are rectangular regions of cells: first cell names the command,
 * remaining cells are arguments. Handler destructuring mirrors cell layout.
 * @param sheet
 */
export function createRegistry(sheet) {
  const handlers = {}

  /**
   * Register a command handler.
   * @param name
   * @param fn
   */
  function register(name, fn) {
    handlers[name] = fn
  }

  /**
   * Read a rectangular region as a 2D array of cell values.
   * @param r0
   * @param c0
   * @param r1
   * @param c1
   */
  function read(r0, c0, r1, c1) {
    const rows = []
    for (let r = r0; r <= r1; r++) {
      const row = []
      for (let c = c0; c <= c1; c++) row.push(sheet.get([r, c]))
      rows.push(row)
    }
    return rows
  }

  /**
   * Execute a region as a command.
   * @param r0
   * @param c0
   * @param r1
   * @param c1
   */
  function exec(r0, c0, r1, c1) {
    const rows = read(r0, c0, r1, c1)
    const cmd = String(rows[0][0])
    const handler = handlers[cmd]
    if (!handler) throw new SheetError(`unknown command: ${cmd}`)
    return handler(rows, sheet)
  }

  /**
   * Execute a named selection as a command.
   * @param name
   */
  function execSelection(name) {
    const sel = sheet.selection(name)
    if (!sel) throw new SheetError(`unknown selection: ${name}`)
    return exec(sel.r[0], sel.c[0], sel.r[1], sel.c[1])
  }

  // --- Built-in commands ---

  register('set', ([[_, r, c, value]]) => {
    const rn = Number(r),
      cn = Number(c)
    if (!Number.isFinite(rn) || !Number.isFinite(cn)) {
      throw new SheetError(`set: invalid coordinates [${r}, ${c}] — expected numbers`)
    }
    sheet.set([rn, cn], value)
  })

  register('link', ([[_, r, c, vid]]) => {
    sheet.link([Number(r), Number(c)], String(vid))
  })

  register('clear', ([[_, r, c]]) => {
    sheet.clear([Number(r), Number(c)])
  })

  register('gc', () => sheet.gc())

  register('select', ([header, ...rows]) => {
    const [_, name] = header
    const props = Object.fromEntries(rows.map(([k, v]) => [String(k), v]))
    const { r0, r1, c0, c1, ...meta } = props
    sheet.select(String(name), { r: [Number(r0), Number(r1)], c: [Number(c0), Number(c1)], ...meta })
  })

  register('exec', ([[_, name]]) => execSelection(String(name)))

  register('batch', ([_, ...rows]) => {
    return rows.map(row => {
      const cmd = String(row[0])
      const handler = handlers[cmd]
      if (handler) return handler(row, sheet)
    })
  })

  return { register, exec, execSelection, read }
}
