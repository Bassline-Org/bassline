/**
 * Unix pipes preset - Network with Unix pipe integration
 * Allows Bassline to be used in Unix pipelines
 */

import chalk from 'chalk'
import ora from 'ora'
import { 
  MemoryStorageDriver,
  IPCBridgeDriver,
  WebSocketBridgeDriver
} from '@bassline/core'
import { KernelNetwork } from '../kernel/kernel-network'
import type { PresetConfig } from './types'

const preset: PresetConfig = {
  name: 'unix-pipes',
  description: 'Network with Unix pipe integration for command-line workflows',
  
  async run(options) {
    const spinner = ora('Starting Unix pipe network...').start()
    
    try {
      // Create kernel network
      const network = new KernelNetwork({ 
        verbose: options.verbose 
      })
      
      // Add memory storage
      spinner.text = 'Setting up storage...'
      const storage = new MemoryStorageDriver()
      await storage.initialize()
      await network.registerDriver('storage', storage)
      
      // Add stdin/stdout bridge for piping
      if (!process.stdin.isTTY) {
        spinner.text = 'Setting up stdin/stdout bridge...'
        const stdioBridge = new IPCBridgeDriver({
          stdin: process.stdin,
          stdout: process.stdout,
          protocol: options.protocol || 'json'
        })
        await network.registerDriver('stdio', stdioBridge)
      }
      
      // Add optional transform bridges
      if (options.jq) {
        spinner.text = 'Adding jq filter bridge...'
        const jqBridge = new IPCBridgeDriver({
          command: 'jq',
          args: [options.jq],
          protocol: 'json'
        })
        await network.registerDriver('jq', jqBridge)
      }
      
      if (options.sed) {
        spinner.text = 'Adding sed transform bridge...'
        const sedBridge = new IPCBridgeDriver({
          command: 'sed',
          args: options.sed.split(' '),
          protocol: 'line'
        })
        await network.registerDriver('sed', sedBridge)
      }
      
      if (options.awk) {
        spinner.text = 'Adding awk processor bridge...'
        const awkBridge = new IPCBridgeDriver({
          command: 'awk',
          args: [options.awk],
          protocol: 'line'
        })
        await network.registerDriver('awk', awkBridge)
      }
      
      if (options.transform) {
        spinner.text = `Adding custom transform: ${options.transform}...`
        const [command, ...args] = options.transform.split(' ')
        const transformBridge = new IPCBridgeDriver({
          command,
          args,
          protocol: options.protocol || 'line'
        })
        await network.registerDriver('transform', transformBridge)
      }
      
      // Add WebSocket for monitoring (optional)
      if (options.port) {
        spinner.text = 'Starting WebSocket server for monitoring...'
        const wsDriver = new WebSocketBridgeDriver({
          url: `ws://localhost:${options.port}`,
          room: 'unix-pipes'
        })
        await network.registerDriver('websocket', wsDriver)
      }
      
      // Start the network
      await network.start()
      
      spinner.succeed(chalk.green('✅ Unix pipe network ready'))
      
      // Show configuration
      const drivers = network.getDrivers()
      console.log('\n' + chalk.blue('Active Bridges:'))
      for (const [id, driver] of drivers) {
        if (id !== 'storage') {
          console.log(chalk.gray('  - ') + id)
        }
      }
      
      if (!process.stdin.isTTY) {
        console.log('\n' + chalk.yellow('Reading from stdin...'))
      }
      
      console.log('\n' + chalk.cyan('Example Usage:'))
      console.log(chalk.gray('  # Pipe JSON through Bassline:'))
      console.log(chalk.gray('  echo \'{"value": 42}\' | bassline start --preset unix-pipes'))
      console.log(chalk.gray('  '))
      console.log(chalk.gray('  # Transform with jq:'))
      console.log(chalk.gray('  cat data.json | bassline start --preset unix-pipes --jq ".value * 2"'))
      console.log(chalk.gray('  '))
      console.log(chalk.gray('  # Chain with Unix tools:'))
      console.log(chalk.gray('  bassline export | jq ".contacts" | bassline start --preset unix-pipes'))
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        if (options.verbose) {
          console.log('\n' + chalk.yellow('Shutting down...'))
        }
        await network.stop()
        process.exit(0)
      })
      
      // Don't keep process alive if piping
      if (process.stdin.isTTY && !options.port) {
        console.log(chalk.gray('\nNo input stream detected. Use --port to keep running.'))
        await network.stop()
        process.exit(0)
      }
      
    } catch (error) {
      spinner.fail(chalk.red('Failed to start Unix pipe network'))
      console.error(error)
      process.exit(1)
    }
  }
}

export default preset