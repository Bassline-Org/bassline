// Minimal network runtime for CLI
// This reimplements core functionality without web dependencies

import { EventEmitter } from 'events'
import { generateId } from './utils.js'

interface Contact {
  id: string
  content: any
  blendMode: 'accept-last' | 'merge'
  groupId: string
  name?: string
  isBoundary?: boolean
  boundaryDirection?: 'input' | 'output'
}

interface Wire {
  id: string
  fromId: string
  toId: string
  type: 'bidirectional' | 'directed'
  groupId?: string
}

interface Group {
  id: string
  name: string
  primitiveId?: string
  parentId?: string
  contactIds: string[]
  wireIds: string[]
  subgroupIds: string[]
  boundaryContactIds: string[]
}

export interface GroupState {
  group: Group
  contacts: Map<string, Contact>
  wires: Map<string, Wire>
}

export class NetworkRuntime extends EventEmitter {
  private groups = new Map<string, Group>()
  private contacts = new Map<string, Contact>()
  private wires = new Map<string, Wire>()
  private changes: any[] = []
  
  constructor() {
    super()
  }
  
  registerGroup(group: Group) {
    this.groups.set(group.id, group)
    this.addChange('group-added', { group })
  }
  
  addContact(groupId: string, contactData: Partial<Contact>): string {
    const contactId = contactData.id || generateId()
    const contact: Contact = {
      id: contactId,
      content: contactData.content ?? null,
      blendMode: contactData.blendMode || 'accept-last',
      groupId,
      ...contactData
    }
    
    this.contacts.set(contactId, contact)
    
    // Add to group
    const group = this.groups.get(groupId)
    if (group) {
      group.contactIds.push(contactId)
    }
    
    this.addChange('contact-added', { contact, groupId })
    return contactId
  }
  
  connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional'): string {
    const wireId = generateId()
    const wire: Wire = {
      id: wireId,
      fromId,
      toId,
      type
    }
    
    this.wires.set(wireId, wire)
    
    // Find which group this wire belongs to
    const fromContact = this.contacts.get(fromId)
    const toContact = this.contacts.get(toId)
    
    if (fromContact && toContact) {
      // Determine wire's group
      const groupId = fromContact.groupId === toContact.groupId 
        ? fromContact.groupId 
        : fromContact.isBoundary ? toContact.groupId : fromContact.groupId
        
      wire.groupId = groupId
      
      const group = this.groups.get(groupId)
      if (group) {
        group.wireIds.push(wireId)
      }
    }
    
    this.addChange('wire-added', { wire })
    
    // Trigger propagation
    this.propagate(fromId)
    
    return wireId
  }
  
  scheduleUpdate(contactId: string, content: any) {
    const contact = this.contacts.get(contactId)
    if (contact && contact.content !== content) {
      contact.content = content
      this.addChange('contact-updated', { contact })
      this.propagate(contactId)
    }
  }
  
  private propagate(contactId: string) {
    // Simple immediate propagation
    const visited = new Set<string>()
    const queue = [contactId]
    
    while (queue.length > 0) {
      const currentId = queue.shift()!
      if (visited.has(currentId)) continue
      visited.add(currentId)
      
      const currentContact = this.contacts.get(currentId)
      if (!currentContact) continue
      
      // Find connected contacts
      this.wires.forEach(wire => {
        let targetId: string | null = null
        
        if (wire.fromId === currentId) {
          targetId = wire.toId
        } else if (wire.toId === currentId && wire.type === 'bidirectional') {
          targetId = wire.fromId
        }
        
        if (targetId && !visited.has(targetId)) {
          const targetContact = this.contacts.get(targetId)
          if (targetContact) {
            // Simple propagation - just copy value
            if (targetContact.content !== currentContact.content) {
              targetContact.content = currentContact.content
              this.addChange('contact-updated', { contact: targetContact })
              queue.push(targetId)
            }
          }
        }
      })
    }
    
    // Check for primitive gadget execution
    this.checkPrimitiveExecution()
  }
  
  private checkPrimitiveExecution() {
    // Execute primitive gadgets
    this.groups.forEach(group => {
      if (group.primitiveId) {
        this.executePrimitive(group)
      }
    })
  }
  
  private executePrimitive(group: Group) {
    // Simple primitive execution
    const inputs: Record<string, any> = {}
    const outputs: Record<string, Contact> = {}
    
    // Gather boundary contacts
    group.boundaryContactIds.forEach(contactId => {
      const contact = this.contacts.get(contactId)
      if (contact) {
        if (contact.boundaryDirection === 'input') {
          inputs[contact.name || contactId] = contact.content
        } else {
          outputs[contact.name || contactId] = contact
        }
      }
    })
    
    // Execute primitive
    let result: any = null
    switch (group.primitiveId) {
      case 'add':
        if (inputs.a !== null && inputs.b !== null) {
          result = inputs.a + inputs.b
          if (outputs.sum) {
            this.scheduleUpdate(outputs.sum.id, result)
          }
        }
        break
        
      case 'multiply':
        if (inputs.a !== null && inputs.b !== null) {
          result = inputs.a * inputs.b
          if (outputs.product) {
            this.scheduleUpdate(outputs.product.id, result)
          }
        }
        break
        
      case 'concat':
        if (inputs.a !== null && inputs.b !== null) {
          result = String(inputs.a) + String(inputs.b)
          if (outputs.result) {
            this.scheduleUpdate(outputs.result.id, result)
          }
        }
        break
    }
  }
  
  getState(groupId: string = 'root'): GroupState {
    const group = this.groups.get(groupId)
    if (!group) {
      throw new Error(`Group ${groupId} not found`)
    }
    
    const contacts = new Map<string, Contact>()
    const wires = new Map<string, Wire>()
    
    // Get contacts in this group
    group.contactIds.forEach(contactId => {
      const contact = this.contacts.get(contactId)
      if (contact) {
        contacts.set(contactId, contact)
      }
    })
    
    // Get wires in this group
    group.wireIds.forEach(wireId => {
      const wire = this.wires.get(wireId)
      if (wire) {
        wires.set(wireId, wire)
      }
    })
    
    return { group, contacts, wires }
  }
  
  exportState(groupId?: string): any {
    const groups: Record<string, Group> = {}
    const contacts: Record<string, Contact> = {}
    const wires: Record<string, Wire> = {}
    
    if (groupId) {
      // Export specific group and its contents
      const group = this.groups.get(groupId)
      if (group) {
        groups[groupId] = group
        group.contactIds.forEach(id => {
          const contact = this.contacts.get(id)
          if (contact) contacts[id] = contact
        })
        group.wireIds.forEach(id => {
          const wire = this.wires.get(id)
          if (wire) wires[id] = wire
        })
      }
    } else {
      // Export everything
      this.groups.forEach((group, id) => groups[id] = group)
      this.contacts.forEach((contact, id) => contacts[id] = contact)
      this.wires.forEach((wire, id) => wires[id] = wire)
    }
    
    return { groups, contacts, wires }
  }
  
  importState(state: any) {
    // Clear existing state
    this.groups.clear()
    this.contacts.clear()
    this.wires.clear()
    
    // Import groups
    if (state.groups) {
      Object.values(state.groups).forEach((group: any) => {
        this.groups.set(group.id, group)
      })
    }
    
    // Import contacts
    if (state.contacts) {
      Object.values(state.contacts).forEach((contact: any) => {
        this.contacts.set(contact.id, contact)
      })
    }
    
    // Import wires
    if (state.wires) {
      Object.values(state.wires).forEach((wire: any) => {
        this.wires.set(wire.id, wire)
      })
    }
    
    this.addChange('state-imported', { state })
  }
  
  private addChange(type: string, data: any) {
    this.changes.push({ type, data })
    this.emit('change', { type, data })
  }
  
  getChanges(): any[] {
    const changes = [...this.changes]
    this.changes = []
    return changes
  }
}