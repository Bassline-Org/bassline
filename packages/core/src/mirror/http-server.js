/**
 * HTTPServerMirror - Exposes a Bassline instance over HTTP
 *
 * Ref: bl:///server/http?port=8080&auth=true
 *
 * Routes:
 *   GET  /bl/cell/counter         → bl.read('bl:///cell/counter')
 *   PUT  /bl/cell/counter         → bl.write('bl:///cell/counter', body)
 *   GET  /bl/cell/counter?sse=1   → SSE subscription
 */

import { createServer } from 'http';
import { BaseMirror } from './interface.js';

export class HTTPServerMirror extends BaseMirror {
  constructor(r, bassline) {
    super(r, bassline);
    this._port = parseInt(r.searchParams.get('port') || '8080', 10);
    this._auth = r.searchParams.get('auth') === 'true';
    this._server = null;
    this._sseClients = new Map(); // ref -> Set of response objects
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
      auth: this._auth
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

    this._server = createServer((req, res) => this._handleRequest(req, res));
    this._server.listen(this._port);
  }

  _stop() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
    // Close all SSE connections
    for (const clients of this._sseClients.values()) {
      for (const res of clients) {
        res.end();
      }
    }
    this._sseClients.clear();
  }

  _handleRequest(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth check
    if (this._auth && !this._checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      return;
    }

    // Parse URL
    const url = new URL(req.url, `http://localhost:${this._port}`);
    const path = url.pathname;

    // Must start with /bl/
    if (!path.startsWith('/bl/')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    // Check for INFO request: /bl/info/cell/counter -> capabilities of bl:///cell/counter
    if (path.startsWith('/bl/info/')) {
      const infoPath = path.slice(8); // Remove '/bl/info'
      const refStr = `bl://${infoPath}${url.search}`;
      this._handleInfo(refStr, res);
      return;
    }

    // Convert HTTP path to Bassline ref
    const blPath = path.slice(3); // Remove '/bl'
    const refStr = `bl://${blPath}${url.search}`;

    // Check for SSE subscription
    if (url.searchParams.has('sse')) {
      url.searchParams.delete('sse');
      const cleanRef = `bl://${blPath}${url.search}`;
      this._handleSSE(cleanRef, res);
      return;
    }

    if (req.method === 'GET') {
      this._handleRead(refStr, req, res);
    } else if (req.method === 'PUT') {
      this._handleWrite(refStr, req, res);
    } else {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
    }
  }

  _handleInfo(refStr, res) {
    try {
      const mirror = this._bassline.resolve(refStr);
      const info = {
        readable: mirror.readable,
        writable: mirror.writable,
        ordering: mirror.ordering
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(info));
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  }

  _checkAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }
    const token = authHeader.slice(7);
    const tokens = this._bassline.read('bl:///cell/_auth/tokens');
    return Array.isArray(tokens) && tokens.includes(token);
  }

  _handleRead(refStr, req, res) {
    try {
      const value = this._bassline.read(refStr);
      this._sendValue(value, req, res);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error: ${e.message}`);
    }
  }

  _handleWrite(refStr, req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        // Parse body - try JSON first, then raw value
        let value;
        try {
          value = JSON.parse(body);
        } catch {
          // Treat as raw string/number
          const trimmed = body.trim();
          if (trimmed === 'true') value = true;
          else if (trimmed === 'false') value = false;
          else if (trimmed === 'null') value = null;
          else if (/^-?\d+(\.\d+)?$/.test(trimmed)) value = parseFloat(trimmed);
          else value = trimmed;
        }

        this._bassline.write(refStr, value);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error: ${e.message}`);
      }
    });
  }

  _handleSSE(refStr, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Track this client
    if (!this._sseClients.has(refStr)) {
      this._sseClients.set(refStr, new Set());
    }
    this._sseClients.get(refStr).add(res);

    // Send current value
    const value = this._bassline.read(refStr);
    res.write(`event: value\ndata: ${this._formatValue(value)}\n\n`);

    // Subscribe to changes
    const unsubscribe = this._bassline.watch(refStr, (newValue) => {
      res.write(`event: update\ndata: ${this._formatValue(newValue)}\n\n`);
    });

    // Cleanup on disconnect
    res.on('close', () => {
      unsubscribe();
      this._sseClients.get(refStr)?.delete(res);
    });
  }

  _sendValue(value, req, res) {
    const wantsJson = req.headers.accept?.includes('application/json');

    if (wantsJson) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ value }));
    } else {
      // Plain text for primitives, JSON for complex
      res.writeHead(200, { 'Content-Type': this._isComplex(value) ? 'application/json' : 'text/plain' });
      res.end(this._formatValue(value));
    }
  }

  _formatValue(value) {
    if (this._isComplex(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  _isComplex(value) {
    return value !== null && typeof value === 'object';
  }

  dispose() {
    this._stop();
    super.dispose();
  }

  static get mirrorType() {
    return 'http-server';
  }

  toJSON() {
    return {
      $mirror: 'http-server',
      uri: this._ref?.href
    };
  }
}
