/**
 * WebSocket Server Bridge Driver for Kernel
 * 
 * Creates a WebSocket server that clients can connect to
 * Handles multiple client connections and broadcasts changes
 */

import { AbstractBridgeDriver } from '../bridge-driver'
import type {
  ContactChange,
  ExternalInput,
  DriverCommand,
  CommandResponse,
} from '../types'
import { DriverError } from '../types'

export interface WebSocketServerBridgeConfig {
  port: number
  host?: string
  path?: string
  maxClients?: number
  heartbeatInterval?: number
  id?: string
}

export interface WebSocketMessage {
  type: 'change' | 'input' | 'sync' | 'heartbeat' | 'welcome' | 'error' | 'state'
  data?: any
  timestamp?: number
  source?: string
}

interface ClientConnection {
  id: string
  ws: any // WebSocket instance
  alive: boolean
  subscriptions: Set<string>
}

export class WebSocketServerBridgeDriver extends AbstractBridgeDriver {
  private wss?: any // WebSocketServer instance
  private clients: Map<string, ClientConnection> = new Map()
  private config: Required<WebSocketServerBridgeConfig>
  private heartbeatInterval?: NodeJS.Timeout
  private clientIdCounter = 0
  
  constructor(config: WebSocketServerBridgeConfig) {
    super({
      id: config.id || 'websocket-server-bridge',
      name: 'websocket-server-bridge',
      version: '1.0.0'
    })
    
    this.config = {
      port: config.port,
      host: config.host || '0.0.0.0',
      path: config.path || '/',
      maxClients: config.maxClients ?? 100,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      id: config.id || 'websocket-server-bridge'
    }
  }
  
  // ============================================================================
  // AbstractBridgeDriver Implementation
  // ============================================================================
  
  protected async onStartListening(): Promise<void> {
    await this.startServer()
  }
  
  protected async onStopListening(): Promise<void> {
    await this.stopServer()
  }
  
  protected async onHandleChange(change: ContactChange): Promise<void> {
    // Broadcast change to subscribed clients only
    const message: WebSocketMessage = {
      type: 'change',
      data: change,
      timestamp: Date.now(),
      source: this.id
    }
    
    // Only send to clients subscribed to the group
    this.broadcast(message, (client) => {
      // Send to clients subscribed to this specific group or to root
      return client.subscriptions.has(change.groupId) || client.subscriptions.has('root')
    })
    
    console.log(`[WebSocket] Broadcasting change to subscribed clients:`, {
      groupId: change.groupId,
      subscribedClients: Array.from(this.clients.values())
        .filter(c => c.subscriptions.has(change.groupId) || c.subscriptions.has('root'))
        .map(c => c.id)
    })
  }
  
  protected async onInitialize(): Promise<void> {
    // Nothing special to initialize
  }
  
  protected async onShutdown(force: boolean): Promise<void> {
    if (force) {
      // Force close all connections
      this.clients.forEach(client => {
        client.ws.close(1001, 'Server shutdown')
      })
      this.clients.clear()
    } else {
      // Graceful shutdown - send goodbye message
      this.broadcast({
        type: 'error',
        data: { message: 'Server shutting down' },
        timestamp: Date.now(),
        source: this.id
      })
      
      // Give clients time to disconnect
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    await this.stopServer()
  }
  
  protected async onHealthCheck(): Promise<boolean> {
    return this.wss !== undefined
  }
  
  protected async onHandleCommand(command: DriverCommand): Promise<CommandResponse> {
    switch ((command as any).type) {
      case 'get-clients':
        return { 
          status: 'success', 
          data: {
            count: this.clients.size,
            clients: Array.from(this.clients.keys())
          }
        }
        
      case 'kick-client':
        const clientId = (command as any).clientId
        const client = this.clients.get(clientId)
        if (client) {
          client.ws.close(1000, 'Kicked by server')
          this.clients.delete(clientId)
          return { status: 'success' }
        }
        throw new DriverError('Client not found', { fatal: false })
        
      default:
        throw new DriverError(
          `Unknown command: ${(command as any).type}`,
          { fatal: false }
        )
    }
  }
  
  // ============================================================================
  // WebSocket Server Management
  // ============================================================================
  
  private async startServer(): Promise<void> {
    // Import ws package (Node.js only)
    const WebSocketServer = await import('ws').then(m => m.WebSocketServer)
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
      path: this.config.path
    })
    
    // Handle new connections
    this.wss.on('connection', (ws: any, req: any) => {
      const clientId = `client-${++this.clientIdCounter}`
      const client: ClientConnection = {
        id: clientId,
        ws,
        alive: true,
        subscriptions: new Set()
      }
      
      // Check max clients
      if (this.clients.size >= this.config.maxClients) {
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Server full' }
        }))
        ws.close(1013, 'Server full')
        return
      }
      
      this.clients.set(clientId, client)
      
      console.log(`[WebSocket] Client connected: ${clientId}`)
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        data: {
          clientId,
          message: 'Connected to Bassline network'
        },
        timestamp: Date.now(),
        source: this.id
      }))
      
      // Handle pong for heartbeat
      ws.on('pong', () => {
        client.alive = true
      })
      
      // Handle messages from client
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          await this.handleClientMessage(clientId, message)
        } catch (error: any) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: error.message }
          }))
        }
      })
      
      // Handle client disconnect
      ws.on('close', () => {
        console.log(`[WebSocket] Client disconnected: ${clientId}`)
        this.clients.delete(clientId)
      })
      
      ws.on('error', (error: any) => {
        console.error(`WebSocket error for client ${clientId}:`, error)
      })
    })
    
    // Start heartbeat
    if (this.config.heartbeatInterval > 0) {
      this.startHeartbeat()
    }
  }
  
  private async stopServer(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }
    
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss.close(() => {
          this.wss = undefined
          resolve()
        })
      })
    }
  }
  
  private async handleClientMessage(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId)
    if (!client) return
    
    // Log all incoming messages
    console.log(`[${clientId}] Message:`, JSON.stringify(message, null, 2))
    
    // Handle message types and convert to ExternalInput
    switch (message.type) {
      case 'subscribe':
        if (message.groupId) {
          client.subscriptions.add(message.groupId)
          client.ws.send(JSON.stringify({
            type: 'subscribed',
            groupId: message.groupId
          }))
        }
        break
        
      case 'unsubscribe':
        if (message.groupId) {
          client.subscriptions.delete(message.groupId)
        }
        break
        
      case 'addContact':
        // Add a new contact
        if (message.groupId && message.content !== undefined) {
          const input: ExternalInput = {
            type: 'external-add-contact',
            source: this.id,
            groupId: message.groupId,
            contact: {
              content: message.content,
              blendMode: message.blendMode || 'accept-last'
            }
          }
          await this.sendInput(input)
          client.ws.send(JSON.stringify({
            type: 'creating',
            message: 'Contact creation requested'
          }))
        } else {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Missing groupId or content for addContact'
          }))
        }
        break
        
      case 'updateContact':
        // Update a contact's value
        if (message.contactId && message.groupId && message.value !== undefined) {
          const input: ExternalInput = {
            type: 'external-contact-update',
            source: this.id,
            contactId: message.contactId,
            groupId: message.groupId,
            value: message.value
          }
          await this.sendInput(input)
          client.ws.send(JSON.stringify({
            type: 'updated',
            contactId: message.contactId,
            value: message.value
          }))
        } else {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Missing contactId, groupId, or value for updateContact'
          }))
        }
        break
        
      case 'createGroup':
        // Create a new group
        if (message.name) {
          const input: ExternalInput = {
            type: 'external-add-group',
            source: this.id,
            parentGroupId: message.parentId || undefined,
            group: {
              name: message.name,
              primitiveId: message.primitiveId
            }
          }
          await this.sendInput(input)
          client.ws.send(JSON.stringify({
            type: 'creating',
            message: 'Group creation requested'
          }))
        } else {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Missing name for createGroup'
          }))
        }
        break
        
      case 'createWire':
        // Create a wire between contacts
        if (message.fromId && message.toId) {
          const input: ExternalInput = {
            type: 'external-create-wire',
            source: this.id,
            fromContactId: message.fromId,
            toContactId: message.toId
          }
          await this.sendInput(input)
          client.ws.send(JSON.stringify({
            type: 'creating',
            message: 'Wire creation requested'
          }))
        } else {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Missing fromId or toId for createWire'
          }))
        }
        break
        
      case 'queryContact':
        // Query a contact's value
        if (message.contactId) {
          const input: ExternalInput = {
            type: 'external-query-contact',
            source: this.id,
            contactId: message.contactId,
            requestId: message.requestId
          }
          await this.sendInput(input)
        } else {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Missing contactId for queryContact'
          }))
        }
        break
        
      case 'queryGroup':
        // Query a group's structure
        if (message.groupId) {
          const input: ExternalInput = {
            type: 'external-query-group',
            source: this.id,
            groupId: message.groupId,
            includeContacts: message.includeContacts,
            includeWires: message.includeWires,
            includeSubgroups: message.includeSubgroups,
            requestId: message.requestId
          }
          await this.sendInput(input)
        } else {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Missing groupId for queryGroup'
          }))
        }
        break
        
      case 'ping':
        client.ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        }))
        break
        
      case 'input':
        // Legacy format - convert to updateContact
        if (message.contactId && message.groupId) {
          const input: ExternalInput = {
            type: 'external-contact-update',
            source: this.id,
            contactId: message.contactId,
            groupId: message.groupId,
            value: message.value
          }
          await this.sendInput(input)
        }
        break
        
      default:
        // Echo unknown messages back for debugging
        client.ws.send(JSON.stringify({
          type: 'echo',
          original: message
        }))
        break
    }
  }
  
  private broadcast(message: WebSocketMessage, filter?: (client: ClientConnection) => boolean): void {
    const messageStr = JSON.stringify(message)
    
    this.clients.forEach(client => {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        if (!filter || filter(client)) {
          client.ws.send(messageStr)
        }
      }
    })
  }
  
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.alive) {
          // Client didn't respond to last ping
          client.ws.terminate()
          this.clients.delete(clientId)
        } else {
          client.alive = false
          client.ws.ping()
        }
      })
    }, this.config.heartbeatInterval)
  }
}