import { Runtime } from './runtime.js'
import { std } from './libs/std.js'
import { string } from './libs/string.js'
import { namespace } from './libs/namespace.js'
import { list } from './libs/list.js'
import { dictCmd } from './libs/dict.js'
import { event } from './libs/event.js'
import { info } from './libs/info.js'

// Create runtime with standard libs
const rt = new Runtime()
for (const [name, fn] of Object.entries({ ...std, ...string, ...namespace, ...list, ...dictCmd, ...event, ...info })) {
  rt.register(name, fn)
}

console.log('=== Testing expr ===')
rt.run(`
  puts "1 + 2 * 3 = [expr {1 + 2 * 3}]"
  puts "2 ** 3 ** 2 = [expr {2 ** 3 ** 2}]"
  puts "5 > 3 ? yes : no = [expr {5 > 3 ? "yes" : "no"}]"
`)

console.log('\n=== Testing for loop ===')
rt.run(`
  set sum 0
  for {set i 1} {$i <= 10} {incr i} {
    set sum [expr {$sum + $i}]
  }
  puts "Sum 1-10: $sum"
`)

console.log('\n=== Testing info exists ===')
rt.run(`
  set myvar 42
  puts "myvar exists: [info exists myvar]"
  puts "novar exists: [info exists novar]"
`)

console.log('\n=== Testing info vars ===')
rt.run(`
  set foo 1
  set bar 2
  set baz 3
  puts "All vars: [info vars]"
  puts "Vars matching b*: [info vars b*]"
`)

console.log('\n=== Testing info commands ===')
rt.run(`
  puts "Commands matching set*: [info commands set*]"
  puts "Commands matching *list*: [info commands *list*]"
`)

console.log('\n=== Testing proc introspection ===')
rt.run(`
  proc greet {name greeting} {
    return "$greeting, $name!"
  }

  puts "Procs: [info procs]"
  puts "Args of greet: [info args greet]"
  puts "Body of greet: [info body greet]"
  puts "Calling greet: [greet World Hello]"
`)

console.log('\n=== Testing info level ===')
rt.run(`
  proc inner {} {
    puts "  Inner level: [info level]"
  }
  proc outer {} {
    puts " Outer level: [info level]"
    inner
  }
  puts "Top level: [info level]"
  outer
`)

console.log('\n=== Testing info complete ===')
rt.run(`
  puts "Complete script: [info complete {set x 1}]"
`)
// Test incomplete separately since it contains unbalanced braces
console.log('Incomplete script:', rt.getCmd('info')(['complete', 'set x {'], rt))

console.log('\n=== Testing info version ===')
rt.run(`
  puts "Tcl version: [info tclversion]"
  puts "Patch level: [info patchlevel]"
`)

console.log('\n=== All tests passed! ===')
