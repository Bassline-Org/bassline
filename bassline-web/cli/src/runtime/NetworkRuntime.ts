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
    
    this.addChange('wire-added', { wire, groupId: wire.groupId })
    
    // Trigger propagation
    this.propagate(fromId)
    
    return wireId
  }
  
  scheduleUpdate(contactId: string, content: any) {
    const contact = this.contacts.get(contactId)
    if (contact && contact.content !== content) {
      contact.content = content
      this.addChange('contact-updated', { contact, contactId, groupId: contact.groupId, updates: { content } })
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
              this.addChange('contact-updated', { contact: targetContact, contactId: targetId, groupId: targetContact.groupId, updates: { content: targetContact.content } })
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
        
      case 'gate':
        if (inputs.value !== null && inputs.gate !== null) {
          if (inputs.gate) {
            result = inputs.value
            if (outputs.output) {
              this.scheduleUpdate(outputs.output.id, result)
            }
          }
        }
        break
        
      case 'and':
        if (inputs.a !== null && inputs.b !== null) {
          result = inputs.a && inputs.b
          if (outputs.result) {
            this.scheduleUpdate(outputs.result.id, result)
          }
        }
        break
        
      case 'or':
        if (inputs.a !== null && inputs.b !== null) {
          result = inputs.a || inputs.b
          if (outputs.result) {
            this.scheduleUpdate(outputs.result.id, result)
          }
        }
        break
        
      case 'not':
        if (inputs.input !== null) {
          result = !inputs.input
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
  
  listGroups(): any[] {
    const groups: any[] = []
    this.groups.forEach(group => {
      groups.push({
        id: group.id,
        name: group.name,
        parentId: group.parentId,
        primitiveId: group.primitiveId,
        contactCount: group.contactIds.length,
        wireCount: group.wireIds.length,
        subgroupCount: group.subgroupIds.length
      })
    })
    return groups
  }
  
  createGroup(name: string, parentId: string = 'root', primitiveId?: string): string {
    const groupId = generateId()
    const group: Group = {
      id: groupId,
      name,
      parentId,
      primitiveId,
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    }
    
    // If it's a primitive gadget, create boundary contacts
    if (primitiveId) {
      const primitiveInfo = this.getPrimitiveInfo(primitiveId)
      if (primitiveInfo) {
        // Create input boundary contacts
        primitiveInfo.inputs.forEach((input: any) => {
          const contactId = this.addContact(groupId, {
            name: input.name,
            isBoundary: true,
            boundaryDirection: 'input'
          })
          group.boundaryContactIds.push(contactId)
        })
        
        // Create output boundary contacts
        primitiveInfo.outputs.forEach((output: any) => {
          const contactId = this.addContact(groupId, {
            name: output.name,
            isBoundary: true,
            boundaryDirection: 'output'
          })
          group.boundaryContactIds.push(contactId)
        })
      }
    }
    
    this.groups.set(groupId, group)
    
    // Add to parent group
    const parent = this.groups.get(parentId)
    if (parent) {
      parent.subgroupIds.push(groupId)
    }
    
    this.addChange('group-created', { group, parentId })
    return groupId
  }
  
  deleteGroup(groupId: string) {
    const group = this.groups.get(groupId)
    if (!group) return
    
    // Remove from parent
    if (group.parentId) {
      const parent = this.groups.get(group.parentId)
      if (parent) {
        parent.subgroupIds = parent.subgroupIds.filter(id => id !== groupId)
      }
    }
    
    // Delete all contacts in group
    group.contactIds.forEach(contactId => {
      this.deleteContact(contactId)
    })
    
    // Delete all wires in group
    group.wireIds.forEach(wireId => {
      this.deleteWire(wireId)
    })
    
    // Recursively delete subgroups
    group.subgroupIds.forEach(subgroupId => {
      this.deleteGroup(subgroupId)
    })
    
    this.groups.delete(groupId)
    this.addChange('group-removed', { groupId })
  }
  
  deleteContact(contactId: string) {
    const contact = this.contacts.get(contactId)
    if (!contact) return
    
    // Remove from group
    const group = this.groups.get(contact.groupId)
    if (group) {
      group.contactIds = group.contactIds.filter(id => id !== contactId)
      group.boundaryContactIds = group.boundaryContactIds.filter(id => id !== contactId)
    }
    
    // Delete connected wires
    this.wires.forEach(wire => {
      if (wire.fromId === contactId || wire.toId === contactId) {
        this.deleteWire(wire.id)
      }
    })
    
    this.contacts.delete(contactId)
    this.addChange('contact-removed', { contactId, groupId: contact.groupId })
  }
  
  deleteWire(wireId: string) {
    const wire = this.wires.get(wireId)
    if (!wire) return
    
    // Remove from group
    if (wire.groupId) {
      const group = this.groups.get(wire.groupId)
      if (group) {
        group.wireIds = group.wireIds.filter(id => id !== wireId)
      }
    }
    
    this.wires.delete(wireId)
    this.addChange('wire-removed', { wireId, groupId: wire.groupId })
  }
  
  listPrimitives(): any[] {
    return [
      {
        id: 'add',
        name: 'Add',
        description: 'Adds two numbers',
        inputs: [
          { name: 'a', type: 'number', required: true },
          { name: 'b', type: 'number', required: true }
        ],
        outputs: [
          { name: 'sum', type: 'number' }
        ]
      },
      {
        id: 'multiply',
        name: 'Multiply',
        description: 'Multiplies two numbers',
        inputs: [
          { name: 'a', type: 'number', required: true },
          { name: 'b', type: 'number', required: true }
        ],
        outputs: [
          { name: 'product', type: 'number' }
        ]
      },
      {
        id: 'concat',
        name: 'String Concat',
        description: 'Concatenates two strings',
        inputs: [
          { name: 'a', type: 'string', required: true },
          { name: 'b', type: 'string', required: true }
        ],
        outputs: [
          { name: 'result', type: 'string' }
        ]
      },
      {
        id: 'gate',
        name: 'Gate',
        description: 'Passes value when gate is truthy',
        inputs: [
          { name: 'value', type: 'any', required: true },
          { name: 'gate', type: 'boolean', required: true }
        ],
        outputs: [
          { name: 'output', type: 'any' }
        ]
      },
      {
        id: 'and',
        name: 'AND Gate',
        description: 'Logical AND operation',
        inputs: [
          { name: 'a', type: 'boolean', required: true },
          { name: 'b', type: 'boolean', required: true }
        ],
        outputs: [
          { name: 'result', type: 'boolean' }
        ]
      },
      {
        id: 'or',
        name: 'OR Gate',
        description: 'Logical OR operation',
        inputs: [
          { name: 'a', type: 'boolean', required: true },
          { name: 'b', type: 'boolean', required: true }
        ],
        outputs: [
          { name: 'result', type: 'boolean' }
        ]
      },
      {
        id: 'not',
        name: 'NOT Gate',
        description: 'Logical NOT operation',
        inputs: [
          { name: 'input', type: 'boolean', required: true }
        ],
        outputs: [
          { name: 'result', type: 'boolean' }
        ]
      }
    ]
  }
  
  private getPrimitiveInfo(primitiveId: string): any {
    const primitives = this.listPrimitives()
    return primitives.find(p => p.id === primitiveId)
  }
}