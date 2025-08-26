import { FunctionGadget } from './function'
import { Network } from './network'
import type { Gadget } from './gadget'
import type { GadgetBase } from './gadget-base'
import type { LatticeValue } from './lattice-types'

/**
 * Event types for tracking propagation activity
 */
export type PropagationEvent = 
  | { type: 'emit'; gadgetId: string; outputName: string; value: LatticeValue; timestamp: number }
  | { type: 'accept'; gadgetId: string; fromId: string; inputName?: string; value: LatticeValue; timestamp: number }
  | { type: 'connect'; fromId: string; toId: string; outputName?: string; inputName?: string; timestamp: number }
  | { type: 'disconnect'; fromId: string; toId: string; timestamp: number }
  | { type: 'gadgetAdded'; gadget: Gadget; timestamp: number }
  | { type: 'gadgetRemoved'; gadgetId: string; timestamp: number }
  | { type: 'valueChanged'; gadgetId: string; outputName: string; value: LatticeValue; timestamp: number }

export type PropagationListener = (event: PropagationEvent) => void

/**
 * BasslineEngine - Extended Network with event tracking for external integrations
 * 
 * This engine tracks all propagation events happening in the network,
 * allowing external systems (like Rete.js) to stay in sync.
 */
export class BasslineEngine extends Network {
  private eventQueue: PropagationEvent[] = []
  private listeners: Set<PropagationListener> = new Set()
  private isProcessingQueue = false
  private frameRequest: number | null = null
  
  constructor(id: string = "engine") {
    super(id)
    // Engine references itself
    this.engine = new WeakRef(this)
  }
  
  /**
   * Subscribe to propagation events
   */
  subscribe(listener: PropagationListener): () => void {
    this.listeners.add(listener)
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }
  
  /**
   * Add an event to the queue and schedule processing
   */
  private queueEvent(event: PropagationEvent): void {
    this.eventQueue.push(event)
    this.scheduleProcessQueue()
  }
  
  /**
   * Schedule queue processing on next animation frame
   */
  private scheduleProcessQueue(): void {
    if (!this.isProcessingQueue && this.frameRequest === null) {
      this.frameRequest = requestAnimationFrame(() => {
        this.processEventQueue()
      })
    }
  }
  
  /**
   * Process and emit all queued events
   */
  private processEventQueue(): void {
    this.isProcessingQueue = true
    this.frameRequest = null
    
    // Process all events in the queue
    const events = [...this.eventQueue]
    this.eventQueue = []
    
    // Emit to all listeners
    for (const event of events) {
      for (const listener of this.listeners) {
        try {
          listener(event)
        } catch (error) {
          console.error('Error in propagation listener:', error)
        }
      }
    }
    
    this.isProcessingQueue = false
  }
  
  /**
   * Override addGadget to inject engine reference
   */
  addGadget(gadget: Gadget): void {
    super.addGadget(gadget)
    
    // Set engine reference on the gadget
    gadget.engine = new WeakRef(this)
    
    // If it's a network, recursively set engine on all its gadgets
    if (gadget instanceof Network) {
      this.propagateEngineReference(gadget)
    }
    
    // Emit event
    this.queueEvent({
      type: 'gadgetAdded',
      gadget,
      timestamp: Date.now()
    })
  }
  
  /**
   * Override remove to emit events
   */
  remove(gadget: GadgetBase): boolean {
    const result = super.remove(gadget)
    
    if (result) {
      this.queueEvent({
        type: 'gadgetRemoved',
        gadgetId: gadget.id,
        timestamp: Date.now()
      })
    }
    
    return result
  }
  
  /**
   * Recursively set engine reference on all gadgets in a network
   */
  private propagateEngineReference(network: Network): void {
    for (const gadget of network.gadgets) {
      gadget.engine = new WeakRef(this)
      
      if (gadget instanceof Network) {
        this.propagateEngineReference(gadget)
      }
    }
  }
  
  /**
   * Report an emission event (called by gadgets)
   */
  trackEmit(gadgetId: string, outputName: string, value: LatticeValue): void {
    this.queueEvent({
      type: 'emit',
      gadgetId,
      outputName,
      value,
      timestamp: Date.now()
    })
    
    // Also queue a valueChanged event for simpler tracking
    this.queueEvent({
      type: 'valueChanged',
      gadgetId,
      outputName,
      value,
      timestamp: Date.now()
    })
  }
  
  /**
   * Report an accept event (called by gadgets)
   */
  trackAccept(gadgetId: string, fromId: string, inputName: string | undefined, value: LatticeValue): void {
    const event: PropagationEvent = inputName !== undefined 
      ? {
          type: 'accept',
          gadgetId,
          fromId,
          inputName,
          value,
          timestamp: Date.now()
        }
      : {
          type: 'accept',
          gadgetId,
          fromId,
          value,
          timestamp: Date.now()
        }
    this.queueEvent(event)
  }
  
  /**
   * Report a connection event
   */
  trackConnect(fromId: string, toId: string, outputName?: string, inputName?: string): void {
    const event: PropagationEvent = {
      type: 'connect',
      fromId,
      toId,
      timestamp: Date.now()
    }
    
    if (outputName !== undefined) {
      (event as any).outputName = outputName
    }
    if (inputName !== undefined) {
      (event as any).inputName = inputName
    }
    
    this.queueEvent(event)
  }
  
  /**
   * Report a disconnection event
   */
  trackDisconnect(fromId: string, toId: string): void {
    this.queueEvent({
      type: 'disconnect',
      fromId,
      toId,
      timestamp: Date.now()
    })
  }
  
  /**
   * Force immediate processing of event queue (useful for testing)
   */
  flush(): void {
    if (this.frameRequest !== null) {
      cancelAnimationFrame(this.frameRequest)
      this.frameRequest = null
    }
    this.processEventQueue()
  }
}