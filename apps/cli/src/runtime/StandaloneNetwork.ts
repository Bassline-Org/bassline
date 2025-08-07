import { EventEmitter } from 'events'
import { NetworkRuntime, GroupState } from './NetworkRuntime.js'
import { StorageBackedRuntime } from './StorageBackedRuntime.js'
import type { NetworkStorage } from '@bassline/core'
import { brand } from '@bassline/core'

export interface NetworkChange {
  type: string
  data: any
}

export interface StandaloneNetworkOptions {
  storage?: NetworkStorage
  storageType?: 'memory' | 'postgres' | 'filesystem'
  storageOptions?: any
}

export class StandaloneNetwork extends EventEmitter {
  private runtime: StorageBackedRuntime
  private subscriptionHandlers: ((changes: NetworkChange[]) => void)[] = []
  private changeInterval: NodeJS.Timeout | null = null
  private storage?: NetworkStorage

  constructor(options: StandaloneNetworkOptions = {}) {
    super()
    // Use StorageBackedRuntime if storage is provided
    this.runtime = new StorageBackedRuntime({
      storage: options.storage,
      loadOnInit: true
    })
    this.storage = options.storage
  }

  async initialize(scheduler: 'immediate' | 'batch' = 'immediate') {
    // Initialize storage if provided
    if (this.storage && this.storage.initialize) {
      await this.storage.initialize()
    }
    
    // Subscribe to runtime changes
    this.runtime.on('change', (change) => {
      this.emit('change', change)
      
      // Persist changes to storage if available
      if (this.storage) {
        this.persistChange(change)
      }
    })
    
    // Poll for batched changes
    this.changeInterval = setInterval(() => {
      const changes = this.runtime.getChanges()
      if (changes.length > 0) {
        this.subscriptionHandlers.forEach(handler => handler(changes))
        this.emit('changes', changes)
      }
    }, 100)
    
    return Promise.resolve()
  }
  
  private async persistChange(change: NetworkChange) {
    if (!this.storage) return
    
    try {
      // Persist different types of changes to storage
      switch (change.type) {
        case 'contact-updated':
          if (this.storage.saveContactContent) {
            await this.storage.saveContactContent(
              'default-network', // We'll need to track network IDs
              change.data.groupId,
              change.data.contactId,
              change.data.content
            )
          }
          break
        // Add more cases as needed
      }
    } catch (error) {
      console.error('Failed to persist change:', error)
    }
  }

  async registerGroup(group: any) {
    this.runtime.registerGroup(group)
    return Promise.resolve()
  }

  async addContact(groupId: string, contact: any) {
    const contactId = this.runtime.addContact(groupId, contact)
    return Promise.resolve(contactId)
  }

  async connect(fromId: string, toId: string, type: 'bidirectional' | 'directed' = 'bidirectional') {
    const wireId = this.runtime.connect(fromId, toId, type)
    return Promise.resolve(wireId)
  }

  async scheduleUpdate(contactId: string, content: any) {
    this.runtime.scheduleUpdate(contactId, content)
    return Promise.resolve()
  }

  async getState(groupId: string = 'root'): Promise<GroupState> {
    return Promise.resolve(this.runtime.getState(groupId))
  }

  async exportState(groupId: string = 'root') {
    return Promise.resolve(this.runtime.exportState(groupId))
  }

  async importState(state: any) {
    this.runtime.importState(state)
    return Promise.resolve()
  }

  subscribe(handler: (changes: NetworkChange[]) => void) {
    this.subscriptionHandlers.push(handler)
    return () => {
      const index = this.subscriptionHandlers.indexOf(handler)
      if (index >= 0) {
        this.subscriptionHandlers.splice(index, 1)
      }
    }
  }

  async listGroups() {
    return Promise.resolve(this.runtime.listGroups())
  }

  async createGroup(name: string, parentId?: string, primitiveId?: string) {
    const groupId = this.runtime.createGroup(name, parentId, primitiveId)
    return Promise.resolve(groupId)
  }

  async deleteGroup(groupId: string) {
    this.runtime.deleteGroup(groupId)
    return Promise.resolve()
  }

  async deleteContact(contactId: string) {
    this.runtime.deleteContact(contactId)
    return Promise.resolve()
  }

  async deleteWire(wireId: string) {
    this.runtime.deleteWire(wireId)
    return Promise.resolve()
  }

  async listPrimitives() {
    return Promise.resolve(this.runtime.listPrimitives())
  }

  async terminate() {
    if (this.changeInterval) {
      clearInterval(this.changeInterval)
      this.changeInterval = null
    }
  }
}