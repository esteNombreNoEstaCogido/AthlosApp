/**
 * JWT TOKEN MANAGEMENT MODULE
 * Secure session tokens with expiration
 * 
 * Implementation:
 * - JWT format: header.payload.signature
 * - Algorithm: HS256 (HMAC-SHA256)
 * - Expiration: 24 hours
 * - Signed with secret from process.env.REACT_APP_JWT_SECRET
 */

// ==========================================
// BASE64 UTILITIES
// ==========================================

const base64UrlEncode = (str) => {
  // Encode to UTF-8 then Base64
  const utf8 = unescape(encodeURIComponent(str));
  let binary = '';
  for (let i = 0; i < utf8.length; i++) {
    binary += String.fromCharCode(utf8.charCodeAt(i));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const base64UrlDecode = (str) => {
  // Add padding if needed
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Invalid base64url string');
  }

  try {
    return atob(output);
  } catch (err) {
    throw new Error('Failed to decode base64url: ' + err.message);
  }
};

// ==========================================
// HMAC-SHA256 (Web Crypto API)
// ==========================================

const hmacSha256 = async (message, secret) => {
  // Import secret as CryptoKey
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  // Convert ArrayBuffer to Base64URL
  let binary = '';
  const bytes = new Uint8Array(signature);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// ==========================================
// JWT GENERATION & VERIFICATION
// ==========================================

/**
 * Generate a signed JWT token
 * @param {string} userId - User identifier
 * @param {number} expiresInHours - Token expiration (default 24h)
 * @returns {Promise<string>} - JWT token
 */
export const generateToken = async (userId, expiresInHours = 24) => {
  const secret = process.env.REACT_APP_JWT_SECRET;

  if (!secret || secret.includes('your_')) {
    console.error('❌ ERROR: REACT_APP_JWT_SECRET not configured');
    throw new Error('JWT secret not configured');
  }

  // Header
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));

  // Payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId, // Subject (user ID)
    iat: now, // Issued at
    exp: now + expiresInHours * 3600, // Expiration
    iss: 'athlos-app', // Issuer
  };
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));

  // Signature
  const message = `${headerEncoded}.${payloadEncoded}`;
  const signature = await hmacSha256(message, secret);

  // Complete JWT
  const token = `${message}.${signature}`;
  return token;
};

/**
 * Verify and decode a JWT token
 * @param {string} token - QWToken to verify
 * @returns {Promise<object>} - { valid, decoded, error }
 */
export const verifyToken = async (token) => {
  const secret = process.env.REACT_APP_JWT_SECRET;

  if (!secret || secret.includes('your_')) {
    console.error('❌ ERROR: REACT_APP_JWT_SECRET not configured');
    return { valid: false, decoded: null, error: 'JWT secret not configured' };
  }

  try {
    // Split token
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, decoded: null, error: 'Invalid token format' };
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;

    // Verify signature
    const message = `${headerEncoded}.${payloadEncoded}`;
    const expectedSignature = await hmacSha256(message, secret);

    if (signatureEncoded !== expectedSignature) {
      return { valid: false, decoded: null, error: 'Invalid signature' };
    }

    // Decode payload
    const payloadJson = base64UrlDecode(payloadEncoded);
    const payload = JSON.parse(payloadJson);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, decoded: null, error: 'Token expired' };
    }

    return {
      valid: true,
      decoded: payload,
      error: null,
    };
  } catch (error) {
    console.error('Token verification error:', error.message);
    return { valid: false, decoded: null, error: error.message };
  }
};

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {Promise<boolean>} - True if expired
 */
export const isTokenExpired = async (token) => {
  const { decoded, error } = await verifyToken(token);
  if (error) return true; // Treat as expired if invalid
  if (!decoded || !decoded.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
};

/**
 * Store token in localStorage
 * @param {string} token - JWT token
 */
export const storeToken = (token) => {
  try {
    localStorage.setItem('athlos_token', token);
    localStorage.setItem('athlos_token_stored_at', new Date().toISOString());
  } catch (error) {
    console.error('Failed to store token:', error);
  }
};

/**
 * Retrieve token from localStorage
 * @returns {string|null} - JWT token or null
 */
export const getStoredToken = () => {
  try {
    return localStorage.getItem('athlos_token');
  } catch (error) {
    console.error('Failed to retrieve token:', error);
    return null;
  }
};

/**
 * Clear token from storage
 */
export const clearToken = () => {
  try {
    localStorage.removeItem('athlos_token');
    localStorage.removeItem('athlos_token_stored_at');
  } catch (error) {
    console.error('Failed to clear token:', error);
  }
};

/**
 * Get current user ID from token
 * @returns {Promise<string|null>} - User ID or null
 */
export const getCurrentUserId = async () => {
  const token = getStoredToken();
  if (!token) return null;

  const { valid, decoded } = await verifyToken(token);
  if (!valid || !decoded) return null;

  return decoded.sub;
};

export default {
  generateToken,
  verifyToken,
  isTokenExpired,
  storeToken,
  getStoredToken,
  clearToken,
  getCurrentUserId,
};
