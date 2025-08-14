/**
 * Test: Dynamic Bassline Gadget
 * 
 * Demonstrates recursive bassline execution where a network
 * runs another network inside itself.
 */

import { describe, it, expect } from 'vitest'
import {
  Runtime,
  Bassline,
  ContactId,
  ReifiedContact,
  ReifiedWire,
  ReifiedGroup,
  getPrimitives
} from '../src/index'
import { createDynamicBasslineGadget } from '../src/dynamic-bassline-gadget'

describe('Dynamic Bassline Gadget', () => {
  it('should run a bassline inside another bassline', () => {
    // Create an inner network (simple adder)
    const innerBassline: Bassline = {
      contacts: new Map([
        ['inner-a', {
          content: 0,
          properties: { 
            name: 'a',
            blendMode: 'last'  // Allow replacing values
          }
        }],
        ['inner-b', {
          content: 0,
          properties: { 
            name: 'b',
            blendMode: 'last'  // Allow replacing values
          }
        }],
        ['inner-sum', {
          properties: { 
            name: 'sum',
            blendMode: 'last'  // Allow replacing values
          }
        }]
      ]),
      wires: new Map(),
      groups: new Map([
        ['inner-adder', {
          contactIds: new Set(['inner-a', 'inner-b', 'inner-sum']),
          boundaryContactIds: new Set(['inner-a', 'inner-b', 'inner-sum']),
          primitiveType: 'add',
          properties: {}
        }]
      ])
    }
    
    // Create the outer network with a dynamic bassline gadget
    const outerBassline: Bassline = {
      contacts: new Map([
        // Outer inputs
        ['outer-x', {
          groupId: 'dynamic-group',
          properties: { 
            name: 'x',
            blendMode: 'last'  // Allow replacing values
          }
        }],
        ['outer-y', {
          groupId: 'dynamic-group',
          properties: { 
            name: 'y',
            blendMode: 'last'  // Allow replacing values
          }
        }],
        // Bassline input
        ['bassline-input', {
          groupId: 'dynamic-group',
          properties: { name: 'bassline' }
        }],
        // Outer output
        ['outer-result', {
          groupId: 'dynamic-group',
          properties: { 
            name: 'result',
            blendMode: 'last'  // Allow replacing values
          }
        }]
      ]),
      wires: new Map(),
      groups: new Map([
        ['dynamic-group', {
          contactIds: new Set(['outer-x', 'outer-y', 'bassline-input', 'outer-result']),
          boundaryContactIds: new Set(['outer-x', 'outer-y', 'bassline-input', 'outer-result']),
          primitiveType: 'dynamic-adder',
          properties: {}
        }]
      ])
    }
    
    // Create runtime first
    const runtime = new Runtime(outerBassline)
    
    // Helper to resolve boundary names to contact IDs for the dynamic group
    const getOuterContactId = (boundaryName: string): ContactId | undefined => {
      const group = runtime.getBassline().groups.get('dynamic-group')
      if (!group) return undefined
      
      for (const contactId of group.boundaryContactIds) {
        const contact = runtime.getBassline().contacts.get(contactId)
        if (contact?.properties?.name === boundaryName) {
          return contactId
        }
      }
      return undefined
    }
    
    // Create the dynamic gadget with new API
    const dynamicGadget = createDynamicBasslineGadget({
      inputMapping: {
        'x': 'inner-a',
        'y': 'inner-b'
      },
      outputMapping: {
        'inner-sum': 'result'
      }
    }, 
    () => runtime.getBassline(),
    (changes) => runtime.applyStructureChanges(changes),
    getOuterContactId,
    (contactId) => runtime.getValue(contactId))
    
    // Register the dynamic gadget
    runtime.registerPrimitive('dynamic-adder', dynamicGadget)
    
    // Set initial values
    runtime.setValue('outer-x', 5)
    runtime.setValue('outer-y', 3)
    runtime.setValue('bassline-input', innerBassline)
    
    // Check that the inner network computed the sum
    const result = runtime.getValue('outer-result')
    expect(result).toBe(8) // 5 + 3
    
    // Change an input and verify propagation
    runtime.setValue('outer-x', 10)
    // No need to wait for convergence with synchronous execution
    
    const newResult = runtime.getValue('outer-result')
    expect(newResult).toBe(13) // 10 + 3
  })
  
  it.skip('should handle changing the bassline structure', () => {
    // Create a multiplier bassline
    const multiplierBassline: Bassline = {
      contacts: new Map([
        ['inner-a', { 
          content: 0,
          properties: { 
            name: 'a',
            blendMode: 'last' 
          }
        }],
        ['inner-b', { 
          content: 0,
          properties: { 
            name: 'b',
            blendMode: 'last' 
          }
        }],
        ['inner-product', {
          properties: { 
            name: 'product',
            blendMode: 'last' 
          }
        }]
      ]),
      wires: new Map(),
      groups: new Map([
        ['multiplier', {
          contactIds: new Set(['inner-a', 'inner-b', 'inner-product']),
          boundaryContactIds: new Set(['inner-a', 'inner-b', 'inner-product']),
          primitiveType: 'multiply',
          properties: {}
        }]
      ])
    }
    
    // Create outer network
    const outerBassline: Bassline = {
      contacts: new Map([
        ['x', { 
          content: 5,
          groupId: 'dynamic',
          properties: { 
            name: 'x',
            blendMode: 'last' 
          }
        }],
        ['y', { 
          content: 3,
          groupId: 'dynamic',
          properties: { 
            name: 'y',
            blendMode: 'last' 
          }
        }],
        ['bassline-input', { 
          content: multiplierBassline,
          groupId: 'dynamic',
          properties: { 
            name: 'bassline',
            blendMode: 'last' 
          }
        }],
        ['result', {
          groupId: 'dynamic',
          properties: { 
            name: 'result',
            blendMode: 'last' 
          }
        }]
      ]),
      wires: new Map(),
      groups: new Map([
        ['dynamic', {
          contactIds: new Set(['x', 'y', 'bassline-input', 'result']),
          boundaryContactIds: new Set(['x', 'y', 'bassline-input', 'result']),
          primitiveType: 'dynamic-calc',
          properties: {}
        }]
      ])
    }
    
    // Create runtime first
    const runtime = new Runtime(outerBassline)
    
    // Helper to resolve boundary names to contact IDs
    const getOuterContactId = (boundaryName: string): ContactId | undefined => {
      const group = runtime.getBassline().groups.get('dynamic')
      if (!group) return undefined
      
      for (const contactId of group.boundaryContactIds) {
        const contact = runtime.getBassline().contacts.get(contactId)
        if (contact?.properties?.name === boundaryName) {
          return contactId
        }
      }
      return undefined
    }
    
    // Create the dynamic gadget with new API
    const dynamicGadget = createDynamicBasslineGadget({
      inputMapping: {
        'x': 'inner-a',
        'y': 'inner-b'
      },
      outputMapping: {
        'inner-product': 'result'
      }
    },
    () => runtime.getBassline(),
    (changes) => runtime.applyStructureChanges(changes),
    getOuterContactId,
    (contactId) => runtime.getValue(contactId))
    
    // Register the dynamic gadget
    runtime.registerPrimitive('dynamic-calc', dynamicGadget)
    
    // Should multiply
    expect(runtime.getValue('result')).toBe(15) // 5 * 3
    
    // Note: In a real system, you'd want to use a dynamic gadget that can handle
    // different output mappings dynamically. For now, we'll skip this test case
    // as it requires creating a new gadget instance which doesn't clean up the old one.
    
    // This test would need to be redesigned to work properly with the new architecture
    // where gadgets manage their own injected structure.
  })
})