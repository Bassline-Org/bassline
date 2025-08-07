// Utility functions for core types

import type { Lazy, MaybeLazy, Result } from './types'

// ============================================================================
// Lazy Evaluation
// ============================================================================

/**
 * Resolve a value that may be lazy
 */
export function resolve<T>(value: MaybeLazy<T>): T {
  return typeof value === 'function' ? (value as Lazy<T>)() : value
}

/**
 * Create a lazy value
 */
export function lazy<T>(fn: () => T): Lazy<T> {
  return fn
}

/**
 * Memoize a lazy value (compute once, cache result)
 */
export function memoize<T>(fn: Lazy<T>): Lazy<T> {
  let cached: { value: T } | undefined
  return () => {
    if (!cached) {
      cached = { value: fn() }
    }
    return cached.value
  }
}

// ============================================================================
// Result Type Helpers
// ============================================================================

/**
 * Create a successful result
 */
export function ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value }
}

/**
 * Create a failed result
 */
export function err<T, E = Error>(error: E): Result<T, E> {
  return { ok: false, error }
}

/**
 * Check if a result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok
}

/**
 * Check if a result is an error
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok
}

/**
 * Map over a successful result
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result
}

/**
 * Chain results together
 */
export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return result.ok ? fn(result.value) : result
}

/**
 * Convert a throwing function to a Result-returning function
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn())
  } catch (error) {
    return err(mapError ? mapError(error) : error as E)
  }
}

/**
 * Convert an async throwing function to a Result-returning function
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await fn())
  } catch (error) {
    return err(mapError ? mapError(error) : error as E)
  }
}

// ============================================================================
// Functional Composition
// ============================================================================

/**
 * Pipe functions together (left to right)
 */
export function pipe<T>(...fns: Array<(arg: any) => any>) {
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value)
}

/**
 * Compose functions together (right to left)
 */
export function compose<T>(...fns: Array<(arg: any) => any>) {
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value)
}

/**
 * Partially apply a function
 */
export function partial<T extends (...args: any[]) => any>(
  fn: T,
  ...presetArgs: Parameters<T>
) {
  return (...laterArgs: any[]) => fn(...presetArgs, ...laterArgs)
}

/**
 * Curry a function
 */
export function curry<T extends (...args: any[]) => any>(fn: T): any {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args)
    }
    return (...nextArgs: any[]) => curried(...args, ...nextArgs)
  }
}