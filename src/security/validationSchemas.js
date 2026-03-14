import Ajv from 'ajv';

/**
 * JSON SCHEMA VALIDATION MODULE
 * Uses AJV for comprehensive input validation
 * Protects against injection, type mismatches, and malformed data
 */

const ajv = new Ajv({
  removeAdditional: false,
  strict: false,
  coerceTypes: false,
});

// ==========================================
// SCHEMA DEFINITIONS
// ==========================================

/**
 * User document schema
 * Defines valid structure for user records
 */
const UserSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 50,
      pattern: '^[a-zA-Z0-9_-]+$', // Alphanumeric, underscore, hyphen only
    },
    password: {
      type: 'string',
      minLength: 20, // bcryptjs hash always > 20 chars
      maxLength: 100,
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
    },
    color: {
      type: 'string',
      pattern: '^from-[a-z]+-[0-9]+ to-[a-z]+-[0-9]+$', // Tailwind color format
    },
    subtitle: {
      type: 'string',
      maxLength: 200,
    },
    advice: {
      type: 'string',
      maxLength: 500,
    },
    logs: {
      type: 'object',
    },
    notes: {
      type: 'array',
    },
    workoutData: {
      type: 'object',
      properties: {
        days: {
          type: 'array',
        },
      },
    },
  },
  required: ['username', 'password', 'name'],
};

/**
 * Workout Log Entry schema
 * Single exercise log with weight/reps
 */
const WorkoutLogSchema = {
  type: 'object',
  properties: {
    weight: {
      type: ['number', 'string'],
      minimum: 0,
      maximum: 500, // Absolute max reasonable weight
    },
    reps: {
      type: ['number', 'string'],
      minimum: 1,
      maximum: 100, // Absolute max reps
    },
    date: {
      type: 'string',
      pattern: '^[0-9]{1,2}/[0-9]{1,2}$', // DD/MM format
    },
    id: {
      type: 'number',
    },
  },
  required: ['weight', 'reps'],
};

/**
 * Client/Day Training Data schema
 */
const TrainingDaySchema = {
  type: 'object',
  properties: {
    id: {
      type: 'number',
    },
    title: {
      type: 'string',
      maxLength: 200,
    },
    focus: {
      type: 'string',
      maxLength: 100,
    },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
          },
          s: {
            type: ['number', 'string'],
            minimum: 1,
            maximum: 10,
          },
          r: {
            type: 'string',
            maxLength: 50,
          },
          tip: {
            type: 'string',
            maxLength: 200,
          },
          mus: {
            type: 'string',
            maxLength: 50,
          },
          img: {
            type: 'string', // URL
            maxLength: 500,
          },
          yt: {
            type: 'string', // URL
            maxLength: 500,
          },
        },
        required: ['name'],
      },
    },
  },
  required: ['title'],
};

/**
 * Client Note schema
 */
const NoteSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      minLength: 1,
      maxLength: 1000,
    },
    date: {
      type: 'string',
      pattern: '^[0-9]{1,2}/[0-9]{1,2}$',
    },
    id: {
      type: 'number',
    },
  },
  required: ['text', 'date'],
};

// ==========================================
// VALIDATORS (Compiled)
// ==========================================

export const validateUser = ajv.compile(UserSchema);
export const validateWorkoutLog = ajv.compile(WorkoutLogSchema);
export const validateTrainingDay = ajv.compile(TrainingDaySchema);
export const validateNote = ajv.compile(NoteSchema);

// ==========================================
// VALIDATION HELPER FUNCTIONS
// ==========================================

/**
 * Validate user data before storing
 * @param {object} userData - User object to validate
 * @returns {object} { valid, errors }
 */
export const validateUserData = (userData) => {
  const valid = validateUser(userData);
  return {
    valid,
    errors: valid ? [] : validateUser.errors,
  };
};

/**
 * Validate workout log entry
 * @param {object} logData - { weight, reps, date, id }
 * @returns {object} { valid, errors }
 */
export const validateWorkoutLogData = (logData) => {
  // Ensure weight and reps are numbers
  const normalized = {
    ...logData,
    weight: parseFloat(logData.weight),
    reps: parseInt(logData.reps),
  };

  const valid = validateWorkoutLog(normalized);
  return {
    valid,
    errors: valid ? [] : validateWorkoutLog.errors,
  };
};

/**
 * Validate training day structure
 * @param {object} dayData - Day object with exercises
 * @returns {object} { valid, errors }
 */
export const validateTrainingDayData = (dayData) => {
  const valid = validateTrainingDay(dayData);
  return {
    valid,
    errors: valid ? [] : validateTrainingDay.errors,
  };
};

/**
 * Validate note
 * @param {object} noteData - { text, date, id }
 * @returns {object} { valid, errors }
 */
export const validateNoteData = (noteData) => {
  const valid = validateNote(noteData);
  return {
    valid,
    errors: valid ? [] : validateNote.errors,
  };
};

/**
 * Safe parse number with validation
 * @param {string|number} value - Value to parse
 * @param {number} min - Minimum allowed
 * @param {number} max - Maximum allowed
 * @param {number} defaultVal - Default if invalid
 * @returns {number} - Validated number
 */
export const safeParseNumber = (value, min = 0, max = 999, defaultVal = 0) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num < min || num > max) return defaultVal;
  return num;
};

/**
 * Safe parse exercise series count
 * Range: 1-10 (reasonable training)
 */
export const safeParseSerries = (value) => {
  return safeParseNumber(value, 1, 10, 3);
};

/**
 * Safe parse reps count
 * Range: 1-100 (reasonable training)
 */
export const safeParseReps = (value) => {
  return safeParseNumber(value, 1, 100, 10);
};

/**
 * Safe parse weight (kg)
 * Range: 0-500 (even sumo wrestlers don't lift heavier)
 */
export const safeParseWeight = (value) => {
  return safeParseNumber(value, 0, 500, 0);
};

export default {
  validateUser,
  validateWorkoutLog,
  validateTrainingDay,
  validateNote,
  validateUserData,
  validateWorkoutLogData,
  validateTrainingDayData,
  validateNoteData,
  safeParseNumber,
  safeParseSerries,
  safeParseReps,
  safeParseWeight,
};
