/**
 * Example showing that Networks are Cells - they can be merged!
 * Merging is a true UNION (flattens), while nesting is explicit.
 */

import { Network } from './src/network'
import { MaxCell } from './src/cells/basic'
import { num } from './src/types'
import { NestFunction } from './src/functions/nest'

// Helper to create constant sources
class ConstantCell extends MaxCell {
  constructor(id: string, value: number) {
    super(id)
    this.setOutput("default", num(value))
  }
  compute() {} // Constants don't compute
}

console.log("=== Networks are Cells - They Can Merge! ===\n")

// Create first network with some computation
const network1 = new Network("network1")
const a = new ConstantCell("a", 5)
const b = new ConstantCell("b", 3)
const max1 = new MaxCell("max1")
max1.connectFrom(a)
max1.connectFrom(b)

network1.addGadget(a)
network1.addGadget(b)
network1.addGadget(max1)
network1.propagate()

console.log("Network 1 state:")
network1.printState()

// Create second network with different computation
const network2 = new Network("network2")
const c = new ConstantCell("c", 10)
const d = new ConstantCell("d", 7)
const max2 = new MaxCell("max2")
max2.connectFrom(c)
max2.connectFrom(d)

network2.addGadget(c)
network2.addGadget(d)
network2.addGadget(max2)
network2.propagate()

console.log("Network 2 state:")
network2.printState()

// === Example 1: Merging (true UNION - flattens) ===
console.log("=== MERGING: True lattice operation (UNION) ===\n")

const mergedNetwork = new Network("merged")
mergedNetwork.mergeNetwork(network1)
mergedNetwork.mergeNetwork(network2)

console.log("Merged network (everything flattened):")
mergedNetwork.printState()

// === Example 2: Nesting (explicit hierarchy) ===
console.log("\n=== NESTING: Explicit function (not lattice) ===\n")

const parentNetwork = new Network("parent")
const nestFunc = new NestFunction("nester")

// Use the function to explicitly nest
nestFunc.nestNetworks(parentNetwork, network1)
nestFunc.nestNetworks(parentNetwork, network2)

console.log("Parent network with nested children:")
parentNetwork.printState()

// === Example 3: Cross-network connections ===
console.log("\n=== Cross-network connections ===\n")

// In the merged network, we can directly connect
const globalMax = new MaxCell("globalMax")
globalMax.connectFrom(max1)  // From original network1
globalMax.connectFrom(max2)  // From original network2

mergedNetwork.addGadget(globalMax)
mergedNetwork.propagate()

console.log("Merged network with cross-connection:")
mergedNetwork.printState()

console.log("\n=== Key Insights ===")
console.log("1. MERGE is a true lattice operation (UNION) - flattens everything")
console.log("2. NEST is a function operation - creates explicit hierarchy")
console.log("3. Merge is commutative: merge(A,B) = merge(B,A)")
console.log("4. Nest is NOT commutative: nest(A,B) ≠ nest(B,A)")
console.log("5. This distinction keeps our lattice properties clean!")