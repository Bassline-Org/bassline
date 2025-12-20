/**
 * @bassline/tcl - Tcl-style scripting for Bassline
 *
 * A minimal Tcl interpreter for inspector scripting areas.
 *
 * Usage:
 *   import { createInterpreter } from '@bassline/tcl'
 *   import { loadStandardCommands } from '@bassline/tcl/commands'
 *   import { loadBasslineCommands } from '@bassline/tcl/bassline'
 *
 *   const interp = createInterpreter()
 *   loadStandardCommands(interp)
 *   loadBasslineCommands(interp, bl)
 *
 *   interp.run('get [uri bl:///cells/counter]')
 */

export { createInterpreter, parseScript, parseTclList } from './tcl.js'
export { loadStandardCommands, createVariableCommands } from './commands.js'
export { loadBasslineCommands, createBasslineCommands } from './bassline.js'
