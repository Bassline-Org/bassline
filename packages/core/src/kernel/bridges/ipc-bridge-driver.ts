/**
 * IPC Bridge Driver for Kernel
 * 
 * Enables communication with external processes via stdin/stdout/stderr
 * Perfect for integrating with Unix commands and shell pipelines
 * Supports JSON, line-delimited, and binary protocols
 */

import { AbstractBridgeDriver } from '../bridge-driver'
import type {
  ContactChange,
  ExternalInput,
  DriverCommand,
  CommandResponse,
} from '../types'
import { DriverError } from '../types'
import { brand } from '../../types'
import { spawn, ChildProcess } from 'child_process'
import { Readable, Writable } from 'stream'
import * as readline from 'readline'

export interface IPCBridgeConfig {
  // Process configuration
  command?: string                    // Command to spawn (e.g., 'cat', 'jq', 'sed')
  args?: string[]                    // Arguments for the command
  shell?: boolean | string           // Use shell to execute command
  cwd?: string                       // Working directory
  env?: NodeJS.ProcessEnv            // Environment variables
  
  // Communication protocol
  protocol?: 'json' | 'line' | 'binary'  // How to parse input/output
  delimiter?: string                 // Line delimiter (default: '\n')
  encoding?: BufferEncoding          // Text encoding (default: 'utf8')
  
  // Process management
  respawn?: boolean                  // Restart process if it exits
  respawnDelay?: number             // Delay before respawning (ms)
  killTimeout?: number              // Timeout for graceful shutdown (ms)
  
  // Buffering
  maxBuffer?: number                // Max buffer size for stdout/stderr
  queueSize?: number                // Max messages to queue
  
  // Special modes
  stdin?: Readable                  // Use custom stdin stream
  stdout?: Writable                 // Use custom stdout stream
  stderr?: Writable                 // Use custom stderr stream
  
  // Identity
  id?: string
}

export interface IPCMessage {
  type: 'data' | 'error' | 'exit' | 'signal'
  data?: any
  error?: string
  code?: number
  signal?: string
  timestamp?: number
}

enum ProcessState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  CRASHED = 'crashed'
}

export class IPCBridgeDriver extends AbstractBridgeDriver {
  private config: Required<Omit<IPCBridgeConfig, 'stdin' | 'stdout' | 'stderr'>> & 
    Pick<IPCBridgeConfig, 'stdin' | 'stdout' | 'stderr'>
  private process?: ChildProcess
  private processState: ProcessState = ProcessState.STOPPED
  private messageQueue: any[] = []
  private respawnTimer?: NodeJS.Timeout
  private respawnCount = 0
  private lineReader?: readline.Interface
  private buffer = ''
  
  constructor(config: IPCBridgeConfig) {
    super({
      id: config.id || 'ipc-bridge',
      name: 'ipc-bridge',
      version: '1.0.0'
    })
    
    this.config = {
      command: config.command || 'cat',
      args: config.args || [],
      shell: config.shell ?? false,
      cwd: config.cwd || process.cwd(),
      env: config.env || process.env,
      protocol: config.protocol || 'json',
      delimiter: config.delimiter || '\n',
      encoding: config.encoding || 'utf8',
      respawn: config.respawn ?? false,
      respawnDelay: config.respawnDelay ?? 1000,
      killTimeout: config.killTimeout ?? 5000,
      maxBuffer: config.maxBuffer ?? 1024 * 1024, // 1MB
      queueSize: config.queueSize ?? 1000,
      stdin: config.stdin,
      stdout: config.stdout,
      stderr: config.stderr,
      id: config.id || 'ipc-bridge'
    }
  }
  
  // ============================================================================
  // AbstractBridgeDriver Implementation
  // ============================================================================
  
  protected async onStartListening(): Promise<void> {
    await this.startProcess()
  }
  
  protected async onStopListening(): Promise<void> {
    await this.stopProcess()
  }
  
  protected async onHandleChange(change: ContactChange): Promise<void> {
    // Send change to process via stdin
    const message = this.formatMessage(change)
    await this.sendToProcess(message)
  }
  
  protected async onInitialize(): Promise<void> {
    // Nothing special to initialize
  }
  
  protected async onShutdown(force: boolean): Promise<void> {
    if (force) {
      // Force kill the process
      if (this.process) {
        this.process.kill('SIGKILL')
      }
      this.messageQueue = []
    } else {
      // Try to flush queue and shutdown gracefully
      await this.flushQueue()
      await this.stopProcess()
    }
  }
  
  protected async onHealthCheck(): Promise<boolean> {
    return this.processState === ProcessState.RUNNING && 
           this.process !== undefined &&
           !this.process.killed
  }
  
  protected async onHandleCommand(command: DriverCommand): Promise<CommandResponse> {
    switch ((command as any).type) {
      case 'restart-process':
        await this.restartProcess()
        return { status: 'success' }
        
      case 'send-raw':
        await this.sendToProcess((command as any).data)
        return { status: 'success' }
        
      case 'get-process-info':
        return { 
          status: 'success', 
          data: {
            pid: this.process?.pid,
            state: this.processState,
            respawnCount: this.respawnCount,
            queueLength: this.messageQueue.length
          }
        }
        
      default:
        throw new DriverError(
          `Unknown command: ${(command as any).type}`,
          { fatal: false }
        )
    }
  }
  
  // ============================================================================
  // Process Management
  // ============================================================================
  
  private async startProcess(): Promise<void> {
    if (this.processState === ProcessState.RUNNING ||
        this.processState === ProcessState.STARTING) {
      return
    }
    
    this.processState = ProcessState.STARTING
    
    try {
      // If using custom streams, don't spawn a process
      if (this.config.stdin || this.config.stdout) {
        this.setupCustomStreams()
        this.processState = ProcessState.RUNNING
        this.emit('process-started', { custom: true })
        return
      }
      
      // Spawn the external process
      this.process = spawn(this.config.command, this.config.args, {
        shell: this.config.shell,
        cwd: this.config.cwd,
        env: this.config.env,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      this.setupProcessHandlers()
      this.processState = ProcessState.RUNNING
      
      this.emit('process-started', { 
        pid: this.process.pid,
        command: this.config.command,
        args: this.config.args
      })
      
      // Flush any queued messages
      await this.flushQueue()
    } catch (error: any) {
      this.processState = ProcessState.CRASHED
      throw new DriverError(
        `Failed to start process: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  private setupCustomStreams(): void {
    // Set up handlers for custom streams
    if (this.config.stdout) {
      // We write to the provided stdout
      // (no reading from it)
    }
    
    if (this.config.stdin) {
      // Read from the provided stdin
      if (this.config.protocol === 'line') {
        this.lineReader = readline.createInterface({
          input: this.config.stdin,
          crlfDelay: Infinity
        })
        
        this.lineReader.on('line', (line) => {
          this.handleProcessOutput(line)
        })
      } else {
        this.config.stdin.on('data', (chunk) => {
          this.handleProcessData(chunk)
        })
      }
    }
  }
  
  private setupProcessHandlers(): void {
    if (!this.process) return
    
    // Handle stdout based on protocol
    if (this.config.protocol === 'line') {
      // Line-delimited protocol
      this.lineReader = readline.createInterface({
        input: this.process.stdout!,
        crlfDelay: Infinity
      })
      
      this.lineReader.on('line', (line) => {
        this.handleProcessOutput(line)
      })
    } else if (this.config.protocol === 'binary') {
      // Binary protocol - handle raw chunks
      this.process.stdout!.on('data', (chunk) => {
        this.handleProcessData(chunk)
      })
    } else {
      // JSON protocol - buffer until we have complete JSON
      this.process.stdout!.on('data', (chunk) => {
        this.buffer += chunk.toString(this.config.encoding)
        this.tryParseBuffer()
      })
    }
    
    // Handle stderr
    this.process.stderr!.on('data', (chunk) => {
      const error = chunk.toString(this.config.encoding)
      if (this.listenerCount('error') > 0) {
        this.emit('error', { error: 'Process stderr', details: error })
      }
      this.stats.failed++
      this.stats.lastError = error
    })
    
    // Handle process exit
    this.process.on('exit', (code, signal) => {
      const wasStoppingIntentionally = this.processState === ProcessState.STOPPING
      this.processState = ProcessState.STOPPED
      
      this.emit('process-exited', { code, signal })
      
      // Clean up
      this.lineReader?.close()
      this.lineReader = undefined
      this.process = undefined
      
      // Respawn if configured and not stopping intentionally
      if (this.config.respawn && 
          !wasStoppingIntentionally &&
          code !== 0) {
        this.scheduleRespawn()
      }
    })
    
    // Handle process errors
    this.process.on('error', (error) => {
      this.processState = ProcessState.CRASHED
      if (this.listenerCount('error') > 0) {
        this.emit('error', { error: 'Process error', details: error })
      }
      this.stats.failed++
      this.stats.lastError = error.message
    })
  }
  
  private tryParseBuffer(): void {
    // Try to parse JSON from buffer
    const lines = this.buffer.split(this.config.delimiter)
    
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || ''
    
    // Process complete lines
    for (const line of lines) {
      if (line.trim()) {
        this.handleProcessOutput(line)
      }
    }
  }
  
  private handleProcessOutput(data: string): void {
    try {
      let parsed: any
      
      if (this.config.protocol === 'json') {
        parsed = JSON.parse(data)
      } else {
        parsed = data
      }
      
      // Check if this is a propagation network message
      if (typeof parsed === 'object' && parsed.contactId && parsed.value !== undefined) {
        // Only convert to external input if we have a handler
        if (this.inputHandler) {
          const input: ExternalInput = {
            type: 'external-input',
            source: 'ipc',
            contactId: brand.contactId(parsed.contactId),
            groupId: brand.groupId(parsed.groupId || 'default'),
            value: parsed.value,
            metadata: {
              timestamp: parsed.timestamp || Date.now(),
              command: this.config.command,
              pid: this.process?.pid
            }
          }
          
          this.sendInput(input)
        } else {
          // Just emit as regular data if no input handler
          this.emit('process-data', { data: parsed })
        }
      } else {
        // Emit as generic data
        this.emit('process-data', { data: parsed })
      }
      
      this.stats.processed++
      this.stats.lastProcessed = new Date()
    } catch (error) {
      // Failed to parse - emit raw data
      this.emit('process-data', { data, raw: true })
    }
  }
  
  private handleProcessData(chunk: Buffer): void {
    // Handle binary data
    this.emit('process-data', { data: chunk, binary: true })
    this.stats.processed++
    this.stats.lastProcessed = new Date()
  }
  
  private async stopProcess(): Promise<void> {
    if (this.processState === ProcessState.STOPPED ||
        this.processState === ProcessState.STOPPING) {
      return
    }
    
    this.processState = ProcessState.STOPPING
    this.cancelRespawn()
    
    if (this.lineReader) {
      this.lineReader.close()
      this.lineReader = undefined
    }
    
    if (this.process && !this.process.killed) {
      // Try graceful shutdown first
      this.process.kill('SIGTERM')
      
      // Wait for process to exit or timeout
      await new Promise<void>((resolve) => {
        let timeout: NodeJS.Timeout
        
        const cleanup = () => {
          clearTimeout(timeout)
          resolve()
        }
        
        // Set up exit handler
        if (this.process) {
          this.process.once('exit', cleanup)
        }
        
        // Set up timeout
        timeout = setTimeout(() => {
          // Force kill if still running
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
          }
          cleanup()
        }, this.config.killTimeout)
      })
    }
    
    this.process = undefined
    this.processState = ProcessState.STOPPED
  }
  
  private async restartProcess(): Promise<void> {
    await this.stopProcess()
    await this.startProcess()
  }
  
  // ============================================================================
  // Respawn Management
  // ============================================================================
  
  private scheduleRespawn(): void {
    if (this.respawnTimer) return
    
    this.respawnCount++
    
    this.emit('respawning', {
      count: this.respawnCount,
      delay: this.config.respawnDelay
    })
    
    this.respawnTimer = setTimeout(async () => {
      this.respawnTimer = undefined
      try {
        await this.startProcess()
      } catch (error) {
        // Failed to respawn - will retry if configured
        this.emit('respawn-failed', { error, count: this.respawnCount })
      }
    }, this.config.respawnDelay)
  }
  
  private cancelRespawn(): void {
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer)
      this.respawnTimer = undefined
    }
  }
  
  // ============================================================================
  // Message Sending
  // ============================================================================
  
  private formatMessage(change: ContactChange): string {
    if (this.config.protocol === 'json') {
      return JSON.stringify({
        contactId: change.contactId,
        groupId: change.groupId,
        value: change.value,
        timestamp: change.timestamp || Date.now()
      }) + this.config.delimiter
    } else if (this.config.protocol === 'line') {
      // Simple line format: contactId:value
      return `${change.contactId}:${JSON.stringify(change.value)}${this.config.delimiter}`
    } else {
      // Binary - just send the value
      return String(change.value)
    }
  }
  
  private async sendToProcess(data: string | Buffer): Promise<void> {
    // If using custom stdout, write to it
    if (this.config.stdout) {
      return new Promise((resolve, reject) => {
        this.config.stdout!.write(data, (error) => {
          if (error) {
            this.queueMessage(data)
            reject(new DriverError(
              `Failed to write to stdout: ${error.message}`,
              { fatal: false, originalError: error }
            ))
          } else {
            resolve()
          }
        })
      })
    }
    
    // Otherwise write to process stdin
    if (this.process && this.process.stdin && !this.process.killed) {
      return new Promise((resolve, reject) => {
        // Check if stdin is writable before attempting to write
        if (!this.process!.stdin!.writable) {
          this.queueMessage(data)
          resolve()
          return
        }
        
        try {
          const writeCallback = (error: any) => {
            if (error) {
              // EPIPE error means the process has closed stdin
              if (error.code === 'EPIPE') {
                this.queueMessage(data)
                resolve() // Don't reject, just queue
              } else {
                this.queueMessage(data)
                reject(new DriverError(
                  `Failed to write to process: ${error.message}`,
                  { fatal: false, originalError: error }
                ))
              }
            } else {
              resolve()
            }
          }
          
          // Add error handler for synchronous EPIPE errors
          const errorHandler = (error: any) => {
            if (error.code === 'EPIPE') {
              this.queueMessage(data)
              // Remove the error handler to prevent duplicate handling
              this.process!.stdin!.removeListener('error', errorHandler)
            }
          }
          
          this.process!.stdin!.once('error', errorHandler)
          const result = this.process!.stdin!.write(data, writeCallback)
          
          // If write returns false, the stream is not ready
          if (!result) {
            // Wait for drain event before resolving
            this.process!.stdin!.once('drain', () => {
              this.process!.stdin!.removeListener('error', errorHandler)
              resolve()
            })
          } else {
            // Write succeeded immediately
            this.process!.stdin!.removeListener('error', errorHandler)
          }
        } catch (error: any) {
          // Catch synchronous errors (like EPIPE)
          if (error.code === 'EPIPE') {
            this.queueMessage(data)
            resolve()
          } else {
            this.queueMessage(data)
            reject(new DriverError(
              `Failed to write to process: ${error.message}`,
              { fatal: false, originalError: error }
            ))
          }
        }
      })
    } else {
      // Queue for later
      this.queueMessage(data)
    }
  }
  
  private queueMessage(data: any): void {
    if (this.messageQueue.length >= this.config.queueSize) {
      // Drop oldest message
      this.messageQueue.shift()
      this.emit('queue-overflow', { dropped: 1 })
    }
    
    this.messageQueue.push(data)
    this.updateQueueLength(this.messageQueue.length)
  }
  
  private async flushQueue(): Promise<void> {
    if (!this.process || this.processState !== ProcessState.RUNNING) {
      return
    }
    
    const queue = [...this.messageQueue]
    this.messageQueue = []
    this.updateQueueLength(0)
    
    for (const message of queue) {
      try {
        await this.sendToProcess(message)
      } catch (error) {
        // Re-queue failed messages
        this.queueMessage(message)
        break
      }
    }
  }
  
  // ============================================================================
  // Public API
  // ============================================================================
  
  getProcessState(): ProcessState {
    return this.processState
  }
  
  getProcessInfo(): { pid?: number; state: ProcessState; respawnCount: number } {
    return {
      pid: this.process?.pid,
      state: this.processState,
      respawnCount: this.respawnCount
    }
  }
  
  getQueueLength(): number {
    return this.messageQueue.length
  }
  
  async sendRaw(data: string | Buffer): Promise<void> {
    await this.sendToProcess(data)
  }
}