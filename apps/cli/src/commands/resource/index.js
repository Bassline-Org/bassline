import { Command } from 'commander'
import { command as newResource } from './new.js'
import { command as listResources } from './ls.js'

export const resource = new Command('resource').description('Manage project resource templates')

resource.command('new').description('Define a new resource template').action(newResource)
resource.command('ls').description('List project resources').action(listResources)
