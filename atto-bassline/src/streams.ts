/**
 * Stream gadgets for bridging between propagation network and external systems
 * Uses EventEmitter pattern for clean boundaries
 */

import { createGadget, createContact, signal, createSignal, type Gadget, type Signal } from './types'
import { propagate } from './propagation'

// Simple EventEmitter implementation
export class EventEmitter {
  private listeners: Map<string, Set<Function>> = new Map()
  
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }
  
  off(event: string, listener: Function): void {
    this.listeners.get(event)?.delete(listener)
  }
  
  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(listener => listener(...args))
  }
  
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}

export interface Reader extends Gadget {
  emitter: EventEmitter
}

export interface Writer extends Gadget {
  write: (value: any, strength: number) => void
}

/**
 * Reader gadget - broadcasts input signals to external listeners
 * Use this to observe values from the network in React/UI
 */
export function createReader(id: string): Reader {
  const gadget = createGadget(id)
  const emitter = new EventEmitter()
  
  // Input contact that we observe
  const input = createContact('input', gadget, signal(null, 0), 'input')
  gadget.contacts.set('input', input)
  
  // Store last signal to detect changes
  let lastSignal: Signal | null = null
  
  gadget.compute = (inputs) => {
    const inputSignal = inputs.get('input')
    if (inputSignal) {
      // Only emit if signal actually changed (value or strength)
      if (!lastSignal || 
          lastSignal.value !== inputSignal.value || 
          lastSignal.strength !== inputSignal.strength) {
        lastSignal = { ...inputSignal }
        // Emit to all external listeners
        emitter.emit('signal', inputSignal)
        emitter.emit('value', inputSignal.value)
        emitter.emit('strength', inputSignal.strength)
      }
    }
    return new Map() // No outputs, just side effects
  }
  
  return Object.assign(gadget, { emitter }) as Reader
}

/**
 * Writer gadget - accepts external values and propagates them into the network
 * Use this to inject values from React/UI into the network
 */
export function createWriter(id: string): Writer {
  const gadget = createGadget(id)
  
  // Output contact that propagates written values
  const output = createContact('output', gadget, signal(null, 0), 'output')
  gadget.contacts.set('output', output)
  
  // Track write count for increasing strength if needed
  let writeCount = 0
  let lastWriteStrength = 10000  // Start with a base strength
  
  const write = (value: any, strengthInUnits: number) => {
    writeCount++
    // Always increment strength by 1 to ensure propagation
    lastWriteStrength += 1
    const writeStrength = Math.max(strengthInUnits, lastWriteStrength)
    
    // Propagate the written value into the network - use createSignal for units
    propagate(output, createSignal(value, writeStrength))
  }
  
  // No compute function needed - this gadget is purely driven by external writes
  
  return Object.assign(gadget, { write, writeCount: () => writeCount }) as Writer
}

/**
 * Bidirectional stream - combines reader and writer for two-way binding
 * Useful for form inputs that both display and accept values
 */
export interface BiStream extends Gadget {
  emitter: EventEmitter
  write: (value: any, strength: number) => void
}

export function createBiStream(id: string): BiStream {
  const gadget = createGadget(id)
  const emitter = new EventEmitter()
  
  // Input for reading from network
  const input = createContact('input', gadget, signal(null, 0), 'input')
  // Output for writing to network
  const output = createContact('output', gadget, signal(null, 0), 'output')
  
  gadget.contacts.set('input', input)
  gadget.contacts.set('output', output)
  
  // Track last input signal for change detection
  let lastInputSignal: Signal | null = null
  
  // Simple compute function that just emits when input changes
  gadget.compute = (inputs) => {
    const inputSignal = inputs.get('input')
    if (inputSignal) {
      // Only emit if input actually changed
      if (!lastInputSignal || 
          lastInputSignal.value !== inputSignal.value || 
          lastInputSignal.strength !== inputSignal.strength) {
        lastInputSignal = { ...inputSignal }
        emitter.emit('signal', inputSignal)
        emitter.emit('change', inputSignal)
      }
    }
    return new Map() // No outputs from compute - we use write() for output
  }
  
  // Simplified write with monotonic strength
  let writeCounter = 10000
  
  const write = (value: any, strengthInUnits: number) => {
    // Always increment counter to ensure monotonic strength
    writeCounter += 1
    const finalStrength = Math.max(strengthInUnits, writeCounter)
    
    // Write directly to output contact
    const output = gadget.contacts.get('output')!
    const newSignal = createSignal(value, finalStrength)
    propagate(output, newSignal)
    
    // Emit the change
    emitter.emit('signal', newSignal)
    emitter.emit('change', newSignal)
  }
  
  return Object.assign(gadget, { emitter, write }) as BiStream
}

/**
 * Buffered reader - collects signals and emits them in batches
 * Useful for high-frequency signals that would overwhelm the UI
 */
export interface BufferedReader extends Gadget {
  emitter: EventEmitter
  flush: () => void
}

export function createBufferedReader(id: string, bufferSize: number = 10, flushInterval: number = 100): BufferedReader {
  const gadget = createGadget(id)
  const emitter = new EventEmitter()
  
  const input = createContact('input', gadget, signal(null, 0), 'input')
  gadget.contacts.set('input', input)
  
  const buffer: Signal[] = []
  let flushTimer: any = null
  
  const flush = () => {
    if (buffer.length > 0) {
      emitter.emit('batch', [...buffer])
      buffer.length = 0
    }
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
  }
  
  gadget.compute = (inputs) => {
    const inputSignal = inputs.get('input')
    if (inputSignal) {
      buffer.push({ ...inputSignal })
      
      // Flush if buffer is full
      if (buffer.length >= bufferSize) {
        flush()
      } else if (!flushTimer) {
        // Schedule flush
        flushTimer = setTimeout(flush, flushInterval)
      }
    }
    return new Map()
  }
  
  return Object.assign(gadget, { emitter, flush }) as BufferedReader
}