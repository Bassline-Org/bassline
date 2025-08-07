import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PostgresStorage } from '../index'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId, GroupState } from '@bassline/core'

describe('PostgreSQL Heavy Stress Test', () => {
  let storage: PostgresStorage
  let networkId: NetworkId
  
  beforeAll(async () => {
    // Use aggressive limits for testing
    storage = new PostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 50, // High connection pool for parallel operations
      },
      limits: {
        maxContactsPerGroup: 1000,      // Lower limit for testing
        maxGroupsPerNetwork: 100,       // Lower limit for testing  
        maxNetworkSizeBytes: 10 * 1024 * 1024,  // 10MB for testing
        maxContactContentBytes: 100 * 1024      // 100KB for testing
      }
    })
    
    const initResult = await storage.initialize()
    if (!initResult.ok) {
      throw new Error(`Failed to initialize storage: ${initResult.error.message}`)
    }
    
    networkId = brand.networkId('stress-test-network')
  })
  
  afterAll(async () => {
    // Cleanup
    await storage.deleteNetwork(networkId)
    await storage.close()
  })

  describe('Massive Contact Operations', () => {
    it('should handle 10,000 contacts across multiple groups efficiently', async () => {
      // First create the network
      const networkState = {
        groups: new Map(),
        rootGroup: brand.groupId('root')
      }
      await storage.saveNetworkState(networkId, networkState)
      
      console.time('10k contacts insertion')
      
      const groupCount = 20
      const contactsPerGroup = 500
      const groups: GroupId[] = []
      
      // Create groups
      for (let g = 0; g < groupCount; g++) {
        const groupId = brand.groupId(`stress-group-${g}`)
        groups.push(groupId)
        
        const contacts = new Map()
        for (let c = 0; c < contactsPerGroup; c++) {
          const contactId = brand.contactId(`contact-${g}-${c}`)
          contacts.set(contactId, {
            content: {
              value: Math.random() * 1000,
              metadata: {
                timestamp: Date.now(),
                index: c,
                group: g,
                data: 'x'.repeat(100) // Small payload
              }
            }
          })
        }
        
        const groupState: GroupState = {
          contacts,
          wires: new Map(),
          boundaryContacts: {
            input: new Map(),
            output: new Map()
          }
        }
        
        const result = await storage.saveGroupState(networkId, groupId, groupState)
        if (!result.ok) {
          console.error(`Failed to save group ${g}:`, result.error)
        }
        expect(result.ok).toBe(true)
      }
      
      console.timeEnd('10k contacts insertion')
      
      // Test retrieval performance
      console.time('10k contacts retrieval')
      
      for (const groupId of groups) {
        const result = await storage.loadGroupState(networkId, groupId)
        expect(result.ok).toBe(true)
        if (result.ok && result.value) {
          expect(result.value.contacts.size).toBe(contactsPerGroup)
        }
      }
      
      console.timeEnd('10k contacts retrieval')
      
      // Get statistics
      const stats = await storage.getNetworkStats(networkId)
      if (stats.ok) {
        console.log('Network stats:', stats.value)
        expect(stats.value.groupCount).toBe(groupCount)
        expect(stats.value.contactCount).toBe(groupCount * contactsPerGroup)
      }
    }, 60000) // 60 second timeout

    it('should enforce contact limit per group', async () => {
      const groupId = brand.groupId('limit-test-group')
      const maxContacts = 1000 // Our configured limit
      
      // Create a group with max contacts
      const contacts = new Map()
      for (let i = 0; i < maxContacts; i++) {
        contacts.set(brand.contactId(`limit-contact-${i}`), {
          content: { value: i }
        })
      }
      
      const groupState: GroupState = {
        contacts,
        wires: new Map(),
        boundaryContacts: {
          input: new Map(),
          output: new Map()
        }
      }
      
      const saveResult = await storage.saveGroupState(networkId, groupId, groupState)
      expect(saveResult.ok).toBe(true)
      
      // Try to add one more contact - should fail
      const extraContactId = brand.contactId('extra-contact')
      const addResult = await storage.saveContactContent(
        networkId,
        groupId, 
        extraContactId,
        { value: 'should-fail' }
      )
      
      expect(addResult.ok).toBe(false)
      if (!addResult.ok) {
        expect(addResult.error.message).toContain('limit')
      }
    })

    it('should handle large content efficiently', async () => {
      const groupId = brand.groupId('large-content-group')
      const contactId = brand.contactId('large-content-contact')
      
      // Create content just under the limit
      const largeContent = {
        data: 'x'.repeat(90 * 1024), // 90KB of data
        metadata: {
          size: 'large',
          timestamp: Date.now()
        }
      }
      
      const saveResult = await storage.saveContactContent(
        networkId,
        groupId,
        contactId,
        largeContent
      )
      expect(saveResult.ok).toBe(true)
      
      // Try to save content over the limit
      const tooLargeContent = {
        data: 'x'.repeat(200 * 1024), // 200KB - over our 100KB limit
        metadata: {
          size: 'too-large'
        }
      }
      
      const failResult = await storage.saveContactContent(
        networkId,
        groupId,
        brand.contactId('too-large-contact'),
        tooLargeContent
      )
      
      expect(failResult.ok).toBe(false)
      if (!failResult.ok) {
        expect(failResult.error.message).toContain('size')
      }
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle 100 concurrent writes without deadlocks', async () => {
      const groupId = brand.groupId('concurrent-group')
      
      console.time('100 concurrent writes')
      
      const promises = []
      for (let i = 0; i < 100; i++) {
        const contactId = brand.contactId(`concurrent-${i}`)
        const promise = storage.saveContactContent(
          networkId,
          groupId,
          contactId,
          {
            value: i,
            timestamp: Date.now(),
            thread: i % 10
          }
        )
        promises.push(promise)
      }
      
      const results = await Promise.all(promises)
      console.timeEnd('100 concurrent writes')
      
      // All should succeed
      const failures = results.filter(r => !r.ok)
      expect(failures.length).toBe(0)
      
      // Verify all were written
      const groupState = await storage.loadGroupState(networkId, groupId)
      if (groupState.ok && groupState.value) {
        expect(groupState.value.contacts.size).toBe(100)
      }
    })

    it('should handle mixed read/write operations concurrently', async () => {
      const groupId = brand.groupId('mixed-ops-group')
      
      // First, populate some data
      const contacts = new Map()
      for (let i = 0; i < 50; i++) {
        contacts.set(brand.contactId(`mixed-${i}`), {
          content: { value: i }
        })
      }
      
      await storage.saveGroupState(networkId, groupId, {
        contacts,
        wires: new Map(),
        boundaryContacts: {
          input: new Map(),
          output: new Map()
        }
      })
      
      console.time('Mixed concurrent operations')
      
      const operations = []
      
      // 50 reads
      for (let i = 0; i < 50; i++) {
        operations.push(
          storage.loadContactContent(
            networkId,
            groupId,
            brand.contactId(`mixed-${i}`)
          )
        )
      }
      
      // 50 writes
      for (let i = 50; i < 100; i++) {
        operations.push(
          storage.saveContactContent(
            networkId,
            groupId,
            brand.contactId(`mixed-${i}`),
            { value: i, operation: 'write' }
          )
        )
      }
      
      // 20 group loads
      for (let i = 0; i < 20; i++) {
        operations.push(
          storage.loadGroupState(networkId, groupId)
        )
      }
      
      const results = await Promise.all(operations)
      console.timeEnd('Mixed concurrent operations')
      
      // All operations should succeed
      const failures = results.filter(r => !r.ok)
      expect(failures.length).toBe(0)
    })
  })

  describe('Query Performance', () => {
    it('should efficiently query groups with indexes', async () => {
      // Create groups with various attributes
      const testGroups = 50
      
      for (let i = 0; i < testGroups; i++) {
        const groupId = brand.groupId(`query-group-${i}`)
        const groupState: GroupState = {
          contacts: new Map([
            [brand.contactId(`contact-${i}`), { content: { value: i } }]
          ]),
          wires: new Map(),
          boundaryContacts: {
            input: new Map(),
            output: new Map()
          },
          attributes: {
            name: `Group ${i}`,
            type: i % 3 === 0 ? 'compute' : 'storage',
            tags: [`tag${i % 5}`, `category${i % 3}`],
            index: i
          }
        } as any
        
        await storage.saveGroupState(networkId, groupId, groupState)
      }
      
      console.time('Query by attributes')
      
      // Query by type
      const computeGroups = await storage.queryGroups(networkId, {
        type: 'compute'
      })
      
      if (computeGroups.ok) {
        expect(computeGroups.value.length).toBeGreaterThan(0)
      }
      
      console.timeEnd('Query by attributes')
      
      // Full-text search performance
      console.time('Full-text search')
      
      const searchResult = await storage.searchGroups(networkId, 'Group')
      
      if (searchResult.ok) {
        expect(searchResult.value.length).toBeGreaterThan(0)
      }
      
      console.timeEnd('Full-text search')
    })

    it('should efficiently check network limits', async () => {
      console.time('Check network limits')
      
      const limitsResult = await storage.checkNetworkLimits(networkId)
      
      console.timeEnd('Check network limits')
      
      if (limitsResult.ok) {
        console.log('Network limits:', limitsResult.value)
        expect(limitsResult.value.groupCount).toBeGreaterThan(0)
        expect(limitsResult.value.totalSizeBytes).toBeGreaterThan(0)
        expect(typeof limitsResult.value.withinLimits).toBe('boolean')
      }
    })
  })

  describe('Cleanup Performance', () => {
    it('should efficiently delete large groups', async () => {
      const groupId = brand.groupId('delete-test-group')
      
      // Create a large group
      const contacts = new Map()
      for (let i = 0; i < 500; i++) {
        contacts.set(brand.contactId(`delete-${i}`), {
          content: { value: i, data: 'x'.repeat(1000) }
        })
      }
      
      await storage.saveGroupState(networkId, groupId, {
        contacts,
        wires: new Map(),
        boundaryContacts: {
          input: new Map(),
          output: new Map()
        }
      })
      
      console.time('Delete large group')
      
      const deleteResult = await storage.deleteGroup(networkId, groupId)
      
      console.timeEnd('Delete large group')
      
      expect(deleteResult.ok).toBe(true)
      
      // Verify deletion
      const loadResult = await storage.loadGroupState(networkId, groupId)
      if (loadResult.ok) {
        expect(loadResult.value).toBeNull()
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle groups approaching size limits', async () => {
      const result = await storage.checkNetworkLimits(networkId)
      
      if (result.ok) {
        console.log('Final network state:')
        console.log(`  Groups: ${result.value.groupCount}`)
        console.log(`  Total size: ${(result.value.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`)
        console.log(`  Within limits: ${result.value.withinLimits}`)
        console.log(`  Group limit exceeded: ${result.value.details.groupLimitExceeded}`)
        console.log(`  Size limit exceeded: ${result.value.details.sizeLimitExceeded}`)
      }
    })

    it('should handle rapid updates to same contact', async () => {
      const groupId = brand.groupId('rapid-update-group')
      const contactId = brand.contactId('rapid-contact')
      
      console.time('1000 rapid updates')
      
      for (let i = 0; i < 1000; i++) {
        const result = await storage.saveContactContent(
          networkId,
          groupId,
          contactId,
          { value: i, timestamp: Date.now() }
        )
        expect(result.ok).toBe(true)
      }
      
      console.timeEnd('1000 rapid updates')
      
      // Verify final value
      const finalValue = await storage.loadContactContent(networkId, groupId, contactId)
      if (finalValue.ok && finalValue.value) {
        expect((finalValue.value as any).value).toBe(999)
      }
    })
  })
})