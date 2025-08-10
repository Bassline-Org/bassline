/**
 * Kernel Client
 * 
 * Unified client interface that works with both local (worker) and remote (WebSocket) modes
 * Provides the same API regardless of where the kernel is running
 */

import { 
  Kernel,
  type ExternalInput,
  type ContactChange,
  type GroupState,
  brand,
  type Contact
} from '@bassline/core'
import { BrowserWorkerBridgeDriver } from '@bassline/browser-drivers'
import { RemoteWebSocketBridgeDriver } from '@bassline/remote-drivers'

export interface KernelClientConfig {
  mode: 'local' | 'remote'
  url?: string
  onChanges?: (changes: ContactChange[]) => void
  onReady?: () => void
  onError?: (error: Error) => void
}

/**
 * Unified client for interacting with Bassline kernel
 * Works with both local worker and remote server modes
 */
export class KernelClient {
  private kernel: Kernel
  private bridge: BrowserWorkerBridgeDriver | RemoteWebSocketBridgeDriver
  private changeCallbacks = new Set<(changes: ContactChange[]) => void>()
  private readyCallbacks = new Set<() => void>()
  private errorCallbacks = new Set<(error: Error) => void>()
  private config: KernelClientConfig
  private isReady = false
  
  constructor(config: KernelClientConfig) {
    this.config = config
    this.kernel = new Kernel({ debug: true })
    
    // Add external callbacks if provided
    if (config.onChanges) {
      this.changeCallbacks.add(config.onChanges)
    }
    if (config.onReady) {
      this.readyCallbacks.add(config.onReady)
    }
    if (config.onError) {
      this.errorCallbacks.add(config.onError)
    }
    
    // Create appropriate bridge based on mode
    if (config.mode === 'local') {
      this.bridge = this.createLocalBridge()
    } else {
      this.bridge = this.createRemoteBridge(config.url || 'ws://localhost:8455')
    }
    
    // Set up event handlers
    this.setupEventHandlers()
    
    // Register bridge with kernel
    this.kernel.registerDriver(this.bridge).then(() => {
      console.log('[KernelClient] Bridge registered')
    }).catch(error => {
      console.error('[KernelClient] Failed to register bridge:', error)
      this.handleError(error)
    })
  }
  
  private createLocalBridge(): BrowserWorkerBridgeDriver {
    // Create worker for local kernel
    const worker = new Worker(
      new URL('./kernel-worker.ts', import.meta.url),
      { type: 'module' }
    )
    
    return new BrowserWorkerBridgeDriver({ worker })
  }
  
  private createRemoteBridge(url: string): RemoteWebSocketBridgeDriver {
    return new RemoteWebSocketBridgeDriver({ url })
  }
  
  private setupEventHandlers(): void {
    // Listen for changes
    this.bridge.on('change', (change: ContactChange) => {
      this.changeCallbacks.forEach(cb => cb([change]))
    })
    
    // Listen for ready event
    this.bridge.on('ready', () => {
      this.isReady = true
      this.readyCallbacks.forEach(cb => cb())
    })
    
    // Listen for errors
    this.bridge.on('error', (error: Error) => {
      this.handleError(error)
    })
    
    // Listen for connection events (remote mode)
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      this.bridge.on('connected', () => {
        console.log('[KernelClient] Connected to remote server')
        this.isReady = true
        this.readyCallbacks.forEach(cb => cb())
      })
      
      this.bridge.on('disconnected', () => {
        console.log('[KernelClient] Disconnected from remote server')
        this.isReady = false
      })
    }
  }
  
  private handleError(error: Error): void {
    console.error('[KernelClient] Error:', error)
    this.errorCallbacks.forEach(cb => cb(error))
  }
  
  // ============================================================================
  // Public API - Full Client Capabilities
  // ============================================================================
  
  /**
   * Check if client is ready
   */
  getIsReady(): boolean {
    return this.isReady
  }
  
  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      // Start listening (connects to server)
      await this.bridge.startListening()
    } else {
      // Worker initializes automatically
    }
  }
  
  /**
   * Subscribe to a group for changes
   */
  async subscribe(groupId: string): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      await this.bridge.subscribe(groupId)
    }
    // Local mode gets all changes automatically
  }
  
  /**
   * Unsubscribe from a group
   */
  async unsubscribe(groupId: string): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      await this.bridge.unsubscribe(groupId)
    }
  }
  
  /**
   * Add a contact to a group
   */
  async addContact(groupId: string, contactData: Omit<Contact, 'id'>): Promise<string> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      return this.bridge.addContact(groupId, contactData)
    } else {
      // Local mode - send through kernel
      const input: ExternalInput = {
        type: 'external-add-contact',
        source: 'ui',
        groupId: brand.groupId(groupId),
        contact: contactData
      }
      const result = await this.bridge.sendOperation(input)
      return result?.id || result?.contactId || 'unknown'
    }
  }
  
  /**
   * Update a contact's value
   */
  async updateContact(contactId: string, groupId: string, value: any): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      await this.bridge.updateContact(contactId, groupId, value)
    } else {
      const input: ExternalInput = {
        type: 'external-contact-update',
        source: 'ui',
        contactId: brand.contactId(contactId),
        groupId: brand.groupId(groupId),
        value
      }
      await this.bridge.sendOperation(input)
    }
  }
  
  /**
   * Create a new group
   */
  async createGroup(name: string, parentId?: string): Promise<string> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      return this.bridge.createGroup(name, parentId)
    } else {
      const input: ExternalInput = {
        type: 'external-add-group',
        source: 'ui',
        parentGroupId: parentId ? brand.groupId(parentId) : undefined,
        group: { name }
      }
      const result = await this.bridge.sendOperation(input)
      return result?.id || result?.groupId || 'unknown'
    }
  }
  
  /**
   * Create a primitive gadget group (legacy compatibility)
   */
  async createPrimitiveGadget(parentId: string, primitiveId: string): Promise<string> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('createPrimitiveGadget not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-add-group',
        source: 'ui',
        parentGroupId: brand.groupId(parentId),
        group: { name: primitiveId, primitiveId }
      }
      const result = await this.bridge.sendOperation(input)
      return result?.id || result?.groupId || 'unknown'
    }
  }
  
  /**
   * Load a primitive module (new modular system)
   */
  async loadPrimitiveModule(moduleSource: {
    type: 'npm' | 'file' | 'url'
    package?: string
    path?: string
    url?: string
    namespace: string
  }): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('loadPrimitiveModule not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-load-primitive',
        source: 'ui',
        moduleSource
      }
      await this.bridge.sendOperation(input)
    }
  }
  
  /**
   * Create a primitive gadget using qualified name (new modular system)
   */
  async createPrimitiveGadgetV2(qualifiedName: string, parentId?: string): Promise<string> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('createPrimitiveGadgetV2 not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-create-primitive-gadget',
        source: 'ui',
        qualifiedName,
        parentGroupId: parentId ? brand.groupId(parentId) : undefined
      }
      const result = await this.bridge.sendOperation(input)
      return result?.id || result?.groupId || 'unknown'
    }
  }
  
  /**
   * List available primitives
   */
  async listPrimitives(): Promise<string[]> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('listPrimitives not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-list-primitives',
        source: 'ui',
        requestId: `list-${Date.now()}`
      }
      const result = await this.bridge.sendOperation(input)
      return result?.primitives || []
    }
  }

  /**
   * List detailed primitive information
   */
  async listPrimitiveInfo(): Promise<any[]> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('listPrimitiveInfo not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-list-primitive-info',
        source: 'ui',
        requestId: `list-info-${Date.now()}`
      }
      const result = await this.bridge.sendOperation(input)
      return result?.primitiveInfo || []
    }
  }

  /**
   * Get information for a specific primitive
   */
  async getPrimitiveInfo(qualifiedName: string): Promise<any> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('getPrimitiveInfo not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-get-primitive-info',
        source: 'ui',
        qualifiedName,
        requestId: `get-info-${Date.now()}`
      }
      const result = await this.bridge.sendOperation(input)
      return result?.primitiveInfo
    }
  }

  /**
   * List available schedulers
   */
  async listSchedulers(): Promise<string[]> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('listSchedulers not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-list-schedulers',
        source: 'ui',
        requestId: `list-schedulers-${Date.now()}`
      }
      const result = await this.bridge.sendOperation(input)
      return result?.schedulers || []
    }
  }

  /**
   * Get information for a specific scheduler
   */
  async getSchedulerInfo(schedulerId: string): Promise<any> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('getSchedulerInfo not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-get-scheduler-info',
        source: 'ui',
        schedulerId,
        requestId: `get-scheduler-${Date.now()}`
      }
      const result = await this.bridge.sendOperation(input)
      return result?.schedulerInfo
    }
  }
  
  /**
   * Set the active scheduler
   */
  async setScheduler(schedulerId: string, config?: any): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('setScheduler not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-set-scheduler',
        source: 'ui',
        schedulerId,
        config
      }
      await this.bridge.sendOperation(input)
    }
  }
  
  /**
   * Create a wire between contacts
   */
  async createWire(fromId: string, toId: string): Promise<string> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      return this.bridge.createWire(fromId, toId)
    } else {
      const input: ExternalInput = {
        type: 'external-create-wire',
        source: 'ui',
        fromContactId: brand.contactId(fromId),
        toContactId: brand.contactId(toId)
      }
      const result = await this.bridge.sendOperation(input)
      return result?.id || result?.wireId || 'unknown'
    }
  }
  
  /**
   * Remove a wire
   */
  async removeWire(wireId: string): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      // Add removeWire method to remote bridge if needed
      throw new Error('removeWire not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-remove-wire',
        source: 'ui',
        wireId: brand.wireId(wireId)
      }
      await this.bridge.sendOperation(input)
    }
  }
  
  /**
   * Remove a contact
   */
  async removeContact(contactId: string): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('removeContact not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-remove-contact',
        source: 'ui',
        contactId: brand.contactId(contactId)
      }
      await this.bridge.sendOperation(input)
    }
  }
  
  /**
   * Remove a group
   */
  async removeGroup(groupId: string): Promise<void> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('removeGroup not yet implemented for remote mode')
    } else {
      const input: ExternalInput = {
        type: 'external-remove-group',
        source: 'ui',
        groupId: brand.groupId(groupId)
      }
      await this.bridge.sendOperation(input)
    }
  }
  
  /**
   * Query wires in a group (from group query)
   */
  async getWires(groupId: string): Promise<any[]> {
    const result = await this.queryGroup(groupId, {
      includeWires: true,
      includeContacts: false,
      includeSubgroups: false
    })
    return result.wires || []
  }
  
  /**
   * Query a group's state
   */
  async queryGroup(groupId: string, options?: {
    includeContacts?: boolean
    includeWires?: boolean
    includeSubgroups?: boolean
  }): Promise<any> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      return this.bridge.queryGroup(groupId, options)
    } else {
      const input: ExternalInput = {
        type: 'external-query-group',
        source: 'ui',
        groupId: brand.groupId(groupId),
        includeContacts: options?.includeContacts,
        includeWires: options?.includeWires,
        includeSubgroups: options?.includeSubgroups
      }
      return this.bridge.sendOperation(input)
    }
  }
  
  /**
   * Query a contact's value
   */
  async queryContact(contactId: string): Promise<any> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      return this.bridge.queryContact(contactId)
    } else {
      const input: ExternalInput = {
        type: 'external-query-contact',
        source: 'ui',
        contactId: brand.contactId(contactId)
      }
      return this.bridge.sendOperation(input)
    }
  }
  
  /**
   * Undo the last operation
   */
  async undo(): Promise<{
    undone?: string
    canUndo: boolean
    canRedo: boolean
  }> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('Undo not yet implemented for remote mode')
    } else {
      const workerBridge = this.bridge as BrowserWorkerBridgeDriver
      const result = await workerBridge.sendCommand({ type: 'undo' })
      return result?.data || { canUndo: false, canRedo: false }
    }
  }
  
  /**
   * Redo the last undone operation
   */
  async redo(): Promise<{
    redone?: string
    canUndo: boolean
    canRedo: boolean
  }> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('Redo not yet implemented for remote mode')
    } else {
      const workerBridge = this.bridge as BrowserWorkerBridgeDriver
      const result = await workerBridge.sendCommand({ type: 'redo' })
      return result?.data || { canUndo: false, canRedo: false }
    }
  }
  
  /**
   * Get the history status
   */
  async getHistoryStatus(): Promise<{
    canUndo: boolean
    canRedo: boolean
    history?: any[]
  }> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      throw new Error('History status not yet implemented for remote mode')
    } else {
      const workerBridge = this.bridge as BrowserWorkerBridgeDriver
      const result = await workerBridge.sendCommand({ type: 'get-history' })
      return result?.data || { canUndo: false, canRedo: false }
    }
  }
  
  /**
   * Record a series of operations as a single undoable action
   * The callback can perform any number of operations that will be grouped together
   */
  async record<T>(description: string, callback: () => Promise<T>): Promise<T> {
    if (this.bridge instanceof RemoteWebSocketBridgeDriver) {
      // For remote mode, just execute without recording for now
      console.warn('[KernelClient] Record not yet implemented for remote mode, executing without recording')
      return await callback()
    }
    
    // Use simple recording flags in the worker
    const workerBridge = this.bridge as BrowserWorkerBridgeDriver
    
    // Start recording in the worker
    await workerBridge.sendCommand({ type: 'start-recording', data: { description } })
    
    try {
      // Execute the callback - operations will be tracked
      const result = await callback()
      
      // Stop recording 
      await workerBridge.sendCommand({ type: 'stop-recording' })
      
      return result
    } catch (error) {
      // Stop recording on error
      await workerBridge.sendCommand({ type: 'stop-recording' })
      throw error
    }
  }
  
  /**
   * Get the current state of a group (convenience method)
   */
  async getState(groupId: string): Promise<GroupState | null> {
    try {
      const result = await this.queryGroup(groupId, {
        includeContacts: true,
        includeWires: true,
        includeSubgroups: true
      })
      
      // Convert to GroupState format
      return {
        group: result.group,
        contacts: new Map(result.contacts?.map((c: any) => [c.id, c]) || []),
        wires: new Map(result.wires?.map((w: any) => [w.id, w]) || [])
      }
    } catch (error) {
      console.error('[KernelClient] Failed to get state:', error)
      return null
    }
  }
  
  /**
   * Register a callback for changes
   */
  onChanges(callback: (changes: ContactChange[]) => void): () => void {
    this.changeCallbacks.add(callback)
    return () => this.changeCallbacks.delete(callback)
  }
  
  /**
   * Register a callback for ready event
   */
  onReady(callback: () => void): () => void {
    this.readyCallbacks.add(callback)
    // If already ready, call immediately
    if (this.isReady) {
      callback()
    }
    return () => this.readyCallbacks.delete(callback)
  }
  
  /**
   * Register a callback for errors
   */
  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.add(callback)
    return () => this.errorCallbacks.delete(callback)
  }
  
  /**
   * Compatibility methods for existing UI hooks
   */
  
  /**
   * Get contact data (compatibility method)
   */
  async getContact(contactId: string): Promise<any> {
    return this.queryContact(contactId)
  }
  
  /**
   * Legacy subscribe method for compatibility with existing hooks
   */
  subscribeWithCallback(callbackOrGroupId: string | ((changes: ContactChange[]) => void), callback?: (changes: ContactChange[]) => void): () => void {
    if (typeof callbackOrGroupId === 'function') {
      // Called as subscribe(callback)
      return this.onChanges(callbackOrGroupId)
    } else {
      // Called as subscribe(groupId, callback) 
      const groupId = callbackOrGroupId
      const changeCallback = callback!
      
      // Subscribe to the group using the base subscribe method
      this.subscribe(groupId).catch(error => {
        console.error('[KernelClient] Failed to subscribe to group:', error)
      })
      
      // Return the change subscription
      return this.onChanges(changeCallback)
    }
  }

  /**
   * Terminate the client
   */
  async terminate(): Promise<void> {
    await this.kernel.shutdown()
  }
}