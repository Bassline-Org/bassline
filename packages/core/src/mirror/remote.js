/**
 * RemoteMirror - A mirror connected via WebSocket
 *
 * Provides bidirectional sync with a remote resource.
 * Used by the ws:// and wss:// scheme handlers.
 */

import { BaseMirror } from './interface.js';
import { registerMirrorType } from './serialize.js';

export class RemoteMirror extends BaseMirror {
  /**
   * @param {string} url - WebSocket URL (ws:// or wss://)
   * @param {object} options - Connection options
   * @param {string} [uri] - Optional URI for this remote (for serialization)
   */
  constructor(url, options = {}, uri = null) {
    super();
    this._url = url;
    this._options = options;
    this._uri = uri;
    this._ws = null;
    this._value = undefined;
    this._connected = false;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this._reconnectDelay = options.reconnectDelay ?? 1000;

    this._connect();
  }

  get readable() {
    return true;
  }

  get writable() {
    return true;
  }

  get connected() {
    return this._connected;
  }

  read() {
    return this._value;
  }

  write(value) {
    if (!this._ws || this._ws.readyState !== 1) {
      throw new Error("WebSocket not connected");
    }
    this._ws.send(JSON.stringify({ type: 'write', data: value }));
  }

  _connect() {
    // Only attempt connection in environments with WebSocket
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket not available in this environment');
      return;
    }

    try {
      this._ws = new WebSocket(this._url);

      this._ws.onopen = () => {
        this._connected = true;
        this._reconnectAttempts = 0;
        this._notify(this._value);
      };

      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'value' || msg.type === 'update') {
            this._value = msg.data;
            this._notify(this._value);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this._ws.onclose = () => {
        this._connected = false;
        this._maybeReconnect();
      };

      this._ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
    }
  }

  _maybeReconnect() {
    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      this._reconnectAttempts++;
      setTimeout(() => this._connect(), this._reconnectDelay * this._reconnectAttempts);
    }
  }

  dispose() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
    super.dispose();
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  static get mirrorType() {
    return 'remote';
  }

  /**
   * Serialize remote config (connection state is transient)
   */
  toJSON() {
    return {
      $mirror: 'remote',
      uri: this._uri,
      url: this._url,
      options: {
        maxReconnectAttempts: this._maxReconnectAttempts,
        reconnectDelay: this._reconnectDelay
      }
    };
  }

  /**
   * Deserialize remote - creates new connection
   */
  static fromJSON(data, registry = null) {
    return new RemoteMirror(data.url, data.options || {}, data.uri);
  }
}

/**
 * Create a remote mirror
 */
export function remote(url, options, uri = null) {
  return new RemoteMirror(url, options, uri);
}

// Register with serialization system
registerMirrorType('remote', RemoteMirror.fromJSON);
