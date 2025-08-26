/**
 * Helper functions for extracting values from LatticeValues
 * Especially useful for OrdinalCell which stores values in a Map
 */

import type { LatticeValue } from './lattice-types'

/**
 * Extract the actual JavaScript value from a LatticeValue
 * Handles OrdinalCell's Map structure
 */
export function extractValue(latticeValue: LatticeValue | null): any {
  if (!latticeValue) return null
  
  // Check if it's a dict (which OrdinalCell uses)
  if (latticeValue.type === 'dict' && latticeValue.value instanceof Map) {
    // OrdinalCell stores as Map with 'ordinal' and 'value' keys
    const innerValue = latticeValue.value.get('value')
    if (innerValue) {
      // Recursively extract the inner value
      return extractValue(innerValue)
    }
    
    // If no 'value' key, it might be a regular dict
    // Convert Map to object
    const obj: Record<string, any> = {}
    latticeValue.value.forEach((val, key) => {
      obj[key] = extractValue(val)
    })
    return obj
  }
  
  // Direct value extraction
  if ('value' in latticeValue) {
    // For Maps, convert to object
    if (latticeValue.value instanceof Map) {
      const obj: Record<string, any> = {}
      latticeValue.value.forEach((val: any, key: string) => {
        obj[key] = extractValue(val)
      })
      return obj
    }
    return latticeValue.value
  }
  
  return null
}

/**
 * Get value from a gadget's output
 */
export function getGadgetValue(gadget: { getOutput: (name?: string) => LatticeValue | null }, outputName = 'default'): any {
  const output = gadget.getOutput(outputName)
  return extractValue(output)
}