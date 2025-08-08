/**
 * Memory Storage Driver for Kernel
 * Simple in-memory storage implementation for testing and development
 */

import type {
  ContactChange,
  DriverResponse,
  DriverCommand,
  CommandResponse,
} from '../types'
import { DriverError, CommandError } from '../types'
import type { StorageDriver, StorageCapabilities } from '../driver'
import type { GroupState, GroupId, ContactId } from '../../types'

interface StoredData {
  groups: Map<GroupId, GroupState>
  contacts: Map<string, any> // "groupId:contactId" -> content
}

export class MemoryStorageDriver implements StorageDriver {
  readonly id: string
  readonly name: string = 'memory-storage'
  readonly version: string = '1.0.0'
  
  private networks = new Map<string, StoredData>()
  private networkId: string
  
  constructor(options: { id?: string; networkId?: string } = {}) {
    this.id = options.id || `memory-storage-${Date.now()}`
    this.networkId = options.networkId || 'default'
    
    // Initialize the network storage
    this.ensureNetwork()
  }
  
  private ensureNetwork(): StoredData {
    if (!this.networks.has(this.networkId)) {
      this.networks.set(this.networkId, {
        groups: new Map(),
        contacts: new Map()
      })
    }
    return this.networks.get(this.networkId)!
  }
  
  private contactKey(groupId: GroupId, contactId: ContactId): string {
    return `${groupId}:${contactId}`
  }
  
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    try {
      const storage = this.ensureNetwork()
      const key = this.contactKey(change.groupId, change.contactId)
      
      // Save the contact content
      storage.contacts.set(key, change.value)
      
      return { status: 'success' }
    } catch (error) {
      if (error instanceof DriverError) {
        throw error
      }
      throw new DriverError(
        `Unexpected error saving contact ${change.contactId}`,
        { fatal: true, originalError: error as Error }
      )
    }
  }
  
  async handleCommand(command: DriverCommand): Promise<CommandResponse> {
    try {
      switch (command.type) {
        case 'initialize':
          // Memory storage is always ready
          this.ensureNetwork()
          return { status: 'success' }
          
        case 'shutdown':
          // Clear memory if forced
          if (command.force) {
            this.networks.clear()
          }
          return { status: 'success' }
          
        case 'health-check':
          // Memory storage is always healthy
          return { status: 'success', data: { healthy: true } }
          
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
    // Memory storage is always healthy if it exists
    return true
  }
  
  async checkPreconditions(change: ContactChange): Promise<void> {
    // For memory storage, preconditions always pass
    // We can always write to memory (no disk space issues, permissions, etc.)
    this.ensureNetwork()
  }
  
  async checkPostconditions(change: ContactChange): Promise<void> {
    const storage = this.ensureNetwork()
    const key = this.contactKey(change.groupId, change.contactId)
    
    // Verify the contact was actually saved
    if (!storage.contacts.has(key)) {
      throw new DriverError(
        `Postcondition failed: Contact ${change.contactId} was not saved`,
        { fatal: true }
      )
    }
    
    // Verify the content matches what was saved
    const savedContent = storage.contacts.get(key)
    if (savedContent !== change.value) {
      throw new DriverError(
        `Postcondition failed: Contact ${change.contactId} content mismatch`,
        { fatal: true }
      )
    }
  }
  
  async loadGroup(groupId: string): Promise<GroupState | undefined> {
    const storage = this.ensureNetwork()
    // For now, just return undefined - we're not storing full groups yet
    return storage.groups.get(groupId as GroupId)
  }
  
  getCapabilities(): StorageCapabilities {
    return {
      supportsBatching: false,
      supportsTransactions: false,
      supportsStreaming: false,
      persistent: false, // Memory storage is not persistent
    }
  }
  
  /**
   * Get contact content for testing
   */
  getContactContent(groupId: GroupId, contactId: ContactId): any {
    const storage = this.ensureNetwork()
    const key = this.contactKey(groupId, contactId)
    return storage.contacts.get(key)
  }
  
  /**
   * Get all stored data for testing
   */
  getAllData(): StoredData {
    return this.ensureNetwork()
  }
}