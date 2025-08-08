import chalk from 'chalk'
import ora from 'ora'
import { readFile, watch } from 'fs/promises'
import { resolve } from 'path'
import { KernelNetwork } from '../kernel/kernel-network'
import { MemoryStorageDriver } from '@bassline/core'

export async function runNetwork(file: string, options: { watch: boolean; scheduler: string }) {
  const spinner = ora('Loading network file...').start()
  
  try {
    // Read network file
    const filePath = resolve(file)
    const content = await readFile(filePath, 'utf-8')
    const networkData = JSON.parse(content)
    
    spinner.text = 'Initializing network...'
    
    // Create kernel-based network with memory storage
    const network = new KernelNetwork()
    
    // Register memory storage driver
    const storage = new MemoryStorageDriver()
    await network.registerDriver('storage', storage)
    
    // Initialize with specified scheduler
    await network.initialize(options.scheduler as 'immediate' | 'batch')
    
    // Import network state
    await network.importState(networkData)
    
    spinner.succeed(chalk.green('Network loaded and running'))
    
    // Subscribe to changes
    console.log(chalk.blue('\nNetwork activity:'))
    network.subscribe((changes) => {
      changes.forEach(change => {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
        console.log(chalk.gray(`[${timestamp}]`), chalk.yellow(change.type + ':'), formatChangeData(change.data))
      })
    })
    
    // Watch for file changes if requested
    if (options.watch) {
      console.log(chalk.gray(`\nWatching ${file} for changes...`))
      
      let reloadTimeout: NodeJS.Timeout | null = null
      const watcher = watch(filePath)
      
      for await (const event of watcher) {
        if (event.eventType === 'change') {
          if (reloadTimeout) clearTimeout(reloadTimeout)
          reloadTimeout = setTimeout(async () => {
            console.log(chalk.yellow('\nFile changed, reloading...'))
            try {
              const newContent = await readFile(filePath, 'utf-8')
              const newData = JSON.parse(newContent)
              await network.importState(newData)
              console.log(chalk.green('Network reloaded'))
            } catch (error: any) {
              console.error(chalk.red('Failed to reload:'), error.message)
            }
          }, 100)
        }
      }
    }
    
    console.log(chalk.gray('\nPress Ctrl+C to stop'))
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\nShutting down...'))
      await network.shutdown()
      process.exit(0)
    })
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to run network'))
    console.error(error)
    process.exit(1)
  }
}

function formatChangeData(data: any): string {
  if (typeof data === 'object' && data !== null) {
    if (data.contact) {
      return `Contact ${data.contact.id.slice(0, 8)} = ${JSON.stringify(data.contact.content)}`
    }
    if (data.wire) {
      return `Wire ${data.wire.id.slice(0, 8)}: ${data.wire.fromId.slice(0, 8)} → ${data.wire.toId.slice(0, 8)}`
    }
    if (data.groupId) {
      return `Group ${data.groupId.slice(0, 8)}`
    }
  }
  return JSON.stringify(data)
}