import { Fuse, FileSystem, FuseError, errno } from '@bassline/fs'

export default function fuse(platform) {
  const writeBuffers = new Map()

  function norm(path) {
    return '/' + path.replace(/^\/+|\/+$/g, '')
  }

  // --- Serialization ---

  function serialize(value) {
    if (value == null) return '\n'
    if (typeof value === 'string') return value + '\n'
    if (typeof value === 'number' || typeof value === 'boolean') return String(value) + '\n'
    return JSON.stringify(value) + '\n'
  }

  function deserialize(buf) {
    const str = buf.toString().trim()
    if (str === '') return null
    try { return JSON.parse(str) } catch { return str }
  }

  // --- Path resolution ---

  function resolve(path) {
    const p = norm(path)
    const segments = p.split('/').filter(Boolean)
    if (segments.length === 0) return platform.root
    const result = platform.root({ walk: segments })
    if (result instanceof Promise) {
      return result.then(r => {
        if (typeof r !== 'function') throw new FuseError(errno.ENOENT)
        return r
      })
    }
    if (typeof result !== 'function') throw new FuseError(errno.ENOENT)
    return result
  }

  // --- Type detection ---

  function isScope(resourceFn) {
    const { Scope } = platform.classes
    return Scope && resourceFn?._resource instanceof Scope
  }

  function isWritable(resourceFn) {
    const { Slot } = platform.classes
    return Slot && resourceFn?._resource instanceof Slot
  }

  // --- Parent resolution (for metadata) ---

  function resolveParent(path) {
    const p = norm(path)
    const segments = p.split('/').filter(Boolean)
    if (segments.length <= 1) return { parent: platform.root, childName: segments[0] }
    const parentSegments = segments.slice(0, -1)
    const childName = segments[segments.length - 1]
    const parent = platform.root({ walk: parentSegments })
    if (parent instanceof Promise) {
      return parent.then(p => ({ parent: p, childName }))
    }
    return { parent, childName }
  }

  // --- FUSE operations ---

  function getattr(path) {
    let target
    try {
      target = resolve(path)
    } catch (e) {
      if (e instanceof FuseError) throw e
      throw new FuseError(errno.ENOENT)
    }

    if (target instanceof Promise) {
      return target.then(t => getattrForTarget(t, path)).catch(rethrowOrENOENT)
    }
    return getattrForTarget(target, path)
  }

  function getattrForTarget(target, path) {
    if (isScope(target)) {
      return { kind: 'dir', size: 0, mtime: 0, atime: 0, nlink: 2 }
    }

    // Check parent for size metadata
    let size = 4096
    try {
      const info = resolveParent(path)
      if (info instanceof Promise) {
        // For sync path, skip metadata lookup
      } else {
        const meta = info.parent({ meta: info.childName })
        if (meta && typeof meta.size === 'number') size = meta.size
      }
    } catch { /* no metadata available */ }

    if (isWritable(target)) {
      return { kind: 'file', size, mtime: 0, atime: 0, nlink: 1 }
    }

    // Read-only (compute-on-read)
    return { kind: 'file', size, mode: 0o100444, mtime: 0, atime: 0, nlink: 1 }
  }

  function readdir(path) {
    let target
    try {
      target = resolve(path)
    } catch (e) {
      if (e instanceof FuseError) throw e
      throw new FuseError(errno.ENOENT)
    }

    if (target instanceof Promise) {
      return target.then(t => readdirForTarget(t)).catch(rethrowOrENOENT)
    }
    return readdirForTarget(target)
  }

  function readdirForTarget(target) {
    if (!isScope(target)) throw new FuseError(errno.ENOTDIR)
    const listing = target({})
    if (listing instanceof Promise) {
      return listing.then(l => readdirFromListing(target, l))
    }
    return readdirFromListing(target, listing)
  }

  function readdirFromListing(target, listing) {
    if (!listing || !Array.isArray(listing.hrefs)) throw new FuseError(errno.ENOTDIR)
    return listing.hrefs.map(name => {
      let kind = 'file'
      try {
        const child = target({ at: name })
        if (typeof child === 'function' && isScope(child)) kind = 'dir'
      } catch { /* default to file */ }
      return { name, kind }
    })
  }

  async function read(path, offset, size) {
    let target
    try {
      target = resolve(path)
    } catch (e) {
      if (e instanceof FuseError) throw e
      throw new FuseError(errno.ENOENT)
    }
    if (target instanceof Promise) target = await target

    let value = target({})
    if (value instanceof Promise) value = await value
    const buf = Buffer.from(serialize(value))
    return buf.subarray(offset, offset + size)
  }

  function open(path, flags) {
    const p = norm(path)
    // O_WRONLY=1, O_RDWR=2 — if lowest two bits are non-zero, it's a write
    if ((flags & 3) !== 0) {
      writeBuffers.set(p, Buffer.alloc(0))
    }
  }

  function write(path, data, offset) {
    const p = norm(path)
    let buf = writeBuffers.get(p)
    if (!buf) {
      // truncate may have created it, or open was missed — create now
      buf = Buffer.alloc(0)
    }
    const needed = offset + data.length
    if (needed > buf.length) {
      const grown = Buffer.alloc(needed)
      buf.copy(grown)
      buf = grown
    }
    data.copy(buf, offset)
    writeBuffers.set(p, buf)
    return data.length
  }

  function truncate(path, size) {
    const p = norm(path)
    writeBuffers.set(p, Buffer.alloc(size))
  }

  async function release(path) {
    const p = norm(path)
    const buf = writeBuffers.get(p)
    if (buf == null) return
    writeBuffers.delete(p)

    let target
    try {
      target = resolve(path)
    } catch (e) {
      if (e instanceof FuseError) throw e
      throw new FuseError(errno.ENOENT)
    }
    if (target instanceof Promise) target = await target

    if (!isWritable(target)) throw new FuseError(errno.EACCES)

    const value = deserialize(buf)
    let result = target({ put: value })
    if (result instanceof Promise) result = await result
    return result
  }

  async function mount(opts = {}) {
    const fs = new FileSystem({ getattr, readdir, read, write, open, release, truncate })
    const instance = new Fuse(fs, opts)
    await instance.mount()
    return instance
  }

  // --- Helpers ---

  function rethrowOrENOENT(e) {
    if (e instanceof FuseError) throw e
    throw new FuseError(errno.ENOENT)
  }

  platform.fuse = { mount, getattr, readdir, read, write, open, release, truncate }
}
