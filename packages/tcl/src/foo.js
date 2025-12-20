import { Runtime } from './parser.js'
import { std } from './libs/std.js'
import { string } from './libs/string.js'

export const foo = Runtime.withLibs(std, string)

const script = `

set x {a b c d e f}
set y hello

puts [string concat hello $x]
puts $x(3)

`
foo.run(script)
