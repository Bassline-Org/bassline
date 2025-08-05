import { describe, it, expect, vi } from 'vitest'
import { createImmediateScheduler } from '../schedulers/immediate'
import type { Group, Contact, Change } from '../types'

describe('createImmediateScheduler', () => {
  it('should create a scheduler with empty initial state', async () => {
    const scheduler = createImmediateScheduler()
    
    // Should throw when trying to get non-existent group
    await expect(scheduler.getState('non-existent')).rejects.toThrow()
  })
  
  it('should register a group', async () => {
    const scheduler = createImmediateScheduler()
    
    const group: Group = {
      id: 'test-group',
      name: 'Test Group',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    }
    
    await scheduler.registerGroup(group)
    
    const state = await scheduler.getState('test-group')
    expect(state.group).toEqual(group)
    expect(state.contacts.size).toBe(0)
    expect(state.wires.size).toBe(0)
  })
  
  it('should add contacts to a group', async () => {
    const scheduler = createImmediateScheduler()
    
    // Register group first
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Add contact
    const contactId = await scheduler.addContact('group1', {
      groupId: 'group1',
      content: 'Hello',
      blendMode: 'accept-last'
    })
    
    expect(contactId).toBeTruthy()
    
    const contact = await scheduler.getContact(contactId)
    expect(contact).toBeDefined()
    expect(contact?.content).toBe('Hello')
    expect(contact?.groupId).toBe('group1')
  })
  
  it('should connect contacts and propagate content', async () => {
    const scheduler = createImmediateScheduler()
    
    // Setup
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    const contactA = await scheduler.addContact('group1', {
      groupId: 'group1',
      content: 'Initial',
      blendMode: 'accept-last'
    })
    
    const contactB = await scheduler.addContact('group1', {
      groupId: 'group1',
      blendMode: 'accept-last'
    })
    
    // Connect A -> B
    const wireId = await scheduler.connect(contactA, contactB)
    expect(wireId).toBeTruthy()
    
    // B should now have A's content
    const updatedB = await scheduler.getContact(contactB)
    expect(updatedB?.content).toBe('Initial')
  })
  
  it('should handle bidirectional propagation', async () => {
    const scheduler = createImmediateScheduler()
    
    // Setup
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    const contactA = await scheduler.addContact('group1', {
      groupId: 'group1',
      content: 'A',
      blendMode: 'accept-last'
    })
    
    const contactB = await scheduler.addContact('group1', {
      groupId: 'group1',
      content: 'B',
      blendMode: 'accept-last'
    })
    
    // Connect bidirectionally
    await scheduler.connect(contactA, contactB, 'bidirectional')
    
    // Update A
    await scheduler.scheduleUpdate(contactA, 'New Value')
    
    // Both should have the new value
    const updatedA = await scheduler.getContact(contactA)
    const updatedB = await scheduler.getContact(contactB)
    expect(updatedA?.content).toBe('New Value')
    expect(updatedB?.content).toBe('New Value')
  })
  
  it('should notify subscribers of changes', async () => {
    const scheduler = createImmediateScheduler()
    const subscriber = vi.fn()
    
    // Subscribe
    const unsubscribe = scheduler.subscribe(subscriber)
    
    // Register group - should notify
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    expect(subscriber).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'group-added',
        data: expect.objectContaining({ id: 'group1' })
      })
    ])
    
    // Add contact - should notify
    subscriber.mockClear()
    await scheduler.addContact('group1', {
      groupId: 'group1',
      blendMode: 'accept-last'
    })
    
    expect(subscriber).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'contact-added'
      })
    ])
    
    // Unsubscribe
    unsubscribe()
    subscriber.mockClear()
    
    // Further changes should not notify
    await scheduler.addContact('group1', {
      groupId: 'group1',
      blendMode: 'accept-last'
    })
    
    expect(subscriber).not.toHaveBeenCalled()
  })
  
  it('should handle subgroups', async () => {
    const scheduler = createImmediateScheduler()
    
    // Create root group
    await scheduler.registerGroup({
      id: 'root',
      name: 'Root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Add subgroup
    const subgroupId = await scheduler.addGroup('root', {
      name: 'Subgroup'
    })
    
    expect(subgroupId).toBeTruthy()
    
    // Check subgroup exists
    const subgroupState = await scheduler.getState(subgroupId)
    expect(subgroupState.group.name).toBe('Subgroup')
    expect(subgroupState.group.parentId).toBe('root')
    
    // Check parent knows about subgroup
    const rootState = await scheduler.getState('root')
    expect(rootState.group.subgroupIds).toContain(subgroupId)
  })
  
  it('should handle boundary contacts', async () => {
    const scheduler = createImmediateScheduler()
    
    // Create parent and child groups
    await scheduler.registerGroup({
      id: 'parent',
      name: 'Parent',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    const childId = await scheduler.addGroup('parent', {
      name: 'Child'
    })
    
    // Add boundary contact to child
    const boundaryId = await scheduler.addContact(childId, {
      groupId: childId,
      blendMode: 'accept-last',
      isBoundary: true,
      boundaryDirection: 'input'
    })
    
    // Check it's registered as boundary
    const childState = await scheduler.getState(childId)
    expect(childState.group.boundaryContactIds).toContain(boundaryId)
    
    // Add regular contact in parent
    const parentContactId = await scheduler.addContact('parent', {
      groupId: 'parent',
      content: 'From Parent',
      blendMode: 'accept-last'
    })
    
    // Connect parent contact to boundary (this should work)
    await expect(
      scheduler.connect(parentContactId, boundaryId)
    ).resolves.toBeTruthy()
  })
  
  it('should remove contacts and their wires', async () => {
    const scheduler = createImmediateScheduler()
    
    // Setup
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    const contactA = await scheduler.addContact('group1', {
      groupId: 'group1',
      blendMode: 'accept-last'
    })
    
    const contactB = await scheduler.addContact('group1', {
      groupId: 'group1',
      blendMode: 'accept-last'
    })
    
    const wireId = await scheduler.connect(contactA, contactB)
    
    // Remove contact A
    await scheduler.removeContact(contactA)
    
    // Contact should be gone
    const removedContact = await scheduler.getContact(contactA)
    expect(removedContact).toBeUndefined()
    
    // Wire should also be gone
    const removedWire = await scheduler.getWire(wireId)
    expect(removedWire).toBeUndefined()
    
    // Group should not contain the contact
    const groupState = await scheduler.getState('group1')
    expect(groupState.group.contactIds).not.toContain(contactA)
  })
  
  it('should remove groups recursively', async () => {
    const scheduler = createImmediateScheduler()
    
    // Create hierarchy: root -> child -> grandchild
    await scheduler.registerGroup({
      id: 'root',
      name: 'Root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    const childId = await scheduler.addGroup('root', { name: 'Child' })
    const grandchildId = await scheduler.addGroup(childId, { name: 'Grandchild' })
    
    // Add contact to grandchild
    const contactId = await scheduler.addContact(grandchildId, {
      groupId: grandchildId,
      blendMode: 'accept-last'
    })
    
    // Remove child (should remove grandchild too)
    await scheduler.removeGroup(childId)
    
    // All should be gone
    await expect(scheduler.getState(childId)).rejects.toThrow()
    await expect(scheduler.getState(grandchildId)).rejects.toThrow()
    expect(await scheduler.getContact(contactId)).toBeUndefined()
    
    // Root should not have child anymore
    const rootState = await scheduler.getState('root')
    expect(rootState.group.subgroupIds).not.toContain(childId)
  })
})