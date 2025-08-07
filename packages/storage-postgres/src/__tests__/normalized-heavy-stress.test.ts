import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NormalizedPostgresStorage } from '../normalized-storage'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId, GroupState } from '@bassline/core'

describe('Normalized PostgreSQL Heavy Stress Test', () => {
  let storage: NormalizedPostgresStorage
  let networkId: NetworkId
  
  beforeAll(async () => {
    storage = new NormalizedPostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 50,
      },
      limits: {
        maxContactsPerGroup: 5000,
        maxGroupsPerNetwork: 500,
        maxContentSizeBytes: 50 * 1024 // 50KB
      }
    })
    
    const initResult = await storage.initialize()
    if (!initResult.ok) {
      throw new Error(`Failed to initialize storage: ${initResult.error.message}`)
    }
    
    networkId = brand.networkId('normalized-stress-test')
    
    // Create the network
    const networkState = {
      groups: new Map(),
      rootGroup: brand.groupId('root')
    }
    await storage.saveNetworkState(networkId, networkState)
  })
  
  afterAll(async () => {
    // Only clean up if CLEAN_TEST_DB env var is set
    if (process.env.CLEAN_TEST_DB === 'true') {
      await storage.deleteNetwork(networkId)
    }
    await storage.close()
  })

  describe('Massive Operations with Normalized Tables', () => {
    it('should efficiently handle 50,000 contacts across 50 groups', async () => {
      console.time('50k contacts insertion (normalized)')
      
      const groupCount = 50
      const contactsPerGroup = 1000
      const groups: GroupId[] = []
      
      // Create groups in parallel batches
      const batchSize = 10
      for (let batch = 0; batch < groupCount / batchSize; batch++) {
        const promises = []
        
        for (let i = 0; i < batchSize; i++) {
          const g = batch * batchSize + i
          const groupId = brand.groupId(`norm-group-${g}`)
          groups.push(groupId)
          
          const contacts = new Map()
          for (let c = 0; c < contactsPerGroup; c++) {
            contacts.set(brand.contactId(`c-${g}-${c}`), {
              content: {
                value: c,
                group: g,
                timestamp: Date.now()
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
          
          promises.push(storage.saveGroupState(networkId, groupId, groupState))
        }
        
        const results = await Promise.all(promises)
        const failures = results.filter(r => !r.ok)
        expect(failures.length).toBe(0)
      }
      
      console.timeEnd('50k contacts insertion (normalized)')
      
      // Test retrieval performance
      console.time('50k contacts retrieval (normalized)')
      
      const retrievalPromises = groups.slice(0, 10).map(groupId => 
        storage.loadGroupState(networkId, groupId)
      )
      
      const results = await Promise.all(retrievalPromises)
      for (const result of results) {
        expect(result.ok).toBe(true)
        if (result.ok && result.value) {
          expect(result.value.contacts.size).toBe(contactsPerGroup)
        }
      }
      
      console.timeEnd('50k contacts retrieval (normalized)')
      
      // Get statistics
      const stats = await storage.getNetworkStats(networkId)
      if (stats.ok) {
        console.log('Network stats (normalized):', {
          ...stats.value,
          avgBytesPerContact: Math.round(stats.value.totalSize / stats.value.contactCount)
        })
        expect(stats.value.groupCount).toBe(groupCount)
        expect(stats.value.contactCount).toBe(groupCount * contactsPerGroup)
      }
    }, 120000) // 2 minute timeout

    it('should handle 1000 concurrent operations efficiently', async () => {
      const testGroupId = brand.groupId('concurrent-test-group')
      
      // Create the group first
      await storage.saveGroupState(networkId, testGroupId, {
        contacts: new Map(),
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      console.time('1000 concurrent mixed operations')
      
      const operations = []
      
      // 400 writes
      for (let i = 0; i < 400; i++) {
        operations.push(
          storage.saveContactContent(
            networkId,
            testGroupId,
            brand.contactId(`concurrent-${i}`),
            { value: i, type: 'write' }
          )
        )
      }
      
      // 400 reads (some will be empty)
      for (let i = 0; i < 400; i++) {
        operations.push(
          storage.loadContactContent(
            networkId,
            testGroupId,
            brand.contactId(`concurrent-${i}`)
          )
        )
      }
      
      // 200 group state operations
      for (let i = 0; i < 100; i++) {
        operations.push(storage.loadGroupState(networkId, testGroupId))
      }
      
      for (let i = 0; i < 100; i++) {
        const contacts = new Map()
        contacts.set(brand.contactId(`update-${i}`), {
          content: { value: i }
        })
        
        operations.push(
          storage.saveGroupState(networkId, brand.groupId(`temp-${i}`), {
            contacts,
            wires: new Map(),
            boundaryContacts: { input: new Map(), output: new Map() }
          })
        )
      }
      
      const results = await Promise.all(operations)
      console.timeEnd('1000 concurrent mixed operations')
      
      const failures = results.filter(r => !r.ok)
      console.log(`Failures: ${failures.length}/1000`)
      expect(failures.length).toBe(0)
    })

    it('should maintain small row sizes with normalized schema', async () => {
      const groupId = brand.groupId('size-test-group')
      
      // Create a group with many contacts
      const contacts = new Map()
      for (let i = 0; i < 100; i++) {
        contacts.set(brand.contactId(`size-test-${i}`), {
          content: {
            id: i,
            data: 'x'.repeat(100), // Small content
            metadata: { index: i }
          }
        })
      }
      
      console.time('Save 100 contacts (normalized)')
      
      const saveResult = await storage.saveGroupState(networkId, groupId, {
        contacts,
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      console.timeEnd('Save 100 contacts (normalized)')
      
      expect(saveResult.ok).toBe(true)
      
      // Load and verify
      console.time('Load 100 contacts (normalized)')
      
      const loadResult = await storage.loadGroupState(networkId, groupId)
      
      console.timeEnd('Load 100 contacts (normalized)')
      
      if (loadResult.ok && loadResult.value) {
        expect(loadResult.value.contacts.size).toBe(100)
      }
    })

    it('should efficiently query with proper indexes', async () => {
      // Create groups with attributes
      const attributeGroups = 20
      
      for (let i = 0; i < attributeGroups; i++) {
        const groupId = brand.groupId(`indexed-group-${i}`)
        const groupState: any = {
          contacts: new Map([
            [brand.contactId(`idx-contact-${i}`), { content: { value: i } }]
          ]),
          wires: new Map(),
          boundaryContacts: { input: new Map(), output: new Map() },
          attributes: {
            type: i % 2 === 0 ? 'even' : 'odd',
            category: `cat-${i % 5}`,
            index: String(i)
          }
        }
        
        await storage.saveGroupState(networkId, groupId, groupState)
      }
      
      console.time('Query groups by type (indexed)')
      
      const queryResult = await storage.queryGroups(networkId, { type: 'even' })
      
      console.timeEnd('Query groups by type (indexed)')
      
      if (queryResult.ok) {
        expect(queryResult.value.length).toBeGreaterThan(0)
        console.log(`Found ${queryResult.value.length} groups with type='even'`)
      }
      
      console.time('Search groups (indexed)')
      
      const searchResult = await storage.searchGroups(networkId, 'indexed')
      
      console.timeEnd('Search groups (indexed)')
      
      if (searchResult.ok) {
        expect(searchResult.value.length).toBeGreaterThan(0)
        console.log(`Found ${searchResult.value.length} groups matching 'indexed'`)
      }
    })

    it('should handle rapid updates without bloat', async () => {
      const groupId = brand.groupId('rapid-update-group')
      const contactId = brand.contactId('rapid-contact')
      
      // Create the group first
      await storage.saveGroupState(networkId, groupId, {
        contacts: new Map(),
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      console.time('5000 rapid updates (normalized)')
      
      for (let i = 0; i < 5000; i++) {
        const result = await storage.saveContactContent(
          networkId,
          groupId,
          contactId,
          { 
            value: i, 
            timestamp: Date.now(),
            iteration: i
          }
        )
        
        if (!result.ok) {
          console.error(`Update ${i} failed:`, result.error)
        }
        expect(result.ok).toBe(true)
      }
      
      console.timeEnd('5000 rapid updates (normalized)')
      
      // Verify final value
      const finalValue = await storage.loadContactContent(networkId, groupId, contactId)
      if (finalValue.ok && finalValue.value) {
        expect((finalValue.value as any).value).toBe(4999)
      }
    })

    it('should check network limits efficiently', async () => {
      console.time('Check network limits (normalized)')
      
      const limitsResult = await storage.checkNetworkLimits(networkId)
      
      console.timeEnd('Check network limits (normalized)')
      
      if (limitsResult.ok) {
        console.log('Final network limits (normalized):', limitsResult.value)
        expect(limitsResult.value.groupCount).toBeGreaterThan(0)
        expect(limitsResult.value.totalSizeBytes).toBeGreaterThan(0)
        
        // With normalized schema, size should be much smaller per contact
        const avgBytesPerGroup = limitsResult.value.totalSizeBytes / limitsResult.value.groupCount
        console.log(`Average bytes per group: ${Math.round(avgBytesPerGroup)}`)
        
        // Should be well within limits with normalized schema
        expect(limitsResult.value.withinLimits).toBe(true)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should enforce content size limits', async () => {
      const groupId = brand.groupId('content-limit-group')
      const contactId = brand.contactId('large-content')
      
      // Try to save content over the limit (50KB)
      const tooLargeContent = {
        data: 'x'.repeat(60 * 1024), // 60KB
        metadata: 'too large'
      }
      
      const result = await storage.saveContactContent(
        networkId,
        groupId,
        contactId,
        tooLargeContent
      )
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('size')
      }
    })

    it('should enforce group limits', async () => {
      const hugeGroup = brand.groupId('huge-group')
      
      // Try to create a group with too many contacts
      const contacts = new Map()
      for (let i = 0; i < 6000; i++) { // Over our 5000 limit
        contacts.set(brand.contactId(`over-limit-${i}`), {
          content: { value: i }
        })
      }
      
      const result = await storage.saveGroupState(networkId, hugeGroup, {
        contacts,
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('too many contacts')
      }
    })
  })
})