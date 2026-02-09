#!/usr/bin/env node
import { createRequire } from 'node:module'
import { program } from 'commander'
import { command as newProject } from './commands/new/index.js'
import { protocol } from './commands/protocol/index.js'
import { resource } from './commands/resource/index.js'
import { registry } from './commands/registry/index.js'
import { command as addItem } from './commands/add.js'
import { command as removeItem } from './commands/remove.js'
import { command as listItems } from './commands/ls.js'
import { command as build } from './commands/build.js'
import { command as serve } from './commands/serve.js'

const require = createRequire(import.meta.url)
const { version } = require('../package.json')

program.name('bl').description('Bassline project tools').version(version, '-v --version')

program.command('new [name]').description('Create a new bassline project').action(newProject)
program.addCommand(protocol)
program.addCommand(resource)
program.addCommand(registry)
program.command('add <ref>').description('Add a registry item to the project').action(addItem)
program.command('remove <ref>').description('Remove an installed item').action(removeItem)
program.command('ls').description('List installed items').action(listItems)
program
  .command('build [name]')
  .description('Build registry items from resources')
  .option('--output <dir>', 'Output directory', 'public/r')
  .action(build)
program
  .command('serve')
  .description('Serve built registry items')
  .option('--port <port>', 'Port number', '2017')
  .action(serve)

program.parse()
