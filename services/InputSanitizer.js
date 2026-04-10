/**
 * InputSanitizer — DYUKSA
 * Centralised sanitization helpers for all user-facing text inputs.
 * Import and call before saving any user input to storage or sending to backend.
 */

// Strip dangerous characters, limit length
export const sanitizeText = (str, maxLength = 500) =>
  String(str ?? '')
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .slice(0, maxLength);

// Strict email: lowercase + trim only (format validated separately)
export const sanitizeEmail = (str) =>
  String(str ?? '').trim().toLowerCase().slice(0, 254);

// Name: allow letters, spaces, hyphens, apostrophes
export const sanitizeName = (str) =>
  String(str ?? '')
    .trim()
    .replace(/[^a-zA-Z\s\-'\.]/g, '')
    .slice(0, 100);

// Short label (project name, task name, doc name)
export const sanitizeLabel = (str) =>
  sanitizeText(str, 200);

// Description / body text — longer limit
export const sanitizeBody = (str) =>
  sanitizeText(str, 2000);

// Date string — only allow digits, colons, spaces, slashes, commas, AM/PM
export const sanitizeDate = (str) =>
  String(str ?? '')
    .trim()
    .replace(/[^0-9:/,\s\-APMapm]/g, '')
    .slice(0, 50);

// Numeric — strip everything except digits and decimal point
export const sanitizeNumber = (str) =>
  String(str ?? '').replace(/[^0-9.]/g, '').slice(0, 20);

// Generic object sanitizer — recursively sanitizes all string fields
export const sanitizeObject = (obj, maxDepth = 3) => {
  if (maxDepth === 0 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeText(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) return obj.map(i => sanitizeObject(i, maxDepth - 1));
  if (typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = sanitizeObject(v, maxDepth - 1);
    }
    return result;
  }
  return obj;
};
