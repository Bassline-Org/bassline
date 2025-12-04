/**
 * TCPServerMirror - Exposes a Bassline instance over TCP using BL/T protocol
 *
 * Ref: bl:///server/tcp?port=9000
 *
 * Usage:
 *   nc localhost 9000
 *   VERSION BL/1.0
 *   READ bl:///cell/counter
 *   OK 42
 */

import { createServer } from 'net';
import { BaseMirror } from './interface.js';
import { parse, serialize, Op } from '../protocol/text.js';

export class TCPServerMirror extends BaseMirror {
  constructor(r, bassline) {
    super(r, bassline);
    this._port = parseInt(r.searchParams.get('port') || '9000', 10);
    this._server = null;
    this._sessions = new Map(); // socket -> { streams: Map, streamCounter: number, buffer: string }
  }

  get readable() {
    return true;
  }

  get writable() {
    return true;
  }

  read() {
    return {
      port: this._port,
      running: this._server !== null,
      connections: this._sessions.size
    };
  }

  write(command) {
    if (command?.action === 'start') {
      this._start();
    } else if (command?.action === 'stop') {
      this._stop();
    }
  }

  _start() {
    if (this._server) return;

    this._server = createServer((socket) => this._handleConnection(socket));
    this._server.listen(this._port);
  }

  _stop() {
    if (this._server) {
      // Close all connections
      for (const [socket, session] of this._sessions) {
        this._cleanupSession(socket, session);
        socket.destroy();
      }
      this._sessions.clear();

      this._server.close();
      this._server = null;
    }
  }

  _handleConnection(socket) {
    const session = {
      streams: new Map(),      // streamId -> { ref, unsubscribe }
      streamCounter: 0,
      buffer: ''
    };
    this._sessions.set(socket, session);

    socket.on('data', (data) => {
      session.buffer += data.toString();

      // Process complete lines
      let newlineIndex;
      while ((newlineIndex = session.buffer.indexOf('\n')) !== -1) {
        const line = session.buffer.slice(0, newlineIndex);
        session.buffer = session.buffer.slice(newlineIndex + 1);

        if (line.trim()) {
          this._processLine(line, socket, session);
        }
      }
    });

    socket.on('close', () => {
      this._cleanupSession(socket, session);
      this._sessions.delete(socket);
    });

    socket.on('error', () => {
      this._cleanupSession(socket, session);
      this._sessions.delete(socket);
    });
  }

  _cleanupSession(socket, session) {
    // Unsubscribe all streams
    for (const { unsubscribe } of session.streams.values()) {
      unsubscribe();
    }
    session.streams.clear();
  }

  _processLine(line, socket, session) {
    const msg = parse(line);
    if (!msg) return; // Empty or comment

    const response = this._handleMessage(msg, socket, session);
    if (response) {
      // Preserve tag from request
      if (msg.tag) response.tag = msg.tag;
      socket.write(serialize(response) + '\n');
    }
  }

  _handleMessage(msg, socket, session) {
    switch (msg.op) {
      case Op.VERSION:
        return { op: Op.VERSION, version: 'BL/1.0' };

      case Op.READ:
        return this._handleRead(msg);

      case Op.WRITE:
        return this._handleWrite(msg);

      case Op.SUBSCRIBE:
        return this._handleSubscribe(msg, socket, session);

      case Op.UNSUBSCRIBE:
        return this._handleUnsubscribe(msg, session);

      case Op.INFO:
        return this._handleInfo(msg);

      default:
        return { op: Op.ERROR, code: '400', message: 'unknown operation' };
    }
  }

  _handleRead(msg) {
    try {
      const value = this._bassline.read(msg.ref);
      return { op: Op.OK, value };
    } catch (e) {
      return { op: Op.ERROR, code: '500', message: e.message };
    }
  }

  _handleWrite(msg) {
    try {
      this._bassline.write(msg.ref, msg.value);
      return { op: Op.OK };
    } catch (e) {
      return { op: Op.ERROR, code: '500', message: e.message };
    }
  }

  _handleSubscribe(msg, socket, session) {
    try {
      session.streamCounter++;
      const streamId = `s${session.streamCounter}`;

      // Send current value
      const currentValue = this._bassline.read(msg.ref);

      // Subscribe to future changes
      const unsubscribe = this._bassline.watch(msg.ref, (newValue) => {
        const event = { op: Op.EVENT, stream: streamId, value: newValue };
        socket.write(serialize(event) + '\n');
      });

      session.streams.set(streamId, { ref: msg.ref, unsubscribe });

      // Return STREAM response with current value sent as first EVENT
      socket.write(serialize({ op: Op.EVENT, stream: streamId, value: currentValue }) + '\n');
      return { op: Op.STREAM, stream: streamId };
    } catch (e) {
      return { op: Op.ERROR, code: '500', message: e.message };
    }
  }

  _handleUnsubscribe(msg, session) {
    const stream = session.streams.get(msg.stream);
    if (stream) {
      stream.unsubscribe();
      session.streams.delete(msg.stream);
      return { op: Op.OK };
    }
    return { op: Op.ERROR, code: '404', message: 'stream not found' };
  }

  _handleInfo(msg) {
    try {
      const mirror = this._bassline.resolve(msg.ref);
      const info = {
        readable: mirror.readable,
        writable: mirror.writable,
        ordering: mirror.ordering
      };
      return { op: Op.OK, value: info };
    } catch (e) {
      return { op: Op.ERROR, code: '404', message: e.message };
    }
  }

  dispose() {
    this._stop();
    super.dispose();
  }

  static get mirrorType() {
    return 'tcp-server';
  }

  toJSON() {
    return {
      $mirror: 'tcp-server',
      uri: this._ref?.href
    };
  }
}
