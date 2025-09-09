/**
 * Semantic pool for message-based routing
 * 
 * Unlike the original pool that mutates gadget connections,
 * this pool routes messages based on semantic declarations.
 */

import { protocol, Gadget } from "./core";
import { cell, Action } from "./patterns";
import { Message } from "./message";

/**
 * Semantic declaration for what a gadget provides or needs
 */
export interface Declaration {
  gadgetId: string;
  type: 'provides' | 'needs';
  tags: string[];  // Can provide/need multiple tags
  gadget?: Gadget<Message>;
}

/**
 * Route established between provider and consumer
 */
export interface Route {
  tag: string;
  from: string;  // Provider ID
  to: string;    // Consumer ID
  provider?: Gadget<Message>;
  consumer?: Gadget<Message>;
}

/**
 * Pool state for semantic routing
 */
export interface SemanticPoolState {
  providers: Map<string, Set<Declaration>>;  // tag -> providers
  consumers: Map<string, Set<Declaration>>;  // tag -> consumers
  routes: Map<string, Route[]>;              // tag -> active routes
  gadgets: Map<string, Gadget<Message>>;     // id -> gadget reference
}

/**
 * Create a semantic pool that routes messages
 * 
 * Instead of mutating gadgets, it acts as a message router
 * that forwards messages based on semantic tags.
 */
export function semanticPool<G extends Gadget<Message | Declaration> = Gadget<Message | Declaration>>(): 
  (this: G, data: Message | Declaration) => void {
  
  const state: SemanticPoolState = {
    providers: new Map(),
    consumers: new Map(),
    routes: new Map(),
    gadgets: new Map()
  };
  
  // Helper to check if data is a Declaration
  function isDeclaration(data: any): data is Declaration {
    return data && typeof data.gadgetId === 'string' && 
           (data.type === 'provides' || data.type === 'needs');
  }
  
  // Helper to establish routes
  function establishRoutes(tag: string): Route[] {
    const newRoutes: Route[] = [];
    const providers = state.providers.get(tag) || new Set();
    const consumers = state.consumers.get(tag) || new Set();
    
    for (const provider of providers) {
      for (const consumer of consumers) {
        // Check if route already exists
        const existingRoutes = state.routes.get(tag) || [];
        const exists = existingRoutes.some(r => 
          r.from === provider.gadgetId && r.to === consumer.gadgetId
        );
        
        if (!exists) {
          const route: Route = {
            tag,
            from: provider.gadgetId,
            to: consumer.gadgetId,
            provider: provider.gadget,
            consumer: consumer.gadget
          };
          newRoutes.push(route);
        }
      }
    }
    
    return newRoutes;
  }
  
  return protocol<G, Message | Declaration, Route[] | Message, Route[] | Message>(
    // APPLY: Handle declarations or route messages
    (data) => {
      if (isDeclaration(data)) {
        // Store gadget reference if provided
        if (data.gadget) {
          state.gadgets.set(data.gadgetId, data.gadget);
        }
        
        // Process declaration
        const newRoutes: Route[] = [];
        
        for (const tag of data.tags) {
          if (data.type === 'provides') {
            if (!state.providers.has(tag)) {
              state.providers.set(tag, new Set());
            }
            state.providers.get(tag)!.add(data);
          } else {
            if (!state.consumers.has(tag)) {
              state.consumers.set(tag, new Set());
            }
            state.consumers.get(tag)!.add(data);
          }
          
          // Establish new routes for this tag
          const routes = establishRoutes(tag);
          newRoutes.push(...routes);
          
          // Store routes
          if (!state.routes.has(tag)) {
            state.routes.set(tag, []);
          }
          state.routes.get(tag)!.push(...routes);
        }
        
        return newRoutes.length > 0 ? newRoutes : null;
      } else {
        // Route message
        const msg = data as Message;
        const routes = state.routes.get(msg.tag) || [];
        
        // Forward message through all routes for this tag
        for (const route of routes) {
          if (route.consumer) {
            route.consumer.receive({
              ...msg,
              from: route.from  // Track source
            });
          }
        }
        
        return routes.length > 0 ? msg : null;
      }
    },
    
    // CONSIDER: Were routes created or message routed?
    (result) => result,
    
    // ACT: Log or handle routing results
    (result) => {
      if (Array.isArray(result)) {
        // New routes established
        for (const route of result) {
          console.log(`🔌 Route: ${route.from} → ${route.to} for "${route.tag}"`);
        }
      }
      // For messages, no additional action needed (already routed)
    }
  );
}

/**
 * Helper to create declarations
 */
export const declare = {
  /**
   * Declare what tags a gadget provides
   */
  provides: (gadgetId: string, tags: string[], gadget?: Gadget<Message>): Declaration => ({
    gadgetId,
    type: 'provides',
    tags,
    gadget
  }),
  
  /**
   * Declare what tags a gadget needs
   */
  needs: (gadgetId: string, tags: string[], gadget?: Gadget<Message>): Declaration => ({
    gadgetId,
    type: 'needs',
    tags,
    gadget
  })
};

/**
 * Create a gadget that registers with a pool and handles messages
 */
export function poolGadget<T>(
  id: string,
  pool: Gadget<Declaration | Message>,
  config: {
    provides?: string[];
    needs?: string[];
    handle: (msg: Message<T>) => void;
  }
): Gadget<Message<T>> {
  // Register with pool
  if (config.provides) {
    pool.receive(declare.provides(id, config.provides));
  }
  if (config.needs) {
    pool.receive(declare.needs(id, config.needs));
  }
  
  // Return gadget that handles messages
  return {
    receive(msg: Message<T>): void {
      config.handle(msg);
    }
  };
}