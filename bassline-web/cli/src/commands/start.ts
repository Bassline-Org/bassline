import chalk from 'chalk'
import ora from 'ora'
import http from 'http'
import { WebSocketServer } from 'ws'
import { StandaloneNetwork } from '../runtime/StandaloneNetwork.js'

export async function startServer(options: { port: string; name: string }) {
  const spinner = ora('Starting propagation network server...').start()
  
  try {
    // Create standalone network
    const network = new StandaloneNetwork()
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
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          
          switch (message.type) {
            case 'subscribe':
              // Subscribe to a specific group
              const groupIds = message.groupIds || [message.groupId || 'root']
              const subscriptions = wsClients.get(ws)!
              groupIds.forEach((id: string) => subscriptions.add(id))
              
              // Send initial state for subscribed groups
              groupIds.forEach(async (groupId: string) => {
                try {
                  const state = await network.getState(groupId)
                  const serializedState = {
                    group: state.group,
                    contacts: Object.fromEntries(state.contacts),
                    wires: Object.fromEntries(state.wires)
                  }
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
              })
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
    
    server.listen(parseInt(options.port), () => {
      spinner.succeed(chalk.green(`Network server running on port ${options.port}`))
      console.log(chalk.blue(`\nNetwork: ${options.name}`))
      console.log(chalk.gray(`HTTP API: http://localhost:${options.port}`))
      console.log(chalk.gray(`WebSocket: ws://localhost:${options.port}`))
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
            ws.send(JSON.stringify({
              type: 'change',
              groupId: affectedGroupId,
              change
            }))
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