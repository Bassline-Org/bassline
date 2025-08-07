import { describe, it, expect } from 'vitest'
import type { NetworkState } from '../../types'
import { copyContacts } from '../operations/copy-contacts'

describe('copyContacts', () => {
  it('should copy selected contacts to target group', () => {
    const state: NetworkState = {
      groups: new Map([
        ['root', {
          group: {
            id: 'root',
            name: 'Root',
            contactIds: ['c1', 'c2', 'c3'],
            wireIds: [],
            subgroupIds: ['target'],
            boundaryContactIds: []
          },
          contacts: new Map([
            ['c1', { id: 'c1', groupId: 'root', content: 'A', blendMode: 'accept-last' }],
            ['c2', { id: 'c2', groupId: 'root', content: 'B', blendMode: 'accept-last' }],
            ['c3', { id: 'c3', groupId: 'root', content: 'C', blendMode: 'accept-last' }]
          ]),
          wires: new Map()
        }],
        ['target', {
          group: {
            id: 'target',
            name: 'Target',
            parentId: 'root',
            contactIds: [],
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: []
          },
          contacts: new Map(),
          wires: new Map()
        }]
      ]),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    const result = copyContacts(state, {
      contactIds: ['c1', 'c2'],
      targetGroupId: 'target',
      includeWires: false
    })
    
    // Check that contacts were copied
    const targetGroup = result.state.groups.get('target')!
    expect(targetGroup.contacts.size).toBe(2)
    expect(targetGroup.group.contactIds).toHaveLength(2)
    
    // Check that original contacts still exist
    const rootGroup = result.state.groups.get('root')!
    expect(rootGroup.contacts.size).toBe(3)
    
    // Check that copied contacts have same content
    const copiedContacts = Array.from(targetGroup.contacts.values())
    expect(copiedContacts.some(c => c.content === 'A')).toBe(true)
    expect(copiedContacts.some(c => c.content === 'B')).toBe(true)
    
    // Check changes
    expect(result.changes).toHaveLength(2)
    expect(result.changes.every(c => c.type === 'contact-created')).toBe(true)
  })
  
  it('should copy wires between selected contacts when includeWires is true', () => {
    const state: NetworkState = {
      groups: new Map([
        ['root', {
          group: {
            id: 'root',
            name: 'Root',
            contactIds: ['c1', 'c2', 'c3'],
            wireIds: ['w1', 'w2'],
            subgroupIds: [],
            boundaryContactIds: []
          },
          contacts: new Map([
            ['c1', { id: 'c1', groupId: 'root', content: 'A', blendMode: 'accept-last' }],
            ['c2', { id: 'c2', groupId: 'root', content: 'B', blendMode: 'accept-last' }],
            ['c3', { id: 'c3', groupId: 'root', content: 'C', blendMode: 'accept-last' }]
          ]),
          wires: new Map([
            ['w1', { id: 'w1', groupId: 'root', fromId: 'c1', toId: 'c2', type: 'bidirectional' }],
            ['w2', { id: 'w2', groupId: 'root', fromId: 'c2', toId: 'c3', type: 'bidirectional' }]
          ])
        }]
      ]),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    const result = copyContacts(state, {
      contactIds: ['c1', 'c2'],
      targetGroupId: 'root',
      includeWires: true
    })
    
    // Check that one wire was copied (c1 -> c2)
    const rootGroup = result.state.groups.get('root')!
    expect(rootGroup.wires.size).toBe(3) // Original 2 + 1 copied
    
    // Check changes
    const wireChanges = result.changes.filter(c => c.type === 'wire-created')
    expect(wireChanges).toHaveLength(1)
  })
  
  it('should not copy boundary contacts', () => {
    const state: NetworkState = {
      groups: new Map([
        ['root', {
          group: {
            id: 'root',
            name: 'Root',
            contactIds: ['c1', 'b1'],
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: ['b1']
          },
          contacts: new Map([
            ['c1', { id: 'c1', groupId: 'root', content: 'A', blendMode: 'accept-last' }],
            ['b1', { 
              id: 'b1', 
              groupId: 'root', 
              content: undefined, 
              blendMode: 'accept-last',
              isBoundary: true,
              boundaryDirection: 'input'
            }]
          ]),
          wires: new Map()
        }]
      ]),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    const result = copyContacts(state, {
      contactIds: ['c1', 'b1'],
      targetGroupId: 'root',
      includeWires: false
    })
    
    // Check that only non-boundary contact was copied
    const rootGroup = result.state.groups.get('root')!
    expect(rootGroup.contacts.size).toBe(3) // Original 2 + 1 copied
    expect(result.changes).toHaveLength(1)
  })
})