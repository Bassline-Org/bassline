import chalk from 'chalk'
import ora from 'ora'
import WebSocket from 'ws'

export async function connectToNetwork(url: string, options: { interactive: boolean }) {
  const spinner = ora('Connecting to network...').start()
  
  try {
    // Validate URL
    const parsedUrl = new URL(url)
    
    // Handle WebSocket connections
    if (parsedUrl.protocol === 'ws:' || parsedUrl.protocol === 'wss:') {
      await connectWebSocket(url, options, spinner)
    } else if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      await connectHTTP(url, options, spinner)
    } else {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`)
    }
    
  } catch (error: any) {
    spinner.fail(chalk.red('Connection failed'))
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error(chalk.red(`✗ Cannot connect to ${url}`))
      console.error(chalk.yellow('Is the server running? Try:'))
      console.error(chalk.white('  bassline start'))
    } else {
      console.error(chalk.red(`✗ ${error.message}`))
    }
    
    process.exit(1)
  }
}

async function connectWebSocket(url: string, options: { interactive: boolean }, spinner: any) {
  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url)
    let subscriptions = new Set<string>()
    
    ws.on('open', async () => {
      spinner.succeed(chalk.green(`Connected to ${url}`))
      
      if (options.interactive !== false) {
        console.log(chalk.cyan('\nInteractive mode - type "help" for commands'))
        console.log(chalk.white('Type "exit" to disconnect\n'))
        
        const readline = await import('readline')
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          prompt: chalk.cyan('> ')
        })
        
        // Handle incoming messages
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            
            // Log all messages from server
            console.log(chalk.cyan('\n[Server]'), JSON.stringify(message, null, 2))
            
            // Special handling for specific message types
            if (message.type === 'error' && message.message) {
              console.log(chalk.red('  ❌'), message.message)
            }
          } catch (e) {
            console.log(chalk.white('\n[Server]'), data.toString())
          }
          rl.prompt()
        })
        
        // Prompt and start listening
        rl.prompt()
        
        rl.on('line', async (line) => {
          const command = line.trim()
          if (!command) {
            rl.prompt()
            return
          }
          
          const [cmd, ...args] = command.split(' ')
          
          switch (cmd) {
            case 'exit':
            case 'quit':
              console.log(chalk.yellow('Disconnecting...'))
              ws.close()
              rl.close()
              process.exit(0)
              break
              
            case 'help':
            case '?':
              console.log(chalk.cyan('\n📚 Commands:'))
              console.log(chalk.white('  help                      - Show this help'))
              console.log(chalk.white('  subscribe <groupId>       - Subscribe to changes in a group'))
              console.log(chalk.white('  unsubscribe <groupId>     - Unsubscribe from a group'))
              console.log(chalk.white('  add <groupId> <content>   - Add a contact to a group'))
              console.log(chalk.white('  update <contactId> <groupId> <value> - Update a contact'))
              console.log(chalk.white('  wire <fromId> <toId>      - Create a wire between contacts'))
              console.log(chalk.white('  group <name> [parentId]   - Create a new group'))
              console.log(chalk.white('  get <contactId>           - Get a contact\'s value'))
              console.log(chalk.white('  state <groupId>           - Get group structure'))
              console.log(chalk.white('  list                      - List all subscribed groups'))
              console.log(chalk.white('  json <message>            - Send raw JSON message'))
              console.log(chalk.white('  ping                      - Ping the server'))
              console.log(chalk.white('  exit                      - Disconnect'))
              break
              
            case 'subscribe':
            case 'sub':
              if (args.length < 1) {
                console.error(chalk.red('Usage: subscribe <groupId>'))
              } else {
                const groupId = args[0]
                subscriptions.add(groupId)
                ws.send(JSON.stringify({
                  type: 'subscribe',
                  groupId
                }))
                console.log(chalk.green(`✓ Subscribing to ${groupId}...`))
              }
              break
              
            case 'unsubscribe':
            case 'unsub':
              if (args.length < 1) {
                console.error(chalk.red('Usage: unsubscribe <groupId>'))
              } else {
                const groupId = args[0]
                subscriptions.delete(groupId)
                ws.send(JSON.stringify({
                  type: 'unsubscribe',
                  groupId
                }))
                console.log(chalk.green(`✓ Unsubscribed from ${groupId}`))
              }
              break
              
            case 'add':
              if (args.length < 2) {
                console.error(chalk.red('Usage: add <groupId> <content>'))
              } else {
                const [groupId, ...contentParts] = args
                const content = contentParts.join(' ')
                
                // Try to parse as JSON, otherwise treat as string
                let parsedContent
                try {
                  parsedContent = JSON.parse(content)
                } catch {
                  parsedContent = content
                }
                
                ws.send(JSON.stringify({
                  type: 'addContact',
                  groupId,
                  content: parsedContent
                }))
                console.log(chalk.green('✓ Sent add contact request'))
              }
              break
              
            case 'update':
              if (args.length < 3) {
                console.error(chalk.red('Usage: update <contactId> <groupId> <value>'))
              } else {
                const [contactId, groupId, ...valueParts] = args
                const value = valueParts.join(' ')
                
                // Try to parse as JSON, otherwise treat as string
                let parsedValue
                try {
                  parsedValue = JSON.parse(value)
                } catch {
                  parsedValue = value
                }
                
                ws.send(JSON.stringify({
                  type: 'updateContact',
                  contactId,
                  groupId,
                  value: parsedValue
                }))
                console.log(chalk.green('✓ Sent update request'))
              }
              break
              
            case 'wire':
              if (args.length < 2) {
                console.error(chalk.red('Usage: wire <fromContactId> <toContactId>'))
              } else {
                const [fromId, toId] = args
                ws.send(JSON.stringify({
                  type: 'createWire',
                  fromId,
                  toId
                }))
                console.log(chalk.green('✓ Sent wire creation request'))
              }
              break
              
            case 'group':
              if (args.length < 1) {
                console.error(chalk.red('Usage: group <name> [parentId]'))
              } else {
                const [name, parentId = 'root'] = args
                ws.send(JSON.stringify({
                  type: 'createGroup',
                  name,
                  parentId
                }))
                console.log(chalk.green('✓ Sent group creation request'))
              }
              break
              
            case 'get':
              if (args.length < 1) {
                console.error(chalk.red('Usage: get <contactId>'))
              } else {
                const contactId = args[0]
                const requestId = `req-${Date.now()}`
                ws.send(JSON.stringify({
                  type: 'queryContact',
                  contactId,
                  requestId
                }))
                console.log(chalk.green('✓ Query sent'))
              }
              break
              
            case 'state':
              if (args.length < 1) {
                console.error(chalk.red('Usage: state <groupId>'))
              } else {
                const groupId = args[0]
                const requestId = `req-${Date.now()}`
                ws.send(JSON.stringify({
                  type: 'queryGroup',
                  groupId,
                  includeContacts: true,
                  includeWires: true,
                  includeSubgroups: true,
                  requestId
                }))
                console.log(chalk.green('✓ Query sent'))
              }
              break
              
            case 'list':
              if (subscriptions.size === 0) {
                console.log(chalk.yellow('No active subscriptions'))
              } else {
                console.log(chalk.cyan('Active subscriptions:'))
                subscriptions.forEach(groupId => {
                  console.log(chalk.white(`  - ${groupId}`))
                })
              }
              break
              
            case 'json':
              if (args.length < 1) {
                console.error(chalk.red('Usage: json <message>'))
              } else {
                try {
                  const message = JSON.parse(args.join(' '))
                  ws.send(JSON.stringify(message))
                  console.log(chalk.green('✓ Sent'))
                } catch (error) {
                  console.error(chalk.red('Invalid JSON'))
                }
              }
              break
              
            case 'ping':
              ws.send(JSON.stringify({ type: 'ping' }))
              console.log(chalk.green('✓ Ping sent'))
              break
              
            default:
              // Try to send as raw message
              ws.send(JSON.stringify({
                type: 'message',
                content: command
              }))
              console.log(chalk.green('✓ Sent as message'))
          }
          
          rl.prompt()
        })
        
        rl.on('close', () => {
          ws.close()
          process.exit(0)
        })
      } else {
        // Non-interactive mode - just stay connected
        console.log(chalk.white('Connected in non-interactive mode. Press Ctrl+C to disconnect.'))
      }
      
      resolve()
    })
    
    ws.on('error', (error) => {
      reject(error)
    })
    
    ws.on('close', () => {
      console.log(chalk.yellow('\nConnection closed'))
      process.exit(0)
    })
    
    // Set a timeout
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close()
        reject(new Error('Connection timeout'))
      }
    }, 5000)
  })
}

async function connectHTTP(url: string, options: { interactive: boolean }, spinner: any) {
  // Test connection by fetching root state
  spinner.text = 'Testing HTTP connection...'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000) // 5 second timeout
  
  let testResponse
  try {
    testResponse = await fetch(`${url}/state?groupId=root`, {
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    if (!testResponse.ok) {
      throw new Error(`Server responded with ${testResponse.status}: ${testResponse.statusText}`)
    }
  } catch (error: any) {
    clearTimeout(timeout)
    if (error.name === 'AbortError') {
      throw new Error('Connection timeout - server did not respond')
    }
    if (error.cause?.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to server at ${url} - is it running?`)
    }
    throw error
  }
  
  // Verify it's actually a Bassline server by checking response structure
  try {
    const state = await testResponse.json() as any
    if (!state.group || !state.contacts || !state.wires) {
      throw new Error('Server does not appear to be a Bassline network server')
    }
  } catch (error: any) {
    if (error.message.includes('JSON')) {
      throw new Error('Server response is not valid JSON - not a Bassline server')
    }
    throw error
  }
  
  spinner.succeed(chalk.green(`Connected to ${url}`))
  
  if (options.interactive !== false) {
    console.log(chalk.cyan('\nInteractive HTTP mode - type "help" for commands'))
    console.log(chalk.white('Type "exit" to disconnect\n'))
    
    const readline = await import('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('> ')
    })
    
    // Prompt and start listening
    rl.prompt()
    
    rl.on('line', async (line) => {
      const command = line.trim()
      if (!command) {
        rl.prompt()
        return
      }
      
      const [cmd, ...args] = command.split(' ')
      
      switch (cmd) {
        case 'help':
          console.log(chalk.white('Commands:'))
          console.log(chalk.white('  state [groupId]          - Show group state'))
          console.log(chalk.white('  groups                   - List all groups'))
          console.log(chalk.white('  primitives               - List available primitives'))
          console.log(chalk.white('  create-group <name> [parentId] [primitiveId] - Create new group'))
          console.log(chalk.white('  delete-group <id>        - Delete a group'))
          console.log(chalk.white('  add <groupId> <content>  - Add contact'))
          console.log(chalk.white('  delete-contact <id>      - Delete a contact'))
          console.log(chalk.white('  connect <from> <to>      - Connect contacts'))
          console.log(chalk.white('  delete-wire <id>         - Delete a wire'))
          console.log(chalk.white('  update <id> <content>    - Update contact'))
          console.log(chalk.white('  exit                     - Disconnect'))
          break
          
        case 'state':
          try {
            const groupId = args[0] || 'root'
            const response = await fetch(`${url}/state?groupId=${groupId}`)
            if (response.ok) {
              const state = await response.json()
              console.log(chalk.white(JSON.stringify(state, null, 2)))
            } else {
              console.error(chalk.red(`Failed: ${response.statusText}`))
            }
          } catch (error: any) {
            console.error(chalk.red(`Error: ${error.message}`))
          }
          break
          
        case 'add':
          if (args.length < 2) {
            console.error(chalk.red('Usage: add <groupId> <content>'))
          } else {
            try {
              const [groupId, ...contentParts] = args
              const content = contentParts.join(' ')
              const response = await fetch(`${url}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, content })
              })
              if (response.ok) {
                const result = await response.json() as any
                console.log(chalk.green(`✓ Created contact: ${result.id}`))
              } else {
                console.error(chalk.red(`Failed: ${response.statusText}`))
              }
            } catch (error: any) {
              console.error(chalk.red(`Error: ${error.message}`))
            }
          }
          break
          
        case 'update':
          if (args.length < 2) {
            console.error(chalk.red('Usage: update <contactId> <content>'))
          } else {
            try {
              const [contactId, ...contentParts] = args
              const content = contentParts.join(' ')
              const response = await fetch(`${url}/contacts/${contactId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
              })
              if (response.ok) {
                console.log(chalk.green('✓ Updated'))
              } else {
                console.error(chalk.red(`Failed: ${response.statusText}`))
              }
            } catch (error: any) {
              console.error(chalk.red(`Error: ${error.message}`))
            }
          }
          break
          
        case 'groups':
          try {
            const response = await fetch(`${url}/groups`)
            if (response.ok) {
              const groups = await response.json() as any[]
              console.log(chalk.cyan('Groups:'))
              for (const group of groups) {
                const indent = '  '.repeat((group.path?.split('/').length || 1) - 1)
                const type = group.primitiveId ? ` (${group.primitiveId})` : ''
                console.log(chalk.white(`${indent}${group.id}: ${group.name}${type}`))
                console.log(chalk.white(`${indent}  Contacts: ${group.contactCount}, Wires: ${group.wireCount}, Subgroups: ${group.subgroupCount}`))
              }
            } else {
              console.error(chalk.red(`Failed: ${response.statusText}`))
            }
          } catch (error: any) {
            console.error(chalk.red(`Error: ${error.message}`))
          }
          break
          
        case 'primitives':
          try {
            const response = await fetch(`${url}/primitives`)
            if (response.ok) {
              const primitives = await response.json() as any[]
              console.log(chalk.cyan('Available primitives:'))
              for (const prim of primitives) {
                console.log(chalk.white(`${prim.id}: ${prim.name} - ${prim.description}`))
                console.log(chalk.white(`  Inputs: ${prim.inputs.map((i: any) => i.name).join(', ')}`))
                console.log(chalk.white(`  Outputs: ${prim.outputs.map((o: any) => o.name).join(', ')}`))
              }
            } else {
              console.error(chalk.red(`Failed: ${response.statusText}`))
            }
          } catch (error: any) {
            console.error(chalk.red(`Error: ${error.message}`))
          }
          break
          
        case 'create-group':
          if (args.length < 1) {
            console.error(chalk.red('Usage: create-group <name> [parentId] [primitiveId]'))
          } else {
            try {
              const [name, parentId = 'root', primitiveId] = args
              const response = await fetch(`${url}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, parentId, primitiveId })
              })
              if (response.ok) {
                const result = await response.json() as any
                console.log(chalk.green(`✓ Created group: ${result.id}`))
              } else {
                console.error(chalk.red(`Failed: ${response.statusText}`))
              }
            } catch (error: any) {
              console.error(chalk.red(`Error: ${error.message}`))
            }
          }
          break
          
        case 'delete-group':
          if (args.length < 1) {
            console.error(chalk.red('Usage: delete-group <id>'))
          } else {
            try {
              const response = await fetch(`${url}/groups/${args[0]}`, {
                method: 'DELETE'
              })
              if (response.ok) {
                console.log(chalk.green('✓ Deleted'))
              } else {
                console.error(chalk.red(`Failed: ${response.statusText}`))
              }
            } catch (error: any) {
              console.error(chalk.red(`Error: ${error.message}`))
            }
          }
          break
          
        case 'delete-contact':
          if (args.length < 1) {
            console.error(chalk.red('Usage: delete-contact <id>'))
          } else {
            try {
              const response = await fetch(`${url}/contacts/${args[0]}`, {
                method: 'DELETE'
              })
              if (response.ok) {
                console.log(chalk.green('✓ Deleted'))
              } else {
                console.error(chalk.red(`Failed: ${response.statusText}`))
              }
            } catch (error: any) {
              console.error(chalk.red(`Error: ${error.message}`))
            }
          }
          break
          
        case 'connect':
          if (args.length < 2) {
            console.error(chalk.red('Usage: connect <fromContactId> <toContactId>'))
          } else {
            try {
              const [fromId, toId] = args
              const response = await fetch(`${url}/wires`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromId, toId })
              })
              if (response.ok) {
                const result = await response.json() as any
                console.log(chalk.green(`✓ Created wire: ${result.id}`))
              } else {
                console.error(chalk.red(`Failed: ${response.statusText}`))
              }
            } catch (error: any) {
              console.error(chalk.red(`Error: ${error.message}`))
            }
          }
          break
          
        case 'delete-wire':
          if (args.length < 1) {
            console.error(chalk.red('Usage: delete-wire <id>'))
          } else {
            try {
              const response = await fetch(`${url}/wires/${args[0]}`, {
                method: 'DELETE'
              })
              if (response.ok) {
                console.log(chalk.green('✓ Deleted'))
              } else {
                console.error(chalk.red(`Failed: ${response.statusText}`))
              }
            } catch (error: any) {
              console.error(chalk.red(`Error: ${error.message}`))
            }
          }
          break
          
        case 'exit':
          console.log(chalk.yellow('Goodbye!'))
          rl.close()
          process.exit(0)
          break
          
        default:
          console.error(chalk.red(`Unknown command: ${cmd}`))
          console.log(chalk.white('Type "help" for available commands'))
      }
      
      rl.prompt()
    })
    
    rl.on('close', () => {
      console.log(chalk.yellow('\nGoodbye!'))
      process.exit(0)
    })
  } else {
    // Non-interactive mode
    console.log(chalk.white('Connected successfully. Use --interactive flag for interactive mode.'))
  }
}