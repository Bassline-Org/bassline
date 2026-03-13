# bassline-fs

A Node.js library for building custom FUSE filesystems. You define what files exist and what they contain in JavaScript; the library handles mounting them as a real directory on your Mac via a Rust bridge that talks to [FUSE-T](https://www.fuse-t.org/).

Your filesystem shows up at a mountpoint (default: `~/mnt`) and behaves like any other directory — `ls`, `cat`, `echo >`, and every other tool works against it.

## How It Works

There are two pieces:

1. **Your Node.js code** — defines the filesystem behavior (what paths exist, what reading/writing does)
2. **A Rust binary** (`fuse-bridge`) — talks to FUSE-T on macOS and communicates with your Node.js code over stdin/stdout using length-prefixed protobuf messages

The library handles all the communication plumbing. You only write the filesystem logic.

## Prerequisites

- macOS with [FUSE-T](https://www.fuse-t.org/) installed
- Node.js (ES module support required)
- The `fuse-bridge` Rust binary built at `fuse-bridge/target/release/fuse-bridge` (relative to this package)

## Quick Start

```js
import { Fuse, FileSystem, FuseError, errno } from './index.js';

class MyFS extends FileSystem {
  getattr(path) {
    if (path === '/') return { kind: 'dir', size: 0, nlink: 2 };
    if (path === '/greeting.txt') return { kind: 'file', size: 12, nlink: 1 };
    throw new FuseError(errno.ENOENT);
  }

  readdir(path) {
    if (path === '/') return [{ name: 'greeting.txt', kind: 'file' }];
    throw new FuseError(errno.ENOTDIR);
  }

  read(path, offset, size) {
    if (path === '/greeting.txt') {
      return Buffer.from('hello world\n').slice(offset, offset + size);
    }
    throw new FuseError(errno.ENOENT);
  }
}

const fuse = new Fuse(new MyFS(), { mountpoint: '/tmp/myfs' });
await fuse.mount();
// ls /tmp/myfs → greeting.txt
// cat /tmp/myfs/greeting.txt → hello world
```

## Exports

The package entry point (`index.js`) exports four things:

```js
import { Fuse, FileSystem, FuseError, errno } from './index.js';
```

---

## `FileSystem`

The base class for defining filesystem behavior. You provide implementations for FUSE operations — either by extending the class or by passing handler functions to the constructor.

### Creating a FileSystem

**Pattern A — Subclass:**

```js
class MyFS extends FileSystem {
  getattr(path) { /* ... */ }
  readdir(path) { /* ... */ }
  read(path, offset, size) { /* ... */ }
}

const fs = new MyFS();
```

**Pattern B — Constructor handlers:**

```js
const fs = new FileSystem({
  getattr(path) { /* ... */ },
  readdir(path) { /* ... */ },
  read(path, offset, size) { /* ... */ },
});
```

Both patterns are equivalent. The constructor validates handler names and throws if you pass an unknown operation name (catches typos).

### Operations

Every method can be synchronous or async — the library `await`s all of them.

#### `getattr(path)`

Called when the OS needs metadata about a file or directory (stat).

- **`path`** — absolute path from the mountpoint root, e.g. `'/'` or `'/hello.txt'`
- **Returns** an object with:
  - `kind` (string, required) — `'file'` or `'dir'`
  - `size` (number, required) — file size in bytes, or any number for directories
  - `mtime` (number, optional) — modification time as a Unix timestamp in seconds
  - `atime` (number, optional) — access time as a Unix timestamp in seconds
  - `ctime` (number, optional) — change time as a Unix timestamp in seconds
  - `nlink` (number, optional) — number of hard links (typically 1 for files, 2 for directories)
  - `mode` (number, optional) — Unix permission bits
- **Default** — throws `FuseError` with `ENOENT` (file not found)

#### `readdir(path)`

Called when the OS lists a directory's contents (ls).

- **`path`** — the directory path
- **Returns** an array of entries, each with:
  - `name` (string) — the entry name (not the full path), e.g. `'hello.txt'`
  - `kind` (string) — `'file'` or `'dir'`
- **Default** — throws `FuseError` with `ENOENT`

#### `read(path, offset, size)`

Called when the OS reads file content.

- **`path`** — the file path
- **`offset`** — byte offset to start reading from (number)
- **`size`** — maximum number of bytes to read (number)
- **Returns** a `Buffer` containing the requested data
- **Default** — throws `FuseError` with `ENOENT`

#### `write(path, data, offset)`

Called when the OS writes to a file.

- **`path`** — the file path
- **`data`** — a `Buffer` of bytes to write
- **`offset`** — byte offset to write at (number)
- **Returns** a number — how many bytes were written
- **Default** — throws `FuseError` with `EACCES` (permission denied)

#### `truncate(path, size)`

Called when the OS resizes a file (e.g. before overwriting with `echo "x" > file`).

- **`path`** — the file path
- **`size`** — the new file size in bytes (number)
- **Returns** nothing
- **Default** — throws `FuseError` with `EACCES`

#### `open(path, flags)`

Called when the OS opens a file.

- **`path`** — the file path
- **`flags`** — open flags as a number (O_RDONLY, O_WRONLY, etc.)
- **Returns** nothing
- **Default** — no-op (succeeds silently)

#### `release(path)`

Called when the OS closes a file.

- **`path`** — the file path
- **Returns** nothing
- **Default** — no-op (succeeds silently)

#### `create(path, mode)`

Called when the OS creates a new file.

- **`path`** — the file path
- **`mode`** — Unix permission bits (number)
- **Returns** nothing
- **Default** — throws `FuseError` with `ENOSYS` (not implemented)

#### `unlink(path)`

Called when the OS deletes a file.

- **`path`** — the file path
- **Returns** nothing
- **Default** — throws `FuseError` with `ENOSYS`

#### `mkdir(path, mode)`

Called when the OS creates a directory.

- **`path`** — the directory path
- **`mode`** — Unix permission bits (number)
- **Returns** nothing
- **Default** — throws `FuseError` with `ENOSYS`

#### `rmdir(path)`

Called when the OS removes a directory.

- **`path`** — the directory path
- **Returns** nothing
- **Default** — throws `FuseError` with `ENOSYS`

---

## `Fuse`

Manages the bridge process lifecycle. Extends `EventEmitter`.

### Constructor

```js
new Fuse(filesystem, options?)
```

- **`filesystem`** — a `FileSystem` instance (or any object with the right methods)
- **`options`** (all optional):
  - `mountpoint` — where to mount the filesystem. Defaults to `$HOME/mnt`.
  - `bridgePath` — path to the `fuse-bridge` Rust binary.
  - `protoPath` — path to `protocol.proto`.

### Bridge Path Resolution

The bridge binary and proto file paths are resolved with a 3-tier fallback:

1. Constructor option (`bridgePath` / `protoPath`)
2. Static property (`Fuse.bridgePath` / `Fuse.protoPath`)
3. Default relative to the package (`fuse-bridge/target/release/fuse-bridge` and `protocol.proto`)

To configure the bridge path globally:

```js
Fuse.bridgePath = '/opt/my-bridge/fuse-bridge';
```

### Properties

#### `fuse.mountpoint`

Read-only. Returns the mountpoint path string.

### Methods

#### `fuse.mount()`

Loads the protobuf schema, spawns the bridge binary, and starts handling filesystem requests. Returns a `Promise` that resolves when the bridge process has started, or rejects if the bridge fails to spawn.

```js
await fuse.mount();
```

#### `fuse.unmount()`

Sends `SIGTERM` to the bridge process. Returns a `Promise` that resolves when the bridge has exited. If the bridge is not running, resolves immediately.

```js
await fuse.unmount();
```

### Events

#### `'error'`

Emitted when something goes wrong: bridge stdin errors (other than EPIPE), protobuf decode failures, or unhandled exceptions thrown from your filesystem methods (non-`FuseError` exceptions).

```js
fuse.on('error', (err) => console.error(err));
```

When a filesystem method throws an unexpected error (not a `FuseError`), the library emits `'error'` and returns `EIO` to the bridge so the OS gets a generic I/O error.

#### `'exit'`

Emitted when the bridge process exits.

```js
fuse.on('exit', (code, signal) => {
  console.log(`bridge exited: code=${code} signal=${signal}`);
});
```

---

## `FuseError`

An `Error` subclass for returning FUSE error codes from your filesystem methods. Throw these to report errors back to the OS.

```js
throw new FuseError(errno.ENOENT);  // "file not found"
throw new FuseError(errno.EACCES);  // "permission denied"
```

### Properties

- **`code`** — the numeric errno value (e.g. `-2` for `ENOENT`)
- **`message`** — auto-generated, e.g. `'FUSE error: ENOENT (-2)'`

---

## `errno`

An object of named POSIX error constants with negated values (the bridge protocol uses negative errno):

| Name | Value | Meaning |
|---|---|---|
| `EPERM` | -1 | Operation not permitted |
| `ENOENT` | -2 | No such file or directory |
| `EIO` | -5 | I/O error |
| `EACCES` | -13 | Permission denied |
| `EEXIST` | -17 | File exists |
| `ENOTDIR` | -20 | Not a directory |
| `EISDIR` | -21 | Is a directory |
| `ENOSPC` | -28 | No space left on device |
| `ENOSYS` | -38 | Function not implemented |
| `ENOTEMPTY` | -39 | Directory not empty |

---

## Error Handling

There are two kinds of errors your methods can throw:

1. **`FuseError`** — intentional. The numeric `code` is sent back to the OS. This is how you say "file not found" or "permission denied."

2. **Any other error** — unintentional. The library emits an `'error'` event on the `Fuse` instance and returns `EIO` (I/O error) to the OS. Listen for `'error'` events to log or handle these.

---

## Signal Handling

The library does **not** install any signal handlers or process-level error handlers. These are application-level concerns. In your application code, wire them up yourself:

```js
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => fuse.unmount());
}

fuse.on('exit', (code) => process.exit(code || 0));
```

---

## Running the Demo

The included `examples/demo-fs.js` demonstrates a filesystem with three files:

- `hello.txt` — always contains `hello world\n`
- `time.txt` — contains the current ISO timestamp each time you read it
- `echo.txt` — writable; starts with `write to me\n`, stores whatever you write to it

```bash
node examples/demo-fs.js ~/mnt
```

Then in another terminal:

```bash
ls ~/mnt                              # hello.txt  time.txt  echo.txt
cat ~/mnt/hello.txt                   # hello world
cat ~/mnt/time.txt                    # 2026-02-21T...
echo "test" > ~/mnt/echo.txt
cat ~/mnt/echo.txt                    # test
```

To unmount: `umount ~/mnt` or Ctrl-C the Node process.

`examples/demo-fs.js` accepts an optional mountpoint argument; it defaults to `$HOME/mnt`.

---

## File Structure

```
fs/
├── package.json          — package config (ESM, exports)
├── protocol.proto        — protobuf schema for bridge communication
├── index.js              — library entry point (re-exports)
├── lib/
│   ├── errors.js         — FuseError class and errno constants
│   ├── filesystem.js     — FileSystem base class
│   └── fuse.js           — Fuse class (bridge lifecycle, protobuf framing, dispatch)
├── examples/
│   └── demo-fs.js        — demo filesystem application
└── fuse-bridge/          — Rust bridge binary (built separately)
```
