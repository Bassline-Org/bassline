import type { ContactId, WireId, Position } from '../types'
import { ContactGroup } from './ContactGroup'
import { Contact } from './Contact'
import { Wire } from './Wire'
import type { GadgetTemplate } from '../types/template'
import { createPrimitiveGadget, PRIMITIVE_GADGETS } from '../primitives-registry'

export class PropagationNetwork {
  rootGroup: ContactGroup
  currentGroup: ContactGroup
  
  constructor() {
    this.rootGroup = new ContactGroup(crypto.randomUUID(), 'Root')
    this.currentGroup = this.rootGroup
  }
  
  // Convenience methods that delegate to current group
  addContact(position: Position): Contact {
    return this.currentGroup.addContact(position)
  }
  
  addBoundaryContact(position: Position, direction: 'input' | 'output' = 'input', name?: string): Contact {
    return this.currentGroup.addBoundaryContact(position, direction, name)
  }
  
  connect(fromId: ContactId, toId: ContactId, type: 'bidirectional' | 'directed' = 'bidirectional'): Wire {
    return this.currentGroup.connect(fromId, toId, type)
  }
  
  createGroup(name: string): ContactGroup {
    return this.currentGroup.createSubgroup(name)
  }
  
  findContact(id: ContactId): Contact | undefined {
    return this.rootGroup.findContact(id)
  }
  
  // Get all contacts and wires for current view
  getCurrentView(): { contacts: Contact[], wires: Wire[], subgroups: ContactGroup[] } {
    return {
      contacts: Array.from(this.currentGroup.contacts.values()),
      wires: Array.from(this.currentGroup.wires.values()),
      subgroups: Array.from(this.currentGroup.subgroups.values())
    }
  }
  
  // Navigation methods
  navigateToGroup(groupId: string): boolean {
    const group = this.findGroup(groupId)
    if (group) {
      this.currentGroup = group
      return true
    }
    return false
  }
  
  navigateToParent(): boolean {
    if (this.currentGroup.parent) {
      this.currentGroup = this.currentGroup.parent
      return true
    }
    return false
  }
  
  findGroup(groupId: string): ContactGroup | undefined {
    if (this.rootGroup.id === groupId) {
      return this.rootGroup
    }
    return this.findGroupRecursive(this.rootGroup, groupId)
  }
  
  private findGroupRecursive(group: ContactGroup, groupId: string): ContactGroup | undefined {
    for (const subgroup of group.subgroups.values()) {
      if (subgroup.id === groupId) {
        return subgroup
      }
      const found = this.findGroupRecursive(subgroup, groupId)
      if (found) return found
    }
    return undefined
  }
  
  // Get navigation breadcrumbs
  getBreadcrumbs(): { id: string, name: string }[] {
    const breadcrumbs: { id: string, name: string }[] = []
    let current: ContactGroup | undefined = this.currentGroup
    
    while (current) {
      breadcrumbs.unshift({ id: current.id, name: current.name })
      current = current.parent
    }
    
    return breadcrumbs
  }
  
  // Deletion methods
  removeContact(contactId: ContactId): boolean {
    return this.currentGroup.removeContact(contactId)
  }
  
  removeWire(wireId: WireId): boolean {
    return this.currentGroup.removeWire(wireId)
  }
  
  removeGroup(groupId: string): boolean {
    return this.currentGroup.removeSubgroup(groupId)
  }
  
  // Template methods
  instantiateTemplate(template: GadgetTemplate, position: Position): ContactGroup {
    // Check if this is a primitive gadget
    if (template.name in PRIMITIVE_GADGETS) {
      const primitive = createPrimitiveGadget(template.name, this.currentGroup)
      if (primitive) {
        primitive.position = { ...position }
        this.currentGroup.subgroups.set(primitive.id, primitive)
        return primitive
      }
    }
    
    // Otherwise, create a regular gadget from template
    const gadget = ContactGroup.fromTemplate(template, this.currentGroup)
    gadget.position = { ...position }
    this.currentGroup.subgroups.set(gadget.id, gadget)
    return gadget
  }
}