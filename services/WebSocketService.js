// ─────────────────────────────────────────────────────────────────────────────
// WebSocketService.js
// Persistent WebSocket connection to ws://host/ws/gateway/?token=JWT
// • Auto-reconnects on disconnect (exponential backoff, max 30s)
// • Re-authenticates when token refreshes
// • Dispatches messages to registered listeners
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE, BASE_URL, WS_BASE } from '../config';
// const WS_BASE → imported from config
const AUTH_TOKEN_KEY = 'DYUKSA_AUTH_TOKEN';

class WebSocketService {
  constructor() {
    this._ws           = null;
    this._listeners    = new Set();   // callbacks: (message) => void
    this._reconnectTimer = null;
    this._retryDelay   = 2000;        // start at 2s
    this._maxDelay     = 30000;       // cap at 30s
    this._shouldConnect = false;      // set true after explicit connect()
    this._token        = null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Call once after login. Connects and stays connected. */
  async connect() {
    this._shouldConnect = true;
    this._retryDelay = 2000;
    await this._open();
  }

  /** Call on logout. Closes and stops reconnecting. */
  disconnect() {
    this._shouldConnect = false;
    this._clearReconnectTimer();
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
  }

  /** Register a listener for incoming messages. Returns unsubscribe fn. */
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /** Send a message if connected */
  send(data) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
  }

  get isConnected() {
    return this._ws?.readyState === WebSocket.OPEN;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  async _getToken() {
    try { return await AsyncStorage.getItem(AUTH_TOKEN_KEY); }
    catch { return null; }
  }

  async _open() {
    if (!this._shouldConnect) return;
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) return;

    const token = await this._getToken();
    if (!token) {
      console.warn('🔌 WebSocket: no token, will retry in 5s');
      this._scheduleReconnect(5000);
      return;
    }
    this._token = token;

    const url = `${WS_BASE}?token=${token}`;
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        this._retryDelay = 2000; 
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          this._dispatch(data);
        } catch {
          
        }
      };

      ws.onerror = (e) => {
        console.warn('🔌 WebSocket error:', e?.message || 'unknown');
      };

      ws.onclose = (e) => {
        this._ws = null;
        if (this._shouldConnect) {
          this._scheduleReconnect(this._retryDelay);
          this._retryDelay = Math.min(this._retryDelay * 2, this._maxDelay);
        }
      };
    } catch (e) {
      console.warn('🔌 WebSocket open failed:', e.message);
      this._scheduleReconnect(this._retryDelay);
    }
  }

  _dispatch(message) {
    for (const cb of this._listeners) {
      try { cb(message); } catch {}
    }
  }

  _scheduleReconnect(delay) {
    this._clearReconnectTimer();
    this._reconnectTimer = setTimeout(() => this._open(), delay);
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

// Singleton
export default new WebSocketService();
