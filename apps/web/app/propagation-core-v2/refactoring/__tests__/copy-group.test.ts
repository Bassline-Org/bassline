import { describe, it, expect } from 'vitest'
import type { NetworkState } from '../../types'
import { copyGroup } from '../operations/copy-group'

describe('copyGroup', () => {
  it('should copy a group with all its contents', () => {
    const state: NetworkState = {
      groups: new Map([
        ['root', {
          group: {
            id: 'root',
            name: 'Root',
            contactIds: [],
            wireIds: [],
            subgroupIds: ['source'],
            boundaryContactIds: []
          },
          contacts: new Map(),
          wires: new Map()
        }],
        ['source', {
          group: {
            id: 'source',
            name: 'Source Group',
            parentId: 'root',
            contactIds: ['c1', 'c2'],
            wireIds: ['w1'],
            subgroupIds: [],
            boundaryContactIds: []
          },
          contacts: new Map([
            ['c1', { id: 'c1', groupId: 'source', content: 'A', blendMode: 'accept-last' }],
            ['c2', { id: 'c2', groupId: 'source', content: 'B', blendMode: 'accept-last' }]
          ]),
          wires: new Map([
            ['w1', { id: 'w1', groupId: 'source', fromId: 'c1', toId: 'c2', type: 'bidirectional' }]
          ])
        }]
      ]),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    const result = copyGroup(state, {
      groupId: 'source',
      targetParentId: 'root',
      deep: false
    })
    
    // Check that new group was created
    expect(result.state.groups.size).toBe(3) // root + source + copy
    
    // Check parent's subgroups
    const rootGroup = result.state.groups.get('root')!
    expect(rootGroup.group.subgroupIds).toHaveLength(2)
    
    // Find the new group
    const newGroupId = rootGroup.group.subgroupIds.find(id => id !== 'source')!
    const newGroup = result.state.groups.get(newGroupId)!
    
    // Check group properties
    expect(newGroup.group.name).toBe('Source Group (Copy)')
    expect(newGroup.group.parentId).toBe('root')
    
    // Check contacts were copied
    expect(newGroup.contacts.size).toBe(2)
    expect(newGroup.group.contactIds).toHaveLength(2)
    
    // Check wires were copied
    expect(newGroup.wires.size).toBe(1)
    expect(newGroup.group.wireIds).toHaveLength(1)
    
    // Check content preservation
    const copiedContacts = Array.from(newGroup.contacts.values())
    expect(copiedContacts.some(c => c.content === 'A')).toBe(true)
    expect(copiedContacts.some(c => c.content === 'B')).toBe(true)
  })
  
  it('should deep copy subgroups when deep is true', () => {
    const state: NetworkState = {
      groups: new Map([
        ['root', {
          group: {
            id: 'root',
            name: 'Root',
            contactIds: [],
            wireIds: [],
            subgroupIds: ['parent'],
            boundaryContactIds: []
          },
          contacts: new Map(),
          wires: new Map()
        }],
        ['parent', {
          group: {
            id: 'parent',
            name: 'Parent Group',
            parentId: 'root',
            contactIds: ['c1'],
            wireIds: [],
            subgroupIds: ['child'],
            boundaryContactIds: []
          },
          contacts: new Map([
            ['c1', { id: 'c1', groupId: 'parent', content: 'Parent', blendMode: 'accept-last' }]
          ]),
          wires: new Map()
        }],
        ['child', {
          group: {
            id: 'child',
            name: 'Child Group',
            parentId: 'parent',
            contactIds: ['c2'],
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: []
          },
          contacts: new Map([
            ['c2', { id: 'c2', groupId: 'child', content: 'Child', blendMode: 'accept-last' }]
          ]),
          wires: new Map()
        }]
      ]),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    const result = copyGroup(state, {
      groupId: 'parent',
      targetParentId: 'root',
      deep: true
    })
    
    // Check that both parent and child were copied
    expect(result.state.groups.size).toBe(5) // root + parent + child + 2 copies
    
    // Find the new parent group
    const rootGroup = result.state.groups.get('root')!
    const newParentId = rootGroup.group.subgroupIds.find(id => id !== 'parent')!
    const newParent = result.state.groups.get(newParentId)!
    
    // Check that child was also copied
    expect(newParent.group.subgroupIds).toHaveLength(1)
    const newChildId = newParent.group.subgroupIds[0]
    const newChild = result.state.groups.get(newChildId)!
    
    // Check child properties
    expect(newChild.group.name).toBe('Child Group')
    expect(newChild.group.parentId).toBe(newParentId)
    expect(newChild.contacts.size).toBe(1)
  })
  
  it('should copy gadgets with primitive references', () => {
    const addPrimitive = {
      id: 'add',
      inputs: ['a', 'b'],
      outputs: ['sum'],
      execute: () => {}
    }
    
    const state: NetworkState = {
      groups: new Map([
        ['root', {
          group: {
            id: 'root',
            name: 'Root',
            contactIds: [],
            wireIds: [],
            subgroupIds: ['gadget'],
            boundaryContactIds: []
          },
          contacts: new Map(),
          wires: new Map()
        }],
        ['gadget', {
          group: {
            id: 'gadget',
            name: 'Add Gadget',
            parentId: 'root',
            contactIds: ['b1', 'b2', 'b3'],
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: ['b1', 'b2', 'b3'],
            primitive: addPrimitive
          },
          contacts: new Map([
            ['b1', { 
              id: 'b1', 
              groupId: 'gadget', 
              content: undefined, 
              blendMode: 'accept-last',
              isBoundary: true,
              boundaryDirection: 'input',
              name: 'a'
            }],
            ['b2', { 
              id: 'b2', 
              groupId: 'gadget', 
              content: undefined, 
              blendMode: 'accept-last',
              isBoundary: true,
              boundaryDirection: 'input',
              name: 'b'
            }],
            ['b3', { 
              id: 'b3', 
              groupId: 'gadget', 
              content: undefined, 
              blendMode: 'accept-last',
              isBoundary: true,
              boundaryDirection: 'output',
              name: 'sum'
            }]
          ]),
          wires: new Map()
        }]
      ]),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    const result = copyGroup(state, {
      groupId: 'gadget',
      targetParentId: 'root',
      newName: 'Add Gadget Copy',
      deep: false
    })
    
    // Find the new gadget
    const rootGroup = result.state.groups.get('root')!
    const newGadgetId = rootGroup.group.subgroupIds.find(id => id !== 'gadget')!
    const newGadget = result.state.groups.get(newGadgetId)!
    
    // Check primitive was copied
    expect(newGadget.group.primitive).toBe(addPrimitive)
    
    // Check boundary contacts were copied
    expect(newGadget.contacts.size).toBe(3)
    expect(newGadget.group.boundaryContactIds).toHaveLength(3)
  })
  
  it('should throw error when trying to copy into descendant', () => {
    const state: NetworkState = {
      groups: new Map([
        ['root', {
          group: {
            id: 'root',
            name: 'Root',
            contactIds: [],
            wireIds: [],
            subgroupIds: ['parent'],
            boundaryContactIds: []
          },
          contacts: new Map(),
          wires: new Map()
        }],
        ['parent', {
          group: {
            id: 'parent',
            name: 'Parent',
            parentId: 'root',
            contactIds: [],
            wireIds: [],
            subgroupIds: ['child'],
            boundaryContactIds: []
          },
          contacts: new Map(),
          wires: new Map()
        }],
        ['child', {
          group: {
            id: 'child',
            name: 'Child',
            parentId: 'parent',
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
    
    expect(() => {
      copyGroup(state, {
        groupId: 'parent',
        targetParentId: 'child',
        deep: false
      })
    }).toThrow('Cannot copy group into itself or its descendants')
  })
})