import { Command } from 'commander'
import { command as newProtocol } from './new.js'
import { command as editProtocol } from './edit.js'
import { command as deleteProtocol } from './delete.js'
import { command as listProtocols } from './ls.js'

export const protocol = new Command('protocol').description('Manage project protocol definitions')

protocol.command('new').description('Define a new protocol').action(newProtocol)
protocol.command('edit').description('Edit an existing protocol').action(editProtocol)
protocol.command('delete').description('Delete a protocol').action(deleteProtocol)
protocol.command('ls').description('List protocols with resolved selectors').action(listProtocols)
