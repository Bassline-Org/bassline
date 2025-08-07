/**
 * Storage-backed runtime for CLI
 * Extends NetworkRuntime with persistent storage and content hashing
 */

import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { NetworkRuntime, GroupState } from './NetworkRuntime.js'
import type { NetworkStorage, NetworkId, GroupId, ContactId, Result } from '@bassline/core'
import { brand } from '@bassline/core'

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
  
  constructor(config: StorageConfig = {}) {
    super()
    this.storage = config.storage
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
      console.error('Failed to load from storage:', error)
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
      console.error('Failed to save to storage:', error)
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
    if (this.storage && this.storage.saveContactContent) {
      const contact = this.contacts.get(contactId)
      if (contact) {
        const groupId = brand.groupId(contact.groupId)
        this.storage.saveContactContent(
          this.networkId,
          groupId,
          brand.contactId(contactId),
          content
        ).catch(err => console.error('Failed to save contact:', err))
      }
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