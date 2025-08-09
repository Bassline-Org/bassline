/**
 * UI Adapter Layer
 * 
 * Bridges between the low-level KernelClient and the higher-level UI expectations.
 * Converts kernel-level ContactChange events into broader Change events that include
 * operations like contact-added, group-created, wire-added, etc.
 */

import type { ContactChange, Change, GroupState, Contact, Group, PrimitiveGadget } from '@bassline/core'
import { brand } from '@bassline/core'
import { KernelClient } from './kernel-client'

export interface UIAdapterConfig {
  kernelClient: KernelClient
}

export class UIAdapter {
  private kernelClient: KernelClient
  private changeCallbacks = new Set<(changes: Change[]) => void>()
  private groupSubscriptions = new Map<string, Set<(changes: Change[]) => void>>()
  
  constructor(config: UIAdapterConfig) {
    this.kernelClient = config.kernelClient
    this.setupKernelChangeHandler()
  }
  
  private setupKernelChangeHandler(): void {
    this.kernelClient.onChanges((contactChanges: ContactChange[]) => {
      // Convert ContactChange[] to Change[]
      const uiChanges: Change[] = contactChanges.map(contactChange => ({
        type: 'contact-updated' as const,
        data: {
          contactId: contactChange.contactId,
          groupId: contactChange.groupId,
          value: contactChange.value,
          timestamp: contactChange.timestamp
        },
        timestamp: contactChange.timestamp
      }))
      
      // Emit to all global change listeners
      this.changeCallbacks.forEach(callback => callback(uiChanges))
      
      // Emit to group-specific listeners
      uiChanges.forEach(change => {
        if (change.type === 'contact-updated') {
          const data = change.data as any
          const groupCallbacks = this.groupSubscriptions.get(data.groupId)
          if (groupCallbacks) {
            groupCallbacks.forEach(callback => callback([change]))
          }
        }
      })
    })
  }
  
  // ============================================================================
  // UI-Level Operations (generate broader Change events)
  // ============================================================================
  
  /**
   * Add a contact and emit contact-added change
   */
  async addContact(groupId: string, contactData: Omit<Contact, 'id'>): Promise<string> {
    const contactId = await this.kernelClient.addContact(groupId, contactData)
    
    // Emit UI-level change event
    const change: Change = {
      type: 'contact-added',
      data: {
        contactId,
        groupId,
        content: contactData.content,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
    
    this.emitChanges([change])
    return contactId
  }
  
  /**
   * Update a contact value
   */
  async updateContact(contactId: string, groupId: string, value: any): Promise<void> {
    await this.kernelClient.updateContact(contactId, groupId, value)
    // The ContactChange from kernel will be converted to contact-updated automatically
  }
  
  /**
   * Create a group and emit group-added change
   */
  async createGroup(name: string, parentId?: string): Promise<string> {
    const groupId = await this.kernelClient.createGroup(name, parentId)
    
    // Emit UI-level change event
    const change: Change = {
      type: 'group-added',
      data: {
        id: groupId,
        name,
        parentId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
    
    this.emitChanges([change])
    return groupId
  }
  
  /**
   * Legacy method names for backwards compatibility
   */
  async addGroup(parentId: string, groupData: { name: string }): Promise<string> {
    return this.createGroup(groupData.name, parentId)
  }
  
  async registerGroup(groupData: any): Promise<void> {
    // This is a low-level operation that should go through the kernel
    // For now, just create the group if it doesn't exist
    try {
      await this.getState(groupData.id)
      console.log(`Group ${groupData.id} already exists`)
    } catch (e) {
      // Group doesn't exist, create it
      await this.createGroup(groupData.name, groupData.parentId)
    }
  }
  
  async connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional'): Promise<string> {
    return this.createWire(fromId, toId)
  }
  
  /**
   * Create a wire and emit wire-added change
   */
  async createWire(fromId: string, toId: string): Promise<string> {
    const wireId = await this.kernelClient.createWire(fromId, toId)
    
    // Emit UI-level change event
    const change: Change = {
      type: 'wire-added',
      data: {
        id: wireId,
        fromId,
        toId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
    
    this.emitChanges([change])
    return wireId
  }
  
  /**
   * Create a primitive gadget group (legacy compatibility)
   */
  async createPrimitiveGadget(parentGroupId: string, primitiveId: string): Promise<string> {
    // Use new modular system with qualified names
    // For backwards compatibility, assume core primitives
    const qualifiedName = primitiveId.includes('/') ? primitiveId : `@bassline/core/${primitiveId}`
    return this.createPrimitiveGadgetV2(qualifiedName, parentGroupId)
  }
  
  /**
   * Create a primitive gadget using the new modular system
   */
  async createPrimitiveGadgetV2(qualifiedName: string, parentGroupId?: string): Promise<string> {
    // Create the primitive gadget group using new system
    const gadgetGroupId = await this.kernelClient.createPrimitiveGadgetV2(qualifiedName, parentGroupId)
    
    // Emit UI-level change event
    const change: Change = {
      type: 'gadget-added',
      data: {
        id: gadgetGroupId,
        primitiveId: qualifiedName,
        name: qualifiedName.split('/').pop() || qualifiedName,
        parentId: parentGroupId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
    
    this.emitChanges([change])
    return gadgetGroupId
  }
  
  /**
   * Load a primitive module
   */
  async loadPrimitiveModule(moduleSource: {
    type: 'npm' | 'file' | 'url'
    package?: string
    path?: string
    url?: string
    namespace: string
  }): Promise<void> {
    await this.kernelClient.loadPrimitiveModule(moduleSource)
  }
  
  /**
   * Get all available primitive gadgets (new modular system)
   */
  async getPrimitiveGadgets(): Promise<string[]> {
    return this.kernelClient.listPrimitives()
  }
  
  /**
   * Get primitive gadgets by namespace
   */
  async getPrimitiveGadgetsByNamespace(namespace: string): Promise<string[]> {
    const allPrimitives = await this.kernelClient.listPrimitives()
    return allPrimitives.filter(name => name.startsWith(namespace))
  }
  
  /**
   * Set the active scheduler
   */
  async setScheduler(schedulerId: string, config?: any): Promise<void> {
    await this.kernelClient.setScheduler(schedulerId, config)
  }
  
  /**
   * Create a demo network with primitive gadgets for testing
   */
  async createPrimitiveGadgetDemo(parentGroupId: string): Promise<{ addGadgetId: string; inputId: string; outputId: string }> {
    // Create an 'add' primitive gadget
    const addGadgetId = await this.createPrimitiveGadget(parentGroupId, 'add')
    
    // Get the gadget's boundary contacts
    const addGadgetState = await this.getState(addGadgetId)
    if (!addGadgetState) {
      throw new Error('Failed to create add gadget')
    }
    
    // Find input and output contacts
    const inputContacts = Array.from(addGadgetState.contacts.values()).filter(
      c => c.isBoundary && c.boundaryDirection === 'input'
    )
    const outputContacts = Array.from(addGadgetState.contacts.values()).filter(
      c => c.isBoundary && c.boundaryDirection === 'output'
    )
    
    // Create regular contacts to test with
    const inputId = await this.addContact(parentGroupId, {
      content: 5,
      blendMode: 'accept-last',
      groupId: brand.groupId(parentGroupId)
    })
    const outputId = await this.addContact(parentGroupId, {
      content: 0,
      blendMode: 'accept-last',
      groupId: brand.groupId(parentGroupId)
    })
    
    // Wire up the demo:
    // inputContact -> gadget input 'a' 
    // constant 3 -> gadget input 'b'
    // gadget output 'sum' -> outputContact
    
    if (inputContacts.length >= 2 && outputContacts.length >= 1) {
      // Connect input to first gadget input
      await this.createWire(inputId, inputContacts[0].id)
      
      // Set value on second gadget input directly
      await this.updateContact(inputContacts[1].id, addGadgetId, 3)
      
      // Connect gadget output to output contact
      await this.createWire(outputContacts[0].id, outputId)
    }
    
    return {
      addGadgetId,
      inputId,
      outputId
    }
  }
  
  // ============================================================================
  // Subscription Management
  // ============================================================================
  
  /**
   * Subscribe to all changes
   */
  onChanges(callback: (changes: Change[]) => void): () => void {
    this.changeCallbacks.add(callback)
    return () => this.changeCallbacks.delete(callback)
  }
  
  /**
   * Subscribe to changes for a specific group
   */
  subscribeToGroup(groupId: string, callback: (changes: Change[]) => void): () => void {
    // Subscribe to the group in the kernel
    this.kernelClient.subscribe(groupId).catch(error => {
      console.error('[UIAdapter] Failed to subscribe to group:', error)
    })
    
    // Add to group-specific callbacks
    if (!this.groupSubscriptions.has(groupId)) {
      this.groupSubscriptions.set(groupId, new Set())
    }
    this.groupSubscriptions.get(groupId)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.groupSubscriptions.get(groupId)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.groupSubscriptions.delete(groupId)
          // Could also unsubscribe from kernel here if needed
        }
      }
    }
  }
  
  /**
   * Legacy subscribe method for compatibility
   */
  subscribe(callbackOrGroupId: string | ((changes: Change[]) => void), callback?: (changes: Change[]) => void): () => void {
    if (typeof callbackOrGroupId === 'function') {
      // Global subscription
      return this.onChanges(callbackOrGroupId)
    } else {
      // Group-specific subscription
      return this.subscribeToGroup(callbackOrGroupId, callback!)
    }
  }
  
  // ============================================================================
  // Query Operations (delegate to kernel)
  // ============================================================================
  
  async getState(groupId: string): Promise<GroupState | null> {
    return this.kernelClient.getState(groupId)
  }
  
  async getContact(contactId: string): Promise<any> {
    return this.kernelClient.queryContact(contactId)
  }
  
  async queryGroup(groupId: string, options?: any): Promise<any> {
    return this.kernelClient.queryGroup(groupId, options)
  }
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  async initialize(): Promise<void> {
    return this.kernelClient.initialize()
  }
  
  async terminate(): Promise<void> {
    this.changeCallbacks.clear()
    this.groupSubscriptions.clear()
    return this.kernelClient.terminate()
  }
  
  getIsReady(): boolean {
    return this.kernelClient.getIsReady()
  }
  
  onReady(callback: () => void): () => void {
    return this.kernelClient.onReady(callback)
  }
  
  onError(callback: (error: Error) => void): () => void {
    return this.kernelClient.onError(callback)
  }
  
  // ============================================================================
  // Primitive Management
  // ============================================================================
  
  async listPrimitives(): Promise<string[]> {
    return this.kernelClient.listPrimitives()
  }
  
  async listPrimitiveInfo(): Promise<any[]> {
    return this.kernelClient.listPrimitiveInfo()
  }
  
  async getPrimitiveInfo(qualifiedName: string): Promise<any> {
    return this.kernelClient.getPrimitiveInfo(qualifiedName)
  }
  
  // ============================================================================
  // Scheduler Management  
  // ============================================================================
  
  async listSchedulers(): Promise<string[]> {
    return this.kernelClient.listSchedulers()
  }
  
  async getSchedulerInfo(schedulerId: string): Promise<any> {
    return this.kernelClient.getSchedulerInfo(schedulerId)
  }
  
  // ============================================================================
  // Private Helpers
  // ============================================================================
  
  private emitChanges(changes: Change[]): void {
    this.changeCallbacks.forEach(callback => callback(changes))
  }
}