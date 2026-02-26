import { spawn } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';
import protobuf from 'protobufjs';
import { FuseError, errno } from './errors.js';

export class Fuse extends EventEmitter {
  static bridgePath = null;
  static protoPath = null;

  #filesystem;
  #mountpoint;
  #bridgePath;
  #protoPath;
  #bridge = null;
  #FuseRequest = null;
  #FuseResponse = null;

  constructor(filesystem, { mountpoint, bridgePath, protoPath } = {}) {
    super();
    this.#filesystem = filesystem;
    this.#mountpoint = mountpoint ?? path.join(process.env.HOME, 'mnt');
    this.#bridgePath = bridgePath ?? Fuse.bridgePath
      ?? path.join(import.meta.dirname, '..', 'fuse-bridge', 'target', 'release', 'fuse-bridge');
    this.#protoPath = protoPath ?? Fuse.protoPath
      ?? path.join(import.meta.dirname, '..', 'protocol.proto');
  }

  get mountpoint() { return this.#mountpoint; }

  async mount() {
    const root = await protobuf.load(this.#protoPath);
    this.#FuseRequest = root.lookupType('fuse_bridge.FuseRequest');
    this.#FuseResponse = root.lookupType('fuse_bridge.FuseResponse');

    this.#bridge = spawn(this.#bridgePath, [this.#mountpoint], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.#bridge.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') this.emit('error', err);
    });

    // Length-prefixed protobuf framing — O(1) amortized
    const chunks = [];
    let totalLen = 0;

    const processBuffer = () => {
      if (totalLen < 4) return;
      let buffer = Buffer.concat(chunks);
      chunks.length = 0;

      while (buffer.length >= 4) {
        const msgLen = buffer.readUInt32LE(0);
        if (buffer.length < 4 + msgLen) break;

        const msgBytes = buffer.subarray(4, 4 + msgLen);
        buffer = buffer.subarray(4 + msgLen);

        let request;
        try {
          request = this.#FuseRequest.decode(msgBytes);
        } catch (err) {
          this.emit('error', err);
          continue;
        }
        this.#handleRequest(request);
      }

      if (buffer.length > 0) {
        chunks.push(buffer);
        totalLen = buffer.length;
      } else {
        totalLen = 0;
      }
    };

    this.#bridge.stdout.on('data', (chunk) => {
      chunks.push(chunk);
      totalLen += chunk.length;
      processBuffer();
    });

    this.#bridge.on('exit', (code, signal) => {
      this.#bridge = null;
      this.emit('exit', code, signal);
    });

    return new Promise((resolve, reject) => {
      this.#bridge.on('spawn', () => resolve());
      this.#bridge.on('error', (err) => reject(err));
    });
  }

  unmount() {
    if (!this.#bridge) return Promise.resolve();
    return new Promise((resolve) => {
      this.#bridge.on('exit', () => resolve());
      this.#bridge.kill('SIGTERM');
    });
  }

  async #handleRequest(request) {
    const response = await this.#dispatch(request);
    response.id = request.id;
    this.#sendResponse(response);
  }

  async #dispatch(request) {
    const op = request.op;
    const fields = request[op];
    try {
      switch (op) {
        case 'getattr': {
          const result = await this.#filesystem.getattr(fields.path);
          return { error: 0, stat: result };
        }
        case 'readdir': {
          const entries = await this.#filesystem.readdir(fields.path);
          return { error: 0, readdir: { entries } };
        }
        case 'read': {
          const data = await this.#filesystem.read(
            fields.path, Number(fields.offset), Number(fields.size),
          );
          return { error: 0, read: { data } };
        }
        case 'write': {
          const written = await this.#filesystem.write(
            fields.path, Buffer.from(fields.data), Number(fields.offset),
          );
          return { error: 0, write: { written } };
        }
        case 'truncate': {
          await this.#filesystem.truncate(fields.path, Number(fields.size));
          return { error: 0 };
        }
        case 'open': {
          await this.#filesystem.open(fields.path, Number(fields.flags));
          return { error: 0 };
        }
        case 'release': {
          await this.#filesystem.release(fields.path);
          return { error: 0 };
        }
        case 'create': {
          await this.#filesystem.create(fields.path, Number(fields.mode));
          return { error: 0 };
        }
        case 'unlink': {
          await this.#filesystem.unlink(fields.path);
          return { error: 0 };
        }
        case 'mkdir': {
          await this.#filesystem.mkdir(fields.path, Number(fields.mode));
          return { error: 0 };
        }
        case 'rmdir': {
          await this.#filesystem.rmdir(fields.path);
          return { error: 0 };
        }
        default:
          return { error: errno.ENOSYS };
      }
    } catch (err) {
      if (err instanceof FuseError) {
        return { error: err.code };
      }
      this.emit('error', err);
      return { error: errno.EIO };
    }
  }

  #sendResponse(response) {
    if (!this.#bridge) return;
    const msg = this.#FuseResponse.create(response);
    const encoded = this.#FuseResponse.encode(msg).finish();
    const header = Buffer.alloc(4);
    header.writeUInt32LE(encoded.length, 0);
    this.#bridge.stdin.write(header);
    this.#bridge.stdin.write(encoded);
  }
}
