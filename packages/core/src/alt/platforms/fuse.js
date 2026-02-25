import { Fuse, FileSystem, FuseError, errno } from '@bassline/fs'

export default function fuse(platform) {
  const files = new Map()

  function norm(path) {
    return path.replace(/^\/+|\/+$/g, '')
  }

  function file(path, handlers) {
    files.set(norm(path), handlers)
  }

  function remove(path) {
    files.delete(norm(path))
  }

  function getattr(path) {
    const p = norm(path)
    if (files.has(p)) {
      const f = files.get(p)
      return { kind: 'file', size: f.size ?? 4096, mtime: 0, atime: 0, nlink: 1 }
    }
    const prefix = p === '' ? '' : p + '/'
    for (const key of files.keys()) {
      if (p === '' || key.startsWith(prefix)) {
        return { kind: 'dir', size: 0, mtime: 0, atime: 0, nlink: 2 }
      }
    }
    throw new FuseError(errno.ENOENT)
  }

  function readdir(path) {
    const p = norm(path)
    const prefix = p === '' ? '' : p + '/'
    const seen = new Set()
    for (const key of files.keys()) {
      if (p === '' ? true : key.startsWith(prefix)) {
        const rest = p === '' ? key : key.slice(prefix.length)
        const name = rest.split('/')[0]
        if (name) seen.add(name)
      }
    }
    if (seen.size === 0) throw new FuseError(errno.ENOENT)
    return [...seen].map(name => {
      const child = prefix + name
      return { name, kind: files.has(child) ? 'file' : 'dir' }
    })
  }

  async function read(path, offset, size) {
    const f = files.get(norm(path))
    if (!f || typeof f.read !== 'function') throw new FuseError(errno.EACCES)
    const content = await f.read()
    const buf = Buffer.from(String(content) + '\n')
    return buf.subarray(offset, offset + size)
  }

  async function write(path, data, offset) {
    const f = files.get(norm(path))
    if (!f || typeof f.write !== 'function') throw new FuseError(errno.EACCES)
    await f.write(data, offset)
    return data.length
  }

  async function mount(opts = {}) {
    const fs = new FileSystem({ getattr, readdir, read, write })
    const instance = new Fuse(fs, opts)
    await instance.mount()
    return instance
  }

  platform.fuse = { file, remove, mount, getattr, readdir, read, write }
}
