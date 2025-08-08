/**
 * Custom error classes for Bassline
 * Provides structured error handling with proper context
 */

export class BasslineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = 'BasslineError'
    // Maintains proper stack trace for where our error was thrown (only works in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BasslineError)
    }
  }
}

export class StorageError extends BasslineError {
  constructor(message: string, operation: string, context?: Record<string, any>) {
    super(message, `STORAGE_${operation.toUpperCase()}_ERROR`, context)
    this.name = 'StorageError'
  }
}

export class NetworkError extends BasslineError {
  constructor(message: string, operation: string, context?: Record<string, any>) {
    super(message, `NETWORK_${operation.toUpperCase()}_ERROR`, context)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends BasslineError {
  constructor(message: string, field: string, value?: any) {
    super(message, 'VALIDATION_ERROR', { field, value })
    this.name = 'ValidationError'
  }
}

export class DatabaseError extends StorageError {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly params?: any[],
    public readonly originalError?: Error
  ) {
    super(message, 'DATABASE', { query, params, originalError: originalError?.message })
    this.name = 'DatabaseError'
  }
}

export class ConnectionError extends NetworkError {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly originalError?: Error
  ) {
    super(message, 'CONNECTION', { endpoint, originalError: originalError?.message })
    this.name = 'ConnectionError'
  }
}

export class TimeoutError extends BasslineError {
  constructor(message: string, timeoutMs: number, operation: string) {
    super(message, 'TIMEOUT_ERROR', { timeoutMs, operation })
    this.name = 'TimeoutError'
  }
}

/**
 * Type guard to check if an error is a BasslineError
 */
export function isBasslineError(error: unknown): error is BasslineError {
  return error instanceof BasslineError
}

/**
 * Type guard to check if an error is a StorageError
 */
export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError
}

/**
 * Helper to ensure we have an Error object
 */
export function ensureError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  if (typeof error === 'string') {
    return new Error(error)
  }
  return new Error(String(error))
}

/**
 * Helper to wrap unknown errors in BasslineError
 */
export function wrapError(error: unknown, code: string, context?: Record<string, any>): BasslineError {
  const err = ensureError(error)
  if (isBasslineError(err)) {
    return err
  }
  return new BasslineError(err.message, code, { ...context, originalError: err.message })
}