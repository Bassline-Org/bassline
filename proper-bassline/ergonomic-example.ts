/**
 * Example showing the improved ergonomic API
 */

import { Network } from './src/network'
import { MaxCell, MinCell, OrCell } from './src/cells/basic'
import { AddFunction, SubtractFunction, GateFunction } from './src/functions/basic'
import { num, bool, isNumber } from './src/types'

// Helper for constants
class Const extends MaxCell {
  constructor(id: string, value: any) {
    super(id)
    this.setOutput("default", value)
  }
  compute() {}
}

console.log("=== Ergonomic API Examples ===\n")

// Create network
const network = new Network("main")

// === Example 1: Chainable Cell connections ===
console.log("1. Chainable Cell connections:")

const source1 = new Const("s1", num(10))
const source2 = new Const("s2", num(5))
const source3 = new Const("s3", num(7))

// Old way (still works):
// const max = new MaxCell("max")
// max.connectFrom(source1)
// max.connectFrom(source2)
// max.connectFrom(source3)

// New way - chainable!
const max = new MaxCell("max").from(source1, source2, source3)

network.add(source1, source2, source3, max)  // Variadic add!
network.propagate()

console.log(`  Max of [10, 5, 7] = ${JSON.stringify(max.getOutput())}`)

// === Example 2: Function connection object ===
console.log("\n2. Function connection object:")

// Old way:
// const adder = new AddFunction("add")
// adder.connectFrom("a", max)
// adder.connectFrom("b", new Const("ten", num(10)))

// New way - single object!
const ten = new Const("ten", num(10))
const adder = new AddFunction("add").connect({
  a: max,
  b: ten
})

network.add(ten, adder)
network.propagate()

console.log(`  ${JSON.stringify(max.getOutput())} + 10 = ${JSON.stringify(adder.getOutput())}`)

// === Example 3: Type guards for safer access ===
console.log("\n3. Type guards for safer access:")

const result = adder.getOutput()
if (isNumber(result)) {
  // TypeScript knows result.value is a number!
  console.log(`  Result * 2 = ${result.value * 2}`)
} else {
  console.log(`  Result is not a number`)
}

// === Example 4: Complex wiring made simple ===
console.log("\n4. Complex wiring made simple:")

const boolSource1 = new Const("b1", bool(true))
const boolSource2 = new Const("b2", bool(false))
const boolSource3 = new Const("b3", bool(true))

// Chain multiple operations
const orGate = new OrCell("or").from(boolSource1, boolSource2, boolSource3)
const gate = new GateFunction("gate").connect({
  control: orGate,
  value: adder
})

network.add(boolSource1, boolSource2, boolSource3, orGate, gate)
network.propagate()

console.log(`  Gate output: ${JSON.stringify(gate.getOutput())}`)

// === Example 5: Network method chaining ===
console.log("\n5. Network method chaining:")

const network2 = new Network("chain-example")
  .add(
    new Const("x", num(1)),
    new Const("y", num(2)),
    new MaxCell("max2").from(
      new Const("a", num(3)),
      new Const("b", num(4))
    )
  )

network2.propagate()
console.log(`  Network2 has ${network2.gadgets.size} gadgets`)

console.log("\n=== Benefits ===")
console.log("✓ Less verbose - chain methods instead of separate statements")
console.log("✓ Type safe - TypeScript knows value types with guards")
console.log("✓ Intuitive - connect({ a: x, b: y }) is self-documenting")
console.log("✓ Flexible - old API still works, new API is optional")