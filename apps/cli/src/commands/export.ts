import chalk from 'chalk'
import ora from 'ora'
import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import { KernelNetwork } from '../kernel/kernel-network'
import { MemoryStorageDriver } from '@bassline/core'

export async function exportNetwork(file: string, options: { group: string }) {
  const spinner = ora('Connecting to network...').start()
  
  try {
    // For now, create a test network - in real usage this would connect to an existing one
    const network = new KernelNetwork()
    
    // Register memory storage driver
    const storage = new MemoryStorageDriver()
    await network.registerDriver('storage', storage)
    
    // Initialize network
    await network.initialize()
    
    spinner.text = 'Exporting network state...'
    
    // Export state
    const state = await network.exportState(options.group)
    
    // Write to file
    const filePath = resolve(file)
    await writeFile(filePath, JSON.stringify(state, null, 2))
    
    spinner.succeed(chalk.green(`Network exported to ${file}`))
    
    // Show summary
    console.log(chalk.blue('\nExport summary:'))
    console.log(chalk.gray(`  Group: ${options.group}`))
    if (state.groups) {
      console.log(chalk.gray(`  Groups: ${Object.keys(state.groups).length}`))
    }
    if (state.contacts) {
      console.log(chalk.gray(`  Contacts: ${Object.keys(state.contacts).length}`))
    }
    if (state.wires) {
      console.log(chalk.gray(`  Wires: ${Object.keys(state.wires).length}`))
    }
    
    await network.shutdown()
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to export network'))
    console.error(error)
    process.exit(1)
  }
}