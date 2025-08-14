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
  createGroup(groupId: GroupId, primitiveType?: string, properties?: Properties, parentId?: GroupId): Group
  createContact(contactId: ContactId, groupId?: GroupId, blendMode?: BlendMode, properties?: Properties): Contact
  createWire(wireId: WireId, fromId: ContactId, toId: ContactId, bidirectional?: boolean): void
  setValue(contactId: ContactId, value: any): void
  getValue(contactId: ContactId): any
  applyAction(action: any): void
  getBassline(): Bassline
  waitForConvergence(): Promise<void>
  updateStructureContact(groupId: GroupId): void
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
  
  const createGroup = (groupId: GroupId, primitiveType?: string, properties?: Properties, parentId?: GroupId): Group => {
    const g = group(groupId, parentId, properties)
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
        readOnlyFromInside: true,
        isBoundary: true  // Properties is always a boundary contact
      }
    )
    contacts.set(propertiesContact.id, propertiesContact)
    g.contacts.set(propertiesContact.id, propertiesContact)
    propertiesContact.setValue(properties?.defaultProperties || {})
    
    // Setup primitive if specified
    if (primitiveType && primitivesMap.has(primitiveType)) {
      const config = primitivesMap.get(primitiveType)!
      
      // Create boundary contacts for inputs
      for (const inputName of config.inputs) {
        const c = contact(inputName, 'merge', groupId, { isBoundary: true })
        contacts.set(inputName, c)
        g.contacts.set(inputName, c)
      }
      
      // Create boundary contacts for outputs
      for (const outputName of config.outputs) {
        const c = contact(outputName, 'merge', groupId, { isBoundary: true })
        contacts.set(outputName, c)
        g.contacts.set(outputName, c)
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
    
    // Update parent's structure contact if this is a child group
    if (parentId) {
      updateStructureContact(parentId)
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
    
    // Initialize structure contact with current children structure
    if (type === 'structure') {
      const g = groups.get(groupId)
      const includeInternals = g?.properties?.['expose-internals'] || false
      c.setValue(getChildrenStructure(groupId, includeInternals))
    }
    
    // Setup dynamics forwarding
    if (type === 'dynamics') {
      // Subscribe to event stream and forward child events
      eventStream.subscribe(event => {
        // Forward events from child groups
        if (event[0] === 'valueChanged') {
          const contactId = event[1]
          const contact = contacts.get(contactId)
          if (contact?.groupId) {
            const contactGroup = groups.get(contact.groupId)
            if (contactGroup?.parentId === groupId) {
              // This is a child event, forward it
              c.setValue(event)
            }
          }
        }
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
        boundaryContactIds: g.getBoundaryContacts(),
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
  
  const getChildrenStructure = (groupId: GroupId, includeInternals = false): Bassline => {
    const children: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    // Find all child groups
    for (const [id, g] of groups) {
      if (g.parentId === groupId) {
        // Add child group
        children.groups.set(id, {
          contactIds: new Set(g.contacts.keys()),
          boundaryContactIds: g.getBoundaryContacts(),
          parentId: g.parentId,
          properties: g.properties || {}
        })
        
        // Add child's contacts (filtered by includeInternals)
        const boundaryContacts = g.getBoundaryContacts()
        for (const [contactId, contact] of g.contacts) {
          if (includeInternals || boundaryContacts.has(contactId)) {
            children.contacts.set(contactId, {
              content: contact.getValue(),
              groupId: id,
              properties: contact.properties
            })
          }
        }
      }
    }
    
    // Add wires between children's contacts
    for (const [wireId, wire] of wires) {
      if (children.contacts.has(wire.from) && children.contacts.has(wire.to)) {
        children.wires.set(wireId, {
          fromId: wire.from,
          toId: wire.to,
          properties: { bidirectional: wire.bidirectional }
        })
      }
    }
    
    return children
  }
  
  const updateStructureContact = (groupId: GroupId) => {
    const structureContactId = `${groupId}:children:structure`
    const structureContact = contacts.get(structureContactId)
    if (structureContact) {
      const g = groups.get(groupId)
      const includeInternals = g?.properties?.['expose-internals'] || false
      structureContact.setValue(getChildrenStructure(groupId, includeInternals))
    }
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
    waitForConvergence,
    updateStructureContact
  }
  
  return self
}

/**
 * Example usage
 */
export function example() {
  const rt = runtime()
  
  // Create a simple network
  rt.createGroup('group1')
  rt.createContact('input', 'group1')
  rt.createContact('output', 'group1')
  
  rt.createWire('w1', 'input', 'output')
  rt.setValue('input', 42)
  
  console.log(rt.getValue('output')) // 42
}