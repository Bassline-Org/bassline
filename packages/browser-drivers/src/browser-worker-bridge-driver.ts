/**
 * Browser Worker Bridge Driver
 * 
 * Enables communication between main thread and Web Worker
 * where a kernel instance is running
 */

import { AbstractBridgeDriver, type ContactChange, type ExternalInput, type DriverCommand, type CommandResponse, DriverError } from '@bassline/core'

export interface BrowserWorkerBridgeConfig {
  worker: Worker
  id?: string
}

export interface WorkerMessage {
  type: 'change' | 'input' | 'ready' | 'error' | 'response' | 'init' | 'shutdown' | 'health' | 'command' | 'operation'
  data?: any
  requestId?: string
  error?: string
}

/**
 * Bridge driver for browser environments
 * Connects UI in main thread to kernel running in Web Worker
 */
export class BrowserWorkerBridgeDriver extends AbstractBridgeDriver {
  private worker: Worker
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void
    reject: (error: any) => void
  }>()
  private requestCounter = 0
  
  constructor(config: BrowserWorkerBridgeConfig) {
    super({
      id: config.id || 'browser-worker-bridge',
      name: 'browser-worker-bridge',
      version: '1.0.0'
    })
    
    this.worker = config.worker
    this.setupMessageHandler()
  }
  
  private setupMessageHandler(): void {
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      
      switch (message.type) {
        case 'change':
          // Forward changes from kernel to UI
          this.emit('change', message.data)
          break
          
        case 'response':
          // Handle responses to requests
          if (message.requestId) {
            const pending = this.pendingRequests.get(message.requestId)
            if (pending) {
              this.pendingRequests.delete(message.requestId)
              if (message.error) {
                pending.reject(new Error(message.error))
              } else {
                pending.resolve(message.data)
              }
            }
          }
          break
          
        case 'ready':
          // Worker kernel is ready
          this.emit('ready')
          break
          
        case 'error':
          // Worker reported an error
          console.error('[BrowserWorkerBridge] Worker error:', message.error)
          this.emit('error', new Error(message.error || 'Unknown worker error'))
          break
      }
    }
    
    this.worker.onerror = (error) => {
      console.error('[BrowserWorkerBridge] Worker error:', error)
      this.emit('error', error)
    }
  }
  
  // ============================================================================
  // AbstractBridgeDriver Implementation
  // ============================================================================
  
  protected async onStartListening(): Promise<void> {
    // Worker is already listening via onmessage
  }
  
  protected async onStopListening(): Promise<void> {
    // Terminate the worker
    this.worker.terminate()
  }
  
  protected async onHandleChange(change: ContactChange): Promise<void> {
    // Send changes from kernel to main thread
    this.worker.postMessage({
      type: 'change',
      data: change
    } as WorkerMessage)
  }
  
  protected async onInitialize(): Promise<void> {
    // Send init message to worker
    this.worker.postMessage({
      type: 'init'
    } as WorkerMessage)
  }
  
  protected async onShutdown(force: boolean): Promise<void> {
    if (force) {
      this.worker.terminate()
    } else {
      // Graceful shutdown
      this.worker.postMessage({
        type: 'shutdown'
      } as WorkerMessage)
      
      // Give it time to shut down
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  protected async onHealthCheck(): Promise<boolean> {
    // Check if worker is responsive
    const requestId = `health-${++this.requestCounter}`
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        resolve(false)
      }, 1000)
      
      this.pendingRequests.set(requestId, {
        resolve: (healthy: boolean) => {
          clearTimeout(timeout)
          resolve(healthy)
        },
        reject: () => {
          clearTimeout(timeout)
          resolve(false)
        }
      })
      
      this.worker.postMessage({
        type: 'health',
        requestId
      } as WorkerMessage)
    })
  }
  
  protected async onHandleCommand(command: DriverCommand): Promise<CommandResponse> {
    // Pass through commands to worker
    const requestId = `cmd-${++this.requestCounter}`
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: (response: CommandResponse) => resolve(response),
        reject: (error: any) => reject(error)
      })
      
      this.worker.postMessage({
        type: 'command',
        data: command,
        requestId
      } as WorkerMessage)
    })
  }
  
  // ============================================================================
  // Public Methods for UI
  // ============================================================================
  
  /**
   * Send an operation from UI to kernel in worker
   */
  async sendOperation(input: ExternalInput): Promise<any> {
    const requestId = `op-${++this.requestCounter}`
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve,
        reject
      })
      
      this.worker.postMessage({
        type: 'operation',
        data: input,
        requestId
      } as WorkerMessage)
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error('Operation timeout'))
        }
      }, 5000)
    })
  }
  
  /**
   * Subscribe to a group for changes
   */
  async subscribe(groupId: string): Promise<void> {
    // For local mode, we get all changes anyway
    // This is mainly for compatibility with remote mode
    this.emit('subscribed', { groupId })
  }
  
  /**
   * Unsubscribe from a group
   */
  async unsubscribe(groupId: string): Promise<void> {
    this.emit('unsubscribed', { groupId })
  }
}