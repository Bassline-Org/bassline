import { describe, it, expect } from 'vitest'
import { propagateContent, testUtils } from '../propagation'
import type { NetworkState, Contact, Wire, GroupState } from '../types'

// Helper to create a test network state
function createTestNetwork(): NetworkState {
  const rootGroupId = 'root-group'
  const rootGroup: GroupState = {
    group: {
      id: rootGroupId,
      name: 'Root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    },
    contacts: new Map(),
    wires: new Map()
  }
  
  return {
    groups: new Map([[rootGroupId, rootGroup]]),
    currentGroupId: rootGroupId,
    rootGroupId
  }
}

// Helper to add a contact to the network
function addContact(
  state: NetworkState, 
  id: string, 
  content?: unknown, 
  blendMode: 'accept-last' | 'merge' = 'accept-last'
): Contact {
  const contact: Contact = {
    id,
    groupId: state.rootGroupId,
    content,
    blendMode
  }
  
  const groupState = state.groups.get(state.rootGroupId)!
  groupState.contacts.set(id, contact)
  groupState.group.contactIds.push(id)
  
  return contact
}

// Helper to connect two contacts
function connectContacts(
  state: NetworkState,
  fromId: string,
  toId: string,
  type: 'bidirectional' | 'directed' = 'bidirectional'
): Wire {
  const wireId = `wire-${fromId}-${toId}`
  const wire: Wire = {
    id: wireId,
    groupId: state.rootGroupId,
    fromId,
    toId,
    type
  }
  
  const groupState = state.groups.get(state.rootGroupId)!
  groupState.wires.set(wireId, wire)
  groupState.group.wireIds.push(wireId)
  
  return wire
}

describe('propagateContent', () => {
  it('should propagate content through a simple chain', async () => {
    const state = createTestNetwork()
    
    // Create chain: A -> B -> C
    addContact(state, 'A')
    addContact(state, 'B')
    addContact(state, 'C')
    connectContacts(state, 'A', 'B')
    connectContacts(state, 'B', 'C')
    
    // Propagate from A
    const result = await propagateContent(state, 'A', 'Hello')
    
    expect(result.changes).toHaveLength(3)
    expect(result.changes).toContainEqual({
      contactId: 'A',
      updates: { content: 'Hello', lastContradiction: undefined }
    })
    expect(result.changes).toContainEqual({
      contactId: 'B',
      updates: { content: 'Hello', lastContradiction: undefined }
    })
    expect(result.changes).toContainEqual({
      contactId: 'C',
      updates: { content: 'Hello', lastContradiction: undefined }
    })
  })
  
  it('should handle bidirectional propagation', async () => {
    const state = createTestNetwork()
    
    // Create bidirectional connection: A <-> B
    addContact(state, 'A', 'Initial')
    addContact(state, 'B')
    connectContacts(state, 'A', 'B', 'bidirectional')
    
    // Update B - should propagate to A
    const result = await propagateContent(state, 'B', 'Updated')
    
    expect(result.changes).toHaveLength(2)
    expect(result.changes).toContainEqual({
      contactId: 'B',
      updates: { content: 'Updated', lastContradiction: undefined }
    })
    expect(result.changes).toContainEqual({
      contactId: 'A',
      updates: { content: 'Updated', lastContradiction: undefined }
    })
  })
  
  it('should respect directed wires', async () => {
    const state = createTestNetwork()
    
    // Create directed connection: A -> B
    addContact(state, 'A')
    addContact(state, 'B')
    connectContacts(state, 'A', 'B', 'directed')
    
    // Update B - should NOT propagate to A
    const result = await propagateContent(state, 'B', 'Updated')
    
    expect(result.changes).toHaveLength(1)
    expect(result.changes).toContainEqual({
      contactId: 'B',
      updates: { content: 'Updated', lastContradiction: undefined }
    })
  })
  
  it('should handle accept-last blend mode', async () => {
    const state = createTestNetwork()
    
    // Create contact with existing content
    addContact(state, 'A', 'Old Value', 'accept-last')
    
    // Update with new value
    const result = await propagateContent(state, 'A', 'New Value')
    
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toEqual({
      contactId: 'A',
      updates: { content: 'New Value', lastContradiction: undefined }
    })
  })
  
  it('should handle merge blend mode with mergeable values', async () => {
    const state = createTestNetwork()
    
    // Use new tagged collection system
    const { grow } = await import('../mergeable')
    
    // Create contact with merge mode
    const initial = grow.set(['a', 'b'])
    addContact(state, 'A', initial, 'merge')
    
    // Update with new mergeable value
    const additional = grow.set(['c', 'd'])
    const result = await propagateContent(state, 'A', additional)
    
    expect(result.changes).toHaveLength(1)
    const merged = result.changes[0].updates.content as any
    expect(merged._tag).toBe('GrowSet')
    expect(merged.values).toEqual(new Set(['a', 'b', 'c', 'd']))
  })
  
  it('should create contradiction for non-mergeable values in merge mode', async () => {
    const state = createTestNetwork()
    
    // Create contact with merge mode but non-mergeable content
    addContact(state, 'A', 'string value', 'merge')
    
    // Update with another non-mergeable value (should create contradiction)
    const result = await propagateContent(state, 'A', 'new string')
    
    expect(result.changes).toHaveLength(1)
    expect(result.contradictions).toHaveLength(1)
    expect(result.changes[0].updates.lastContradiction).toBeDefined()
    expect(result.changes[0].updates.lastContradiction?.message).toBe('Values cannot be merged')
  })
  
  it('should not propagate when content is unchanged', async () => {
    const state = createTestNetwork()
    
    // Create contact with content
    addContact(state, 'A', 'Same Value')
    addContact(state, 'B')
    connectContacts(state, 'A', 'B')
    
    // First propagation
    await propagateContent(state, 'A', 'Same Value')
    
    // Update A's content in state to simulate first propagation
    const contact = state.groups.get(state.rootGroupId)!.contacts.get('A')!
    contact.content = 'Same Value'
    
    // Second propagation with same value
    const result = await propagateContent(state, 'A', 'Same Value')
    
    expect(result.changes).toHaveLength(0)
  })
  
  it('should handle cycles without infinite loops', async () => {
    const state = createTestNetwork()
    
    // Create cycle: A <-> B <-> C <-> A
    addContact(state, 'A')
    addContact(state, 'B')
    addContact(state, 'C')
    connectContacts(state, 'A', 'B')
    connectContacts(state, 'B', 'C')
    connectContacts(state, 'C', 'A')
    
    // Propagate from A
    const result = await propagateContent(state, 'A', 'Cyclic')
    
    // Should visit each node exactly once
    expect(result.changes).toHaveLength(3)
    expect(new Set(result.changes.map(c => c.contactId))).toEqual(new Set(['A', 'B', 'C']))
  })
  
  it('should track propagation duration', async () => {
    const state = createTestNetwork()
    addContact(state, 'A')
    
    const result = await propagateContent(state, 'A', 'Test')
    
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.duration).toBeLessThan(1000) // Should be fast
  })
})

describe('testUtils', () => {
  it('findContact should find contacts in any group', () => {
    const state = createTestNetwork()
    const contact = addContact(state, 'test-contact', 'test')
    
    const found = testUtils.findContact(state, 'test-contact')
    expect(found).toEqual(contact)
  })
  
  it('findGroupForContact should return correct group', () => {
    const state = createTestNetwork()
    addContact(state, 'test-contact')
    
    const groupId = testUtils.findGroupForContact(state, 'test-contact')
    expect(groupId).toBe(state.rootGroupId)
  })
  
  it('getConnectedContacts should return bidirectional connections', () => {
    const state = createTestNetwork()
    addContact(state, 'A')
    addContact(state, 'B')
    addContact(state, 'C')
    connectContacts(state, 'A', 'B')
    connectContacts(state, 'A', 'C')
    
    const connections = testUtils.getConnectedContacts(state, 'A')
    expect(connections).toHaveLength(2)
    expect(connections).toContainEqual({ contactId: 'B', groupId: state.rootGroupId })
    expect(connections).toContainEqual({ contactId: 'C', groupId: state.rootGroupId })
  })
})