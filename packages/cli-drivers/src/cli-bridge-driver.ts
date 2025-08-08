/**
 * CLI Bridge Driver for Kernel
 * Receives commands from CLI and sends them as external input to the kernel
 */

import { AbstractBridgeDriver, type ContactChange, type ExternalInput, type DriverCommand, type CommandResponse, CommandError, type ContactId, type GroupId, brand } from '@bassline/core'

export interface CLICommand {
  type: 'set-contact' | 'create-contact' | 'connect' | 'disconnect'
  contactId?: string
  groupId?: string
  value?: any
  fromId?: string
  toId?: string
}

export interface CLIBridgeConfig {
  id?: string
  autoProcessCommands?: boolean
  processingInterval?: number
}

export class CLIBridgeDriver extends AbstractBridgeDriver {
  private commandQueue: CLICommand[] = []
  private processingTimer?: NodeJS.Timer
  
  constructor(options: { id?: string } = {}) {
    super({
      id: options.id,
      name: 'cli-bridge',
      version: '1.0.0'
    })
  }
  
  // ============================================================================
  // AbstractBridgeDriver Implementation
  // ============================================================================
  
  protected async onStartListening(): Promise<void> {
    // Start processing queued commands
    this.processingTimer = setInterval(() => {
      this.processCommandQueue()
    }, 10)
  }
  
  protected async onStopListening(): Promise<void> {
    if (this.processingTimer) {
      clearInterval(this.processingTimer as any)
      this.processingTimer = undefined
    }
  }
  
  protected async onHandleChange(change: ContactChange): Promise<void> {
    // CLI bridge doesn't need to do anything special with changes
    // The base class already emits the 'contact-changed' event
  }
  
  protected async onInitialize(): Promise<void> {
    // Nothing special to initialize for CLI bridge
  }
  
  protected async onShutdown(force: boolean): Promise<void> {
    // Clear the command queue on shutdown
    this.commandQueue = []
    this.updateQueueLength(0)
  }
  
  protected async onHealthCheck(): Promise<boolean> {
    // CLI bridge is healthy if the timer is running when listening
    if (this.isListening) {
      return !!this.processingTimer
    }
    return true
  }
  
  protected async onHandleCommand(command: DriverCommand): Promise<CommandResponse> {
    // CLI bridge doesn't have any custom commands
    throw new CommandError(
      `Unknown command: ${(command as any).type}`,
      { canContinue: true }
    )
  }
  
  // ============================================================================
  // CLI-Specific Public Methods
  // ============================================================================
  
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
    this.updateQueueLength(this.commandQueue.length)
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  /**
   * Process queued commands and send them to the kernel
   */
  private async processCommandQueue(): Promise<void> {
    if (this.commandQueue.length === 0) {
      return
    }
    
    // Process one command at a time
    const command = this.commandQueue.shift()
    if (!command) return
    
    this.updateQueueLength(this.commandQueue.length)
    
    try {
      switch (command.type) {
        case 'set-contact':
          if (!command.contactId || !command.groupId) {
            throw new Error('set-contact requires contactId and groupId')
          }
          
          const input: ExternalInput = {
            type: 'external-contact-update',
            source: this.id,
            contactId: brand.contactId(command.contactId),
            groupId: brand.groupId(command.groupId),
            value: command.value,
            metadata: {
              timestamp: Date.now(),
              command: 'cli-set'
            }
          }
          
          await this.sendInput(input)
          
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
}