/**
 * CLI Runtime that uses user installation
 */

import { Command } from 'commander'
import chalk from 'chalk'
import type { BasslineInstallation } from '@bassline/installation'

export class CLI {
  private installation: BasslineInstallation
  private program: Command
  
  constructor(installation: BasslineInstallation) {
    this.installation = installation
    this.program = new Command()
    
    this.setupCommands()
  }
  
  private setupCommands() {
    this.program
      .name('bassline')
      .description('Bassline CLI (User Installation)')
      .version('0.1.0')
    
    // Network commands
    this.program
      .command('network')
      .description('Manage networks')
      .action(() => {
        this.program.outputHelp()
      })
    
    this.program
      .command('network:create <id>')
      .description('Create a new network')
      .option('-s, --storage <type>', 'storage backend')
      .option('-t, --transport <type>', 'transport layer')
      .action(async (id, options) => {
        await this.createNetwork(id, options)
      })
    
    this.program
      .command('network:list')
      .description('List all networks')
      .action(async () => {
        await this.listNetworks()
      })
    
    this.program
      .command('network:start <id>')
      .description('Start a network')
      .action(async (id) => {
        await this.startNetwork(id)
      })
    
    this.program
      .command('network:stop <id>')
      .description('Stop a network')
      .action(async (id) => {
        await this.stopNetwork(id)
      })
    
    this.program
      .command('network:delete <id>')
      .description('Delete a network')
      .action(async (id) => {
        await this.deleteNetwork(id)
      })
    
    // Storage commands
    this.program
      .command('storage:list')
      .description('List available storage backends')
      .action(() => {
        this.listStorage()
      })
    
    // Transport commands
    this.program
      .command('transport:list')
      .description('List available transport layers')
      .action(() => {
        this.listTransports()
      })
    
    // Bassline commands
    this.program
      .command('bassline:list')
      .description('List installed basslines')
      .action(() => {
        this.listBasslines()
      })
    
    // Info command
    this.program
      .command('info')
      .description('Show installation information')
      .action(() => {
        this.showInfo()
      })
  }
  
  async run(argv: string[]) {
    try {
      await this.program.parseAsync(argv)
    } catch (error) {
      console.error(chalk.red('Error:'), error)
      process.exit(1)
    }
  }
  
  // Command implementations
  
  private async createNetwork(id: string, options: any) {
    try {
      const config = {
        id,
        storage: {
          type: options.storage || this.installation.getDefaults().storage
        },
        transport: options.transport ? {
          type: options.transport
        } : undefined
      }
      
      const network = await this.installation.createNetwork(config)
      console.log(chalk.green(`✓ Network '${id}' created`))
      console.log(`  Storage: ${config.storage.type}`)
      if (config.transport) {
        console.log(`  Transport: ${config.transport.type}`)
      }
    } catch (error) {
      console.error(chalk.red('Failed to create network:'), error)
    }
  }
  
  private async listNetworks() {
    const networks = this.installation.listNetworks()
    
    if (networks.length === 0) {
      console.log(chalk.gray('No networks found'))
      return
    }
    
    console.log(chalk.bold('\nNetworks:\n'))
    for (const network of networks) {
      const status = network.state === 'running' 
        ? chalk.green('● running') 
        : chalk.gray('○ stopped')
      
      console.log(`  ${status} ${chalk.bold(network.id)}`)
      console.log(`         Storage: ${network.config.storage.type}`)
      if (network.config.transport) {
        console.log(`         Transport: ${network.config.transport.type}`)
      }
      console.log(`         Created: ${network.createdAt.toLocaleString()}`)
      if (network.startedAt) {
        console.log(`         Started: ${network.startedAt.toLocaleString()}`)
      }
      console.log()
    }
  }
  
  private async startNetwork(id: string) {
    try {
      await this.installation.startNetwork(id)
      console.log(chalk.green(`✓ Network '${id}' started`))
    } catch (error) {
      console.error(chalk.red('Failed to start network:'), error)
    }
  }
  
  private async stopNetwork(id: string) {
    try {
      await this.installation.stopNetwork(id)
      console.log(chalk.green(`✓ Network '${id}' stopped`))
    } catch (error) {
      console.error(chalk.red('Failed to stop network:'), error)
    }
  }
  
  private async deleteNetwork(id: string) {
    try {
      await this.installation.deleteNetwork(id)
      console.log(chalk.green(`✓ Network '${id}' deleted`))
    } catch (error) {
      console.error(chalk.red('Failed to delete network:'), error)
    }
  }
  
  private listStorage() {
    const backends = this.installation.getAvailableStorage()
    const defaults = this.installation.getDefaults()
    
    console.log(chalk.bold('\nAvailable Storage Backends:\n'))
    for (const backend of backends) {
      const isDefault = backend === defaults.storage
      const marker = isDefault ? chalk.green(' (default)') : ''
      console.log(`  • ${backend}${marker}`)
    }
  }
  
  private listTransports() {
    const transports = this.installation.getAvailableTransports()
    const defaults = this.installation.getDefaults()
    
    if (transports.length === 0) {
      console.log(chalk.gray('No transport layers configured'))
      return
    }
    
    console.log(chalk.bold('\nAvailable Transport Layers:\n'))
    for (const transport of transports) {
      const isDefault = transport === defaults.transport
      const marker = isDefault ? chalk.green(' (default)') : ''
      console.log(`  • ${transport}${marker}`)
    }
  }
  
  private listBasslines() {
    const basslines = this.installation.getInstalledBasslines()
    
    if (basslines.length === 0) {
      console.log(chalk.gray('No basslines installed'))
      return
    }
    
    console.log(chalk.bold('\nInstalled Basslines:\n'))
    for (const bassline of basslines) {
      console.log(`  • ${bassline}`)
    }
  }
  
  private showInfo() {
    const metadata = this.installation.getMetadata()
    const defaults = this.installation.getDefaults()
    
    console.log(chalk.bold('\nBassline Installation\n'))
    console.log(`  Version:   ${metadata.version}`)
    console.log(`  Path:      ${metadata.path}`)
    console.log(`  Created:   ${metadata.createdAt.toLocaleString()}`)
    console.log()
    
    console.log(chalk.bold('Defaults:'))
    console.log(`  Storage:   ${defaults.storage}`)
    console.log(`  Transport: ${defaults.transport || 'none'}`)
    console.log(`  Scheduler: ${defaults.scheduler}`)
    console.log()
    
    console.log(chalk.bold('Available:'))
    console.log(`  Storage:   ${this.installation.getAvailableStorage().join(', ')}`)
    console.log(`  Transport: ${this.installation.getAvailableTransports().join(', ') || 'none'}`)
    console.log(`  Basslines: ${this.installation.getInstalledBasslines().length} installed`)
  }
}