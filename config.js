// ─────────────────────────────────────────────────────────────────────────────
// config.js — Central configuration
// Change the IP here and it updates everywhere in the app
// ─────────────────────────────────────────────────────────────────────────────

const IP   = '192.168.1.164';
const PORT = '8000';

export const BASE_URL   = `http://${IP}:${PORT}/api/v1`;    // REST API base
export const API_BASE   = `http://${IP}:${PORT}`;           // Full host
export const WS_BASE    = `ws://${IP}:${PORT}/ws/gateway/`; // WebSocket
export const MEDIA_BASE = `http://${IP}:${PORT}`;           // Media/files

export default { BASE_URL, API_BASE, WS_BASE, MEDIA_BASE };
