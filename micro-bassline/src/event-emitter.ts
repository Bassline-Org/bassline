/**
 * Cross-platform EventEmitter
 * 
 * Provides a unified event emitter interface that works in both
 * Node.js and browser environments.
 */

export interface EventListener<T = any> {
  (event: T): void
}

export interface EventEmitterInterface {
  on(event: string, listener: EventListener): void
  off(event: string, listener: EventListener): void
  emit(event: string, data?: any): void
  addEventListener?(event: string, listener: EventListener): void
  removeEventListener?(event: string, listener: EventListener): void
  dispatchEvent?(event: Event): boolean
}

/**
 * Browser-compatible EventEmitter using EventTarget
 */
export class BrowserEventEmitter extends EventTarget implements EventEmitterInterface {
  on(event: string, listener: EventListener): void {
    this.addEventListener(event, listener as any)
  }
  
  off(event: string, listener: EventListener): void {
    this.removeEventListener(event, listener as any)
  }
  
  emit(event: string, data?: any): void {
    this.dispatchEvent(new CustomEvent(event, { detail: data }))
  }
}

/**
 * Node.js-compatible EventEmitter
 */
export class NodeEventEmitter implements EventEmitterInterface {
  private listeners = new Map<string, Set<EventListener>>()
  
  on(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }
  
  off(event: string, listener: EventListener): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(listener)
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }
  
  emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data)
        } catch (error) {
          console.error(`Error in event listener for '${event}':`, error)
          // Continue with other listeners
        }
      }
    }
  }
}

/**
 * Create an appropriate EventEmitter for the current environment
 */
export function createEventEmitter(): EventEmitterInterface {
  if (typeof EventTarget !== 'undefined') {
    // Browser environment
    return new BrowserEventEmitter()
  } else {
    // Node.js environment (or fallback)
    return new NodeEventEmitter()
  }
}

/**
 * Base class that can be extended for cross-platform event support
 */
export class CrossPlatformEventEmitter implements EventEmitterInterface {
  private emitter: EventEmitterInterface
  
  constructor() {
    this.emitter = createEventEmitter()
  }
  
  on(event: string, listener: EventListener): void {
    this.emitter.on(event, listener)
  }
  
  off(event: string, listener: EventListener): void {
    this.emitter.off(event, listener)
  }
  
  emit(event: string, data?: any): void {
    this.emitter.emit(event, data)
  }
  
  // For compatibility with EventTarget API
  addEventListener(event: string, listener: EventListener): void {
    this.on(event, listener)
  }
  
  removeEventListener(event: string, listener: EventListener): void {
    this.off(event, listener)
  }
  
  dispatchEvent(event: Event | { type: string; detail?: any }): boolean {
    if (event instanceof Event) {
      this.emit(event.type, (event as CustomEvent).detail)
    } else {
      this.emit(event.type, event.detail)
    }
    return true
  }
}