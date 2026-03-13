/**
 * A resource function — receives a message, dispatches through grammar to backend.
 */
export type ResourceFn = (msg?: unknown) => unknown;

/** Well-known symbol for resource identity. */
export declare const kResource: unique symbol;

// --- Grammar Layer ---

/**
 * Grammar base class. Parses messages into backend algebra calls.
 */
export declare class Grammar {
  dispatch(msg: unknown, impl: unknown): unknown;
  static parsePath(path: string | string[]): string[];
  static isPlainObject(obj: unknown): boolean;
}

/**
 * Thrown when a grammar cannot recognize a message.
 */
export declare class DoesNotUnderstandError extends Error {
  msg: unknown;
  constructor(msg: unknown);
}

/**
 * Chains multiple grammars. First match wins.
 */
export declare class ComposedGrammar extends Grammar {
  constructor(...grammars: Grammar[]);
}

/**
 * Fallback backend composition — first backend with the method handles it.
 */
export declare function fallback(...backends: object[]): object;

/**
 * Broadcast backend composition — all backends handle it, return last result.
 */
export declare function broadcast(...backends: object[]): object;

// --- Connect ---

/**
 * Wire a grammar to a backend, producing a resource function.
 */
export declare function connect(grammar: Grammar, impl: object): ResourceFn;

// --- EventBus ---

export declare class EventBusGrammar extends Grammar {}

export declare class EventBus {
  publish(event: { type: string; [key: string]: unknown }): void;
  subscribe(topic: string, callback: (data: unknown) => void): () => void;
  topics(): string[];
}

// --- Slot ---

export declare class SlotGrammar extends Grammar {
  constructor(events?: ResourceFn);
}

export declare class Slot {
  value: unknown;
  reduce: (prev: unknown, curr: unknown) => unknown;
  constructor(options?: { value?: unknown; reduce?: (prev: unknown, curr: unknown) => unknown });
  read(): unknown;
  write(value: unknown): unknown;
  accept(visitor: Record<string, Function>): unknown;
}

export declare class Max extends Slot {
  constructor(options?: { value?: number; reduce?: (prev: number, curr: number) => number });
}

export declare class Min extends Slot {
  constructor(options?: { value?: number; reduce?: (prev: number, curr: number) => number });
}

export declare class Union extends Slot {
  constructor(options?: { value?: unknown });
}

// --- Scope ---

export declare class ScopeGrammar extends Grammar {
  constructor(events?: ResourceFn);
  dispatchRead(msg: unknown, impl: unknown): unknown;
  dispatchWrite(msg: unknown, impl: unknown): unknown;
  walk(path: string | string[], impl: unknown): unknown;
}

export declare class ExtendedScopeGrammar extends ScopeGrammar {
  constructor(events?: ResourceFn, createScope?: () => ResourceFn, reflectFn?: (thing: unknown) => ResourceMirror | null);
}

export declare class Scope {
  constructor(options?: {
    entries?: Record<string, unknown>;
    lookup?: (name: string) => ResourceFn | null;
    list?: () => string[];
  });
  resolve(name: string): ResourceFn;
  list(): string[];
  mount(name: string, child: ResourceFn, meta?: Record<string, unknown>): void;
  unmount(name: string): void;
  has(name: string): boolean;
  meta(name: string): Record<string, unknown> | null;
  accept(visitor: Record<string, Function>): unknown;
}

// --- Propagator ---

export declare class Propagator extends Scope {
  platform: Platform;
  constructor(options?: {
    cells?: Record<string, ResourceFn | null>;
    body?: (bindings: Record<string, ResourceFn>) => void;
  });
  readonly keys: Set<string>;
  shouldActivate(cells: Record<string, ResourceFn | null>): boolean;
  body(bindings: Record<string, ResourceFn>): void;
  onError(error: Error): void;
  run(): void;
  execute(): void;
  fire(): void;
  bindCell(name: string, value: ResourceFn, meta?: Record<string, unknown>): void;
  unbindCell(name: string): void;
}

// --- Gate ---

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
  allow(msg: unknown): void;
  forward(msg: unknown): unknown;
}

// --- Persistence ---

export interface StorageAdapter {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  list(): string[];
}

export declare function memoryStorage(): StorageAdapter;

export declare class PersistentSlot extends Slot {
  constructor(options: {
    storage: StorageAdapter;
    key: string;
    value?: unknown;
    reduce?: (prev: unknown, curr: unknown) => unknown;
  });
}

export declare class PersistentScope extends Scope {
  constructor(options: {
    storage: StorageAdapter;
    prefix?: string;
    lookup?: (name: string) => ResourceFn | null;
    list?: () => string[];
  });
}

// --- Resource (backward compat) ---

/**
 * Backward-compatible Resource base class.
 * Use for custom resource types that use dispatch()/get()/put() pattern.
 */
export declare class Resource {
  platform: Platform;
  [kResource]: Resource;
  get utils(): object;
  accept(visitor: Record<string, Function>): unknown;
  dispatch(msg: unknown): unknown;
  get(msg: unknown): unknown;
  put(body: unknown, headers: unknown): unknown;
}

/**
 * Mirror — reflective interface for a resource backend.
 */
export declare class ResourceMirror {
  constructor(impl: unknown);
  [kResource]: unknown;
  getClass(): Function;
  isScope(platform?: Platform): boolean;
  isWritable(platform?: Platform): boolean;
  accept(visitor: Record<string, Function>): unknown;
}

// --- Deploy ---

export interface DeployScript {
  (platform: Platform): void | Promise<void>;
  tags?: string[];
  dependencies?: string[];
  id?: string;
  skip?: (platform: Platform) => boolean | Promise<boolean>;
}

export type Module = (platform: Platform) => void;

// --- Platform ---

export declare class Platform {
  utils: object;
  classes: Record<string, Function>;
  grammars: Record<string, Grammar | ((platform: Platform) => Grammar)>;

  readonly events: ResourceFn;
  readonly root: ResourceFn;

  reflect(thing: unknown): ResourceMirror | null;
  connect(grammar: Grammar, impl: object): ResourceFn;
  resource(aResource: Resource): ResourceFn;
  define(classes?: Record<string, Function>, grammars?: Record<string, Grammar | ((platform: Platform) => Grammar)>): this;
  create: Record<string, (init?: unknown) => ResourceFn>;
  announce(topic: string, data?: Record<string, unknown>): this;
  on(topic: string, callback: (detail: unknown) => void): () => void;
  once(topic: string, callback: (detail: unknown) => void): this;
  use(...modules: Module[]): this;
  deploy(...scripts: DeployScript[]): Promise<this>;

  /** Available after persistence module is loaded. */
  memoryStorage: typeof memoryStorage;

  /** Garage class, available after garage module is loaded. */
  Garage: typeof Garage;

  /** Link runtime, available after link module is loaded. */
  link: {
    open(opts: {
      transport: Transport;
      localScope?: ResourceFn;
    }): LinkHandle;
  };

  /** Managed client runtime, available after client module is loaded. */
  client: {
    ManagedConnection: typeof ManagedConnection;
  };

  /** WebSocket runtime, available after ws module is loaded. */
  ws: {
    serve(opts: { port: number; localScope?: ResourceFn }): {
      wss: unknown;
      close(): Promise<void>;
    };
    connect(opts: { url: string; localScope?: ResourceFn }): Promise<LinkHandle>;
  };
}

export declare function platform(): Platform;

// --- Garage ---

export declare class Garage {
  park(value: unknown): string;
  mint(ticket: string): string;
  resolve(token: string): unknown;
  redeem(ticket: string): unknown;
  has(token: string): boolean;
}

// --- Link ---

export type LinkErrorCode =
  | 'E_PROTOCOL'
  | 'E_TARGET'
  | 'E_CLOSED'
  | 'E_INTERNAL'
  | 'E_TIMEOUT';

export type ClientErrorCode = LinkErrorCode | 'E_ABORT';

export interface LinkErrorPayload {
  code: LinkErrorCode | string;
  message: string;
}

export interface ClientErrorPayload {
  code: ClientErrorCode | string;
  message: string;
  source: 'client' | 'link';
}

export interface LinkRequestEnvelope {
  v: number;
  id: string;
  op: 'REQUEST';
  msg: unknown;
  targetRef?: string;
}

export interface LinkResponseEnvelopeSuccess {
  v: number;
  id: string;
  op: 'RESPONSE';
  ok: true;
  result: unknown;
}

export interface LinkResponseEnvelopeError {
  v: number;
  id: string;
  op: 'RESPONSE';
  ok: false;
  error: LinkErrorPayload;
}

export type LinkEnvelope =
  | LinkRequestEnvelope
  | LinkResponseEnvelopeSuccess
  | LinkResponseEnvelopeError;

export interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ReconnectOptions {
  maxAttempts?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitterRatio?: number;
}

export interface HeartbeatOptions {
  idleMs?: number;
  timeoutMs?: number;
  probeMessage?: unknown;
}

export interface ManagedConnectionOptions {
  connect: () => Promise<LinkHandle>;
  defaultTimeoutMs?: number;
  reconnect?: ReconnectOptions;
  heartbeat?: HeartbeatOptions;
}

export declare class ManagedConnection {
  constructor(options: ManagedConnectionOptions);
  send(msg: unknown, opts?: RequestOptions): Promise<unknown>;
  close(): Promise<void>;
  readonly connected: boolean;
  readonly closed: boolean;
}

export interface Transport {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  close(): void;
  onClose(cb: () => void): void;
}

export interface LinkHandle {
  localScope: ResourceFn;
  remoteScope: ResourceFn;
  close(): void;
  readonly closed: boolean;
}

export declare function memoryTransport(): { a: Transport; b: Transport };

/**
 * Wrap a WebSocket into a Transport.
 */
export declare function wsTransport(ws: WebSocket): Transport;
