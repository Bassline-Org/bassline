/**
 * Basic Functions - Fixed-arity operations on lattice values
 * 
 * These are NOT lattice operations (not idempotent).
 * They require exact wiring with named inputs.
 */

import { FunctionGadget, FunctionGadgetArgs } from '../function'
import { LatticeValue, num, bool, nil, getValue, LatticeNumber, LatticeBool } from '../lattice-types'

// Addition - NOT idempotent (a + a ≠ a)
type NumericFunctionArgs = {a: LatticeNumber, b: LatticeNumber}

export class AddFunction extends FunctionGadget<NumericFunctionArgs> {
  constructor(id: string) {
    super(id, ['a', 'b'])
  }
  
  fn(args: NumericFunctionArgs): LatticeValue {
    const a = args['a']
    const b = args['b']
    
    if (a.type !== "number" || b.type !== "number") return nil()
    return num(getValue(a) + getValue(b))
  }
}

// Multiplication - NOT idempotent (a * a ≠ a)
export class MultiplyFunction extends FunctionGadget<NumericFunctionArgs> {
  constructor(id: string) {
    super(id, ['a', 'b'])
  }
  
  fn(args: NumericFunctionArgs): LatticeValue {
    const a = args['a']
    const b = args['b']
    
    if (a.type !== "number" || b.type !== "number") return nil()
    return num(getValue(a) * getValue(b))
  }
}

// Subtraction - NOT commutative or idempotent
type SubtractiveFunctionArgs = {minuend: LatticeNumber, subtrahend: LatticeNumber}
export class SubtractFunction extends FunctionGadget<SubtractiveFunctionArgs> {
  constructor(id: string) {
    super(id, ['minuend', 'subtrahend'])
  }
  
  fn(args: SubtractiveFunctionArgs): LatticeValue {
    const minuend = args['minuend']
    const subtrahend = args['subtrahend']
    
    if (minuend.type !== "number" || subtrahend.type !== "number") return nil()
    return num(getValue(minuend) - getValue(subtrahend))
  }
}

// Division - NOT commutative or idempotent
type DivisiveFunctionArgs = {dividend: LatticeNumber, divisor: LatticeNumber}
export class DivideFunction extends FunctionGadget<DivisiveFunctionArgs> {
  constructor(id: string) {
    super(id, ['dividend', 'divisor'])
  }
  
  fn(args: DivisiveFunctionArgs): LatticeValue {
    const dividend = args['dividend']
    const divisor = args['divisor']
    
    if (dividend.type !== "number" || divisor.type !== "number") return nil()
    
    const divisorValue = getValue(divisor)
    if (divisorValue === 0) return nil()  // No division by zero
    
    return num(getValue(dividend) / divisorValue)
  }
}

// Gate - forwards value only if control is true
type GateFunctionArgs = {control: LatticeBool, value: LatticeValue}
export class GateFunction extends FunctionGadget<GateFunctionArgs> {
  constructor(id: string) {
    super(id, ['control', 'value'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const control = args['control']
    const value = args['value']
    
    if (control.type !== "bool") return nil()
    
    const controlValue = getValue(control)
    return controlValue ? value : nil()
  }
}

// Equality test
type EqualityFunctionArgs = {left: LatticeValue, right: LatticeValue}
export class EqualFunction extends FunctionGadget<EqualityFunctionArgs> {
  constructor(id: string) {
    super(id, ['left', 'right'])
  }
  
  fn(args: EqualityFunctionArgs): LatticeValue {
    const left = args['left']
    const right = args['right']
    
    // Type must match
    if (left.type !== right.type) return bool(false)
    
    // Compare values
    if (left.type === "null" && right.type === "null") {
      return bool(true)
    }
    
    if (left.type === "bool" || left.type === "number" || left.type === "string") {
      return bool(getValue(left) === getValue(right))
    }
    
    // Sets and contradictions need deep comparison (simplified for now)
    return bool(false)
  }
}

// Greater than comparison
type GreaterThanFunctionArgs = {left: LatticeNumber, right: LatticeNumber}
export class GreaterThanFunction extends FunctionGadget<GreaterThanFunctionArgs> {
  constructor(id: string) {
    super(id, ['left', 'right'])
  }
  
  fn(args: GreaterThanFunctionArgs): LatticeValue {
    const left = args['left']
    const right = args['right']
    
    if (left.type !== "number" || right.type !== "number") return nil()
    return bool(getValue(left) > getValue(right))
  }
}