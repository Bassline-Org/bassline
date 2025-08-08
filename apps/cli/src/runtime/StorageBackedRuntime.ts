/**
 * Storage-backed runtime for CLI
 * Extends NetworkRuntime with persistent storage and content hashing
 */

import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { NetworkRuntime, GroupState } from './NetworkRuntime.js'
import type { NetworkStorage, NetworkId, GroupId, ContactId, Result } from '@bassline/core'
import { 
  brand, 
  StorageError, 
  DatabaseError, 
  wrapError 
} from '@bassline/core'

export interface StorageConfig {
  networkId?: string
  storage?: NetworkStorage
  loadOnInit?: boolean
}

export class StorageBackedRuntime extends NetworkRuntime {
  private storage?: NetworkStorage
  private networkId: NetworkId
  private contentHashes = new Map<string, string>() // contactId -> hash
  private isDirty = false
  private saveTimer?: NodeJS.Timeout
  private ensuredGroups = new Set<string>() // Groups we've already ensured exist in storage
  private pendingOperations: Promise<any>[] = [] // Track all pending storage operations
  
  constructor(config: StorageConfig = {}) {
    super()
    this.storage = config.storage
    console.log(`[StorageBackedRuntime] Created with storage:`, this.storage ? 'YES' : 'NO')
    this.networkId = brand.networkId(config.networkId || 'default')
    
    if (config.loadOnInit && this.storage) {
      this.loadFromStorage()
    }
  }
  
  /**
   * Calculate SHA256 hash of content
   */
  private hashContent(content: any): string {
    const str = JSON.stringify(content)
    return createHash('sha256').update(str).digest('hex')
  }
  
  /**
   * Load initial state from storage
   */
  private async loadFromStorage() {
    if (!this.storage) return
    
    try {
      // Load network state
      const result = await this.storage.loadNetworkState(this.networkId)
      if (result.ok && result.value) {
        const networkState = result.value
        
        // Handle both Map and plain object/array formats
        let groups: Map<string, GroupState>
        if (networkState.groups instanceof Map) {
          groups = networkState.groups
        } else if (Array.isArray(networkState.groups)) {
          // Convert array format [[key, value], ...] to Map
          groups = new Map(networkState.groups)
        } else {
          // Assume it's a plain object
          groups = new Map(Object.entries(networkState.groups || {}))
        }
        
        // Load all groups
        for (const [groupId, groupState] of groups) {
          this.registerGroup(groupState.group)
          
          // Handle contacts - could be Map or array
          let contacts: Map<string, any>
          if (groupState.contacts instanceof Map) {
            contacts = groupState.contacts
          } else if (Array.isArray(groupState.contacts)) {
            contacts = new Map(groupState.contacts)
          } else {
            contacts = new Map(Object.entries(groupState.contacts || {}))
          }
          
          // Load contacts
          for (const [contactId, contact] of contacts) {
            this.addContact(groupState.group.id, contact)
            
            // Calculate and store hash
            if (contact.content !== null && contact.content !== undefined) {
              const hash = this.hashContent(contact.content)
              this.contentHashes.set(contactId, hash)
            }
          }
          
          // Handle wires - could be Map or array
          let wires: Map<string, any>
          if (groupState.wires instanceof Map) {
            wires = groupState.wires
          } else if (Array.isArray(groupState.wires)) {
            wires = new Map(groupState.wires)
          } else {
            wires = new Map(Object.entries(groupState.wires || {}))
          }
          
          // Load wires
          for (const [wireId, wire] of wires) {
            this.connect(wire.fromId, wire.toId, wire.type)
          }
        }
      }
    } catch (error) {
      console.error('[StorageBackedRuntime] CRITICAL: Failed to load from storage:', error)
      // Re-throw to crash loudly instead of silently continuing
      throw wrapError(error, 'STORAGE_LOAD_ERROR', { networkId: this.networkId })
    }
  }
  
  /**
   * Save current state to storage
   */
  private async saveToStorage() {
    if (!this.storage || !this.isDirty) return
    
    try {
      // Build network state
      const groups = new Map()
      
      for (const [groupId, group] of this.groups) {
        const contacts = new Map()
        const wires = new Map()
        
        // Collect contacts for this group
        for (const [contactId, contact] of this.contacts) {
          if (contact.groupId === groupId) {
            contacts.set(contactId, contact)
          }
        }
        
        // Collect wires for this group
        for (const [wireId, wire] of this.wires) {
          const fromContact = this.contacts.get(wire.fromId)
          const toContact = this.contacts.get(wire.toId)
          if (fromContact?.groupId === groupId || toContact?.groupId === groupId) {
            wires.set(wireId, wire)
          }
        }
        
        groups.set(groupId, {
          group,
          contacts,
          wires
        })
      }
      
      const networkState = {
        groups,
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      await this.storage.saveNetworkState(this.networkId, networkState)
      this.isDirty = false
    } catch (error) {
      console.error('[StorageBackedRuntime] CRITICAL: Failed to save to storage:', error)
      // Re-throw to crash loudly
      throw wrapError(error, 'STORAGE_SAVE_ERROR', { networkId: this.networkId })
    }
  }
  
  /**
   * Schedule a deferred save
   */
  private scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    
    this.saveTimer = setTimeout(() => {
      this.saveToStorage()
    }, 100) // Save after 100ms of inactivity
  }
  
  /**
   * Override scheduleUpdate to add hashing and storage
   */
  scheduleUpdate(contactId: string, content: any) {
    // Check if contact exists, if not create it in root group
    let contact = this.contacts.get(contactId)
    if (!contact) {
      // Create the contact in root group
      // console.log(`[Runtime] Creating new contact ${contactId} with content`)
      this.addContact('root', {
        id: contactId,
        content: content,
        blendMode: 'accept-last'
      })
    } else {
      // Update existing contact
      super.scheduleUpdate(contactId, content)
    }
    
    // Calculate and store hash
    const hash = this.hashContent(content)
    this.contentHashes.set(contactId, hash)
    
    // Mark as dirty and schedule save
    this.isDirty = true
    this.scheduleSave()
    
    // Also save individual contact immediately if storage supports it
    console.log(`[StorageBackedRuntime] Checking storage for contact ${contactId}:`, 
      'storage:', !!this.storage,
      'saveContactContent:', !!(this.storage && this.storage.saveContactContent))
    if (this.storage && this.storage.saveContactContent) {
      const contact = this.contacts.get(contactId)
      console.log(`[StorageBackedRuntime] Contact ${contactId} found:`, !!contact, contact?.groupId)
      if (contact) {
        const groupId = brand.groupId(contact.groupId)
        
        // Ensure group exists before saving contact (PostgreSQL foreign key requirement)
        const savePromise = this.ensureGroupExists(contact.groupId).then(async () => {
          console.log(`[StorageBackedRuntime] Group ${contact.groupId} ensured, now saving contact ${contactId}`)
          if (this.storage && this.storage.saveContactContent) {
            console.log(`[StorageBackedRuntime] Calling saveContactContent for ${contactId}`)
            const result = await this.storage.saveContactContent(
              this.networkId,
              groupId,
              brand.contactId(contactId),
              content
            )
            
            // Check if the save actually succeeded
            if (!result.ok) {
              throw new StorageError(
                `Failed to save contact ${contactId}: ${result.error.message}`,
                'SAVE_CONTACT',
                { contactId, groupId, networkId: this.networkId, error: result.error }
              )
            }
            
            return result
          }
        }).catch(err => {
          console.error(`[StorageBackedRuntime] CRITICAL ERROR saving contact ${contactId}:`, err)
          console.error('Stack trace:', err.stack)
          // Re-throw wrapped error to ensure it crashes loudly
          throw wrapError(err, 'STORAGE_SAVE_ERROR', { contactId, groupId })
        })
        
        // Track this pending operation
        this.pendingOperations.push(savePromise)
      }
    }
  }
  
  /**
   * Wait for all pending storage operations to complete
   */
  async waitForPendingOperations(): Promise<void> {
    if (this.pendingOperations.length > 0) {
      console.log(`[StorageBackedRuntime] Waiting for ${this.pendingOperations.length} pending operations...`)
      try {
        const results = await Promise.allSettled(this.pendingOperations)
        
        // Check for any failures
        const failures = results.filter(r => r.status === 'rejected')
        if (failures.length > 0) {
          console.error(`[StorageBackedRuntime] ${failures.length} operations failed:`)
          failures.forEach((f, i) => {
            if (f.status === 'rejected') {
              console.error(`  Operation ${i}: ${f.reason}`)
            }
          })
          
          // Throw the first error to crash loudly
          const firstFailure = failures[0] as PromiseRejectedResult
          throw new StorageError(
            `${failures.length} storage operations failed`,
            'PENDING_OPERATIONS_FAILED',
            { failureCount: failures.length, firstError: firstFailure.reason }
          )
        }
        
        this.pendingOperations = [] // Clear after all complete
        console.log(`[StorageBackedRuntime] All ${results.length} operations completed successfully`)
      } catch (error) {
        console.error(`[StorageBackedRuntime] CRITICAL: Error waiting for pending operations:`, error)
        throw wrapError(error, 'WAIT_OPERATIONS_ERROR', { count: this.pendingOperations.length })
      }
    }
  }
  
  /**
   * Ensure both network and group exist in storage before saving contacts to them
   */
  private async ensureGroupExists(groupId: string): Promise<void> {
    console.log(`[StorageBackedRuntime] ensureGroupExists ${groupId}:`,
      'storage:', !!this.storage,
      'saveGroupState:', !!(this.storage && this.storage.saveGroupState),
      'alreadyEnsured:', this.ensuredGroups.has(groupId))
    if (!this.storage || !this.storage.saveGroupState || this.ensuredGroups.has(groupId)) {
      console.log(`[StorageBackedRuntime] ensureGroupExists returning early for ${groupId}`)
      return // Already ensured or no storage
    }
    
    console.log(`[StorageBackedRuntime] Actually ensuring group ${groupId} exists...`)
    
    const group = this.groups.get(groupId)
    if (!group) {
      console.warn(`[StorageBackedRuntime] Group ${groupId} not found in runtime`)
      return
    }
    
    try {
      console.log(`[StorageBackedRuntime] Saving network state for ${this.networkId}`)
      // First ensure network record exists (required for foreign key)
      if (this.storage.saveNetworkState) {
        const networkResult = await this.storage.saveNetworkState(this.networkId, {
          networkId: this.networkId,
          groups: new Map(),
          wires: new Map(),
          currentGroupId: 'root',
          rootGroupId: 'root'
        } as any)
        console.log(`[StorageBackedRuntime] Network save result:`, networkResult.ok)
        if (!networkResult.ok) {
          throw new StorageError(
            `Failed to save network ${this.networkId}: ${networkResult.error.message}`,
            'SAVE_NETWORK',
            { networkId: this.networkId, error: networkResult.error }
          )
        }
      }
      
      console.log(`[StorageBackedRuntime] Now saving group state for ${groupId}`)
      // Then create the group
      const groupState = {
        group,
        contacts: new Map(), // Will be filled by individual contact saves
        wires: new Map()
      }
      
      const result = await this.storage.saveGroupState(
        this.networkId,
        brand.groupId(groupId),
        groupState as any
      )
      
      console.log(`[StorageBackedRuntime] saveGroupState result for ${groupId}:`, result.ok)
      
      if (result.ok) {
        this.ensuredGroups.add(groupId)
        console.log(`[StorageBackedRuntime] Successfully ensured group ${groupId} exists in storage`)
      } else {
        // Throw error instead of just logging
        throw new StorageError(
          `Failed to ensure group ${groupId}: ${result.error.message}`,
          'ENSURE_GROUP',
          { groupId, networkId: this.networkId, error: result.error }
        )
      }
    } catch (error) {
      console.error(`[StorageBackedRuntime] CRITICAL: Error ensuring group ${groupId}:`, error)
      console.error('Stack trace:', (error as any).stack)
      // Re-throw to crash loudly
      throw wrapError(error, 'GROUP_ENSURE_ERROR', { groupId, networkId: this.networkId })
    }
  }
  
  /**
   * Get content hash for a contact
   */
  getContentHash(contactId: string): string | undefined {
    return this.contentHashes.get(contactId)
  }
  
  /**
   * Get all content hashes
   */
  getAllHashes(): Map<string, string> {
    return new Map(this.contentHashes)
  }
  
  /**
   * Get contact content
   */
  async getContactContent(contactId: string): Promise<any> {
    const contact = this.contacts.get(contactId)
    if (contact) {
      // console.log(`[Runtime] Found contact ${contactId} in memory with content:`, contact.content)
      return contact.content
    }
    
    // console.log(`[Runtime] Contact ${contactId} not in memory`)
    
    // Try loading from storage if not in memory
    // Check root group since that's where we create contacts
    if (this.storage && this.storage.loadContactContent) {
      const result = await this.storage.loadContactContent(
        this.networkId,
        brand.groupId('root'),
        brand.contactId(contactId)
      )
      if (result.ok && result.value !== null) {
        // console.log(`[Runtime] Found contact ${contactId} in storage`)
        return result.value
      }
    }
    
    // console.log(`[Runtime] Contact ${contactId} not found anywhere`)
    return null
  }
  
  /**
   * Clean up
   */
  async terminate() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    
    // Final save
    await this.saveToStorage()
    
    // Close storage if it has a close method
    if (this.storage && 'close' in this.storage) {
      await (this.storage as any).close()
    }
  }
}