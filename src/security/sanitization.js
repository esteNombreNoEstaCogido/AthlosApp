/**
 * INPUT SANITIZATION MODULE
 * Protects against XSS, injection, and malformed input
 * 
 * Strategy:
 * 1. Type checking (ensure strings)
 * 2. Length limiting
 * 3. HTML entity escaping (XSS prevention)
 * 4. URL validation (whitelist protocols)
 * 5. Pattern matching (allow safe characters)
 */

/**
 * Sanitize general text input
 * Escapes HTML entities, limits length
 * @param {string} str - Raw input
 * @param {number} maxLen - Max length (default 200)
 * @returns {string} - Sanitized text
 */
export const sanitizeInput = (str, maxLen = 200) => {
  if (typeof str !== 'string') return '';
  
  // Limit length
  const limited = str.slice(0, maxLen);
  
  // Escape HTML entities to prevent XSS
  const escaped = limited.replace(/[<>\"'&]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;',
  }[c] || ''));
  
  return escaped;
};

/**
 * Sanitize URLs with strict protocol whitelist
 * 🔴 BLOCKS: data: URIs, javascript:, vbscript:, etc.
 * ✅ ALLOWS: http://, https://, /path (relative)
 * @param {string} url - Raw URL
 * @returns {string} - Sanitized URL or empty string
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // ✅ WHITELIST: Only allow safe protocols
  const isSafeUrl = 
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/');
  
  if (!isSafeUrl) {
    console.warn(`⚠️ Blocked unsafe URL: ${trimmed.substring(0, 30)}...`);
    return '';
  }
  
  // Validate URL format for http(s)
  if (trimmed.startsWith('http')) {
    try {
      new URL(trimmed);
      return trimmed;
    } catch (e) {
      console.warn(`⚠️ Invalid URL format: ${trimmed}`);
      return '';
    }
  }
  
  // Relative paths: just ensure no backslashes or double slashes
  if (trimmed.includes('\\') || trimmed.includes('//')) {
    console.warn(`⚠️ Blocked suspicious relative path: ${trimmed}`);
    return '';
  }
  
  return trimmed;
};

/**
 * Sanitize exercise/client names
 * Allows letters, numbers, spaces, hyphens
 * @param {string} str - Raw name
 * @param {number} maxLen - Max length
 * @returns {string} - Sanitized name
 */
export const sanitizeName = (str, maxLen = 100) => {
  if (typeof str !== 'string') return '';
  
  // Remove any HTML entities first
  const clean = str.replace(/[<>\"'&]/g, '');
  
  // Limit length
  const limited = clean.slice(0, maxLen).trim();
  
  return limited;
};

/**
 * Sanitize multi-line text (for notes)
 * Escapes HTML, allows newlines, limits length
 * @param {string} str - Raw text
 * @param {number} maxLen - Max length (default 1000)
 * @returns {string} - Sanitized text
 */
export const sanitizeMultilineText = (str, maxLen = 1000) => {
  if (typeof str !== 'string') return '';
  
  // Limit length first
  const limited = str.slice(0, maxLen);
  
  // Escape HTML entities (but preserve newlines)
  const escaped = limited.replace(/[<>\"'&]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;',
  }[c] || ''));
  
  // Remove excessive newlines (max 10)
  const lines = escaped.split('\n');
  if (lines.length > 10) {
    console.warn(`⚠️ Removed excessive newlines (${lines.length} > 10)`);
    return lines.slice(0, 10).join('\n');
  }
  
  return escaped;
};

/**
 * Sanitize Tailwind color class string
 * Format: "from-COLOR-NUM to-COLOR-NUM"
 * @param {string} str - Raw color string
 * @returns {string} - Sanitized or default color
 */
export const sanitizeColor = (str) => {
  if (typeof str !== 'string') return 'from-blue-600 to-indigo-500';
  
  const trimmed = str.trim();
  
  // Validate Tailwind color format
  const isValid = /^from-[a-z]+-\d+ to-[a-z]+-\d+$/.test(trimmed);
  
  if (!isValid) {
    console.warn(`⚠️ Invalid color format: ${trimmed}`);
    return 'from-blue-600 to-indigo-500'; // Safe default
  }
  
  return trimmed;
};

/**
 * Safe JSON parse with error handling
 * @param {string} key - localStorage key
 * @param {*} fallback - Default if parse fails
 * @returns {*} - Parsed value or fallback
 */
export const safeJSONParse = (key, fallback = null) => {
  try {
    const item = localStorage.getItem(key);
    if (item && item !== 'undefined') {
      return JSON.parse(item);
    }
  } catch (e) {
    console.warn(`⚠️ JSON parse error for key "${key}":`, e.message);
  }
  return fallback;
};

/**
 * Safe JSON stringify with error handling
 * @param {*} value - Value to stringify
 * @param {*} fallback - Default if stringify fails
 * @returns {string} - Stringified value or fallback
 */
export const safeJSONStringify = (value, fallback = '{}') => {
  try {
    return JSON.stringify(value);
  } catch (e) {
    console.warn(`⚠️ JSON stringify error:`, e.message);
    return fallback;
  }
};

/**
 * Sanitize object recursively
 * Applies sanitization to all string properties
 * @param {object} obj - Object to sanitize
 * @param {function} sanitizer - Sanitization function to apply
 * @returns {object} - Sanitized object
 */
export const sanitizeObject = (obj, sanitizer = sanitizeInput) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, sanitizer));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizer(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, sanitizer);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

export default {
  sanitizeInput,
  sanitizeUrl,
  sanitizeName,
  sanitizeMultilineText,
  sanitizeColor,
  safeJSONParse,
  safeJSONStringify,
  sanitizeObject,
};
