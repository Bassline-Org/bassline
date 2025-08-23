/**
 * FunctionGadget - Fixed-arity function on lattice values
 * 
 * Functions have fixed, named inputs (keyword arguments).
 * Each input can only have ONE connection.
 * Operations don't need to be ACI.
 * 
 * Uses WeakRefs for connections to prevent memory leaks.
 */

import { Gadget, Connection, LatticeValue, nil } from './types'

export abstract class FunctionGadget extends Gadget {
  inputs: Map<string, Connection> = new Map()
  inputNames: string[]
  
  // The function to apply - takes named arguments
  abstract fn(args: Record<string, LatticeValue>): LatticeValue
  
  constructor(id: string, inputNames: string[]) {
    super(id)
    this.inputNames = inputNames
  }
  
  // Connect from a source gadget to a named input (only ONE connection per input!)
  connectFrom(inputName: string, source: Gadget, outputName: string = "default"): void {
    if (!this.inputNames.includes(inputName)) {
      throw new Error(`Unknown input: ${inputName}. Expected one of: ${this.inputNames.join(', ')}`)
    }
    
    // Only ONE connection per input!
    if (this.inputs.has(inputName)) {
      console.warn(`Replacing existing connection for input '${inputName}'`)
    }
    
    this.inputs.set(inputName, {
      source: new WeakRef(source),
      outputName
    })
  }
  
  // Connect multiple inputs at once (ergonomic!)
  connect(inputs: Record<string, Gadget>): this {
    for (const [name, source] of Object.entries(inputs)) {
      this.connectFrom(name, source)
    }
    return this
  }
  
  // Disconnect a named input
  disconnectInput(inputName: string): void {
    this.inputs.delete(inputName)
  }
  
  // Compute by applying function to named inputs
  compute(): void {
    // Collect all input values by name
    const args: Record<string, LatticeValue> = {}
    const deadInputs: string[] = []
    
    for (const name of this.inputNames) {
      const conn = this.inputs.get(name)
      if (conn) {
        const source = conn.source.deref()
        if (source) {
          args[name] = source.getOutput(conn.outputName)
        } else {
          // Source was garbage collected
          deadInputs.push(name)
          args[name] = nil()
        }
      } else {
        // Missing input = null
        args[name] = nil()
      }
    }
    
    // Clean up dead connections
    for (const name of deadInputs) {
      this.inputs.delete(name)
    }
    
    // Apply function
    const result = this.fn(args)
    
    // Set output
    this.setOutput("default", result)
  }
  
  // Check if all required inputs are connected and alive
  hasAllInputs(): boolean {
    return this.inputNames.every(name => {
      const conn = this.inputs.get(name)
      if (!conn) return false
      const source = conn.source.deref()
      return source !== undefined
    })
  }
}