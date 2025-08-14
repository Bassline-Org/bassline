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
  
  // Track which groups have dirty structure contacts
  const dirtyStructures = new Set<GroupId>()
  const structureCache = new Map<GroupId, any>()
  
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
      if (g) {
        g.contacts.set(contactId, c)
        // Update parent's structure contact when adding a contact
        if (g.parentId) {
          updateStructureContact(g.parentId)
        }
      }
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
    
    // Update structure if wire connects contacts in child groups
    const fromGroup = from.groupId ? groups.get(from.groupId) : null
    const toGroup = to.groupId ? groups.get(to.groupId) : null
    const parentGroups = new Set<GroupId>()
    
    if (fromGroup?.parentId) parentGroups.add(fromGroup.parentId)
    if (toGroup?.parentId) parentGroups.add(toGroup.parentId)
    
    for (const parentId of parentGroups) {
      updateStructureContact(parentId)
    }
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
    
    // Initialize structure contact with lazy computation
    if (type === 'structure') {
      // Store original methods
      const originalGetValue = c.getValue
      const originalSetValue = c.setValue
      
      // Override getValue to compute structure on-demand
      c.getValue = () => {
        if (dirtyStructures.has(groupId)) {
          // Compute structure now
          const g = groups.get(groupId)
          const includeInternals = g?.properties?.['expose-internals'] || false
          const structure = getChildrenStructure(groupId, includeInternals)
          
          // Cache it
          structureCache.set(groupId, structure)
          dirtyStructures.delete(groupId)
          
          // Store in contact without triggering notifications
          ;(c as any).currentValue = structure
        }
        
        // Return cached value or current value
        return structureCache.get(groupId) || originalGetValue()
      }
      
      // Override setValue to update cache
      c.setValue = (value: any) => {
        structureCache.set(groupId, value)
        dirtyStructures.delete(groupId)
        originalSetValue(value)
      }
      
      // Mark as dirty initially to compute on first read
      dirtyStructures.add(groupId)
    }
    
    // Setup dynamics forwarding
    if (type === 'dynamics') {
      // Helper to check if a group is a descendant of the parent
      const isDescendantOf = (childId: GroupId, parentId: GroupId): boolean => {
        const child = groups.get(childId)
        if (!child) return false
        if (child.parentId === parentId) return true
        if (child.parentId) return isDescendantOf(child.parentId, parentId)
        return false
      }
      
      // Subscribe to event stream and forward descendant events
      eventStream.subscribe(event => {
        // Forward events from descendant groups
        if (event[0] === 'valueChanged') {
          const contactId = event[1]
          const contact = contacts.get(contactId)
          if (contact?.groupId) {
            // Check if this contact belongs to a descendant group
            if (isDescendantOf(contact.groupId, groupId)) {
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
  
  
  // Simple hash function for structure comparison
  const hashStructure = (structure: Bassline): string => {
    // Create a sorted string representation of the structure
    const parts: string[] = []
    
    // Hash groups
    const groupIds = Array.from(structure.groups.keys()).sort()
    for (const id of groupIds) {
      const g = structure.groups.get(id)!
      parts.push(`g:${id}:${g.parentId || ''}`)
    }
    
    // Hash contacts  
    const contactIds = Array.from(structure.contacts.keys()).sort()
    for (const id of contactIds) {
      const c = structure.contacts.get(id)!
      parts.push(`c:${id}:${c.groupId || ''}`)
    }
    
    // Hash wires
    const wireIds = Array.from(structure.wires.keys()).sort()
    for (const id of wireIds) {
      const w = structure.wires.get(id)!
      parts.push(`w:${id}:${w.fromId}:${w.toId}`)
    }
    
    return parts.join('|')
  }
  
  const getChildrenStructure = (groupId: GroupId, includeInternals = false): Bassline & { structureHash?: string } => {
    const children: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    // Recursively find all descendant groups
    const addGroupAndDescendants = (parentId: GroupId) => {
      for (const [id, g] of groups) {
        if (g.parentId === parentId) {
          // Add this group
          children.groups.set(id, {
            contactIds: new Set(g.contacts.keys()),
            boundaryContactIds: g.getBoundaryContacts(),
            parentId: g.parentId,
            properties: g.properties || {}
          })
          
          // Add this group's contacts (filtered by includeInternals)
          const boundaryContacts = g.getBoundaryContacts()
          for (const [contactId, contact] of g.contacts) {
            if (includeInternals || boundaryContacts.has(contactId)) {
              children.contacts.set(contactId, {
                // Structure only - no content values
                groupId: id,
                properties: contact.properties
              })
            }
          }
          
          // Recursively add descendants
          addGroupAndDescendants(id)
        }
      }
    }
    
    // Start recursive traversal from the given groupId
    addGroupAndDescendants(groupId)
    
    // Add wires between all descendant contacts
    for (const [wireId, wire] of wires) {
      if (children.contacts.has(wire.from) && children.contacts.has(wire.to)) {
        children.wires.set(wireId, {
          fromId: wire.from,
          toId: wire.to,
          properties: { bidirectional: wire.bidirectional }
        })
      }
    }
    
    // Add a hash for fast comparison
    ;(children as any).structureHash = hashStructure(children)
    
    return children as Bassline & { structureHash?: string }
  }
  
  const markStructureDirty = (groupId: GroupId) => {
    // Mark this group's structure as dirty
    dirtyStructures.add(groupId)
    structureCache.delete(groupId)
    
    // Check if anyone is listening to the structure contact
    const structureContactId = `${groupId}:children:structure`
    const structureContact = contacts.get(structureContactId)
    if (structureContact) {
      // Always compute and notify for now to fix the test
      // TODO: Optimize this to only compute when there are subscribers
      const newStructure = structureContact.getValue() // This triggers lazy computation
      // The getValue already cached it, just write to stream to notify subscribers
      structureContact.stream.write(newStructure)
    }
  }
  
  const updateStructureContact = markStructureDirty // Alias for compatibility
  
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