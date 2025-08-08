/**
 * Notifications preset - Network with system notifications
 * Shows desktop notifications for contact changes
 */

import chalk from 'chalk'
import ora from 'ora'
import { platform } from 'os'
import { 
  MemoryStorageDriver,
  WebSocketBridgeDriver
} from '@bassline/core'
import { IPCBridgeDriver } from '@bassline/cli-drivers'
import { KernelNetwork } from '../kernel/kernel-network'
import type { PresetConfig } from './types'

const preset: PresetConfig = {
  name: 'notifications',
  description: 'Network with system notifications for contact changes',
  
  async run(options) {
    const spinner = ora('Starting notification network...').start()
    
    try {
      // Create network
      const network = new KernelNetwork({ verbose: options.verbose })
      
      // Register storage
      spinner.text = 'Setting up storage...'
      const storage = new MemoryStorageDriver()
      await storage.initialize()
      await network.registerDriver('storage', storage)
      
      // Only set up notifications on macOS
      const osType = platform()
      if (osType === 'darwin') {
        spinner.text = 'Setting up notification bridge...'
        
        const notificationScript = `
          while IFS= read -r line; do
            # Parse JSON to extract contact and value
            contactId=$(echo "$line" | sed -n 's/.*"contactId"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
            value=$(echo "$line" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
            if [ -z "$value" ]; then
              value=$(echo "$line" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*\\([^,}]*\\).*/\\1/p')
            fi
            
            # Show notification with sound
            osascript -e "display notification \\"Value: $value\\" with title \\"Bassline: $contactId\\" sound name \\"${options.sound || 'Glass'}\\"" 2>/dev/null
          done
        `
        
        const notifyBridge = new IPCBridgeDriver({
          command: 'sh',
          args: ['-c', notificationScript],
          protocol: 'json'
        })
        
        await network.registerDriver('notifications', notifyBridge)
      } else {
        console.log(chalk.yellow('\n⚠️  Desktop notifications are only supported on macOS'))
        console.log(chalk.gray('   Contact changes will be logged to the console instead\n'))
      }
      
      // Add WebSocket for receiving updates
      spinner.text = 'Starting WebSocket server...'
      const wsDriver = new WebSocketBridgeDriver({
        url: `ws://localhost:${options.port || 8455}`,
        room: 'notifications'
      })
      await network.registerDriver('websocket', wsDriver)
      
      // Start the network
      await network.start()
      
      spinner.succeed(chalk.green('✅ Notification network active'))
      
      console.log('\n' + chalk.blue('Configuration:'))
      console.log(chalk.gray('  Platform:      ') + osType)
      console.log(chalk.gray('  WebSocket:     ') + `port ${options.port || 8455}`)
      if (osType === 'darwin' && options.sound) {
        console.log(chalk.gray('  Sound:         ') + options.sound)
      }
      
      if (osType === 'darwin') {
        console.log('\n' + chalk.yellow('Notifications enabled for contact changes'))
        console.log(chalk.gray('Updates will appear as desktop notifications'))
      }
      
      console.log('\n' + chalk.cyan('Test with:'))
      console.log(chalk.gray('  bassline connect ws://localhost:') + chalk.gray(options.port || 8455))
      console.log(chalk.gray('  > update test-contact "Hello from Bassline!"'))
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n' + chalk.yellow('Shutting down...'))
        await network.stop()
        process.exit(0)
      })
      
      // Keep process alive
      process.stdin.resume()
      
    } catch (error) {
      spinner.fail(chalk.red('Failed to start notification network'))
      console.error(error)
      process.exit(1)
    }
  }
}

export default preset