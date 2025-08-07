/**
 * PostgreSQL Storage Tests
 * 
 * Tests the PostgreSQL storage implementation with a real database
 */

import { describe, beforeAll, afterAll, beforeEach, test, expect } from 'vitest'
import { PostgresStorage, createPostgresStorage } from '../index'
import { brand } from '@bassline/core'
import type { NetworkState, GroupState, Contact, Group } from '@bassline/core'

// Test configuration - adjust these for your local setup
const TEST_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'bassline_test',
  user: process.env.POSTGRES_USER || process.env.USER,
  password: process.env.POSTGRES_PASSWORD,
}

describe('PostgresStorage', () => {
  let storage: PostgresStorage
  
  // Test data
  const testNetworkId = brand.networkId('test-network-123')
  const testGroupId = brand.groupId('test-group-456')
  const testContactId = brand.contactId('test-contact-789')
  
  const testContact: Contact = {
    id: testContactId,
    groupId: testGroupId,
    content: { message: 'Hello, PostgreSQL!' },
    blendMode: 'accept-last'
  }
  
  const testGroup: Group = {
    id: testGroupId,
    name: 'Test Group',
    contactIds: [testContactId],
    wireIds: [],
    subgroupIds: [],
    boundaryContactIds: [],
    attributes: {
      'bassline.type': 'test-group',
      'bassline.author': 'test-suite',
      'bassline.tags': ['testing', 'postgres']
    }
  }
  
  const testGroupState: GroupState = {
    group: testGroup,
    contacts: new Map([[testContactId, testContact]]),
    wires: new Map()
  }
  
  const testNetworkState: NetworkState = {
    groups: new Map([[testGroupId, testGroupState]]),
    currentGroupId: 'root',
    rootGroupId: 'root'
  }

  beforeAll(async () => {
    // Create storage instance
    const tempStorage = new PostgresStorage({
      type: 'postgres',
      options: TEST_CONFIG
    })
    
    try {
      // Initialize schema
      const initResult = await tempStorage.initialize()
      if (!initResult.ok) {
        console.warn('Failed to initialize PostgreSQL storage:', initResult.error)
        console.warn('Skipping PostgreSQL tests - please ensure PostgreSQL is running and accessible')
        await tempStorage.close()
        return
      }
      
      console.log('✓ PostgreSQL storage initialized successfully')
      storage = tempStorage
    } catch (error) {
      console.warn('PostgreSQL connection failed:', error)
      console.warn('Skipping PostgreSQL tests - please ensure PostgreSQL is running')
      await tempStorage.close()
    }
  })

  afterAll(async () => {
    if (storage) {
      await storage.close()
    }
  })

  beforeEach(async () => {
    if (!storage) return
    
    // Clean up test data before each test
    // Use direct SQL to ensure clean state
    const pool = (storage as any).pool
    if (pool) {
      try {
        await pool.query('DELETE FROM bassline_snapshots WHERE network_id = $1', [testNetworkId])
        await pool.query('DELETE FROM bassline_contacts WHERE network_id = $1', [testNetworkId])
        await pool.query('DELETE FROM bassline_groups WHERE network_id = $1', [testNetworkId])
        await pool.query('DELETE FROM bassline_networks WHERE id = $1', [testNetworkId])
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  })

  describe('Network Operations', () => {
    test('should save and load network state', async () => {
      if (!storage) return
      
      // Save network state
      const saveResult = await storage.saveNetworkState(testNetworkId, testNetworkState)
      if (!saveResult.ok) {
        console.error('Save failed:', saveResult.error)
      }
      expect(saveResult.ok).toBe(true)
      
      // Load network state
      const loadResult = await storage.loadNetworkState(testNetworkId)
      if (!loadResult.ok) {
        console.error('Load failed:', loadResult.error)
      }
      expect(loadResult.ok).toBe(true)
      if (loadResult.ok) {
        expect(loadResult.value).toEqual(testNetworkState)
      }
    })

    test('should check network existence', async () => {
      if (!storage) return
      
      // Should not exist initially
      const existsResult1 = await storage.exists(testNetworkId)
      expect(existsResult1.ok).toBe(true)
      if (existsResult1.ok) {
        expect(existsResult1.value).toBe(false)
      }
      
      // Save network
      await storage.saveNetworkState(testNetworkId, testNetworkState)
      
      // Should exist now
      const existsResult2 = await storage.exists(testNetworkId)
      expect(existsResult2.ok).toBe(true)
      if (existsResult2.ok) {
        expect(existsResult2.value).toBe(true)
      }
    })

    test('should list networks', async () => {
      if (!storage) return
      
      // Save a network
      await storage.saveNetworkState(testNetworkId, testNetworkState)
      
      // List networks
      const listResult = await storage.listNetworks()
      expect(listResult.ok).toBe(true)
      expect(listResult.value).toContain(testNetworkId)
    })

    test('should delete networks', async () => {
      if (!storage) return
      
      // Save network
      await storage.saveNetworkState(testNetworkId, testNetworkState)
      
      // Verify exists
      const existsResult1 = await storage.exists(testNetworkId)
      expect(existsResult1.value).toBe(true)
      
      // Delete network
      const deleteResult = await storage.deleteNetwork(testNetworkId)
      expect(deleteResult.ok).toBe(true)
      
      // Verify deleted
      const existsResult2 = await storage.exists(testNetworkId)
      expect(existsResult2.value).toBe(false)
    })
  })

  describe('Group Operations', () => {
    beforeEach(async () => {
      if (!storage) return
      // Ensure network exists for group operations
      await storage.saveNetworkState(testNetworkId, testNetworkState)
    })

    test('should save and load group state', async () => {
      if (!storage) return
      
      // Save group state
      const saveResult = await storage.saveGroupState(testNetworkId, testGroupId, testGroupState)
      expect(saveResult.ok).toBe(true)
      
      // Load group state
      const loadResult = await storage.loadGroupState(testNetworkId, testGroupId)
      expect(loadResult.ok).toBe(true)
      expect(loadResult.value).toEqual(testGroupState)
    })

    test('should return null for non-existent group', async () => {
      if (!storage) return
      
      const nonExistentGroupId = brand.groupId('non-existent')
      const loadResult = await storage.loadGroupState(testNetworkId, nonExistentGroupId)
      expect(loadResult.ok).toBe(true)
      expect(loadResult.value).toBeNull()
    })

    test('should delete groups', async () => {
      if (!storage) return
      
      // Save group
      await storage.saveGroupState(testNetworkId, testGroupId, testGroupState)
      
      // Verify exists
      const loadResult1 = await storage.loadGroupState(testNetworkId, testGroupId)
      expect(loadResult1.value).not.toBeNull()
      
      // Delete group
      const deleteResult = await storage.deleteGroup(testNetworkId, testGroupId)
      expect(deleteResult.ok).toBe(true)
      
      // Verify deleted
      const loadResult2 = await storage.loadGroupState(testNetworkId, testGroupId)
      expect(loadResult2.value).toBeNull()
    })
  })

  describe('Contact Operations', () => {
    beforeEach(async () => {
      if (!storage) return
      // Setup network and group
      await storage.saveNetworkState(testNetworkId, testNetworkState)
      await storage.saveGroupState(testNetworkId, testGroupId, testGroupState)
    })

    test('should save and load contact content', async () => {
      if (!storage) return
      
      const testContent = { 
        message: 'Test contact content',
        number: 42,
        nested: { value: 'deep' }
      }
      
      // Save contact content
      const saveResult = await storage.saveContactContent(
        testNetworkId, 
        testGroupId, 
        testContactId, 
        testContent
      )
      expect(saveResult.ok).toBe(true)
      
      // Load contact content
      const loadResult = await storage.loadContactContent<typeof testContent>(
        testNetworkId,
        testGroupId,
        testContactId
      )
      expect(loadResult.ok).toBe(true)
      expect(loadResult.value).toEqual(testContent)
    })

    test('should return null for non-existent contact', async () => {
      if (!storage) return
      
      const nonExistentContactId = brand.contactId('non-existent')
      const loadResult = await storage.loadContactContent(
        testNetworkId,
        testGroupId,
        nonExistentContactId
      )
      expect(loadResult.ok).toBe(true)
      expect(loadResult.value).toBeNull()
    })

    test('should handle contact content updates', async () => {
      if (!storage) return
      
      const initialContent = { value: 'initial' }
      const updatedContent = { value: 'updated', extra: 'data' }
      
      // Save initial content
      await storage.saveContactContent(testNetworkId, testGroupId, testContactId, initialContent)
      
      // Update content
      await storage.saveContactContent(testNetworkId, testGroupId, testContactId, updatedContent)
      
      // Load and verify updated content
      const loadResult = await storage.loadContactContent(testNetworkId, testGroupId, testContactId)
      expect(loadResult.ok).toBe(true)
      expect(loadResult.value).toEqual(updatedContent)
    })
  })

  describe('Query Operations', () => {
    beforeEach(async () => {
      if (!storage) return
      
      // Setup test data with multiple groups
      await storage.saveNetworkState(testNetworkId, testNetworkState)
      
      // Add additional test groups
      const testGroup2: Group = {
        ...testGroup,
        id: brand.groupId('test-group-2'),
        name: 'Test Group 2',
        attributes: {
          'bassline.type': 'gadget',
          'bassline.author': 'different-author',
          'bassline.tags': ['gadget', 'math']
        }
      }
      
      const testGroupState2: GroupState = {
        group: testGroup2,
        contacts: new Map(),
        wires: new Map()
      }
      
      await storage.saveGroupState(testNetworkId, testGroupId, testGroupState)
      await storage.saveGroupState(testNetworkId, testGroup2.id, testGroupState2)
    })

    test('should query groups by attributes', async () => {
      if (!storage) return
      
      const queryResult = await storage.queryGroups(testNetworkId, {
        attributes: { 'bassline.type': 'test-group' }
      })
      
      expect(queryResult.ok).toBe(true)
      expect(queryResult.value).toHaveLength(1)
      expect(queryResult.value[0].group.id).toBe(testGroupId)
    })

    test('should query groups by author', async () => {
      if (!storage) return
      
      const queryResult = await storage.queryGroups(testNetworkId, {
        author: 'test-suite'
      })
      
      expect(queryResult.ok).toBe(true)
      expect(queryResult.value).toHaveLength(1)
      expect(queryResult.value[0].group.id).toBe(testGroupId)
    })

    test('should query groups by type', async () => {
      if (!storage) return
      
      const queryResult = await storage.queryGroups(testNetworkId, {
        type: 'gadget'
      })
      
      expect(queryResult.ok).toBe(true)
      expect(queryResult.value).toHaveLength(1)
      expect(queryResult.value[0].group.attributes?.['bassline.type']).toBe('gadget')
    })

    test('should query groups by tags', async () => {
      if (!storage) return
      
      const queryResult = await storage.queryGroups(testNetworkId, {
        tags: ['testing']
      })
      
      expect(queryResult.ok).toBe(true)
      expect(queryResult.value).toHaveLength(1)
      expect(queryResult.value[0].group.id).toBe(testGroupId)
    })

    test('should return empty array for no matches', async () => {
      if (!storage) return
      
      const queryResult = await storage.queryGroups(testNetworkId, {
        author: 'non-existent-author'
      })
      
      expect(queryResult.ok).toBe(true)
      expect(queryResult.value).toHaveLength(0)
    })
  })

  describe('Snapshot Operations', () => {
    beforeEach(async () => {
      if (!storage) return
      // Setup network for snapshot operations
      await storage.saveNetworkState(testNetworkId, testNetworkState)
    })

    test('should save and load snapshots', async () => {
      if (!storage) return
      
      const label = 'Test Snapshot'
      
      // Save snapshot
      const saveResult = await storage.saveSnapshot(testNetworkId, label)
      expect(saveResult.ok).toBe(true)
      
      const snapshotId = saveResult.value
      expect(typeof snapshotId).toBe('string')
      
      // Load snapshot
      const loadResult = await storage.loadSnapshot(testNetworkId, snapshotId)
      expect(loadResult.ok).toBe(true)
      expect(loadResult.value).toEqual(testNetworkState)
    })

    test('should list snapshots', async () => {
      if (!storage) return
      
      // Save multiple snapshots
      const snapshot1 = await storage.saveSnapshot(testNetworkId, 'Snapshot 1')
      const snapshot2 = await storage.saveSnapshot(testNetworkId, 'Snapshot 2')
      
      expect(snapshot1.ok).toBe(true)
      expect(snapshot2.ok).toBe(true)
      
      // List snapshots
      const listResult = await storage.listSnapshots(testNetworkId)
      expect(listResult.ok).toBe(true)
      expect(listResult.value).toHaveLength(2)
      
      // Check that snapshots are sorted by creation date (newest first)
      const snapshots = listResult.value
      expect(snapshots[0].createdAt.getTime()).toBeGreaterThanOrEqual(snapshots[1].createdAt.getTime())
      
      // Check snapshot info
      expect(snapshots[0].networkId).toBe(testNetworkId)
      expect(snapshots[0].size).toBeGreaterThan(0)
    })

    test('should delete snapshots', async () => {
      if (!storage) return
      
      // Save snapshot
      const saveResult = await storage.saveSnapshot(testNetworkId, 'To Delete')
      expect(saveResult.ok).toBe(true)
      
      const snapshotId = saveResult.value
      
      // Verify exists in list
      const listResult1 = await storage.listSnapshots(testNetworkId)
      expect(listResult1.ok).toBe(true)
      expect(listResult1.value).toHaveLength(1)
      
      // Delete snapshot
      const deleteResult = await storage.deleteSnapshot(testNetworkId, snapshotId)
      expect(deleteResult.ok).toBe(true)
      
      // Verify deleted
      const listResult2 = await storage.listSnapshots(testNetworkId)
      expect(listResult2.ok).toBe(true)
      expect(listResult2.value).toHaveLength(0)
    })

    test('should handle non-existent snapshot gracefully', async () => {
      if (!storage) return
      
      const fakeSnapshotId = brand.snapshotId('fake-snapshot-id')
      
      const loadResult = await storage.loadSnapshot(testNetworkId, fakeSnapshotId)
      expect(loadResult.ok).toBe(false)
      expect(loadResult.error.code).toBe('SNAPSHOT_NOT_FOUND')
    })
  })

  describe('Advanced PostgreSQL Features', () => {
    beforeEach(async () => {
      if (!storage) return
      await storage.saveNetworkState(testNetworkId, testNetworkState)
      await storage.saveGroupState(testNetworkId, testGroupId, testGroupState)
    })

    test('should get network statistics', async () => {
      if (!storage) return
      
      const statsResult = await storage.getNetworkStats(testNetworkId)
      expect(statsResult.ok).toBe(true)
      
      const stats = statsResult.value
      expect(stats.groupCount).toBeGreaterThanOrEqual(1)
      expect(stats.contactCount).toBeGreaterThanOrEqual(0)
      expect(stats.snapshotCount).toBeGreaterThanOrEqual(0)
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.lastUpdated).toBeInstanceOf(Date)
    })

    test('should perform full-text search', async () => {
      if (!storage) return
      
      // Add a group with searchable content
      const searchableGroup: Group = {
        ...testGroup,
        id: brand.groupId('searchable-group'),
        name: 'Machine Learning Model',
        attributes: {
          description: 'Advanced neural network for image classification'
        }
      }
      
      const searchableGroupState: GroupState = {
        group: searchableGroup,
        contacts: new Map(),
        wires: new Map()
      }
      
      await storage.saveGroupState(testNetworkId, searchableGroup.id, searchableGroupState)
      
      // Search for groups
      const searchResult = await storage.searchGroups(testNetworkId, 'machine learning')
      expect(searchResult.ok).toBe(true)
      expect(searchResult.value).toHaveLength(1)
      expect(searchResult.value[0].group.id).toBe(searchableGroup.id)
    })
  })

  describe('Error Handling', () => {
    test('should handle network not found errors', async () => {
      if (!storage) return
      
      const nonExistentNetworkId = brand.networkId('non-existent-network')
      
      const saveSnapshotResult = await storage.saveSnapshot(nonExistentNetworkId, 'Test')
      expect(saveSnapshotResult.ok).toBe(false)
      expect(saveSnapshotResult.error.message).toContain('not found')
    })

    test('should handle group not found errors', async () => {
      if (!storage) return
      
      const nonExistentGroupId = brand.groupId('non-existent-group')
      
      const saveContactResult = await storage.saveContactContent(
        testNetworkId, 
        nonExistentGroupId, 
        testContactId, 
        'test'
      )
      expect(saveContactResult.ok).toBe(false)
    })
  })

  describe('Factory Function', () => {
    test('should create storage instance via factory', () => {
      const factoryStorage = createPostgresStorage({
        type: 'postgres',
        options: TEST_CONFIG
      })
      
      expect(factoryStorage).toBeInstanceOf(PostgresStorage)
    })
  })
})