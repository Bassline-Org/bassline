import chalk from 'chalk'
import ora from 'ora'

export async function connectToNetwork(url: string, options: { interactive: boolean }) {
  const spinner = ora('Connecting to network...').start()
  
  try {
    // Validate URL
    new URL(url)
    
    // Test connection by fetching root state
    spinner.text = 'Testing connection...'
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
      console.log(chalk.blue('\nInteractive mode - type "help" for commands'))
      console.log(chalk.gray('Type "exit" to disconnect\n'))
      
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
            console.log(chalk.gray('Commands:'))
            console.log(chalk.gray('  state [groupId]          - Show group state'))
            console.log(chalk.gray('  groups                   - List all groups'))
            console.log(chalk.gray('  primitives               - List available primitives'))
            console.log(chalk.gray('  create-group <name> [parentId] [primitiveId] - Create new group'))
            console.log(chalk.gray('  delete-group <id>        - Delete a group'))
            console.log(chalk.gray('  add <groupId> <content>  - Add contact'))
            console.log(chalk.gray('  delete-contact <id>      - Delete a contact'))
            console.log(chalk.gray('  connect <from> <to>      - Connect contacts'))
            console.log(chalk.gray('  delete-wire <id>         - Delete a wire'))
            console.log(chalk.gray('  update <id> <content>    - Update contact'))
            console.log(chalk.gray('  exit                     - Disconnect'))
            break
            
          case 'state':
            const groupId = args[0] || 'root'
            try {
              const response = await fetch(`${url}/state?groupId=${groupId}`)
              const state = await response.json()
              console.log(chalk.gray(JSON.stringify(state, null, 2)))
            } catch (error: any) {
              console.error(chalk.red('Failed to get state:'), error.message)
            }
            break
            
          case 'add':
            if (args.length < 2) {
              console.log(chalk.red('Usage: add <groupId> <content>'))
              break
            }
            try {
              const response = await fetch(`${url}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  groupId: args[0],
                  contact: {
                    content: args.slice(1).join(' '),
                    blendMode: 'accept-last'
                  }
                })
              })
              const result = await response.json() as { contactId: string }
              console.log(chalk.green('Contact added:'), result.contactId)
            } catch (error: any) {
              console.error(chalk.red('Failed to add contact:'), error.message)
            }
            break
            
          case 'connect':
            if (args.length < 2) {
              console.log(chalk.red('Usage: connect <fromId> <toId>'))
              break
            }
            try {
              const response = await fetch(`${url}/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fromId: args[0],
                  toId: args[1],
                  type: 'bidirectional'
                })
              })
              const result = await response.json() as { wireId: string }
              console.log(chalk.green('Wire created:'), result.wireId)
            } catch (error: any) {
              console.error(chalk.red('Failed to connect:'), error.message)
            }
            break
            
          case 'groups':
            try {
              const response = await fetch(`${url}/groups`)
              const groups = await response.json() as any[]
              console.log(chalk.blue('Groups:'))
              groups.forEach(group => {
                const indent = group.parentId && group.parentId !== 'root' ? '  ' : ''
                const type = group.primitiveId ? ` (${group.primitiveId})` : ''
                console.log(chalk.gray(`${indent}${group.id}: ${group.name}${type}`))
                console.log(chalk.gray(`${indent}  Contacts: ${group.contactCount}, Wires: ${group.wireCount}, Subgroups: ${group.subgroupCount}`))
              })
            } catch (error: any) {
              console.error(chalk.red('Failed to list groups:'), error.message)
            }
            break
            
          case 'primitives':
            try {
              const response = await fetch(`${url}/primitives`)
              const primitives = await response.json() as any[]
              console.log(chalk.blue('Available primitives:'))
              primitives.forEach(prim => {
                console.log(chalk.gray(`${prim.id}: ${prim.name} - ${prim.description}`))
                console.log(chalk.gray(`  Inputs: ${prim.inputs.map((i: any) => i.name).join(', ')}`))
                console.log(chalk.gray(`  Outputs: ${prim.outputs.map((o: any) => o.name).join(', ')}`))
              })
            } catch (error: any) {
              console.error(chalk.red('Failed to list primitives:'), error.message)
            }
            break
            
          case 'create-group':
            if (args.length < 1) {
              console.log(chalk.red('Usage: create-group <name> [parentId] [primitiveId]'))
              break
            }
            try {
              const response = await fetch(`${url}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: args[0],
                  parentId: args[1],
                  primitiveId: args[2]
                })
              })
              const result = await response.json() as { groupId: string }
              console.log(chalk.green('Group created:'), result.groupId)
            } catch (error: any) {
              console.error(chalk.red('Failed to create group:'), error.message)
            }
            break
            
          case 'delete-group':
            if (args.length < 1) {
              console.log(chalk.red('Usage: delete-group <groupId>'))
              break
            }
            try {
              const response = await fetch(`${url}/groups/${args[0]}`, {
                method: 'DELETE'
              })
              await response.json()
              console.log(chalk.green('Group deleted'))
            } catch (error: any) {
              console.error(chalk.red('Failed to delete group:'), error.message)
            }
            break
            
          case 'delete-contact':
            if (args.length < 1) {
              console.log(chalk.red('Usage: delete-contact <contactId>'))
              break
            }
            try {
              const response = await fetch(`${url}/contact/${args[0]}`, {
                method: 'DELETE'
              })
              await response.json()
              console.log(chalk.green('Contact deleted'))
            } catch (error: any) {
              console.error(chalk.red('Failed to delete contact:'), error.message)
            }
            break
            
          case 'delete-wire':
            if (args.length < 1) {
              console.log(chalk.red('Usage: delete-wire <wireId>'))
              break
            }
            try {
              const response = await fetch(`${url}/wire/${args[0]}`, {
                method: 'DELETE'
              })
              await response.json()
              console.log(chalk.green('Wire deleted'))
            } catch (error: any) {
              console.error(chalk.red('Failed to delete wire:'), error.message)
            }
            break
            
          case 'update':
            if (args.length < 2) {
              console.log(chalk.red('Usage: update <contactId> <content>'))
              break
            }
            try {
              const response = await fetch(`${url}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contactId: args[0],
                  content: args.slice(1).join(' ')
                })
              })
              await response.json()
              console.log(chalk.green('Contact updated'))
            } catch (error: any) {
              console.error(chalk.red('Failed to update:'), error.message)
            }
            break
            
          case 'exit':
          case 'quit':
            console.log(chalk.yellow('Disconnected'))
            rl.close()
            process.exit(0)
            
          default:
            if (cmd) {
              console.log(chalk.red(`Unknown command: ${cmd}`))
            }
        }
        
        // Show prompt for next command
        rl.prompt()
      })
      
      // Handle Ctrl+C
      rl.on('SIGINT', () => {
        console.log(chalk.yellow('\nDisconnected'))
        process.exit(0)
      })
      
      // Handle close event
      rl.on('close', () => {
        console.log(chalk.yellow('Disconnected'))
        process.exit(0)
      })
      
      // Keep the process alive by preventing the function from returning
      await new Promise<void>((resolve) => {
        rl.on('close', resolve)
      })
    }
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to connect'))
    console.error(error)
    process.exit(1)
  }
}