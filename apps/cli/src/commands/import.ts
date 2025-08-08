import chalk from 'chalk'
import ora from 'ora'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { KernelNetwork } from '../kernel/kernel-network'
import { MemoryStorageDriver } from '@bassline/core'

export async function importNetwork(file: string, options: { merge: boolean }) {
  const spinner = ora('Reading network file...').start()
  
  try {
    // Read file
    const filePath = resolve(file)
    const content = await readFile(filePath, 'utf-8')
    const networkData = JSON.parse(content)
    
    spinner.text = 'Initializing network...'
    
    // Create kernel-based network
    const network = new KernelNetwork()
    
    // Register memory storage driver
    const storage = new MemoryStorageDriver()
    await network.registerDriver('storage', storage)
    
    // Initialize network
    await network.initialize()
    
    spinner.text = 'Importing network state...'
    
    // Import state
    await network.importState(networkData)
    
    spinner.succeed(chalk.green('Network imported successfully'))
    
    // Show summary
    console.log(chalk.blue('\nImport summary:'))
    if (networkData.groups) {
      console.log(chalk.gray(`  Groups: ${Object.keys(networkData.groups).length}`))
    }
    if (networkData.contacts) {
      console.log(chalk.gray(`  Contacts: ${Object.keys(networkData.contacts).length}`))
    }
    if (networkData.wires) {
      console.log(chalk.gray(`  Wires: ${Object.keys(networkData.wires).length}`))
    }
    
    await network.shutdown()
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to import network'))
    console.error(error)
    process.exit(1)
  }
}