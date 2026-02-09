import { Command } from 'commander'
import { command as addRegistry } from './add.js'
import { command as listRegistries } from './ls.js'
import { command as removeRegistry } from './remove.js'

export const registry = new Command('registry').description('Manage registry namespaces')

registry.command('add <namespace> <url>').description('Add a registry namespace').action(addRegistry)
registry.command('ls').description('List configured registries').action(listRegistries)
registry.command('remove <namespace>').description('Remove a registry namespace').action(removeRegistry)
