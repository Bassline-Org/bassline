/**
 * FunctionGadget - Fixed-arity function on lattice values
 * 
 * Functions have fixed, named inputs (keyword arguments).
 * Each input can only have ONE connection.
 * Operations don't need to be ACI.
 * 
 * Uses WeakRefs for connections to prevent memory leaks.
 */

import { Gadget } from './gadget'
import type { Connection } from './types'
import { LatticeValue, nil, serialize } from './types'
import type { GadgetBase } from './gadget-base'

export abstract class FunctionGadget extends Gadget {
  inputs: Map<string, Connection> = new Map()
  inputNames: string[]
  currentValues: Map<string, LatticeValue> = new Map()
  
  // The function to apply - takes named arguments
  abstract fn(args: Record<string, LatticeValue>): LatticeValue
  
  constructor(id: string, inputNames: string[]) {
    super(id)
    this.inputNames = inputNames
  }
  
  /**
   * Accept information from upstream
   * Functions store values and compute when ready
   */
  accept(value: LatticeValue, source: GadgetBase, inputName?: string): void {
    if (!inputName) {
      console.warn(`Function ${this.id} received value without input name`)
      return
    }
    
    // Store the value
    this.currentValues.set(inputName, value)
    
    // Check if we have all inputs to compute
    if (this.hasAllValues()) {
      this.computeFunction()
    }
  }
  
  // Check if we have values for all inputs
  private hasAllValues(): boolean {
    return this.inputNames.every(name => this.currentValues.has(name))
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
    
    // Register for downstream emissions
    source.addDownstream(this, inputName)
    
    // Pull initial value
    this.accept(source.getOutput(outputName), source, inputName)
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
  
  // Private method to compute function
  private computeFunction(): void {
    // Build args from current values
    const args: Record<string, LatticeValue> = {}
    for (const name of this.inputNames) {
      args[name] = this.currentValues.get(name) ?? nil()
    }
    
    // Apply function
    const result = this.fn(args)
    
    // Set output (will auto-emit if changed)
    this.setOutput("default", result)
  }
  
  // Legacy compute for compatibility
  compute(): void {
    // Collect all input values by name
    const deadInputs: string[] = []
    
    for (const name of this.inputNames) {
      const conn = this.inputs.get(name)
      if (conn) {
        const source = conn.source.deref()
        if (source) {
          this.currentValues.set(name, source.getOutput(conn.outputName))
        } else {
          // Source was garbage collected
          deadInputs.push(name)
          this.currentValues.set(name, nil())
        }
      } else {
        // Missing input = null
        this.currentValues.set(name, nil())
      }
    }
    
    // Clean up dead connections
    for (const name of deadInputs) {
      this.inputs.delete(name)
    }
    
    // Compute if we have all values
    if (this.hasAllValues()) {
      this.computeFunction()
    }
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
  
  // Serialize function to JSON
  serialize(): any {
    const base = super.serialize()
    
    // Add function-specific data
    base.type = 'function'
    base.inputNames = this.inputNames
    
    // Serialize connections (as IDs)
    base.inputs = {}
    for (const [name, conn] of this.inputs) {
      const source = conn.source.deref()
      if (source) {
        base.inputs[name] = {
          sourceId: source.id,
          outputName: conn.outputName
        }
      }
    }
    
    // Store current values
    base.currentValues = {}
    for (const [name, value] of this.currentValues) {
      base.currentValues[name] = value ? serialize(value) : null
    }
    
    return base
  }
}