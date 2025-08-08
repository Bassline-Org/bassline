/**
 * Kernel-based network implementation for CLI
 * Replaces the old StandaloneNetwork with a proper kernel architecture
 */

import { EventEmitter } from 'events'
import { 
  Kernel,
  UserspaceRuntime,
  type Driver,
  type StorageDriver,
  type BridgeDriver,
  type ContactChange,
  type ExternalInput,
  type GroupState,
  brand
} from '@bassline/core'

export interface KernelNetworkOptions {
  verbose?: boolean
}

export interface NetworkChange {
  type: string
  data: any
  timestamp: number
}

/**
 * Kernel-based network that manages drivers and runtime
 */
export class KernelNetwork extends EventEmitter {
  private kernel: Kernel
  private runtime: UserspaceRuntime
  private drivers: Map<string, Driver> = new Map()
  private isRunning = false
  
  constructor(options: KernelNetworkOptions = {}) {
    super()
    
    // Initialize kernel
    this.kernel = new Kernel()
    
    // Initialize userspace runtime
    this.runtime = new UserspaceRuntime({ kernel: this.kernel })
    
    // Set up kernel to runtime connection
    this.kernel.setUserspaceHandler(this.runtime.receiveExternalInput.bind(this.runtime))
    
    // The kernel already handles forwarding changes to bridge drivers
    // via the runtime's emitToKernel -> kernel.handleChange -> all drivers
    
    if (options.verbose) {
      this.setupLogging()
    }
  }
  
  /**
   * Register a driver with the kernel
   */
  async registerDriver(id: string, driver: Driver): Promise<void> {
    if (this.drivers.has(id)) {
      throw new Error(`Driver with id ${id} already registered`)
    }
    
    this.drivers.set(id, driver)
    await this.kernel.registerDriver(driver)
    
    // Start bridge drivers listening
    if ('startListening' in driver) {
      await (driver as BridgeDriver).startListening()
    }
    
    this.emit('driver-registered', { id, driver })
  }
  
  /**
   * Remove a driver
   */
  async unregisterDriver(id: string): Promise<void> {
    const driver = this.drivers.get(id)
    if (!driver) {
      throw new Error(`Driver with id ${id} not found`)
    }
    
    // Stop bridge drivers
    if ('stopListening' in driver) {
      await (driver as BridgeDriver).stopListening()
    }
    
    await this.kernel.unregisterDriver(id)
    this.drivers.delete(id)
    
    this.emit('driver-unregistered', { id })
  }
  
  /**
   * Get all registered drivers
   */
  getDrivers(): Map<string, Driver> {
    return new Map(this.drivers)
  }
  
  /**
   * Start the network
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }
    
    // No kernel initialization needed - it's ready on construction
    
    // Create root group if it doesn't exist
    try {
      await this.runtime.getState('root')
    } catch {
      await this.runtime.registerGroup({
        id: brand.groupId('root'),
        name: 'Root Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
    }
    
    this.isRunning = true
    this.emit('started')
  }
  
  /**
   * Stop the network
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }
    
    // Stop all bridge drivers
    for (const [id, driver] of this.drivers) {
      if ('stopListening' in driver) {
        await (driver as BridgeDriver).stopListening()
      }
    }
    
    // Shutdown kernel
    await this.kernel.shutdown()
    
    this.isRunning = false
    this.emit('stopped')
  }
  
  /**
   * Check if network is running
   */
  getIsRunning(): boolean {
    return this.isRunning
  }
  
  /**
   * Initialize the network (alias for start)
   */
  async initialize(scheduler?: string): Promise<void> {
    // Scheduler selection could be implemented here if needed
    return this.start()
  }
  
  /**
   * Shutdown the network (alias for stop)
   */
  async shutdown(): Promise<void> {
    return this.stop()
  }
  
  /**
   * Import network state
   */
  async importState(state: any): Promise<void> {
    // TODO: Implement proper state import
    console.log('Importing state:', state)
  }
  
  /**
   * Export network state
   */
  async exportState(groupId?: string): Promise<any> {
    // TODO: Implement proper state export
    const state = {
      groups: {},
      contacts: {},
      wires: {}
    }
    return state
  }
  
  /**
   * Subscribe to changes
   */
  subscribe(callback: (changes: NetworkChange[]) => void): () => void {
    const listener = (change: any) => {
      callback([{
        type: 'change',
        data: change,
        timestamp: Date.now()
      }])
    }
    
    this.on('change', listener)
    
    // Return unsubscribe function
    return () => {
      this.off('change', listener)
    }
  }
  
  // ============================================================================
  // Runtime Operations (delegate to UserspaceRuntime)
  // ============================================================================
  
  async registerGroup(group: any): Promise<void> {
    return this.runtime.registerGroup(group)
  }
  
  async addContact(groupId: string, contact: any): Promise<string> {
    return this.runtime.addContact(groupId, contact)
  }
  
  async deleteContact(contactId: string): Promise<void> {
    // TODO: Implement contact deletion in runtime
    console.log('Deleting contact:', contactId)
  }
  
  async scheduleUpdate(contactId: string, content: any): Promise<void> {
    return this.runtime.scheduleUpdate(contactId, content)
  }
  
  async getState(groupId: string): Promise<GroupState> {
    return this.runtime.getState(groupId)
  }
  
  async createGroup(name: string, parentId?: string): Promise<string> {
    const groupId = brand.groupId(`group-${Date.now()}`)
    await this.runtime.registerGroup({
      id: groupId,
      name,
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    if (parentId) {
      // TODO: Add to parent's subgroups
    }
    
    return groupId
  }
  
  async deleteGroup(groupId: string): Promise<void> {
    // TODO: Implement group deletion
    throw new Error('Group deletion not yet implemented')
  }
  
  async listGroups(): Promise<string[]> {
    // TODO: Implement group listing
    return ['root']
  }
  
  async listPrimitives(): Promise<any[]> {
    // TODO: Return available primitive gadgets
    return []
  }
  
  // ============================================================================
  // Kernel Health & Metrics
  // ============================================================================
  
  async isHealthy(): Promise<boolean> {
    // Check if all drivers are healthy
    for (const [id, driver] of this.drivers) {
      try {
        const healthy = await driver.isHealthy()
        if (!healthy) return false
      } catch {
        return false
      }
    }
    return true
  }
  
  async getMetrics(): Promise<any> {
    const metrics = {
      kernel: {
        healthy: await this.isHealthy(),
        drivers: this.drivers.size
      },
      drivers: {} as Record<string, any>
    }
    
    // Get stats from each driver
    for (const [id, driver] of this.drivers) {
      if (driver.getStats) {
        metrics.drivers[id] = await driver.getStats()
      }
    }
    
    return metrics
  }
  
  // ============================================================================
  // Private Helpers
  // ============================================================================
  
  private setupLogging(): void {
    // Log kernel events
    // Kernel doesn't have event emitter methods, log at network level instead
    
    // Log network events
    this.on('driver-registered', ({ id }) => {
      console.log(`[Network] Driver '${id}' registered`)
    })
    
    this.on('started', () => {
      console.log('[Network] Started')
    })
    
    this.on('stopped', () => {
      console.log('[Network] Stopped')
    })
  }
}