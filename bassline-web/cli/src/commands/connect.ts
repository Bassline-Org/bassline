import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'

export async function connectToNetwork(url: string, options: { interactive: boolean }) {
  const spinner = ora('Connecting to network...').start()
  
  try {
    // Parse URL
    const networkUrl = new URL(url)
    
    spinner.succeed(chalk.green(`Connected to ${url}`))
    
    if (options.interactive) {
      console.log(chalk.blue('\nInteractive mode - type "help" for commands'))
      
      // Interactive REPL
      let running = true
      while (running) {
        const { command } = await inquirer.prompt([
          {
            type: 'input',
            name: 'command',
            message: '>',
          }
        ])
        
        const [cmd, ...args] = command.trim().split(' ')
        
        switch (cmd) {
          case 'help':
            console.log(chalk.gray('Commands:'))
            console.log(chalk.gray('  state [groupId]     - Show group state'))
            console.log(chalk.gray('  add <groupId> <content>  - Add contact'))
            console.log(chalk.gray('  connect <from> <to>      - Connect contacts'))
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
            running = false
            break
            
          default:
            if (cmd) {
              console.log(chalk.red(`Unknown command: ${cmd}`))
            }
        }
      }
      
      console.log(chalk.yellow('Disconnected'))
    }
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to connect'))
    console.error(error)
    process.exit(1)
  }
}