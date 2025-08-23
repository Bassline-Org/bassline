/**
 * Calculator application using Cells and Functions
 */

import { Cell } from '../cell'
import { FunctionGadget } from '../function'
import { AddFunction, SubtractFunction, MultiplyFunction, DivideFunction } from '../functions/basic'
import { MaxCell } from '../cells/basic'
import { LatticeValue, num, nil, isNumber, isNull } from '../types'

// Calculator display - shows the latest value
export class DisplayCell extends Cell {
  private history: LatticeValue[] = []
  
  latticeOp(...values: LatticeValue[]): LatticeValue {
    // Keep the most recent non-null value
    for (const v of values) {
      if (v.type !== 'null') {
        this.history.push(v)
      }
    }
    
    return this.history.length > 0 
      ? this.history[this.history.length - 1]
      : nil()
  }
  
  clear() {
    this.history = []
    this.setOutput('default', nil())
  }
}

// Input cell - accepts user input
export class InputCell extends Cell {
  private currentValue: number = 0
  
  latticeOp(...values: LatticeValue[]): LatticeValue {
    // Just take the last number
    const numbers = values.filter(isNumber)
    if (numbers.length > 0) {
      this.currentValue = numbers[numbers.length - 1].value
      return numbers[numbers.length - 1]
    }
    return num(this.currentValue)
  }
  
  setValue(value: number) {
    this.currentValue = value
    this.setOutput('default', num(value))
  }
}

// Memory cell - stores a value
export class MemoryCell extends MaxCell {
  store(value: LatticeValue) {
    this.setOutput('default', value)
  }
  
  recall(): LatticeValue {
    return this.outputs.get('default') || nil()
  }
  
  clear() {
    this.setOutput('default', nil())
  }
}

// Calculator state machine
export class CalculatorStateMachine {
  display: DisplayCell
  inputA: InputCell
  inputB: InputCell
  memory: MemoryCell
  
  // Operations
  adder: AddFunction
  subtractor: SubtractFunction
  multiplier: MultiplyFunction
  divider: DivideFunction
  
  // Current operation
  currentOp: FunctionGadget | null = null
  
  constructor(idPrefix: string = 'calc') {
    // Create cells
    this.display = new DisplayCell(`${idPrefix}-display`)
    this.inputA = new InputCell(`${idPrefix}-inputA`)
    this.inputB = new InputCell(`${idPrefix}-inputB`)
    this.memory = new MemoryCell(`${idPrefix}-memory`)
    
    // Create operations
    this.adder = new AddFunction(`${idPrefix}-add`)
    this.subtractor = new SubtractFunction(`${idPrefix}-sub`)
    this.multiplier = new MultiplyFunction(`${idPrefix}-mul`)
    this.divider = new DivideFunction(`${idPrefix}-div`)
    
    // Wire operations to inputs
    this.adder.connect({ a: this.inputA, b: this.inputB })
    this.subtractor.connect({ minuend: this.inputA, subtrahend: this.inputB })
    this.multiplier.connect({ a: this.inputA, b: this.inputB })
    this.divider.connect({ dividend: this.inputA, divisor: this.inputB })
    
    // Display shows input A by default
    this.display.from(this.inputA)
  }
  
  // User actions
  enterNumber(digit: number) {
    const current = this.inputA.outputs.get('default') || nil()
    const currentNum = isNumber(current) ? current.value : 0
    this.inputA.setValue(currentNum * 10 + digit)
  }
  
  setOperation(op: '+' | '-' | '*' | '/') {
    // Move input A to input B
    const aValue = this.inputA.outputs.get('default') || nil()
    if (!isNull(aValue)) {
      this.inputB.setValue(isNumber(aValue) ? aValue.value : 0)
      this.inputA.setValue(0)
    }
    
    // Set current operation and wire display
    this.display.inputs.clear()
    
    switch (op) {
      case '+':
        this.currentOp = this.adder
        this.display.from(this.adder)
        break
      case '-':
        this.currentOp = this.subtractor
        this.display.from(this.subtractor)
        break
      case '*':
        this.currentOp = this.multiplier
        this.display.from(this.multiplier)
        break
      case '/':
        this.currentOp = this.divider
        this.display.from(this.divider)
        break
    }
  }
  
  equals() {
    // Display already shows the result, just clear for next calculation
    if (this.currentOp) {
      const result = this.currentOp.outputs.get('default')
      if (result && isNumber(result)) {
        this.inputA.setValue(result.value)
        this.inputB.setValue(0)
      }
    }
    this.currentOp = null
    this.display.inputs.clear()
    this.display.from(this.inputA)
  }
  
  clear() {
    this.inputA.setValue(0)
    this.inputB.setValue(0)
    this.display.clear()
    this.currentOp = null
    this.display.inputs.clear()
    this.display.from(this.inputA)
  }
  
  // Memory operations
  memoryStore() {
    const displayValue = this.display.outputs.get('default') || nil()
    if (!isNull(displayValue)) {
      this.memory.store(displayValue)
    }
  }
  
  memoryRecall() {
    const memValue = this.memory.recall()
    if (isNumber(memValue)) {
      this.inputA.setValue(memValue.value)
    }
  }
  
  memoryClear() {
    this.memory.clear()
  }
  
  // Get all gadgets for adding to network
  getAllGadgets() {
    return [
      this.display,
      this.inputA,
      this.inputB,
      this.memory,
      this.adder,
      this.subtractor,
      this.multiplier,
      this.divider
    ]
  }
}