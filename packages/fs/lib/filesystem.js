import { FuseError, errno } from './errors.js';

const VALID_OPS = new Set([
  'getattr', 'readdir', 'read', 'write', 'open', 'release',
  'truncate', 'create', 'unlink', 'mkdir', 'rmdir',
]);

export class FileSystem {
  constructor(handlers = {}) {
    for (const name of Object.keys(handlers)) {
      if (!VALID_OPS.has(name)) {
        throw new Error(`Unknown FUSE operation: "${name}". Valid: ${[...VALID_OPS].join(', ')}`);
      }
      this[name] = handlers[name];
    }
  }

  getattr(path) { throw new FuseError(errno.ENOENT); }
  readdir(path) { throw new FuseError(errno.ENOENT); }
  read(path, offset, size) { throw new FuseError(errno.ENOENT); }
  write(path, data, offset) { throw new FuseError(errno.EACCES); }
  truncate(path, size) { throw new FuseError(errno.EACCES); }
  open(path, flags) {}
  release(path) {}
  create(path, mode) { throw new FuseError(errno.ENOSYS); }
  unlink(path) { throw new FuseError(errno.ENOSYS); }
  mkdir(path, mode) { throw new FuseError(errno.ENOSYS); }
  rmdir(path) { throw new FuseError(errno.ENOSYS); }
}
