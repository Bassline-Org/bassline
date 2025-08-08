/**
 * Integration test for Kernel + UserspaceRuntime + Storage Driver
 * Verifies the complete architecture works as designed
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Kernel } from '../kernel'
import { UserspaceRuntime } from '../userspace-runtime'
import { MemoryStorageDriver } from '../drivers/memory-storage-driver'
import { brand } from '../../types'
import type { Group } from '../../types'

describe('Kernel Integration', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let storageDriver: MemoryStorageDriver
  
  beforeEach(async () => {
    // Create kernel with debug logging
    kernel = new Kernel({
      debug: true,
      failFast: false
    })
    
    // Create and register storage driver
    storageDriver = new MemoryStorageDriver({
      id: 'test-storage',
      networkId: 'test-network'
    })
    await kernel.registerDriver(storageDriver)
    
    // Create userspace runtime connected to kernel
    runtime = new UserspaceRuntime({ kernel })
  })
  
  describe('Basic Flow', () => {
    it('should propagate changes from userspace through kernel to storage', async () => {
      // Create a simple group with contacts
      const group: Group = {
        id: brand.groupId('test-group'),
        name: 'Test Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      // Add two contacts
      const contact1 = await runtime.addContact('test-group', {
        content: 10,
        blendMode: 'accept-last'
      })
      
      const contact2 = await runtime.addContact('test-group', {
        content: 20,
        blendMode: 'accept-last'
      })
      
      // Connect them with a wire
      await runtime.connect(contact1, contact2, 'bidirectional')
      
      // Update contact1 - should propagate to contact2
      await runtime.scheduleUpdate(contact1, 42)
      
      // Wait for kernel to process all pending operations
      await kernel.waitForCompletion()
      
      // Verify kernel has no pending work
      expect(kernel.hasPendingWork()).toBe(false)
      
      // Verify the change was persisted to storage
      const savedContent = storageDriver.getContactContent(
        brand.groupId('test-group'),
        brand.contactId(contact1)
      )
      
      expect(savedContent).toBe(42)
    })
    
    it('should handle external input from kernel to userspace', async () => {
      // Create a group and contact
      const group: Group = {
        id: brand.groupId('external-group'),
        name: 'External Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      const contactId = await runtime.addContact('external-group', {
        content: 'initial',
        blendMode: 'accept-last'
      })
      
      // Track changes in runtime
      const changes: any[] = []
      runtime.subscribe((newChanges) => {
        changes.push(...newChanges)
      })
      
      // Simulate external input through kernel
      const userspaceHandler = (runtime as any).receiveExternalInput.bind(runtime)
      await userspaceHandler({
        type: 'external-input',
        source: 'test',
        contactId: brand.contactId(contactId),
        groupId: brand.groupId('external-group'),
        value: 'from-external'
      })
      
      // Wait for propagation
      await kernel.waitForCompletion()
      
      // Verify the contact was updated
      const state = await runtime.getState('external-group')
      const contact = state.contacts.get(contactId)
      expect(contact?.content).toBe('from-external')
      
      // Verify change was emitted
      const updateChanges = changes.filter(c => c.type === 'contact-updated')
      expect(updateChanges.length).toBeGreaterThan(0)
    })
    
    it('should handle driver errors without silent failures', async () => {
      // Create a group
      const group: Group = {
        id: brand.groupId('error-group'),
        name: 'Error Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      const contactId = await runtime.addContact('error-group', {
        content: 'test',
        blendMode: 'accept-last'
      })
      
      // Force storage to fail by clearing all data
      storageDriver.getAllData().contacts.clear()
      
      // Update should not block userspace
      await runtime.scheduleUpdate(contactId, 'will-fail')
      
      // Wait to see if kernel handles the error
      await kernel.waitForCompletion()
      
      // Kernel should have logged the error but not crashed
      // The key is that userspace propagation wasn't blocked
      const state = await runtime.getState('error-group')
      const contact = state.contacts.get(contactId)
      expect(contact?.content).toBe('will-fail') // Userspace updated despite storage failure
    })
  })
  
  describe('Performance', () => {
    it('should not block userspace propagation on slow storage', async () => {
      // Create a slow storage driver that delays operations
      class SlowStorageDriver extends MemoryStorageDriver {
        async handleChange(change: any): Promise<any> {
          // Simulate slow I/O
          await new Promise(resolve => setTimeout(resolve, 100))
          return super.handleChange(change)
        }
      }
      
      const slowDriver = new SlowStorageDriver({
        id: 'slow-storage',
        networkId: 'test-network'
      })
      
      // Replace the fast driver with slow one
      await kernel.shutdown()
      kernel = new Kernel({ debug: false })
      await kernel.registerDriver(slowDriver)
      runtime = new UserspaceRuntime({ kernel })
      
      // Create test structure
      const group: Group = {
        id: brand.groupId('perf-group'),
        name: 'Performance Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      const contact1 = await runtime.addContact('perf-group', {
        content: 1,
        blendMode: 'accept-last'
      })
      
      const contact2 = await runtime.addContact('perf-group', {
        content: 2,
        blendMode: 'accept-last'
      })
      
      await runtime.connect(contact1, contact2, 'bidirectional')
      
      // Measure propagation time
      const startTime = Date.now()
      
      // Update should return immediately despite slow storage
      await runtime.scheduleUpdate(contact1, 999)
      
      const propagationTime = Date.now() - startTime
      
      // Propagation should be fast (< 10ms) even though storage is slow (100ms)
      expect(propagationTime).toBeLessThan(10)
      
      // Verify kernel has pending work (storage is still processing)
      expect(kernel.hasPendingWork()).toBe(true)
      
      // Wait for storage to complete
      await kernel.waitForCompletion()
      
      // Now kernel should have no pending work
      expect(kernel.hasPendingWork()).toBe(false)
    })
  })
  
  describe('Shutdown', () => {
    it('should wait for pending operations before shutdown', async () => {
      const group: Group = {
        id: brand.groupId('shutdown-group'),
        name: 'Shutdown Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      // Create many contacts and updates
      const contactIds: string[] = []
      for (let i = 0; i < 10; i++) {
        const id = await runtime.addContact('shutdown-group', {
          content: i,
          blendMode: 'accept-last'
        })
        contactIds.push(id)
      }
      
      // Update all contacts (creates pending operations)
      for (const id of contactIds) {
        await runtime.scheduleUpdate(id, Math.random())
      }
      
      // Immediately shutdown - should wait for all operations
      await kernel.shutdown()
      
      // After shutdown, no pending work should remain
      expect(kernel.hasPendingWork()).toBe(false)
    })
  })
})