/**
 * Dynamic Bassline Gadget - Instantiates and runs basslines from descriptions
 * 
 * This gadget enables recursion and dynamic computation by allowing basslines
 * to instantiate and run other basslines (including themselves).
 */

import type { PrimitiveGadget } from '../types'
import type { Bassline, ReifiedContact, ReifiedWire, ReifiedScheduler, ReifiedGroup } from '../bassline-types'
import { createEmptyBassline } from '../bassline-types'
import { add, multiply } from '../primitives/math'

/**
 * Get default primitive gadgets
 */
function getDefaultPrimitiveGadgets(): Map<string, PrimitiveGadget> {
  const gadgets = new Map<string, PrimitiveGadget>()
  gadgets.set('add', add())
  gadgets.set('multiply', multiply())
  // Add more as needed
  return gadgets
}

/**
 * Create an immediate scheduler
 */
function createImmediateScheduler(): ReifiedScheduler {
  return {
    type: 'immediate',
    pendingTasks: [],
    processTask: (task, bassline, values) => {
      // Process a propagation task
      if (task.type === 'propagate') {
        const toContact = bassline.contacts.get(task.toContactId)
        if (toContact) {
          // Apply blend mode
          if (toContact.blendMode === 'accept-last') {
            values.set(task.toContactId, task.value)
          } else if (toContact.blendMode === 'merge') {
            const current = values.get(task.toContactId)
            if (Array.isArray(current) && Array.isArray(task.value)) {
              values.set(task.toContactId, [...current, ...task.value])
            } else {
              values.set(task.toContactId, task.value)
            }
          }
        }
      }
    }
  }
}

/**
 * Bassline Executor - Runs a bassline using its scheduler
 * 
 * This is a simplified executor that uses the reified scheduler concept.
 * The network is stable when the scheduler's pending tasks queue is empty.
 */
class BasslineExecutor {
  private bassline: Bassline
  public scheduler: ReifiedScheduler
  private contactValues: Map<string, any> = new Map()
  private maxIterations: number = 100
  private primitiveGadgets: Map<string, PrimitiveGadget> = new Map()
  
  constructor(bassline: Bassline, fallbackPrimitives?: Map<string, PrimitiveGadget>) {
    this.bassline = bassline
    // Use the bassline's scheduler if it has one, otherwise use immediate
    if (bassline.scheduler && typeof bassline.scheduler === 'object') {
      this.scheduler = bassline.scheduler as ReifiedScheduler
    } else {
      this.scheduler = createImmediateScheduler()
    }
    
    // Build primitive gadgets map from bassline's gadgets, with fallback
    this.primitiveGadgets = new Map()
    const fallback = fallbackPrimitives || getDefaultPrimitiveGadgets()
    
    // First, add any primitives defined in the bassline's gadgets
    bassline.gadgets.forEach((gadget, id) => {
      if (gadget.type === 'primitive' && gadget.primitive) {
        // Look up the primitive from fallback (since primitives are black boxes)
        const primitive = fallback.get(gadget.primitive)
        if (primitive) {
          this.primitiveGadgets.set(gadget.primitive, primitive)
        }
      }
    })
    
    // If no gadgets defined, use all fallback primitives
    if (this.primitiveGadgets.size === 0) {
      this.primitiveGadgets = fallback
    }
    
    this.initializeContacts()
  }
  
  private initializeContacts() {
    // Initialize all contacts with their default values
    this.bassline.contacts.forEach((contact, id) => {
      this.contactValues.set(id, contact.content)
    })
  }
  
  /**
   * Set an input value and queue propagation tasks
   */
  async setInput(contactId: string, value: any) {
    const oldValue = this.contactValues.get(contactId)
    
    // Use JSON comparison for deep equality check
    // This isn't perfect but works for most cases
    const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(value)
    
    if (hasChanged) {
      this.contactValues.set(contactId, value)
      
      // Check if this triggers any gadgets
      await this.checkAndExecuteGadgets(contactId)
      
      // Queue propagation tasks for all wires from this contact
      this.bassline.wires.forEach(wire => {
        if (wire.fromId === contactId) {
          this.scheduler.pendingTasks.push({
            type: 'propagate',
            fromContactId: wire.fromId,
            toContactId: wire.toId,
            value: value
          })
        }
        // Handle bidirectional wires
        if (wire.type === 'bidirectional' && wire.toId === contactId) {
          this.scheduler.pendingTasks.push({
            type: 'propagate',
            fromContactId: wire.toId,
            toContactId: wire.fromId,
            value: value
          })
        }
      })
    }
  }
  
  /**
   * Process one task from the queue
   */
  async step(): Promise<boolean> {
    if (this.scheduler.pendingTasks.length === 0) {
      return false // Already stable
    }
    
    const task = this.scheduler.pendingTasks.shift()!
    const oldValue = this.contactValues.get(task.toContactId)
    
    // Process the task
    this.scheduler.processTask(task, this.bassline, this.contactValues)
    
    const newValue = this.contactValues.get(task.toContactId)
    
    // Use JSON comparison for deep equality check
    const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue)
    
    // If value changed, queue propagation for connected wires
    if (hasChanged) {
      // Check if this contact is an input to any gadget (await since it's async)
      await this.checkAndExecuteGadgets(task.toContactId)
      
      this.bassline.wires.forEach(wire => {
        if (wire.fromId === task.toContactId) {
          this.scheduler.pendingTasks.push({
            type: 'propagate',
            fromContactId: wire.fromId,
            toContactId: wire.toId,
            value: newValue
          })
        }
        // Handle bidirectional wires
        if (wire.type === 'bidirectional' && wire.toId === task.toContactId) {
          this.scheduler.pendingTasks.push({
            type: 'propagate',
            fromContactId: wire.toId,
            toContactId: wire.fromId,
            value: newValue
          })
        }
      })
    }
    
    return true // Processed a task
  }
  
  /**
   * Run to completion (until queue is empty)
   */
  async runToCompletion(): Promise<number> {
    let iterations = 0
    
    while (this.scheduler.pendingTasks.length > 0 && iterations < this.maxIterations) {
      await this.step()
      iterations++
    }
    
    return iterations
  }
  
  /**
   * Check if stable (queue is empty)
   */
  isStable(): boolean {
    return this.scheduler.pendingTasks.length === 0
  }
  
  /**
   * Get all contact values
   */
  getAllValues(): Map<string, any> {
    return new Map(this.contactValues)
  }
  
  /**
   * Get a specific output value
   */
  getOutput(contactId: string): any {
    return this.contactValues.get(contactId)
  }
  
  /**
   * Check if a contact change should trigger gadget execution
   */
  private async checkAndExecuteGadgets(contactId: string) {
    // Find groups that have this contact as a boundary input
    for (const [groupId, group] of this.bassline.groups) {
      // Guard: Skip if not a primitive gadget
      if (!group.primitive) continue
      
      // Guard: Skip if gadget not found
      const gadget = this.primitiveGadgets.get(group.primitive.id)
      if (!gadget) continue
      
      // Guard: Skip if contact is not an input to this gadget
      const contact = this.bassline.contacts.get(contactId)
      if (!contact) continue
      if (contact.groupId !== groupId) continue
      if (!contact.isBoundary) continue
      if (contact.boundaryDirection !== 'input') continue
      
      // Collect all input values for this gadget
      const inputs = new Map<string, any>()
      
      this.bassline.contacts.forEach((c, cId) => {
        if (c.groupId === groupId && c.isBoundary && c.boundaryDirection === 'input' && c.name) {
          const value = this.contactValues.get(cId)
          inputs.set(c.name, value)
        }
      })
      
      // Guard: Skip if activation conditions not met
      if (!gadget.activation(inputs)) continue
      
      // Execute the gadget (await it since we're async)
      const outputs = await gadget.body(inputs)
      
      // Set output values
      this.bassline.contacts.forEach((c, cId) => {
        // Guard: Skip non-output contacts
        if (c.groupId !== groupId) return
        if (!c.isBoundary) return
        if (c.boundaryDirection !== 'output') return
        if (!c.name) return
        
        const outputValue = outputs.get(c.name)
        if (outputValue === undefined) return
        
        // Guard: Skip if value hasn't changed
        const oldValue = this.contactValues.get(cId)
        if (JSON.stringify(oldValue) === JSON.stringify(outputValue)) return
        
        this.contactValues.set(cId, outputValue)
        
        // Queue propagation for wires from this output
        this.bassline.wires.forEach(wire => {
          if (wire.fromId === cId) {
            this.scheduler.pendingTasks.push({
              type: 'propagate',
              fromContactId: wire.fromId,
              toContactId: wire.toId,
              value: outputValue
            })
          }
        })
      })
    }
  }
}

/**
 * Create a Dynamic Bassline Gadget
 * 
 * This gadget takes a bassline description and instantiates it,
 * runs it using its scheduler, and outputs the results.
 * 
 * Inputs:
 * - basslineDescription: The bassline to instantiate
 * - inputs: Map of input values to set
 * - run: Boolean to trigger running to completion
 * - step: Boolean to trigger one step
 * 
 * Outputs:
 * - runningBassline: The current state of the running bassline
 * - outputs: Map of all contact values
 * - completed: Whether the bassline has reached a fixed point (queue empty)
 * - iterations: Number of iterations performed
 * - queueSize: Current size of the scheduler's queue
 */
export function createDynamicBasslineGadget(): PrimitiveGadget {
  // Keep track of running bassline executors
  const executors = new Map<string, BasslineExecutor>()
  
  return {
    id: 'dynamic-bassline',
    name: 'Dynamic Bassline',
    
    inputs: [
      'basslineDescription',
      'inputs',
      'run',
      'step',
      'reset'
    ],
    
    outputs: [
      'runningBassline',
      'outputs',
      'completed',
      'iterations',
      'queueSize'
    ],
    
    activation: (inputs) => {
      // Activate when we have a bassline and a command
      return inputs.has('basslineDescription') && 
             (inputs.has('run') || inputs.has('step') || inputs.has('reset'))
    },
    
    body: async (inputs) => {
      const basslineDesc = inputs.get('basslineDescription') as Bassline
      const inputValues = inputs.get('inputs') as Map<string, any> | undefined
      const shouldRun = inputs.get('run') === true
      const shouldStep = inputs.get('step') === true
      const shouldReset = inputs.get('reset') === true
      
      if (!basslineDesc) {
        return new Map()
      }
      
      // Create a unique key for this bassline instance
      // Use a combination of structural properties for better uniqueness
      const key = JSON.stringify({
        contacts: Array.from(basslineDesc.contacts.keys()).sort(),
        wires: Array.from(basslineDesc.wires.keys()).sort(),
        groups: Array.from(basslineDesc.groups.keys()).sort()
      })
      
      // Get or create executor
      let executor = executors.get(key)
      if (!executor || shouldReset) {
        executor = new BasslineExecutor(basslineDesc, getDefaultPrimitiveGadgets())
        executors.set(key, executor)
      }
      
      // Set input values if provided
      if (inputValues) {
        for (const [contactId, value] of inputValues) {
          await executor.setInput(contactId, value)
        }
      }
      
      // Run or step
      let iterations = 0
      if (shouldRun) {
        iterations = await executor.runToCompletion()
      } else if (shouldStep) {
        if (await executor.step()) {
          iterations = 1
        }
      }
      
      // Prepare outputs
      const outputs = new Map<string, any>()
      outputs.set('runningBassline', basslineDesc)
      outputs.set('outputs', executor.getAllValues())
      outputs.set('completed', executor.isStable())
      outputs.set('iterations', iterations)
      outputs.set('queueSize', executor.scheduler.pendingTasks.length)
      
      return outputs
    },
    
    description: 'Instantiates and runs a bassline from a description using its scheduler',
    category: 'custom',
    isPure: false  // Has internal state (executors)
  }
}

/**
 * Create a simple recursive bassline for testing
 * This creates a factorial calculator as a self-referential bassline
 */
export function createFactorialBassline(): Bassline {
  const bassline = createEmptyBassline(new Set(['bassline.spawn']))
  
  // Set a scheduler for this bassline
  bassline.scheduler = createImmediateScheduler() as ReifiedScheduler
  
  // Create contacts
  const nInput: ReifiedContact = {
    id: 'n' as any,
    groupId: 'factorial' as any,
    content: undefined,
    blendMode: 'accept-last',
    name: 'n',
    isBoundary: true,
    boundaryDirection: 'input'
  }
  
  const result: ReifiedContact = {
    id: 'result' as any,
    groupId: 'factorial' as any,
    content: undefined,
    blendMode: 'accept-last',
    name: 'result',
    isBoundary: true,
    boundaryDirection: 'output'
  }
  
  const isZero: ReifiedContact = {
    id: 'is-zero' as any,
    groupId: 'factorial' as any,
    content: undefined,
    blendMode: 'accept-last',
    name: 'is-zero'
  }
  
  const nMinus1: ReifiedContact = {
    id: 'n-minus-1' as any,
    groupId: 'factorial' as any,
    content: undefined,
    blendMode: 'accept-last',
    name: 'n-minus-1'
  }
  
  const recursiveResult: ReifiedContact = {
    id: 'recursive-result' as any,
    groupId: 'factorial' as any,
    content: undefined,
    blendMode: 'accept-last',
    name: 'recursive-result'
  }
  
  // Add contacts to bassline
  bassline.contacts.set(nInput.id, nInput)
  bassline.contacts.set(result.id, result)
  bassline.contacts.set(isZero.id, isZero)
  bassline.contacts.set(nMinus1.id, nMinus1)
  bassline.contacts.set(recursiveResult.id, recursiveResult)
  
  // Note: In a full implementation, we would also have:
  // - Gadgets for checking if n === 0
  // - Gadgets for computing n - 1
  // - A dynamic bassline gadget that recursively calls this bassline
  // - Gadgets for multiplying n * recursiveResult
  
  // For now, this serves as a structural example
  
  return bassline
}

/**
 * Helper to create a simple computation bassline
 */
export function createSimpleComputeBassline(): Bassline {
  const bassline = createEmptyBassline()
  
  // Set a scheduler
  bassline.scheduler = createImmediateScheduler() as ReifiedScheduler
  
  // Create the add gadget group
  const addGroup: ReifiedGroup = {
    id: 'add-group' as any,
    name: 'Add Gadget',
    capabilities: new Set(),
    primitive: {
      id: 'add',
      name: 'Add',
      inputs: ['a', 'b'],
      outputs: ['sum']
    }
  }
  
  bassline.groups.set(addGroup.id, addGroup)
  
  // Register the gadget in the bassline's gadgets map
  bassline.gadgets.set('add-gadget-instance', {
    id: 'add-gadget-instance',
    type: 'primitive',
    groupId: 'add-group' as any,
    primitive: 'add'  // Reference to the primitive by ID
  })
  
  // Create boundary contacts for the add gadget
  const a: ReifiedContact = {
    id: 'a' as any,
    groupId: 'add-group' as any,
    content: 0,
    blendMode: 'accept-last',
    name: 'a',
    isBoundary: true,
    boundaryDirection: 'input'
  }
  
  const b: ReifiedContact = {
    id: 'b' as any,
    groupId: 'add-group' as any,
    content: 0,
    blendMode: 'accept-last',
    name: 'b',
    isBoundary: true,
    boundaryDirection: 'input'
  }
  
  const sum: ReifiedContact = {
    id: 'sum' as any,
    groupId: 'add-group' as any,
    content: 0,
    blendMode: 'accept-last',
    name: 'sum',
    isBoundary: true,
    boundaryDirection: 'output'
  }
  
  bassline.contacts.set(a.id, a)
  bassline.contacts.set(b.id, b)
  bassline.contacts.set(sum.id, sum)
  
  // No internal wires needed - the gadget handles the computation
  
  return bassline
}