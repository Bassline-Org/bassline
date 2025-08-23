/**
 * Network - A Cell that contains gadgets and wires
 * 
 * Networks are themselves semi-lattices that only grow (union operation).
 * Multiple networks can be merged together.
 */

import { Cell } from './cell'
import { Gadget } from './gadget'
import { LatticeValue } from './types'

export class Network extends Cell {
  gadgets: Set<Gadget> = new Set()  // Strong references to prevent GC (includes child networks!)
  
  constructor(id: string = "network") {
    super(id)
  }
  
  // Network's lattice operation is UNION - networks only grow!
  latticeOp(): LatticeValue {
    // Networks merge by combining their gadgets
    // For simplicity, we'll return a summary
    return { type: "string", value: `network-${this.id}[${this.gadgets.size} gadgets]` }
  }
  
  // Add a gadget to the network (holds strong reference)
  addGadget(gadget: Gadget): void {
    this.gadgets.add(gadget)
  }
  
  // Add multiple gadgets at once
  add(...gadgets: Gadget[]): this {
    for (const gadget of gadgets) {
      this.addGadget(gadget)
    }
    return this
  }
  
  // Helper to connect gadgets (no more wires!)
  connect(source: Gadget, target: Gadget, options?: {
    sourceOutput?: string,
    targetInput?: string  // For functions
  }): void {
    const outputName = options?.sourceOutput ?? "default"
    
    // Handle connection based on target type
    if ('connectFrom' in target && !options?.targetInput) {
      // Target is a Cell - can have many inputs
      (target as any).connectFrom(source, outputName)
    } else if ('connectFrom' in target && options?.targetInput) {
      // Target is a Function - needs specific input name
      (target as any).connectFrom(options.targetInput, source, outputName)
    } else {
      throw new Error("Target must be a Cell or Function with connectFrom method")
    }
  }
  
  // Override compute for compatibility
  compute(): void {
    // With new propagation protocol, we don't need centralized propagation
    // Just update our output summary
    this.setOutput("default", { 
      type: "string", 
      value: `network[${this.gadgets.size} gadgets]` 
    }, false)  // Don't auto-emit to avoid loops
  }
  
  // Start propagation by computing all gadgets once
  // The new protocol handles propagation automatically
  propagate(): void {
    // Just compute each gadget once to kick off propagation
    // The accept/emit protocol will handle the rest
    for (const gadget of this.gadgets) {
      if (gadget === this) continue  // Skip ourselves
      gadget.compute()
    }
  }
  
  // Merge another network into this one (true UNION - flattens everything)
  mergeNetwork(other: Network): void {
    // Union of all gadgets (strong refs maintained)
    for (const gadget of other.gadgets) {
      this.gadgets.add(gadget)
    }
  }
  
  // Add a child network (explicit nesting - just add it as a gadget!)
  addChildNetwork(child: Network): void {
    // Networks are gadgets, so just add it
    this.gadgets.add(child)
  }
  
  // Get all boundary cells in this network
  getBoundaries(): Cell[] {
    const boundaries: Cell[] = []
    for (const gadget of this.gadgets) {
      // Import Cell type to check instanceof
      if ('isBoundary' in gadget && (gadget as any).isBoundary()) {
        boundaries.push(gadget as any)
      }
    }
    return boundaries
  }
  
  // Helper to create and mark a boundary cell
  addBoundary(cell: Cell): void {
    cell.makeBoundary()
    this.addGadget(cell)
  }
  
  // Debug helper
  printState(indent: string = ""): void {
    console.log(`${indent}=== Network: ${this.id} ===`)
    console.log(`${indent}Gadgets: ${this.gadgets.size}`)
    
    // Print all gadgets
    for (const gadget of this.gadgets) {
      if (gadget === this) continue  // Don't print ourselves
      
      if (gadget instanceof Network) {
        // Child network - recurse with indentation
        console.log(`${indent}  [Child Network]`)
        gadget.printState(indent + "    ")
      } else {
        // Regular gadget
        console.log(`${indent}  ${gadget.id}: ${JSON.stringify(gadget.getOutput("default"))}`)
      }
    }
    
    console.log(`${indent}===================`)
  }
}