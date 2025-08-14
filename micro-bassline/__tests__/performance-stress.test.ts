/**
 * Performance stress tests for stream-based propagation
 */

import { describe, it, expect } from 'vitest'
import { runtime } from '../src/stream-runtime'
import { defaultPrimitives } from '../src/stream-primitives'

describe('Performance Stress Tests', () => {
  describe('Large Network Scale', () => {
    it('should handle 1000+ contacts efficiently', () => {
      const rt = runtime()
      const startTime = Date.now()
      
      // Create a group and 1000 contacts
      rt.createGroup('perf-test')
      for (let i = 0; i < 1000; i++) {
        rt.createContact(`contact-${i}`, 'perf-test')
      }
      
      // Wire them in a chain
      for (let i = 0; i < 999; i++) {
        rt.createWire(`wire-${i}`, `perf-test:contact-${i}`, `perf-test:contact-${i + 1}`, false)
      }
      
      const setupTime = Date.now() - startTime
      expect(setupTime).toBeLessThan(1000) // Should set up in under 1 second
      
      // Test propagation speed
      const propagateStart = Date.now()
      rt.setValue('perf-test', 'contact-0', 'test-value')
      
      // Check that value propagated to the end
      expect(rt.getValue('perf-test', 'contact-999')).toBe('test-value')
      
      const propagateTime = Date.now() - propagateStart
      expect(propagateTime).toBeLessThan(100) // Should propagate in under 100ms
      
      console.log(`Setup 1000 contacts: ${setupTime}ms, Propagation: ${propagateTime}ms`)
    })
    
    it('should handle deep group hierarchies', () => {
      const rt = runtime()
      const depth = 20
      const startTime = Date.now()
      
      // Create nested groups
      let parentId: string | undefined = undefined
      for (let i = 0; i < depth; i++) {
        const groupId = `group-${i}`
        // Only expose structure on the root group, not every level
        const properties = i === 0 ? {
          'expose-structure': true,
          'expose-dynamics': true
        } : {}
        rt.createGroup(groupId, undefined, properties, parentId)
        
        // Add a contact to each group
        rt.createContact(`contact-${i}`, groupId, 'merge', { isBoundary: true })
        
        parentId = groupId
      }
      
      const setupTime = Date.now() - startTime
      console.log(`Deep hierarchy (${depth} levels) setup: ${setupTime}ms`)
      expect(setupTime).toBeLessThan(50) // Should be very fast with lazy computation
      
      // Test that structure updates cascade
      rt.createContact('deep-contact', `group-${depth - 1}`, 'merge', { isBoundary: true })
      
      // Now test reading the structure (this will trigger computation)
      const readStart = Date.now()
      const rootStructure = rt.getValue('group-0', 'structure')
      const readTime = Date.now() - readStart
      console.log(`Structure computation time: ${readTime}ms`)
      
      expect(rootStructure).toBeDefined()
      expect(readTime).toBeLessThan(500) // Computation can take longer
    })
    
    it('should handle high-frequency updates', async () => {
      const rt = runtime()
      
      // Create a simple network
      rt.createGroup('perf')
      rt.createContact('source', 'perf', 'last') // Use 'last' to stream all values
      rt.createContact('sink', 'perf')
      rt.createWire('w1', 'perf:source', 'perf:sink', false)
      
      const values: any[] = []
      const sinkContact = rt.contacts.get('perf:sink')!
      sinkContact.onValueChange(v => values.push(v))
      
      const updateCount = 1000
      const startTime = Date.now()
      
      // Rapid fire updates
      for (let i = 0; i < updateCount; i++) {
        rt.setValue('perf', 'source', i)
      }
      
      //await rt.waitForConvergence()
      
      const duration = Date.now() - startTime
      const updatesPerSecond = (updateCount / duration) * 1000
      
      expect(values.length).toBe(updateCount)
      expect(values[values.length - 1]).toBe(updateCount - 1)
      
      console.log(`High-frequency updates: ${updateCount} updates in ${duration}ms (${Math.round(updatesPerSecond)} updates/sec)`)
      expect(updatesPerSecond).toBeGreaterThan(1000) // Should handle > 1000 updates/sec
    })
  })
  
  describe('Complex Gadget Networks', () => {
    it('should handle networks with many primitive gadgets', () => {
      const rt = runtime(undefined, defaultPrimitives)
      const gadgetCount = 100
      
      const startTime = Date.now()
      
      // Create a network of add gadgets
      for (let i = 0; i < gadgetCount; i++) {
        rt.createGroup(`adder-${i}`, 'add')
      }
      
      // Chain them together
      for (let i = 0; i < gadgetCount - 1; i++) {
        rt.createWire(`chain-${i}`, `adder-${i}:sum`, `adder-${i + 1}:a`, false)
      }
      
      const setupTime = Date.now() - startTime
      expect(setupTime).toBeLessThan(500)
      
      console.log(`${gadgetCount} gadgets setup: ${setupTime}ms`)
    })
  })
  
  describe('Memory Usage', () => {
    it('should have reasonable memory footprint with computed boundaries', () => {
      const rt = runtime()
      
      // Create many groups with many contacts
      for (let g = 0; g < 100; g++) {
        const groupId = `group-${g}`
        rt.createGroup(groupId)
        
        // Create mix of boundary and internal contacts
        for (let c = 0; c < 50; c++) {
          rt.createContact(`${groupId}-contact-${c}`, groupId, 'merge', {
            isBoundary: c < 10 // Only first 10 are boundaries
          })
        }
      }
      
      // Access boundary contacts (computed on-demand)
      let boundaryCount = 0
      for (const [, group] of rt.groups) {
        boundaryCount += group.getBoundaryContacts().size
      }
      
      // Should have 100 groups * 11 boundaries (10 + properties contact)
      expect(boundaryCount).toBe(100 * 11)
      
      // Memory usage should be reasonable (can't directly measure in JS)
      // But computed boundaries mean we don't store duplicate data
    })
  })
  
  describe('Async Stream Performance', () => {
    it('should handle many concurrent async transforms', async () => {
      const rt = runtime()
      
      // Create source that will trigger async operations
      rt.createGroup('async-test')
      rt.createContact('source', 'async-test', 'last')
      
      // Create contacts with async transforms
      const asyncContacts = 10
      const results: number[] = []
      
      for (let i = 0; i < asyncContacts; i++) {
        rt.createContact(`async-${i}`, 'async-test')
        
        // Wire source to trigger async operations
        rt.contacts.get('async-test:source')!.stream
          .transformAsync(async (value: any) => {
            // Simulate async work
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10))
            return `${value}-processed-${i}`
          })
          .subscribe(() => results.push(i))
      }
      
      const startTime = Date.now()
      
      // Trigger many async operations
      for (let i = 0; i < 100; i++) {
        rt.setValue('async-test', 'source', i)
      }
      
      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const duration = Date.now() - startTime
      
      console.log(`Async operations completed in ${duration}ms`)
      expect(results.length).toBeGreaterThan(0)
    })
  })
})