import { describe, it, expect } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope } from '../src/modules/index.js'

// Stub @bassline/fs so fuse.js can import without the Rust bridge
import { vi } from 'vitest'
vi.mock('@bassline/fs', () => ({
  Fuse: class Fuse {
    constructor() {}
    async mount() {}
  },
  FileSystem: class FileSystem {
    constructor() {}
  },
  FuseError: class FuseError extends Error {
    constructor(code) {
      super(`FUSE error (${code})`)
      this.code = code
    }
  },
  errno: { EPERM: -1, ENOENT: -2, EIO: -5, EACCES: -13, ENOTDIR: -20, EISDIR: -21, ENOSYS: -38 },
}))

// Re-import after mock
const { default: fuse } = await import('../src/platforms/fuse.js')

function setup() {
  const p = new Platform()
  p.use(reducers, scope, fuse)

  // Build a small test tree
  const counter = p.create.Slot({ value: 0, reduce: Math.max })
  const title = p.create.Slot({ value: 'untitled' })
  p.root({ put: { cells: { counter, title } } })

  // Compute-on-read resource (read-only)
  const R = p.classes.Resource
  const r = new R()
  r.get = () => ({ ok: true, uptime: 123 })
  const health = p.resource(r)
  p.root({ put: health, at: '_health' })

  // Object-valued slot
  const config = p.create.Slot({ value: { theme: 'dark', version: 1 } })
  p.root({ put: config, at: 'config' })

  return p
}

describe('FUSE platform — directory detection', () => {
  it('getattr / returns dir', () => {
    const p = setup()
    expect(p.fuse.getattr('/').kind).toBe('dir')
  })

  it('getattr /cells returns dir', () => {
    const p = setup()
    expect(p.fuse.getattr('/cells').kind).toBe('dir')
  })
})

describe('FUSE platform — file detection + permissions', () => {
  it('getattr on Slot returns file (writable, no mode override)', () => {
    const p = setup()
    const stat = p.fuse.getattr('/cells/counter')
    expect(stat.kind).toBe('file')
    expect(stat.mode).toBeUndefined()
  })

  it('getattr on compute-on-read returns file with 0o100444', () => {
    const p = setup()
    const stat = p.fuse.getattr('/_health')
    expect(stat.kind).toBe('file')
    expect(stat.mode).toBe(0o100444)
  })

  it('getattr default size is 4096', () => {
    const p = setup()
    expect(p.fuse.getattr('/cells/counter').size).toBe(4096)
  })

  it('getattr respects size metadata from parent scope', () => {
    const p = new Platform()
    p.use(reducers, scope, fuse)

    const R = p.classes.Resource
    const r = new R()
    r.get = () => '{"big": true}'
    const bigFile = p.resource(r)
    p.root({ put: bigFile, at: 'big', meta: { size: 1048576 } })

    expect(p.fuse.getattr('/big').size).toBe(1048576)
  })
})

describe('FUSE platform — readdir', () => {
  it('readdir / lists all root entries', () => {
    const p = setup()
    const names = p.fuse.readdir('/').map(e => e.name)
    expect(names).toContain('cells')
    expect(names).toContain('_health')
    expect(names).toContain('config')
  })

  it('readdir / marks scopes as dir and files as file', () => {
    const p = setup()
    const entries = p.fuse.readdir('/')
    const cells = entries.find(e => e.name === 'cells')
    const health = entries.find(e => e.name === '_health')
    expect(cells.kind).toBe('dir')
    expect(health.kind).toBe('file')
  })

  it('readdir /cells lists counter and title', () => {
    const p = setup()
    const names = p.fuse.readdir('/cells').map(e => e.name)
    expect(names).toEqual(expect.arrayContaining(['counter', 'title']))
  })

  it('readdir on a file throws ENOTDIR', () => {
    const p = setup()
    expect(() => p.fuse.readdir('/cells/counter')).toThrow()
  })

  it('readdir on missing path throws', () => {
    const p = setup()
    expect(() => p.fuse.readdir('/missing')).toThrow()
  })
})

describe('FUSE platform — read', () => {
  it('read numeric value', async () => {
    const p = setup()
    const buf = await p.fuse.read('/cells/counter', 0, 4096)
    expect(buf.toString()).toBe('0\n')
  })

  it('read string value', async () => {
    const p = setup()
    const buf = await p.fuse.read('/cells/title', 0, 4096)
    expect(buf.toString()).toBe('untitled\n')
  })

  it('read object value returns JSON', async () => {
    const p = setup()
    const buf = await p.fuse.read('/config', 0, 4096)
    const parsed = JSON.parse(buf.toString().trim())
    expect(parsed).toEqual({ theme: 'dark', version: 1 })
  })

  it('read compute-on-read resource', async () => {
    const p = setup()
    const buf = await p.fuse.read('/_health', 0, 4096)
    const parsed = JSON.parse(buf.toString().trim())
    expect(parsed).toEqual({ ok: true, uptime: 123 })
  })

  it('read null value returns just newline', async () => {
    const p = new Platform()
    p.use(reducers, scope, fuse)
    const slot = p.create.Slot({ value: null })
    p.root({ put: slot, at: 'nil' })
    const buf = await p.fuse.read('/nil', 0, 4096)
    expect(buf.toString()).toBe('\n')
  })

  it('read with offset/size slicing', async () => {
    const p = setup()
    // 'untitled\n' = 9 bytes
    const buf = await p.fuse.read('/cells/title', 2, 4)
    expect(buf.toString()).toBe('titl')
  })

  it('read async resource (Promise-returning get)', async () => {
    const p = new Platform()
    p.use(reducers, scope, fuse)

    const R = p.classes.Resource
    const r = new R()
    r.get = async () => {
      await new Promise(res => setTimeout(res, 5))
      return 'async-value'
    }
    p.root({ put: p.resource(r), at: 'async' })

    const buf = await p.fuse.read('/async', 0, 4096)
    expect(buf.toString()).toBe('async-value\n')
  })
})

describe('FUSE platform — write + release cycle', () => {
  it('write to a Slot updates its value', async () => {
    const p = setup()
    const counter = p.root({ walk: 'cells/counter' })

    p.fuse.open('/cells/counter', 1) // O_WRONLY
    p.fuse.write('/cells/counter', Buffer.from('42\n'), 0)
    await p.fuse.release('/cells/counter')

    expect(counter({})).toBe(42)
  })

  it('reducer still applies: max of 3 when already 42', async () => {
    const p = setup()
    const counter = p.root({ walk: 'cells/counter' })

    // First write: set to 42
    p.fuse.open('/cells/counter', 1)
    p.fuse.write('/cells/counter', Buffer.from('42\n'), 0)
    await p.fuse.release('/cells/counter')
    expect(counter({})).toBe(42)

    // Second write: 3 < 42, max wins
    p.fuse.open('/cells/counter', 1)
    p.fuse.write('/cells/counter', Buffer.from('3\n'), 0)
    await p.fuse.release('/cells/counter')
    expect(counter({})).toBe(42)
  })

  it('write to read-only resource throws on release', async () => {
    const p = setup()
    p.fuse.open('/_health', 1)
    p.fuse.write('/_health', Buffer.from('bad\n'), 0)
    await expect(p.fuse.release('/_health')).rejects.toThrow()
  })

  it('truncate before open (macOS echo > pattern)', async () => {
    const p = setup()
    const title = p.root({ walk: 'cells/title' })

    p.fuse.truncate('/cells/title', 0)
    p.fuse.open('/cells/title', 1)
    p.fuse.write('/cells/title', Buffer.from('new-title\n'), 0)
    await p.fuse.release('/cells/title')

    expect(title({})).toBe('new-title')
  })

  it('write JSON object to Slot', async () => {
    const p = setup()

    p.fuse.open('/config', 1)
    p.fuse.write('/config', Buffer.from('{"theme":"light","version":2}\n'), 0)
    await p.fuse.release('/config')

    const val = p.root({ at: 'config' })({})
    expect(val).toEqual({ theme: 'light', version: 2 })
  })
})

describe('FUSE platform — error cases', () => {
  it('getattr on nonexistent path throws', () => {
    const p = setup()
    expect(() => p.fuse.getattr('/nonexistent')).toThrow()
  })

  it('walk through non-Scope throws', () => {
    const p = setup()
    expect(() => p.fuse.getattr('/cells/counter/child')).toThrow()
  })

  it('getattr /nonexistent/deep throws', () => {
    const p = setup()
    expect(() => p.fuse.getattr('/nonexistent/deep')).toThrow()
  })

  it('read on missing path rejects', async () => {
    const p = setup()
    await expect(p.fuse.read('/nope', 0, 4096)).rejects.toThrow()
  })
})

describe('FUSE platform — dynamic Scope (lookup)', () => {
  it('lookup provides on-demand children', () => {
    const p = new Platform()
    p.use(reducers, scope, fuse)

    const dynamicScope = p.create.Scope({
      lookup(name) {
        if (name.startsWith('item-')) {
          return p.create.Slot({ value: { id: name } })
        }
      },
      list: () => ['item-cached'],
    })
    p.root({ put: dynamicScope, at: 'items' })

    // Dynamic lookup — item-123 not in list but accessible
    expect(p.fuse.getattr('/items/item-123').kind).toBe('file')
  })

  it('readdir includes both static and list() entries', () => {
    const p = new Platform()
    p.use(reducers, scope, fuse)

    const ctl = p.create.Slot({ value: null })
    const dynamicScope = p.create.Scope({
      lookup(name) {
        if (name !== 'ctl') return p.create.Slot({ value: name })
      },
      list: () => ['dynamic-a', 'dynamic-b'],
    })
    dynamicScope({ put: ctl, at: 'ctl' })
    p.root({ put: dynamicScope, at: 'dyn' })

    const names = p.fuse.readdir('/dyn').map(e => e.name)
    expect(names).toContain('ctl')
    expect(names).toContain('dynamic-a')
    expect(names).toContain('dynamic-b')
  })

  it('nested dynamic scopes work with getattr', () => {
    const p = new Platform()
    p.use(reducers, scope, fuse)

    const inner = p.create.Scope({
      entries: { value: p.create.Slot({ value: 42 }) },
    })
    const outer = p.create.Scope({
      lookup(name) {
        if (name === 'found') return inner
      },
    })
    p.root({ put: outer, at: 'outer' })

    expect(p.fuse.getattr('/outer/found').kind).toBe('dir')
    expect(p.fuse.getattr('/outer/found/value').kind).toBe('file')
  })
})

describe('FUSE platform — serialize/deserialize', () => {
  it('boolean value serializes correctly', async () => {
    const p = new Platform()
    p.use(reducers, scope, fuse)
    const slot = p.create.Slot({ value: true })
    p.root({ put: slot, at: 'flag' })

    const buf = await p.fuse.read('/flag', 0, 4096)
    expect(buf.toString()).toBe('true\n')
  })

  it('number deserializes from write', async () => {
    const p = new Platform()
    p.use(reducers, scope, fuse)
    const slot = p.create.Slot({ value: 0 })
    p.root({ put: slot, at: 'num' })

    p.fuse.open('/num', 1)
    p.fuse.write('/num', Buffer.from('99\n'), 0)
    await p.fuse.release('/num')

    expect(slot._resource.value).toBe(99)
  })
})
