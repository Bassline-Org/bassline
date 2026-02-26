import { Fuse, FileSystem, FuseError, errno } from '@bassline/fs'

/** @typedef {import('../types').ResourceFn} ResourceFn */
/** @typedef {import('../types').Platform} Platform */

/** @param {Platform} platform */
export default function fuse(platform) {
  /** @type {Map<string, Buffer>} */
  const writeBuffers = new Map()

  /**
   * Normalize a FUSE path to always start with /.
   * @param {string} path
   * @returns {string}
   */
  function norm(path) {
    return '/' + path.replace(/^\/+|\/+$/g, '')
  }

  // --- Serialization ---

  /**
   * Serialize a resource value to a FUSE-readable string.
   * @param {unknown} value
   * @returns {string}
   */
  function serialize(value) {
    if (value == null) return '\n'
    if (typeof value === 'string') return value + '\n'
    if (typeof value === 'number' || typeof value === 'boolean') return String(value) + '\n'
    return JSON.stringify(value) + '\n'
  }

  /**
   * Deserialize a written buffer back to a value.
   * @param {Buffer} buf
   * @returns {unknown}
   */
  function deserialize(buf) {
    const str = buf.toString().trim()
    if (str === '') return null
    try {
      return JSON.parse(str)
    } catch {
      return str
    }
  }

  // --- Path resolution ---

  /**
   * Resolve a FUSE path to a resource function.
   * @param {string} path
   * @returns {ResourceFn | Promise<ResourceFn>}
   */
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

  /**
   * @param {ResourceFn} resourceFn
   * @returns {boolean}
   */
  function isScope(resourceFn) {
    const { Scope } = platform.classes
    return Scope && resourceFn?._resource instanceof Scope
  }

  /**
   * @param {ResourceFn} resourceFn
   * @returns {boolean}
   */
  function isWritable(resourceFn) {
    const { Slot } = platform.classes
    return Slot && resourceFn?._resource instanceof Slot
  }

  // --- Parent resolution (for metadata) ---

  /**
   * Resolve the parent scope and child name for a given path.
   * @param {string} path
   * @returns {{ parent: ResourceFn, childName: string } | Promise<{ parent: ResourceFn, childName: string }>}
   */
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

  /**
   * Get file/directory attributes for a path.
   * @param {string} path
   * @returns {{ kind: string, size: number, mode?: number, mtime: number, atime: number, nlink: number }}
   */
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

  /**
   * @param {ResourceFn} target
   * @param {string} path
   */
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
    } catch {
      /* no metadata available */
    }

    if (isWritable(target)) {
      return { kind: 'file', size, mtime: 0, atime: 0, nlink: 1 }
    }

    // Read-only (compute-on-read)
    return { kind: 'file', size, mode: 0o100444, mtime: 0, atime: 0, nlink: 1 }
  }

  /**
   * List directory entries for a path.
   * @param {string} path
   * @returns {{ name: string, kind: string }[]}
   */
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

  /**
   * @param {ResourceFn} target
   */
  function readdirForTarget(target) {
    if (!isScope(target)) throw new FuseError(errno.ENOTDIR)
    const listing = target({})
    if (listing instanceof Promise) {
      return listing.then(l => readdirFromListing(target, l))
    }
    return readdirFromListing(target, listing)
  }

  /**
   * @param {ResourceFn} target
   * @param {{ hrefs: string[] }} listing
   */
  function readdirFromListing(target, listing) {
    if (!listing || !Array.isArray(listing.hrefs)) throw new FuseError(errno.ENOTDIR)
    return listing.hrefs.map(name => {
      let kind = 'file'
      try {
        const child = target({ at: name })
        if (typeof child === 'function' && isScope(child)) kind = 'dir'
      } catch {
        /* default to file */
      }
      return { name, kind }
    })
  }

  /**
   * Read a file's content.
   * @param {string} path
   * @param {number} offset
   * @param {number} size
   * @returns {Promise<Buffer>}
   */
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

  /**
   * Open a file for reading or writing.
   * @param {string} path
   * @param {number} flags - POSIX open flags (O_RDONLY=0, O_WRONLY=1, O_RDWR=2)
   */
  function open(path, flags) {
    const p = norm(path)
    // O_WRONLY=1, O_RDWR=2 — if lowest two bits are non-zero, it's a write
    if ((flags & 3) !== 0) {
      writeBuffers.set(p, Buffer.alloc(0))
    }
  }

  /**
   * Buffer a write to a file. Flushed on release.
   * @param {string} path
   * @param {Buffer} data
   * @param {number} offset
   * @returns {number} bytes written
   */
  function write(path, data, offset) {
    const p = norm(path)
    let buf = writeBuffers.get(p)
    if (!buf) {
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

  /**
   * Truncate a file's write buffer.
   * @param {string} path
   * @param {number} size
   */
  function truncate(path, size) {
    const p = norm(path)
    writeBuffers.set(p, Buffer.alloc(size))
  }

  /**
   * Flush buffered writes to the resource. Called when the file handle is closed.
   * @param {string} path
   * @returns {Promise<unknown>}
   */
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

  /**
   * Mount the resource tree as a FUSE filesystem.
   * @param {object} [opts]
   * @param {string} [opts.mountpoint]
   * @returns {Promise<InstanceType<typeof Fuse>>}
   */
  async function mount(opts = {}) {
    const fs = new FileSystem({ getattr, readdir, read, write, open, release, truncate })
    const instance = new Fuse(fs, opts)
    await instance.mount()
    return instance
  }

  // --- Helpers ---

  /**
   * @param {unknown} e
   * @returns {never}
   */
  function rethrowOrENOENT(e) {
    if (e instanceof FuseError) throw e
    throw new FuseError(errno.ENOENT)
  }

  platform.fuse = { mount, getattr, readdir, read, write, open, release, truncate }
}
