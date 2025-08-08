/**
 * Test for CLI Bridge Driver
 * Verifies external input from CLI flows through kernel to userspace
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Kernel } from '../kernel'
import { UserspaceRuntime } from '../userspace-runtime'
import { MemoryStorageDriver } from '../drivers/memory-storage-driver'
import { CLIBridgeDriver } from '../drivers/cli-bridge-driver'
import { brand } from '../../types'
import type { Group } from '../../types'

describe('CLI Bridge Driver', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let storageDriver: MemoryStorageDriver
  let cliDriver: CLIBridgeDriver
  
  beforeEach(async () => {
    // Create kernel
    kernel = new Kernel({
      debug: false,
      failFast: false
    })
    
    // Create and register storage driver
    storageDriver = new MemoryStorageDriver({
      id: 'test-storage',
      networkId: 'test-network'
    })
    await kernel.registerDriver(storageDriver)
    
    // Create and register CLI bridge driver
    cliDriver = new CLIBridgeDriver({
      id: 'test-cli-bridge'
    })
    await kernel.registerDriver(cliDriver)
    
    // Create userspace runtime connected to kernel
    runtime = new UserspaceRuntime({ kernel })
  })
  
  describe('External Input Flow', () => {
    it('should send CLI commands through kernel to userspace', async () => {
      // Create a group and contact in userspace
      const group: Group = {
        id: brand.groupId('cli-test-group'),
        name: 'CLI Test Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      const contactId = await runtime.addContact('cli-test-group', {
        content: 'initial-value',
        blendMode: 'accept-last'
      })
      
      // Track changes in runtime
      const changes: any[] = []
      runtime.subscribe((newChanges) => {
        changes.push(...newChanges)
      })
      
      // Send a command through the CLI bridge
      await cliDriver.sendCommand({
        type: 'set-contact',
        contactId,
        groupId: 'cli-test-group',
        value: 'cli-updated-value'
      })
      
      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Wait for kernel to complete any pending work
      await kernel.waitForCompletion()
      
      // Verify the contact was updated in userspace
      const state = await runtime.getState('cli-test-group')
      const contact = state.contacts.get(contactId)
      expect(contact?.content).toBe('cli-updated-value')
      
      // Verify the change was persisted to storage
      const savedContent = storageDriver.getContactContent(
        brand.groupId('cli-test-group'),
        brand.contactId(contactId)
      )
      expect(savedContent).toBe('cli-updated-value')
      
      // Verify change events were emitted
      const updateChanges = changes.filter(c => c.type === 'contact-updated')
      expect(updateChanges.length).toBeGreaterThan(0)
    })
    
    it('should handle multiple CLI commands in sequence', async () => {
      // Create a group with multiple contacts
      const group: Group = {
        id: brand.groupId('multi-cli-group'),
        name: 'Multi CLI Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      const contact1 = await runtime.addContact('multi-cli-group', {
        content: 1,
        blendMode: 'accept-last'
      })
      
      const contact2 = await runtime.addContact('multi-cli-group', {
        content: 2,
        blendMode: 'accept-last'
      })
      
      const contact3 = await runtime.addContact('multi-cli-group', {
        content: 3,
        blendMode: 'accept-last'
      })
      
      // Connect them in a chain: contact1 -> contact2 -> contact3
      await runtime.connect(contact1, contact2, 'directed')
      await runtime.connect(contact2, contact3, 'directed')
      
      // Send multiple CLI commands
      await cliDriver.sendCommand({
        type: 'set-contact',
        contactId: contact1,
        groupId: 'multi-cli-group',
        value: 100
      })
      
      await cliDriver.sendCommand({
        type: 'set-contact',
        contactId: contact2,
        groupId: 'multi-cli-group',
        value: 200
      })
      
      await cliDriver.sendCommand({
        type: 'set-contact',
        contactId: contact3,
        groupId: 'multi-cli-group',
        value: 300
      })
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100))
      await kernel.waitForCompletion()
      
      // Verify all contacts were updated
      const state = await runtime.getState('multi-cli-group')
      expect(state.contacts.get(contact1)?.content).toBe(100)
      expect(state.contacts.get(contact2)?.content).toBe(200)
      expect(state.contacts.get(contact3)?.content).toBe(300)
      
      // Verify all were persisted
      expect(storageDriver.getContactContent(
        brand.groupId('multi-cli-group'),
        brand.contactId(contact1)
      )).toBe(100)
      
      expect(storageDriver.getContactContent(
        brand.groupId('multi-cli-group'),
        brand.contactId(contact2)
      )).toBe(200)
      
      expect(storageDriver.getContactContent(
        brand.groupId('multi-cli-group'),
        brand.contactId(contact3)
      )).toBe(300)
    })
    
    it('should emit events for CLI feedback', async () => {
      const group: Group = {
        id: brand.groupId('event-group'),
        name: 'Event Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      const contactId = await runtime.addContact('event-group', {
        content: 'test',
        blendMode: 'accept-last'
      })
      
      // Listen for CLI bridge events
      const processedEvents: any[] = []
      const errorEvents: any[] = []
      
      cliDriver.on('command-processed', (event) => {
        processedEvents.push(event)
      })
      
      cliDriver.on('command-error', (event) => {
        errorEvents.push(event)
      })
      
      // Send a valid command
      await cliDriver.sendCommand({
        type: 'set-contact',
        contactId,
        groupId: 'event-group',
        value: 'new-value'
      })
      
      // Send an invalid command (missing required fields)
      await cliDriver.sendCommand({
        type: 'set-contact',
        // Missing contactId and groupId
        value: 'will-fail'
      })
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check events were emitted
      expect(processedEvents.length).toBe(1)
      expect(processedEvents[0].command).toBe('set-contact')
      expect(processedEvents[0].success).toBe(true)
      
      expect(errorEvents.length).toBe(1)
      expect(errorEvents[0].command).toBe('set-contact')
      expect(errorEvents[0].error).toContain('requires contactId and groupId')
    })
  })
  
  describe('Bridge Lifecycle', () => {
    it('should handle start and stop listening', async () => {
      // Initially should be listening (started by kernel registration)
      expect(cliDriver.getStats().isListening).toBe(true)
      
      // Stop listening
      await cliDriver.stopListening()
      expect(cliDriver.getStats().isListening).toBe(false)
      
      // Commands should fail when not listening
      await expect(cliDriver.sendCommand({
        type: 'set-contact',
        contactId: 'test',
        groupId: 'test',
        value: 'test'
      })).rejects.toThrow('CLI Bridge is not listening')
      
      // Start listening again
      await cliDriver.startListening()
      expect(cliDriver.getStats().isListening).toBe(true)
      
      // Commands should work again
      await expect(cliDriver.sendCommand({
        type: 'set-contact',
        contactId: 'test',
        groupId: 'test',
        value: 'test'
      })).resolves.toBeUndefined()
    })
    
    it('should properly clean up on shutdown', async () => {
      // Add some commands to the queue
      await cliDriver.sendCommand({
        type: 'set-contact',
        contactId: 'test1',
        groupId: 'test',
        value: 1
      })
      
      await cliDriver.sendCommand({
        type: 'set-contact',
        contactId: 'test2',
        groupId: 'test',
        value: 2
      })
      
      expect(cliDriver.getStats().queueLength).toBeGreaterThan(0)
      
      // Shutdown the kernel (which should shutdown all drivers)
      await kernel.shutdown()
      
      // Driver should be stopped and queue cleared
      expect(cliDriver.getStats().isListening).toBe(false)
      expect(cliDriver.getStats().queueLength).toBe(0)
    })
  })
  
  describe('Error Handling', () => {
    it('should handle kernel errors gracefully', async () => {
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
      
      // Try to update a non-existent contact
      const errorEvents: any[] = []
      cliDriver.on('command-error', (event) => {
        errorEvents.push(event)
      })
      
      await cliDriver.sendCommand({
        type: 'set-contact',
        contactId: 'non-existent-contact',
        groupId: 'error-group',
        value: 'will-fail'
      })
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Should have received an error event
      expect(errorEvents.length).toBe(1)
      expect(errorEvents[0].error).toContain('Userspace rejected external input')
    })
  })
})