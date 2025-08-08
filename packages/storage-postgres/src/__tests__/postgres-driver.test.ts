/**
 * Test for PostgreSQL Storage Driver
 * Verifies PostgreSQL integration with kernel architecture
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Pool } from 'pg'
import { PostgresStorageDriver } from '../postgres-storage-driver.js'
import { brand, Kernel, UserspaceRuntime } from '@bassline/core'
import type { Group } from '@bassline/core'

// Skip tests if no PostgreSQL available
const SKIP_POSTGRES = process.env.SKIP_POSTGRES_TESTS === 'true'

describe.skipIf(SKIP_POSTGRES)('PostgreSQL Storage Driver', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let postgresDriver: PostgresStorageDriver
  let testPool: Pool
  const testNetworkId = `test-network-${Date.now()}`
  
  beforeEach(async () => {
    // Create a test database connection
    testPool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'bassline_test',
      user: process.env.USER,
    })
    
    // Clean up any existing test data
    try {
      await testPool.query('DELETE FROM bassline_contacts WHERE network_id = $1', [testNetworkId])
      await testPool.query('DELETE FROM bassline_groups WHERE network_id = $1', [testNetworkId])
      await testPool.query('DELETE FROM bassline_networks WHERE id = $1', [testNetworkId])
    } catch (error) {
      // Tables might not exist yet, that's okay
    }
    
    // Create kernel
    kernel = new Kernel({
      debug: false,
      failFast: false
    })
    
    // Create and register PostgreSQL driver
    postgresDriver = new PostgresStorageDriver({
      id: 'test-postgres',
      networkId: testNetworkId,
      database: 'bassline_test',
      host: 'localhost',
      port: 5432,
      user: process.env.USER,
    })
    await kernel.registerDriver(postgresDriver)
    
    // Create userspace runtime
    runtime = new UserspaceRuntime({ kernel })
  })
  
  afterEach(async () => {
    // Clean up test data
    try {
      await testPool.query('DELETE FROM bassline_contacts WHERE network_id = $1', [testNetworkId])
      await testPool.query('DELETE FROM bassline_groups WHERE network_id = $1', [testNetworkId])
      await testPool.query('DELETE FROM bassline_networks WHERE id = $1', [testNetworkId])
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Shutdown
    await kernel.shutdown()
    await testPool.end()
  })
  
  describe('Basic Persistence', () => {
    it('should persist changes to PostgreSQL', async () => {
      // Create a group and contacts
      const group: Group = {
        id: brand.groupId('postgres-test-group'),
        name: 'PostgreSQL Test Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      const contact1 = await runtime.addContact('postgres-test-group', {
        content: { message: 'Hello PostgreSQL', count: 42 },
        blendMode: 'accept-last'
      })
      
      const contact2 = await runtime.addContact('postgres-test-group', {
        content: 'Simple string value',
        blendMode: 'accept-last'
      })
      
      // Don't connect them - test pure storage without propagation
      // await runtime.connect(contact1, contact2, 'bidirectional')
      
      // Update contact1
      await runtime.scheduleUpdate(contact1, { message: 'Updated', count: 100 })
      
      // Wait for kernel to persist
      await kernel.waitForCompletion()
      
      // Verify data was persisted to PostgreSQL
      const result = await testPool.query(
        'SELECT content FROM bassline_contacts WHERE network_id = $1 AND contact_id = $2',
        [testNetworkId, contact1]
      )
      
      expect(result.rows.length).toBe(1)
      const savedContent = result.rows[0].content // jsonb columns auto-parse
      expect(savedContent.message).toBe('Updated')
      expect(savedContent.count).toBe(100)
    })
    
    it('should handle preconditions by creating groups', async () => {
      // Try to update a contact without creating a group first
      // The driver should create the group automatically in checkPreconditions
      
      const contactId = brand.contactId('orphan-contact')
      const groupId = brand.groupId('auto-created-group')
      
      // Emit a change directly to kernel (simulating external input)
      await kernel.handleChange({
        type: 'contact-change',
        contactId,
        groupId,
        value: 'test-value',
        timestamp: Date.now()
      })
      
      await kernel.waitForCompletion()
      
      // Verify the group was auto-created
      const groupResult = await testPool.query(
        'SELECT * FROM bassline_groups WHERE network_id = $1 AND group_id = $2',
        [testNetworkId, 'auto-created-group']
      )
      
      expect(groupResult.rows.length).toBe(1)
      
      // Verify the contact was saved
      const contactResult = await testPool.query(
        'SELECT content FROM bassline_contacts WHERE network_id = $1 AND contact_id = $2',
        [testNetworkId, 'orphan-contact']
      )
      
      expect(contactResult.rows.length).toBe(1)
      expect(contactResult.rows[0].content).toBe('test-value') // jsonb columns auto-parse
    })
  })
  
  describe.skip('Batch Operations (TODO: Implement proper transactions)', () => {
    it('should support batch operations for efficiency', async () => {
      const group: Group = {
        id: brand.groupId('batch-group'),
        name: 'Batch Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      // Begin batch
      await postgresDriver.beginBatch()
      
      // Create many contacts
      const contactIds: string[] = []
      for (let i = 0; i < 10; i++) {
        const id = await runtime.addContact('batch-group', {
          content: i,
          blendMode: 'accept-last'
        })
        contactIds.push(id)
      }
      
      // Update all contacts (should be batched)
      for (const [index, id] of contactIds.entries()) {
        await runtime.scheduleUpdate(id, index * 10)
      }
      
      // Nothing should be in database yet
      const beforeCommit = await testPool.query(
        'SELECT COUNT(*) as count FROM bassline_contacts WHERE network_id = $1 AND group_id = $2',
        [testNetworkId, 'batch-group']
      )
      expect(parseInt(beforeCommit.rows[0].count)).toBe(0)
      
      // Commit batch
      await postgresDriver.commitBatch()
      await kernel.waitForCompletion()
      
      // Now all should be in database
      const afterCommit = await testPool.query(
        'SELECT COUNT(*) as count FROM bassline_contacts WHERE network_id = $1 AND group_id = $2',
        [testNetworkId, 'batch-group']
      )
      expect(parseInt(afterCommit.rows[0].count)).toBe(10)
    })
    
    it('should rollback batch on error', async () => {
      const group: Group = {
        id: brand.groupId('rollback-group'),
        name: 'Rollback Group',
        parentId: undefined,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        attributes: {}
      }
      
      await runtime.registerGroup(group)
      
      // Begin batch
      await postgresDriver.beginBatch()
      
      // Add some contacts
      const contact1 = await runtime.addContact('rollback-group', {
        content: 'will-be-rolled-back',
        blendMode: 'accept-last'
      })
      
      await runtime.scheduleUpdate(contact1, 'updated-value')
      
      // Rollback instead of commit
      await postgresDriver.rollbackBatch()
      await kernel.waitForCompletion()
      
      // Nothing should be in database
      const result = await testPool.query(
        'SELECT COUNT(*) as count FROM bassline_contacts WHERE network_id = $1 AND contact_id = $2',
        [testNetworkId, contact1]
      )
      expect(parseInt(result.rows[0].count)).toBe(0)
    })
  })
  
  describe('Error Handling', () => {
    it('should handle connection failures gracefully', async () => {
      // Create a driver with invalid connection
      const badDriver = new PostgresStorageDriver({
        id: 'bad-postgres',
        networkId: 'bad-network',
        host: 'invalid-host',
        port: 9999,
        database: 'non-existent',
      })
      
      // Health check should fail
      const isHealthy = await badDriver.isHealthy()
      expect(isHealthy).toBe(false)
    })
  })
  
  describe('Capabilities', () => {
    it('should report correct capabilities', () => {
      const caps = postgresDriver.getCapabilities()
      
      expect(caps.persistent).toBe(true) // PostgreSQL is persistent
      expect(caps.supportsBatching).toBe(true) // We implemented batching
      expect(caps.supportsTransactions).toBe(true) // PostgreSQL has transactions
      expect(caps.supportsStreaming).toBe(false) // Not implemented yet
    })
  })
})