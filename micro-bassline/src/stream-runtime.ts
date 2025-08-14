/**
 * StreamRuntime: Functional approach
 * 
 * A functional runtime without classes, reducing boilerplate
 */

import { stream, Stream, guards } from './micro-stream'
import { contact, Contact, group, Group, gadget, GadgetConfig } from './stream-contact'
import { fromArray } from './stream-actions'
import {
  Bassline,
  ContactId,
  GroupId,
  WireId,
  BlendMode,
  Properties
} from './types'

export interface Runtime {
  // Core collections
  groups: Map<GroupId, Group>
  contacts: Map<ContactId, Contact>
  wires: Map<WireId, { from: ContactId, to: ContactId, bidirectional: boolean }>
  eventStream: Stream<any>
  
  // Methods
  createGroup(groupId: GroupId, primitiveType?: string, properties?: Properties): Group
  createContact(contactId: ContactId, groupId?: GroupId, blendMode?: BlendMode, properties?: Properties): Contact
  createWire(wireId: WireId, fromId: ContactId, toId: ContactId, bidirectional?: boolean): void
  setValue(contactId: ContactId, value: any): void
  getValue(contactId: ContactId): any
  applyAction(action: any): void
  getBassline(): Bassline
  waitForConvergence(): Promise<void>
}

/**
 * Create a runtime
 */
export function runtime(
  bassline?: Bassline,
  primitives?: Record<string, GadgetConfig>
): Runtime {
  const groups = new Map<GroupId, Group>()
  const contacts = new Map<ContactId, Contact>()
  const wires = new Map<WireId, { from: ContactId, to: ContactId, bidirectional: boolean }>()
  const eventStream = stream<any>()
  const primitivesMap = primitives ? new Map(Object.entries(primitives)) : new Map()
  
  const createGroup = (groupId: GroupId, primitiveType?: string, properties?: Properties): Group => {
    const g = group(groupId)
    groups.set(groupId, g)
    
    // Connect group events
    g.eventStream.pipe(eventStream)
    
    // Create properties contact
    const propertiesContact = contact(
      `${groupId}:properties`,
      'merge',
      groupId,
      {
        isSystemContact: true,
        readOnlyFromInside: true
      }
    )
    contacts.set(propertiesContact.id, propertiesContact)
    g.contacts.set(propertiesContact.id, propertiesContact)
    propertiesContact.setValue(properties?.defaultProperties || {})
    
    // Setup primitive if specified
    if (primitiveType && primitivesMap.has(primitiveType)) {
      const config = primitivesMap.get(primitiveType)!
      
      // Create boundary contacts
      for (const inputName of config.inputs) {
        const c = contact(inputName, 'merge', groupId)
        contacts.set(inputName, c)
        g.contacts.set(inputName, c)
        g.boundaryContacts.add(inputName)
      }
      
      for (const outputName of config.outputs) {
        const c = contact(outputName, 'merge', groupId)
        contacts.set(outputName, c)
        g.contacts.set(outputName, c)
        g.boundaryContacts.add(outputName)
      }
      
      // Apply gadget behavior
      gadget(config)(g)
    }
    
    // Create MGP contacts if opted in
    if (properties?.['expose-structure']) {
      createMGPContact(groupId, 'structure', 'last')
    }
    if (properties?.['expose-dynamics']) {
      createMGPContact(groupId, 'dynamics', 'last')
    }
    if (properties?.['allow-meta-mutation'] && !properties?.['distributed-mode']) {
      const mgpContact = createMGPContact(groupId, 'actions', 'last')
      mgpContact.onValueChange(value => {
        if (Array.isArray(value)) applyAction(value)
      })
    }
    
    return g
  }
  
  const createContact = (
    contactId: ContactId,
    groupId?: GroupId,
    blendMode: BlendMode = 'merge',
    properties?: Properties
  ): Contact => {
    const c = contact(contactId, blendMode, groupId, properties || {})
    contacts.set(contactId, c)
    
    if (groupId) {
      const g = groups.get(groupId)
      if (g) g.contacts.set(contactId, c)
    }
    
    c.onValueChange(value => {
      eventStream.write(['valueChanged', contactId, c.getValue(), value])
    })
    
    return c
  }
  
  const createWire = (
    wireId: WireId,
    fromId: ContactId,
    toId: ContactId,
    bidirectional = true
  ): void => {
    const from = contacts.get(fromId)
    const to = contacts.get(toId)
    
    if (!from || !to) {
      throw new Error(`Wire endpoints not found: ${fromId} -> ${toId}`)
    }
    
    from.wireTo(to, bidirectional)
    wires.set(wireId, { from: fromId, to: toId, bidirectional })
    eventStream.write(['propagating', fromId, toId, from.getValue()])
  }
  
  const setValue = (contactId: ContactId, value: any): void => {
    const c = contacts.get(contactId)
    if (!c) throw new Error(`Contact ${contactId} not found`)
    c.setValue(value)
  }
  
  const getValue = (contactId: ContactId): any => {
    return contacts.get(contactId)?.getValue()
  }
  
  const createMGPContact = (groupId: GroupId, type: string, blendMode: BlendMode): Contact => {
    const c = createContact(
      `${groupId}:children:${type}`,
      groupId,
      blendMode,
      {
        isSystemContact: true,
        isMGPContact: true,
        isDangerous: type === 'actions'
      }
    )
    
    // Initialize structure contact with empty structure
    if (type === 'structure') {
      c.setValue({
        contacts: new Map(),
        wires: new Map(),
        groups: new Map()
      })
    }
    
    return c
  }
  
  const applyAction = (action: any): void => {
    if ('apply' in action && typeof action.apply === 'function') {
      action.apply(self)
      return
    }
    
    // Legacy array format support - convert to action object
    if (Array.isArray(action)) {
      const actionObj = fromArray(action)
      actionObj.apply(self)
      return
    }
    
    throw new Error(`Invalid action format`)
  }
  
  const getBassline = (): Bassline => {
    const result: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    for (const [id, c] of contacts) {
      result.contacts.set(id, {
        content: c.getValue(),
        groupId: c.groupId,
        properties: c.properties
      })
    }
    
    for (const [id, g] of groups) {
      result.groups.set(id, {
        contactIds: new Set(g.contacts.keys()),
        boundaryContactIds: g.boundaryContacts,
        properties: {}
      })
    }
    
    for (const [id, w] of wires) {
      result.wires.set(id, {
        fromId: w.from,
        toId: w.to,
        properties: { bidirectional: w.bidirectional }
      })
    }
    
    return result
  }
  
  const waitForConvergence = async (): Promise<void> => {
    // Streams handle convergence naturally
    return new Promise(resolve => setTimeout(resolve, 0))
  }
  
  // Load initial bassline if provided
  if (bassline) {
    // Create groups
    for (const [id, g] of bassline.groups) {
      createGroup(id, g.primitiveType, g.properties)
    }
    
    // Create contacts
    for (const [id, c] of bassline.contacts) {
      createContact(id, c.groupId, c.properties?.blendMode || 'merge', c.properties)
      if (c.content !== undefined) setValue(id, c.content)
    }
    
    // Create wires
    for (const [id, w] of bassline.wires) {
      createWire(id, w.fromId, w.toId, w.properties?.bidirectional !== false)
    }
  }
  
  const self: Runtime = {
    groups,
    contacts,
    wires,
    eventStream,
    createGroup,
    createContact,
    createWire,
    setValue,
    getValue,
    applyAction,
    getBassline,
    waitForConvergence
  }
  
  return self
}

/**
 * Example usage
 */
export function example() {
  const rt = runtime()
  
  // Create a simple network
  const g1 = rt.createGroup('group1')
  const c1 = rt.createContact('input', 'group1')
  const c2 = rt.createContact('output', 'group1')
  
  rt.createWire('w1', 'input', 'output')
  rt.setValue('input', 42)
  
  console.log(rt.getValue('output')) // 42
}