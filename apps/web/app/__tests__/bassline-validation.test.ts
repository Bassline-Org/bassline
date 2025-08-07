import { describe, it, expect } from 'vitest'
import { validateBassline, validateCompatibility } from '@bassline/core'
import type { Bassline } from '@bassline/core'

describe('Bassline Validation', () => {
  describe('Schema Validation', () => {
    it('should require a name', () => {
      const bassline: Bassline = {
        name: '',
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('MISSING_NAME')
    })
    
    it('should validate name format', () => {
      const bassline: Bassline = {
        name: 'my awesome network!',
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].code).toBe('INVALID_NAME_FORMAT')
    })
    
    it('should validate version format', () => {
      const bassline: Bassline = {
        name: 'test',
        version: 'v1.0',
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.code === 'INVALID_VERSION_FORMAT')).toBe(true)
    })
    
    it('should require build, interface, or dependencies', () => {
      const bassline: Bassline = {
        name: 'empty'
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'EMPTY_BASSLINE')).toBe(true)
    })
  })
  
  describe('Semantic Validation', () => {
    it('should detect conflicting attributes', () => {
      const bassline: Bassline = {
        name: 'test',
        attributes: {
          'bassline.pure': true,
          'bassline.mutable': true
        },
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'CONFLICTING_ATTRIBUTES')).toBe(true)
    })
    
    it('should validate dynamic topology configuration', () => {
      const bassline: Bassline = {
        name: 'test',
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true
            // Missing schemaContact
          } as any
        },
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'MISSING_SCHEMA_CONTACT')).toBe(true)
    })
  })
  
  describe('Attribute Validation', () => {
    it('should warn about unnamespaced attributes', () => {
      const bassline: Bassline = {
        name: 'test',
        attributes: {
          'myAttribute': 'value'
        },
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.code === 'UNNAMESPACED_ATTRIBUTE')).toBe(true)
    })
    
    it('should allow x- prefixed custom attributes', () => {
      const bassline: Bassline = {
        name: 'test',
        attributes: {
          'x-custom': 'value'
        },
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(true)
      expect(result.warnings.filter(w => w.code === 'UNNAMESPACED_ATTRIBUTE')).toHaveLength(0)
    })
    
    it('should validate well-known attribute types', () => {
      const bassline: Bassline = {
        name: 'test',
        attributes: {
          'bassline.pure': 'yes' as any, // Should be boolean
          'permissions.modify': 'everyone' as any // Should be specific values
        },
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
    })
  })
  
  describe('Topology Validation', () => {
    it('should detect duplicate contact IDs', () => {
      const bassline: Bassline = {
        name: 'test',
        build: {
          topology: {
            contacts: [
              { id: 'a', blendMode: 'accept-last' },
              { id: 'a', blendMode: 'accept-last' }
            ],
            wires: []
          }
        }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'DUPLICATE_ID')).toBe(true)
    })
    
    it('should warn about wires referencing unknown contacts', () => {
      const bassline: Bassline = {
        name: 'test',
        build: {
          topology: {
            contacts: [
              { id: 'a', blendMode: 'accept-last' }
            ],
            wires: [
              { fromId: 'a', toId: 'b', type: 'bidirectional' }
            ]
          }
        }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.code === 'UNKNOWN_CONTACT')).toBe(true)
    })
    
    it('should allow @ prefixed special contacts in wires', () => {
      const bassline: Bassline = {
        name: 'test',
        build: {
          topology: {
            contacts: [
              { id: 'a', blendMode: 'accept-last' }
            ],
            wires: [
              { fromId: 'a', toId: '@config', type: 'bidirectional' }
            ]
          }
        }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(true)
      expect(result.warnings.filter(w => w.code === 'UNKNOWN_CONTACT')).toHaveLength(0)
    })
  })
  
  describe('Security Validation', () => {
    it('should detect script injection attempts', () => {
      const bassline: Bassline = {
        name: '<script>alert("xss")</script>',
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SECURITY_SCRIPT_INJECTION')).toBe(true)
    })
    
    it('should warn about overly permissive permissions', () => {
      const bassline: Bassline = {
        name: 'test',
        attributes: {
          'permissions.modify': 'anyone'
        },
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.code === 'SECURITY_OPEN_PERMISSIONS')).toBe(true)
    })
    
    it('should warn about insecure dependencies', () => {
      const bassline: Bassline = {
        name: 'test',
        dependencies: {
          'math': 'http://example.com/math.bassline'
        }
      }
      
      const result = validateBassline(bassline)
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.code === 'SECURITY_INSECURE_DEPENDENCY')).toBe(true)
    })
  })
  
  describe('Complexity Validation', () => {
    it('should calculate and warn about high complexity', () => {
      const bassline: Bassline = {
        name: 'complex',
        build: {
          topology: {
            contacts: Array(100).fill(null).map((_, i) => ({
              id: `c${i}`,
              blendMode: 'accept-last' as const
            })),
            wires: Array(200).fill(null).map((_, i) => ({
              fromId: `c${i % 100}`,
              toId: `c${(i + 1) % 100}`,
              type: 'bidirectional' as const
            }))
          }
        }
      }
      
      const result = validateBassline(bassline, { maxComplexity: 100 })
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.code === 'COMPLEXITY_HIGH')).toBe(true)
    })
  })
  
  describe('Compatibility Validation', () => {
    it('should check version requirements for features', () => {
      const bassline: Bassline = {
        name: 'test',
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@schema'
          }
        },
        build: { topology: { contacts: [], wires: [] } }
      }
      
      const result = validateCompatibility(bassline, '1.0.0')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'INCOMPATIBLE_FEATURE')).toBe(true)
      
      const result2 = validateCompatibility(bassline, '2.0.0')
      expect(result2.valid).toBe(true)
    })
  })
})