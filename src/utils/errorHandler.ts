/**
 * Centralized error handling utilities
 * Provides consistent error logging and user-friendly messages
 */

export interface AppError {
  message: string;
  code?: string;
  context?: string;
  originalError?: unknown;
}

/**
 * Log and handle errors with context
 * @param err The error to handle
 * @param context The context where the error occurred (for logging)
 * @returns User-friendly error message
 */
export const handleError = (err: unknown, context: string): AppError => {
  console.error(`[${context}]`, err);

  let message = 'Unknown error occurred';
  let code = 'UNKNOWN';

  if (err instanceof Error) {
    message = err.message;
    code = err.name;
  } else if (typeof err === 'string') {
    message = err;
  } else if (typeof err === 'object' && err !== null) {
    const errorObj = err as any;
    message = errorObj.message || errorObj.error_description || JSON.stringify(err);
    code = errorObj.code || errorObj.status || 'UNKNOWN';
  }

  return {
    message,
    code,
    context,
    originalError: err,
  };
};

/**
 * Get a user-friendly error message
 * @param err The error
 * @param context Optional context for logging
 * @returns User-friendly message
 */
export const getUserFriendlyError = (err: unknown, context?: string): string => {
  if (context) {
    const appErr = handleError(err, context);
    return formatErrorMessage(appErr);
  }

  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
};

/**
 * Format an AppError for display
 */
export const formatErrorMessage = (error: AppError): string => {
  const messages: Record<string, string> = {
    'INVALID_CREDENTIALS': 'Invalid email or password',
    'EMAIL_NOT_CONFIRMED': 'Please verify your email address',
    'WEAK_PASSWORD': 'Password is too weak',
    'USER_ALREADY_EXISTS': 'This email is already registered',
    'RESOURCE_NOT_FOUND': 'The requested resource was not found',
    'PERMISSION_DENIED': 'You do not have permission to access this resource',
    'NETWORK_ERROR': 'Network connection failed. Please try again',
    'VALIDATION_ERROR': 'Please check your input and try again',
  };

  return messages[error.code || ''] || error.message || 'An error occurred';
};

/**
 * Safe JSON parsing with fallback
 */
export const safeJSONParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    console.warn(`Failed to parse JSON:`, err);
    return fallback;
  }
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Safe localStorage operations
 */
export const safeLocalStorage = {
  getItem: (key: string, fallback: string | null = null): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn(`Failed to read from localStorage: ${key}`, err);
      return fallback;
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.warn(`Failed to write to localStorage: ${key}`, err);
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.warn(`Failed to remove from localStorage: ${key}`, err);
      return false;
    }
  },
};
