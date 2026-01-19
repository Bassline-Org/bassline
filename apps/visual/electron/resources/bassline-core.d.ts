/**
 * Type declarations for @bassline/core
 *
 * These are loose types since the JavaScript implementation is permissive.
 */

declare module '@bassline/core' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFunction = (...args: any[]) => any

  export interface ResourceHandlers {
    get?: AnyFunction
    put?: AnyFunction
  }

  export interface Resource {
    get: AnyFunction
    put: AnyFunction
  }

  export function resource(handlers: ResourceHandlers): Resource
  export function routes(config: Record<string, Resource | AnyFunction>): Resource
  export function bind(name: string, resource: Resource): Resource
  export function splitPath(path: string): { segment: string; rest: string }
}
