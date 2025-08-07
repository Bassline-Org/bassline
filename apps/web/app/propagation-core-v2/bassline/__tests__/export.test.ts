import { describe, it, expect } from 'vitest'
import { 
  exportGroupAsBassline, 
  exportNetworkAsBassline,
  exportSelectionAsBassline,
  serializeBassline,
  deserializeBassline
} from '../export'
import type { Group, GroupState, NetworkState, Contact, Wire } from '../../types'

describe('Bassline Export', () => {
  // Helper to create test data
  function createTestGroup(): { group: Group; state: GroupState } {
    const group: Group = {
      id: 'test-group',
      name: 'Test Group',
      contactIds: ['c1', 'c2', 'c3'],
      wireIds: ['w1'],
      subgroupIds: [],
      boundaryContactIds: ['c1', 'c3'],
      attributes: {
        'bassline.pure': true,
        'permissions.modify': 'owner',
      }
    }

    const contacts = new Map<string, Contact>([
      ['c1', {
        id: 'c1',
        groupId: 'test-group',
        blendMode: 'accept-last',
        isBoundary: true,
        boundaryDirection: 'input',
        name: 'Input',
        content: 42,
      }],
      ['c2', {
        id: 'c2',
        groupId: 'test-group',
        blendMode: 'merge',
        content: 'internal',
      }],
      ['c3', {
        id: 'c3',
        groupId: 'test-group',
        blendMode: 'accept-last',
        isBoundary: true,
        boundaryDirection: 'output',
        name: 'Output',
        content: 100,
      }],
    ])

    const wires = new Map<string, Wire>([
      ['w1', {
        id: 'w1',
        groupId: 'test-group',
        fromId: 'c1',
        toId: 'c2',
        type: 'bidirectional',
      }],
    ])

    const state: GroupState = {
      group,
      contacts,
      wires,
    }

    return { group, state }
  }

  describe('exportGroupAsBassline', () => {
    it('should export a simple group as bassline', () => {
      const { group, state } = createTestGroup()
      
      const bassline = exportGroupAsBassline(group, state)
      
      expect(bassline.name).toBe('Test Group')
      expect(bassline.attributes).toEqual({
        'bassline.pure': true,
        'permissions.modify': 'owner',
      })
      expect(bassline.build?.topology).toBeDefined()
    })

    it('should detect and export gadget interface', () => {
      const { group, state } = createTestGroup()
      
      const bassline = exportGroupAsBassline(group, state)
      
      expect(bassline.interface).toBeDefined()
      expect(bassline.interface?.inputs).toEqual(['c1'])
      expect(bassline.interface?.outputs).toEqual(['c3'])
    })

    it('should export with topology only when specified', () => {
      const { group, state } = createTestGroup()
      
      const bassline = exportGroupAsBassline(group, state, { 
        topologyOnly: true 
      })
      
      // Should not include attributes or values
      expect(bassline.build?.topology.contacts[0].attributes).toBeUndefined()
      expect(bassline.build?.topology.contacts[0].content).toBeUndefined()
      expect(bassline.seeds).toBeUndefined()
    })

    it('should include seeds when includeValues is true', () => {
      const { group, state } = createTestGroup()
      
      const bassline = exportGroupAsBassline(group, state, { 
        includeValues: true 
      })
      
      expect(bassline.seeds).toEqual({
        'c1': 42,
        'c2': 'internal',
        'c3': 100,
      })
    })

    it('should detect attribute contacts (@ prefix)', () => {
      const { group, state } = createTestGroup()
      
      // Add an attribute contact
      state.contacts.set('@config', {
        id: '@config',
        groupId: 'test-group',
        blendMode: 'accept-last',
        isBoundary: true,
        boundaryDirection: 'input',
      })
      
      const bassline = exportGroupAsBassline(group, state)
      
      expect(bassline.interface?.attributes).toEqual(['@config'])
    })

    it('should generate hash when requested', () => {
      const { group, state } = createTestGroup()
      
      const bassline = exportGroupAsBassline(group, state, { 
        generateHash: true 
      })
      
      expect(bassline.hash).toBeDefined()
      expect(typeof bassline.hash).toBe('string')
    })

    it('should add metadata when provided', () => {
      const { group, state } = createTestGroup()
      
      const bassline = exportGroupAsBassline(group, state, {
        metadata: {
          author: 'Test Author',
          description: 'Test Description',
          tags: ['test', 'example'],
        }
      })
      
      expect(bassline.metadata?.author).toBe('Test Author')
      expect(bassline.metadata?.tags).toEqual(['test', 'example'])
      expect(bassline.metadata?.created).toBeDefined()
    })
  })

  describe('exportNetworkAsBassline', () => {
    it('should export entire network with subgroups', () => {
      const rootGroup = createTestGroup()
      rootGroup.group.id = 'root'
      rootGroup.group.subgroupIds = ['sub1']
      
      const subGroup = createTestGroup()
      subGroup.group.id = 'sub1'
      subGroup.group.parentId = 'root'
      subGroup.group.name = 'Sub Group'
      
      const networkState: NetworkState = {
        groups: new Map([
          ['root', rootGroup.state],
          ['sub1', subGroup.state],
        ]),
        currentGroupId: 'root',
        rootGroupId: 'root',
      }
      
      const bassline = exportNetworkAsBassline(networkState)
      
      expect(bassline.name).toBe('Test Group')
      expect(bassline.build?.gadgets).toHaveLength(1)
      expect(bassline.build?.gadgets?.[0].id).toBe('sub1')
      expect(bassline.build?.gadgets?.[0].bassline?.name).toBe('Sub Group')
    })

    it('should handle empty network', () => {
      const rootGroup = createTestGroup()
      rootGroup.group.id = 'root'
      rootGroup.state.contacts.clear()
      rootGroup.state.wires.clear()
      
      const networkState: NetworkState = {
        groups: new Map([['root', rootGroup.state]]),
        currentGroupId: 'root',
        rootGroupId: 'root',
      }
      
      const bassline = exportNetworkAsBassline(networkState)
      
      expect(bassline.name).toBe('Test Group')
      expect(bassline.build?.topology.contacts).toHaveLength(0)
      expect(bassline.build?.topology.wires).toHaveLength(0)
    })
  })

  describe('exportSelectionAsBassline', () => {
    it('should export selected contacts and wires', () => {
      const contacts: Contact[] = [
        {
          id: 'c1',
          groupId: 'g1',
          blendMode: 'accept-last',
          content: 'test',
        },
        {
          id: 'c2',
          groupId: 'g1',
          blendMode: 'merge',
        },
      ]
      
      const wires: Wire[] = [
        {
          id: 'w1',
          groupId: 'g1',
          fromId: 'c1',
          toId: 'c2',
          type: 'directed',
        },
      ]
      
      const bassline = exportSelectionAsBassline({
        contacts,
        wires,
      })
      
      expect(bassline.build?.topology.contacts).toHaveLength(2)
      expect(bassline.build?.topology.wires).toHaveLength(1)
    })

    it('should handle groups in selection', () => {
      const groups: Group[] = [
        {
          id: 'g1',
          name: 'Group 1',
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: [],
        },
      ]
      
      const bassline = exportSelectionAsBassline({ groups })
      
      expect(bassline.build?.topology.subgroups).toEqual(['g1'])
    })

    it('should respect export options', () => {
      const contacts: Contact[] = [
        {
          id: 'c1',
          groupId: 'g1',
          blendMode: 'accept-last',
          content: 'secret',
          attributes: {
            'bassline.pure': false,
          },
        },
      ]
      
      const bassline = exportSelectionAsBassline(
        { contacts },
        { topologyOnly: true }
      )
      
      const exported = bassline.build?.topology.contacts[0]
      expect(exported.content).toBeUndefined()
      expect(exported.attributes).toBeUndefined()
    })
  })

  describe('serialization', () => {
    it('should serialize and deserialize bassline', () => {
      const original = {
        name: 'Test',
        attributes: {
          'bassline.pure': true,
          'x-custom.field': 'value',
        },
        build: {
          topology: {
            contacts: [{ id: 'c1', blendMode: 'accept-last' }],
          },
        },
      }
      
      const json = serializeBassline(original)
      expect(typeof json).toBe('string')
      expect(json).toContain('"name": "Test"')
      
      const deserialized = deserializeBassline(json)
      expect(deserialized).toEqual(original)
    })

    it('should produce readable JSON', () => {
      const bassline = { name: 'Test', version: '1.0.0' }
      const json = serializeBassline(bassline)
      
      // Should be indented
      expect(json).toContain('\n')
      expect(json).toContain('  ')
    })
  })

  describe('hash generation', () => {
    it('should generate consistent hash for same content', () => {
      const { group, state } = createTestGroup()
      
      const bassline1 = exportGroupAsBassline(group, state, { 
        generateHash: true 
      })
      const bassline2 = exportGroupAsBassline(group, state, { 
        generateHash: true 
      })
      
      expect(bassline1.hash).toBe(bassline2.hash)
    })

    it('should generate different hash for different content', () => {
      const { group, state } = createTestGroup()
      
      const bassline1 = exportGroupAsBassline(group, state, { 
        generateHash: true 
      })
      
      // Modify the group
      group.name = 'Different Name'
      
      const bassline2 = exportGroupAsBassline(group, state, { 
        generateHash: true 
      })
      
      expect(bassline1.hash).not.toBe(bassline2.hash)
    })
  })
})