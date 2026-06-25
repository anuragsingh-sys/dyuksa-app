// ─────────────────────────────────────────────────────────────────────────────
// config.js — Central configuration
// Change the IP here and it updates everywhere in the app
// ─────────────────────────────────────────────────────────────────────────────

const IP       = '192.168.1.6';
const PORT     = '8000';  // Django backend port
const WEB_PORT = '3001';  // Frontend web app port (React/Next.js)

export const BASE_URL   = `http://${IP}:${PORT}/api/v1`;    // REST API base (includes /api/v1)
export const API_BASE   = `http://${IP}:${PORT}`;           // Full host only (no /api/v1)
export const WS_BASE    = `ws://${IP}:${PORT}/ws/gateway/`; // WebSocket
export const MEDIA_BASE = `http://${IP}:${PORT}`;           // Media / file URLs
export const WEB_BASE   = `http://${IP}:${WEB_PORT}`;       // Web app (public share links)

export default { BASE_URL, API_BASE, WS_BASE, MEDIA_BASE, WEB_BASE };
