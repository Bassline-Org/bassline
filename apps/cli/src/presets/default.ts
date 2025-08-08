/**
 * Default preset - Basic in-memory propagation network with WebSocket
 */

import chalk from 'chalk'
import ora from 'ora'
import { 
  MemoryStorageDriver,
  WebSocketBridgeDriver
} from '@bassline/core'
import { KernelNetwork } from '../kernel/kernel-network'
import type { PresetConfig } from './types'

const preset: PresetConfig = {
  name: 'default',
  description: 'Basic in-memory propagation network with WebSocket server',
  
  async run(options) {
    const spinner = ora('Starting default network...').start()
    
    try {
      // Create kernel network
      const network = new KernelNetwork({ 
        verbose: options.verbose 
      })
      
      // Add memory storage
      spinner.text = 'Setting up memory storage...'
      const storage = new MemoryStorageDriver()
      await storage.initialize()
      await network.registerDriver('storage', storage)
      
      // Add WebSocket bridge for remote connections
      spinner.text = 'Starting WebSocket server...'
      const wsDriver = new WebSocketBridgeDriver({
        url: `ws://localhost:${options.port || 8455}`,
        room: 'default'
      })
      await network.registerDriver('websocket', wsDriver)
      
      // Start the network
      await network.start()
      
      spinner.succeed(chalk.green(`✅ Network running on port ${options.port || 8455}`))
      
      console.log('\n' + chalk.blue('Network Configuration:'))
      console.log(chalk.gray('  Storage:   ') + 'In-memory')
      console.log(chalk.gray('  Transport: ') + `WebSocket (port ${options.port || 8455})`)
      console.log(chalk.gray('  Room ID:   ') + 'default')
      
      console.log('\n' + chalk.yellow('Connect with:'))
      console.log(chalk.gray('  Web UI:  ') + `http://localhost:${options.port || 8455}`)
      console.log(chalk.gray('  CLI:     ') + `bassline connect ws://localhost:${options.port || 8455}`)
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n' + chalk.yellow('Shutting down...'))
        await network.stop()
        process.exit(0)
      })
      
      // Keep process alive
      process.stdin.resume()
      
    } catch (error) {
      spinner.fail(chalk.red('Failed to start network'))
      console.error(error)
      process.exit(1)
    }
  }
}

export default preset