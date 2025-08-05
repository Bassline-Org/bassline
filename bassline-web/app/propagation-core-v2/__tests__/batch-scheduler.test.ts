import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBatchScheduler } from '../schedulers/batch'

describe('createBatchScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  it('should batch updates with delay', async () => {
    const scheduler = createBatchScheduler({ batchSize: 3, batchDelay: 100 })
    
    // Register group
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Add contacts
    const c1 = await scheduler.addContact('group1', { groupId: 'group1', blendMode: 'accept-last' })
    const c2 = await scheduler.addContact('group1', { groupId: 'group1', blendMode: 'accept-last' })
    const c3 = await scheduler.addContact('group1', { groupId: 'group1', blendMode: 'accept-last' })
    
    // Schedule updates (should be batched)
    await scheduler.scheduleUpdate(c1, 'Update 1')
    await scheduler.scheduleUpdate(c2, 'Update 2')
    await scheduler.scheduleUpdate(c3, 'Update 3')
    
    // Updates should not be applied yet
    let contact1 = await scheduler.getContact(c1)
    expect(contact1?.content).toBeUndefined()
    
    // Advance time to trigger batch
    await vi.runAllTimersAsync()
    
    // Now updates should be applied
    contact1 = await scheduler.getContact(c1)
    const contact2 = await scheduler.getContact(c2)
    const contact3 = await scheduler.getContact(c3)
    
    expect(contact1?.content).toBe('Update 1')
    expect(contact2?.content).toBe('Update 2')
    expect(contact3?.content).toBe('Update 3')
  })
  
  it('should process large batches in chunks', async () => {
    const scheduler = createBatchScheduler({ batchSize: 2, batchDelay: 50 })
    
    // Register group
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Add 5 contacts
    const contacts = []
    for (let i = 0; i < 5; i++) {
      const id = await scheduler.addContact('group1', { 
        groupId: 'group1', 
        blendMode: 'accept-last' 
      })
      contacts.push(id)
    }
    
    // Schedule 5 updates (should be processed in 3 batches: 2, 2, 1)
    for (let i = 0; i < 5; i++) {
      await scheduler.scheduleUpdate(contacts[i], `Update ${i}`)
    }
    
    // First batch (2 updates)
    await vi.advanceTimersByTimeAsync(50)
    
    let c0 = await scheduler.getContact(contacts[0])
    let c1 = await scheduler.getContact(contacts[1])
    let c2 = await scheduler.getContact(contacts[2])
    
    expect(c0?.content).toBe('Update 0')
    expect(c1?.content).toBe('Update 1')
    expect(c2?.content).toBeUndefined() // Not processed yet
    
    // Second batch (2 more updates)
    await vi.advanceTimersByTimeAsync(50)
    
    c2 = await scheduler.getContact(contacts[2])
    const c3 = await scheduler.getContact(contacts[3])
    const c4 = await scheduler.getContact(contacts[4])
    
    expect(c2?.content).toBe('Update 2')
    expect(c3?.content).toBe('Update 3')
    expect(c4?.content).toBeUndefined() // Not processed yet
    
    // Third batch (last update)
    await vi.advanceTimersByTimeAsync(50)
    
    const c4Final = await scheduler.getContact(contacts[4])
    expect(c4Final?.content).toBe('Update 4')
  })
  
  it('should support flush for immediate processing', async () => {
    const scheduler = createBatchScheduler({ 
      batchSize: 10, 
      batchDelay: 1000 // Long delay
    }) as any // Type assertion to access flush
    
    // Register group
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Add contacts
    const c1 = await scheduler.addContact('group1', { groupId: 'group1', blendMode: 'accept-last' })
    const c2 = await scheduler.addContact('group1', { groupId: 'group1', blendMode: 'accept-last' })
    
    // Schedule updates
    await scheduler.scheduleUpdate(c1, 'Update 1')
    await scheduler.scheduleUpdate(c2, 'Update 2')
    
    // Flush immediately without waiting
    await scheduler.flush()
    
    // Updates should be applied
    const contact1 = await scheduler.getContact(c1)
    const contact2 = await scheduler.getContact(c2)
    
    expect(contact1?.content).toBe('Update 1')
    expect(contact2?.content).toBe('Update 2')
  })
  
  it('should handle propagation through batched updates', async () => {
    const scheduler = createBatchScheduler({ batchSize: 5, batchDelay: 50 })
    
    // Register group
    await scheduler.registerGroup({
      id: 'group1',
      name: 'Group 1',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Create chain: A -> B -> C
    const contactA = await scheduler.addContact('group1', { 
      groupId: 'group1', 
      blendMode: 'accept-last' 
    })
    const contactB = await scheduler.addContact('group1', { 
      groupId: 'group1', 
      blendMode: 'accept-last' 
    })
    const contactC = await scheduler.addContact('group1', { 
      groupId: 'group1', 
      blendMode: 'accept-last' 
    })
    
    await scheduler.connect(contactA, contactB)
    await scheduler.connect(contactB, contactC)
    
    // Update A (should propagate to B and C in same batch)
    await scheduler.scheduleUpdate(contactA, 'Propagated Value')
    
    // Process batch
    await vi.advanceTimersByTimeAsync(50)
    
    // All should have the value
    const a = await scheduler.getContact(contactA)
    const b = await scheduler.getContact(contactB)
    const c = await scheduler.getContact(contactC)
    
    expect(a?.content).toBe('Propagated Value')
    expect(b?.content).toBe('Propagated Value')
    expect(c?.content).toBe('Propagated Value')
  })
})