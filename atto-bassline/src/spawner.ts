/**
 * Spawner Gadgets - Runtime structure creation
 * 
 * Spawners create new gadgets from templates that flow as signals.
 * New structures start weak and must earn trust through validation.
 */

import { Gadget, Signal, createGadget, createContact, signal } from './types'
import { createDynamicGadget, interpretTemplate, TemplateSignal, InstanceSignal, DynamicGadgetSpec } from './dynamic'
import { createReceipt } from './receipts'

// ============================================================================
// Basic Spawner
// ============================================================================

/**
 * Creates a spawner gadget that instantiates templates
 */
export function createSpawner(id: string): Gadget {
  const spawner = createGadget(id)
  
  // Track spawned instances
  const instances = new Map<string, InstanceSignal>()
  let generation = 0
  
  // Create contacts
  spawner.contacts.set('template', createContact('template', spawner, undefined, 'input'))
  spawner.contacts.set('trigger', createContact('trigger', spawner, undefined, 'input'))
  spawner.contacts.set('initialStrength', createContact('initialStrength', spawner, undefined, 'input'))
  spawner.contacts.set('initialGain', createContact('initialGain', spawner, undefined, 'input'))
  
  // Outputs
  spawner.contacts.set('instance', createContact('instance', spawner, undefined, 'output'))
  spawner.contacts.set('error', createContact('error', spawner, undefined, 'output'))
  spawner.contacts.set('count', createContact('count', spawner, undefined, 'output'))
  
  spawner.compute = (inputs: Map<string, Signal>) => {
    const triggerSignal = inputs.get('trigger')
    const templateSignal = inputs.get('template')
    
    // Only spawn when triggered
    if (!triggerSignal?.value || !templateSignal?.value) {
      return new Map([
        ['count', signal(instances.size, 1.0)]
      ])
    }
    
    // Validate template
    if ((templateSignal.value as any).tag !== 'template') {
      return new Map([
        ['error', signal({ tag: 'contradiction', value: 'Not a template' }, 1.0)],
        ['count', signal(instances.size, 1.0)]
      ])
    }
    
    try {
      // Interpret template to create gadget
      const template = templateSignal.value as TemplateSignal
      const newGadget = interpretTemplate(template)
      
      // Configure initial strength and gain
      const initialStrength = inputs.get('initialStrength')?.value as number ?? 100
      const initialGain = inputs.get('initialGain')?.value as number ?? 100
      
      // New gadgets start weak (safety by default)
      newGadget.gainPool = initialGain
      
      // Set weak initial strength on all outputs
      for (const contact of newGadget.contacts.values()) {
        if (contact.direction === 'output') {
          contact.signal.strength = initialStrength
        }
      }
      
      // Add as child
      generation++
      const instanceId = `gen_${generation}_${Date.now()}`
      spawner.gadgets.set(instanceId, newGadget)
      newGadget.parent = new WeakRef(spawner)
      
      // Create instance reference
      const instance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: instanceId,
          gadget: new WeakRef(newGadget),
          born: Date.now(),
          generation
        }
      }
      
      instances.set(instanceId, instance)
      
      // Create receipt
      createReceipt(
        id,
        initialGain,
        `Spawned ${instanceId} with ${initialGain} gain`
      )
      
      // Output the instance
      return new Map([
        ['instance', { value: instance, strength: 1000 }],  // Instance ref starts weak
        ['error', signal(null, 0)],
        ['count', signal(instances.size, 1.0)]
      ])
      
    } catch (error: any) {
      return new Map([
        ['instance', signal(null, 0)],
        ['error', signal({ tag: 'contradiction', value: error.message }, 1.0)],
        ['count', signal(instances.size, 1.0)]
      ])
    }
  }
  
  return spawner
}

// ============================================================================
// Conditional Spawner
// ============================================================================

/**
 * Spawns different templates based on condition
 */
export function createConditionalSpawner(id: string): Gadget {
  const condSpawner = createGadget(id)
  
  // Inputs
  condSpawner.contacts.set('condition', createContact('condition', condSpawner, undefined, 'input'))
  condSpawner.contacts.set('ifTrue', createContact('ifTrue', condSpawner, undefined, 'input'))
  condSpawner.contacts.set('ifFalse', createContact('ifFalse', condSpawner, undefined, 'input'))
  condSpawner.contacts.set('trigger', createContact('trigger', condSpawner, undefined, 'input'))
  
  // Output
  condSpawner.contacts.set('spawned', createContact('spawned', condSpawner, undefined, 'output'))
  
  condSpawner.compute = (inputs: Map<string, Signal>) => {
    const trigger = inputs.get('trigger')
    if (!trigger?.value) {
      return new Map()
    }
    
    const condition = inputs.get('condition')?.value
    const template = condition ?
      inputs.get('ifTrue')?.value :
      inputs.get('ifFalse')?.value
      
    if (!template || (template as any).tag !== 'template') {
      return new Map()
    }
    
    try {
      const gadget = interpretTemplate(template as TemplateSignal)
      
      // Very weak initial conditions
      gadget.gainPool = 50
      
      const childId = `cond_${Date.now()}`
      condSpawner.gadgets.set(childId, gadget)
      gadget.parent = new WeakRef(condSpawner)
      
      const instance: InstanceSignal = {
        tag: 'instance',
        value: {
          id: childId,
          gadget: new WeakRef(gadget),
          born: Date.now(),
          generation: 1
        }
      }
      
      return new Map([
        ['spawned', { value: instance, strength: 500 }]
      ])
    } catch (error) {
      return new Map()
    }
  }
  
  return condSpawner
}

// ============================================================================
// Evolver - Gradual Strength Transfer
// ============================================================================

/**
 * Manages evolution between gadget instances
 */
export function createEvolver(id: string): Gadget {
  const evolver = createGadget(id)
  
  evolver.contacts.set('old', createContact('old', evolver, undefined, 'input'))
  evolver.contacts.set('new', createContact('new', evolver, undefined, 'input'))
  evolver.contacts.set('rate', createContact('rate', evolver, undefined, 'input'))
  evolver.contacts.set('threshold', createContact('threshold', evolver, undefined, 'input'))
  
  evolver.contacts.set('status', createContact('status', evolver, undefined, 'output'))
  evolver.contacts.set('complete', createContact('complete', evolver, undefined, 'output'))
  
  evolver.compute = (inputs: Map<string, Signal>) => {
    const oldSignal = inputs.get('old')?.value as InstanceSignal
    const newSignal = inputs.get('new')?.value as InstanceSignal
    const rate = inputs.get('rate')?.value as number ?? 100
    const threshold = inputs.get('threshold')?.value as number ?? 100
    
    if (!oldSignal || !newSignal) {
      return new Map([
        ['status', signal('waiting', 0.5)]
      ])
    }
    
    const oldGadget = oldSignal.value.gadget.deref()
    const newGadget = newSignal.value.gadget.deref()
    
    if (!oldGadget || !newGadget) {
      return new Map([
        ['status', signal('gadget expired', 0.5)]
      ])
    }
    
    // Transfer gain gradually
    let transferred = 0
    if (oldGadget.gainPool > threshold) {
      const amount = Math.min(rate, oldGadget.gainPool - threshold)
      oldGadget.gainPool -= amount
      newGadget.gainPool += amount
      transferred = amount
      
      createReceipt(id, amount, `Evolution transfer from ${oldSignal.value.id} to ${newSignal.value.id}`)
    }
    
    // Transfer output strength (if contacts exist)
    if (oldGadget.contacts && newGadget.contacts) {
      for (const [name, oldContact] of oldGadget.contacts) {
        const newContact = newGadget.contacts.get(name)
        if (newContact && oldContact.direction === 'output') {
          if (oldContact.signal.strength > threshold) {
            const transfer = Math.min(rate, oldContact.signal.strength - threshold)
            oldContact.signal.strength -= transfer
            newContact.signal.strength = Math.min(
              newContact.signal.strength + transfer,
              10000  // Cap at max
            )
          }
        }
      }
    }
    
    // Check if evolution complete (only if we couldn't transfer anything)
    const complete = oldGadget.gainPool <= threshold && transferred === 0
    
    return new Map([
      ['status', signal({ 
        oldGain: oldGadget.gainPool,
        newGain: newGadget.gainPool,
        transferred
      }, 1.0)],
      ['complete', signal(complete, 1.0)]
    ])
  }
  
  return evolver
}

// ============================================================================
// Iterator - Dynamic Replication
// ============================================================================

/**
 * Spawns multiple instances from a template
 */
export function createIterator(id: string): Gadget {
  const iterator = createGadget(id)
  
  iterator.contacts.set('template', createContact('template', iterator, undefined, 'input'))
  iterator.contacts.set('count', createContact('count', iterator, undefined, 'input'))
  iterator.contacts.set('data', createContact('data', iterator, undefined, 'input'))
  iterator.contacts.set('trigger', createContact('trigger', iterator, undefined, 'input'))
  
  iterator.contacts.set('instances', createContact('instances', iterator, undefined, 'output'))
  iterator.contacts.set('complete', createContact('complete', iterator, undefined, 'output'))
  
  iterator.compute = (inputs: Map<string, Signal>) => {
    const trigger = inputs.get('trigger')
    if (!trigger?.value) {
      return new Map()
    }
    
    const template = inputs.get('template')?.value as TemplateSignal
    const count = inputs.get('count')?.value as number ?? 1
    const dataArray = inputs.get('data')?.value as any[]
    
    if (!template || template.tag !== 'template') {
      return new Map()
    }
    
    const instances: InstanceSignal[] = []
    
    // Spawn n copies
    for (let i = 0; i < count; i++) {
      try {
        const gadget = interpretTemplate(template)
        
        // Later items start weaker (natural ordering)
        gadget.gainPool = Math.max(10, 100 - i * 10)
        
        // If data provided, set initial value
        if (dataArray && dataArray[i] !== undefined) {
          const dataContact = gadget.contacts.get('data')
          if (dataContact) {
            dataContact.signal = signal(dataArray[i], 0.5)
          }
        }
        
        const childId = `item_${i}`
        iterator.gadgets.set(childId, gadget)
        gadget.parent = new WeakRef(iterator)
        
        // Chain them together if more than one
        if (i > 0) {
          const prev = iterator.gadgets.get(`item_${i - 1}`)
          const prevOut = prev?.contacts.get('output')
          const currIn = gadget.contacts.get('input')
          
          if (prevOut && currIn) {
            // Wire previous output to current input
            prevOut.targets.add(new WeakRef(currIn))
            currIn.sources.add(new WeakRef(prevOut))
          }
        }
        
        instances.push({
          tag: 'instance',
          value: {
            id: childId,
            gadget: new WeakRef(gadget),
            born: Date.now(),
            generation: i
          }
        })
        
      } catch (error) {
        // Continue spawning even if one fails
      }
    }
    
    return new Map([
      ['instances', signal(instances, 1.0)],
      ['complete', signal(true, 1.0)]
    ])
  }
  
  return iterator
}

// ============================================================================
// Garbage Collector
// ============================================================================

/**
 * Removes weak gadgets from parent
 */
export function createGarbageCollector(id: string): Gadget {
  const gc = createGadget(id)
  
  gc.contacts.set('threshold', createContact('threshold', gc, undefined, 'input'))
  gc.contacts.set('check', createContact('check', gc, undefined, 'input'))
  
  gc.contacts.set('removed', createContact('removed', gc, undefined, 'output'))
  gc.contacts.set('remaining', createContact('remaining', gc, undefined, 'output'))
  
  gc.compute = (inputs: Map<string, Signal>) => {
    const check = inputs.get('check')
    if (!check?.value) {
      return new Map()
    }
    
    const threshold = inputs.get('threshold')?.value as number ?? 100
    const parent = gc.parent?.deref()
    
    if (!parent) {
      return new Map()
    }
    
    const removed: string[] = []
    
    // Check all siblings for weak outputs
    for (const [childId, child] of parent.gadgets) {
      if (child === gc) continue  // Don't GC ourselves!
      
      let maxStrength = 0
      for (const contact of child.contacts.values()) {
        if (contact.direction === 'output') {
          maxStrength = Math.max(maxStrength, contact.signal.strength)
        }
      }
      
      // Remove if all outputs are weak
      if (maxStrength < threshold) {
        parent.gadgets.delete(childId)
        removed.push(childId)
        
        createReceipt(id, 0, `Garbage collected ${childId}`)
      }
    }
    
    return new Map([
      ['removed', signal(removed, 1.0)],
      ['remaining', signal(parent.gadgets.size, 1.0)]
    ])
  }
  
  return gc
}