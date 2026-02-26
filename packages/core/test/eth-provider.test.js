import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope } from '../src/modules/index.js'

// Stub @bassline/fs so fuse.js can import without the Rust bridge
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

const { default: fuse } = await import('../src/platforms/fuse.js')
const { default: ethModule } = await import('../../eth/src/index.js')

const ADDR = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const HASH = '0x' + 'ab'.repeat(32)

function setup() {
  const p = new Platform()
  p.use(reducers, scope, fuse)
  ethModule(p)
  return p
}

describe('EthProvider via platform.fuse', () => {
  // --- root ---

  it('getattr / returns dir', () => {
    const p = setup()
    const stat = p.fuse.getattr('/')
    expect(stat.kind).toBe('dir')
  })

  it('readdir / lists top-level entries', () => {
    const p = setup()
    const names = p.fuse.readdir('/').map(e => e.name)
    expect(names).toContain('block-number')
    expect(names).toContain('chain-id')
    expect(names).toContain('gas-price')
    expect(names).toContain('blocks')
    expect(names).toContain('tx')
    expect(names).toContain('accounts')
  })

  // --- scalar files ---

  it('getattr on scalar files returns file stat', () => {
    const p = setup()
    for (const name of ['block-number', 'chain-id', 'gas-price']) {
      expect(p.fuse.getattr(`/${name}`).kind).toBe('file')
    }
  })

  // --- /blocks ---

  it('getattr /blocks returns dir', () => {
    const p = setup()
    expect(p.fuse.getattr('/blocks').kind).toBe('dir')
  })

  it('readdir /blocks contains ctl and latest', () => {
    const p = setup()
    const names = p.fuse.readdir('/blocks').map(e => e.name)
    expect(names).toContain('ctl')
    expect(names).toContain('latest')
  })

  it('getattr /blocks/latest returns dir', () => {
    const p = setup()
    expect(p.fuse.getattr('/blocks/latest').kind).toBe('dir')
  })

  it('readdir /blocks/latest lists all block entries', () => {
    const p = setup()
    const names = p.fuse.readdir('/blocks/latest').map(e => e.name)
    expect(names).toContain('.json')
    expect(names).toContain('hash')
    expect(names).toContain('parent-hash')
    expect(names).toContain('number')
    expect(names).toContain('timestamp')
    expect(names).toContain('miner')
    expect(names).toContain('gas-used')
    expect(names).toContain('gas-limit')
    expect(names).toContain('transactions')
    expect(names).toContain('withdrawals')
  })

  it('getattr /blocks/latest/.json returns file with 1MB size', () => {
    const p = setup()
    const stat = p.fuse.getattr('/blocks/latest/.json')
    expect(stat.kind).toBe('file')
    expect(stat.size).toBe(1048576)
  })

  it('getattr /blocks/latest/hash returns file', () => {
    const p = setup()
    expect(p.fuse.getattr('/blocks/latest/hash').kind).toBe('file')
  })

  it('getattr /blocks/latest/transactions returns dir', () => {
    const p = setup()
    expect(p.fuse.getattr('/blocks/latest/transactions').kind).toBe('dir')
  })

  it('readdir /blocks/latest/transactions lists count and .json', () => {
    const p = setup()
    const names = p.fuse.readdir('/blocks/latest/transactions').map(e => e.name)
    expect(names).toContain('count')
    expect(names).toContain('.json')
  })

  // --- /blocks/ctl creates new block dirs via open/write/release ---

  it('writing to blocks/ctl creates block files', async () => {
    const p = setup()
    // Before: dynamic lookup — 12345 is accessible via lookup
    expect(p.fuse.getattr('/blocks/12345').kind).toBe('dir')

    // Write to ctl to pre-populate the cache (so it shows in readdir)
    p.fuse.open('/blocks/ctl', 1)
    p.fuse.write('/blocks/ctl', Buffer.from('12345'), 0)
    await p.fuse.release('/blocks/ctl')

    // After: 12345 in cache, appears in readdir
    const names = p.fuse.readdir('/blocks').map(e => e.name)
    expect(names).toContain('12345')
    expect(p.fuse.getattr('/blocks/12345').kind).toBe('dir')
    expect(p.fuse.getattr('/blocks/12345/hash').kind).toBe('file')
  })

  // --- /tx ---

  it('getattr /tx returns dir', () => {
    const p = setup()
    expect(p.fuse.getattr('/tx').kind).toBe('dir')
  })

  it('readdir /tx contains ctl', () => {
    const p = setup()
    const names = p.fuse.readdir('/tx').map(e => e.name)
    expect(names).toContain('ctl')
  })

  it('writing to tx/ctl creates tx files', async () => {
    const p = setup()

    // With dynamic lookup, the hash is accessible immediately
    expect(p.fuse.getattr(`/tx/${HASH}`).kind).toBe('dir')

    // Write to ctl to populate cache
    p.fuse.open('/tx/ctl', 1)
    p.fuse.write('/tx/ctl', Buffer.from(HASH), 0)
    await p.fuse.release('/tx/ctl')

    const names = p.fuse.readdir(`/tx/${HASH}`).map(e => e.name)
    expect(names).toContain('.json')
    expect(names).toContain('from')
    expect(names).toContain('receipt')
  })

  it('tx/ctl creates receipt subtree', async () => {
    const p = setup()

    p.fuse.open('/tx/ctl', 1)
    p.fuse.write('/tx/ctl', Buffer.from(HASH), 0)
    await p.fuse.release('/tx/ctl')

    expect(p.fuse.getattr(`/tx/${HASH}/receipt`).kind).toBe('dir')
    const names = p.fuse.readdir(`/tx/${HASH}/receipt`).map(e => e.name)
    expect(names).toContain('.json')
    expect(names).toContain('status')
    expect(names).toContain('logs')
  })

  // --- /accounts ---

  it('getattr /accounts returns dir', () => {
    const p = setup()
    expect(p.fuse.getattr('/accounts').kind).toBe('dir')
  })

  it('writing to accounts/ctl creates account files', async () => {
    const p = setup()

    // With dynamic lookup, account is accessible immediately
    expect(p.fuse.getattr(`/accounts/${ADDR}`).kind).toBe('dir')

    // Write to ctl to populate cache
    p.fuse.open('/accounts/ctl', 1)
    p.fuse.write('/accounts/ctl', Buffer.from(ADDR), 0)
    await p.fuse.release('/accounts/ctl')

    const names = p.fuse.readdir(`/accounts/${ADDR}`).map(e => e.name)
    expect(names).toContain('balance')
    expect(names).toContain('nonce')
    expect(names).toContain('code')
  })

  // --- ENOENT ---

  it('getattr on invalid paths throws', () => {
    const p = setup()
    expect(() => p.fuse.getattr('/nope')).toThrow()
    // Non-block ref under /blocks — lookup returns null
    expect(() => p.fuse.getattr('/blocks/not-a-block-ref!')).toThrow()
  })

  // --- Dynamic lookup (new) ---

  it('blocks are accessible via lookup without ctl write', () => {
    const p = setup()
    // Block refs are resolved dynamically
    expect(p.fuse.getattr('/blocks/12345').kind).toBe('dir')
    expect(p.fuse.getattr('/blocks/earliest').kind).toBe('dir')
  })

  it('tx hashes are accessible via lookup without ctl write', () => {
    const p = setup()
    expect(p.fuse.getattr(`/tx/${HASH}`).kind).toBe('dir')
  })

  it('account addresses are accessible via lookup without ctl write', () => {
    const p = setup()
    expect(p.fuse.getattr(`/accounts/${ADDR}`).kind).toBe('dir')
  })
})
