import { describe, it, expect, vi } from 'vitest'
import { exportGroupAsBassline, exportNetworkAsBassline } from '../export'
import { importBassline } from '../import'
import type { Group, GroupState, NetworkState, Contact, Wire, PropagationNetworkScheduler } from '../../types'
import type { Bassline } from '../types'

describe('Bassline Round-Trip', () => {
  // Create a mock scheduler that tracks everything
  function createTrackingScheduler() {
    const contacts = new Map<string, Contact>()
    const wires = new Map<string, Wire>()
    const groups = new Map<string, Group>()
    let idCounter = 0

    const scheduler: PropagationNetworkScheduler = {
      registerGroup: vi.fn(async (group) => {
        groups.set(group.id, group)
      }),
      
      scheduleUpdate: vi.fn(async (contactId, content) => {
        const contact = contacts.get(contactId)
        if (contact) {
          contact.content = content
        }
      }),
      
      schedulePropagation: vi.fn(async () => {}),
      
      connect: vi.fn(async (fromId, toId, type = 'bidirectional') => {
        const wireId = `wire-${++idCounter}`
        const wire: Wire = { id: wireId, groupId: 'test', fromId, toId, type }
        wires.set(wireId, wire)
        return wireId
      }),
      
      disconnect: vi.fn(async () => {}),
      
      addContact: vi.fn(async (groupId, contact) => {
        const contactId = `contact-${++idCounter}`
        const fullContact: Contact = { ...contact, id: contactId, groupId } as Contact
        contacts.set(contactId, fullContact)
        return contactId
      }),
      
      removeContact: vi.fn(async () => {}),
      
      addGroup: vi.fn(async (parentGroupId, group) => {
        const groupId = `group-${++idCounter}`
        const fullGroup: Group = {
          ...group,
          id: groupId,
          parentId: parentGroupId,
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: [],
        } as Group
        groups.set(groupId, fullGroup)
        return groupId
      }),
      
      removeGroup: vi.fn(async () => {}),
      
      getState: vi.fn(async (groupId) => {
        const group = groups.get(groupId)
        if (!group) throw new Error(`Group ${groupId} not found`)
        
        return {
          group,
          contacts: new Map(
            Array.from(contacts.entries())
              .filter(([_, c]) => c.groupId === groupId)
          ),
          wires: new Map(
            Array.from(wires.entries())
              .filter(([_, w]) => w.groupId === groupId)
          ),
        }
      }),
      
      getContact: vi.fn(async (id) => contacts.get(id)),
      getWire: vi.fn(async (id) => wires.get(id)),
      
      subscribe: vi.fn(() => () => {}),
    }

    return { scheduler, contacts, wires, groups }
  }

  describe('Simple Round-Trip', () => {
    it('should preserve basic topology through export/import', async () => {
      // Create original network
      const originalGroup: Group = {
        id: 'original',
        name: 'Test Network',
        contactIds: ['c1', 'c2'],
        wireIds: ['w1'],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {
          'bassline.pure': true,
          'permissions.modify': 'owner',
        },
      }

      const originalContacts = new Map<string, Contact>([
        ['c1', {
          id: 'c1',
          groupId: 'original',
          blendMode: 'accept-last',
          name: 'Contact 1',
          content: 42,
        }],
        ['c2', {
          id: 'c2',
          groupId: 'original',
          blendMode: 'merge',
          name: 'Contact 2',
          content: 'hello',
        }],
      ])

      const originalWires = new Map<string, Wire>([
        ['w1', {
          id: 'w1',
          groupId: 'original',
          fromId: 'c1',
          toId: 'c2',
          type: 'bidirectional',
        }],
      ])

      const originalState: GroupState = {
        group: originalGroup,
        contacts: originalContacts,
        wires: originalWires,
      }

      // Export to bassline
      const bassline = exportGroupAsBassline(originalGroup, originalState, {
        includeValues: true,
      })

      // Import into new network
      const { scheduler, contacts, wires } = createTrackingScheduler()
      const result = await importBassline(bassline, scheduler, {
        applySeeds: true,
      })

      // Verify structure
      expect(result.contacts).toHaveLength(2)
      expect(result.wires).toHaveLength(1)
      
      // Verify contacts
      const importedContacts = Array.from(contacts.values())
      expect(importedContacts).toHaveLength(2)
      
      const c1 = importedContacts.find(c => c.name === 'Contact 1')
      expect(c1?.blendMode).toBe('accept-last')
      expect(c1?.content).toBe(42)
      
      const c2 = importedContacts.find(c => c.name === 'Contact 2')
      expect(c2?.blendMode).toBe('merge')
      expect(c2?.content).toBe('hello')
      
      // Verify wire
      const importedWires = Array.from(wires.values())
      expect(importedWires).toHaveLength(1)
      expect(importedWires[0].type).toBe('bidirectional')
    })

    it('should preserve gadget interfaces', async () => {
      // Create a gadget with boundary contacts
      const gadgetGroup: Group = {
        id: 'gadget',
        name: 'My Gadget',
        contactIds: ['input', 'internal', 'output'],
        wireIds: ['w1', 'w2'],
        subgroupIds: [],
        boundaryContactIds: ['input', 'output'],
      }

      const gadgetContacts = new Map<string, Contact>([
        ['input', {
          id: 'input',
          groupId: 'gadget',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
          name: 'Input',
        }],
        ['internal', {
          id: 'internal',
          groupId: 'gadget',
          blendMode: 'merge',
          name: 'Internal',
        }],
        ['output', {
          id: 'output',
          groupId: 'gadget',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'output',
          name: 'Output',
        }],
      ])

      const gadgetWires = new Map<string, Wire>([
        ['w1', {
          id: 'w1',
          groupId: 'gadget',
          fromId: 'input',
          toId: 'internal',
          type: 'directed',
        }],
        ['w2', {
          id: 'w2',
          groupId: 'gadget',
          fromId: 'internal',
          toId: 'output',
          type: 'directed',
        }],
      ])

      const gadgetState: GroupState = {
        group: gadgetGroup,
        contacts: gadgetContacts,
        wires: gadgetWires,
      }

      // Export
      const bassline = exportGroupAsBassline(gadgetGroup, gadgetState)
      
      // Check interface was detected
      expect(bassline.interface).toBeDefined()
      expect(bassline.interface?.inputs).toEqual(['input'])
      expect(bassline.interface?.outputs).toEqual(['output'])

      // Import
      const { scheduler, contacts } = createTrackingScheduler()
      await importBassline(bassline, scheduler)

      // Verify boundary contacts preserved
      const importedContacts = Array.from(contacts.values())
      const inputContact = importedContacts.find(c => c.name === 'Input')
      const outputContact = importedContacts.find(c => c.name === 'Output')
      
      expect(inputContact?.isBoundary).toBe(true)
      expect(inputContact?.boundaryDirection).toBe('input')
      expect(outputContact?.isBoundary).toBe(true)
      expect(outputContact?.boundaryDirection).toBe('output')
    })

    it('should preserve attributes at all levels', async () => {
      const group: Group = {
        id: 'attrs',
        name: 'Attributed',
        contactIds: ['c1'],
        wireIds: ['w1'],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {
          'bassline.pure': true,
          'x-custom.field': 'group-value',
        },
      }

      const contacts = new Map<string, Contact>([
        ['c1', {
          id: 'c1',
          groupId: 'attrs',
          blendMode: 'accept-last',
          attributes: {
            'runtime.cache': true,
            'x-custom.contact': 'contact-value',
          },
        }],
        ['c2', {
          id: 'c2',
          groupId: 'attrs',
          blendMode: 'merge',
        }],
      ])

      const wires = new Map<string, Wire>([
        ['w1', {
          id: 'w1',
          groupId: 'attrs',
          fromId: 'c1',
          toId: 'c2',
          type: 'bidirectional',
          attributes: {
            'x-custom.wire': 'wire-value',
          },
        }],
      ])

      const state: GroupState = { group, contacts, wires }

      // Export and import
      const bassline = exportGroupAsBassline(group, state)
      expect(bassline.attributes).toEqual({
        'bassline.pure': true,
        'x-custom.field': 'group-value',
      })

      const { scheduler } = createTrackingScheduler()
      const result = await importBassline(bassline, scheduler)

      // Check all attributes preserved
      const c1 = result.contacts.find(c => c.attributes?.['x-custom.contact'])
      expect(c1?.attributes).toEqual({
        'runtime.cache': true,
        'x-custom.contact': 'contact-value',
      })

      const w1 = result.wires[0]
      expect(w1.attributes).toEqual({
        'x-custom.wire': 'wire-value',
      })
    })
  })

  describe('Complex Round-Trip', () => {
    it('should handle nested groups/gadgets', async () => {
      // Create a network with subgroups
      const rootGroup: Group = {
        id: 'root',
        name: 'Root',
        contactIds: [],
        wireIds: [],
        subgroupIds: ['sub1', 'sub2'],
        boundaryContactIds: [],
      }

      const sub1: Group = {
        id: 'sub1',
        name: 'Sub 1',
        parentId: 'root',
        contactIds: ['s1c1'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
      }

      const sub2: Group = {
        id: 'sub2',
        name: 'Sub 2',
        parentId: 'root',
        contactIds: ['s2c1'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
      }

      const networkState: NetworkState = {
        groups: new Map([
          ['root', {
            group: rootGroup,
            contacts: new Map(),
            wires: new Map(),
          }],
          ['sub1', {
            group: sub1,
            contacts: new Map([
              ['s1c1', {
                id: 's1c1',
                groupId: 'sub1',
                blendMode: 'accept-last',
              }],
            ]),
            wires: new Map(),
          }],
          ['sub2', {
            group: sub2,
            contacts: new Map([
              ['s2c1', {
                id: 's2c1',
                groupId: 'sub2',
                blendMode: 'merge',
              }],
            ]),
            wires: new Map(),
          }],
        ]),
        currentGroupId: 'root',
        rootGroupId: 'root',
      }

      // Export entire network
      const bassline = exportNetworkAsBassline(networkState)
      
      expect(bassline.name).toBe('Root')
      expect(bassline.build?.gadgets).toHaveLength(2)

      // Import
      const { scheduler, groups } = createTrackingScheduler()
      const result = await importBassline(bassline, scheduler)

      // Should create groups for nested gadgets
      expect(result.groups.length).toBeGreaterThan(0)
      expect(result.contacts).toHaveLength(2) // s1c1 and s2c1
    })

    it('should handle attribute contacts (@-prefixed)', async () => {
      const group: Group = {
        id: 'dynamic',
        name: 'Dynamic Gadget',
        contactIds: ['@config', '@schema', 'data'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@config', '@schema', 'data'],
        attributes: {
          'bassline.dynamic-attributes': {
            enabled: true,
            contact: '@config',
          },
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@schema',
          },
        },
      }

      const contacts = new Map<string, Contact>([
        ['@config', {
          id: '@config',
          groupId: 'dynamic',
          blendMode: 'merge',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['@schema', {
          id: '@schema',
          groupId: 'dynamic',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
        ['data', {
          id: 'data',
          groupId: 'dynamic',
          blendMode: 'accept-last',
          isBoundary: true,
          boundaryDirection: 'input',
        }],
      ])

      const state: GroupState = {
        group,
        contacts,
        wires: new Map(),
      }

      // Export
      const bassline = exportGroupAsBassline(group, state)
      
      // Should detect attribute contacts
      expect(bassline.interface?.attributes).toContain('@config')
      expect(bassline.interface?.attributes).toContain('@schema')
      
      // Should preserve dynamic attributes
      expect(bassline.attributes?.['bassline.dynamic-attributes']).toBeDefined()
      expect(bassline.attributes?.['bassline.dynamic-topology']).toBeDefined()

      // Import
      const { scheduler, contacts: imported } = createTrackingScheduler()
      const importResult = await importBassline(bassline, scheduler)

      // Should preserve @ prefixes through ID mapping
      const hasConfigContact = importResult.idMap.has('@config')
      const hasSchemaContact = importResult.idMap.has('@schema')
      expect(hasConfigContact).toBe(true)
      expect(hasSchemaContact).toBe(true)
      
      // The actual imported contacts should exist
      expect(imported.size).toBe(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty networks', async () => {
      const emptyGroup: Group = {
        id: 'empty',
        name: 'Empty',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
      }

      const emptyState: GroupState = {
        group: emptyGroup,
        contacts: new Map(),
        wires: new Map(),
      }

      const bassline = exportGroupAsBassline(emptyGroup, emptyState)
      expect(bassline.name).toBe('Empty')

      const { scheduler } = createTrackingScheduler()
      const result = await importBassline(bassline, scheduler)
      
      expect(result.contacts).toHaveLength(0)
      expect(result.wires).toHaveLength(0)
    })

    it('should handle topology-only export/import', async () => {
      const group: Group = {
        id: 'topo',
        name: 'Topology Only',
        contactIds: ['c1'],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {
          'bassline.pure': true,
        },
      }

      const contacts = new Map<string, Contact>([
        ['c1', {
          id: 'c1',
          groupId: 'topo',
          blendMode: 'accept-last',
          content: 'should not export',
          attributes: {
            'runtime.cache': true,
          },
        }],
      ])

      const state: GroupState = {
        group,
        contacts,
        wires: new Map(),
      }

      // Export topology only
      const bassline = exportGroupAsBassline(group, state, {
        topologyOnly: true,
      })

      // Should not include attributes or content
      expect(bassline.build?.topology.contacts[0].content).toBeUndefined()
      expect(bassline.build?.topology.contacts[0].attributes).toBeUndefined()
      expect(bassline.seeds).toBeUndefined()

      // Import should still work
      const { scheduler } = createTrackingScheduler()
      const result = await importBassline(bassline, scheduler)
      
      expect(result.contacts).toHaveLength(1)
      expect(result.contacts[0].content).toBeUndefined()
    })
  })
})