/**
 * WebSocket Bridge Driver for Kernel
 * 
 * Provides bidirectional WebSocket communication for real-time collaboration
 * Includes auto-reconnection, message queuing, and room support
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
import type { ContactId, GroupId } from '../../types'

export interface WebSocketBridgeConfig {
  url: string
  room?: string
  reconnect?: boolean
  reconnectDelay?: number
  maxReconnectDelay?: number
  reconnectDecay?: number
  heartbeatInterval?: number
  queueSize?: number
  protocols?: string | string[]
  headers?: Record<string, string>
  id?: string
}

export interface WebSocketMessage {
  type: 'change' | 'input' | 'sync' | 'heartbeat' | 'room-joined' | 'room-left' | 'error'
  room?: string
  data?: any
  timestamp?: number
  source?: string
}

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSING = 'closing',
  CLOSED = 'closed'
}

export class WebSocketBridgeDriver extends AbstractBridgeDriver {
  private ws?: WebSocket
  private config: Required<WebSocketBridgeConfig>
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED
  private messageQueue: WebSocketMessage[] = []
  private reconnectTimer?: NodeJS.Timeout
  private heartbeatTimer?: NodeJS.Timeout
  private reconnectAttempts = 0
  private lastHeartbeatReceived?: Date
  private room?: string
  
  constructor(config: WebSocketBridgeConfig) {
    super({
      id: config.id,
      name: 'websocket-bridge',
      version: '1.0.0'
    })
    
    this.config = {
      url: config.url,
      room: config.room,
      reconnect: config.reconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      reconnectDecay: config.reconnectDecay ?? 1.5,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      queueSize: config.queueSize ?? 1000,
      protocols: config.protocols,
      headers: config.headers ?? {},
      id: config.id
    }
    
    this.room = config.room
  }
  
  // ============================================================================
  // AbstractBridgeDriver Implementation
  // ============================================================================
  
  protected async onStartListening(): Promise<void> {
    await this.connect()
  }
  
  protected async onStopListening(): Promise<void> {
    this.connectionState = ConnectionState.CLOSING
    this.stopHeartbeat()
    this.cancelReconnect()
    
    if (this.ws) {
      // Send leave room message if in a room
      if (this.room && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'room-left',
          room: this.room,
          source: this.id
        }))
      }
      
      // Wait for close to complete
      await new Promise<void>((resolve) => {
        if (!this.ws) {
          resolve()
          return
        }
        
        const onClose = () => {
          this.ws = undefined
          this.connectionState = ConnectionState.CLOSED
          resolve()
        }
        
        // Set up close handler
        const existingHandler = this.ws.onclose
        this.ws.onclose = (event) => {
          if (existingHandler) {
            existingHandler.call(this.ws, event)
          }
          onClose()
        }
        
        // Initiate close
        this.ws.close(1000, 'Bridge stopping')
        
        // Timeout fallback
        setTimeout(() => {
          this.ws = undefined
          this.connectionState = ConnectionState.CLOSED
          resolve()
        }, 1000)
      })
    } else {
      this.connectionState = ConnectionState.CLOSED
    }
  }
  
  protected async onHandleChange(change: ContactChange): Promise<void> {
    // Send change through WebSocket
    const message: WebSocketMessage = {
      type: 'change',
      room: this.room,
      data: change,
      timestamp: Date.now(),
      source: this.id
    }
    
    await this.sendMessage(message)
  }
  
  protected async onInitialize(): Promise<void> {
    // Nothing special to initialize
  }
  
  protected async onShutdown(force: boolean): Promise<void> {
    if (force) {
      // Force close without waiting
      this.messageQueue = []
      if (this.ws) {
        this.ws.close(1001, 'Forced shutdown')
      }
    } else {
      // Try to flush queue before closing
      await this.flushQueue()
    }
  }
  
  protected async onHealthCheck(): Promise<boolean> {
    // Check if connected and heartbeat is recent
    if (this.connectionState !== ConnectionState.CONNECTED) {
      return false
    }
    
    if (this.config.heartbeatInterval > 0 && this.lastHeartbeatReceived) {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatReceived.getTime()
      if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
        // Haven't received heartbeat in 2x the interval
        return false
      }
    }
    
    return true
  }
  
  protected async onHandleCommand(command: DriverCommand): Promise<CommandResponse> {
    switch ((command as any).type) {
      case 'join-room':
        await this.joinRoom((command as any).room)
        return { status: 'success' }
        
      case 'leave-room':
        await this.leaveRoom()
        return { status: 'success' }
        
      case 'get-connection-state':
        return { 
          status: 'success', 
          data: { 
            state: this.connectionState,
            room: this.room,
            queueLength: this.messageQueue.length
          } 
        }
        
      default:
        return { status: 'error', error: `Unknown command: ${(command as any).type}` }
    }
  }
  
  // ============================================================================
  // WebSocket Management
  // ============================================================================
  
  private async connect(): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTED ||
        this.connectionState === ConnectionState.CONNECTING) {
      return
    }
    
    this.connectionState = ConnectionState.CONNECTING
    
    try {
      // Create WebSocket connection
      // Note: In Node.js environment, we'd need to import 'ws' package
      // For browser environment, WebSocket is global
      const isNode = typeof window === 'undefined'
      
      if (isNode) {
        // Node.js environment - use ws package
        const WebSocketImpl = await import('ws').then(m => m.default)
        this.ws = new WebSocketImpl(this.config.url, {
          protocols: this.config.protocols,
          headers: this.config.headers
        }) as any
      } else {
        // Browser environment
        this.ws = new WebSocket(this.config.url, this.config.protocols)
      }
      
      this.setupEventHandlers()
    } catch (error: any) {
      this.connectionState = ConnectionState.DISCONNECTED
      throw new DriverError(
        `Failed to create WebSocket connection: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  private setupEventHandlers(): void {
    if (!this.ws) return
    
    this.ws.onopen = () => {
      this.connectionState = ConnectionState.CONNECTED
      this.reconnectAttempts = 0
      
      this.emit('connected', { url: this.config.url })
      
      // Join room if configured
      if (this.room) {
        this.ws!.send(JSON.stringify({
          type: 'room-joined',
          room: this.room,
          source: this.id
        }))
      }
      
      // Start heartbeat
      this.startHeartbeat()
      
      // Flush queued messages
      this.flushQueue()
    }
    
    this.ws.onmessage = async (event) => {
      try {
        // Handle both string and Buffer data
        const data = typeof event.data === 'string' 
          ? event.data 
          : event.data.toString()
        const message: WebSocketMessage = JSON.parse(data)
        await this.handleMessage(message)
      } catch (error) {
        // Only emit parse errors if there are listeners
        if (this.listenerCount('error') > 0) {
          this.emit('error', { error: 'Failed to parse message', data: event.data })
        }
      }
    }
    
    this.ws.onerror = (error) => {
      // Only emit errors if there are listeners
      if (this.listenerCount('error') > 0) {
        this.emit('error', { error: 'WebSocket error', details: error })
      }
    }
    
    this.ws.onclose = (event) => {
      this.connectionState = ConnectionState.DISCONNECTED
      this.stopHeartbeat()
      
      this.emit('disconnected', { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean
      })
      
      // Attempt reconnection if configured and not explicitly closed
      if (this.config.reconnect && 
          this.connectionState !== ConnectionState.CLOSING &&
          this.connectionState !== ConnectionState.CLOSED &&
          !event.wasClean) {
        this.scheduleReconnect()
      }
    }
  }
  
  private async handleMessage(message: WebSocketMessage): Promise<void> {
    // Update stats
    this.stats.processed++
    this.stats.lastProcessed = new Date()
    
    switch (message.type) {
      case 'heartbeat':
        this.lastHeartbeatReceived = new Date()
        // Send heartbeat response
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now(),
            source: this.id
          }))
        }
        break
        
      case 'input':
        // Convert to ExternalInput and send to kernel
        if (message.data && this.inputHandler) {
          const input: ExternalInput = {
            type: 'external-input',
            source: message.source || 'websocket',
            contactId: brand.contactId(message.data.contactId),
            groupId: brand.groupId(message.data.groupId),
            value: message.data.value,
            metadata: {
              timestamp: message.timestamp || Date.now(),
              room: message.room
            }
          }
          await this.sendInput(input)
        }
        break
        
      case 'change':
        // Emit change event for external handling
        this.emit('remote-change', message.data)
        break
        
      case 'sync':
        // Full state sync
        this.emit('sync-received', message.data)
        break
        
      case 'room-joined':
        this.emit('peer-joined', { room: message.room, source: message.source })
        break
        
      case 'room-left':
        this.emit('peer-left', { room: message.room, source: message.source })
        break
        
      case 'error':
        this.emit('remote-error', message.data)
        this.stats.failed++
        this.stats.lastError = message.data?.message || 'Remote error'
        break
    }
  }
  
  // ============================================================================
  // Message Sending
  // ============================================================================
  
  private async sendMessage(message: WebSocketMessage): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message))
      } catch (error: any) {
        // Queue message if send fails
        this.queueMessage(message)
        throw new DriverError(
          `Failed to send WebSocket message: ${error.message}`,
          { fatal: false, originalError: error }
        )
      }
    } else {
      // Queue message for later delivery
      this.queueMessage(message)
    }
  }
  
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.config.queueSize) {
      // Drop oldest message if queue is full
      this.messageQueue.shift()
      this.emit('queue-overflow', { dropped: 1 })
    }
    
    this.messageQueue.push(message)
    this.updateQueueLength(this.messageQueue.length)
  }
  
  private async flushQueue(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }
    
    const queue = [...this.messageQueue]
    this.messageQueue = []
    this.updateQueueLength(0)
    
    for (const message of queue) {
      try {
        this.ws.send(JSON.stringify(message))
      } catch (error) {
        // Re-queue failed messages
        this.queueMessage(message)
        break
      }
    }
  }
  
  // ============================================================================
  // Heartbeat Management
  // ============================================================================
  
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) return
    
    this.stopHeartbeat()
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now(),
          source: this.id
        }))
      }
    }, this.config.heartbeatInterval)
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }
  
  // ============================================================================
  // Reconnection Logic
  // ============================================================================
  
  private scheduleReconnect(): void {
    if (this.connectionState === ConnectionState.RECONNECTING) return
    
    this.connectionState = ConnectionState.RECONNECTING
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
      this.config.maxReconnectDelay
    )
    
    this.reconnectAttempts++
    
    this.emit('reconnecting', { 
      attempt: this.reconnectAttempts, 
      delay,
      nextAttempt: new Date(Date.now() + delay)
    })
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.emit('reconnect-failed', { 
          attempt: this.reconnectAttempts,
          error: error.message 
        })
        // Will trigger another reconnect attempt via onclose handler
      })
    }, delay)
  }
  
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    this.reconnectAttempts = 0
  }
  
  // ============================================================================
  // Room Management
  // ============================================================================
  
  async joinRoom(room: string): Promise<void> {
    this.room = room
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'room-joined',
        room,
        source: this.id
      }))
    }
  }
  
  async leaveRoom(): Promise<void> {
    if (this.room && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'room-left',
        room: this.room,
        source: this.id
      }))
    }
    
    this.room = undefined
  }
  
  // ============================================================================
  // Public API
  // ============================================================================
  
  getConnectionState(): ConnectionState {
    return this.connectionState
  }
  
  getCurrentRoom(): string | undefined {
    return this.room
  }
  
  getQueueLength(): number {
    return this.messageQueue.length
  }
  
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED
  }
}