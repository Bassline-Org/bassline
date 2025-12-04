/**
 * RemoteMirror - A mirror connected via WebSocket
 *
 * Address comes from ref query param: bl:///remote/peer1?address=ws://localhost:8080
 */

import { BaseMirror } from './interface.js';

export class RemoteMirror extends BaseMirror {
  constructor(r, bassline) {
    super(r, bassline);
    this._url = r.searchParams.get('address');
    this._ws = null;
    this._value = undefined;
    this._connected = false;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = parseInt(r.searchParams.get('maxReconnect') || '5', 10);
    this._reconnectDelay = parseInt(r.searchParams.get('reconnectDelay') || '1000', 10);

    if (this._url) {
      this._connect();
    }
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

  static get mirrorType() {
    return 'remote';
  }

  toJSON() {
    return {
      $mirror: 'remote',
      uri: this._ref?.href
    };
  }
}
