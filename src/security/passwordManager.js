import bcryptjs from "bcryptjs";

/**
 * CRYPTO PASSWORD MANAGER
 * Uses bcryptjs for secure password hashing and verification
 * All passwords stored as bcrypt hashes (never plaintext)
 */

/**
 * Hash a plaintext password using bcryptjs
 * @param {string} plaintext - Raw password from user input
 * @returns {Promise<string>} - Bcryptjs hash (cost=12)
 */
export const hashPassword = async (plaintext) => {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Password must be a non-empty string");
  }

  try {
    // Cost factor 12 = ~250ms on modern hardware (balance speed/security)
    const salt = await bcryptjs.genSalt(12);
    const hash = await bcryptjs.hash(plaintext, salt);
    return hash;
  } catch (error) {
    if (import.meta.env.DEV) console.error("Hash error:", error.message);
    throw error;
  }
};

/**
 * Verify if plaintext password matches bcryptjs hash
 * @param {string} plaintext - Raw password from user input (login attempt)
 * @param {string} hash - Stored bcryptjs hash from database
 * @returns {Promise<boolean>} - True if match, false otherwise
 */
export const verifyPassword = async (plaintext, hash) => {
  if (!plaintext || !hash) {
    return false;
  }

  try {
    // bcryptjs.compare() handles all salt extraction internally
    const isMatch = await bcryptjs.compare(plaintext, hash);
    return isMatch;
  } catch (error) {
    if (import.meta.env.DEV) console.error("Verify error:", error.message);
    return false;
  }
};

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - No leading/trailing spaces
 * - Must contain at least one letter and one number
 * @param {string} password - Password to validate
 * @returns {boolean} - True if password meets requirements
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== "string") {
    return false;
  }
  if (password.length < 8 || /^\s|\s$/.test(password)) return false;
  // Must have at least one letter and one number
  return /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
};

/**
 * Generate pre-hashed password database for initial deployment
 * TEMPORARY FUNCTION - for generating hashes from plaintext
 * Use this ONE TIME to hash initial DB, then delete function
 * @param {string} plaintext - Password to hash
 * @returns {Promise<string>} - Hash to store in DB
 */
export const generateInitialHash = async (plaintext) => {
  return hashPassword(plaintext);
};

export default {
  hashPassword,
  verifyPassword,
  validatePassword,
};
