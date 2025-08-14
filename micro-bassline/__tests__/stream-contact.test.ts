/**
 * Tests for contact implementation
 */

import { describe, it, expect, vi } from 'vitest'
import { contact, group, gadget } from '../src/stream-contact'
import { guards } from '../src/micro-stream'

describe('contact', () => {
  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const c = contact('test', 'merge')
      
      c.setValue(42)
      expect(c.getValue()).toBe(42)
      
      c.setValue('hello')
      expect(c.getValue()).toBe('hello')
    })
    
    it('should notify on value changes', () => {
      const c = contact('test', 'merge')
      const handler = vi.fn()
      
      c.onValueChange(handler)
      c.setValue(10)
      
      expect(handler).toHaveBeenCalledWith(10)
    })
  })
  
  describe('Blend Modes', () => {
    it('should deduplicate in merge mode', () => {
      const c = contact('test', 'merge')
      const handler = vi.fn()
      
      c.onValueChange(handler)
      
      c.setValue(42)
      c.setValue(42)  // Same value
      c.setValue(42)  // Same value again
      
      // Should only trigger once
      expect(handler).toHaveBeenCalledTimes(1)
    })
    
    it('should pass all values in last mode', () => {
      const c = contact('test', 'last')
      const handler = vi.fn()
      
      c.onValueChange(handler)
      
      c.setValue(42)
      c.setValue(42)  // Same value
      c.setValue(42)  // Same value again
      
      // Should trigger every time
      expect(handler).toHaveBeenCalledTimes(3)
    })
  })
  
  describe('Wiring', () => {
    it('should propagate values through wires', () => {
      const source = contact('source', 'merge')
      const target = contact('target', 'merge')
      
      source.wireTo(target, false)  // Unidirectional
      
      source.setValue(100)
      expect(target.getValue()).toBe(100)
    })
    
    it('should validate connections', () => {
      const c = contact('test', 'merge', 'group1')
      
      // Can't wire to self
      expect(c.canWireTo(c)).toBe(false)
      
      // Can't wire to read-only properties from inside
      const properties = contact(
        'group1:properties', 
        'merge', 
        'group1',
        { readOnlyFromInside: true }
      )
      expect(c.canWireTo(properties)).toBe(false)
      
      // Can wire from outside group
      const external = contact('external', 'merge', 'group2')
      expect(external.canWireTo(properties)).toBe(true)
      
      // Can't wire to contact that doesn't accept connections
      const closed = contact(
        'closed',
        'merge',
        undefined,
        { acceptsConnections: false }
      )
      expect(c.canWireTo(closed)).toBe(false)
    })
    
    it('should throw on invalid connections', () => {
      const c = contact('test', 'merge')
      
      // Try to wire to self
      expect(() => c.wireTo(c)).toThrow('Connection not allowed')
      
      // Try to wire to closed contact
      const closed = contact(
        'closed',
        'merge',
        undefined,
        { acceptsConnections: false }
      )
      expect(() => c.wireTo(closed)).toThrow('Connection not allowed')
    })
    
    it('should support bidirectional wiring', () => {
      const a = contact('a', 'merge')
      const b = contact('b', 'merge')
      
      a.wireTo(b, true)  // Bidirectional
      
      a.setValue(1)
      expect(b.getValue()).toBe(1)
      
      b.setValue(2)
      expect(a.getValue()).toBe(2)
    })
    
    it('should handle cycles without infinite loops', () => {
      const a = contact('a', 'merge')
      const b = contact('b', 'merge')
      const c = contact('c', 'merge')
      
      // Create a cycle: a -> b -> c -> a
      a.wireTo(b, false)
      b.wireTo(c, false)
      c.wireTo(a, false)
      
      // Set a value - merge mode should deduplicate and prevent infinite loop
      a.setValue(42)
      
      expect(b.getValue()).toBe(42)
      expect(c.getValue()).toBe(42)
      // a should still be 42 (not re-triggered by cycle)
      expect(a.getValue()).toBe(42)
    })
  })
  
  describe('group', () => {
    it('should manage contacts', () => {
      const g = group('test-group')
      
      const contact1 = g.createContact('c1', 'merge')
      const contact2 = g.createContact('c2', 'last', true)  // boundary
      
      expect(g.getContact('c1')).toBe(contact1)
      expect(g.getContact('c2')).toBe(contact2)
      expect(g.boundaryContacts.has('c2')).toBe(true)
    })
    
    it('should emit events to group stream', () => {
      const g = group('test-group')
      const handler = vi.fn()
      
      g.eventStream.subscribe(handler)
      
      const testContact = g.createContact('test', 'merge')
      testContact.setValue(42)
      
      expect(handler).toHaveBeenCalledWith({
        type: 'valueChanged',
        contactId: 'test',
        value: 42
      })
    })
  })
  
  describe('Gadgets', () => {
    it('should create working gadgets with guards', () => {
      const g = group('calc')
      
      // Create contacts
      const a = g.createContact('a', 'merge')
      const b = g.createContact('b', 'merge')
      const sum = g.createContact('sum', 'merge')
      
      // Create and apply add gadget
      const addGadget = gadget({
        inputs: ['a', 'b'],
        outputs: ['sum'],
        guards: [
          guards.hasInputs('a', 'b'),
          guards.hasTypes({a: 'number', b: 'number'})
        ],
        execute: ({a, b}) => ({sum: a + b})
      })
      
      addGadget(g)
      
      // Test with invalid inputs (should not execute)
      a.setValue('not a number')
      b.setValue(5)
      expect(sum.getValue()).toBeUndefined()
      
      // Test with valid inputs
      a.setValue(10)
      b.setValue(5)
      
      // Need to wait for propagation
      setTimeout(() => {
        expect(sum.getValue()).toBe(15)
      }, 0)
    })
    
    it('should work without guards', () => {
      const g = group('concat')
      
      const a = g.createContact('a', 'merge')
      const b = g.createContact('b', 'merge')
      const result = g.createContact('result', 'merge')
      
      const concatGadget = gadget({
        inputs: ['a', 'b'],
        outputs: ['result'],
        execute: ({a, b}) => ({
          result: `${a || ''}${b || ''}`
        })
      })
      
      concatGadget(g)
      
      a.setValue('hello')
      b.setValue('world')
      
      setTimeout(() => {
        expect(result.getValue()).toBe('helloworld')
      }, 0)
    })
  })
})