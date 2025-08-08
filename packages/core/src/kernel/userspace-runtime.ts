/**
 * UserspaceRuntime - Pure propagation network execution
 * Combines scheduling and runtime execution for simplicity
 * Communicates with kernel for all external I/O
 */

import type { 
  GroupState, 
  NetworkState,
  Group,
  Contact,
  Wire,
  Change,
  BlendMode
} from '../types'
import { brand } from '../types'
import { propagateContent } from '../propagation'
import type { Kernel } from './kernel'
import type { ContactChange, ExternalInput } from './types'

export interface UserspaceRuntimeConfig {
  kernel: Kernel
}

export class UserspaceRuntime {
  // Internal propagation network state
  private state: NetworkState = {
    groups: new Map(),
    currentGroupId: '',
    rootGroupId: ''
  }
  
  private subscribers = new Set<(changes: Change[]) => void>()
  private kernel: Kernel
  
  constructor(config: UserspaceRuntimeConfig) {
    this.kernel = config.kernel
    
    // Register with kernel to receive external input
    this.kernel.setUserspaceHandler(this.receiveExternalInput.bind(this))
  }
  
  /**
   * Receive external input from kernel (from bridge drivers)
   * This is called by the kernel when external systems provide new data
   */
  async receiveExternalInput(input: ExternalInput): Promise<void> {
    switch (input.type) {
      case 'external-contact-update':
        // Convert external input to internal propagation
        await this.scheduleUpdate(input.contactId, input.value)
        break
        
      case 'external-add-contact':
        const contactId = await this.addContact(input.groupId, {
          content: input.contact.content,
          blendMode: input.contact.blendMode
        })
        
        // Get the created contact to emit its actual content
        const createdContact = this.findContact(contactId)
        
        // Emit creation event back through kernel with actual content
        this.emitToKernel({
          type: 'contact-change',
          contactId: brand.contactId(contactId),
          groupId: input.groupId,
          value: createdContact?.content || input.contact.content,
          timestamp: Date.now()
        })
        break
        
      case 'external-remove-contact':
        // TODO: Implement contact removal
        console.log('[UserspaceRuntime] Contact removal not yet implemented:', input.contactId)
        break
        
      case 'external-add-group':
        const groupId = brand.groupId(`group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`)
        await this.registerGroup({
          id: groupId,
          name: input.group.name,
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        })
        
        // If has parent, add to parent's subgroups
        if (input.parentGroupId) {
          const parentState = this.state.groups.get(input.parentGroupId)
          if (parentState) {
            parentState.group.subgroupIds.push(groupId)
          }
        }
        
        // Emit creation event
        this.emitToKernel({
          type: 'contact-change',
          contactId: brand.contactId('system'),
          groupId: groupId,
          value: { created: true, id: groupId, name: input.group.name },
          timestamp: Date.now()
        })
        break
        
      case 'external-remove-group':
        // TODO: Implement group removal
        console.log('[UserspaceRuntime] Group removal not yet implemented:', input.groupId)
        break
        
      case 'external-create-wire':
        // TODO: Implement wire creation
        console.log('[UserspaceRuntime] Wire creation not yet implemented:', input.fromContactId, '->', input.toContactId)
        break
        
      case 'external-remove-wire':
        // TODO: Implement wire removal
        console.log('[UserspaceRuntime] Wire removal not yet implemented:', input.wireId)
        break
        
      case 'external-query-contact':
        // Find and return contact value
        const contact = this.findContact(input.contactId)
        if (contact) {
          // Emit result back through kernel
          this.emitToKernel({
            type: 'contact-change',
            contactId: input.contactId,
            groupId: brand.groupId(this.findGroupForContact(input.contactId) || 'unknown'),
            value: {
              type: 'query-result',
              requestId: input.requestId,
              contactId: input.contactId,
              content: contact.content,
              blendMode: contact.blendMode
            },
            timestamp: Date.now()
          })
        } else {
          // Emit error
          this.emitToKernel({
            type: 'contact-change',
            contactId: brand.contactId('system'),
            groupId: brand.groupId('system'),
            value: {
              type: 'query-error',
              requestId: input.requestId,
              error: `Contact ${input.contactId} not found`
            },
            timestamp: Date.now()
          })
        }
        break
        
      case 'external-query-group':
        // Get group state
        const groupState = this.state.groups.get(input.groupId)
        if (groupState) {
          const result: any = {
            type: 'query-result',
            requestId: input.requestId,
            groupId: input.groupId,
            group: {
              id: groupState.group.id,
              name: groupState.group.name,
              contactCount: groupState.contacts.size,
              wireCount: groupState.wires.size,
              subgroupCount: groupState.group.subgroupIds.length
            }
          }
          
          if (input.includeContacts) {
            result.contacts = Array.from(groupState.contacts.entries()).map(([id, contact]) => ({
              id,
              content: contact.content,
              blendMode: contact.blendMode
            }))
          }
          
          if (input.includeWires) {
            result.wires = Array.from(groupState.wires.entries()).map(([id, wire]) => ({
              id,
              fromId: wire.fromId,
              toId: wire.toId,
              type: wire.type
            }))
          }
          
          if (input.includeSubgroups) {
            result.subgroups = groupState.group.subgroupIds
          }
          
          // Emit result back through kernel
          this.emitToKernel({
            type: 'contact-change',
            contactId: brand.contactId('system'),
            groupId: input.groupId,
            value: result,
            timestamp: Date.now()
          })
        } else {
          // Emit error
          this.emitToKernel({
            type: 'contact-change',
            contactId: brand.contactId('system'),
            groupId: brand.groupId('system'),
            value: {
              type: 'query-error',
              requestId: input.requestId,
              error: `Group ${input.groupId} not found`
            },
            timestamp: Date.now()
          })
        }
        break
        
      default:
        // Exhaustive check
        const exhaustiveCheck: never = input
        throw new Error(`Unknown external input type: ${(exhaustiveCheck as any).type}`)
    }
  }
  
  /**
   * Schedule an update to a contact and propagate changes
   * This is the main entry point for propagation
   */
  async scheduleUpdate(contactId: string, content: any): Promise<void> {
    const contact = this.findContact(contactId)
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`)
    }
    
    // Run propagation immediately (synchronous)
    const result = await propagateContent(this.state, contactId, content)
    
    // Apply changes to internal state
    const changes: Change[] = []
    for (const change of result.changes) {
      const groupId = this.findGroupForContact(change.contactId)
      if (groupId) {
        const groupState = this.state.groups.get(groupId)
        if (groupState) {
          const contact = groupState.contacts.get(change.contactId)
          if (contact) {
            // Update the contact in state
            groupState.contacts.set(change.contactId, {
              ...contact,
              ...change.updates
            })
            
            // Emit to kernel asynchronously (fire-and-forget)
            this.emitToKernel({
              type: 'contact-change',
              contactId: brand.contactId(change.contactId),
              groupId: brand.groupId(groupId),
              value: change.updates.content,
              timestamp: Date.now()
            })
            
            // Track for local subscribers
            changes.push({
              type: 'contact-updated',
              data: { ...change, groupId },
              timestamp: Date.now()
            })
          }
        }
      }
    }
    
    // Notify local subscribers (for UI updates, testing, etc.)
    this.notifySubscribers(changes)
  }
  
  /**
   * Emit a change to the kernel asynchronously
   * This doesn't block propagation - kernel handles all I/O
   */
  private emitToKernel(change: ContactChange): void {
    // Fire-and-forget - don't await, don't block propagation
    this.kernel.handleChange(change).catch(error => {
      // The kernel will handle its own errors and shut us down if needed
      // We don't handle kernel errors in userspace
      console.error('[UserspaceRuntime] Kernel rejected change:', error)
    })
  }
  
  /**
   * Register a new group in the propagation network
   */
  async registerGroup(group: Group): Promise<void> {
    // Check if group already exists
    if (this.state.groups.has(group.id)) {
      console.log(`[UserspaceRuntime] Group ${group.id} already exists, skipping registration`)
      return
    }
    
    const groupState: GroupState = {
      group,
      contacts: new Map(),
      wires: new Map()
    }
    this.state.groups.set(group.id, groupState)
    
    // If this is a primitive gadget, create boundary contacts
    if (group.primitive) {
      const primitive = group.primitive
      console.log(`[UserspaceRuntime] Creating boundary contacts for primitive gadget ${primitive.id}`)
      
      // Create input boundary contacts
      for (const inputName of primitive.inputs) {
        const cId = brand.contactId(crypto.randomUUID())
        const contact: Contact = {
          id: cId,
          content: undefined,
          blendMode: 'accept-last',
          groupId: group.id,
          isBoundary: true,
          boundaryDirection: 'input',
          name: inputName
        }
        groupState.contacts.set(cId, contact)
        group.contactIds.push(cId)
        group.boundaryContactIds.push(cId)
        
        console.log(`[UserspaceRuntime] Created input boundary contact ${inputName} (${cId})`)
      }
      
      // Create output boundary contacts
      for (const outputName of primitive.outputs) {
        const cId = brand.contactId(crypto.randomUUID())
        const contact: Contact = {
          id: cId,
          content: undefined,
          blendMode: 'accept-last',
          groupId: group.id,
          isBoundary: true,
          boundaryDirection: 'output',
          name: outputName
        }
        groupState.contacts.set(cId, contact)
        group.contactIds.push(cId)
        group.boundaryContactIds.push(cId)
        
        console.log(`[UserspaceRuntime] Created output boundary contact ${outputName} (${cId})`)
      }
    }
    
    // Set root group if this is the first
    if (!this.state.rootGroupId) {
      this.state.rootGroupId = group.id
      this.state.currentGroupId = group.id
    }
    
    this.notifySubscribers([{
      type: 'group-added',
      data: group,
      timestamp: Date.now()
    }])
  }
  
  /**
   * Connect two contacts with a wire
   */
  async connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional'): Promise<string> {
    const fromContact = this.findContact(fromId)
    const toContact = this.findContact(toId)
    
    if (!fromContact || !toContact) {
      throw new Error('Cannot connect: one or both contacts not found')
    }
    
    // Ensure both contacts are in the same group or one is a boundary contact
    const fromGroup = this.findGroupForContact(fromId)
    const toGroup = this.findGroupForContact(toId)
    
    if (fromGroup !== toGroup && !fromContact.isBoundary && !toContact.isBoundary) {
      throw new Error('Cannot connect contacts from different groups unless one is a boundary contact')
    }
    
    const gId = brand.groupId(fromGroup || toGroup || '')
    const wId = brand.wireId(crypto.randomUUID())
    const wire: Wire = {
      id: wId,
      groupId: gId,
      fromId: brand.contactId(fromId),
      toId: brand.contactId(toId),
      type
    }
    
    const groupState = this.state.groups.get(gId)
    if (groupState) {
      groupState.wires.set(wId, wire)
      groupState.group.wireIds.push(wId)
    }
    
    // Propagate content if source has content
    if (fromContact.content !== undefined) {
      await this.scheduleUpdate(toId, fromContact.content)
    }
    
    // For bidirectional, also propagate from target to source
    if (type === 'bidirectional' && toContact.content !== undefined) {
      await this.scheduleUpdate(fromId, toContact.content)
    }
    
    this.notifySubscribers([{
      type: 'wire-added',
      data: { ...wire, groupId: gId },
      timestamp: Date.now()
    }])
    
    return wId
  }
  
  /**
   * Add a new contact to a group
   */
  async addContact(groupIdStr: string, contactData: Partial<Contact>): Promise<string> {
    const gId = brand.groupId(groupIdStr)
    const groupState = this.state.groups.get(gId)
    if (!groupState) {
      throw new Error(`Group ${groupIdStr} not found`)
    }
    
    // Use provided ID or generate a new one
    const cId = contactData.id ? brand.contactId(contactData.id) : brand.contactId(crypto.randomUUID())
    const contact: Contact = {
      blendMode: 'accept-last' as BlendMode,
      content: undefined,
      ...contactData,
      id: cId,
      groupId: gId
    }
    
    groupState.contacts.set(cId, contact)
    groupState.group.contactIds.push(cId)
    
    if (contact.isBoundary) {
      groupState.group.boundaryContactIds.push(cId)
    }
    
    this.notifySubscribers([{
      type: 'contact-added',
      data: { ...contact, groupId: gId },
      timestamp: Date.now()
    }])
    
    return cId
  }
  
  /**
   * Get the current state of a group
   */
  async getState(groupId: string): Promise<GroupState> {
    const groupState = this.state.groups.get(groupId)
    if (!groupState) {
      throw new Error(`Group ${groupId} not found`)
    }
    return groupState
  }
  
  /**
   * Export the entire network state
   */
  async exportState(): Promise<NetworkState> {
    // Deep clone to prevent external mutations
    const exportedGroups = new Map()
    
    this.state.groups.forEach((groupState, groupId) => {
      const group = { ...groupState.group }
      const contacts = new Map()
      const wires = new Map()
      
      groupState.contacts.forEach((contact, contactId) => {
        contacts.set(contactId, { ...contact })
      })
      
      groupState.wires.forEach((wire, wireId) => {
        wires.set(wireId, { ...wire })
      })
      
      exportedGroups.set(groupId, { group, contacts, wires })
    })
    
    return {
      groups: exportedGroups,
      currentGroupId: this.state.currentGroupId,
      rootGroupId: this.state.rootGroupId
    }
  }
  
  /**
   * Subscribe to changes in the propagation network
   */
  subscribe(callback: (changes: Change[]) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }
  
  // Helper methods
  private findContact(contactId: string): Contact | undefined {
    for (const groupState of this.state.groups.values()) {
      const contact = groupState.contacts.get(contactId)
      if (contact) return contact
    }
    return undefined
  }
  
  private findGroupForContact(contactId: string): string | undefined {
    for (const [groupId, groupState] of this.state.groups) {
      if (groupState.contacts.has(contactId)) {
        return groupId
      }
    }
    return undefined
  }
  
  private notifySubscribers(changes: Change[]): void {
    this.subscribers.forEach(callback => callback(changes))
  }
}