import type { 
  Contact, 
  Wire, 
  GroupState, 
  NetworkState, 
  PropagationTask, 
  ContactUpdate, 
  Contradiction,
  PropagationResult,
  Group
} from '../types'

// Pure function that calculates propagation changes
export async function propagateContent(
  state: NetworkState,
  sourceContactId: string,
  newContent: unknown,
  sourceId?: string
): Promise<PropagationResult> {
  const startTime = performance.now()
  const changes: ContactUpdate[] = []
  const contradictions: Array<{ contactId: string; contradiction: Contradiction }> = []
  const queue: PropagationTask[] = [{
    id: crypto.randomUUID(),
    groupId: findGroupForContact(state, sourceContactId) || '',
    contactId: sourceContactId,
    content: newContent,
    sourceId,
    timestamp: Date.now()
  }]
  const visited = new Set<string>()
  
  while (queue.length > 0) {
    const task = queue.shift()!
    
    // Skip if we've already processed this contact
    if (visited.has(task.contactId)) continue
    visited.add(task.contactId)
    
    const contact = findContact(state, task.contactId)
    if (!contact) continue
    
    // Calculate new content based on blend mode
    const result = await applyBlendMode(contact, task.content)
    
    if (result.changed) {
      changes.push({ 
        contactId: task.contactId, 
        updates: result.updates 
      })
      
      if (result.contradiction) {
        contradictions.push({
          contactId: task.contactId,
          contradiction: result.contradiction
        })
      }
      
      // Update the contact in state immediately so gadget checks see the new value
      const groupId = findGroupForContact(state, task.contactId)
      if (groupId) {
        const groupState = state.groups.get(groupId)
        if (groupState) {
          const updatedContact = {
            ...contact,
            ...result.updates
          }
          groupState.contacts.set(task.contactId, updatedContact)
          
          // NOW check if this contact update triggers a primitive gadget
          const gadgetResult = await checkAndExecutePrimitiveGadget(state, updatedContact)
          if (gadgetResult) {
            // Apply the gadget output updates and queue further propagation
            for (const outputUpdate of gadgetResult) {
              // First apply the update to the contact
              const outputContact = findContact(state, outputUpdate.contactId)
              if (outputContact) {
                changes.push({
                  contactId: outputUpdate.contactId,
                  updates: { content: outputUpdate.content }
                })
                
                // Update the state immediately so subsequent propagations see the new value
                const outputGroupState = state.groups.get(outputUpdate.groupId)
                if (outputGroupState) {
                  outputGroupState.contacts.set(outputUpdate.contactId, {
                    ...outputContact,
                    content: outputUpdate.content
                  })
                }
                
                // Queue propagation from this output
                const outputConnections = getConnectedContacts(state, outputUpdate.contactId)
                for (const connection of outputConnections) {
                  queue.push({
                    id: crypto.randomUUID(),
                    groupId: connection.groupId,
                    contactId: connection.contactId,
                    content: outputUpdate.content,
                    sourceId: outputUpdate.contactId,
                    timestamp: Date.now()
                  })
                }
              }
            }
          }
        }
      }
      
      // Queue connected contacts for propagation
      const connections = getConnectedContacts(state, task.contactId)
      for (const connection of connections) {
        // Don't propagate back to source
        if (connection.contactId !== task.sourceId) {
          queue.push({
            id: crypto.randomUUID(),
            groupId: connection.groupId,
            contactId: connection.contactId,
            content: result.content || task.content,
            sourceId: task.contactId,
            timestamp: Date.now()
          })
        }
      }
    }
  }
  
  return { 
    changes, 
    contradictions,
    duration: performance.now() - startTime
  }
}

// Apply blend mode to determine new content
async function applyBlendMode(
  contact: Contact,
  newContent: unknown
): Promise<{
  changed: boolean
  content?: unknown
  updates: Partial<Contact>
  contradiction?: Contradiction
}> {
  // No change if content is the same
  if (contact.content === newContent) {
    return { changed: false, updates: {} }
  }
  
  // Clear contradiction if we're getting new content
  const updates: Partial<Contact> = {
    lastContradiction: undefined
  }
  
  if (contact.content === undefined || contact.blendMode === 'accept-last') {
    // Accept-last mode or no existing content
    return {
      changed: true,
      content: newContent,
      updates: { ...updates, content: newContent }
    }
  }
  
  // Merge mode
  if (contact.blendMode === 'merge') {
    // Check if both values support merging
    if (isMergeable(contact.content) && isMergeable(newContent)) {
      try {
        const merged = await mergeContent(contact.content, newContent)
        return {
          changed: true,
          content: merged,
          updates: { ...updates, content: merged }
        }
      } catch (error) {
        // Merge failed - create contradiction
        const contradiction: Contradiction = {
          message: error instanceof Error ? error.message : 'Merge failed',
          values: [contact.content, newContent],
          timestamp: Date.now()
        }
        return {
          changed: true,
          contradiction,
          updates: { ...updates, lastContradiction: contradiction }
        }
      }
    } else {
      // Can't merge non-mergeable types - fall back to accept-last
      return {
        changed: true,
        content: newContent,
        updates: { ...updates, content: newContent }
      }
    }
  }
  
  return { changed: false, updates: {} }
}

// Check if a value supports merging
function isMergeable(value: unknown): value is { merge: (other: unknown) => unknown } {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    'merge' in value &&
    typeof (value as any).merge === 'function'
  )
}

// Merge two mergeable values
async function mergeContent(a: unknown, b: unknown): Promise<unknown> {
  if (isMergeable(a) && isMergeable(b)) {
    // Could be async for complex merges
    return a.merge(b)
  }
  throw new Error('Cannot merge non-mergeable values')
}

// Find which group contains a contact
function findGroupForContact(state: NetworkState, contactId: string): string | undefined {
  for (const [groupId, groupState] of state.groups) {
    if (groupState.contacts.has(contactId)) {
      return groupId
    }
  }
  return undefined
}

// Find a contact in any group
function findContact(state: NetworkState, contactId: string): Contact | undefined {
  for (const groupState of state.groups.values()) {
    const contact = groupState.contacts.get(contactId)
    if (contact) return contact
  }
  return undefined
}

// Get all contacts connected to a given contact
function getConnectedContacts(
  state: NetworkState,
  contactId: string
): Array<{ contactId: string; groupId: string }> {
  const connections: Array<{ contactId: string; groupId: string }> = []
  const contact = findContact(state, contactId)
  if (!contact) return connections
  
  const groupState = state.groups.get(contact.groupId)
  if (!groupState) return connections
  
  // Check wires in the contact's group
  for (const wire of groupState.wires.values()) {
    if (wire.type === 'bidirectional') {
      if (wire.fromId === contactId) {
        connections.push({ contactId: wire.toId, groupId: contact.groupId })
      } else if (wire.toId === contactId) {
        connections.push({ contactId: wire.fromId, groupId: contact.groupId })
      }
    } else if (wire.type === 'directed') {
      if (wire.fromId === contactId) {
        connections.push({ contactId: wire.toId, groupId: contact.groupId })
      }
    }
  }
  
  // If this is a boundary contact, also check parent group for connections
  if (contact.isBoundary && groupState.group.parentId) {
    const parentState = state.groups.get(groupState.group.parentId)
    if (parentState) {
      for (const wire of parentState.wires.values()) {
        if (wire.type === 'bidirectional') {
          if (wire.fromId === contactId) {
            connections.push({ contactId: wire.toId, groupId: parentState.group.id })
          } else if (wire.toId === contactId) {
            connections.push({ contactId: wire.fromId, groupId: parentState.group.id })
          }
        } else if (wire.type === 'directed') {
          if (wire.fromId === contactId) {
            connections.push({ contactId: wire.toId, groupId: parentState.group.id })
          }
        }
      }
    }
  }
  
  return connections
}

// Check if a contact update should trigger a primitive gadget execution
async function checkAndExecutePrimitiveGadget(
  state: NetworkState,
  contact: Contact
): Promise<Array<{ contactId: string; groupId: string; content: unknown }> | null> {
  // Only process boundary input contacts
  if (!contact.isBoundary || contact.boundaryDirection !== 'input') {
    return null
  }
  
  // Find the group containing this contact
  const groupState = state.groups.get(contact.groupId)
  if (!groupState || !groupState.group.primitive) {
    return null
  }
  
  const primitive = groupState.group.primitive
  
  // Get all boundary contacts, separated by direction
  const inputContacts: Contact[] = []
  const outputContacts: Contact[] = []
  
  for (const contactId of groupState.group.boundaryContactIds) {
    const boundaryContact = groupState.contacts.get(contactId)
    if (boundaryContact?.isBoundary) {
      if (boundaryContact.boundaryDirection === 'input') {
        inputContacts.push(boundaryContact)
      } else if (boundaryContact.boundaryDirection === 'output') {
        outputContacts.push(boundaryContact)
      }
    }
  }
  
  // Collect ALL input values from ALL input contacts
  const inputs = new Map<string, unknown>()
  for (let i = 0; i < primitive.inputs.length && i < inputContacts.length; i++) {
    const inputName = primitive.inputs[i]
    const inputContact = inputContacts[i]
    if (inputContact.content !== undefined) {
      inputs.set(inputName, inputContact.content)
    }
  }
  
  // Check activation
  if (!primitive.activation(inputs)) {
    return null
  }
  
  // Execute body
  const outputs = await primitive.body(inputs)
  
  // Map outputs to boundary contacts
  const updates: Array<{ contactId: string; groupId: string; content: unknown }> = []
  for (const [outputName, outputValue] of outputs) {
    const outputIndex = primitive.outputs.indexOf(outputName)
    if (outputIndex >= 0 && outputIndex < outputContacts.length) {
      const outputContact = outputContacts[outputIndex]
      updates.push({
        contactId: outputContact.id,
        groupId: outputContact.groupId,
        content: outputValue
      })
    }
  }
  
  return updates.length > 0 ? updates : null
}

// Export utility functions for testing
export const testUtils = {
  findGroupForContact,
  findContact,
  getConnectedContacts,
  applyBlendMode,
  checkAndExecutePrimitiveGadget
}