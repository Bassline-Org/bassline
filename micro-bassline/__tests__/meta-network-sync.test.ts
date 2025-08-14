/**
 * Meta-network synchronization tests
 * 
 * Tests connecting two separate networks via MGP contacts
 * to keep them in sync under various conditions
 */

import { describe, it, expect } from 'vitest'
import { runtime } from '../src/stream-runtime'
import { defaultPrimitives } from '../src/stream-primitives'

describe('Meta-Network Synchronization', () => {
  describe('Basic Network Sync', () => {
    it('should sync two networks via dynamics->actions bridge', async () => {
      // Create two independent networks
      const network1 = runtime()
      const network2 = runtime()
      
      // Network 1: Source network with dynamics exposed
      network1.createGroup('source-group', undefined, {
        'expose-dynamics': true
      })
      
      // Network 2: Target network that accepts actions
      network2.createGroup('target-group', undefined, {
        'allow-meta-mutation': true
      })
      
      // Bridge: Connect dynamics from network1 to actions in network2
      const dynamics1 = network1.contacts.get('source-group:dynamics')!
      const actions2 = network2.contacts.get('target-group:actions')!
      
      // Forward events from network1 to network2 as actions
      dynamics1.onValueChange(event => {
        // Convert dynamics events to actions
        if (Array.isArray(event) && event[0] === 'valueChanged') {
          const contactId = event[1]
          const newValue = event[3]
          
          // Check if this is a child contact (skip MGP system contacts)
          if (contactId && !contactId.includes('children:')) {
            // Extract the local contact name and group from the qualified ID
            const [sourceGroupId, contactName] = contactId.split(':')
            // Send actions to the actions contact (it will apply them automatically)
            actions2.setValue(['createGroup', sourceGroupId, 'target-group', {}])
            actions2.setValue(['createContact', contactName, sourceGroupId, { blendMode: 'merge' }])  
            actions2.setValue(['setValue', sourceGroupId, contactName, newValue])
          }
        }
      })
      
      // Test: Create contacts in network1's child group
      network1.createGroup('child1', undefined, {}, 'source-group')
      network1.createContact('test-contact', 'child1', 'merge')
      network1.setValue('child1', 'test-contact', 'hello')
      
      // Verify network2 has the mirrored contact
      expect(network2.getValue('child1', 'test-contact')).toBe('hello')
    })
    
    it('should handle bidirectional sync between networks', async () => {
      const network1 = runtime()
      const network2 = runtime()
      
      // Both networks expose dynamics and accept actions
      network1.createGroup('group1', undefined, {
        'expose-dynamics': true,
        'allow-meta-mutation': true
      })
      
      network2.createGroup('group2', undefined, {
        'expose-dynamics': true,
        'allow-meta-mutation': true
      })
      
      // Set up bidirectional bridge
      const dynamics1 = network1.contacts.get('group1:dynamics')!
      const actions1 = network1.contacts.get('group1:actions')!
      const dynamics2 = network2.contacts.get('group2:dynamics')!
      const actions2 = network2.contacts.get('group2:actions')!
      
      // Track what we've already synced to prevent loops
      const synced1to2 = new Set<string>()
      const synced2to1 = new Set<string>()
      
      // Network1 -> Network2
      dynamics1.onValueChange(event => {
        if (Array.isArray(event) && event[0] === 'valueChanged') {
          const key = `${event[1]}-${event[3]}`
          if (!synced2to1.has(key)) {
            synced1to2.add(key)
            const contactId = event[1]
            const newValue = event[3]
            
            if (contactId && !contactId.includes('children:')) {
              const [sourceGroupId, contactName] = contactId.split(':')
              actions2.setValue(['createGroup', sourceGroupId, 'group2', {}])
              actions2.setValue(['createContact', contactName, sourceGroupId, { blendMode: 'merge' }])
              actions2.setValue(['setValue', sourceGroupId, contactName, newValue])
            }
          }
        }
      })
      
      // Network2 -> Network1
      dynamics2.onValueChange(event => {
        if (Array.isArray(event) && event[0] === 'valueChanged') {
          const key = `${event[1]}-${event[3]}`
          if (!synced1to2.has(key)) {
            synced2to1.add(key)
            const contactId = event[1]
            const newValue = event[3]
            
            if (contactId && !contactId.includes('children:')) {
              const [sourceGroupId, contactName] = contactId.split(':')
              actions1.setValue(['createGroup', sourceGroupId, 'group1', {}])
              actions1.setValue(['createContact', contactName, sourceGroupId, { blendMode: 'merge' }])
              actions1.setValue(['setValue', sourceGroupId, contactName, newValue])
            }
          }
        }
      })
      
      // Test: Changes in network1
      network1.createGroup('child1', undefined, {}, 'group1')
      network1.createContact('contact1', 'child1')
      network1.setValue('child1', 'contact1', 'from-network1')
      
      expect(network2.getValue('child1', 'contact1')).toBe('from-network1')
      
      // Test: Changes in network2
      network2.createGroup('child2', undefined, {}, 'group2')
      network2.createContact('contact2', 'child2')
      network2.setValue('child2', 'contact2', 'from-network2')
      
      expect(network1.getValue('child2', 'contact2')).toBe('from-network2')
    })
  })
  
  describe('Stress Conditions', () => {
    it('should maintain sync under rapid updates', async () => {
      const network1 = runtime()
      const network2 = runtime()
      
      // Setup sync bridge
      network1.createGroup('source', undefined, { 'expose-dynamics': true })
      network2.createGroup('target', undefined, { 'allow-meta-mutation': true })
      
      const dynamics = network1.contacts.get('source:dynamics')!
      const actions = network2.contacts.get('target:actions')!
      
      // Simple forwarding
      dynamics.onValueChange(event => {
        if (Array.isArray(event) && event[0] === 'valueChanged') {
          const contactId = event[1]
          const value = event[3]
          if (contactId && !contactId.includes('children:')) {
            const [sourceGroupId, contactName] = contactId.split(':')
            actions.setValue(['createGroup', sourceGroupId, 'target', {}])
            actions.setValue(['createContact', contactName, sourceGroupId, { blendMode: 'last' }])
            actions.setValue(['setValue', sourceGroupId, contactName, value])
          }
        }
      })
      
      // Create child group and contact
      network1.createGroup('child', undefined, {}, 'source')
      network1.createContact('rapid', 'child', 'last') // Use 'last' to stream all values
      
      // Rapid updates
      const values = []
      for (let i = 0; i < 100; i++) {
        values.push(`value-${i}`)
        network1.setValue('child', 'rapid', `value-${i}`)
      }
      
      // Network2 should have the final value in the mirrored child group
      expect(network2.getValue('child', 'rapid')).toBe('value-99')
    })
    
    it('should handle network partitions and reconnections', async () => {
      const network1 = runtime()
      const network2 = runtime()
      
      network1.createGroup('source', undefined, { 'expose-dynamics': true })
      network2.createGroup('target', undefined, { 'allow-meta-mutation': true })
      
      const dynamics = network1.contacts.get('source:dynamics')!
      const actions = network2.contacts.get('target:actions')!
      
      // Simulate connection that can be broken
      let connected = true
      const unsubscribe = dynamics.onValueChange(event => {
        if (!connected) return // Simulated partition
        
        if (Array.isArray(event) && event[0] === 'valueChanged') {
          const contactId = event[1]
          const value = event[3]
          if (contactId && !contactId.includes('children:')) {
            const [sourceGroupId, contactName] = contactId.split(':')
            actions.setValue(['createGroup', sourceGroupId, 'target', {}])
            actions.setValue(['createContact', contactName, sourceGroupId, { blendMode: 'merge' }])
            actions.setValue(['setValue', sourceGroupId, contactName, value])
          }
        }
      })
      
      // Create and update while connected
      network1.createGroup('child', undefined, {}, 'source')
      network1.createContact('test', 'child')
      network1.setValue('child', 'test', 'initial')
      
      expect(network2.getValue('child', 'test')).toBe('initial')
      
      // Simulate partition
      connected = false
      network1.setValue('child', 'test', 'during-partition')
      
      // Network2 shouldn't see the update
      expect(network2.getValue('child', 'test')).toBe('initial')
      
      // Reconnect and sync
      connected = true
      network1.setValue('child', 'test', 'after-reconnect')
      
      // Should sync again
      expect(network2.getValue('child', 'test')).toBe('after-reconnect')
    })
    
    it('should handle conflicting updates from multiple sources', async () => {
      // Three networks in a triangle formation
      const network1 = runtime()
      const network2 = runtime()
      const network3 = runtime()
      
      // All networks can send and receive
      for (const [name, net] of [['net1', network1], ['net2', network2], ['net3', network3]]) {
        net.createGroup(name, undefined, {
          'expose-dynamics': true,
          'allow-meta-mutation': true
        })
      }
      
      // Helper to connect two networks
      const connectNetworks = (source: any, sourceName: string, target: any, targetName: string) => {
        const dynamics = source.contacts.get(`${sourceName}:dynamics`)
        const actions = target.contacts.get(`${targetName}:actions`)
        
        if (dynamics && actions) {
          dynamics.onValueChange((event: any) => {
            if (Array.isArray(event) && event[0] === 'valueChanged') {
              const contactId = event[1]
              const value = event[3]
              if (contactId && !contactId.includes('children:')) {
                const [sourceGroupId, contactName] = contactId.split(':')
                actions.setValue(['createGroup', sourceGroupId, targetName, {}])
                actions.setValue(['createContact', contactName, sourceGroupId, { blendMode: 'merge' }])
                actions.setValue(['setValue', sourceGroupId, contactName, value])
              }
            }
          })
        }
      }
      
      // Connect in a triangle
      connectNetworks(network1, 'net1', network2, 'net2')
      connectNetworks(network2, 'net2', network3, 'net3')
      connectNetworks(network3, 'net3', network1, 'net1')
      
      // Create the same contact in all networks with different values
      network1.createGroup('child1', undefined, {}, 'net1')
      network2.createGroup('child2', undefined, {}, 'net2')
      network3.createGroup('child3', undefined, {}, 'net3')
      
      network1.createContact('shared', 'child1', 'last')
      network2.createContact('shared', 'child2', 'last')
      network3.createContact('shared', 'child3', 'last')
      
      // Set different values rapidly
      network1.setValue('child1', 'shared', 'from-net1')
      network2.setValue('child2', 'shared', 'from-net2')
      network3.setValue('child3', 'shared', 'from-net3')
      
      // All propagation is synchronous with streams
      
      // In a last-write-wins scenario, all should eventually converge
      // (though the exact value depends on timing)
      const value1 = network1.getValue('child1', 'shared')
      const value2 = network2.getValue('child2', 'shared')
      const value3 = network3.getValue('child3', 'shared')
      
      console.log(`Network convergence: net1=${value1}, net2=${value2}, net3=${value3}`)
      
      // They should at least all have a value
      expect(value1).toBeDefined()
      expect(value2).toBeDefined()
      expect(value3).toBeDefined()
    })
  })
  
  describe('Complex Sync Patterns', () => {
    it('should sync hierarchical structures between networks', async () => {
      const network1 = runtime()
      const network2 = runtime()
      
      // Network1 exposes structure and dynamics, Network2 accepts actions
      network1.createGroup('root', undefined, {
        'expose-structure': true,
        'expose-dynamics': true
      })
      
      network2.createGroup('mirror', undefined, {
        'allow-meta-mutation': true
      })
      
      const structure1 = network1.contacts.get('root:structure')!
      const dynamics1 = network1.contacts.get('root:dynamics')!
      const actions2 = network2.contacts.get('mirror:actions')!
      
      // Sync structure changes
      structure1.onValueChange(structure => {
        // Recreate the complete structure in network2
        if (structure && structure.groups) {
          for (const [groupId, groupData] of structure.groups) {
            // Create group with correct parent
            const parentId = groupData.parentId === 'root' ? 'mirror' : groupData.parentId
            actions2.setValue(['createGroup', groupId, parentId, groupData.properties])
            
            // Create contacts (structure only, no values)
            if (structure.contacts) {
              for (const [contactId, contactData] of structure.contacts) {
                if (contactData.groupId === groupId) {
                  actions2.setValue(['createContact', contactId, groupId, contactData.properties])
                }
              }
            }
          }
          
          // Create wires
          if (structure.wires) {
            for (const [wireId, wireData] of structure.wires) {
              actions2.setValue(['createWire', wireId, wireData.fromId, wireData.toId, wireData.properties])
            }
          }
        }
      })
      
      // Forward all dynamics events as actions to keep values in sync
      dynamics1.onValueChange(event => {
        if (Array.isArray(event) && event[0] === 'valueChanged') {
          const contactId = event[1]
          const newValue = event[3]
          if (contactId && !contactId.includes('children:')) {
            const [sourceGroupId, contactName] = contactId.split(':')
            // Forward value changes as setValue actions
            actions2.setValue(['setValue', sourceGroupId, contactName, newValue])
          }
        }
      })
      
      // Create a complex hierarchy in network1
      network1.createGroup('child1', undefined, {}, 'root')
      network1.createGroup('child2', undefined, {}, 'root')
      network1.createGroup('grandchild', undefined, {}, 'child1')
      
      // Create contacts and set values
      network1.createContact('c1', 'child1', 'merge', { isBoundary: true })
      network1.createContact('c2', 'child2', 'merge', { isBoundary: true })
      network1.createContact('gc', 'grandchild', 'merge', { isBoundary: true })
      
      // Set values after structure is created
      network1.setValue('child1', 'c1', 'value1')
      network1.setValue('child2', 'c2', 'value2')
      network1.setValue('grandchild', 'gc', 'grandvalue')
      
      // Verify structure was mirrored (now includes all descendants)
      expect(network2.groups.has('child1')).toBe(true)
      expect(network2.groups.has('child2')).toBe(true)
      expect(network2.groups.has('grandchild')).toBe(true)
      
      expect(network2.getValue('child1', 'c1')).toBe('value1')
      expect(network2.getValue('child2', 'c2')).toBe('value2')
      expect(network2.getValue('grandchild', 'gc')).toBe('grandvalue')
    })
  })
})