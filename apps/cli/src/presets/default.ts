/**
 * Default preset - Basic in-memory network with WebSocket server
 */

import chalk from 'chalk'
import ora from 'ora'
import { KernelNetwork } from '../kernel/kernel-network'
import { MemoryStorageDriver, WebSocketServerBridgeDriver } from '@bassline/core'
import type { PresetConfig, PresetOptions } from './types'

const preset: PresetConfig = {
  name: 'default',
  description: 'Basic in-memory propagation network with WebSocket server',
  
  async run(options: PresetOptions) {
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
      
      // Add WebSocket server bridge for remote connections
      spinner.text = 'Starting WebSocket server...'
      const port = options.port || 8455
      const wsServer = new WebSocketServerBridgeDriver({
        port,
        host: '0.0.0.0'
      })
      await network.registerDriver('websocket-server', wsServer)
      
      // Start the network
      await network.start()
      
      spinner.succeed(chalk.green(`✅ Network running on port ${port}`))
      
      console.log('\n' + chalk.cyan('Network Configuration:'))
      console.log(chalk.white('  Storage:   ') + 'In-memory')
      console.log(chalk.white('  Transport: ') + `WebSocket Server (port ${port})`)
      console.log(chalk.white('  Room ID:   ') + 'default')
      
      console.log('\n' + chalk.yellow('Connect with:'))
      console.log(chalk.white('  Web UI:  ') + `http://localhost:${port}`)
      console.log(chalk.white('  CLI:     ') + `bassline connect ws://localhost:${port}`)
      
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