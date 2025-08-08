/**
 * Abstract Base Class for Bridge Drivers
 * 
 * Provides common functionality for drivers that bridge external systems
 * with the kernel (CLI, WebSocket, WebRTC, etc.)
 */

import type {
  ContactChange,
  DriverResponse,
  DriverCommand,
  CommandResponse,
  ExternalInput,
} from './types'
import { DriverError, CommandError } from './types'
import type { BridgeDriver } from './driver'
import { EventEmitter } from 'events'

export interface BridgeConfig {
  id?: string
  name: string
  version: string
  autoStart?: boolean
}

export interface BridgeStats {
  isListening: boolean
  queueLength: number
  processed: number
  failed: number
  lastProcessed?: Date
  lastError?: string
}

/**
 * Abstract base class for bridge drivers
 * Handles common patterns like input handling, event emission, and queue management
 */
export abstract class AbstractBridgeDriver extends EventEmitter implements BridgeDriver {
  readonly id: string
  readonly name: string
  readonly version: string
  
  protected inputHandler?: (input: ExternalInput) => Promise<void>
  protected isListening = false
  protected stats: BridgeStats
  
  constructor(config: BridgeConfig) {
    super()
    this.id = config.id || `${config.name}-${Date.now()}`
    this.name = config.name
    this.version = config.version
    
    this.stats = {
      isListening: false,
      queueLength: 0,
      processed: 0,
      failed: 0
    }
    
    if (config.autoStart) {
      // Start listening after construction
      process.nextTick(() => this.startListening())
    }
  }
  
  // ============================================================================
  // BridgeDriver Interface Implementation
  // ============================================================================
  
  /**
   * Register the kernel's input handler
   */
  setInputHandler(handler: (input: ExternalInput) => Promise<void>): void {
    this.inputHandler = handler
    this.emit('handler-registered')
  }
  
  /**
   * Start listening for external input
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      return
    }
    
    try {
      await this.onStartListening()
      this.isListening = true
      this.stats.isListening = true
      this.emit('listening-started')
    } catch (error: any) {
      throw new DriverError(
        `Failed to start listening: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  /**
   * Stop listening for external input
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return
    }
    
    try {
      await this.onStopListening()
      this.isListening = false
      this.stats.isListening = false
      this.emit('listening-stopped')
    } catch (error: any) {
      throw new DriverError(
        `Failed to stop listening: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  /**
   * Handle a change from the kernel
   * Bridge drivers typically emit events for external systems
   */
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    try {
      // Let subclasses handle the change
      await this.onHandleChange(change)
      
      // Emit standard event
      this.emit('contact-changed', {
        contactId: change.contactId,
        groupId: change.groupId,
        value: change.value,
        metadata: change.metadata
      })
      
      return { 
        status: 'success',
        metadata: { bridgeId: this.id }
      }
    } catch (error: any) {
      if (error instanceof DriverError) {
        throw error
      }
      throw new DriverError(
        `Failed to handle change: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  /**
   * Handle commands from the kernel
   */
  async handleCommand(command: DriverCommand): Promise<CommandResponse> {
    try {
      switch (command.type) {
        case 'initialize':
          await this.onInitialize()
          return { status: 'success' }
          
        case 'shutdown':
          await this.stopListening()
          await this.onShutdown(command.force ?? false)
          return { status: 'success' }
          
        case 'health-check':
          const healthy = await this.isHealthy()
          return { 
            status: 'success', 
            data: { 
              healthy,
              stats: this.getStats()
            } 
          }
          
        default:
          // Let subclasses handle custom commands
          return await this.onHandleCommand(command)
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
  
  /**
   * Check if driver is healthy
   */
  async isHealthy(): Promise<boolean> {
    // Base implementation checks if we're listening and have a handler
    const baseHealthy = this.isListening && !!this.inputHandler
    
    // Let subclasses add additional health checks
    const customHealthy = await this.onHealthCheck()
    
    return baseHealthy && customHealthy
  }
  
  /**
   * Get driver statistics
   */
  getStats(): BridgeStats {
    return { ...this.stats }
  }
  
  // ============================================================================
  // Protected Helper Methods
  // ============================================================================
  
  /**
   * Send external input to the kernel
   * Subclasses should call this when they receive external input
   */
  protected async sendInput(input: ExternalInput): Promise<void> {
    if (!this.inputHandler) {
      throw new Error('No input handler registered')
    }
    
    if (!this.isListening) {
      throw new Error('Bridge is not listening')
    }
    
    try {
      await this.inputHandler(input)
      this.stats.processed++
      this.stats.lastProcessed = new Date()
      
      this.emit('input-processed', {
        type: input.type,
        source: input.source,
        success: true
      })
    } catch (error: any) {
      this.stats.failed++
      this.stats.lastError = error.message
      
      this.emit('input-error', {
        type: input.type,
        source: input.source,
        error: error.message
      })
      
      throw error
    }
  }
  
  /**
   * Update queue length statistic
   * Subclasses should call this when their queue changes
   */
  protected updateQueueLength(length: number): void {
    this.stats.queueLength = length
  }
  
  // ============================================================================
  // Abstract Methods - Subclasses Must Implement
  // ============================================================================
  
  /**
   * Called when bridge should start listening
   * Subclasses should set up their external connections here
   */
  protected abstract onStartListening(): Promise<void>
  
  /**
   * Called when bridge should stop listening
   * Subclasses should clean up their external connections here
   */
  protected abstract onStopListening(): Promise<void>
  
  /**
   * Called when bridge receives a change from the kernel
   * Subclasses can override to handle changes in their own way
   */
  protected abstract onHandleChange(change: ContactChange): Promise<void>
  
  /**
   * Called during initialization
   * Subclasses can set up any required resources
   */
  protected abstract onInitialize(): Promise<void>
  
  /**
   * Called during shutdown
   * Subclasses should clean up all resources
   */
  protected abstract onShutdown(force: boolean): Promise<void>
  
  /**
   * Custom health check
   * Subclasses can implement additional health checks
   */
  protected abstract onHealthCheck(): Promise<boolean>
  
  /**
   * Handle custom commands
   * Subclasses can handle driver-specific commands
   */
  protected abstract onHandleCommand(command: DriverCommand): Promise<CommandResponse>
}

/**
 * Type guard for bridge drivers
 */
export function isBridgeDriver(driver: any): driver is BridgeDriver {
  return (
    typeof driver === 'object' &&
    driver !== null &&
    typeof driver.setInputHandler === 'function' &&
    typeof driver.startListening === 'function' &&
    typeof driver.stopListening === 'function'
  )
}