/**
 * A resource function — receives a message, dispatches to get/put.
 */
export type ResourceFn = (msg: unknown) => unknown;

/**
 * Base resource class. Subclass to define get/put behavior.
 */
export declare class Resource {
  platform: Platform;
  get utils(): typeof import('./utils.js').default;
  accept(visitor: Record<string, Function>): unknown;
  announce(type: string, data?: Record<string, unknown>): void;
  dispatch(msg: unknown): unknown;
  get(msg: unknown): unknown;
  put(body: unknown, headers: unknown): unknown;
  static forPlatform(platform: Platform): typeof Resource;
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
  on(topic: string, callback: (detail: unknown) => void): () => void;

  /** Subscribe to a platform event, firing only once. */
  once(topic: string, callback: (detail: unknown) => void): this;

  /** Register resource classes on the platform. */
  define(classes: Record<string, typeof Resource>): this;
}

export declare function platform(): Platform;
