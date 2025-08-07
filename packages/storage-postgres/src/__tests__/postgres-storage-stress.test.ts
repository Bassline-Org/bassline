/**
 * PostgreSQL Storage Stress Tests
 * 
 * Tests for edge cases, concurrent operations, and performance
 */

import { describe, beforeAll, afterAll, beforeEach, test, expect } from 'vitest'
import { PostgresStorage } from '../index'
import { brand } from '@bassline/core'
import type { NetworkState, GroupState, Contact, Group } from '@bassline/core'

// Test configuration
const TEST_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'bassline_test',
  user: process.env.POSTGRES_USER || process.env.USER,
  password: process.env.POSTGRES_PASSWORD,
}

describe('PostgreSQL Storage Stress Tests', () => {
  let storage: PostgresStorage | null = null
  
  beforeAll(async () => {
    const tempStorage = new PostgresStorage({
      type: 'postgres',
      options: TEST_CONFIG
    })
    
    try {
      const initResult = await tempStorage.initialize()
      if (!initResult.ok) {
        console.warn('Skipping stress tests - PostgreSQL not available')
        await tempStorage.close()
        return
      }
      storage = tempStorage
    } catch (error) {
      console.warn('Skipping stress tests - PostgreSQL not available')
      await tempStorage.close()
    }
  })
  
  afterAll(async () => {
    if (storage) {
      await storage.close()
    }
  })
  
  describe('Concurrent Operations', () => {
    const testNetworkId = brand.networkId('stress-test-concurrent')
    
    beforeEach(async () => {
      if (!storage) return
      const pool = (storage as any).pool
      if (pool) {
        try {
          await pool.query('DELETE FROM bassline_networks WHERE id = $1', [testNetworkId])
        } catch {}
      }
    })
    
    test('should handle concurrent saves to the same network', async () => {
      if (!storage) return
      
      // Create multiple group states
      const groups = Array.from({ length: 10 }, (_, i) => {
        const groupId = brand.groupId(`group-${i}`)
        const contactId = brand.contactId(`contact-${i}`)
        
        const contact: Contact = {
          id: contactId,
          groupId,
          content: { value: i },
          blendMode: 'accept-last'
        }
        
        const group: Group = {
          id: groupId,
          name: `Group ${i}`,
          contactIds: [contactId],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: [],
          attributes: { index: i }
        }
        
        const groupState: GroupState = {
          group,
          contacts: new Map([[contactId, contact]]),
          wires: new Map()
        }
        
        return [groupId, groupState] as const
      })
      
      const networkState: NetworkState = {
        groups: new Map(groups),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      // Save initial state
      await storage.saveNetworkState(testNetworkId, networkState)
      
      // Perform concurrent updates
      const updates = groups.map(async ([groupId, groupState], index) => {
        const updatedState = {
          ...groupState,
          group: {
            ...groupState.group,
            name: `Updated Group ${index}`
          }
        }
        return storage!.saveGroupState(testNetworkId, groupId, updatedState)
      })
      
      const results = await Promise.all(updates)
      
      // All updates should succeed
      expect(results.every(r => r.ok)).toBe(true)
      
      // Verify all updates were applied
      for (let i = 0; i < groups.length; i++) {
        const [groupId] = groups[i]
        const loadResult = await storage.loadGroupState(testNetworkId, groupId)
        expect(loadResult.ok).toBe(true)
        if (loadResult.ok && loadResult.value) {
          expect(loadResult.value.group.name).toBe(`Updated Group ${i}`)
        }
      }
    })
    
    test('should handle concurrent contact updates', async () => {
      if (!storage) return
      
      const groupId = brand.groupId('concurrent-group')
      const contactIds = Array.from({ length: 20 }, (_, i) => 
        brand.contactId(`concurrent-contact-${i}`)
      )
      
      // Create initial group with contacts
      const contacts = new Map(contactIds.map(id => [
        id,
        {
          id,
          groupId,
          content: { initial: true },
          blendMode: 'accept-last' as const
        }
      ]))
      
      const groupState: GroupState = {
        group: {
          id: groupId,
          name: 'Concurrent Test Group',
          contactIds,
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts,
        wires: new Map()
      }
      
      const networkState: NetworkState = {
        groups: new Map([[groupId, groupState]]),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      await storage.saveNetworkState(testNetworkId, networkState)
      await storage.saveGroupState(testNetworkId, groupId, groupState)
      
      // Concurrent contact updates
      const updates = contactIds.map((contactId, index) => 
        storage!.saveContactContent(
          testNetworkId,
          groupId,
          contactId,
          { updated: true, index, timestamp: Date.now() }
        )
      )
      
      const results = await Promise.all(updates)
      expect(results.every(r => r.ok)).toBe(true)
      
      // Verify all updates
      for (let i = 0; i < contactIds.length; i++) {
        const loadResult = await storage.loadContactContent(
          testNetworkId,
          groupId,
          contactIds[i]
        )
        expect(loadResult.ok).toBe(true)
        if (loadResult.ok && loadResult.value) {
          expect(loadResult.value).toHaveProperty('updated', true)
          expect(loadResult.value).toHaveProperty('index', i)
        }
      }
    })
    
    test('should handle concurrent snapshot creation', async () => {
      if (!storage) return
      
      const networkState: NetworkState = {
        groups: new Map(),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      await storage.saveNetworkState(testNetworkId, networkState)
      
      // Create multiple snapshots concurrently
      const snapshotPromises = Array.from({ length: 10 }, (_, i) =>
        storage!.saveSnapshot(testNetworkId, `Snapshot ${i}`)
      )
      
      const results = await Promise.all(snapshotPromises)
      
      // All should succeed
      expect(results.every(r => r.ok)).toBe(true)
      
      // List snapshots
      const listResult = await storage.listSnapshots(testNetworkId)
      expect(listResult.ok).toBe(true)
      if (listResult.ok) {
        expect(listResult.value.length).toBe(10)
      }
    })
  })
  
  describe('Large Data Sets', () => {
    const testNetworkId = brand.networkId('stress-test-large')
    
    beforeEach(async () => {
      if (!storage) return
      const pool = (storage as any).pool
      if (pool) {
        try {
          await pool.query('DELETE FROM bassline_snapshots WHERE network_id = $1', [testNetworkId])
          await pool.query('DELETE FROM bassline_contacts WHERE network_id = $1', [testNetworkId])
          await pool.query('DELETE FROM bassline_groups WHERE network_id = $1', [testNetworkId])
          await pool.query('DELETE FROM bassline_networks WHERE id = $1', [testNetworkId])
        } catch {}
      }
    })
    
    test('should handle large network with many groups', async () => {
      if (!storage) return
      
      const groupCount = 100
      const groups = new Map()
      
      for (let i = 0; i < groupCount; i++) {
        const groupId = brand.groupId(`large-group-${i}`)
        const contactIds = Array.from({ length: 10 }, (_, j) => 
          brand.contactId(`large-contact-${i}-${j}`)
        )
        
        const contacts = new Map(contactIds.map(id => [
          id,
          {
            id,
            groupId,
            content: { 
              data: `Contact data for ${id}`,
              timestamp: Date.now(),
              metadata: { group: i, contact: id }
            },
            blendMode: 'accept-last' as const
          }
        ]))
        
        const groupState: GroupState = {
          group: {
            id: groupId,
            name: `Large Group ${i}`,
            contactIds,
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: [],
            attributes: {
              index: i,
              description: `This is a description for group ${i} with some longer text to test storage`,
              'bassline.tags': ['stress-test', 'large-data', `group-${i}`]
            }
          },
          contacts,
          wires: new Map()
        }
        
        groups.set(groupId, groupState)
      }
      
      const networkState: NetworkState = {
        groups,
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      // Save large network
      const saveStart = Date.now()
      const saveResult = await storage.saveNetworkState(testNetworkId, networkState)
      const saveTime = Date.now() - saveStart
      
      expect(saveResult.ok).toBe(true)
      console.log(`Saved network with ${groupCount} groups in ${saveTime}ms`)
      
      // Also save individual groups to the groups table for querying
      for (const [groupId, groupState] of groups) {
        await storage.saveGroupState(testNetworkId, groupId, groupState)
      }
      
      // Load large network
      const loadStart = Date.now()
      const loadResult = await storage.loadNetworkState(testNetworkId)
      const loadTime = Date.now() - loadStart
      
      expect(loadResult.ok).toBe(true)
      if (loadResult.ok && loadResult.value) {
        expect(loadResult.value.groups.size).toBe(groupCount)
        console.log(`Loaded network with ${groupCount} groups in ${loadTime}ms`)
      }
      
      // First check if groups were saved to groups table
      const pool = (storage as any).pool
      const checkResult = await pool.query(
        'SELECT COUNT(*) as count FROM bassline_groups WHERE network_id = $1',
        [testNetworkId]
      )
      console.log(`Groups in DB: ${checkResult.rows[0].count}`)
      
      // Query performance
      const queryStart = Date.now()
      const queryResult = await storage.queryGroups(testNetworkId, {
        tags: ['stress-test']
      })
      const queryTime = Date.now() - queryStart
      
      expect(queryResult.ok).toBe(true)
      if (queryResult.ok) {
        if (queryResult.value.length !== groupCount) {
          // Debug: check what the query sees
          const debugResult = await pool.query(
            `SELECT state->'group'->'attributes' as attrs FROM bassline_groups WHERE network_id = $1 LIMIT 1`,
            [testNetworkId]
          )
          console.log('Sample group attributes:', debugResult.rows[0]?.attrs)
        }
        expect(queryResult.value.length).toBe(groupCount)
        console.log(`Queried ${groupCount} groups in ${queryTime}ms`)
      }
    })
    
    test('should handle large contact content', async () => {
      if (!storage) return
      
      const groupId = brand.groupId('large-content-group')
      const contactId = brand.contactId('large-content-contact')
      
      // Create large content object
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `Item ${i}`,
        nested: {
          value: Math.random(),
          text: 'Some repeated text content that takes up space'
        }
      }))
      
      const largeContent = {
        array: largeArray,
        metadata: {
          created: Date.now(),
          size: largeArray.length
        }
      }
      
      const groupState: GroupState = {
        group: {
          id: groupId,
          name: 'Large Content Group',
          contactIds: [contactId],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map([[contactId, {
          id: contactId,
          groupId,
          content: largeContent,
          blendMode: 'accept-last' as const
        }]]),
        wires: new Map()
      }
      
      const networkState: NetworkState = {
        groups: new Map([[groupId, groupState]]),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      // Save
      await storage.saveNetworkState(testNetworkId, networkState)
      await storage.saveGroupState(testNetworkId, groupId, groupState)
      
      // Load and verify
      const loadResult = await storage.loadContactContent(
        testNetworkId,
        groupId,
        contactId
      )
      
      expect(loadResult.ok).toBe(true)
      if (loadResult.ok && loadResult.value) {
        const loaded = loadResult.value as any
        expect(loaded.array).toHaveLength(1000)
        expect(loaded.array[0].id).toBe(0)
        expect(loaded.array[999].id).toBe(999)
      }
    })
  })
  
  describe('Edge Cases', () => {
    test('should handle special characters in content', async () => {
      if (!storage) return
      
      const networkId = brand.networkId('edge-case-special-chars')
      const groupId = brand.groupId('special-group')
      const contactId = brand.contactId('special-contact')
      
      const specialContent = {
        text: "Test with 'quotes' and \"double quotes\"",
        unicode: "😀 🎉 ñ é ü 中文",
        escapes: "Line\nbreak and\ttab",
        sql: "'; DROP TABLE users; --",
        json: '{"nested": "json"}',
        backslash: "Path\\with\\backslashes",
        null: null,
        empty: ""
      }
      
      // Clean up first
      const pool = (storage as any).pool
      await pool.query('DELETE FROM bassline_networks WHERE id = $1', [networkId])
      
      // Create network structure
      const groupState: GroupState = {
        group: {
          id: groupId,
          name: "Group with 'special' \"characters\"",
          contactIds: [contactId],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: [],
          attributes: {
            description: "Description with\nnewlines\tand\ttabs"
          }
        },
        contacts: new Map([[contactId, {
          id: contactId,
          groupId,
          content: specialContent,
          blendMode: 'accept-last' as const
        }]]),
        wires: new Map()
      }
      
      const networkState: NetworkState = {
        groups: new Map([[groupId, groupState]]),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      // Save
      const saveResult = await storage.saveNetworkState(networkId, networkState)
      expect(saveResult.ok).toBe(true)
      
      await storage.saveGroupState(networkId, groupId, groupState)
      
      // Load and verify
      const loadResult = await storage.loadContactContent(networkId, groupId, contactId)
      expect(loadResult.ok).toBe(true)
      if (loadResult.ok && loadResult.value) {
        expect(loadResult.value).toEqual(specialContent)
      }
      
      // Verify group name with special chars
      const groupResult = await storage.loadGroupState(networkId, groupId)
      expect(groupResult.ok).toBe(true)
      if (groupResult.ok && groupResult.value) {
        expect(groupResult.value.group.name).toBe("Group with 'special' \"characters\"")
      }
    })
    
    test('should handle very long IDs and names', async () => {
      if (!storage) return
      
      const longString = 'a'.repeat(1000)
      const networkId = brand.networkId('edge-case-long-ids')
      const groupId = brand.groupId(`group-${longString}`)
      const contactId = brand.contactId(`contact-${longString}`)
      
      // Clean up
      const pool = (storage as any).pool
      await pool.query('DELETE FROM bassline_networks WHERE id = $1', [networkId])
      
      const groupState: GroupState = {
        group: {
          id: groupId,
          name: `Group with very long name: ${longString}`,
          contactIds: [contactId],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map([[contactId, {
          id: contactId,
          groupId,
          content: { message: longString },
          blendMode: 'accept-last' as const
        }]]),
        wires: new Map()
      }
      
      const networkState: NetworkState = {
        groups: new Map([[groupId, groupState]]),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      // Save
      const saveResult = await storage.saveNetworkState(networkId, networkState)
      expect(saveResult.ok).toBe(true)
      
      await storage.saveGroupState(networkId, groupId, groupState)
      
      // Load and verify
      const loadResult = await storage.loadGroupState(networkId, groupId)
      expect(loadResult.ok).toBe(true)
      if (loadResult.ok && loadResult.value) {
        expect(loadResult.value.group.id).toBe(groupId)
        expect(loadResult.value.group.name).toContain(longString)
      }
    })
    
    test('should handle empty collections', async () => {
      if (!storage) return
      
      const networkId = brand.networkId('edge-case-empty')
      const groupId = brand.groupId('empty-group')
      
      // Clean up
      const pool = (storage as any).pool
      await pool.query('DELETE FROM bassline_networks WHERE id = $1', [networkId])
      
      // Network with empty groups
      const emptyNetworkState: NetworkState = {
        groups: new Map(),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      let saveResult = await storage.saveNetworkState(networkId, emptyNetworkState)
      expect(saveResult.ok).toBe(true)
      
      // Group with empty contacts and wires
      const emptyGroupState: GroupState = {
        group: {
          id: groupId,
          name: 'Empty Group',
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map(),
        wires: new Map()
      }
      
      saveResult = await storage.saveGroupState(networkId, groupId, emptyGroupState)
      expect(saveResult.ok).toBe(true)
      
      // Load and verify
      const networkResult = await storage.loadNetworkState(networkId)
      expect(networkResult.ok).toBe(true)
      if (networkResult.ok && networkResult.value) {
        expect(networkResult.value.groups.size).toBe(0)
      }
      
      const groupResult = await storage.loadGroupState(networkId, groupId)
      expect(groupResult.ok).toBe(true)
      if (groupResult.ok && groupResult.value) {
        expect(groupResult.value.contacts.size).toBe(0)
        expect(groupResult.value.wires.size).toBe(0)
      }
    })
  })
  
  describe('Error Recovery', () => {
    test('should handle partial updates gracefully', async () => {
      if (!storage) return
      
      const networkId = brand.networkId('error-recovery-partial')
      const groupIds = Array.from({ length: 5 }, (_, i) => 
        brand.groupId(`recovery-group-${i}`)
      )
      
      // Clean up
      const pool = (storage as any).pool
      await pool.query('DELETE FROM bassline_networks WHERE id = $1', [networkId])
      
      // Create initial state
      const groups = new Map(groupIds.map(id => [
        id,
        {
          group: {
            id,
            name: `Group ${id}`,
            contactIds: [],
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: []
          },
          contacts: new Map(),
          wires: new Map()
        } as GroupState
      ]))
      
      const networkState: NetworkState = {
        groups,
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      await storage.saveNetworkState(networkId, networkState)
      
      // Save some groups
      for (let i = 0; i < 3; i++) {
        const result = await storage.saveGroupState(
          networkId,
          groupIds[i],
          groups.get(groupIds[i])!
        )
        expect(result.ok).toBe(true)
      }
      
      // Verify partial state is consistent
      for (let i = 0; i < 3; i++) {
        const result = await storage.loadGroupState(networkId, groupIds[i])
        expect(result.ok).toBe(true)
        expect(result.value).not.toBeNull()
      }
      
      // Groups 3-4 should not exist in groups table
      for (let i = 3; i < 5; i++) {
        const result = await storage.loadGroupState(networkId, groupIds[i])
        expect(result.ok).toBe(true)
        expect(result.value).toBeNull()
      }
    })
    
    test('should handle network cleanup on delete', async () => {
      if (!storage) return
      
      const networkId = brand.networkId('error-recovery-cleanup')
      const groupId = brand.groupId('cleanup-group')
      const contactId = brand.contactId('cleanup-contact')
      
      // Clean up first
      const pool = (storage as any).pool
      await pool.query('DELETE FROM bassline_networks WHERE id = $1', [networkId])
      
      // Create network with data
      const groupState: GroupState = {
        group: {
          id: groupId,
          name: 'Cleanup Test Group',
          contactIds: [contactId],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map([[contactId, {
          id: contactId,
          groupId,
          content: { test: 'cleanup' },
          blendMode: 'accept-last' as const
        }]]),
        wires: new Map()
      }
      
      const networkState: NetworkState = {
        groups: new Map([[groupId, groupState]]),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      // Save everything
      await storage.saveNetworkState(networkId, networkState)
      await storage.saveGroupState(networkId, groupId, groupState)
      await storage.saveContactContent(networkId, groupId, contactId, { test: 'data' })
      await storage.saveSnapshot(networkId, 'Test Snapshot')
      
      // Verify data exists
      let existsResult = await storage.exists(networkId)
      expect(existsResult.ok).toBe(true)
      expect(existsResult.value).toBe(true)
      
      // Delete network
      const deleteResult = await storage.deleteNetwork(networkId)
      expect(deleteResult.ok).toBe(true)
      
      // Verify cascade delete worked
      existsResult = await storage.exists(networkId)
      expect(existsResult.ok).toBe(true)
      expect(existsResult.value).toBe(false)
      
      // Check that groups, contacts, and snapshots were also deleted
      const groupResult = await storage.loadGroupState(networkId, groupId)
      expect(groupResult.ok).toBe(true)
      expect(groupResult.value).toBeNull()
      
      const contactResult = await storage.loadContactContent(networkId, groupId, contactId)
      expect(contactResult.ok).toBe(true)
      expect(contactResult.value).toBeNull()
      
      const snapshotsResult = await storage.listSnapshots(networkId)
      expect(snapshotsResult.ok).toBe(true)
      expect(snapshotsResult.value).toHaveLength(0)
    })
  })
})