/**
 * Tests for StreamRuntime
 */

import { describe, it, expect } from 'vitest'
import { runtime } from '../src/stream-runtime'
import { defaultPrimitives } from '../src/stream-primitives'
import { Bassline } from '../src/types'

describe('StreamRuntime', () => {
  describe('Basic Operations', () => {
    it('should create and manage contacts', () => {
      const rt = runtime()
      
      rt.createContact('test', undefined, 'merge')
      rt.setValue('test', 42)
      
      expect(rt.getValue('test')).toBe(42)
    })
    
    it('should create and wire contacts', () => {
      const rt = runtime()
      
      rt.createContact('a', undefined, 'merge')
      rt.createContact('b', undefined, 'merge')
      rt.createWire('w1', 'a', 'b', false)
      
      rt.setValue('a', 100)
      expect(rt.getValue('b')).toBe(100)
    })
    
    it('should support bidirectional wiring', () => {
      const rt = runtime()
      
      rt.createContact('a', undefined, 'merge')
      rt.createContact('b', undefined, 'merge')
      rt.createWire('w1', 'a', 'b', true)
      
      rt.setValue('a', 1)
      expect(rt.getValue('b')).toBe(1)
      
      rt.setValue('b', 2)
      expect(rt.getValue('a')).toBe(2)
    })
  })
  
  describe('Groups and Primitives', () => {
    it('should create groups with properties contact', () => {
      const rt = runtime()
      
      rt.createGroup('test-group')
      
      // Properties contact should be auto-created
      expect(rt.getValue('test-group:properties')).toBeDefined()
    })
    
    it('should execute primitive gadgets', () => {
      const rt = runtime(undefined, defaultPrimitives)
      
      // Create an add gadget group - this should auto-create contacts
      rt.createGroup('adder', 'add')
      
      // The primitive setup should have created namespaced contacts
      rt.setValue('adder:a', 5)
      rt.setValue('adder:b', 3)
      
      // Gadget should execute synchronously
      expect(rt.getValue('adder:sum')).toBe(8)
    })
  })
  
  describe('Actions', () => {
    it('should apply setValue actions', () => {
      const rt = runtime()
      rt.createContact('test')
      
      rt.applyAction(['setValue', 'test', 42])
      expect(rt.getValue('test')).toBe(42)
    })
    
    it('should apply createContact actions', () => {
      const rt = runtime()
      
      rt.applyAction(['createContact', 'new-contact', undefined, {
        blendMode: 'last'
      }])
      
      rt.setValue('new-contact', 'hello')
      expect(rt.getValue('new-contact')).toBe('hello')
    })
    
    it('should apply createWire actions', () => {
      const rt = runtime()
      
      rt.createContact('a')
      rt.createContact('b')
      
      rt.applyAction(['createWire', 'w1', 'a', 'b', {
        bidirectional: false
      }])
      
      rt.setValue('a', 100)
      expect(rt.getValue('b')).toBe(100)
    })
    
    it('should apply createGroup actions', () => {
      const rt = runtime()
      
      rt.applyAction(['createGroup', 'new-group', undefined, {
        defaultProperties: { test: true }
      }])
      
      expect(rt.getValue('new-group:properties')).toEqual({ test: true })
    })
  })
  
  describe('Event Stream', () => {
    it('should emit events to the event stream', () => {
      const rt = runtime()
      const events: any[] = []
      
      rt.eventStream.subscribe(event => events.push(event))
      
      rt.createContact('test')
      rt.setValue('test', 42)
      
      // Should have a valueChanged event
      const valueChanged = events.find(e => e[0] === 'valueChanged')
      expect(valueChanged).toBeDefined()
      expect(valueChanged[1]).toBe('test')
      expect(valueChanged[3]).toBe(42)
    })
  })
  
  describe('Loading Bassline', () => {
    it('should load an existing Bassline structure', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['c1', { content: 10, properties: { blendMode: 'merge' } }],
          ['c2', { content: 20, properties: { blendMode: 'last' } }]
        ]),
        wires: new Map([
          ['w1', { fromId: 'c1', toId: 'c2' }]
        ]),
        groups: new Map([
          ['g1', {
            contactIds: new Set(['c1', 'c2']),
            boundaryContactIds: new Set(),
            properties: {}
          }]
        ])
      }
      
      const rt = runtime(bassline)
      
      expect(rt.getValue('c1')).toBe(10)
      expect(rt.getValue('c2')).toBe(20)
      
      // Test that wire works
      rt.setValue('c1', 30)
      expect(rt.getValue('c2')).toBe(30)
    })
  })
  
  describe('MGP Contacts', () => {
    it('should create MGP structure contact when opted in', () => {
      const rt = runtime()
      
      rt.createGroup('parent', undefined, {
        'expose-structure': true
      })
      
      // Structure contact should exist
      const structure = rt.getValue('parent:children:structure')
      expect(structure).toBeDefined()
      expect(structure.groups).toBeDefined()
    })
    
    it('should not create MGP contacts by default', () => {
      const rt = runtime()
      
      rt.createGroup('parent')
      
      // MGP contacts should not exist
      expect(rt.getValue('parent:children:structure')).toBeUndefined()
      expect(rt.getValue('parent:children:dynamics')).toBeUndefined()
      expect(rt.getValue('parent:children:actions')).toBeUndefined()
    })
  })
})