import pc from 'picocolors'

export const log = (msg = '') => console.log(msg)
export const success = msg => console.log(pc.green('✓') + ' ' + msg)
export const error = msg => console.error(pc.red('error:') + ' ' + msg)
export const warn = msg => console.log(pc.yellow('warn:') + ' ' + msg)
export const info = msg => console.log(pc.dim(msg))
export const heading = msg => console.log(pc.bold(msg))
export const item = msg => console.log('  ' + msg)
export const label = (name, value) => console.log('  ' + pc.dim(name) + ' ' + value)
