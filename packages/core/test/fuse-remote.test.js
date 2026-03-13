import { describe, it, expect } from 'vitest'
import { Platform } from '../src/kernel/platform.js'
import { reducers, scope } from '../src/resources/index.js'
import link, { memoryTransport } from '../src/link/runtime.js'
import fuseRemote from '../src/platforms/fuse-remote.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope, link, fuseRemote)
  return p
}

function setupWithTree() {
  const p = setup()
  const root = p.create.Scope()
  root({
    put: {
      cells: {
        counter: p.create.Slot({ value: 42 }),
        title: p.create.Slot({ value: 'hello' }),
      },
      config: {
        debug: p.create.Slot({ value: false }),
      },
    },
  })
  return { p, root }
}

describe('FUSE Remote Projection', () => {
  describe('local scope (no transport)', () => {
    it('getattr returns dir for scope', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)
      const attr = await fs.getattr('/')
      expect(attr.kind).toBe('dir')
    })

    it('getattr returns file for slot', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)
      const attr = await fs.getattr('/cells/counter')
      expect(attr.kind).toBe('file')
    })

    it('getattr throws for nonexistent path', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)
      await expect(fs.getattr('/nonexistent')).rejects.toThrow()
    })

    it('readdir lists children', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)
      const entries = await fs.readdir('/')
      const names = entries.map(e => e.name).sort()
      expect(names).toEqual(['cells', 'config'])
      expect(entries.find(e => e.name === 'cells').kind).toBe('dir')
    })

    it('readdir lists nested scope', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)
      const entries = await fs.readdir('/cells')
      const names = entries.map(e => e.name).sort()
      expect(names).toEqual(['counter', 'title'])
    })

    it('read returns serialized value', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)
      const buf = await fs.read('/cells/counter', 0, 4096)
      expect(buf.toString()).toBe('42\n')
    })

    it('read returns string value', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)
      const buf = await fs.read('/cells/title', 0, 4096)
      expect(buf.toString()).toBe('hello\n')
    })

    it('write + release writes through to slot', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)

      fs.open('/cells/counter', 1) // O_WRONLY
      fs.write('/cells/counter', Buffer.from('99'), 0)
      await fs.release('/cells/counter')

      const counter = root({ walk: 'cells/counter' })
      expect(counter({})).toBe(99)
    })

    it('truncate resets write buffer', async () => {
      const { p, root } = setupWithTree()
      const fs = p.fuseRemote.createFileSystem(root)

      fs.open('/cells/title', 1)
      fs.write('/cells/title', Buffer.from('old content'), 0)
      fs.truncate('/cells/title', 0)
      fs.write('/cells/title', Buffer.from('new'), 0)
      await fs.release('/cells/title')

      const title = root({ walk: 'cells/title' })
      expect(title({})).toBe('new')
    })
  })

  describe('over remote transport', () => {
    it('getattr works over remote scope', async () => {
      const { p, root } = setupWithTree()
      const { a, b } = memoryTransport()
      p.link.open({ transport: a, localScope: root })
      const clientLink = p.link.open({ transport: b, localScope: p.create.Scope() })
      const client = clientLink.remoteScope

      const fs = p.fuseRemote.createFileSystem(client)

      const dirAttr = await fs.getattr('/')
      expect(dirAttr.kind).toBe('dir')

      const fileAttr = await fs.getattr('/cells/counter')
      expect(fileAttr.kind).toBe('file')
    })

    it('readdir works over remote scope', async () => {
      const { p, root } = setupWithTree()
      const { a, b } = memoryTransport()
      p.link.open({ transport: a, localScope: root })
      const clientLink = p.link.open({ transport: b, localScope: p.create.Scope() })
      const client = clientLink.remoteScope

      const fs = p.fuseRemote.createFileSystem(client)

      const entries = await fs.readdir('/')
      const names = entries.map(e => e.name).sort()
      expect(names).toEqual(['cells', 'config'])
    })

    it('read works over remote scope', async () => {
      const { p, root } = setupWithTree()
      const { a, b } = memoryTransport()
      p.link.open({ transport: a, localScope: root })
      const clientLink = p.link.open({ transport: b, localScope: p.create.Scope() })
      const client = clientLink.remoteScope

      const fs = p.fuseRemote.createFileSystem(client)

      const buf = await fs.read('/cells/counter', 0, 4096)
      expect(buf.toString()).toBe('42\n')
    })

    it('write + release works over remote scope', async () => {
      const { p, root } = setupWithTree()
      const { a, b } = memoryTransport()
      p.link.open({ transport: a, localScope: root })
      const clientLink = p.link.open({ transport: b, localScope: p.create.Scope() })
      const client = clientLink.remoteScope

      const fs = p.fuseRemote.createFileSystem(client)

      fs.open('/cells/counter', 1)
      fs.write('/cells/counter', Buffer.from('77'), 0)
      await fs.release('/cells/counter')

      // Verify the local value was updated
      const counter = root({ walk: 'cells/counter' })
      expect(counter({})).toBe(77)
    })
  })
})
