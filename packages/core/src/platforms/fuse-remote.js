/**
 * FUSE projection via resource messages only.
 *
 * Unlike fuse.js which uses platform.reflect() to detect scope/slot types,
 * this version operates purely through the resource message protocol.
 * This means it works transparently over a remote scope — the resource tree
 * can be local or on the other side of a transport.
 *
 * Type detection:
 *   - get({}) returns { hrefs: [...] } → directory (scope)
 *   - get({}) returns anything else → file
 *   - put succeeds → writable file
 *   - put throws → read-only file
 */

/** @param {import('../types').Platform} platform */
export default function fuseRemote(platform) {
  function norm(path) {
    return '/' + path.replace(/^\/+|\/+$/g, '')
  }

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

  /**
   * Resolve a path to a resource function.
   * Works with both local and remote scopes.
   */
  function resolve(root, path) {
    const p = norm(path)
    const segments = p.split('/').filter(Boolean)
    if (segments.length === 0) return root
    return root({ walk: segments })
  }

  /**
   * Detect whether a resource function is a scope (directory).
   * Uses the protocol: scopes return { hrefs: [...] } from get({}).
   */
  async function isScope(target) {
    try {
      let result = target({})
      if (result instanceof Promise) result = await result
      return result !== null && typeof result === 'object' && Array.isArray(result.hrefs)
    } catch {
      return false
    }
  }

  /**
   * Create a FileSystem-compatible object from a root resource function.
   * The root can be local or a remote proxy — the protocol is the same.
   *
   * @param {function} root - Root resource function (local or remote proxy)
   * @returns {object} FileSystem operations
   */
  function createFileSystem(root) {
    /** @type {Map<string, Buffer>} */
    const writeBuffers = new Map()

    async function getattr(path) {
      let target
      try {
        target = resolve(root, path)
        if (target instanceof Promise) target = await target
      } catch {
        throw fserror('ENOENT')
      }

      if (typeof target !== 'function') throw fserror('ENOENT')

      if (await isScope(target)) {
        return { kind: 'dir', size: 0, mtime: 0, atime: 0, nlink: 2 }
      }

      return { kind: 'file', size: 4096, mtime: 0, atime: 0, nlink: 1 }
    }

    async function readdir(path) {
      let target
      try {
        target = resolve(root, path)
        if (target instanceof Promise) target = await target
      } catch {
        throw fserror('ENOENT')
      }

      let listing = target({})
      if (listing instanceof Promise) listing = await listing
      if (!listing || !Array.isArray(listing.hrefs)) throw fserror('ENOTDIR')

      const entries = []
      for (const name of listing.hrefs) {
        let kind = 'file'
        try {
          let child = target({ at: name })
          if (child instanceof Promise) child = await child
          if (typeof child === 'function' && await isScope(child)) kind = 'dir'
        } catch { /* default to file */ }
        entries.push({ name, kind })
      }
      return entries
    }

    async function read(path, offset, size) {
      let target
      try {
        target = resolve(root, path)
        if (target instanceof Promise) target = await target
      } catch {
        throw fserror('ENOENT')
      }

      let value = target({})
      if (value instanceof Promise) value = await value
      const buf = Buffer.from(serialize(value))
      return buf.subarray(offset, offset + size)
    }

    function open(path, flags) {
      const p = norm(path)
      if ((flags & 3) !== 0) {
        writeBuffers.set(p, Buffer.alloc(0))
      }
    }

    function write(path, data, offset) {
      const p = norm(path)
      let buf = writeBuffers.get(p) || Buffer.alloc(0)
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
      const existing = writeBuffers.get(p) || Buffer.alloc(0)
      const result = Buffer.alloc(size)
      existing.copy(result, 0, 0, Math.min(existing.length, size))
      writeBuffers.set(p, result)
    }

    async function release(path) {
      const p = norm(path)
      const buf = writeBuffers.get(p)
      if (buf == null) return
      writeBuffers.delete(p)

      let target
      try {
        target = resolve(root, path)
        if (target instanceof Promise) target = await target
      } catch {
        throw fserror('ENOENT')
      }

      const value = deserialize(buf)
      let result = target({ put: value })
      if (result instanceof Promise) result = await result
      return result
    }

    return { getattr, readdir, read, write, open, release, truncate }
  }

  function fserror(code) {
    const err = new Error(code)
    err.code = code
    return err
  }

  platform.fuseRemote = { createFileSystem }
}
