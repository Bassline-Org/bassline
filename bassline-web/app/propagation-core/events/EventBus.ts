/**
 * Simple event bus for the propagation system
 * No external dependencies
 */

export type EventHandler<T = any> = (event: T) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  emit(eventType: string, event: any): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}