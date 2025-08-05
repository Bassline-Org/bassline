import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs/promises'
import path from 'path'
import { StandaloneNetwork } from '../runtime/StandaloneNetwork.js'

export async function exportNetwork(file: string, options: { group: string }) {
  const spinner = ora('Connecting to network...').start()
  
  try {
    // For now, create a test network - in real usage this would connect to an existing one
    const network = new StandaloneNetwork()
    await network.initialize()
    
    spinner.text = 'Exporting network state...'
    
    // Export state
    const state = await network.exportState(options.group)
    
    // Write to file
    const filePath = path.resolve(file)
    await fs.writeFile(filePath, JSON.stringify(state, null, 2))
    
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
    
    await network.terminate()
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to export network'))
    console.error(error)
    process.exit(1)
  }
}