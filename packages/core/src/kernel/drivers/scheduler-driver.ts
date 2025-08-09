/**
 * SchedulerDriver - Manages propagation scheduling strategies
 * 
 * Schedulers control how and when propagation tasks are executed.
 * Different schedulers provide different performance and ordering characteristics.
 */

import type { Driver, DriverResponse, DriverStats } from '../driver'
import type { PropagationTask } from '../../types'
import type { ContactChange, DriverCommand, CommandResponse } from '../types'

export interface Scheduler {
  id: string
  name: string
  
  // Core scheduling operations
  schedule(task: PropagationTask): void
  flush(): Promise<void>
  clear(): void
  
  // Optional configuration
  configure?(options: any): void
  
  // Characteristics for UI/selection
  characteristics: {
    deterministic: boolean     // Same order every time?
    batching: boolean         // Groups updates?
    priority: boolean         // Supports task priorities?
    async: boolean           // Async execution?
    fairness: 'strict' | 'best-effort' | 'none'
  }
}

export interface SchedulerInfo {
  id: string
  name: string
  characteristics: Scheduler['characteristics']
  description?: string
}

export class SchedulerDriver implements Driver {
  readonly id = 'scheduler-driver'
  readonly name = 'Scheduler'
  readonly version = '1.0.0'
  
  // Registry of available scheduler factories
  private schedulers = new Map<string, () => Scheduler>()
  
  // Currently active scheduler
  private currentScheduler?: Scheduler
  private currentSchedulerId?: string
  
  // Info cache for UI
  private infoCache = new Map<string, SchedulerInfo>()
  
  /**
   * Register a scheduler factory
   */
  registerScheduler(id: string, factory: () => Scheduler): void {
    // Create an instance to get info
    const instance = factory()
    
    // Validate scheduler
    if (!this.isValidScheduler(instance)) {
      throw new Error(`Invalid scheduler: ${id}`)
    }
    
    // Register factory
    this.schedulers.set(id, factory)
    
    // Cache info
    this.infoCache.set(id, {
      id: instance.id,
      name: instance.name,
      characteristics: instance.characteristics,
      description: (instance as any).description
    })
    
    console.log(`[SchedulerDriver] Registered scheduler: ${id}`)
  }
  
  /**
   * Activate a scheduler with optional configuration
   */
  activateScheduler(id: string, config?: any): void {
    const factory = this.schedulers.get(id)
    
    if (!factory) {
      throw new Error(`Unknown scheduler: ${id}. Available: ${this.listSchedulers().join(', ')}`)
    }
    
    // Clean up current scheduler
    if (this.currentScheduler) {
      this.currentScheduler.clear()
    }
    
    // Create and configure new scheduler
    const scheduler = factory()
    
    if (scheduler.configure && config) {
      scheduler.configure(config)
    }
    
    this.currentScheduler = scheduler
    this.currentSchedulerId = id
    
    console.log(`[SchedulerDriver] Activated scheduler: ${id}`, config || '')
  }
  
  /**
   * Get the current active scheduler
   */
  getCurrentScheduler(): Scheduler {
    if (!this.currentScheduler) {
      // Create default immediate scheduler if none active
      this.createDefaultScheduler()
    }
    
    return this.currentScheduler!
  }
  
  /**
   * Get the ID of the current scheduler
   */
  getCurrentSchedulerId(): string | undefined {
    return this.currentSchedulerId
  }
  
  /**
   * List all available scheduler IDs
   */
  listSchedulers(): string[] {
    return Array.from(this.schedulers.keys()).sort()
  }
  
  /**
   * Get info about a scheduler
   */
  getSchedulerInfo(id: string): SchedulerInfo | undefined {
    return this.infoCache.get(id)
  }
  
  /**
   * List all scheduler info (for UI)
   */
  listSchedulerInfo(): SchedulerInfo[] {
    return Array.from(this.infoCache.values())
  }
  
  /**
   * Schedule a task using the current scheduler
   */
  schedule(task: PropagationTask): void {
    this.getCurrentScheduler().schedule(task)
  }
  
  /**
   * Flush the current scheduler
   */
  async flush(): Promise<void> {
    await this.getCurrentScheduler().flush()
  }
  
  /**
   * Clear the current scheduler
   */
  clear(): void {
    this.getCurrentScheduler().clear()
  }
  
  /**
   * Create a default immediate scheduler
   */
  private createDefaultScheduler(): void {
    const immediate: Scheduler = {
      id: 'default-immediate',
      name: 'Default Immediate',
      characteristics: {
        deterministic: true,
        batching: false,
        priority: false,
        async: false,
        fairness: 'strict'
      },
      schedule(task: PropagationTask): void {
        // Execute immediately - would connect to runtime
        console.log(`[Scheduler] Would execute task for contact: ${task.contactId}`)
      },
      flush: async () => { /* no-op for immediate */ },
      clear: () => { /* no-op for immediate */ }
    }
    
    this.currentScheduler = immediate
    this.currentSchedulerId = 'default-immediate'
  }
  
  /**
   * Validate scheduler interface
   */
  private isValidScheduler(obj: any): obj is Scheduler {
    return obj &&
           typeof obj === 'object' &&
           typeof obj.id === 'string' &&
           typeof obj.name === 'string' &&
           typeof obj.schedule === 'function' &&
           typeof obj.flush === 'function' &&
           typeof obj.clear === 'function' &&
           typeof obj.characteristics === 'object'
  }
  
  // Driver interface implementation
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    // Scheduler driver doesn't handle changes directly
    return { status: 'success' }
  }
  
  async handleCommand(command: DriverCommand): Promise<CommandResponse> {
    switch (command.type) {
      case 'initialize':
        await this.initialize()
        return { status: 'success' }
      case 'shutdown':
        await this.shutdown()
        return { status: 'success' }
      default:
        return { status: 'success' }
    }
  }
  
  async isHealthy(): Promise<boolean> {
    return this.currentScheduler !== undefined
  }
  
  async getStats(): Promise<DriverStats> {
    return {
      processed: 0,
      failed: 0,
      pending: 0,
      uptime: Date.now(),
      custom: {
        currentScheduler: this.currentSchedulerId,
        availableSchedulers: this.listSchedulers()
      }
    }
  }
  
  async initialize(): Promise<void> {
    // Create default scheduler
    this.createDefaultScheduler()
    console.log('[SchedulerDriver] Initialized with default scheduler')
  }
  
  async shutdown(): Promise<void> {
    if (this.currentScheduler) {
      this.currentScheduler.clear()
    }
    this.schedulers.clear()
    this.infoCache.clear()
    console.log('[SchedulerDriver] Shut down')
  }
}