#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { startCommand } from './commands/start-new'
import { runNetwork } from './commands/run'
import { connectToNetwork } from './commands/connect'
import { exportNetwork } from './commands/export'
import { importNetwork } from './commands/import'
import { createSignalCommand } from './commands/signal'
import { initCommand } from './commands/init'

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
  .option('--preset <name>', 'preset configuration to use', 'default')
  .option('-p, --port <port>', 'port to listen on', '8455')
  .option('-n, --name <name>', 'network name', 'default')
  .option('--list-presets', 'list available presets')
  .option('-v, --verbose', 'verbose output')
  // Unix pipes options
  .option('--jq <filter>', 'jq filter for JSON processing (unix-pipes preset)')
  .option('--sed <script>', 'sed script for text transformation (unix-pipes preset)')
  .option('--awk <script>', 'awk script for processing (unix-pipes preset)')
  .option('--transform <command>', 'custom transform command (unix-pipes preset)')
  .option('--protocol <type>', 'protocol for IPC: json, line, binary (unix-pipes preset)')
  // Notification options
  .option('--filter <pattern>', 'filter notifications by pattern (notifications preset)')
  .option('--sound <name>', 'notification sound (macOS only)')
  // Legacy storage options (for backward compatibility)
  .option('--storage <type>', 'storage backend (memory, postgres, filesystem)', 'memory')
  .option('--storage-path <path>', 'filesystem storage path')
  .option('--storage-db <database>', 'postgres database name')
  .option('--storage-host <host>', 'postgres host')
  .action(async (options) => {
    // Use new preset-based start command
    await startCommand(options)
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