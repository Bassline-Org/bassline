/**
 * @bassline/tcl - Tcl-inspired shell for Bassline
 *
 * A minimal scripting layer using / as namespace separator.
 */

export { TT, tokenize, RC } from './tok.js'
export { TclError } from './error.js'
export { Runtime } from './runtime.js'
export { createShell } from './shell.js'

// Standard libraries
export { std } from './libs/std.js'
export { string } from './libs/string.js'
export { namespace } from './libs/namespace.js'
export { list, parseList, formatList } from './libs/list.js'
export { dict, dictCmd, parseDict, formatDict } from './libs/dict.js'
export * from './helpers.js'
export { event } from './libs/event.js'
export { info } from './libs/info.js'
export { createChanCommands, setupChannels } from './libs/chan.js'
export { Channel, ChannelRegistry, createStdChannels, createStringChannel } from './channel.js'
export { expr } from './expr.js'
export { globToRegex } from './glob.js'
