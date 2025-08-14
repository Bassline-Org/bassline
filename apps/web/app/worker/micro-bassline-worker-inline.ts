/**
 * Micro-Bassline Worker with Inline Implementation
 * This avoids module import issues in workers
 */

// Inline the essential micro-bassline functionality
// We'll create a minimal implementation that can be expanded

interface Contact {
  id: string
  value: any
  subscribers: Set<(value: any) => void>
  groupId?: string
  properties?: Record<string, any>
}

interface Group {
  id: string
  contacts: Map<string, Contact>
  properties: Record<string, any>
}

interface Wire {
  id: string
  fromId: string
  toId: string
  bidirectional: boolean
}

class MicroNetwork {
  groups = new Map<string, Group>()
  contacts = new Map<string, Contact>()
  wires = new Map<string, Wire>()
  
  createGroup(id: string, parentId?: string, properties: Record<string, any> = {}) {
    const group: Group = {
      id,
      contacts: new Map(),
      properties
    }
    this.groups.set(id, group)
    
    // Create MGP contacts if requested
    if (properties['expose-structure']) {
      this.createContact(`${id}:structure`, id, {})
    }
    if (properties['expose-dynamics']) {
      this.createContact(`${id}:dynamics`, id, {})
    }
    if (properties['allow-meta-mutation']) {
      this.createContact(`${id}:actions`, id, {})
    }
    
    return group
  }
  
  createContact(id: string, groupId: string, properties: Record<string, any>) {
    const contact: Contact = {
      id,
      value: undefined,
      subscribers: new Set(),
      groupId,
      properties
    }
    this.contacts.set(id, contact)
    
    const group = this.groups.get(groupId)
    if (group) {
      group.contacts.set(id, contact)
    }
    
    return contact
  }
  
  setValue(contactId: string, value: any) {
    const contact = this.contacts.get(contactId)
    if (contact) {
      console.log(`Setting value for ${contactId}:`, value)
      contact.value = value
      // Notify subscribers
      contact.subscribers.forEach(handler => handler(value))
    } else {
      console.warn(`Contact ${contactId} not found`)
    }
  }
  
  subscribe(contactId: string, handler: (value: any) => void) {
    const contact = this.contacts.get(contactId)
    if (contact) {
      contact.subscribers.add(handler)
      return () => contact.subscribers.delete(handler)
    }
    return () => {}
  }
  
  createWire(id: string, fromId: string, toId: string, bidirectional = true) {
    const wire: Wire = { id, fromId, toId, bidirectional }
    this.wires.set(id, wire)
    
    // Set up value propagation
    const fromContact = this.contacts.get(fromId)
    const toContact = this.contacts.get(toId)
    
    if (fromContact && toContact) {
      this.subscribe(fromId, (value) => {
        this.setValue(toId, value)
      })
      
      if (bidirectional) {
        this.subscribe(toId, (value) => {
          this.setValue(fromId, value)
        })
      }
    }
    
    return wire
  }
  
  applyAction(action: any[]) {
    const [type, ...args] = action
    
    // Send action to dynamics contact for event tracking
    this.updateDynamics({
      type: 'action',
      action,
      timestamp: Date.now()
    })
    
    switch (type) {
      case 'createContact': {
        const [localId, groupId, properties] = args
        // Create with qualified ID: groupId:localId
        const qualifiedId = `${groupId}:${localId}`
        this.createContact(qualifiedId, groupId, properties || {})
        this.updateStructure()
        break
      }
      
      case 'createWire': {
        const [id, fromId, toId, properties] = args
        this.createWire(id, fromId, toId, properties?.bidirectional)
        this.updateStructure()
        break
      }
      
      case 'setValue': {
        const [contactId, value] = args
        this.setValue(contactId, value)
        this.updateStructure() // Update structure when values change
        
        // Also send value change event to dynamics
        this.updateDynamics({
          type: 'valueChange',
          contactId,
          value,
          timestamp: Date.now()
        })
        break
      }
      
      default:
        console.warn('Unknown action type:', type)
    }
  }
  
  updateDynamics(event: any) {
    const dynamicsContact = this.contacts.get('app:dynamics')
    if (dynamicsContact) {
      this.setValue('app:dynamics', event)
    }
  }
  
  getBassline() {
    // Return a serializable Bassline structure
    const result = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    for (const [id, contact] of this.contacts) {
      result.contacts.set(id, {
        content: contact.value,
        groupId: contact.groupId,
        properties: contact.properties || {}
      })
    }
    
    for (const [id, group] of this.groups) {
      result.groups.set(id, {
        contactIds: new Set(group.contacts.keys()),
        boundaryContactIds: new Set(), // We don't track these yet
        properties: group.properties
      })
    }
    
    for (const [id, wire] of this.wires) {
      result.wires.set(id, {
        fromId: wire.fromId,
        toId: wire.toId,
        properties: { bidirectional: wire.bidirectional }
      })
    }
    
    return result
  }
  
  updateStructure() {
    const structureContact = this.contacts.get('app:structure')
    if (structureContact) {
      const structure = this.getBassline()
      this.setValue('app:structure', structure)
    }
  }
}

// Create the network
const network = new MicroNetwork()

// Create root group with MGP
network.createGroup('app', undefined, {
  'expose-structure': true,
  'expose-dynamics': true,
  'allow-meta-mutation': true
})

// Subscribe to structure changes
network.subscribe('app:structure', (value) => {
  self.postMessage({ 
    type: 'structure', 
    value 
  })
})

// Subscribe to dynamics changes
network.subscribe('app:dynamics', (value) => {
  self.postMessage({ 
    type: 'dynamics', 
    value // Changed from 'event' to 'value' for consistency
  })
})

// Handle incoming messages
self.onmessage = (e: MessageEvent) => {
  console.log('Worker received message:', e.data)
  const { type, action } = e.data
  
  switch (type) {
    case 'action':
      if (action) {
        console.log('Worker processing action:', action)
        network.applyAction(action)
      } else {
        console.error('No action provided in message')
      }
      break
      
    case 'ping':
      self.postMessage({ type: 'pong' })
      break
      
    default:
      console.warn('Unknown message type:', type)
  }
}

// Signal ready
self.postMessage({ type: 'ready' })
console.log('Micro-Bassline worker initialized (inline version)')

export {}