/**
 * Tests for the Properties Contact System
 */

import { describe, it, expect } from 'vitest'
import { Runtime } from '../runtime'
import { Bassline } from '../types'

describe('Properties Contact System', () => {
  it('should auto-create properties contact when creating a group', () => {
    const bassline: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    const runtime = new Runtime(bassline)
    
    // Create a group with default properties
    runtime.applyAction(['createGroup', 'group1', undefined, {
      defaultProperties: {
        theme: 'dark',
        maxItems: 100
      }
    }])
    
    // Check that properties contact was created
    const propertiesContact = runtime['context'].bassline.contacts.get('group1:properties')
    expect(propertiesContact).toBeDefined()
    expect(propertiesContact?.content).toEqual({
      theme: 'dark',
      maxItems: 100
    })
    expect(propertiesContact?.properties?.isSystemContact).toBe(true)
    expect(propertiesContact?.properties?.readOnlyFromInside).toBe(true)
    expect(propertiesContact?.properties?.blendMode).toBe('merge')
    
    // Check that it's added to the group
    const group = runtime['context'].bassline.groups.get('group1')
    expect(group?.contactIds.has('group1:properties')).toBe(true)
    expect(group?.boundaryContactIds.has('group1:properties')).toBe(true)
  })
  
  it('should allow reading properties from inside via directed wire', () => {
    const bassline: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    const runtime = new Runtime(bassline)
    
    // Create a group with properties
    runtime.applyAction(['createGroup', 'group1', undefined, {
      defaultProperties: { mode: 'test' }
    }])
    
    // Create an internal contact
    runtime.applyAction(['createContact', 'internal1', 'group1'])
    
    // Wire FROM properties TO internal (allowed)
    runtime.applyAction(['createWire', 'wire1', 'group1:properties', 'internal1', {
      bidirectional: false
    }])
    
    // Verify wire was created
    const wire = runtime['context'].bassline.wires.get('wire1')
    expect(wire).toBeDefined()
    expect(wire?.fromId).toBe('group1:properties')
    expect(wire?.toId).toBe('internal1')
  })
  
  it('should block wiring TO properties from inside the group', () => {
    const bassline: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    const runtime = new Runtime(bassline)
    
    // Create a group with properties
    runtime.applyAction(['createGroup', 'group1', undefined, {
      defaultProperties: { mode: 'test' }
    }])
    
    // Create an internal contact
    runtime.applyAction(['createContact', 'internal1', 'group1'])
    
    // Try to wire FROM internal TO properties (should fail)
    expect(() => {
      runtime.applyAction(['createWire', 'wire1', 'internal1', 'group1:properties'])
    }).toThrow(/Cannot wire from inside group to its properties contact/)
  })
  
  it('should allow parent to wire TO properties contact', () => {
    const bassline: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    const runtime = new Runtime(bassline)
    
    // Create parent and child groups
    runtime.applyAction(['createGroup', 'parent', undefined])
    runtime.applyAction(['createGroup', 'child', 'parent', {
      defaultProperties: { mode: 'child' }
    }])
    
    // Create a contact in parent
    runtime.applyAction(['createContact', 'parentContact', 'parent'])
    
    // Wire FROM parent TO child properties (allowed)
    runtime.applyAction(['createWire', 'wire1', 'parentContact', 'child:properties'])
    
    // Verify wire was created
    const wire = runtime['context'].bassline.wires.get('wire1')
    expect(wire).toBeDefined()
    expect(wire?.fromId).toBe('parentContact')
    expect(wire?.toId).toBe('child:properties')
  })
  
  it('should merge properties values when updated', () => {
    const bassline: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    const runtime = new Runtime(bassline)
    
    // Create a group with properties
    runtime.applyAction(['createGroup', 'group1', undefined, {
      defaultProperties: {
        theme: 'light',
        fontSize: 14
      }
    }])
    
    // Update properties value
    runtime.setValue('group1:properties', {
      theme: 'dark',  // Override
      maxLines: 100   // Add new
      // fontSize remains 14 due to merge
    })
    
    // Check merged value
    const value = runtime.getValue('group1:properties')
    expect(value).toEqual({
      theme: 'dark',
      fontSize: 14,
      maxLines: 100
    })
  })
  
  it('should propagate properties changes to wired internal contacts', async () => {
    const bassline: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    const runtime = new Runtime(bassline)
    
    // Create a group with properties
    runtime.applyAction(['createGroup', 'group1', undefined, {
      defaultProperties: { mode: 'initial' }
    }])
    
    // Create an internal contact and wire from properties
    runtime.applyAction(['createContact', 'reader', 'group1'])
    runtime.applyAction(['createWire', 'wire1', 'group1:properties', 'reader', {
      bidirectional: false
    }])
    
    // Update properties
    runtime.setValue('group1:properties', { mode: 'updated' })
    
    // Wait for propagation
    await runtime.waitForConvergence()
    
    // Check that reader got the update
    const readerValue = runtime.getValue('reader')
    expect(readerValue).toEqual({ mode: 'updated' })
  })
  
  it('should block propagation back to properties from internal contacts', async () => {
    const bassline: Bassline = {
      contacts: new Map(),
      wires: new Map(),
      groups: new Map()
    }
    
    const runtime = new Runtime(bassline)
    
    // Create a group with properties
    runtime.applyAction(['createGroup', 'group1', undefined, {
      defaultProperties: { value: 1 }
    }])
    
    // Create internal contacts with bidirectional wire
    runtime.applyAction(['createContact', 'internal1', 'group1'])
    runtime.applyAction(['createContact', 'internal2', 'group1'])
    
    // Wire internal1 to internal2 (bidirectional)
    runtime.applyAction(['createWire', 'wire1', 'internal1', 'internal2'])
    
    // Try to wire from properties to internal1 (directed)
    runtime.applyAction(['createWire', 'wire2', 'group1:properties', 'internal1', {
      bidirectional: false
    }])
    
    // Set value on internal2 - should propagate to internal1 but NOT back to properties
    runtime.setValue('internal2', { value: 2 })
    await runtime.waitForConvergence()
    
    // Check values
    expect(runtime.getValue('internal1')).toEqual({ value: 2 })
    expect(runtime.getValue('internal2')).toEqual({ value: 2 })
    expect(runtime.getValue('group1:properties')).toEqual({ value: 1 }) // Unchanged!
  })
})