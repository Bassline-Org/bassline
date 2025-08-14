/**
 * Debug properties contact merging
 */

import { describe, it, expect } from 'vitest'
import { mergeValues } from '../types'

describe('Debug Properties Merging', () => {
  it('should merge plain objects', () => {
    const current = { theme: 'light', fontSize: 14 }
    const incoming = { theme: 'dark', maxLines: 100 }
    
    const result = mergeValues(current, incoming, 'merge')
    
    expect(result).toEqual({
      theme: 'dark',
      fontSize: 14,
      maxLines: 100
    })
  })
  
  it('should handle nested object merging', () => {
    const current = { 
      config: { theme: 'light' },
      value: 1
    }
    const incoming = {
      config: { fontSize: 14 },
      value: 2
    }
    
    const result = mergeValues(current, incoming, 'merge')
    
    expect(result).toEqual({
      config: { theme: 'light', fontSize: 14 },
      value: 2
    })
  })
})