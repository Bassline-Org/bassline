/**
 * FunctionNode - Rete component for visualizing FunctionGadget
 * 
 * Displays functions with:
 * - Named input sockets based on function.inputNames
 * - Single output socket
 * - Current output value
 * - Function type label
 */

import { ClassicPreset } from 'rete'
import type { FunctionGadget } from 'proper-bassline/src/function'
import type { LatticeValue } from 'proper-bassline/src/types'
import { ValueSocket, ValueControl } from './CellNode'
import { ReactControl } from './CustomControl'
import { ValueDisplay } from './ValueDisplay'

export class FunctionNode extends ClassicPreset.Node {
  gadgetId: string
  functionType: string
  currentValue: LatticeValue | null = null
  
  constructor(gadget: FunctionGadget) {
    const functionName = gadget.id.split('/').pop() || gadget.id
    super(functionName)
    
    this.gadgetId = gadget.id
    this.functionType = gadget.constructor.name
    
    // Add named input sockets
    for (const inputName of gadget.inputNames) {
      this.addInput(
        inputName,
        new ClassicPreset.Input(new ValueSocket(), inputName)
      )
    }
    
    // Add output socket
    this.addOutput('output', new ClassicPreset.Output(new ValueSocket(), 'Output'))
    
    // Add value display control - using React component
    this.addControl('value', new ReactControl(ValueDisplay, { cell: gadget }))
    
    // Store current value
    this.currentValue = gadget.getOutput()
  }
  
  data() {
    return {
      gadgetId: this.gadgetId,
      functionType: this.functionType
    }
  }
}

/**
 * Legacy control to display function output
 */
export class FunctionValueControl extends ValueControl {
  private gadget: FunctionGadget
  
  constructor(gadget: FunctionGadget) {
    super(gadget as any) // FunctionGadget doesn't extend Cell but has getOutput
    this.gadget = gadget
  }
  
  updateValue() {
    const output = this.gadget.getOutput()
    this.value = this.formatValue(output)
  }
  
  private formatValue(value: LatticeValue | null): string {
    if (!value) return 'nil'
    
    switch (value.type) {
      case 'number':
        return String(value.value)
      case 'string':
        return `"${value.value}"`
      case 'boolean':
        return value.value ? 'true' : 'false'
      case 'set':
        const items = Array.from(value.value as Set<any>)
          .map(v => this.formatValue(v))
          .join(', ')
        return `{${items}}`
      case 'array':
        const elements = (value.value as any[])
          .map(v => this.formatValue(v))
          .join(', ')
        return `[${elements}]`
      case 'dict':
        const entries = Array.from((value.value as Map<string, any>).entries())
          .map(([k, v]) => `${k}: ${this.formatValue(v)}`)
          .join(', ')
        return `{${entries}}`
      default:
        return JSON.stringify(value.value)
    }
  }
}