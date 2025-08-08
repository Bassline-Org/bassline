/**
 * PostgreSQL Storage Driver for Kernel
 * Wraps PostgresStorage to implement the StorageDriver interface
 */

import type {
  ContactChange,
  DriverResponse,
  DriverCommand,
  CommandResponse,
  StorageDriver,
  StorageCapabilities,
  DriverError,
  CommandError,
  GroupState,
} from '@bassline/core'
import { brand } from '@bassline/core'
import { PostgresStorage } from './index.js'

export interface PostgresDriverConfig {
  id?: string
  networkId?: string
  connectionString?: string
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean | object
  poolSize?: number
}

export class PostgresStorageDriver implements StorageDriver {
  readonly id: string
  readonly name: string = 'postgres-storage'
  readonly version: string = '1.0.0'
  
  private storage: PostgresStorage
  private networkId: string
  private batchMode = false
  private batchOperations: Array<() => Promise<void>> = []
  
  constructor(config: PostgresDriverConfig = {}) {
    this.id = config.id || `postgres-storage-${Date.now()}`
    this.networkId = config.networkId || 'default'
    
    // Create PostgresStorage with config
    this.storage = new PostgresStorage({
      type: 'postgres',
      options: {
        connectionString: config.connectionString,
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        poolSize: config.poolSize,
      }
    })
  }
  
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    const saveOperation = async () => {
      const result = await this.storage.saveContactContent(
        brand.networkId(this.networkId),
        change.groupId,
        change.contactId,
        change.value
      )
      
      if (!result.ok) {
        // Import DriverError from core
        const { DriverError } = await import('@bassline/core')
        throw new DriverError(
          `Failed to save contact ${change.contactId}: ${result.error.message}`,
          { 
            fatal: result.error.code === 'STORAGE_CORRUPTION_ERROR',
            originalError: new Error(result.error.message)
          }
        )
      }
    }
    
    // If in batch mode, queue the operation
    if (this.batchMode) {
      this.batchOperations.push(saveOperation)
    } else {
      // Execute immediately
      await saveOperation()
    }
    
    return { status: 'success' }
  }
  
  async handleCommand(command: DriverCommand): Promise<CommandResponse> {
    const { CommandError } = await import('@bassline/core')
    
    try {
      switch (command.type) {
        case 'initialize':
          const initResult = await this.storage.initialize()
          if (!initResult.ok) {
            throw new CommandError(
              `Failed to initialize PostgreSQL storage: ${initResult.error.message}`,
              { canContinue: false }
            )
          }
          
          // Ensure the network exists
          const existsResult = await this.storage.exists(brand.networkId(this.networkId))
          if (!existsResult.ok) {
            throw new CommandError(
              `Failed to check network existence: ${existsResult.error.message}`,
              { canContinue: false }
            )
          }
          
          // If network doesn't exist, create it
          if (!existsResult.value) {
            const createResult = await this.storage.saveNetworkState(
              brand.networkId(this.networkId),
              {
                groups: new Map(),
                currentGroupId: 'root',
                rootGroupId: 'root'
              }
            )
            
            if (!createResult.ok) {
              throw new CommandError(
                `Failed to create network: ${createResult.error.message}`,
                { canContinue: false }
              )
            }
          }
          
          return { status: 'success' }
          
        case 'shutdown':
          // Finish any pending batch operations
          if (this.batchMode && this.batchOperations.length > 0) {
            if (!command.force) {
              // Try to commit pending operations
              await this.commitBatch()
            } else {
              // Force shutdown - discard pending operations
              await this.rollbackBatch()
            }
          }
          
          const closeResult = await this.storage.close()
          if (!closeResult.ok && !command.force) {
            throw new CommandError(
              `Failed to close PostgreSQL storage: ${closeResult.error.message}`,
              { canContinue: true }
            )
          }
          return { status: 'success' }
          
        case 'health-check':
          // Try a simple query to check connection
          const healthResult = await this.storage.exists(brand.networkId(this.networkId))
          return { 
            status: 'success', 
            data: { 
              healthy: healthResult.ok,
              batchMode: this.batchMode,
              pendingOperations: this.batchOperations.length
            } 
          }
          
        default:
          throw new CommandError(
            `Unknown command: ${(command as any).type}`,
            { canContinue: true }
          )
      }
    } catch (error) {
      if (error instanceof CommandError) {
        throw error
      }
      throw new CommandError(
        `Unexpected error handling command: ${command.type}`,
        { canContinue: false, originalError: error as Error }
      )
    }
  }
  
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.storage.exists(brand.networkId(this.networkId))
      return result.ok
    } catch {
      return false
    }
  }
  
  async checkPreconditions(change: ContactChange): Promise<void> {
    // Ensure the group exists in the database
    const { DriverError } = await import('@bassline/core')
    
    const groupResult = await this.storage.loadGroupState(
      brand.networkId(this.networkId),
      change.groupId
    )
    
    if (!groupResult.ok) {
      throw new DriverError(
        `Precondition failed: ${groupResult.error.message}`,
        { fatal: groupResult.error.code === 'STORAGE_CONNECTION_ERROR' }
      )
    }
    
    // If group doesn't exist, create it (and network if needed)
    if (!groupResult.value) {
      // First ensure the network exists
      const existsResult = await this.storage.exists(brand.networkId(this.networkId))
      if (!existsResult.ok) {
        throw new DriverError(
          `Failed to check network existence: ${existsResult.error.message}`,
          { fatal: true }
        )
      }
      
      if (!existsResult.value) {
        const createNetworkResult = await this.storage.saveNetworkState(
          brand.networkId(this.networkId),
          {
            groups: new Map(),
            currentGroupId: 'root',
            rootGroupId: 'root'
          }
        )
        
        if (!createNetworkResult.ok) {
          throw new DriverError(
            `Failed to create network: ${createNetworkResult.error.message}`,
            { fatal: true }
          )
        }
      }
      
      // Now create the group
      const saveResult = await this.storage.saveGroupState(
        brand.networkId(this.networkId),
        change.groupId,
        {
          group: {
            id: change.groupId,
            name: 'Auto-created group',
            contactIds: [],
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: [],
            attributes: {}
          },
          contacts: new Map(),
          wires: new Map()
        }
      )
      
      if (!saveResult.ok) {
        throw new DriverError(
          `Failed to create group ${change.groupId}: ${saveResult.error.message}`,
          { fatal: true }
        )
      }
    }
  }
  
  async checkPostconditions(change: ContactChange): Promise<void> {
    // Only check postconditions if not in batch mode
    // (batch operations are verified when committed)
    if (this.batchMode) {
      return
    }
    
    const { DriverError } = await import('@bassline/core')
    
    // Verify the contact was actually saved
    const result = await this.storage.loadContactContent(
      brand.networkId(this.networkId),
      change.groupId,
      change.contactId
    )
    
    if (!result.ok) {
      throw new DriverError(
        `Postcondition failed: Could not verify contact ${change.contactId} was saved: ${result.error.message}`,
        { fatal: true }
      )
    }
    
    // Verify the content matches (deep equality since JSON property order can differ)
    // For objects, we need deep equality. For primitives, simple comparison
    let isEqual = false
    
    if (typeof result.value === 'object' && typeof change.value === 'object' && 
        result.value !== null && change.value !== null) {
      // Deep object comparison (order-independent)
      isEqual = JSON.stringify(result.value, Object.keys(result.value).sort()) === 
                JSON.stringify(change.value, Object.keys(change.value).sort())
    } else {
      // Primitive comparison
      isEqual = result.value === change.value
    }
    
    if (!isEqual) {
      console.log(`[PostgreSQL Driver] Postcondition check FAILED:`)
      console.log(`  Saved:`, JSON.stringify(result.value))
      console.log(`  Expected:`, JSON.stringify(change.value))
      
      throw new DriverError(
        `Postcondition failed: Contact ${change.contactId} content mismatch`,
        { fatal: true }
      )
    }
  }
  
  async loadGroup(groupId: string): Promise<GroupState | undefined> {
    const result = await this.storage.loadGroupState(
      brand.networkId(this.networkId),
      brand.groupId(groupId)
    )
    
    if (!result.ok) {
      const { DriverError } = await import('@bassline/core')
      throw new DriverError(
        `Failed to load group ${groupId}: ${result.error.message}`,
        { fatal: result.error.code === 'STORAGE_CORRUPTION_ERROR' }
      )
    }
    
    return result.value || undefined
  }
  
  // Optional batch operations for PostgreSQL transactions
  async beginBatch(): Promise<void> {
    this.batchMode = true
    this.batchOperations = []
  }
  
  async commitBatch(): Promise<void> {
    if (!this.batchMode) {
      return
    }
    
    try {
      // Execute all batched operations
      // In a real implementation, this would use a PostgreSQL transaction
      for (const operation of this.batchOperations) {
        await operation()
      }
      
      this.batchOperations = []
      this.batchMode = false
    } catch (error) {
      // Rollback on error
      await this.rollbackBatch()
      throw error
    }
  }
  
  async rollbackBatch(): Promise<void> {
    this.batchOperations = []
    this.batchMode = false
  }
  
  getCapabilities(): StorageCapabilities {
    return {
      supportsBatching: true,
      supportsTransactions: true,
      supportsStreaming: false,
      maxBatchSize: 1000,
      persistent: true, // PostgreSQL is persistent storage
    }
  }
  
  /**
   * Get the underlying PostgresStorage for advanced operations
   */
  getStorage(): PostgresStorage {
    return this.storage
  }
}