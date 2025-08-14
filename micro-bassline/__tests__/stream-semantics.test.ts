/**
 * Test: Stream vs Value Semantics
 * 
 * Tests stream semantics (blendMode: 'last') vs value semantics (blendMode: 'merge').
 */

import { describe, it, expect, vi } from 'vitest'
import { Runtime, Bassline } from '../src/index'

describe('Stream vs Value Semantics', () => {
  describe('Value Contacts', () => {
    it('should deduplicate identical values', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['value-contact', {
            content: 42,
            properties: { blendMode: 'merge' }
          }]
        ]),
        wires: new Map(),
        groups: new Map()
      }
      
      const runtime = new Runtime(bassline)
      const events: any[] = []
      runtime.onEvent(e => events.push(e))
      
      // Set same value multiple times
      runtime.setValue('value-contact', 42)
      runtime.setValue('value-contact', 42)
      runtime.setValue('value-contact', 42)
      
      // Should not propagate (no change)
      const valueChangedEvents = events.filter(e => e[0] === 'valueChanged')
      expect(valueChangedEvents).toHaveLength(0)
    })
    
    it('should store and retrieve values', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['value-contact', {
            properties: { blendMode: 'last' }  // Use 'last' to allow replacing values
          }]
        ]),
        wires: new Map(),
        groups: new Map()
      }
      
      const runtime = new Runtime(bassline)
      
      runtime.setValue('value-contact', 'hello')
      expect(runtime.getValue('value-contact')).toBe('hello')
      
      runtime.setValue('value-contact', 'world')
      expect(runtime.getValue('value-contact')).toBe('world')
    })
    
    it('should demonstrate difference between merge and last modes', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['last-mode', { 
            properties: { blendMode: 'last' }
          }],
          ['merge-mode', {
            properties: { blendMode: 'merge' }
          }]
        ]),
        wires: new Map(),
        groups: new Map()
      }
      
      const runtime = new Runtime(bassline)
      const events: any[] = []
      runtime.onEvent(e => events.push(e))
      
      // Test 'last' mode - always propagates
      runtime.setValue('last-mode', 42)
      runtime.setValue('last-mode', 42)  // Same value
      const lastEvents = events.filter(e => e[0] === 'valueChanged' && e[1] === 'last-mode')
      expect(lastEvents).toHaveLength(2)  // Both trigger
      
      // Test 'merge' mode - only propagates on change
      events.length = 0
      runtime.setValue('merge-mode', 42)
      runtime.setValue('merge-mode', 42)  // Same value
      const mergeEvents = events.filter(e => e[0] === 'valueChanged' && e[1] === 'merge-mode')
      expect(mergeEvents).toHaveLength(0)  // No change, no event
    })
  })
  
  describe('Stream Contacts (blendMode: last)', () => {
    it('should propagate every value (even duplicates)', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['stream-contact', {
            properties: { blendMode: 'last' }
          }]
        ]),
        wires: new Map(),
        groups: new Map()
      }
      
      const runtime = new Runtime(bassline)
      const events: any[] = []
      runtime.onEvent(e => events.push(e))
      
      // Send same value multiple times
      runtime.setValue('stream-contact', 42)
      runtime.setValue('stream-contact', 42)
      runtime.setValue('stream-contact', 42)
      
      // Should fire event for each value
      const valueChangedEvents = events.filter(e => e[0] === 'valueChanged')
      expect(valueChangedEvents).toHaveLength(3)
    })
    
    it('should store the latest value', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['stream-contact', {
            properties: { blendMode: 'last' }
          }]
        ]),
        wires: new Map(),
        groups: new Map()
      }
      
      const runtime = new Runtime(bassline)
      
      runtime.setValue('stream-contact', 'event1')
      runtime.setValue('stream-contact', 'event2')
      
      // Stream contacts now store the latest value
      const value = runtime.getValue('stream-contact')
      expect(value).toBe('event2')  // Last value sent
    })
    
    it('should propagate every value through wires', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['stream-a', {
            properties: { blendMode: 'last' }
          }],
          ['stream-b', {
            properties: { blendMode: 'last' }
          }]
        ]),
        wires: new Map([
          ['w1', { fromId: 'stream-a', toId: 'stream-b' }]
        ]),
        groups: new Map()
      }
      
      const runtime = new Runtime(bassline)
      const events: any[] = []
      runtime.onEvent(e => {
        if (e[0] === 'propagating' && e[2] === 'stream-b') {
          events.push(e[3]) // Collect propagated values
        }
      })
      
      // Send multiple values
      runtime.setValue('stream-a', 'event1')
      runtime.setValue('stream-a', 'event2')
      runtime.setValue('stream-a', 'event3')
      
      // All values should propagate
      expect(events).toEqual(['event1', 'event2', 'event3'])
    })
    
    it('should trigger gadgets for each stream value', () => {
      const executionCount = vi.fn()
      
      const bassline: Bassline = {
        contacts: new Map([
          ['stream-input', {
            groupId: 'counter',
            properties: { 
              blendMode: 'last',
              name: 'input'
            }
          }],
          ['count-output', {
            groupId: 'counter',
            properties: { 
              name: 'count',
              blendMode: 'last'  // Use 'last' to replace count values
            }
          }]
        ]),
        wires: new Map(),
        groups: new Map([
          ['counter', {
            contactIds: new Set(['stream-input', 'count-output']),
            boundaryContactIds: new Set(['stream-input', 'count-output']),
            primitiveType: 'count-events',
            properties: {}
          }]
        ])
      }
      
      const runtime = new Runtime(bassline)
      
      // Register a counting primitive
      let count = 0
      runtime.registerPrimitive('count-events', {
        type: 'count-events',
        inputs: ['input'],
        outputs: ['count'],
        activation: () => true,
        execute: (inputs) => {
          executionCount()
          count++
          return new Map([['count', count]])
        }
      })
      
      // Send multiple stream values
      runtime.setValue('stream-input', 'event1')
      runtime.setValue('stream-input', 'event2')
      runtime.setValue('stream-input', 'event3')
      
      // Gadget should execute for each value
      expect(executionCount).toHaveBeenCalledTimes(3)
      expect(runtime.getValue('count-output')).toBe(3)
    })
  })
  
  describe('Mixed Networks', () => {
    it('should handle stream-to-value conversion', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['stream', {
            properties: { blendMode: 'last' }
          }],
          ['value', {
            properties: { blendMode: 'last' }
          }]
        ]),
        wires: new Map([
          ['w1', { fromId: 'stream', toId: 'value' }]
        ]),
        groups: new Map()
      }
      
      const runtime = new Runtime(bassline)
      
      // Send stream values
      runtime.sendStream('stream', 1)
      runtime.sendStream('stream', 2)
      runtime.sendStream('stream', 3)
      
      // Value contact should have last value
      expect(runtime.getValue('value')).toBe(3)
    })
    
    it('should handle value-to-stream conversion', () => {
      const bassline: Bassline = {
        contacts: new Map([
          ['value', {
            content: 'initial',
            properties: { blendMode: 'last' }  // Use 'last' to replace values
          }],
          ['stream', {
            properties: { blendMode: 'last' }
          }]
        ]),
        wires: new Map([
          ['w1', { fromId: 'value', toId: 'stream' }]
        ]),
        groups: new Map()
      }
      
      const runtime = new Runtime(bassline)
      const events: any[] = []
      runtime.onEvent(e => {
        if (e[0] === 'valueChanged' && e[1] === 'stream') {
          events.push(e[3])
        }
      })
      
      // Change value multiple times
      runtime.setValue('value', 'first')
      runtime.setValue('value', 'second')
      runtime.setValue('value', 'second') // Same value
      runtime.setValue('value', 'third')
      
      // Stream receives every value (even duplicates with 'last' mode)
      expect(events).toEqual(['first', 'second', 'second', 'third'])
    })
  })
})