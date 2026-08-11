import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

const IP           = extra.apiIp       || '';
const PORT         = extra.apiPort     || '8000';
const CENTRAL_PORT = extra.centralPort || '8001';
const WEB_PORT     = extra.webPort     || '3001';

export const BASE_URL      = `http://${IP}:${PORT}/api/v1`;
export const API_BASE      = `http://${IP}:${PORT}`;
export const CENTRAL_URL   = `http://${IP}:${CENTRAL_PORT}/api/v1`;
export const CENTRAL_BASE  = `http://${IP}:${CENTRAL_PORT}`;
export const WS_BASE       = `ws://${IP}:${PORT}/ws/gateway/`;
export const MEDIA_BASE    = `http://${IP}:${PORT}`;
export const WEB_BASE      = `http://${IP}:${WEB_PORT}`;
export const APP_ENV       = extra.env || 'local';
export const IS_DEV        = APP_ENV === 'local';
export const IS_PRODUCTION = APP_ENV === 'production';

export default { BASE_URL, API_BASE, CENTRAL_URL, CENTRAL_BASE, WS_BASE, MEDIA_BASE, WEB_BASE, APP_ENV, IS_DEV, IS_PRODUCTION };