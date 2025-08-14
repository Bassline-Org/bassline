/**
 * Tests for async stream support and complete MGP functionality
 */

import { describe, it, expect } from 'vitest'
import { stream } from '../src/micro-stream'
import { runtime } from '../src/stream-runtime'

describe('Async Stream Support', () => {
  it('should handle async transforms', async () => {
    const s = stream<number>()
    const results: string[] = []
    
    s.transform(async n => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10))
      return `result-${n}`
    }).subscribe(value => results.push(value))
    
    s.write(1)
    s.write(2)
    s.write(3)
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 50))
    
    expect(results).toEqual(['result-1', 'result-2', 'result-3'])
  })
  
  it('should handle transformAsync', async () => {
    const s = stream<string>()
    const results: number[] = []
    
    s.transformAsync(async str => {
      await new Promise(resolve => setTimeout(resolve, 5))
      return str.length
    }).subscribe(value => results.push(value))
    
    s.write('hello')
    s.write('world')
    s.write('!')
    
    await new Promise(resolve => setTimeout(resolve, 30))
    
    expect(results).toEqual([5, 5, 1])
  })
  
  it('should handle errors in async transforms', async () => {
    const s = stream<number>()
    const results: string[] = []
    const errors: string[] = []
    
    // Spy on console.error
    const originalError = console.error
    console.error = (msg: string) => {
      if (msg.includes('Transform error:')) errors.push(msg)
    }
    
    s.transform(async n => {
      if (n === 2) throw new Error('Simulated error')
      return `ok-${n}`
    }).subscribe(value => results.push(value))
    
    s.write(1)
    s.write(2) // This will error
    s.write(3)
    
    await new Promise(resolve => setTimeout(resolve, 20))
    
    expect(results).toEqual(['ok-1', 'ok-3'])
    expect(errors.length).toBe(1)
    
    console.error = originalError
  })
})

describe('Complete MGP Support', () => {
  describe('Parent-Child Tracking', () => {
    it('should track parent-child relationships', () => {
      const rt = runtime()
      
      // Create parent group
      rt.createGroup('parent')
      
      // Create child groups
      rt.createGroup('child1', undefined, {}, 'parent')
      rt.createGroup('child2', undefined, {}, 'parent')
      
      // Check parent-child relationships
      const child1 = rt.groups.get('child1')
      const child2 = rt.groups.get('child2')
      
      expect(child1?.parentId).toBe('parent')
      expect(child2?.parentId).toBe('parent')
    })
  })
  
  describe('Structure Updates', () => {
    it('should update structure when children are added', () => {
      const rt = runtime()
      
      // Create parent with structure exposure
      rt.createGroup('parent', undefined, {
        'expose-structure': true
      })
      
      // Get initial structure
      const initialStructure = rt.getValue('parent:children:structure')
      expect(initialStructure).toBeDefined()
      expect(initialStructure.groups.size).toBe(0)
      
      // Add a child group
      rt.createGroup('child1', undefined, {}, 'parent')
      
      // Structure should update
      const updatedStructure = rt.getValue('parent:children:structure')
      expect(updatedStructure.groups.size).toBe(1)
      expect(updatedStructure.groups.has('child1')).toBe(true)
    })
    
    it('should respect expose-internals flag', () => {
      const rt = runtime()
      
      // Create parent with structure but no internals
      rt.createGroup('parent', undefined, {
        'expose-structure': true,
        'expose-internals': false
      })
      
      // Create child with internal and boundary contacts
      rt.createGroup('child', undefined, {}, 'parent')
      
      // Use action to create boundary contact properly
      rt.applyAction(['createContact', 'boundary', 'child', {
        blendMode: 'merge',
        isBoundary: true
      }])
      
      // Create internal contact (not boundary)
      rt.applyAction(['createContact', 'internal', 'child', {
        blendMode: 'merge',
        isBoundary: false
      }])
      
      // Structure should only include boundary contact
      const structure = rt.getValue('parent:children:structure')
      expect(structure.contacts.has('boundary')).toBe(true)
      expect(structure.contacts.has('internal')).toBe(false)
      expect(structure.contacts.has('child:properties')).toBe(true) // properties is always boundary
    })
    
    it('should include internals when expose-internals is true', () => {
      const rt = runtime()
      
      // Create parent with internals exposed
      rt.createGroup('parent', undefined, {
        'expose-structure': true,
        'expose-internals': true
      })
      
      // Create child with contacts
      rt.createGroup('child', undefined, {}, 'parent')
      
      rt.applyAction(['createContact', 'boundary', 'child', {
        blendMode: 'merge',
        isBoundary: true
      }])
      
      rt.applyAction(['createContact', 'internal', 'child', {
        blendMode: 'merge',
        isBoundary: false
      }])
      
      // Structure should include all contacts
      const structure = rt.getValue('parent:children:structure')
      expect(structure.contacts.has('boundary')).toBe(true)
      expect(structure.contacts.has('internal')).toBe(true)
      expect(structure.contacts.has('child:properties')).toBe(true)
    })
  })
  
  describe('Dynamics Forwarding', () => {
    it('should forward child events to dynamics contact', async () => {
      const rt = runtime()
      const events: any[] = []
      
      // Create parent with dynamics enabled
      rt.createGroup('parent', undefined, {
        'expose-dynamics': true
      })
      
      // Monitor dynamics contact
      const dynamicsContact = rt.contacts.get('parent:children:dynamics')
      expect(dynamicsContact).toBeDefined()
      
      dynamicsContact!.onValueChange(value => {
        events.push(value)
      })
      
      // Create child and change a contact
      rt.createGroup('child', undefined, {}, 'parent')
      rt.createContact('test', 'child', 'last')
      
      rt.setValue('test', 'value1')
      rt.setValue('test', 'value2')
      
      await rt.waitForConvergence()
      
      // Should have forwarded the value change events
      expect(events.length).toBeGreaterThan(0)
      expect(events.some(e => e[0] === 'valueChanged' && e[1] === 'test')).toBe(true)
    })
    
    it('should not forward non-child events', async () => {
      const rt = runtime()
      const events: any[] = []
      
      // Create parent with dynamics
      rt.createGroup('parent', undefined, {
        'expose-dynamics': true
      })
      
      const dynamicsContact = rt.contacts.get('parent:children:dynamics')!
      dynamicsContact.onValueChange(value => events.push(value))
      
      // Create a sibling group (not a child)
      rt.createGroup('sibling')
      rt.createContact('test', 'sibling', 'last')
      
      rt.setValue('test', 'value1')
      
      await rt.waitForConvergence()
      
      // Should not have forwarded sibling events
      expect(events.filter(e => e[1] === 'test').length).toBe(0)
    })
  })
  
  describe('Actions Processing', () => {
    it('should process actions through actions contact', () => {
      const rt = runtime()
      
      // Create parent with meta-mutation enabled
      rt.createGroup('parent', undefined, {
        'allow-meta-mutation': true
      })
      
      // Send an action to create a child
      rt.setValue('parent:children:actions', ['createGroup', 'dynamic-child', 'parent', {}])
      
      // Child should now exist
      const child = rt.groups.get('dynamic-child')
      expect(child).toBeDefined()
      expect(child?.parentId).toBe('parent')
    })
    
    it('should not create actions contact in distributed mode', () => {
      const rt = runtime()
      
      // Create parent with mutation but distributed mode
      rt.createGroup('parent', undefined, {
        'allow-meta-mutation': true,
        'distributed-mode': true
      })
      
      // Actions contact should not exist
      expect(rt.getValue('parent:children:actions')).toBeUndefined()
    })
  })
})