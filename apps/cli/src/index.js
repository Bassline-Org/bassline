#!/usr/bin/env node
import { createRequire } from 'node:module'
import { program } from 'commander'
import { command as newProject } from './commands/new/index.js'

const require = createRequire(import.meta.url)
const { version } = require('../package.json')

program.name('bl').description('Bassline project tools').version(version, '-v --version')

program.command('new [name]').description('Create a new bassline project').action(newProject)

program.parse()
