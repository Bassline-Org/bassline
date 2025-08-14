/**
 * MicroStream: Functional approach
 * 
 * Instead of a class, use a factory function that returns an object
 */

export interface Stream<T> {
  write(value: T): void
  pipe(target: Stream<T> | ((value: T) => void)): Stream<T>
  filter(predicate: (value: T) => boolean): Stream<T>
  transform<U>(fn: (value: T) => U | Promise<U>): Stream<U>
  transformAsync<U>(fn: (value: T) => Promise<U>): Stream<U>
  subscribe(handler: (value: T) => void): () => void
  tee(): [Stream<T>, Stream<T>]
}

/**
 * Create a stream
 */
export function stream<T>(): Stream<T> {
  const sinks = new Set<(value: T) => void>()
  
  const write = (value: T): void => {
    for (const sink of sinks) {
      sink(value)
    }
  }
  
  const pipe = (target: Stream<T> | ((value: T) => void)): Stream<T> => {
    if (typeof target === 'function') {
      sinks.add(target)
    } else {
      sinks.add(value => target.write(value))
    }
    return self
  }
  
  const filter = (predicate: (value: T) => boolean): Stream<T> => {
    const output = stream<T>()
    pipe(value => {
      if (predicate(value)) output.write(value)
    })
    return output
  }
  
  const transform = <U>(fn: (value: T) => U | Promise<U>): Stream<U> => {
    const output = stream<U>()
    pipe(value => {
      const result = fn(value)
      if (result instanceof Promise) {
        // For promises, write the resolved value to output
        result.then(
          resolved => {
            if (resolved != null) output.write(resolved)
          },
          err => console.error('Transform error:', err)
        )
      } else {
        // For sync values, write immediately
        if (result != null) output.write(result)
      }
    })
    return output
  }
  
  const transformAsync = <U>(fn: (value: T) => Promise<U>): Stream<U> => {
    const output = stream<U>()
    pipe(value => {
      fn(value).then(
        result => {
          if (result != null) output.write(result)
        },
        err => console.error('Async transform error:', err)
      )
    })
    return output
  }
  
  const subscribe = (handler: (value: T) => void): (() => void) => {
    sinks.add(handler)
    return () => sinks.delete(handler)
  }
  
  const tee = (): [Stream<T>, Stream<T>] => {
    const a = stream<T>()
    const b = stream<T>()
    pipe(value => {
      a.write(value)
      b.write(value)
    })
    return [a, b]
  }
  
  const self: Stream<T> = { write, pipe, filter, transform, transformAsync, subscribe, tee }
  return self
}

/**
 * Merge multiple streams
 */
export const merge = <T>(...streams: Stream<T>[]): Stream<T> => {
  const output = stream<T>()
  for (const s of streams) {
    s.pipe(output)
  }
  return output
}

/**
 * Guards as simple functions
 */
export const guards = {
  hasInputs: (...keys: string[]) => (value: any): boolean =>
    !!(value && typeof value === 'object' && keys.every(k => value[k] != null)),
  
  hasTypes: (types: Record<string, string>) => (value: any): boolean =>
    !!(value && typeof value === 'object' && 
    Object.entries(types).every(([k, t]) => value[k] == null || typeof value[k] === t)),
  
  isFinite: (...keys: string[]) => (value: any): boolean =>
    !!(value && typeof value === 'object' && 
    keys.every(k => value[k] == null || Number.isFinite(value[k]))),
  
  all: <T>(...guards: Array<(value: T) => boolean>) => (value: T): boolean =>
    guards.every(g => g(value)),
  
  any: <T>(...guards: Array<(value: T) => boolean>) => (value: T): boolean =>
    guards.some(g => g(value))
}