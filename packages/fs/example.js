import path from 'path';
import { Fuse, FileSystem, errno, FuseError } from './index.js';

function now() { return Math.floor(Date.now() / 1000); }

class DemoFS extends FileSystem {
  #files = {
    '/hello.txt': {
      kind: 'file',
      read: () => Buffer.from('hello world\n'),
    },
    '/time.txt': {
      kind: 'file',
      read: () => Buffer.from(new Date().toISOString() + '\n'),
    },
    '/echo.txt': {
      kind: 'file',
      content: Buffer.from('write to me\n'),
      read() { return this.content; },
      write(data, offset) {
        if (offset === 0 && data.length >= this.content.length) {
          this.content = data;
        } else {
          const needed = offset + data.length;
          if (needed > this.content.length) {
            const grown = Buffer.alloc(needed);
            this.content.copy(grown);
            this.content = grown;
          }
          data.copy(this.content, offset);
        }
        return data.length;
      },
    },
  };

  getattr(p) {
    if (p === '/') {
      return { kind: 'dir', size: 4096, mtime: now(), atime: now(), nlink: 2 };
    }
    const file = this.#files[p];
    if (!file) throw new FuseError(errno.ENOENT);
    const data = file.read();
    return { kind: file.kind, size: data.length, mtime: now(), atime: now(), nlink: 1 };
  }

  readdir(p) {
    if (p === '/') {
      return Object.keys(this.#files).map(k => ({
        name: k.slice(1),
        kind: this.#files[k].kind,
      }));
    }
    throw new FuseError(errno.ENOTDIR);
  }

  read(p, offset, size) {
    const file = this.#files[p];
    if (!file) throw new FuseError(errno.ENOENT);
    const data = file.read();
    return data.slice(offset, offset + size);
  }

  write(p, data, offset) {
    const file = this.#files[p];
    if (!file || !file.write) throw new FuseError(errno.EACCES);
    return file.write(data, offset);
  }

  truncate(p, size) {
    const file = this.#files[p];
    if (!file || !file.write) throw new FuseError(errno.EACCES);
    if (size === 0) {
      file.content = Buffer.alloc(0);
    } else {
      const old = file.content || Buffer.alloc(0);
      file.content = Buffer.alloc(size);
      old.copy(file.content, 0, 0, Math.min(old.length, size));
    }
  }
}

const mountpoint = process.argv[2] || path.join(process.env.HOME, 'mnt');
const fuse = new Fuse(new DemoFS(), { mountpoint });

fuse.on('error', (err) => console.error('FUSE error:', err));
fuse.on('exit', (code) => {
  console.log(`fuse-bridge exited with code ${code}`);
  process.exit(code || 0);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => fuse.unmount());
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

await fuse.mount();
console.log(`Filesystem mounted at ${mountpoint}`);
