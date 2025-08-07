import { describe, it, expect } from 'vitest'
import { extractToGroup } from '../operations/extract-to-group'
import { inlineGroup } from '../operations/inline-group'
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

describe('inlineGroup', () => {
  it('should move contacts back to parent group', () => {
    // First extract some contacts
    const state = createTestState()
    const extracted = extractToGroup(state, {
      contactIds: ['c2', 'c3'],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    })
    
    // Find the extracted group ID
    const extractedGroupId = Array.from(extracted.state.groups.keys()).find(
      id => id !== 'root'
    )!
    
    // Now inline it
    const result = inlineGroup(extracted.state, {
      groupId: extractedGroupId
    })
    
    // Check that contacts are back in root
    const rootGroup = result.state.groups.get('root')!
    expect(rootGroup.contacts.has('c2')).toBe(true)
    expect(rootGroup.contacts.has('c3')).toBe(true)
    expect(rootGroup.contacts.get('c2')!.groupId).toBe('root')
    expect(rootGroup.contacts.get('c3')!.groupId).toBe('root')
    
    // Check that the extracted group is gone
    expect(result.state.groups.has(extractedGroupId)).toBe(false)
  })
  
  it('should remove boundary contacts', () => {
    // Extract a contact with external connections
    const state = createTestState()
    const extracted = extractToGroup(state, {
      contactIds: ['c2'],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    })
    
    const extractedGroupId = Array.from(extracted.state.groups.keys()).find(
      id => id !== 'root'
    )!
    
    // Verify boundary contacts exist
    const extractedGroup = extracted.state.groups.get(extractedGroupId)!
    const boundaryContacts = Array.from(extractedGroup.contacts.values()).filter(
      c => c.isBoundary
    )
    expect(boundaryContacts.length).toBeGreaterThan(0)
    
    // Inline the group
    const result = inlineGroup(extracted.state, {
      groupId: extractedGroupId
    })
    
    // Check that boundary contacts are gone
    const rootGroup = result.state.groups.get('root')!
    const remainingBoundaries = Array.from(rootGroup.contacts.values()).filter(
      c => c.isBoundary
    )
    expect(remainingBoundaries.length).toBe(0)
  })
  
  it('should restore original wire connections', () => {
    const state = createTestState()
    
    // Extract c2 which has connections to c1 and c3
    const extracted = extractToGroup(state, {
      contactIds: ['c2'],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    })
    
    const extractedGroupId = Array.from(extracted.state.groups.keys()).find(
      id => id !== 'root'
    )!
    
    // Inline the group
    const result = inlineGroup(extracted.state, {
      groupId: extractedGroupId
    })
    
    // Check that wires connect directly to c2 again
    const rootGroup = result.state.groups.get('root')!
    const wiresConnectingToC2 = Array.from(rootGroup.wires.values()).filter(
      w => w.fromId === 'c2' || w.toId === 'c2'
    )
    
    expect(wiresConnectingToC2.length).toBeGreaterThan(0)
    
    // Verify no wires connect to non-existent boundary contacts
    rootGroup.wires.forEach(wire => {
      expect(rootGroup.contacts.has(wire.fromId) || 
             rootGroup.contacts.has(wire.toId) ||
             // Allow connections to contacts in other groups
             Array.from(result.state.groups.values()).some(g => 
               g.contacts.has(wire.fromId) || g.contacts.has(wire.toId)
             )
      ).toBe(true)
    })
  })
  
  it('should be the inverse of extractToGroup', () => {
    const originalState = createTestState()
    
    // Extract and then inline
    const extracted = extractToGroup(originalState, {
      contactIds: ['c2', 'c3'],
      groupName: 'Temp Group',
      parentGroupId: 'root'
    })
    
    const extractedGroupId = Array.from(extracted.state.groups.keys()).find(
      id => id !== 'root'
    )!
    
    const inlined = inlineGroup(extracted.state, {
      groupId: extractedGroupId
    })
    
    // Should have same number of groups as original
    expect(inlined.state.groups.size).toBe(originalState.groups.size)
    
    // Root group should have all original contacts
    const rootGroup = inlined.state.groups.get('root')!
    expect(rootGroup.contacts.size).toBe(4)
    expect(rootGroup.contacts.has('c1')).toBe(true)
    expect(rootGroup.contacts.has('c2')).toBe(true)
    expect(rootGroup.contacts.has('c3')).toBe(true)
    expect(rootGroup.contacts.has('c4')).toBe(true)
    
    // Should have the same wires (though IDs might differ due to boundary wire creation)
    const originalWireConnections = new Set(
      Array.from(originalState.groups.get('root')!.wires.values()).map(
        w => `${w.fromId}->${w.toId}`
      )
    )
    const finalWireConnections = new Set(
      Array.from(rootGroup.wires.values()).map(
        w => `${w.fromId}->${w.toId}`
      )
    )
    
    // Should have at least the original connections
    originalWireConnections.forEach(conn => {
      expect(finalWireConnections.has(conn)).toBe(true)
    })
  })
  
  it('should throw error if group not found', () => {
    const state = createTestState()
    expect(() => {
      inlineGroup(state, { groupId: 'non-existent' })
    }).toThrow('Group non-existent not found')
  })
  
  it('should throw error if trying to inline root group', () => {
    const state = createTestState()
    expect(() => {
      inlineGroup(state, { groupId: 'root' })
    }).toThrow('Cannot inline root group')
  })
  
  it('should handle groups with no external connections', () => {
    const state = createTestState()
    
    // Add isolated contacts
    state.groups.get('root')!.contacts.set('c5', {
      id: 'c5',
      groupId: 'root',
      content: 5,
      blendMode: 'accept-last'
    })
    state.groups.get('root')!.contacts.set('c6', {
      id: 'c6',
      groupId: 'root',
      content: 6,
      blendMode: 'accept-last'
    })
    state.groups.get('root')!.group.contactIds.push('c5', 'c6')
    
    // Extract isolated contacts
    const extracted = extractToGroup(state, {
      contactIds: ['c5', 'c6'],
      groupName: 'Isolated Group',
      parentGroupId: 'root'
    })
    
    const extractedGroupId = Array.from(extracted.state.groups.keys()).find(
      id => id !== 'root'
    )!
    
    // Inline should work without issues
    const result = inlineGroup(extracted.state, {
      groupId: extractedGroupId
    })
    
    const rootGroup = result.state.groups.get('root')!
    expect(rootGroup.contacts.has('c5')).toBe(true)
    expect(rootGroup.contacts.has('c6')).toBe(true)
  })
  
  it('should include proper change records', () => {
    const state = createTestState()
    const extracted = extractToGroup(state, {
      contactIds: ['c2'],
      groupName: 'Temp',
      parentGroupId: 'root'
    })
    
    const extractedGroupId = Array.from(extracted.state.groups.keys()).find(
      id => id !== 'root'
    )!
    
    const result = inlineGroup(extracted.state, {
      groupId: extractedGroupId
    })
    
    // Should have group deletion change
    const groupDeleted = result.changes.find(c => c.type === 'group-deleted')
    expect(groupDeleted).toBeDefined()
    expect((groupDeleted!.data as any).groupId).toBe(extractedGroupId)
    
    // Should have contact move changes
    const contactMoves = result.changes.filter(c => c.type === 'contact-moved')
    expect(contactMoves.length).toBeGreaterThan(0)
    
    // Should have wire updates if boundaries were involved
    const wireUpdates = result.changes.filter(c => c.type === 'wire-updated')
    expect(wireUpdates.length).toBeGreaterThan(0)
  })
})