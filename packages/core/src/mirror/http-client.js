/**
 * HTTPClientMirror - Connect to a remote Bassline via HTTP
 *
 * Ref: bl:///http?url=http://server:8080/bl/cell/counter&token=secret
 *
 * Uses:
 *   - fetch() for read/write
 *   - EventSource for SSE subscriptions
 */

import { BaseMirror } from './interface.js';

export class HTTPClientMirror extends BaseMirror {
  constructor(r, bassline) {
    super(r, bassline);
    this._url = r.searchParams.get('url');
    this._token = r.searchParams.get('token');
    this._value = undefined;
    this._eventSource = null;
  }

  get readable() {
    return true;
  }

  get writable() {
    return true;
  }

  read() {
    return this._value;
  }

  write(value) {
    // Fire and forget - use writeAsync for awaiting
    this.writeAsync(value).catch(e => console.error('Write failed:', e));
  }

  async readAsync() {
    const headers = {};
    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`;
    }

    const res = await fetch(this._url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      this._value = data.value !== undefined ? data.value : data;
    } else {
      const text = await res.text();
      this._value = this._parseValue(text);
    }

    return this._value;
  }

  async writeAsync(value) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`;
    }

    const res = await fetch(this._url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(value)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
  }

  subscribe(callback) {
    // Add to subscribers
    this._subscribers.add(callback);

    // Start SSE if not already running
    if (!this._eventSource) {
      this._startSSE();
    }

    return () => {
      this._subscribers.delete(callback);
      if (this._subscribers.size === 0) {
        this._stopSSE();
      }
    };
  }

  _startSSE() {
    const sseUrl = this._url + (this._url.includes('?') ? '&' : '?') + 'sse=1';

    // EventSource doesn't support custom headers, so token goes in URL
    const urlWithAuth = this._token
      ? sseUrl + `&token=${encodeURIComponent(this._token)}`
      : sseUrl;

    if (typeof EventSource === 'undefined') {
      console.warn('EventSource not available in this environment');
      return;
    }

    this._eventSource = new EventSource(urlWithAuth);

    this._eventSource.addEventListener('value', (e) => {
      this._value = this._parseValue(e.data);
      this._notify(this._value);
    });

    this._eventSource.addEventListener('update', (e) => {
      this._value = this._parseValue(e.data);
      this._notify(this._value);
    });

    this._eventSource.onerror = (e) => {
      console.error('SSE error:', e);
    };
  }

  _stopSSE() {
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }
  }

  _parseValue(text) {
    try {
      return JSON.parse(text);
    } catch {
      // Primitives
      const trimmed = text.trim();
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      if (trimmed === 'null') return null;
      if (trimmed === 'undefined') return undefined;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
      return trimmed;
    }
  }

  dispose() {
    this._stopSSE();
    super.dispose();
  }

  static get mirrorType() {
    return 'http';
  }

  toJSON() {
    return {
      $mirror: 'http',
      uri: this._ref?.href
    };
  }
}
