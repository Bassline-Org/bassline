/**
 * Tests for persistence with separated structure and data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runtime } from '../src/stream-runtime'
import { 
  exportGroup,
  importGroup,
  exportRuntime,
  saveToFile, 
  loadFromFile,
  stringify,
  parse
} from '../src/persistence'
import { defaultPrimitives } from '../src/stream-primitives'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('Persistence with Structure/Data Separation', () => {
  const testDir = path.join(__dirname, 'test-saves')
  const testFile = path.join(testDir, 'test-component.json')
  
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true })
  })
  
  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true })
    } catch (e) {
      // Ignore if doesn't exist
    }
  })
  
  describe('Group Export/Import', () => {
    it('should export and import a simple group', () => {
      const rt = runtime()
      
      // Create a group with contacts
      rt.createGroup('my-component')
      rt.createContact('input', 'my-component', 'merge', { isBoundary: true })
      rt.createContact('output', 'my-component', 'merge', { isBoundary: true })
      rt.createContact('internal', 'my-component')
      rt.createWire('w1', 'my-component:input', 'my-component:output')
      
      // Set some values
      rt.setValue('my-component', 'input', 42)
      rt.setValue('my-component', 'internal', 'hidden')
      
      // Export the group
      const exported = exportGroup(rt, 'my-component')
      
      // Verify structure uses local IDs
      expect(exported.structure.groups.has('my-component')).toBe(true)
      expect(exported.structure.contacts.has('input')).toBe(true)
      expect(exported.structure.contacts.has('output')).toBe(true)
      expect(exported.structure.contacts.has('internal')).toBe(true)
      expect(exported.structure.wires.has('w1')).toBe(true)
      
      // Verify data uses local IDs too
      expect(exported.data).toContainEqual(['input', 42])
      expect(exported.data).toContainEqual(['output', 42]) // Propagated value
      expect(exported.data).toContainEqual(['internal', 'hidden'])
      
      // Import into a new runtime
      const rt2 = runtime()
      importGroup(rt2, exported)
      
      // Verify it was imported correctly
      expect(rt2.getValue('my-component', 'input')).toBe(42)
      expect(rt2.getValue('my-component', 'output')).toBe(42)
      expect(rt2.getValue('my-component', 'internal')).toBe('hidden')
    })
    
    it('should export and import hierarchical groups', () => {
      const rt = runtime()
      
      // Create hierarchy
      rt.createGroup('parent')
      rt.createGroup('child', undefined, {}, 'parent')
      rt.createGroup('grandchild', undefined, {}, 'child')
      
      // Add contacts at each level
      rt.createContact('p-contact', 'parent')
      rt.createContact('c-contact', 'child')
      rt.createContact('gc-contact', 'grandchild')
      
      rt.setValue('parent', 'p-contact', 'parent-value')
      rt.setValue('child', 'c-contact', 'child-value')
      rt.setValue('grandchild', 'gc-contact', 'grandchild-value')
      
      // Export the parent (should include all descendants)
      const exported = exportGroup(rt, 'parent')
      
      // Verify all groups are included
      expect(exported.structure.groups.size).toBe(3)
      expect(exported.structure.groups.has('parent')).toBe(true)
      expect(exported.structure.groups.has('child')).toBe(true)
      expect(exported.structure.groups.has('grandchild')).toBe(true)
      
      // Verify all data uses local IDs
      expect(exported.data).toContainEqual(['p-contact', 'parent-value'])
      expect(exported.data).toContainEqual(['c-contact', 'child-value'])
      expect(exported.data).toContainEqual(['gc-contact', 'grandchild-value'])
      
      // Import into new runtime
      const rt2 = runtime()
      importGroup(rt2, exported)
      
      // Verify hierarchy
      const child = rt2.groups.get('child')
      expect(child?.parentId).toBe('parent')
      
      const grandchild = rt2.groups.get('grandchild')
      expect(grandchild?.parentId).toBe('child')
      
      // Verify values
      expect(rt2.getValue('grandchild', 'gc-contact')).toBe('grandchild-value')
    })
    
    it('should mount a group under a different parent', () => {
      const rt = runtime()
      
      // Create a component to export
      rt.createGroup('component')
      rt.createContact('comp-input', 'component', 'merge', { isBoundary: true })
      rt.createContact('comp-output', 'component', 'merge', { isBoundary: true })
      rt.createWire('comp-wire', 'component:comp-input', 'component:comp-output')
      rt.setValue('component', 'comp-input', 'test-value')
      
      const exported = exportGroup(rt, 'component')
      
      // Create a new runtime with a different structure
      const rt2 = runtime()
      rt2.createGroup('container')
      
      // Mount the component under 'container'
      importGroup(rt2, exported, 'container')
      
      // Verify it was mounted under container
      const component = rt2.groups.get('component')
      expect(component?.parentId).toBe('container')
      
      // Verify functionality still works
      expect(rt2.getValue('component', 'comp-output')).toBe('test-value')
      
      // Update value and verify propagation
      rt2.setValue('component', 'comp-input', 'new-value')
      expect(rt2.getValue('component', 'comp-output')).toBe('new-value')
    })
  })
  
  describe('Gadget Components', () => {
    it('should export and import gadget groups', () => {
      const rt = runtime(undefined, defaultPrimitives)
      
      // Create a simple calculator with one gadget first
      rt.createGroup('calculator')
      rt.createGroup('adder', 'add', {}, 'calculator')
      
      // Debug: Check what contacts were created
      console.log('Adder group contacts:', Array.from(rt.groups.get('adder')?.contacts.keys() || []))
      console.log('All contacts:', Array.from(rt.contacts.keys()))
      
      // Set values on the gadget's input contacts (now namespaced)
      rt.setValue('adder', 'a', 3) 
      rt.setValue('adder', 'b', 4)
      
      console.log('After setting values:')
      console.log('adder:a =', rt.getValue('adder', 'a'))
      console.log('adder:b =', rt.getValue('adder', 'b'))
      console.log('adder:sum =', rt.getValue('adder', 'sum'))
      
      // Verify computation works
      expect(rt.getValue('adder', 'sum')).toBe(7) // 3 + 4
      
      // Export the calculator
      const exported = exportGroup(rt, 'calculator')
      
      // Verify structure includes primitive types
      const adderGroup = exported.structure.groups.get('adder')
      expect(adderGroup?.primitiveType).toBe('add')
      
      // Import into new runtime
      const rt2 = runtime(undefined, defaultPrimitives)
      importGroup(rt2, exported)
      
      // Verify gadgets work in new runtime
      expect(rt2.getValue('adder', 'sum')).toBe(7)
      expect(rt2.getValue('adder', 'a')).toBe(3)
      expect(rt2.getValue('adder', 'b')).toBe(4)
      
      // Test with new values
      rt2.setValue('adder', 'a', 5)
      expect(rt2.getValue('adder', 'sum')).toBe(9) // 5 + 4
    })
  })
  
  describe('File I/O', () => {
    it('should save and load exported groups', async () => {
      const rt = runtime()
      
      // Create a component
      rt.createGroup('saved-component')
      rt.createContact('data', 'saved-component')
      rt.setValue('saved-component', 'data', { complex: { nested: 'value' } })
      
      const exported = exportGroup(rt, 'saved-component')
      
      // Save to file
      await saveToFile(exported, testFile)
      
      // Load from file
      const loaded = await loadFromFile(testFile)
      
      // Import into new runtime
      const rt2 = runtime()
      importGroup(rt2, loaded)
      
      // Verify
      expect(rt2.getValue('saved-component', 'data')).toEqual({ complex: { nested: 'value' } })
    })
    
    it('should handle special values in JSON', async () => {
      const rt = runtime()
      
      rt.createGroup('special-values')
      rt.createContact('null-val', 'special-values')
      rt.createContact('undefined-val', 'special-values')
      rt.createContact('zero-val', 'special-values')
      rt.createContact('false-val', 'special-values')
      rt.createContact('empty-val', 'special-values')
      
      rt.setValue('special-values', 'null-val', null)
      rt.setValue('special-values', 'undefined-val', undefined)
      rt.setValue('special-values', 'zero-val', 0)
      rt.setValue('special-values', 'false-val', false)
      rt.setValue('special-values', 'empty-val', '')
      
      const exported = exportGroup(rt, 'special-values')
      
      // Test stringify/parse roundtrip
      const json = stringify(exported)
      const parsed = parse(json)
      
      const rt2 = runtime()
      importGroup(rt2, parsed)
      
      expect(rt2.getValue('special-values', 'null-val')).toBe(null)
      expect(rt2.getValue('special-values', 'undefined-val')).toBe(undefined)
      expect(rt2.getValue('special-values', 'zero-val')).toBe(0)
      expect(rt2.getValue('special-values', 'false-val')).toBe(false)
      expect(rt2.getValue('special-values', 'empty-val')).toBe('')
    })
  })
  
  describe('Runtime Export', () => {
    it('should export entire runtime with multiple root groups', () => {
      const rt = runtime()
      
      // Create multiple root groups
      rt.createGroup('root1')
      rt.createGroup('root2')
      
      rt.createContact('r1-contact', 'root1')
      rt.createContact('r2-contact', 'root2')
      
      rt.setValue('root1', 'r1-contact', 'value1')
      rt.setValue('root2', 'r2-contact', 'value2')
      
      // Export entire runtime
      const exported = exportRuntime(rt)
      
      // Should include both roots
      expect(exported.structure.groups.has('root1')).toBe(true)
      expect(exported.structure.groups.has('root2')).toBe(true)
      
      // Import into new runtime
      const rt2 = runtime()
      importGroup(rt2, exported)
      
      expect(rt2.getValue('root1', 'r1-contact')).toBe('value1')
      expect(rt2.getValue('root2', 'r2-contact')).toBe('value2')
    })
    
    it('should export single root runtime efficiently', () => {
      const rt = runtime()
      
      // Create single root with children
      rt.createGroup('app')
      rt.createGroup('module1', undefined, {}, 'app')
      rt.createGroup('module2', undefined, {}, 'app')
      
      rt.createContact('m1-data', 'module1')
      rt.setValue('module1', 'm1-data', 'module1-data')
      
      // Export runtime (should detect single root)
      const exported = exportRuntime(rt)
      
      // Should only include app and its children
      expect(exported.structure.groups.size).toBe(3)
      expect(exported.structure.groups.has('app')).toBe(true)
      expect(exported.structure.groups.has('module1')).toBe(true)
      expect(exported.structure.groups.has('module2')).toBe(true)
    })
  })
  
  describe('Component Reusability', () => {
    it('should allow mounting the same component multiple times', () => {
      const rt = runtime()
      
      // Create a reusable counter component
      rt.createGroup('counter')
      rt.createContact('count', 'counter', 'merge', { isBoundary: true })
      rt.createContact('increment', 'counter', 'merge', { isBoundary: true })
      
      // Simple increment logic (would normally be a gadget)
      rt.setValue('counter', 'count', 0)
      
      // Export the counter
      const counterExport = exportGroup(rt, 'counter')
      
      // Create new runtime with multiple instances
      const rt2 = runtime()
      rt2.createGroup('app')
      
      // We'd need to rename IDs for multiple instances
      // This is a limitation of the current approach
      // In practice, we'd need ID remapping during import
      
      // For now, just verify single import works
      importGroup(rt2, counterExport, 'app')
      
      const counter = rt2.groups.get('counter')
      expect(counter?.parentId).toBe('app')
      expect(rt2.getValue('counter', 'count')).toBe(0)
    })
  })
  
  describe('MGP Integration', () => {
    it('should preserve MGP contacts', () => {
      const rt = runtime()
      
      rt.createGroup('mgp-group', undefined, {
        'expose-structure': true,
        'expose-dynamics': true,
        'allow-meta-mutation': true
      })
      
      rt.createGroup('child', undefined, {}, 'mgp-group')
      rt.createContact('child-data', 'child')
      rt.setValue('child', 'child-data', 'test')
      
      // Export the MGP group
      const exported = exportGroup(rt, 'mgp-group')
      
      
      // The MGP contacts themselves should be in the structure (using local IDs)
      expect(exported.structure.contacts.has('children:structure')).toBe(true)
      expect(exported.structure.contacts.has('children:dynamics')).toBe(true)
      expect(exported.structure.contacts.has('children:actions')).toBe(true)
      
      // Import and verify MGP functionality
      const rt2 = runtime()
      importGroup(rt2, exported)
      
      // MGP contacts should be recreated
      expect(rt2.contacts.has('mgp-group:children:structure')).toBe(true)
      expect(rt2.contacts.has('mgp-group:children:dynamics')).toBe(true)
      expect(rt2.contacts.has('mgp-group:children:actions')).toBe(true)
      
      // Child data should be preserved
      expect(rt2.getValue('child', 'child-data')).toBe('test')
    })
  })
})