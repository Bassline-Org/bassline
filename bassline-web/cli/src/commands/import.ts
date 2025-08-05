import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs/promises'
import path from 'path'
import { StandaloneNetwork } from '../runtime/StandaloneNetwork.js'

export async function importNetwork(file: string, options: { merge: boolean }) {
  const spinner = ora('Reading network file...').start()
  
  try {
    // Read file
    const filePath = path.resolve(file)
    const content = await fs.readFile(filePath, 'utf-8')
    const networkData = JSON.parse(content)
    
    spinner.text = 'Initializing network...'
    
    // Create network
    const network = new StandaloneNetwork()
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
    
    await network.terminate()
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to import network'))
    console.error(error)
    process.exit(1)
  }
}