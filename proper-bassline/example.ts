/**
 * Example demonstrating the core distinction:
 * - Cells handle multiple writers via lattice joins
 * - Functions need exact wiring with named arguments
 */

import { Network } from './src/network'
import { MaxCell, OrCell, MinCell } from './src/cells/basic'
import { AddFunction, SubtractFunction, GateFunction, GreaterThanFunction } from './src/functions/basic'
import { num, bool } from './src/types'

// Create network
const network = new Network()

// ============================================
// Example 1: Multiple writers to a Cell
// ============================================

console.log("=== Example 1: Multiple writers to MaxCell ===")

// Create value sources
class ConstantGadget extends MaxCell {
  constructor(id: string, value: number) {
    super(id)
    this.setOutput("default", num(value))
  }
  compute() {} // Constants don't compute
}

const source1 = new ConstantGadget("source1", 5)
const source2 = new ConstantGadget("source2", 3)
const source3 = new ConstantGadget("source3", 7)

// Create a MaxCell that accepts multiple inputs
const maxCell = new MaxCell("maxCell")

// Multiple writers connect to the same cell!
maxCell.connectFrom(source1)
maxCell.connectFrom(source2)
maxCell.connectFrom(source3)

// Add to network
network.addGadget(source1)
network.addGadget(source2)
network.addGadget(source3)
network.addGadget(maxCell)

// Propagate
network.propagate()
console.log(`Max of [5, 3, 7] = ${JSON.stringify(maxCell.getOutput())}`)
// Output: {"type":"number","value":7}

// ============================================
// Example 2: Functions need exact wiring
// ============================================

console.log("\n=== Example 2: Functions require exact wiring ===")

// Create an adder function
const adder = new AddFunction("adder")

// Functions need specific named inputs
adder.connectFrom("a", maxCell)  // Use max as first input
adder.connectFrom("b", new ConstantGadget("const10", 10))  // Add 10

network.addGadget(adder)
network.propagate()
console.log(`${JSON.stringify(maxCell.getOutput())} + 10 = ${JSON.stringify(adder.getOutput())}`)
// Output: 7 + 10 = 17

// ============================================
// Example 3: Gate with control flow
// ============================================

console.log("\n=== Example 3: Gate function with control ===")

// Create comparison: is max > 5?
const comparator = new GreaterThanFunction("comparator")
comparator.connectFrom("left", maxCell)
comparator.connectFrom("right", new ConstantGadget("const5", 5))

// Create gate that only passes value if control is true
const gate = new GateFunction("gate")
gate.connectFrom("control", comparator)  // Control from comparison
gate.connectFrom("value", adder)         // Value from adder

network.addGadget(comparator)
network.addGadget(gate)
network.propagate()

console.log(`Is ${JSON.stringify(maxCell.getOutput())} > 5? ${JSON.stringify(comparator.getOutput())}`)
console.log(`Gate output (passes 17 if true): ${JSON.stringify(gate.getOutput())}`)

// ============================================
// Example 4: Multiple cells can merge
// ============================================

console.log("\n=== Example 4: Cells naturally merge inputs ===")

// Create OR cell with multiple boolean inputs
const bool1 = new ConstantGadget("bool1", 0)
bool1.setOutput("default", bool(false))

const bool2 = new ConstantGadget("bool2", 0)
bool2.setOutput("default", bool(true))

const bool3 = new ConstantGadget("bool3", 0)
bool3.setOutput("default", bool(false))

const orCell = new OrCell("orCell")
orCell.connectFrom(bool1)
orCell.connectFrom(bool2)
orCell.connectFrom(bool3)

network.addGadget(bool1)
network.addGadget(bool2)
network.addGadget(bool3)
network.addGadget(orCell)
network.propagate()

console.log(`OR of [false, true, false] = ${JSON.stringify(orCell.getOutput())}`)
// Output: {"type":"bool","value":true}

// ============================================
// Example 5: Show that subtraction is NOT commutative
// ============================================

console.log("\n=== Example 5: Functions preserve argument order ===")

const subtract1 = new SubtractFunction("subtract1")
subtract1.connectFrom("minuend", new ConstantGadget("ten", 10))
subtract1.connectFrom("subtrahend", new ConstantGadget("three", 3))

const subtract2 = new SubtractFunction("subtract2")
subtract2.connectFrom("minuend", new ConstantGadget("three2", 3))
subtract2.connectFrom("subtrahend", new ConstantGadget("ten2", 10))

network.addGadget(subtract1)
network.addGadget(subtract2)
network.propagate()

console.log(`10 - 3 = ${JSON.stringify(subtract1.getOutput())}`)
console.log(`3 - 10 = ${JSON.stringify(subtract2.getOutput())}`)
console.log("Order matters for functions!")

// ============================================
// Summary
// ============================================

console.log("\n=== Summary ===")
console.log("1. Cells (MaxCell, OrCell) handle multiple writers naturally")
console.log("2. Functions (AddFunction, GateFunction) need exact named inputs")
console.log("3. Cells implement idempotent operations (max(a,a) = a)")
console.log("4. Functions can be non-commutative (a - b ≠ b - a)")
console.log("5. Network converges to fixpoint through propagation")