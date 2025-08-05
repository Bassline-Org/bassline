import { EventEmitter } from 'events'
import { NetworkRuntime, GroupState } from './NetworkRuntime.js'

export interface NetworkChange {
  type: string
  data: any
}

export class StandaloneNetwork extends EventEmitter {
  private runtime: NetworkRuntime
  private subscriptionHandlers: ((changes: NetworkChange[]) => void)[] = []
  private changeInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.runtime = new NetworkRuntime()
  }

  async initialize(scheduler: 'immediate' | 'batch' = 'immediate') {
    // Subscribe to runtime changes
    this.runtime.on('change', (change) => {
      this.emit('change', change)
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

  async terminate() {
    if (this.changeInterval) {
      clearInterval(this.changeInterval)
      this.changeInterval = null
    }
  }
}