/**
 * BasslineInstallation - User's personalized Bassline environment
 */

import type {
  InstallationConfig,
  InstallationHooks,
  InstallationMetadata,
  StorageFactory,
  TransportFactory,
  Network,
  NetworkConfig,
  Operation
} from './types'
import type { NetworkStorage } from '@bassline/core'
import type { Bassline } from './types'

export class BasslineInstallation {
  private config: InstallationConfig
  private networks: Map<string, Network> = new Map()
  private metadata: InstallationMetadata
  
  constructor(config: InstallationConfig) {
    this.config = config
    this.metadata = {
      version: '0.1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      path: process.env.BASSLINE_HOME || '~/.bassline'
    }
    
    // Validate configuration
    this.validateConfig()
  }
  
  /**
   * Validate the installation configuration
   */
  private validateConfig() {
    if (!this.config.storage || Object.keys(this.config.storage).length === 0) {
      throw new Error('At least one storage backend must be configured')
    }
    
    // Set defaults if not provided
    if (!this.config.defaults) {
      this.config.defaults = {}
    }
    
    if (!this.config.defaults.storage) {
      this.config.defaults.storage = Object.keys(this.config.storage)[0]
    }
    
    if (!this.config.defaults.transport && this.config.transports) {
      this.config.defaults.transport = Object.keys(this.config.transports)[0]
    }
    
    if (!this.config.defaults.scheduler) {
      this.config.defaults.scheduler = 'immediate'
    }
  }
  
  /**
   * Get available storage backends
   */
  getAvailableStorage(): string[] {
    return Object.keys(this.config.storage)
  }
  
  /**
   * Get available transport layers
   */
  getAvailableTransports(): string[] {
    return Object.keys(this.config.transports || {})
  }
  
  /**
   * Get installed basslines
   */
  getInstalledBasslines(): string[] {
    return Object.keys(this.config.basslines || {})
  }
  
  /**
   * Create a storage backend instance
   */
  async createStorage(type: string, config?: any): Promise<NetworkStorage> {
    const factory = this.config.storage[type]
    if (!factory) {
      throw new Error(`Storage backend '${type}' not configured. Available: ${this.getAvailableStorage().join(', ')}`)
    }
    
    // Call hook
    await this.callHook('beforeStorageInit', type, config)
    
    // Handle both direct factories and lazy-loaded factories
    let storageFactory: StorageFactory
    if (typeof factory === 'function' && factory.constructor.name === 'AsyncFunction') {
      // It's an async function that returns a factory
      storageFactory = await (factory as () => Promise<StorageFactory>)()
    } else if (typeof factory === 'function') {
      // It's a direct factory
      storageFactory = factory as StorageFactory
    } else {
      throw new Error(`Invalid storage factory for '${type}'`)
    }
    
    // Create storage instance
    const storage = await storageFactory(config)
    
    // Call hook
    await this.callHook('afterStorageInit', storage)
    
    return storage
  }
  
  /**
   * Create a transport layer instance
   */
  async createTransport(type: string, config?: any) {
    if (!this.config.transports) {
      throw new Error('No transport layers configured')
    }
    
    const factory = this.config.transports[type]
    if (!factory) {
      throw new Error(`Transport layer '${type}' not configured. Available: ${this.getAvailableTransports().join(', ')}`)
    }
    
    // Call hook
    await this.callHook('beforeTransportInit', type, config)
    
    // Handle both direct factories and lazy-loaded factories
    let transportFactory: TransportFactory
    if (typeof factory === 'function' && factory.constructor.name === 'AsyncFunction') {
      transportFactory = await (factory as () => Promise<TransportFactory>)()
    } else if (typeof factory === 'function') {
      transportFactory = factory as TransportFactory
    } else {
      throw new Error(`Invalid transport factory for '${type}'`)
    }
    
    // Create transport instance
    const transport = await transportFactory(config)
    
    // Call hook
    await this.callHook('afterTransportInit', transport)
    
    return transport
  }
  
  /**
   * Get a bassline by name
   */
  async getBassline(name: string): Promise<Bassline> {
    if (!this.config.basslines) {
      throw new Error('No basslines configured')
    }
    
    const bassline = this.config.basslines[name]
    if (!bassline) {
      throw new Error(`Bassline '${name}' not found. Available: ${this.getInstalledBasslines().join(', ')}`)
    }
    
    // Handle both direct basslines and lazy-loaded basslines
    if (typeof bassline === 'function') {
      return await (bassline as () => Promise<Bassline>)()
    }
    
    return bassline as Bassline
  }
  
  /**
   * Create a new network
   */
  async createNetwork(config: NetworkConfig): Promise<Network> {
    // Use defaults if not specified
    if (!config.storage) {
      config.storage = {
        type: this.config.defaults!.storage!
      }
    }
    
    // Call hook
    await this.callHook('beforeNetworkCreate', config)
    
    // Create storage
    const storage = await this.createStorage(config.storage.type, config.storage.config)
    
    // Create transport if specified
    let transport
    if (config.transport) {
      transport = await this.createTransport(config.transport.type, config.transport.config)
    }
    
    // Create scheduler
    const { createImmediateScheduler, createBatchScheduler } = await import('@bassline/core')
    const schedulerType = config.scheduler?.type || this.config.defaults!.scheduler!
    const scheduler = schedulerType === 'batch' 
      ? createBatchScheduler(config.scheduler?.config)
      : createImmediateScheduler()
    
    // Create network instance
    const network: Network = {
      id: config.id,
      config,
      storage,
      transport,
      scheduler,
      state: 'stopped',
      createdAt: new Date()
    }
    
    // Store network
    this.networks.set(network.id, network)
    
    // Call hook
    await this.callHook('afterNetworkCreate', network)
    
    return network
  }
  
  /**
   * Get a network by ID
   */
  getNetwork(id: string): Network | undefined {
    return this.networks.get(id)
  }
  
  /**
   * List all networks
   */
  listNetworks(): Network[] {
    return Array.from(this.networks.values())
  }
  
  /**
   * Start a network
   */
  async startNetwork(id: string): Promise<void> {
    const network = this.networks.get(id)
    if (!network) {
      throw new Error(`Network '${id}' not found`)
    }
    
    if (network.state === 'running') {
      return
    }
    
    network.state = 'starting'
    
    // Call hook
    await this.callHook('beforeNetworkStart', network)
    
    // Initialize storage if needed
    if (network.storage.initialize) {
      await network.storage.initialize()
    }
    
    // Connect transport if present
    if (network.transport) {
      // Transport connection logic here
    }
    
    network.state = 'running'
    network.startedAt = new Date()
    
    // Call hook
    await this.callHook('afterNetworkStart', network)
  }
  
  /**
   * Stop a network
   */
  async stopNetwork(id: string): Promise<void> {
    const network = this.networks.get(id)
    if (!network) {
      throw new Error(`Network '${id}' not found`)
    }
    
    if (network.state === 'stopped') {
      return
    }
    
    network.state = 'stopping'
    
    // Call hook
    await this.callHook('beforeNetworkStop', network)
    
    // Disconnect transport if present
    if (network.transport && network.transport.disconnect) {
      await network.transport.disconnect()
    }
    
    // Close storage if needed
    if (network.storage.close) {
      await network.storage.close()
    }
    
    network.state = 'stopped'
    
    // Call hook
    await this.callHook('afterNetworkStop', network)
  }
  
  /**
   * Delete a network
   */
  async deleteNetwork(id: string): Promise<void> {
    const network = this.networks.get(id)
    if (!network) {
      return
    }
    
    // Stop if running
    if (network.state === 'running') {
      await this.stopNetwork(id)
    }
    
    // Delete from storage
    if (network.storage.deleteNetwork) {
      await network.storage.deleteNetwork(network.id)
    }
    
    // Remove from map
    this.networks.delete(id)
  }
  
  /**
   * Call a lifecycle hook
   */
  private async callHook(hookName: keyof InstallationHooks, ...args: any[]): Promise<void> {
    if (!this.config.hooks) return
    
    const hook = this.config.hooks[hookName] as Function
    if (hook) {
      try {
        await hook(...args)
      } catch (error) {
        if (this.config.hooks.onError) {
          await this.config.hooks.onError(error as Error, { hook: hookName, args })
        } else {
          console.error(`Hook ${hookName} failed:`, error)
        }
      }
    }
  }
  
  /**
   * Get installation metadata
   */
  getMetadata(): InstallationMetadata {
    return { ...this.metadata }
  }
  
  /**
   * Get default configuration
   */
  getDefaults() {
    return { ...this.config.defaults }
  }
  
  /**
   * Export installation configuration (for sharing)
   */
  exportConfig(): InstallationConfig {
    // Return a sanitized version without functions
    return {
      storage: Object.keys(this.config.storage).reduce((acc, key) => {
        acc[key] = '<function>'
        return acc
      }, {} as any),
      transports: this.config.transports ? Object.keys(this.config.transports).reduce((acc, key) => {
        acc[key] = '<function>'
        return acc
      }, {} as any) : undefined,
      basslines: this.config.basslines ? Object.keys(this.config.basslines).reduce((acc, key) => {
        acc[key] = '<function>'
        return acc
      }, {} as any) : undefined,
      defaults: this.config.defaults,
      daemon: this.config.daemon
    }
  }
}