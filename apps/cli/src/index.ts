#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { startServer } from './commands/start.js'
import { runNetwork } from './commands/run.js'
import { connectToNetwork } from './commands/connect.js'
import { exportNetwork } from './commands/export.js'
import { importNetwork } from './commands/import.js'
import { createSignalCommand } from './commands/signal.js'
import { initCommand } from './commands/init.js'

const program = new Command()

program
  .name('bassline')
  .description('CLI for managing Bassline propagation networks')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize a new Bassline installation')
  .option('-p, --path <path>', 'installation directory')
  .option('-f, --from <template>', 'install from template')
  .option('-m, --minimal', 'minimal installation (no prompts)')
  .option('--skip-install', 'skip npm install')
  .action(initCommand)

program
  .command('start')
  .description('Start a propagation network server')
  .option('-p, --port <port>', 'port to listen on', '8455')
  .option('-n, --name <name>', 'network name', 'default')
  .option('--storage <type>', 'storage backend (memory, postgres, filesystem)', 'memory')
  .option('--storage-path <path>', 'filesystem storage path')
  .option('--storage-db <database>', 'postgres database name')
  .option('--storage-host <host>', 'postgres host')
  .action(async (options) => {
    // Prepare storage options based on type
    let storageOptions: any = undefined
    
    if (options.storage === 'filesystem' && options.storagePath) {
      storageOptions = { basePath: options.storagePath }
    } else if (options.storage === 'postgres') {
      storageOptions = {
        database: options.storageDb || 'bassline',
        host: options.storageHost || 'localhost'
      }
    }
    
    await startServer({
      ...options,
      storage: options.storage,
      storageOptions
    })
  })

program
  .command('run <file>')
  .description('Run a network from a file')
  .option('-w, --watch', 'watch for changes')
  .option('-s, --scheduler <type>', 'scheduler type (immediate, batch)', 'immediate')
  .action(runNetwork)

program
  .command('connect <url>')
  .description('Connect to a running network')
  .option('--no-interactive', 'disable interactive mode')
  .action(connectToNetwork)

program
  .command('export <file>')
  .description('Export current network state')
  .option('-g, --group <id>', 'group to export', 'root')
  .action(exportNetwork)

program
  .command('import <file>')
  .description('Import network state from file')
  .option('-m, --merge', 'merge with existing network')
  .action(importNetwork)

// Add signal command for WebRTC
program.addCommand(createSignalCommand())

program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}