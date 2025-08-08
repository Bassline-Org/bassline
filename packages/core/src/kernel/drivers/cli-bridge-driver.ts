/**
 * CLI Bridge Driver for Kernel
 * Receives commands from CLI and sends them as external input to the kernel
 */

import type {
  ContactChange,
  DriverResponse,
  DriverCommand,
  CommandResponse,
  ExternalInput,
} from '../types'
import { DriverError, CommandError } from '../types'
import type { BridgeDriver } from '../driver'
import type { ContactId, GroupId } from '../../types'
import { brand } from '../../types'
import { EventEmitter } from 'events'

export interface CLICommand {
  type: 'set-contact' | 'create-contact' | 'connect' | 'disconnect'
  contactId?: string
  groupId?: string
  value?: any
  fromId?: string
  toId?: string
}

export class CLIBridgeDriver extends EventEmitter implements BridgeDriver {
  readonly id: string
  readonly name: string = 'cli-bridge'
  readonly version: string = '1.0.0'
  
  private inputHandler?: (input: ExternalInput) => Promise<void>
  private isListening = false
  private commandQueue: CLICommand[] = []
  private processingTimer?: NodeJS.Timer
  
  constructor(options: { id?: string } = {}) {
    super()
    this.id = options.id || `cli-bridge-${Date.now()}`
  }
  
  /**
   * Register the kernel's input handler
   */
  setInputHandler(handler: (input: ExternalInput) => Promise<void>): void {
    this.inputHandler = handler
  }
  
  /**
   * Start listening for CLI commands
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      return
    }
    
    this.isListening = true
    
    // Start processing queued commands
    this.processingTimer = setInterval(() => {
      this.processCommandQueue()
    }, 10)
  }
  
  /**
   * Stop listening for CLI commands
   */
  async stopListening(): Promise<void> {
    this.isListening = false
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = undefined
    }
  }
  
  /**
   * Handle a change from the kernel (we don't need to do anything with these)
   */
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    // Bridge drivers typically don't need to handle changes from userspace
    // They're primarily for external input INTO the system
    // But we could emit events here if we wanted to notify CLI of changes
    
    this.emit('contact-changed', {
      contactId: change.contactId,
      groupId: change.groupId,
      value: change.value
    })
    
    return { status: 'success' }
  }
  
  /**
   * Handle commands from the kernel
   */
  async handleCommand(command: DriverCommand): Promise<CommandResponse> {
    try {
      switch (command.type) {
        case 'initialize':
          // Nothing special to initialize for CLI bridge
          return { status: 'success' }
          
        case 'shutdown':
          await this.stopListening()
          this.commandQueue = []
          return { status: 'success' }
          
        case 'health-check':
          return { 
            status: 'success', 
            data: { 
              healthy: true,
              isListening: this.isListening,
              queueLength: this.commandQueue.length
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
    return this.isListening
  }
  
  /**
   * Public method for CLI to send commands
   * This is what the CLI calls to inject external input
   */
  async sendCommand(command: CLICommand): Promise<void> {
    if (!this.isListening) {
      throw new Error('CLI Bridge is not listening')
    }
    
    // Queue the command for processing
    this.commandQueue.push(command)
  }
  
  /**
   * Process queued commands and send them to the kernel
   */
  private async processCommandQueue(): Promise<void> {
    if (!this.inputHandler || this.commandQueue.length === 0) {
      return
    }
    
    // Process one command at a time
    const command = this.commandQueue.shift()
    if (!command) return
    
    try {
      switch (command.type) {
        case 'set-contact':
          if (!command.contactId || !command.groupId) {
            throw new Error('set-contact requires contactId and groupId')
          }
          
          const input: ExternalInput = {
            type: 'external-input',
            source: this.id,
            contactId: brand.contactId(command.contactId),
            groupId: brand.groupId(command.groupId),
            value: command.value,
            metadata: {
              timestamp: Date.now(),
              command: 'cli-set'
            }
          }
          
          await this.inputHandler(input)
          
          // Emit event for CLI feedback
          this.emit('command-processed', {
            command: command.type,
            contactId: command.contactId,
            success: true
          })
          break
          
        case 'create-contact':
          // For create, we might need to handle this differently
          // The runtime would need to support creating contacts via external input
          // For now, we'll skip this
          this.emit('command-error', {
            command: command.type,
            error: 'create-contact not yet implemented'
          })
          break
          
        case 'connect':
        case 'disconnect':
          // These would need special handling too
          this.emit('command-error', {
            command: command.type,
            error: `${command.type} not yet implemented`
          })
          break
      }
    } catch (error) {
      this.emit('command-error', {
        command: command.type,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  
  /**
   * Get statistics about the bridge
   */
  getStats() {
    return {
      isListening: this.isListening,
      queueLength: this.commandQueue.length,
      hasInputHandler: !!this.inputHandler
    }
  }
}