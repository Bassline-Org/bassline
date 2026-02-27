/**
 * A resource function — receives a message, dispatches to get/put.
 */
export type ResourceFn = (msg: unknown) => unknown;

/** Well-known symbol for resource identity. */
export declare const kResource: unique symbol;

/**
 * Base resource class. Subclass to define get/put behavior.
 */
export declare class Resource {
  platform: Platform;
  [kResource]: Resource;
  get utils(): typeof import('./utils.js').default;
  accept(visitor: Record<string, Function>): unknown;
  announce(type: string, data?: Record<string, unknown>): void;
  dispatch(msg: unknown): unknown;
  get(msg: unknown): unknown;
  put(body: unknown, headers: unknown): unknown;
  static forPlatform(platform: Platform): typeof Resource;
}

/**
 * Mirror — reflective interface for a resource.
 */
export declare class ResourceMirror {
  constructor(resource: Resource);
  [kResource]: Resource;
  getClass(): typeof Resource;
  isScope(): boolean;
  isWritable(): boolean;
  accept(visitor: Record<string, Function>): unknown;
}

/**
 * Deploy script — a function that receives a platform and mounts resources.
 */
export interface DeployScript {
  (platform: Platform): void | Promise<void>;
  /** Tags this script provides (other scripts can depend on these). */
  tags?: string[];
  /** Tags this script requires (must be provided by earlier scripts). */
  dependencies?: string[];
  /** Unique ID for idempotent deployment (script runs at most once per ID). */
  id?: string;
  /** If returns true, skip this script. */
  skip?: (platform: Platform) => boolean | Promise<boolean>;
}

/**
 * Module — a function that extends the platform with new resource classes or capabilities.
 * Same shape as a deploy script: `(platform) => void`.
 */
export type Module = (platform: Platform) => void;

/**
 * The platform — provides classes, a root scope, events, and deployment.
 */
export declare class Platform {
  utils: typeof import('./utils.js').default;
  classes: Record<string, typeof Resource>;
  create: Record<string, (init?: unknown) => ResourceFn>;

  get root(): ResourceFn;

  /** Register modules that extend the platform. */
  use(...modules: Module[]): this;

  /** Deploy scripts into the platform. Topologically sorted by tags/dependencies. */
  deploy(...scripts: DeployScript[]): Promise<this>;

  /** Wrap a Resource instance into a callable resource function. */
  resource(r: Resource): ResourceFn;

  /** Emit a platform event. */
  announce(topic: string, message?: Record<string, unknown>): this;

  /** Subscribe to a platform event. Returns an unsubscribe function. */
  on(topic: string, callback: (detail: unknown) => void, opts?: AddEventListenerOptions): () => void;

  /** Subscribe to a platform event, firing only once. */
  once(topic: string, callback: (detail: unknown) => void): this;

  /** Register resource classes on the platform. */
  define(classes: Record<string, typeof Resource>): this;

  /** Get a mirror for a resource or resource function. */
  reflect(thing: unknown): ResourceMirror | null;

  /** Garage class, available after garage module is loaded. */
  Garage: typeof Garage;
}

/**
 * Scope — composite resource that maps names to child resources.
 */
export declare class Scope extends Resource {
  constructor(options?: {
    entries?: Record<string, unknown>;
    lookup?: (name: string) => ResourceFn | null;
    list?: () => string[];
  });
}

/**
 * Propagator — a reactive scope with a fixed keyspace.
 * Stateless: holds no state of its own, enforces relationships between resources.
 */
export declare class Propagator extends Scope {
  constructor(options?: {
    cells?: Record<string, ResourceFn | null>;
    body?: (bindings: Record<string, ResourceFn>) => void;
  });
  shouldActivate(cells: Record<string, ResourceFn | null>): boolean;
  body(bindings: Record<string, ResourceFn>): void;
  onError(error: Error): void;
  /** Schedule execution. Override for custom scheduling. */
  run(): void;
  /** Build bindings and call body. Override for custom execution logic. */
  execute(): void;
  fire(): void;
  readonly keys: Set<string>;
}

/**
 * Garage — parks values and issues serializable tokens.
 * Values with a [kResource] identity are deduplicated.
 */
export declare class Garage {
  park(value: unknown): string;
  mint(ticket: string): string;
  resolve(token: string): unknown;
  redeem(ticket: string): unknown;
  has(token: string): boolean;
}

/**
 * Transport — abstract send/receive interface for BSP sessions.
 */
export interface Transport {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  close(): void;
  onClose(cb: () => void): void;
}

/**
 * Session — BSP session over a transport. Extends Resource.
 *
 * Both peers create a Session. Both can send requests and serve requests.
 * Wire format: { T, msg } for requests, { R, msg } for responses,
 * { R, error } for error responses.
 */
export declare class Session extends Resource {
  constructor(opts: { transport: Transport; root?: ResourceFn | null });
  closed: boolean;
  readonly garage: Garage;
}

/**
 * Create an in-memory transport pair for testing.
 * Returns two symmetric endpoints. Close propagates to both.
 */
export declare function memoryTransport(): { a: Transport; b: Transport };

/**
 * GatedScope — wraps a scope and checks capabilities before forwarding.
 */
export declare class GatedScope extends Scope {
  constructor(options: {
    target: ResourceFn;
    capabilities?: {
      get?: boolean;
      put?: boolean;
      walk?: string[];
    };
    check?: (msg: unknown) => boolean | void;
  });
}

/**
 * Storage adapter interface for persistence.
 */
export interface StorageAdapter {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  list(): string[];
}

/**
 * PersistentSlot — Slot backed by a storage adapter.
 * Lazy loads on first read, persists on every write.
 */
export declare class PersistentSlot extends Slot {
  constructor(options: {
    storage: StorageAdapter;
    key: string;
    value?: unknown;
    reduce?: (prev: unknown, curr: unknown) => unknown;
  });
}

/**
 * PersistentScope — Scope backed by a storage adapter.
 * Persists child structure and restores from storage.
 */
export declare class PersistentScope extends Scope {
  constructor(options: {
    storage: StorageAdapter;
    prefix?: string;
    lookup?: (name: string) => ResourceFn | null;
    list?: () => string[];
  });
}

/**
 * Wrap a WebSocket into a Transport.
 * Works with both the `ws` library and the global WebSocket (Node 22+).
 */
export declare function wsTransport(ws: WebSocket): Transport;

export declare function platform(): Platform;
