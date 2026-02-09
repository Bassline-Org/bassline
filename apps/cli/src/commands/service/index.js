import { Command } from 'commander'
import { command as newService } from './new.js'
import { command as listServices } from './ls.js'

export const service = new Command('service').description('Manage project services')

service.command('new').description('Define a new service').action(newService)
service.command('ls').description('List project services').action(listServices)
