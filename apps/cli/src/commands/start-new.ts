/**
 * Start command using the new preset system
 */

import chalk from 'chalk'
import { getPreset, listPresets } from '../presets/index'
import type { PresetOptions } from '../presets/types'

export async function startCommand(options: any) {
  // If --list-presets flag is set, show available presets
  if (options.listPresets) {
    console.log(chalk.blue.bold('\n🎵 Available Bassline Presets:\n'))
    
    const presets = listPresets()
    // Remove duplicates (aliases)
    const seen = new Set<string>()
    const unique = presets.filter(p => {
      const key = p.description
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    
    for (const preset of unique) {
      console.log(chalk.cyan(`  ${preset.name.padEnd(15)}`), chalk.gray(preset.description))
    }
    
    console.log('\n' + chalk.yellow('Usage:'))
    console.log(chalk.gray('  bassline start --preset <name> [options]'))
    console.log(chalk.gray('  bassline start                 # Uses default preset'))
    return
  }
  
  // Get the preset
  const presetName = options.preset || 'default'
  const preset = getPreset(presetName)
  
  if (!preset) {
    console.error(chalk.red(`✗ Unknown preset: ${presetName}`))
    console.log(chalk.yellow('\nAvailable presets:'))
    
    const presets = listPresets()
    const seen = new Set<string>()
    for (const p of presets) {
      if (!seen.has(p.description)) {
        console.log(chalk.gray(`  - ${p.name}`))
        seen.add(p.description)
      }
    }
    
    console.log('\n' + chalk.gray('Use --list-presets to see descriptions'))
    process.exit(1)
  }
  
  // Show what preset we're using
  console.log(chalk.blue.bold('\n🎵 Bassline Network'))
  console.log(chalk.gray(`Using preset: ${chalk.cyan(preset.name)}`))
  console.log(chalk.gray(`Description: ${preset.description}\n`))
  
  // Convert old options to new format
  const presetOptions: PresetOptions = {
    port: options.port ? parseInt(options.port) : undefined,
    host: options.host,
    verbose: options.verbose,
    database: options.database || options.storageDb,
    dbHost: options.dbHost || options.storageHost,
    httpPort: options.httpPort ? parseInt(options.httpPort) : undefined,
    wsPort: options.wsPort ? parseInt(options.wsPort) : undefined,
    ...options // Pass through all other options for preset-specific handling
  }
  
  // Run the preset
  try {
    await preset.run(presetOptions)
  } catch (error) {
    console.error(chalk.red('\n✗ Failed to start network:'), error)
    process.exit(1)
  }
}

// For backward compatibility, also export the old function name
export { startCommand as startServer }