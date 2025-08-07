// Fluent interfaces for utility types

import type { Result, Lazy, MaybeLazy } from './types'
import { ok, err } from './utils'

// ============================================================================
// Fluent Result Interface
// ============================================================================

export interface FluentResult<T, E = Error> {
  // Transform success value
  map<U>(fn: (value: T) => U): FluentResult<U, E>
  
  // Transform error
  mapErr<F>(fn: (error: E) => F): FluentResult<T, F>
  
  // Chain another result-returning operation
  andThen<U>(fn: (value: T) => FluentResult<U, E>): FluentResult<U, E>
  
  // Provide alternative for error case
  orElse<F>(fn: (error: E) => FluentResult<T, F>): FluentResult<T, F>
  
  // Get value or default
  unwrapOr(defaultValue: T): T
  
  // Get value or compute default from error
  unwrapOrElse(fn: (error: E) => T): T
  
  // Get value or throw
  unwrap(): T
  
  // Get error or throw
  unwrapErr(): E
  
  // Check if successful
  isOk(): boolean
  
  // Check if error
  isErr(): boolean
  
  // Convert to promise
  toPromise(): Promise<T>
  
  // Match on success or error
  match<U>(handlers: {
    ok: (value: T) => U
    err: (error: E) => U
  }): U
  
  // Side effects
  tap(fn: (value: T) => void): FluentResult<T, E>
  tapErr(fn: (error: E) => void): FluentResult<T, E>
  
  // Get the underlying Result
  toResult(): Result<T, E>
}

class FluentResultImpl<T, E = Error> implements FluentResult<T, E> {
  constructor(private readonly result: Result<T, E>) {}
  
  map<U>(fn: (value: T) => U): FluentResult<U, E> {
    return new FluentResultImpl(
      this.result.ok 
        ? ok(fn(this.result.value))
        : this.result
    )
  }
  
  mapErr<F>(fn: (error: E) => F): FluentResult<T, F> {
    return new FluentResultImpl(
      this.result.ok
        ? this.result
        : err(fn(this.result.error))
    )
  }
  
  andThen<U>(fn: (value: T) => FluentResult<U, E>): FluentResult<U, E> {
    return this.result.ok
      ? fn(this.result.value)
      : new FluentResultImpl(this.result)
  }
  
  orElse<F>(fn: (error: E) => FluentResult<T, F>): FluentResult<T, F> {
    return this.result.ok
      ? new FluentResultImpl(this.result)
      : fn(this.result.error)
  }
  
  unwrapOr(defaultValue: T): T {
    return this.result.ok ? this.result.value : defaultValue
  }
  
  unwrapOrElse(fn: (error: E) => T): T {
    return this.result.ok ? this.result.value : fn(this.result.error)
  }
  
  unwrap(): T {
    if (this.result.ok) {
      return this.result.value
    }
    throw new Error(`Called unwrap on an Err value: ${this.result.error}`)
  }
  
  unwrapErr(): E {
    if (!this.result.ok) {
      return this.result.error
    }
    throw new Error(`Called unwrapErr on an Ok value`)
  }
  
  isOk(): boolean {
    return this.result.ok
  }
  
  isErr(): boolean {
    return !this.result.ok
  }
  
  toPromise(): Promise<T> {
    return this.result.ok
      ? Promise.resolve(this.result.value)
      : Promise.reject(this.result.error)
  }
  
  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return this.result.ok
      ? handlers.ok(this.result.value)
      : handlers.err(this.result.error)
  }
  
  tap(fn: (value: T) => void): FluentResult<T, E> {
    if (this.result.ok) {
      fn(this.result.value)
    }
    return this
  }
  
  tapErr(fn: (error: E) => void): FluentResult<T, E> {
    if (!this.result.ok) {
      fn(this.result.error)
    }
    return this
  }
  
  toResult(): Result<T, E> {
    return this.result
  }
}

// ============================================================================
// Fluent Result Constructors
// ============================================================================

/**
 * Create a fluent result from a value
 */
export function result<T, E = Error>(value: T): FluentResult<T, E> {
  return new FluentResultImpl(ok(value))
}

/**
 * Create a fluent result from an error
 */
export function resultErr<T, E = Error>(error: E): FluentResult<T, E> {
  return new FluentResultImpl(err(error))
}

/**
 * Create a fluent result from a function that might throw
 */
export function resultTry<T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): FluentResult<T, E> {
  try {
    return result(fn())
  } catch (error) {
    return resultErr(mapError ? mapError(error) : error as E)
  }
}

/**
 * Create a fluent result from an async function that might throw
 */
export async function resultTryAsync<T, E = Error>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<FluentResult<T, E>> {
  try {
    return result(await fn())
  } catch (error) {
    return resultErr(mapError ? mapError(error) : error as E)
  }
}

/**
 * Collect an array of results into a single result
 */
export function resultAll<T, E>(
  results: FluentResult<T, E>[]
): FluentResult<T[], E> {
  const values: T[] = []
  
  for (const r of results) {
    if (r.isErr()) {
      return new FluentResultImpl(err(r.unwrapErr()))
    }
    values.push(r.unwrap())
  }
  
  return result(values)
}

// ============================================================================
// Fluent Lazy Interface
// ============================================================================

export interface FluentLazy<T> {
  // Transform the lazy value
  map<U>(fn: (value: T) => U): FluentLazy<U>
  
  // Chain another lazy computation
  flatMap<U>(fn: (value: T) => FluentLazy<U>): FluentLazy<U>
  
  // Combine with another lazy value
  zip<U>(other: FluentLazy<U>): FluentLazy<[T, U]>
  
  // Memoize the lazy value (compute once, cache result)
  memoize(): FluentLazy<T>
  
  // Add a side effect
  tap(fn: (value: T) => void): FluentLazy<T>
  
  // Force evaluation
  force(): T
  
  // Convert to Result (catching errors)
  toResult<E = Error>(mapError?: (error: unknown) => E): FluentResult<T, E>
  
  // Get the underlying lazy function
  toLazy(): Lazy<T>
}

class FluentLazyImpl<T> implements FluentLazy<T> {
  constructor(private readonly fn: Lazy<T>) {}
  
  map<U>(fn: (value: T) => U): FluentLazy<U> {
    return new FluentLazyImpl(() => fn(this.fn()))
  }
  
  flatMap<U>(fn: (value: T) => FluentLazy<U>): FluentLazy<U> {
    return new FluentLazyImpl(() => fn(this.fn()).force())
  }
  
  zip<U>(other: FluentLazy<U>): FluentLazy<[T, U]> {
    return new FluentLazyImpl(() => [this.fn(), other.force()])
  }
  
  memoize(): FluentLazy<T> {
    let cached: { value: T } | undefined
    return new FluentLazyImpl(() => {
      if (!cached) {
        cached = { value: this.fn() }
      }
      return cached.value
    })
  }
  
  tap(fn: (value: T) => void): FluentLazy<T> {
    return new FluentLazyImpl(() => {
      const value = this.fn()
      fn(value)
      return value
    })
  }
  
  force(): T {
    return this.fn()
  }
  
  toResult<E = Error>(mapError?: (error: unknown) => E): FluentResult<T, E> {
    return resultTry(() => this.fn(), mapError)
  }
  
  toLazy(): Lazy<T> {
    return this.fn
  }
}

// ============================================================================
// Fluent Lazy Constructors
// ============================================================================

/**
 * Create a fluent lazy value
 */
export function fluentLazy<T>(fn: () => T): FluentLazy<T> {
  return new FluentLazyImpl(fn)
}

/**
 * Create a fluent lazy value from a maybe-lazy value
 */
export function lazyFrom<T>(value: MaybeLazy<T>): FluentLazy<T> {
  return new FluentLazyImpl(
    typeof value === 'function' ? value as Lazy<T> : () => value
  )
}

/**
 * Create a lazy value that's already computed
 */
export function lazyValue<T>(value: T): FluentLazy<T> {
  return new FluentLazyImpl(() => value)
}

/**
 * Combine multiple lazy values
 */
export function lazyAll<T>(lazies: FluentLazy<T>[]): FluentLazy<T[]> {
  return new FluentLazyImpl(() => lazies.map(l => l.force()))
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
// Result usage
const value = resultTry(() => JSON.parse(input))
  .map(data => data.users)
  .map(users => users.filter(u => u.active))
  .mapErr(err => new ValidationError('Invalid JSON', err))
  .tap(users => console.log(`Found ${users.length} active users`))
  .unwrapOr([])

// Lazy usage  
const computation = fluentLazy(() => expensiveCalculation())
  .map(x => x * 2)
  .tap(x => console.log('Computed:', x))
  .memoize()
  
// Force evaluation when needed
const result = computation.force()

// Combine Result and Lazy
const safeLazy = fluentLazy(() => riskyOperation())
  .toResult()
  .map(x => x.toString())
  .unwrapOr('default')
*/