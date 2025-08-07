import { describe, it, expect, vi } from 'vitest'
import {
  hasDynamicAttributes,
  getDynamicAttributesContactId,
  applyDynamicAttributes,
  hasDynamicTopology,
  getDynamicTopologyContactId,
  buildDynamicTopology
} from '../propagation-core-v2/bassline/dynamic'
import type { Group, GroupState, Contact } from '../propagation-core-v2/types'
import type { BasslineAttributes } from '../propagation-core-v2/bassline/types'

describe('Dynamic Bassline Features', () => {
  describe('Dynamic Attributes', () => {
    it('should detect groups with dynamic attributes', () => {
      const groupWithDynamic: Group = {
        id: 'test',
        name: 'Test Group',
        attributes: {
          'bassline.dynamic-attributes': {
            enabled: true,
            contact: '@config'
          }
        },
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      }
      
      const groupWithoutDynamic: Group = {
        id: 'test2',
        name: 'Test Group 2',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      }
      
      expect(hasDynamicAttributes(groupWithDynamic)).toBe(true)
      expect(hasDynamicAttributes(groupWithoutDynamic)).toBe(false)
    })
    
    it('should get the dynamic attributes contact ID', () => {
      const group: Group = {
        id: 'test',
        name: 'Test Group',
        attributes: {
          'bassline.dynamic-attributes': {
            enabled: true,
            contact: '@config'
          }
        },
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      }
      
      expect(getDynamicAttributesContactId(group)).toBe('@config')
    })
    
    it('should apply dynamic attributes from contact content', async () => {
      const configContact: Contact = {
        id: '@config',
        groupId: 'test',
        blendMode: 'accept-last',
        content: {
          'bassline.pure': true,
          'permissions.modify': 'none',
          'x-custom': 'value'
        } as BasslineAttributes
      }
      
      const group: Group = {
        id: 'test',
        name: 'Test Group',
        attributes: {
          'bassline.dynamic-attributes': {
            enabled: true,
            contact: '@config'
          },
          'bassline.mutable': true // This should be overridden
        },
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@config']
      }
      
      const state: GroupState = {
        group,
        contacts: new Map([['@config', configContact]]),
        wires: new Map()
      }
      
      const mockScheduler: any = {
        getState: vi.fn(),
        subscribe: vi.fn()
      }
      
      const result = await applyDynamicAttributes(group, state, mockScheduler)
      
      expect(result).toEqual({
        'bassline.dynamic-attributes': {
          enabled: true,
          contact: '@config'
        },
        'bassline.mutable': true,
        'bassline.pure': true,
        'permissions.modify': 'none',
        'x-custom': 'value'
      })
    })
  })
  
  describe('Dynamic Topology', () => {
    it('should detect groups with dynamic topology', () => {
      const groupWithDynamic: Group = {
        id: 'test',
        name: 'Test Group',
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@network-definition',
            rebuildOn: 'change'
          }
        },
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      }
      
      expect(hasDynamicTopology(groupWithDynamic)).toBe(true)
    })
    
    it('should get the dynamic topology contact ID', () => {
      const group: Group = {
        id: 'test',
        name: 'Test Group',
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@network-definition'
          }
        },
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      }
      
      expect(getDynamicTopologyContactId(group)).toBe('@network-definition')
    })
    
    it('should build topology from contact content', async () => {
      const topologyContact: Contact = {
        id: '@network-definition',
        groupId: 'test',
        blendMode: 'accept-last',
        content: {
          name: 'Dynamic Network',
          build: {
            topology: {
              contacts: [
                { id: 'input', blendMode: 'accept-last' },
                { id: 'output', blendMode: 'accept-last' }
              ],
              wires: [
                { fromId: 'input', toId: 'output', type: 'bidirectional' }
              ]
            }
          }
        }
      }
      
      const group: Group = {
        id: 'test',
        name: 'Test Group',
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@network-definition'
          }
        },
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@network-definition']
      }
      
      const state: GroupState = {
        group,
        contacts: new Map([['@network-definition', topologyContact]]),
        wires: new Map()
      }
      
      const mockScheduler: any = {
        getState: vi.fn(),
        subscribe: vi.fn()
      }
      
      const result = await buildDynamicTopology(group, state, mockScheduler)
      
      expect(result).toEqual({
        name: 'Dynamic Network',
        build: {
          topology: {
            contacts: [
              { id: 'input', blendMode: 'accept-last' },
              { id: 'output', blendMode: 'accept-last' }
            ],
            wires: [
              { fromId: 'input', toId: 'output', type: 'bidirectional' }
            ]
          }
        }
      })
    })
    
    it('should handle topology-only content', async () => {
      const topologyContact: Contact = {
        id: '@network-definition',
        groupId: 'test',
        blendMode: 'accept-last',
        content: {
          contacts: [
            { id: 'a', blendMode: 'accept-last' }
          ],
          wires: []
        }
      }
      
      const group: Group = {
        id: 'test',
        name: 'Test Group',
        attributes: {
          'bassline.dynamic-topology': {
            enabled: true,
            schemaContact: '@network-definition'
          }
        },
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: ['@network-definition']
      }
      
      const state: GroupState = {
        group,
        contacts: new Map([['@network-definition', topologyContact]]),
        wires: new Map()
      }
      
      const mockScheduler: any = {
        getState: vi.fn(),
        subscribe: vi.fn()
      }
      
      const result = await buildDynamicTopology(group, state, mockScheduler)
      
      expect(result?.name).toBe('Test Group-dynamic')
      expect(result?.build?.topology).toEqual({
        contacts: [
          { id: 'a', blendMode: 'accept-last' }
        ],
        wires: []
      })
    })
  })
})