/**
 * Example showing how boundary cells mark module interfaces
 */

import { Network } from './src/network'
import { MaxCell, MinCell } from './src/cells/basic'
import { AddFunction } from './src/functions/basic'
import { num } from './src/types'

// Helper to create constant sources
class ConstantCell extends MaxCell {
  constructor(id: string, value: number) {
    super(id)
    this.setOutput("default", num(value))
  }
  compute() {} // Constants don't compute
}

// Create a reusable module with clear boundaries
class AdderModule extends Network {
  // Expose boundaries for external use
  public inputA: MaxCell
  public inputB: MaxCell
  public output: MaxCell
  
  constructor(id: string) {
    super(id)
    
    // Create boundary cells (public interface)
    this.inputA = new MaxCell(`${id}_inputA`)
    this.inputB = new MaxCell(`${id}_inputB`)
    this.output = new MaxCell(`${id}_output`)
    
    // Mark them as boundaries
    this.addBoundary(this.inputA)
    this.addBoundary(this.inputB)
    this.addBoundary(this.output)
    
    // Internal implementation (private)
    const adder = new AddFunction(`${id}_internal_adder`)
    adder.connectFrom('a', this.inputA)
    adder.connectFrom('b', this.inputB)
    this.output.connectFrom(adder)
    
    // Add internal gadget (not a boundary)
    this.addGadget(adder)
  }
}

console.log("=== Boundary Example ===\n")

// Create an adder module
const adderModule = new AdderModule("adder1")

// Connect to its boundaries from outside
const source1 = new ConstantCell("source1", 10)
const source2 = new ConstantCell("source2", 5)

// Connect to the module's public interface
adderModule.inputA.connectFrom(source1)
adderModule.inputB.connectFrom(source2)

// Create a parent network
const mainNetwork = new Network("main")
mainNetwork.addGadget(source1)
mainNetwork.addGadget(source2)
mainNetwork.addGadget(adderModule)

// Propagate
mainNetwork.propagate()

console.log("Module output:", adderModule.output.getOutput())

// Show which cells are boundaries
console.log("\nBoundary cells in adder module:")
const boundaries = adderModule.getBoundaries()
for (const boundary of boundaries) {
  console.log(`  - ${boundary.id} (boundary=${boundary.isBoundary()})`)
}

console.log("\nNon-boundary gadgets in adder module:")
for (const gadget of adderModule.gadgets) {
  if (!('isBoundary' in gadget) || !(gadget as any).isBoundary()) {
    console.log(`  - ${gadget.id}`)
  }
}

console.log("\n=== Key Points ===")
console.log("1. Boundary cells are marked with boundary=true")
console.log("2. This is just metadata - no enforcement")
console.log("3. Helps document module interfaces")
console.log("4. Monotonic - once a boundary, always a boundary")
console.log("5. Makes modules more reusable and clear")