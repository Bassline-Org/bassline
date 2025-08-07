import { describe, it, expect, vi } from 'vitest'
import { 
  importBassline,
  createGroupFromBassline,
  type ImportOptions,
  type ImportResult
} from '../import'
import type { Bassline } from '../types'
import type { PropagationNetworkScheduler } from '../../types'

describe('Bassline Import', () => {
  // Create a mock scheduler
  function createMockScheduler(): PropagationNetworkScheduler & {
    contacts: Map<string, any>
    wires: Map<string, any>
    groups: Map<string, any>
  } {
    const contacts = new Map()
    const wires = new Map()
    const groups = new Map()
    let contactCounter = 0
    let wireCounter = 0
    let groupCounter = 0

    return {
      contacts,
      wires,
      groups,
      
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
        const wireId = `wire-${++wireCounter}`
        wires.set(wireId, { id: wireId, fromId, toId, type })
        return wireId
      }),
      
      disconnect: vi.fn(async () => {}),
      
      addContact: vi.fn(async (groupId, contact) => {
        const contactId = `contact-${++contactCounter}`
        contacts.set(contactId, { ...contact, id: contactId, groupId })
        return contactId
      }),
      
      removeContact: vi.fn(async () => {}),
      
      addGroup: vi.fn(async (parentGroupId, group) => {
        const groupId = `group-${++groupCounter}`
        groups.set(groupId, { ...group, id: groupId, parentId: parentGroupId })
        return groupId
      }),
      
      removeGroup: vi.fn(async () => {}),
      
      getState: vi.fn(async () => ({
        group: {} as any,
        contacts: new Map(),
        wires: new Map(),
      })),
      
      getContact: vi.fn(async (id) => contacts.get(id)),
      getWire: vi.fn(async (id) => wires.get(id)),
      
      subscribe: vi.fn(() => () => {}),
    }
  }

  describe('importBassline', () => {
    it('should import a simple topology', async () => {
      const bassline: Bassline = {
        name: 'Simple Network',
        build: {
          topology: {
            contacts: [
              { id: 'c1', blendMode: 'accept-last' },
              { id: 'c2', blendMode: 'merge' },
            ],
            wires: [
              { id: 'w1', fromId: 'c1', toId: 'c2', type: 'bidirectional' },
            ],
          },
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler)

      expect(result.contacts).toHaveLength(2)
      expect(result.wires).toHaveLength(1)
      expect(result.idMap.size).toBe(2) // Maps bassline IDs to actual IDs
      expect(scheduler.addContact).toHaveBeenCalledTimes(2)
      expect(scheduler.connect).toHaveBeenCalledTimes(1)
    })

    it('should import with attributes', async () => {
      const bassline: Bassline = {
        name: 'Network with Attributes',
        attributes: {
          'bassline.pure': true,
          'permissions.modify': 'owner',
        },
        build: {
          topology: {
            contacts: [
              { 
                id: 'c1', 
                blendMode: 'accept-last',
                attributes: {
                  'runtime.cache': true,
                },
              },
            ],
          },
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler)

      expect(result.contacts[0].attributes).toEqual({
        'runtime.cache': true,
      })
    })

    it('should import boundary contacts with interface', async () => {
      const bassline: Bassline = {
        name: 'Gadget',
        interface: {
          inputs: ['input'],
          outputs: ['output'],
        },
        build: {
          topology: {
            contacts: [
              { 
                id: 'input', 
                blendMode: 'accept-last',
                isBoundary: true,
                boundaryDirection: 'input',
              },
              { 
                id: 'output', 
                blendMode: 'accept-last',
                isBoundary: true,
                boundaryDirection: 'output',
              },
            ],
          },
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler)

      expect(result.contacts).toHaveLength(2)
      expect(result.contacts[0].isBoundary).toBe(true)
      expect(result.contacts[0].boundaryDirection).toBe('input')
      expect(result.contacts[1].isBoundary).toBe(true)
      expect(result.contacts[1].boundaryDirection).toBe('output')
    })

    it('should apply seeds when requested', async () => {
      const bassline: Bassline = {
        name: 'Network with Seeds',
        build: {
          topology: {
            contacts: [
              { id: 'c1', blendMode: 'accept-last' },
              { id: 'c2', blendMode: 'accept-last' },
            ],
          },
        },
        seeds: {
          'c1': 42,
          'c2': 'hello',
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler, {
        applySeeds: true,
      })

      expect(scheduler.scheduleUpdate).toHaveBeenCalledTimes(2)
      const c1ActualId = result.idMap.get('c1')
      const c2ActualId = result.idMap.get('c2')
      expect(scheduler.scheduleUpdate).toHaveBeenCalledWith(c1ActualId, 42)
      expect(scheduler.scheduleUpdate).toHaveBeenCalledWith(c2ActualId, 'hello')
    })

    it('should import nested gadgets', async () => {
      const bassline: Bassline = {
        name: 'Parent',
        build: {
          gadgets: [
            {
              id: 'child1',
              type: 'normal',
              bassline: {
                name: 'Child 1',
                build: {
                  topology: {
                    contacts: [
                      { id: 'c1', blendMode: 'accept-last' },
                    ],
                  },
                },
              },
            },
            {
              id: 'child2',
              type: 'normal',
              topology: {
                contacts: [
                  { id: 'c2', blendMode: 'merge' },
                ],
              },
            },
          ],
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler)

      expect(result.contacts).toHaveLength(2)
      expect(scheduler.addContact).toHaveBeenCalledTimes(2)
    })

    it('should validate bassline when requested', async () => {
      const invalidBassline: Bassline = {
        name: '', // Invalid: empty name
        build: {}, // Invalid: empty build
      }

      const scheduler = createMockScheduler()
      
      await expect(
        importBassline(invalidBassline, scheduler, { validate: true })
      ).rejects.toThrow('Invalid bassline')
    })

    it('should handle parent group option', async () => {
      const bassline: Bassline = {
        name: 'Child Network',
        build: {
          topology: {
            contacts: [
              { id: 'c1', blendMode: 'accept-last' },
            ],
          },
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler, {
        parentGroupId: 'custom-parent',
      })

      expect(result.contacts[0].groupId).toBe('custom-parent')
    })

    it('should create groups for complex topologies', async () => {
      const bassline: Bassline = {
        name: 'Complex',
        build: {
          topology: {
            contacts: [
              { id: 'c1', blendMode: 'accept-last' },
            ],
            subgroups: ['sub1', 'sub2'],
          },
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler)

      expect(result.groups).toHaveLength(1)
      expect(scheduler.addGroup).toHaveBeenCalled()
    })

    it('should handle attribute contacts (@-prefixed)', async () => {
      const bassline: Bassline = {
        name: 'Dynamic Gadget',
        interface: {
          inputs: ['data'],
          attributes: ['@config', '@schema'],
        },
        build: {
          topology: {
            contacts: [
              { id: 'data', blendMode: 'accept-last' },
              { id: '@config', blendMode: 'merge' },
              { id: '@schema', blendMode: 'accept-last' },
            ],
          },
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler)

      expect(result.contacts).toHaveLength(3)
      const configContact = result.contacts.find(c => 
        result.idMap.get('@config') === c.id
      )
      expect(configContact).toBeDefined()
    })

    it('should collect warnings for deprecated patterns', async () => {
      const bassline: Bassline = {
        name: 'Deprecated',
        attributes: {
          'oldstyle': true, // Should be namespaced
        },
        build: {
          topology: {
            contacts: [],
          },
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler, {
        validate: true,
      })

      expect(result.warnings).toBeDefined()
      expect(result.warnings?.length).toBeGreaterThan(0)
      expect(result.warnings?.[0]).toContain('namespaced')
    })
  })

  describe('createGroupFromBassline', () => {
    it('should create a group from bassline and return its ID', async () => {
      const bassline: Bassline = {
        name: 'My Group',
        build: {
          topology: {
            contacts: [
              { id: 'c1', blendMode: 'accept-last' },
            ],
            subgroups: ['sub1'], // Forces group creation
          },
        },
      }

      const scheduler = createMockScheduler()
      const groupId = await createGroupFromBassline(bassline, scheduler)

      expect(groupId).toBeDefined()
      expect(groupId).toMatch(/^group-\d+$/)
      expect(scheduler.addGroup).toHaveBeenCalled()
    })

    it('should throw if no groups are created', async () => {
      const bassline: Bassline = {
        name: 'No Groups',
        build: {
          topology: {
            contacts: [], // No subgroups, so no group created
          },
        },
      }

      const scheduler = createMockScheduler()
      
      await expect(
        createGroupFromBassline(bassline, scheduler)
      ).rejects.toThrow('No groups created')
    })

    it('should apply seeds automatically', async () => {
      const bassline: Bassline = {
        name: 'With Seeds',
        build: {
          topology: {
            contacts: [
              { id: 'c1', blendMode: 'accept-last' },
            ],
            subgroups: ['sub1'],
          },
        },
        seeds: {
          'c1': 'initial value',
        },
      }

      const scheduler = createMockScheduler()
      await createGroupFromBassline(bassline, scheduler)

      expect(scheduler.scheduleUpdate).toHaveBeenCalled()
    })
  })

  describe('ID mapping', () => {
    it('should correctly map bassline IDs to actual IDs', async () => {
      const bassline: Bassline = {
        name: 'ID Mapping Test',
        build: {
          topology: {
            contacts: [
              { id: 'original-1', blendMode: 'accept-last' },
              { id: 'original-2', blendMode: 'merge' },
            ],
            wires: [
              { 
                id: 'wire-original', 
                fromId: 'original-1', 
                toId: 'original-2',
                type: 'directed',
              },
            ],
          },
        },
      }

      const scheduler = createMockScheduler()
      const result = await importBassline(bassline, scheduler)

      // Check ID mapping
      expect(result.idMap.has('original-1')).toBe(true)
      expect(result.idMap.has('original-2')).toBe(true)
      
      // Check that wire uses mapped IDs
      const actualFrom = result.idMap.get('original-1')
      const actualTo = result.idMap.get('original-2')
      expect(scheduler.connect).toHaveBeenCalledWith(
        actualFrom,
        actualTo,
        'directed'
      )
    })
  })
})