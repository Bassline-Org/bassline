/**
 * Extract functions - Pull values out of compound structures
 */

import { FunctionGadget } from '../function'
import { LatticeValue, nil, isDict, getMapValue, LatticeDict } from '../lattice-types'

/**
 * ExtractValue - Extracts the 'value' field from ordinal dicts
 * Useful for connecting OrdinalCells to gadgets that expect raw values
 */
export class ExtractValue extends FunctionGadget<{input: LatticeDict}> {
  constructor(id: string) {
    super(id, ['input'])
  }
  
  fn(args: {input: LatticeDict}): LatticeValue {
    const input = args['input']
    if (!input) return nil()
    
    // If it's a dict with a 'value' field, extract it
    if (isDict(input) && input.value.has('value')) {
      return input.value.get('value') || nil()
    }
    
    // Otherwise pass through unchanged
    return input
  }
  
  static deserialize(data: any, registry: any): ExtractValue {
    return registry.deserializeFunction(data, ExtractValue)
  }
}

/**
 * ExtractOrdinal - Extracts the 'ordinal' field from ordinal dicts
 */
export class ExtractOrdinal extends FunctionGadget<{input: LatticeDict}> {
  constructor(id: string) {
    super(id, ['input'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args['input']
    if (!input) return nil()
    
    // If it's a dict with an 'ordinal' field, extract it
    if (isDict(input) && input.value.has('ordinal')) {
      return input.value.get('ordinal') || nil()
    }
    
    // Otherwise return nil
    return nil()
  }
  
  static deserialize(data: any, registry: any): ExtractOrdinal {
    return registry.deserializeFunction(data, ExtractOrdinal)
  }
}