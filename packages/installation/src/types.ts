/**
 * Types for Bassline user installations
 */

import type { 
  NetworkStorage, 
  StorageConfig,
  GroupState,
  NetworkState,
  PropagationNetworkScheduler
} from '@bassline/core'
// Define Bassline locally to avoid circular dependency
export interface Bassline {
  name: string
  version?: string
  attributes?: Record<string, any>
  [key: string]: any
}

/**
 * Factory function for creating storage backends
 */
export type StorageFactory = (config?: any) => NetworkStorage | Promise<NetworkStorage>

/**
 * Factory function for creating transport layers
 */
export type TransportFactory = (config?: any) => Transport | Promise<Transport>

/**
 * Transport layer interface
 */
export interface Transport {
  connect(url: string): Promise<void>
  disconnect(): Promise<void>
  send(message: any): Promise<void>
  onMessage(handler: (message: any) => void): void
  onError(handler: (error: Error) => void): void
}

/**
 * Lifecycle hooks for installation
 */
export interface InstallationHooks {
  // Network lifecycle
  beforeNetworkCreate?: (config: NetworkConfig) => Promise<void> | void
  afterNetworkCreate?: (network: Network) => Promise<void> | void
  beforeNetworkStart?: (network: Network) => Promise<void> | void
  afterNetworkStart?: (network: Network) => Promise<void> | void
  beforeNetworkStop?: (network: Network) => Promise<void> | void
  afterNetworkStop?: (network: Network) => Promise<void> | void
  
  // Storage lifecycle
  beforeStorageInit?: (type: string, config: any) => Promise<void> | void
  afterStorageInit?: (storage: NetworkStorage) => Promise<void> | void
  
  // Transport lifecycle
  beforeTransportInit?: (type: string, config: any) => Promise<void> | void
  afterTransportInit?: (transport: Transport) => Promise<void> | void
  
  // Operation hooks
  beforeOperation?: (op: Operation) => Promise<void> | void
  afterOperation?: (op: Operation, result: any) => Promise<void> | void
  onError?: (error: Error, context: any) => Promise<void> | void
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  id: string
  name?: string
  storage: {
    type: string
    config?: any
  }
  transport?: {
    type: string
    config?: any
  }
  scheduler?: {
    type: 'immediate' | 'batch'
    config?: any
  }
}

/**
 * Running network instance
 */
export interface Network {
  id: string
  config: NetworkConfig
  storage: NetworkStorage
  transport?: Transport
  scheduler: PropagationNetworkScheduler
  state: 'stopped' | 'starting' | 'running' | 'stopping'
  createdAt: Date
  startedAt?: Date
}

/**
 * Operation for hooks
 */
export interface Operation {
  type: 'create' | 'read' | 'update' | 'delete'
  target: 'network' | 'group' | 'contact' | 'wire'
  networkId?: string
  groupId?: string
  contactId?: string
  data?: any
}

/**
 * Configuration for BasslineInstallation
 */
export interface InstallationConfig {
  /**
   * Available storage backends
   */
  storage: Record<string, StorageFactory | (() => Promise<StorageFactory>)>
  
  /**
   * Available transport layers
   */
  transports?: Record<string, TransportFactory | (() => Promise<TransportFactory>)>
  
  /**
   * Pre-installed basslines
   */
  basslines?: Record<string, Bassline | (() => Promise<Bassline>)>
  
  /**
   * Default configurations
   */
  defaults?: {
    storage?: string
    transport?: string
    scheduler?: 'immediate' | 'batch'
  }
  
  /**
   * Lifecycle hooks
   */
  hooks?: InstallationHooks
  
  /**
   * Daemon configuration
   */
  daemon?: {
    port?: number
    host?: string
    maxNetworks?: number
    logLevel?: 'debug' | 'info' | 'warn' | 'error'
  }
}

/**
 * Installation metadata
 */
export interface InstallationMetadata {
  version: string
  createdAt: Date
  updatedAt: Date
  path: string
}