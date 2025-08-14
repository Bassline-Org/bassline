/**
 * StreamContact: Functional approach
 */

import { stream, Stream, guards } from './micro-stream'
import { ContactId, BlendMode, valuesEqual } from './types'

export interface Contact {
  id: ContactId
  stream: Stream<any>
  getValue(): any
  setValue(value: any): void
  wireTo(target: Contact, bidirectional?: boolean): void
  canWireTo(target: Contact): boolean
  onValueChange(handler: (value: any) => void): () => void
  groupId?: string
  properties: Record<string, any>
}

/**
 * Create a contact
 */
export function contact(
  id: ContactId,
  blendMode: BlendMode = 'merge',
  groupId?: string,
  properties: Record<string, any> = {}
): Contact {
  let currentValue: any = undefined
  const s = stream<any>()
  
  // Add deduplication for both modes to prevent infinite loops
  // Even 'last' mode needs to deduplicate to avoid propagation cycles
  const originalWrite = s.write
  s.write = (value: any) => {
    if (currentValue !== undefined && valuesEqual(currentValue, value)) {
      return // Skip duplicate - prevents infinite propagation
    }
    originalWrite(value)
  }
  
  // Store current value
  s.subscribe(value => {
    currentValue = value
  })
  
  const getValue = () => currentValue
  
  const setValue = (value: any) => {
    s.write(value)
  }
  
  const canWireTo = (target: Contact): boolean => {
    // Can't wire to self
    if (target === self || target.id === id) return false
    
    // Check for read-only properties contacts
    if (target.properties.readOnlyFromInside && groupId === target.groupId) {
      const match = target.id.match(/^(.+):properties$/)
      if (match && match[1] === groupId) return false
    }
    
    // Check if target accepts connections
    if (target.properties.acceptsConnections === false) return false
    
    return true
  }
  
  const wireTo = (target: Contact, bidirectional = true) => {
    if (!canWireTo(target)) {
      throw new Error(`Cannot wire ${id} to ${target.id}: Connection not allowed`)
    }
    
    if (bidirectional && !target.canWireTo(self)) {
      throw new Error(`Cannot create bidirectional wire: Reverse connection not allowed`)
    }
    
    s.pipe(target.stream)
    if (bidirectional) {
      target.stream.pipe(s)
    }
  }
  
  const onValueChange = (handler: (value: any) => void) => s.subscribe(handler)
  
  const self: Contact = {
    id,
    stream: s,
    getValue,
    setValue,
    wireTo,
    canWireTo,
    onValueChange,
    groupId,
    properties
  }
  
  return self
}

/**
 * Group interface
 */
export interface Group {
  id: string
  parentId?: string
  contacts: Map<ContactId, Contact>
  getBoundaryContacts(): Set<ContactId>
  eventStream: Stream<any>
  properties?: Record<string, any>
  createContact(id: ContactId, blendMode?: BlendMode, isBoundary?: boolean, properties?: Record<string, any>): Contact
  getContact(id: ContactId): Contact | undefined
}

/**
 * Create a group
 */
export function group(id: string, parentId?: string, properties?: Record<string, any>): Group {
  const contacts = new Map<ContactId, Contact>()
  const eventStream = stream<any>()
  
  const createContact = (
    contactId: ContactId,
    blendMode: BlendMode = 'merge',
    isBoundary = false,
    contactProperties: Record<string, any> = {}
  ): Contact => {
    // Add isBoundary to the contact's properties
    const props = { ...contactProperties, isBoundary }
    // All contacts are namespaced to their group
    const qualifiedId = `${id}:${contactId}`
    const c = contact(qualifiedId, blendMode, id, props)
    contacts.set(qualifiedId, c)
    
    // Connect to group event stream
    c.stream.pipe(value => {
      eventStream.write({
        type: 'valueChanged',
        contactId: qualifiedId,
        value
      })
    })
    
    return c
  }
  
  const getContact = (id: ContactId) => contacts.get(id)
  
  const getBoundaryContacts = (): Set<ContactId> => {
    const boundaries = new Set<ContactId>()
    for (const [contactId, c] of contacts) {
      if (c.properties.isBoundary) {
        boundaries.add(contactId)
      }
    }
    return boundaries
  }
  
  return {
    id,
    parentId,
    contacts,
    getBoundaryContacts,
    eventStream,
    properties,
    createContact,
    getContact
  }
}

/**
 * Gadget configuration
 */
export interface GadgetConfig {
  inputs: string[]
  outputs: string[]
  guards?: Array<(inputs: any) => boolean>
  execute: (inputs: any) => any
}

/**
 * Create a gadget
 */
export function gadget(config: GadgetConfig): (g: Group) => void {
  return (g: Group) => {
    const inputValues: Record<string, any> = {}
    
    const tryExecute = () => {
      const inputs = {...inputValues}
      
      // Apply guards
      if (config.guards) {
        for (const guard of config.guards) {
          if (!guard(inputs)) return
        }
      }
      
      // Execute and write to outputs
      const outputs = config.execute(inputs)
      for (const outputName of config.outputs) {
        // All contacts are namespaced to their group
        const qualifiedId = `${g.id}:${outputName}`
        const c = g.getContact(qualifiedId)
        if (c && outputs[outputName] !== undefined) {
          c.setValue(outputs[outputName])
        }
      }
    }
    
    // Subscribe to each input
    for (const inputName of config.inputs) {
      // All contacts are namespaced to their group
      const qualifiedId = `${g.id}:${inputName}`
      const c = g.getContact(qualifiedId)
      
      if (c) {
        // Initialize with current value if any
        const currentValue = c.getValue()
        if (currentValue !== undefined) {
          inputValues[inputName] = currentValue
        }
        
        // Subscribe to changes
        c.onValueChange(value => {
          inputValues[inputName] = value
          tryExecute()
        })
      }
    }
    
    // Try initial execution
    tryExecute()
  }
}

/**
 * Example gadgets using the functional API
 */
export const addGadget = gadget({
  inputs: ['a', 'b'],
  outputs: ['sum'],
  guards: [
    guards.hasInputs('a', 'b'),
    guards.hasTypes({a: 'number', b: 'number'})
  ],
  execute: ({a, b}) => ({sum: a + b})
})

export const multiplyGadget = gadget({
  inputs: ['a', 'b'],
  outputs: ['product'],
  guards: [
    guards.hasInputs('a', 'b'),
    guards.hasTypes({a: 'number', b: 'number'})
  ],
  execute: ({a, b}) => ({product: a * b})
})