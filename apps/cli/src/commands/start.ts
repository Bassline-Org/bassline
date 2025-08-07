import chalk from 'chalk'
import ora from 'ora'
import http from 'http'
import https from 'https'
import fs from 'fs'
import os from 'os'
import { WebSocketServer } from 'ws'
import { StandaloneNetwork } from '../runtime/StandaloneNetwork.js'
import type { NetworkStorage } from '@bassline/core'

export async function startServer(options: { 
  port: string; 
  host?: string; 
  name: string; 
  ssl?: boolean; 
  cert?: string; 
  key?: string;
  storage?: 'memory' | 'postgres' | 'filesystem';
  storageOptions?: any;
}) {
  const spinner = ora('Starting propagation network server...').start()
  
  try {
    // Initialize storage based on configuration
    let storage: NetworkStorage | undefined
    
    if (options.storage === 'postgres') {
      spinner.text = 'Connecting to PostgreSQL...'
      const { createAppendOnlyStorage } = await import('@bassline/storage-postgres')
      storage = createAppendOnlyStorage(options.storageOptions || 'development') as unknown as NetworkStorage
    } else if (options.storage === 'filesystem') {
      spinner.text = 'Initializing filesystem storage...'
      const { createFilesystemStorage } = await import('@bassline/storage-filesystem')
      storage = createFilesystemStorage(options.storageOptions) as unknown as NetworkStorage
    } else if (options.storage === 'memory') {
      spinner.text = 'Using in-memory storage...'
      const { createMemoryStorage } = await import('@bassline/storage-memory')
      storage = createMemoryStorage() as unknown as NetworkStorage
    }
    
    // Create standalone network with storage
    const network = new StandaloneNetwork({ storage })
    await network.initialize('immediate')
    
    // Create root group
    await network.registerGroup({
      id: 'root',
      name: 'Root Group',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Create HTTP server for network API
    const server = http.createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }
      
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', async () => {
        try {
          const url = new URL(req.url!, `http://localhost:${options.port}`)
          
          // Simple routing
          if (url.pathname === '/state' && req.method === 'GET') {
            const groupId = url.searchParams.get('groupId') || 'root'
            const state = await network.getState(groupId)
            // Convert Maps to objects for JSON serialization
            const serializedState = {
              group: state.group,
              contacts: Object.fromEntries(state.contacts),
              wires: Object.fromEntries(state.wires)
            }
            res.writeHead(200)
            res.end(JSON.stringify(serializedState))
            
          } else if (url.pathname === '/groups' && req.method === 'GET') {
            const groups = await network.listGroups()
            res.writeHead(200)
            res.end(JSON.stringify(groups))
            
          } else if (url.pathname === '/groups' && req.method === 'POST') {
            const { name, parentId, primitiveId } = JSON.parse(body)
            const groupId = await network.createGroup(name, parentId, primitiveId)
            res.writeHead(200)
            res.end(JSON.stringify({ groupId }))
            
          } else if (url.pathname.match(/^\/groups\/[^\/]+$/) && req.method === 'DELETE') {
            const groupId = url.pathname.split('/')[2]
            await network.deleteGroup(groupId)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
            
          } else if (url.pathname === '/primitives' && req.method === 'GET') {
            const primitives = await network.listPrimitives()
            res.writeHead(200)
            res.end(JSON.stringify(primitives))
            
          } else if (url.pathname === '/contact' && req.method === 'POST') {
            const { groupId, contact } = JSON.parse(body)
            const contactId = await network.addContact(groupId, contact)
            res.writeHead(200)
            res.end(JSON.stringify({ contactId }))
            
          } else if (url.pathname.match(/^\/contact\/[^\/]+$/) && req.method === 'DELETE') {
            const contactId = url.pathname.split('/')[2]
            await network.deleteContact(contactId)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
            
          } else if (url.pathname === '/connect' && req.method === 'POST') {
            const { fromId, toId, type } = JSON.parse(body)
            const wireId = await network.connect(fromId, toId, type)
            res.writeHead(200)
            res.end(JSON.stringify({ wireId }))
            
          } else if (url.pathname.match(/^\/wire\/[^\/]+$/) && req.method === 'DELETE') {
            const wireId = url.pathname.split('/')[2]
            await network.deleteWire(wireId)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
            
          } else if (url.pathname === '/update' && req.method === 'POST') {
            const { contactId, content } = JSON.parse(body)
            await network.scheduleUpdate(contactId, content)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
            
          } else {
            res.writeHead(404)
            res.end(JSON.stringify({ error: 'Not found' }))
          }
        } catch (error: any) {
          res.writeHead(500)
          res.end(JSON.stringify({ error: error.message }))
        }
      })
    })
    
    // Create WebSocket server
    const wss = new WebSocketServer({ server })
    
    // Track WebSocket clients and their subscriptions
    const wsClients = new Map<any, Set<string>>() // ws -> Set of subscribed groupIds
    
    wss.on('connection', (ws) => {
      console.log(chalk.blue('WebSocket client connected'))
      wsClients.set(ws, new Set())
      
      ws.on('message', async (data) => {
        console.log(chalk.gray('[WebSocket] Received message:', data.toString()))
        try {
          const message = JSON.parse(data.toString())
          
          // Handle request/response pattern
          if (message.requestId) {
            console.log(chalk.cyan(`[WebSocket] Request ${message.requestId}: ${message.type}`))
            try {
              let responseData: any
              
              switch (message.type) {
                case 'get-state':
                  const state = await network.getState(message.groupId || 'root')
                  responseData = {
                    group: state.group,
                    contacts: Object.fromEntries(state.contacts),
                    wires: Object.fromEntries(state.wires)
                  }
                  break
                  
                case 'add-contact':
                  const contactId = await network.addContact(message.groupId, message.contact)
                  responseData = { contactId }
                  break
                  
                case 'update-contact':
                  await network.scheduleUpdate(message.contactId, message.content)
                  responseData = { success: true }
                  break
                  
                case 'remove-contact':
                  await network.deleteContact(message.contactId)
                  responseData = { success: true }
                  break
                  
                case 'add-wire':
                  const wireId = await network.connect(message.fromId, message.toId, message.wireType)
                  responseData = { wireId }
                  break
                  
                case 'remove-wire':
                  await network.deleteWire(message.wireId)
                  responseData = { success: true }
                  break
                  
                case 'add-group':
                  const groupId = await network.createGroup(message.name, message.parentId, message.primitiveId)
                  responseData = { groupId }
                  break
                  
                case 'remove-group':
                  await network.deleteGroup(message.groupId)
                  responseData = { success: true }
                  break
                  
                case 'list-groups':
                  responseData = await network.listGroups()
                  break
                  
                case 'list-primitives':
                  responseData = await network.listPrimitives()
                  break
                  
                default:
                  throw new Error(`Unknown request type: ${message.type}`)
              }
              
              ws.send(JSON.stringify({
                requestId: message.requestId,
                data: responseData
              }))
            } catch (error: any) {
              ws.send(JSON.stringify({
                requestId: message.requestId,
                error: error.message
              }))
            }
            return
          }
          
          // Handle subscription messages
          switch (message.type) {
            case 'subscribe':
              // Subscribe to a specific group
              const groupId = message.groupId || 'root'
              console.log(chalk.green(`[WebSocket] Client subscribing to group: ${groupId}`))
              const subscriptions = wsClients.get(ws)!
              subscriptions.add(groupId);
              
              // Send initial state for subscribed group
              (async () => {
                try {
                  const state = await network.getState(groupId)
                  const serializedState = {
                    group: state.group,
                    contacts: Object.fromEntries(state.contacts),
                    wires: Object.fromEntries(state.wires)
                  }
                  console.log(chalk.blue(`[WebSocket] Sending initial state for group: ${groupId}`))
                  ws.send(JSON.stringify({
                    type: 'state-update',
                    groupId,
                    state: serializedState
                  }))
                } catch (error: any) {
                  ws.send(JSON.stringify({
                    type: 'error',
                    error: error.message
                  }))
                }
              })()
              break
              
            case 'unsubscribe':
              const unsubGroupIds = message.groupIds || [message.groupId]
              const subs = wsClients.get(ws)!
              unsubGroupIds.forEach((id: string) => subs.delete(id))
              break
          }
        } catch (error) {
          console.error('WebSocket message error:', error)
        }
      })
      
      ws.on('close', () => {
        console.log(chalk.yellow('WebSocket client disconnected'))
        wsClients.delete(ws)
      })
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        wsClients.delete(ws)
      })
    })
    
    const host = options.host || '0.0.0.0'  // Default to all interfaces
    server.listen(parseInt(options.port), host, () => {
      spinner.succeed(chalk.green(`Network server running on ${host}:${options.port}`))
      console.log(chalk.blue(`\nNetwork: ${options.name}`))
      
      // Show connection URLs
      if (host === '0.0.0.0') {
        console.log(chalk.gray(`\nLocal connections:`))
        console.log(chalk.gray(`  HTTP: http://localhost:${options.port}`))
        console.log(chalk.gray(`  WebSocket: ws://localhost:${options.port}`))
        
        // Get local network IP
        const interfaces = os.networkInterfaces()
        const addresses: string[] = []
        for (const name of Object.keys(interfaces)) {
          for (const iface of interfaces[name]!) {
            if (iface.family === 'IPv4' && !iface.internal) {
              addresses.push(iface.address)
            }
          }
        }
        
        if (addresses.length > 0) {
          console.log(chalk.gray(`\nNetwork connections (for other devices):`))
          addresses.forEach(addr => {
            console.log(chalk.yellow(`  HTTP: http://${addr}:${options.port}`))
            console.log(chalk.yellow(`  WebSocket: ws://${addr}:${options.port}`))
          })
        }
      } else {
        console.log(chalk.gray(`HTTP API: http://${host}:${options.port}`))
        console.log(chalk.gray(`WebSocket: ws://${host}:${options.port}`))
      }
      console.log(chalk.gray('\nEndpoints:'))
      console.log(chalk.gray('  GET  /state?groupId=<id>    - Get group state'))
      console.log(chalk.gray('  GET  /groups               - List all groups'))
      console.log(chalk.gray('  POST /groups               - Create new group'))
      console.log(chalk.gray('  DELETE /groups/<id>        - Delete group'))
      console.log(chalk.gray('  GET  /primitives           - List available primitives'))
      console.log(chalk.gray('  POST /contact              - Add contact'))
      console.log(chalk.gray('  DELETE /contact/<id>       - Delete contact'))
      console.log(chalk.gray('  POST /connect              - Create wire'))
      console.log(chalk.gray('  DELETE /wire/<id>          - Delete wire'))
      console.log(chalk.gray('  POST /update               - Update contact'))
      console.log(chalk.gray('\nPress Ctrl+C to stop'))
    })
    
    // Subscribe to changes and broadcast to WebSocket clients
    network.subscribe((changes) => {
      changes.forEach(change => {
        console.log(chalk.yellow(`[Change] ${change.type}:`), change.data)
        
        // Broadcast to relevant WebSocket clients
        wsClients.forEach((subscribedGroups, ws) => {
          // Determine which groups are affected by this change
          let affectedGroupId: string | null = null
          
          switch (change.type) {
            case 'contact-added':
            case 'contact-updated':
            case 'contact-removed':
            case 'wire-added':
            case 'wire-removed':
              affectedGroupId = change.data.groupId
              break
            case 'group-added':
              affectedGroupId = change.data.group?.parentId || 'root'
              break
            case 'group-updated':
            case 'group-removed':
              affectedGroupId = change.data.groupId
              break
          }
          
          // If this client is subscribed to the affected group, send the change
          if (affectedGroupId && subscribedGroups.has(affectedGroupId)) {
            console.log(chalk.magenta(`[WebSocket] Broadcasting ${change.type} to client for group: ${affectedGroupId}`))
            ws.send(JSON.stringify({
              type: 'change',
              groupId: affectedGroupId,
              change
            }))
          } else if (affectedGroupId) {
            console.log(chalk.gray(`[WebSocket] Client not subscribed to group ${affectedGroupId}, skipping broadcast`))
          }
        })
      })
    })
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\nShutting down...'))
      server.close()
      await network.terminate()
      process.exit(0)
    })
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to start server'))
    console.error(error)
    process.exit(1)
  }
}