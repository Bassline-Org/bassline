/**
 * Micro-Bassline Runtime Engine
 * 
 * The execution machinery for propagation networks.
 * Handles both value semantics (with deduplication) and stream semantics (no deduplication).
 */

import {
  Bassline,
  ContactId,
  GroupId,
  WireId,
  ReifiedContact,
  ReifiedGroup,
  ReifiedWire,
  PropagationEvent,
  Action,
  ActionSet,
  PrimitiveGadget,
  RuntimeContext,
  mergeValues,
  valuesEqual,
  Contradiction
} from './types'

import {
  CrossPlatformEventEmitter
} from './event-emitter'
import { getPrimitives } from './primitives'
import { createBasslineGadget } from './bassline-gadget'

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Options for getBassline snapshot.
 */
export interface GetBasslineOptions {
  includeValues?: boolean      // Include current runtime values (default: true)
  includeProperties?: boolean   // Include properties (default: true)
  groupId?: GroupId            // Only include this group and its contents
}

// ============================================================================
// Runtime Engine
// ============================================================================

export class Runtime extends CrossPlatformEventEmitter {
  private context: RuntimeContext
  private propagationQueue: Array<[ContactId, any, ContactId?]> = []
  private isProcessing = false
  private parentRuntime?: Runtime
  
  constructor(bassline: Bassline, primitives?: Map<string, PrimitiveGadget>, parentRuntime?: Runtime) {
    super()
    this.parentRuntime = parentRuntime
    
    // Initialize primitives with defaults if not provided
    const defaultPrimitives = this.getDefaultPrimitives()
    
    this.context = {
      bassline,
      values: new Map(),
      primitives: primitives || defaultPrimitives,
      eventStream: []
    }
    
    // Register BasslineGadgets for groups that need them
    this.registerBasslineGadgets()
    
    // Set up primitive request handler
    this.setupPrimitiveHandler()
    
    // Initialize contact values with proper propagation
    for (const [id, contact] of bassline.contacts) {
      if (contact.content !== undefined) {
        // Use setValue to trigger proper propagation
        this.setValue(id, contact.content)
      }
    }
  }
  
  private setupPrimitiveHandler(): void {
    // Listen for primitive requests and handle them
    this.on('propagation', (eventOrData: any) => {
      // Handle both CustomEvent (browser) and direct data (Node.js)
      const event: PropagationEvent = eventOrData?.detail || eventOrData
      if (!event) {
        return
      }
      if (event[0] === 'primitive-requested') {
        const [, groupId, primitiveType, inputs] = event
        this.handlePrimitiveRequest(groupId, primitiveType, inputs)
      } else if (event[0] === 'primitive-executed') {
        const [, groupId, primitiveType, outputs] = event
        this.handlePrimitiveExecuted(groupId, primitiveType, outputs)
      }
    })
  }
  
  private handlePrimitiveRequest(groupId: GroupId, primitiveType: string, inputs: Map<string, any>): void {
    // Look up primitive
    const primitive = this.context.primitives.get(primitiveType)
    
    if (!primitive) {
      // If not found locally and we have a parent, let parent handle it
      if (this.parentRuntime) {
        // Parent will handle via its own event listener
        return
      }
      // No primitive found anywhere
      this.emitEvent(['primitive-failed', groupId, primitiveType, `Primitive '${primitiveType}' not found`])
      return
    }
    
    // Remove internal stream timestamp before passing to primitive
    const cleanInputs = new Map(inputs)
    cleanInputs.delete('_streamTimestamp')
    
    // Check activation
    if (!primitive.activation(cleanInputs)) {
      // Not activated, no execution
      return
    }
    
    try {
      // Execute the primitive synchronously
      const outputs = primitive.execute(cleanInputs)
      
      // Emit success event (this will also trigger handlePrimitiveExecuted)
      this.emitEvent(['primitive-executed', groupId, primitiveType, outputs])
    } catch (error) {
      this.emitEvent(['primitive-failed', groupId, primitiveType, String(error)])
    }
  }
  
  private handlePrimitiveExecuted(groupId: GroupId, primitiveType: string, outputs: Map<string, any>): void {
    // Update the group's output contacts with the execution results
    const group = this.context.bassline.groups.get(groupId)
    if (group) {
      for (const [outputName, value] of outputs) {
        const boundaryId = this.findBoundaryContact(group, outputName)
        if (boundaryId) {
          const contact = this.context.bassline.contacts.get(boundaryId)
          if (contact?.properties?.blendMode === 'last') {
            // Stream contact
            if (Array.isArray(value)) {
              for (const item of value) {
                this.sendStream(boundaryId, item)
              }
            } else {
              this.sendStream(boundaryId, value)
            }
          } else {
            // Value contact
            this.setValue(boundaryId, value)
          }
        }
      }
      
      // Emit gadget activation event  
      this.emitEvent(['gadgetActivated', groupId, new Map(), outputs])
    }
  }
  
  private getDefaultPrimitives(): Map<string, PrimitiveGadget> {
    return getPrimitives()
  }
  
  private registerBasslineGadgets(): void {
    // For each group with primitiveType 'bassline', create and register a BasslineGadget
    for (const [groupId, group] of this.context.bassline.groups) {
      if (group.primitiveType === 'bassline') {
        const basslineGadget = this.createBasslineGadgetForGroup(groupId)
        this.context.primitives.set(`bassline-${groupId}`, basslineGadget)
        // Update the group to reference the specific instance
        group.primitiveType = `bassline-${groupId}`
      }
    }
  }
  
  private createBasslineGadgetForGroup(groupId: GroupId): PrimitiveGadget {
    
    // Find the events output contact for this group
    const findEventsContact = (): ContactId | undefined => {
      const group = this.context.bassline.groups.get(groupId)
      if (!group) return undefined
      
      for (const boundaryId of group.boundaryContactIds) {
        const contact = this.context.bassline.contacts.get(boundaryId)
        if (contact?.properties?.name === 'events') {
          return boundaryId
        }
      }
      return undefined
    }
    
    return createBasslineGadget(
      // Get bassline for this group
      () => this.getBassline({ groupId }),
      
      // Apply actions
      (actionSet: ActionSet) => this.applyActions(actionSet),
      
      // Group ID
      groupId,
      
      // Event emitter
      (listener: (event: PropagationEvent) => void) => {
        return this.onEvent(listener)
      },
      
      // Check if events output is wired
      () => {
        const eventsContactId = findEventsContact()
        if (!eventsContactId) return false
        
        // Check if this contact has any outgoing wires
        for (const [, wire] of this.context.bassline.wires) {
          if (wire.fromId === eventsContactId) return true
        }
        return false
      },
      
      // Push event directly to stream contact
      (event: PropagationEvent) => {
        const eventsContactId = findEventsContact()
        if (eventsContactId) {
          // Queue the event as a propagation task
          // This ensures events flow through the network immediately
          this.propagationQueue.push([eventsContactId, event, undefined])
          
          // Process the queue if not already processing
          if (!this.isProcessing) {
            this.processPropagationQueue()
          }
        }
      }
    )
  }
  
  // ==========================================================================
  // Public API
  // ==========================================================================
  
  /**
   * Register a primitive gadget.
   */
  registerPrimitive(name: string, primitive: PrimitiveGadget): void {
    this.context.primitives.set(name, primitive)
  }
  
  /**
   * Get a registered primitive gadget.
   */
  getPrimitive(name: string): PrimitiveGadget | undefined {
    return this.context.primitives.get(name)
  }
  
  /**
   * Get all registered primitives.
   */
  getPrimitives(): Map<string, PrimitiveGadget> {
    return this.context.primitives
  }
  
  /**
   * Get the current value of a contact.
   */
  getValue(contactId: ContactId): any {
    return this.context.values.get(contactId)
  }
  
  /**
   * Wait for the runtime to converge (all propagation and primitive execution complete).
   * Returns a promise that resolves when the network has converged.
   */
  waitForConvergence(): Promise<void> {
    return new Promise(resolve => {
      // Check if we're already processing or have work queued
      if (this.propagationQueue.length > 0 || this.isProcessing) {
        // Wait for the converged event
        const listener = (eventOrData: any) => {
          const event: PropagationEvent = eventOrData?.detail || eventOrData
          if (event && event[0] === 'converged') {
            this.off('propagation', listener)
            resolve()
          }
        }
        this.on('propagation', listener)
      } else {
        // No work pending, but ensure we process any pending events first
        // Use setImmediate/setTimeout to allow pending events to be processed
        setTimeout(() => {
          if (this.propagationQueue.length === 0 && !this.isProcessing) {
            resolve()
          } else {
            // Work appeared, wait for convergence
            const listener = (eventOrData: any) => {
              const event: PropagationEvent = eventOrData?.detail || eventOrData
              if (event && event[0] === 'converged') {
                this.off('propagation', listener)
                resolve()
              }
            }
            this.on('propagation', listener)
          }
        }, 0)
      }
    })
  }
  
  /**
   * Set the value of a contact, triggering propagation.
   */
  setValue(contactId: ContactId, value: any): void {
    const contact = this.context.bassline.contacts.get(contactId)
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`)
    }
    
    // Use propagateValue which handles blend modes correctly
    // Pass undefined for fromContactId to indicate external source
    this.propagateValue(contactId, value, undefined)
    this.processPropagationQueue()
  }
  
  /**
   * Apply an action to the network.
   */
  applyAction(action: Action): void {
    const actionType = action[0]
    
    switch (actionType) {
      case 'setValue': {
        const [, contactId, value] = action
        this.setValue(contactId, value)
        break
      }
      
      case 'createContact': {
        const [, contactId, groupId, properties] = action
        
        // Validate contact doesn't already exist
        if (this.context.bassline.contacts.has(contactId)) {
          throw new Error(`Contact ${contactId} already exists`)
        }
        
        // Validate group exists if specified
        if (groupId && !this.context.bassline.groups.has(groupId)) {
          throw new Error(`Group ${groupId} does not exist`)
        }
        
        const contact: ReifiedContact = { groupId, properties }
        this.context.bassline.contacts.set(contactId, contact)
        
        // Add to group if specified
        if (groupId) {
          const group = this.context.bassline.groups.get(groupId)
          if (group) {
            group.contactIds.add(contactId)
          }
        }
        break
      }
      
      case 'deleteContact': {
        const [, contactId] = action
        this.context.bassline.contacts.delete(contactId)
        this.context.values.delete(contactId)
        
        // Remove from groups
        for (const group of this.context.bassline.groups.values()) {
          group.contactIds.delete(contactId)
          group.boundaryContactIds.delete(contactId)
        }
        
        // Remove connected wires
        for (const [wireId, wire] of this.context.bassline.wires) {
          if (wire.fromId === contactId || wire.toId === contactId) {
            this.context.bassline.wires.delete(wireId)
          }
        }
        break
      }
      
      case 'createWire': {
        const [, wireId, fromId, toId, properties] = action
        
        // Validate wire doesn't already exist
        if (this.context.bassline.wires.has(wireId)) {
          throw new Error(`Wire ${wireId} already exists`)
        }
        
        // Validate endpoints exist
        if (!this.context.bassline.contacts.has(fromId)) {
          throw new Error(`Wire source contact ${fromId} does not exist`)
        }
        if (!this.context.bassline.contacts.has(toId)) {
          throw new Error(`Wire target contact ${toId} does not exist`)
        }
        
        // Check wire direction enforcement for properties contacts
        const fromContact = this.context.bassline.contacts.get(fromId)
        const toContact = this.context.bassline.contacts.get(toId)
        
        // If wiring TO a properties contact from inside the same group, block it
        if (toContact?.properties?.readOnlyFromInside) {
          // Extract group ID from properties contact ID (format: ${groupId}:properties)
          const match = toId.match(/^(.+):properties$/)
          if (match) {
            const propertiesGroupId = match[1]
            // Check if source is from inside the same group
            if (fromContact?.groupId === propertiesGroupId) {
              throw new Error(
                `Cannot wire from inside group to its properties contact. ` +
                `Properties are read-only from inside the group. ` +
                `Use directed wire FROM properties TO internal contacts instead.`
              )
            }
          }
        }
        
        this.context.bassline.wires.set(wireId, { fromId, toId, properties })
        break
      }
      
      case 'deleteWire': {
        const [, wireId] = action
        this.context.bassline.wires.delete(wireId)
        break
      }
      
      case 'createGroup': {
        const [, groupId, parentId, properties] = action
        
        // Validate group doesn't already exist
        if (this.context.bassline.groups.has(groupId)) {
          throw new Error(`Group ${groupId} already exists`)
        }
        
        // Validate parent exists if specified
        if (parentId && !this.context.bassline.groups.has(parentId)) {
          throw new Error(`Parent group ${parentId} does not exist`)
        }
        
        // Extract defaultProperties if provided
        const defaultProperties = properties?.defaultProperties
        const otherProperties = { ...properties }
        delete otherProperties.defaultProperties
        
        // Create the group
        const group: ReifiedGroup = {
          parentId: parentId || undefined,
          contactIds: new Set(),
          boundaryContactIds: new Set(),
          defaultProperties,
          properties: otherProperties
        }
        this.context.bassline.groups.set(groupId, group)
        
        // Auto-create properties contact for the group
        const propertiesContactId = `${groupId}:properties`
        const propertiesContact: ReifiedContact = {
          content: defaultProperties || {},
          groupId,
          properties: {
            blendMode: 'merge',
            isSystemContact: true,
            readOnlyFromInside: true
          }
        }
        this.context.bassline.contacts.set(propertiesContactId, propertiesContact)
        group.contactIds.add(propertiesContactId)
        group.boundaryContactIds.add(propertiesContactId)
        
        // Initialize the properties value
        this.context.values.set(propertiesContactId, defaultProperties || {})
        
        break
      }
      
      case 'deleteGroup': {
        const [, groupId] = action
        const group = this.context.bassline.groups.get(groupId)
        if (group) {
          // Delete all contacts in the group
          for (const contactId of group.contactIds) {
            this.applyAction(['deleteContact', contactId])
          }
          this.context.bassline.groups.delete(groupId)
        }
        break
      }
      
      case 'updateProperties': {
        const [, entityId, properties] = action
        // Try as contact first
        const contact = this.context.bassline.contacts.get(entityId)
        if (contact) {
          contact.properties = { ...contact.properties, ...properties }
          return
        }
        
        // Try as wire
        const wire = this.context.bassline.wires.get(entityId)
        if (wire) {
          wire.properties = { ...wire.properties, ...properties }
          return
        }
        
        // Try as group
        const group = this.context.bassline.groups.get(entityId)
        if (group) {
          group.properties = { ...group.properties, ...properties }
          return
        }
        
        // Entity not found
        throw new Error(`Entity ${entityId} not found for updateProperties action`)
      }
      
      default:
        throw new Error(`Unknown action type: ${actionType}`)
    }
  }
  
  /**
   * Apply multiple actions.
   */
  applyActions(actionSet: ActionSet): void {
    for (const action of actionSet.actions) {
      this.applyAction(action)
    }
  }
  
  /**
   * Apply structure changes for dynamic gadgets.
   * This allows injecting and removing network structures dynamically.
   */
  applyStructureChanges(changes: {
    contactsToAdd: Map<ContactId, ReifiedContact>
    wiresToAdd: Map<WireId, ReifiedWire>
    groupsToAdd: Map<GroupId, ReifiedGroup>
    mappingWiresToAdd: Map<WireId, ReifiedWire>
    contactsToRemove: Set<ContactId>
    wiresToRemove: Set<WireId>
    groupsToRemove: Set<GroupId>
  }): void {
    // Remove structures first
    for (const groupId of changes.groupsToRemove) {
      this.context.bassline.groups.delete(groupId)
    }
    
    for (const wireId of changes.wiresToRemove) {
      this.context.bassline.wires.delete(wireId)
    }
    
    for (const contactId of changes.contactsToRemove) {
      this.context.bassline.contacts.delete(contactId)
      this.context.values.delete(contactId)
    }
    
    // Add new structures
    for (const [contactId, contact] of changes.contactsToAdd) {
      this.context.bassline.contacts.set(contactId, contact)
      if (contact.content !== undefined) {
        this.context.values.set(contactId, contact.content)
      }
    }
    
    for (const [groupId, group] of changes.groupsToAdd) {
      this.context.bassline.groups.set(groupId, group)
      // Register BasslineGadget if needed
      if (group.primitiveType === 'bassline') {
        const basslineGadget = this.createBasslineGadgetForGroup(groupId)
        this.context.primitives.set(`bassline-${groupId}`, basslineGadget)
        group.primitiveType = `bassline-${groupId}`
      }
    }
    
    for (const [wireId, wire] of changes.wiresToAdd) {
      this.context.bassline.wires.set(wireId, wire)
    }
    
    for (const [wireId, wire] of changes.mappingWiresToAdd) {
      this.context.bassline.wires.set(wireId, wire)
    }
    
    // Trigger propagation for any new wires connecting existing values
    for (const [, wire] of [...changes.wiresToAdd, ...changes.mappingWiresToAdd]) {
      const fromValue = this.context.values.get(wire.fromId)
      if (fromValue !== undefined) {
        this.propagationQueue.push([wire.toId, fromValue, wire.fromId])
      }
    }
    
    // Process any pending propagation
    if (this.propagationQueue.length > 0) {
      this.processPropagationQueue()
    }
  }
  
  /**
   * Subscribe to propagation events.
   */
  onEvent(listener: (event: PropagationEvent) => void): () => void {
    // Wrap listener to handle both CustomEvent and direct data
    const wrappedListener = (eventOrData: any) => {
      const event: PropagationEvent = eventOrData?.detail || eventOrData
      if (event) {
        listener(event)
      }
    }
    this.on('propagation', wrappedListener)
    return () => this.off('propagation', wrappedListener)
  }
  
  /**
   * Get the current bassline structure with optional computed values.
   * This creates a snapshot of the network.
   */
  getBassline(options: GetBasslineOptions = {}): Bassline {
    const {
      includeValues = true,
      includeProperties = true,
      groupId
    } = options
    
    // Create a deep copy of the bassline structure
    const bassline: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map(),
      properties: includeProperties ? this.context.bassline.properties : undefined
    }
    
    // If filtering by group, collect relevant contacts
    let relevantContactIds: Set<ContactId> | null = null
    if (groupId) {
      const group = this.context.bassline.groups.get(groupId)
      if (group) {
        relevantContactIds = new Set(group.contactIds)
      } else {
        // Group not found, return empty bassline
        return bassline
      }
    }
    
    // Copy contacts
    for (const [id, contact] of this.context.bassline.contacts) {
      // Skip if filtering by group and contact not in group
      if (relevantContactIds && !relevantContactIds.has(id)) {
        continue
      }
      
      bassline.contacts.set(id, {
        content: includeValues ? this.context.values.get(id) : contact.content,
        groupId: contact.groupId,
        properties: includeProperties && contact.properties 
          ? { ...contact.properties } 
          : undefined
      })
    }
    
    // Copy wires
    for (const [id, wire] of this.context.bassline.wires) {
      // Skip if filtering by group and wire doesn't connect relevant contacts
      if (relevantContactIds && 
          (!relevantContactIds.has(wire.fromId) || !relevantContactIds.has(wire.toId))) {
        continue
      }
      
      bassline.wires.set(id, {
        fromId: wire.fromId,
        toId: wire.toId,
        properties: includeProperties && wire.properties 
          ? { ...wire.properties } 
          : undefined
      })
    }
    
    // Copy groups
    if (groupId) {
      // Only include the specified group
      const group = this.context.bassline.groups.get(groupId)
      if (group) {
        bassline.groups.set(groupId, {
          parentId: group.parentId,
          contactIds: new Set(group.contactIds),
          boundaryContactIds: new Set(group.boundaryContactIds),
          primitiveType: group.primitiveType,
          properties: includeProperties && group.properties 
            ? { ...group.properties } 
            : undefined
        })
      }
    } else {
      // Include all groups
      for (const [id, group] of this.context.bassline.groups) {
        bassline.groups.set(id, {
          parentId: group.parentId,
          contactIds: new Set(group.contactIds),
          boundaryContactIds: new Set(group.boundaryContactIds),
          primitiveType: group.primitiveType,
          properties: includeProperties && group.properties 
            ? { ...group.properties } 
            : undefined
        })
      }
    }
    
    return bassline
  }
  
  // ==========================================================================
  // Propagation Logic
  // ==========================================================================
  
  private propagateValue(contactId: ContactId, value: any, fromContactId?: ContactId): void {
    const contact = this.context.bassline.contacts.get(contactId)
    if (!contact) {
      // Check if we should throw or just warn
      if (this.context.bassline.properties?.['throw-on-missing-contact']) {
        throw new Error(`Cannot propagate to non-existent contact: ${contactId}`)
      } else {
        console.warn(`WARNING: Cannot propagate to non-existent contact: ${contactId}`)
        return
      }
    }
    
    // Check if this is a properties contact being written from inside
    if (contact.properties?.readOnlyFromInside && fromContactId) {
      // Extract group ID from properties contact ID
      const match = contactId.match(/^(.+):properties$/)
      if (match) {
        const propertiesGroupId = match[1]
        const fromContact = this.context.bassline.contacts.get(fromContactId)
        // Block propagation from inside the same group
        if (fromContact?.groupId === propertiesGroupId) {
          console.warn(
            `Blocked propagation to read-only properties contact ${contactId} from inside group`
          )
          return
        }
      }
    }
    
    const blendMode = contact.properties?.blendMode || 'merge'
    const currentValue = this.context.values.get(contactId)
    
    // Apply blend mode
    let newValue: any
    try {
      newValue = currentValue !== undefined
        ? mergeValues(currentValue, value, blendMode)
        : value
    } catch (error) {
      if (error instanceof Contradiction) {
        // Handle contradiction - emit event and stop propagation for this value
        this.emitEvent(['contradiction', contactId, error.current, error.incoming] as any)
        console.warn(`Contradiction at contact ${contactId}:`, error.message)
        return
      }
      throw error  // Re-throw non-contradiction errors
    }
    
    // For 'last' mode (streams), always propagate even if value is same
    // For 'merge' mode, only propagate if changed
    if (blendMode === 'merge' && currentValue !== undefined && valuesEqual(currentValue, newValue)) {
      return  // No change, don't propagate
    }
    
    // Emit event
    // For 'last' mode (streams), always emit even for initial value
    // For 'merge' mode, only emit if there was a previous value
    if (blendMode === 'last' || currentValue !== undefined) {
      this.emitEvent(['valueChanged', contactId, currentValue, newValue])
    }
    
    // Update stored value
    this.context.values.set(contactId, newValue)
    
    // Queue propagation to connected contacts
    for (const [, wire] of this.context.bassline.wires) {
      const isBidirectional = wire.properties?.bidirectional !== false  // Default true
      
      if (wire.fromId === contactId && wire.toId !== fromContactId) {
        this.propagationQueue.push([wire.toId, newValue, contactId])
        this.emitEvent(['propagating', contactId, wire.toId, newValue])
      }
      // Bidirectional propagation (constraint semantics)
      if (isBidirectional && wire.toId === contactId && wire.fromId !== fromContactId) {
        this.propagationQueue.push([wire.fromId, newValue, contactId])
        this.emitEvent(['propagating', contactId, wire.fromId, newValue])
      }
    }
    
    // Check for gadget activation
    this.checkGadgetActivation(contactId)
  }
  
  private processPropagationQueue(): void {
    if (this.isProcessing) return
    this.isProcessing = true
    
    while (this.propagationQueue.length > 0) {
      const [contactId, value, fromContactId] = this.propagationQueue.shift()!
      this.propagateValue(contactId, value, fromContactId)
    }
    
    this.isProcessing = false
    
    // Network has converged
    if (this.propagationQueue.length === 0) {
      this.emitEvent(['converged'])
    }
  }
  
  private checkGadgetActivation(contactId: ContactId): void {
    const changedContact = this.context.bassline.contacts.get(contactId)
    if (!changedContact) return
    
    // Check all groups that have this contact as a boundary
    for (const [groupId, group] of this.context.bassline.groups) {
      if (!group.primitiveType || !group.boundaryContactIds.has(contactId)) {
        continue
      }
      
      // Get the primitive to check if this contact is an input
      const primitive = this.context.primitives.get(group.primitiveType)
      if (!primitive) {
        continue
      }
      
      // IMPORTANT: Only trigger if this contact is an INPUT to this gadget
      const contactName = changedContact.properties?.name
      if (!contactName) {
        continue
      }
      
      // Check if this is an output - if so, skip activation
      if (primitive.outputs.includes(contactName)) {
        // This is an output contact, don't trigger the primitive
        continue
      }
      
      // Check if this is an input
      if (!primitive.inputs.includes(contactName)) {
        // This contact is not an input to this gadget
        continue
      }
      
      // Check if this is a stream-triggered activation
      const isStreamTriggered = changedContact.properties?.blendMode === 'last'
      
      // Collect input values
      const inputs = new Map<string, any>()
      let hasAllInputs = true
      
      for (const inputName of primitive.inputs) {
        // Find the boundary contact with this name
        const boundaryId = this.findBoundaryContact(group, inputName)
        if (!boundaryId) {
          hasAllInputs = false
          break
        }
        
        const boundaryContact = this.context.bassline.contacts.get(boundaryId)
        
        // All contacts now store values (even streams with 'last' mode)
        const value = this.context.values.get(boundaryId)
        if (value === undefined) {
          hasAllInputs = false
          break
        }
        inputs.set(inputName, value)
      }
      
      // Emit primitive request event if we have all inputs
      if (hasAllInputs) {
        // For stream-triggered primitives, include a timestamp to make each execution unique
        const requestInputs = isStreamTriggered 
          ? new Map([...inputs, ['_streamTimestamp', Date.now()]])
          : inputs
        this.emitEvent(['primitive-requested', groupId, group.primitiveType, requestInputs])
      }
    }
  }
  
  private findBoundaryContact(group: ReifiedGroup, name: string): ContactId | undefined {
    // Look for a boundary contact with matching name in properties
    for (const contactId of group.boundaryContactIds) {
      const contact = this.context.bassline.contacts.get(contactId)
      if (contact?.properties?.name === name) {
        return contactId
      }
    }
    return undefined
  }
  
  private emitEvent(event: PropagationEvent): void {
    // Store in event stream if collecting
    if (this.context.eventStream) {
      this.context.eventStream.push(event)
    }
    
    // Emit using our cross-platform event system
    this.emit('propagation', event)
  }
  
  // ==========================================================================
  // Stream Support
  // ==========================================================================
  
  /**
   * Send a value through a stream contact (blendMode: 'last').
   * Each value triggers downstream propagation.
   */
  sendStream(contactId: ContactId, value: any): void {
    const contact = this.context.bassline.contacts.get(contactId)
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`)
    }
    
    if (contact.properties?.blendMode !== 'last') {
      throw new Error(`Contact ${contactId} is not a stream (blendMode must be 'last')`)
    }
    
    // Stream contacts always propagate with latest value
    // Pass undefined for fromContactId to indicate external source
    this.propagateValue(contactId, value, undefined)
    this.processPropagationQueue()
  }
  
  /**
   * Start collecting events into the event stream.
   */
  startEventCollection(): void {
    this.context.eventStream = []
  }
  
  /**
   * Stop collecting events and return the collected stream.
   */
  stopEventCollection(): PropagationEvent[] {
    const events = this.context.eventStream || []
    this.context.eventStream = undefined
    return events
  }
}