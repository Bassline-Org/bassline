import { describe, it, expect } from 'vitest'
import { extractToGroup } from '../operations/extract-to-group'
import type { NetworkState, GroupState, Contact, Wire } from '../../types'

// Helper to create a test network state
function createTestState(): NetworkState {
  const rootGroup: GroupState = {
    group: {
      id: 'root',
      name: 'Root',
      contactIds: ['c1', 'c2', 'c3', 'c4'],
      wireIds: ['w1', 'w2', 'w3'],
      subgroupIds: [],
      boundaryContactIds: []
    },
    contacts: new Map([
      ['c1', { id: 'c1', groupId: 'root', content: 1, blendMode: 'accept-last' }],
      ['c2', { id: 'c2', groupId: 'root', content: 2, blendMode: 'accept-last' }],
      ['c3', { id: 'c3', groupId: 'root', content: 3, blendMode: 'accept-last' }],
      ['c4', { id: 'c4', groupId: 'root', content: 4, blendMode: 'accept-last' }],
    ]),
    wires: new Map([
      ['w1', { id: 'w1', groupId: 'root', fromId: 'c1', toId: 'c2', type: 'bidirectional' }],
      ['w2', { id: 'w2', groupId: 'root', fromId: 'c2', toId: 'c3', type: 'bidirectional' }],
      ['w3', { id: 'w3', groupId: 'root', fromId: 'c3', toId: 'c4', type: 'bidirectional' }],
    ])
  }
  
  return {
    groups: new Map([['root', rootGroup]]),
    currentGroupId: 'root',
    rootGroupId: 'root'
  }
}

describe('extractToGroup', () => {
  it('should create a new group with selected contacts', () => {
    const state = createTestState()
    const result = extractToGroup(state, {
      contactIds: ['c1', 'c2'],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    })
    
    // Check that a new group was created
    const newGroupId = Array.from(result.state.groups.keys()).find(id => id !== 'root')
    expect(newGroupId).toBeDefined()
    
    const newGroup = result.state.groups.get(newGroupId!)
    expect(newGroup).toBeDefined()
    expect(newGroup!.group.name).toBe('Extracted Group')
    expect(newGroup!.group.parentId).toBe('root')
    
    // Check that contacts were moved
    expect(newGroup!.contacts.has('c1')).toBe(true)
    expect(newGroup!.contacts.has('c2')).toBe(true)
    expect(newGroup!.contacts.get('c1')!.groupId).toBe(newGroupId)
    expect(newGroup!.contacts.get('c2')!.groupId).toBe(newGroupId)
    
    // Check that contacts were removed from root
    const rootGroup = result.state.groups.get('root')!
    expect(rootGroup.contacts.has('c1')).toBe(false)
    expect(rootGroup.contacts.has('c2')).toBe(false)
    expect(rootGroup.group.contactIds).not.toContain('c1')
    expect(rootGroup.group.contactIds).not.toContain('c2')
  })
  
  it('should move internal wires to the new group', () => {
    const state = createTestState()
    const result = extractToGroup(state, {
      contactIds: ['c1', 'c2'],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    })
    
    const newGroupId = Array.from(result.state.groups.keys()).find(id => id !== 'root')!
    const newGroup = result.state.groups.get(newGroupId)!
    const rootGroup = result.state.groups.get('root')!
    
    // Wire w1 (c1->c2) should be in the new group
    expect(newGroup.wires.has('w1')).toBe(true)
    expect(rootGroup.wires.has('w1')).toBe(false)
    
    // Wire w2 (c2->c3) should create boundary contacts
    expect(newGroup.wires.has('w2')).toBe(false)
    expect(rootGroup.wires.has('w2')).toBe(true)
  })
  
  it('should create boundary contacts for external connections', () => {
    const state = createTestState()
    const result = extractToGroup(state, {
      contactIds: ['c2', 'c3'],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    })
    
    const newGroupId = Array.from(result.state.groups.keys()).find(id => id !== 'root')!
    const newGroup = result.state.groups.get(newGroupId)!
    
    // Should have boundary contacts
    const boundaryContacts = Array.from(newGroup.contacts.values()).filter(c => c.isBoundary)
    expect(boundaryContacts.length).toBeGreaterThan(0)
    
    // Check boundary contact properties
    boundaryContacts.forEach(bc => {
      expect(bc.isBoundary).toBe(true)
      expect(['input', 'output']).toContain(bc.boundaryDirection)
      expect(newGroup.group.boundaryContactIds).toContain(bc.id)
    })
  })
  
  it('should rewire external connections to boundary contacts', () => {
    const state = createTestState()
    const result = extractToGroup(state, {
      contactIds: ['c2'],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    })
    
    const newGroupId = Array.from(result.state.groups.keys()).find(id => id !== 'root')!
    const newGroup = result.state.groups.get(newGroupId)!
    const rootGroup = result.state.groups.get('root')!
    
    // Find boundary contacts
    const boundaryContacts = Array.from(newGroup.contacts.values()).filter(c => c.isBoundary)
    
    // Check that external wires now connect to boundary contacts
    const externalWires = Array.from(rootGroup.wires.values())
    
    // Filter to only wires that should have been affected (those that connected to c2)
    const affectedWires = externalWires.filter(wire => {
      const originalWire = state.groups.get('root')!.wires.get(wire.id)
      return originalWire && (originalWire.fromId === 'c2' || originalWire.toId === 'c2')
    })
    
    affectedWires.forEach(wire => {
      // Should not directly connect to c2 anymore
      expect(wire.fromId).not.toBe('c2')
      expect(wire.toId).not.toBe('c2')
      
      // Should connect to boundary contacts instead
      const connectsToBoundary = boundaryContacts.some(bc => 
        wire.fromId === bc.id || wire.toId === bc.id
      )
      expect(connectsToBoundary).toBe(true)
    })
    
    // Also check that boundary contacts were created for the external connections
    // With bidirectional wires, one boundary contact can handle both incoming and outgoing
    expect(boundaryContacts.length).toBeGreaterThan(0)
    expect(boundaryContacts.length).toBeLessThanOrEqual(2)
  })
  
  it('should handle contacts with no external connections', () => {
    const state = createTestState()
    // Add an isolated contact
    state.groups.get('root')!.contacts.set('c5', {
      id: 'c5',
      groupId: 'root',
      content: 5,
      blendMode: 'accept-last'
    })
    state.groups.get('root')!.group.contactIds.push('c5')
    
    const result = extractToGroup(state, {
      contactIds: ['c5'],
      groupName: 'Isolated Group',
      parentGroupId: 'root'
    })
    
    const newGroupId = Array.from(result.state.groups.keys()).find(id => id !== 'root')!
    const newGroup = result.state.groups.get(newGroupId)!
    
    // Should have the contact but no boundary contacts
    expect(newGroup.contacts.has('c5')).toBe(true)
    expect(newGroup.group.boundaryContactIds.length).toBe(0)
  })
  
  it('should include change records for UI updates', () => {
    const state = createTestState()
    const result = extractToGroup(state, {
      contactIds: ['c1', 'c2'],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    })
    
    // Should have changes for group creation
    const groupCreated = result.changes.find(c => c.type === 'group-created')
    expect(groupCreated).toBeDefined()
    
    // Should have changes for contact moves
    const contactMoves = result.changes.filter(c => c.type === 'contact-moved')
    expect(contactMoves.length).toBe(2)
    
    // Should have changes for wire updates
    const wireChanges = result.changes.filter(c => 
      c.type === 'wire-created' || c.type === 'wire-updated'
    )
    expect(wireChanges.length).toBeGreaterThan(0)
  })
  
  it('should throw error if parent group does not exist', () => {
    const state = createTestState()
    expect(() => {
      extractToGroup(state, {
        contactIds: ['c1'],
        groupName: 'Test',
        parentGroupId: 'non-existent'
      })
    }).toThrow('Parent group non-existent not found')
  })
  
  it('should handle empty contact selection', () => {
    const state = createTestState()
    const result = extractToGroup(state, {
      contactIds: [],
      groupName: 'Empty Group',
      parentGroupId: 'root'
    })
    
    const newGroupId = Array.from(result.state.groups.keys()).find(id => id !== 'root')!
    const newGroup = result.state.groups.get(newGroupId)!
    
    // Should create an empty group
    expect(newGroup.contacts.size).toBe(0)
    expect(newGroup.wires.size).toBe(0)
    expect(newGroup.group.boundaryContactIds.length).toBe(0)
  })
})