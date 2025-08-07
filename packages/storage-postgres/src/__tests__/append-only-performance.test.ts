import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { AppendOnlyPostgresStorage } from '../append-only-storage'
import { NormalizedPostgresStorage } from '../normalized-storage'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'

describe('Append-Only Performance Comparison', () => {
  let appendOnlyStorage: AppendOnlyPostgresStorage
  let normalizedStorage: NormalizedPostgresStorage
  let networkId: NetworkId
  let pool: Pool
  
  beforeAll(async () => {
    // Initialize both storage types
    appendOnlyStorage = new AppendOnlyPostgresStorage({
      options: { database: 'bassline_test', poolSize: 50 },
      subsumption: { keepVersions: 1 }
    })
    
    normalizedStorage = new NormalizedPostgresStorage({
      options: { database: 'bassline_test', poolSize: 50 }
    })
    
    pool = new Pool({ database: 'bassline_test', max: 5 })
    
    await appendOnlyStorage.initialize()
    await normalizedStorage.initialize()
    
    networkId = brand.networkId('append-perf-test')
    
    // Setup for normalized storage
    await normalizedStorage.saveNetworkState(networkId, {
      groups: new Map(),
      rootGroup: brand.groupId('root')
    })
  })
  
  afterAll(async () => {
    await appendOnlyStorage.close()
    await normalizedStorage.close()
    await pool.end()
  })

  describe('Head-to-Head Performance', () => {
    it('should compare single contact updates', async () => {
      const groupId = brand.groupId('single-update-test')
      const contactId = brand.contactId('test-contact')
      const iterations = 1000
      
      // Setup group for normalized storage
      await normalizedStorage.saveGroupState(networkId, groupId, {
        contacts: new Map(),
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      console.log('\n=== Single Contact Update Performance ===\n')
      
      // Test 1: Normalized storage (UPDATE with checks)
      const normalizedTimes: number[] = []
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await normalizedStorage.saveContactContent(
          networkId, groupId, contactId,
          { value: i, timestamp: Date.now() }
        )
        normalizedTimes.push(performance.now() - start)
      }
      
      // Test 2: Append-only storage (INSERT only)
      const appendOnlyTimes: number[] = []
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await appendOnlyStorage.saveContactContent(
          networkId, groupId, contactId,
          { value: i, timestamp: Date.now() }
        )
        appendOnlyTimes.push(performance.now() - start)
      }
      
      const avgNormalized = normalizedTimes.reduce((a, b) => a + b) / normalizedTimes.length
      const avgAppendOnly = appendOnlyTimes.reduce((a, b) => a + b) / appendOnlyTimes.length
      
      console.log(`Normalized (UPDATE): ${avgNormalized.toFixed(3)}ms avg`)
      console.log(`Append-Only (INSERT): ${avgAppendOnly.toFixed(3)}ms avg`)
      console.log(`Improvement: ${((1 - avgAppendOnly/avgNormalized) * 100).toFixed(1)}% faster\n`)
      
      // Verify data integrity
      const appendResult = await appendOnlyStorage.loadContactContent(networkId, groupId, contactId)
      if (appendResult.ok && appendResult.value) {
        expect((appendResult.value as any).value).toBe(iterations - 1)
      }
    })

    it('should compare concurrent updates to same contact', async () => {
      const groupId = brand.groupId('concurrent-same-test')
      const contactId = brand.contactId('contention-test')
      const concurrency = 100
      
      // Setup
      await normalizedStorage.saveGroupState(networkId, groupId, {
        contacts: new Map([[contactId, { content: { value: 0 } }]]),
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      console.log('\n=== Concurrent Updates (Same Contact) ===\n')
      
      // Test 1: Normalized - high contention
      const normalizedStart = performance.now()
      const normalizedPromises = []
      for (let i = 0; i < concurrency; i++) {
        normalizedPromises.push(
          normalizedStorage.saveContactContent(
            networkId, groupId, contactId,
            { value: i, thread: 'normalized' }
          )
        )
      }
      await Promise.all(normalizedPromises)
      const normalizedTime = performance.now() - normalizedStart
      
      // Test 2: Append-only - zero contention!
      const appendStart = performance.now()
      const appendPromises = []
      for (let i = 0; i < concurrency; i++) {
        appendPromises.push(
          appendOnlyStorage.saveContactContent(
            networkId, groupId, contactId,
            { value: i, thread: 'append' }
          )
        )
      }
      await Promise.all(appendPromises)
      const appendTime = performance.now() - appendStart
      
      console.log(`Normalized: ${normalizedTime.toFixed(2)}ms for ${concurrency} updates`)
      console.log(`Append-Only: ${appendTime.toFixed(2)}ms for ${concurrency} updates`)
      console.log(`Improvement: ${((1 - appendTime/normalizedTime) * 100).toFixed(1)}% faster\n`)
    })

    it('should compare batch operations', async () => {
      const groupId = brand.groupId('batch-test')
      const batchSize = 1000
      
      console.log('\n=== Batch Insert Performance ===\n')
      
      // Prepare batch data
      const operations = []
      for (let i = 0; i < batchSize; i++) {
        operations.push({
          networkId,
          groupId,
          contactId: brand.contactId(`batch-${i}`),
          content: { 
            value: i, 
            data: `Some data for contact ${i}`,
            timestamp: Date.now()
          }
        })
      }
      
      // Test append-only batch insert
      const batchStart = performance.now()
      await appendOnlyStorage.batchAppend(operations)
      const batchTime = performance.now() - batchStart
      
      console.log(`Append-Only Batch: ${batchTime.toFixed(2)}ms for ${batchSize} inserts`)
      console.log(`Per operation: ${(batchTime / batchSize).toFixed(3)}ms\n`)
    })

    it('should test collection performance', async () => {
      const groupId = brand.groupId('collection-test')
      const contactId = brand.contactId('set-contact')
      
      console.log('\n=== Collection Storage Performance ===\n')
      
      // Test growing set
      const set = new Set<string>()
      const setGrowthTimes: number[] = []
      
      for (let i = 0; i < 100; i++) {
        set.add(`item-${i}`)
        
        const start = performance.now()
        await appendOnlyStorage.saveCollection(
          networkId, groupId, contactId, 'set', set
        )
        setGrowthTimes.push(performance.now() - start)
      }
      
      const avgSetTime = setGrowthTimes.reduce((a, b) => a + b) / setGrowthTimes.length
      console.log(`Average set append: ${avgSetTime.toFixed(3)}ms`)
      console.log(`Final set size: ${set.size} items`)
      
      // Load and verify
      const loadStart = performance.now()
      const loadedSet = await appendOnlyStorage.loadCollection(
        networkId, groupId, contactId, 'set'
      )
      const loadTime = performance.now() - loadStart
      
      if (loadedSet.ok && loadedSet.value) {
        console.log(`Load time: ${loadTime.toFixed(2)}ms`)
        expect((loadedSet.value as Set<string>).size).toBe(100)
      }
    })

    it('should analyze storage overhead and cleanup', async () => {
      console.log('\n=== Storage Overhead Analysis ===\n')
      
      // Get statistics before cleanup
      const statsBefore = await appendOnlyStorage.getStats()
      if (statsBefore.ok) {
        console.log('Before cleanup:')
        console.log(`  Total values: ${statsBefore.value.total_values}`)
        console.log(`  Active values: ${statsBefore.value.active_values}`)
        console.log(`  Subsumed values: ${statsBefore.value.subsumed_values}`)
        console.log(`  Table size: ${statsBefore.value.table_size}`)
      }
      
      // Run cleanup
      const cleanupResult = await appendOnlyStorage.cleanupSubsumed()
      if (cleanupResult.ok) {
        console.log('\nCleanup results:')
        console.log(`  Deleted values: ${cleanupResult.value.deletedValues}`)
        console.log(`  Deleted collections: ${cleanupResult.value.deletedCollections}`)
      }
      
      // Get statistics after cleanup
      const statsAfter = await appendOnlyStorage.getStats()
      if (statsAfter.ok) {
        console.log('\nAfter cleanup:')
        console.log(`  Total values: ${statsAfter.value.total_values}`)
        console.log(`  Active values: ${statsAfter.value.active_values}`)
        console.log(`  Subsumed values: ${statsAfter.value.subsumed_values}`)
        console.log(`  Table size: ${statsAfter.value.table_size}`)
      }
    })

    it('should stress test with realistic propagation patterns', async () => {
      console.log('\n=== Propagation Network Simulation ===\n')
      
      // Simulate a propagation network with:
      // - Multiple groups propagating to each other
      // - Rapid value changes
      // - Concurrent updates from different sources
      
      const numGroups = 10
      const numContacts = 100
      const numPropagations = 5
      
      const groups = Array.from({ length: numGroups }, (_, i) => 
        brand.groupId(`prop-group-${i}`)
      )
      
      console.time('Propagation simulation')
      
      for (let round = 0; round < numPropagations; round++) {
        const promises = []
        
        // Each group updates its contacts and some from other groups
        for (let g = 0; g < numGroups; g++) {
          const operations = []
          
          // Update own contacts
          for (let c = 0; c < numContacts / numGroups; c++) {
            operations.push({
              networkId,
              groupId: groups[g],
              contactId: brand.contactId(`contact-${g}-${c}`),
              content: {
                value: round * 1000 + g * 100 + c,
                round,
                source: g,
                propagated: true
              }
            })
          }
          
          // Propagate to next group (ring topology)
          const nextGroup = groups[(g + 1) % numGroups]
          for (let c = 0; c < 5; c++) {
            operations.push({
              networkId,
              groupId: nextGroup,
              contactId: brand.contactId(`contact-${g}-${c}`),
              content: {
                value: round * 1000 + g * 100 + c,
                round,
                source: g,
                propagatedTo: nextGroup
              }
            })
          }
          
          promises.push(appendOnlyStorage.batchAppend(operations))
        }
        
        await Promise.all(promises)
      }
      
      console.timeEnd('Propagation simulation')
      
      const finalStats = await appendOnlyStorage.getStats()
      if (finalStats.ok) {
        console.log(`\nFinal state:`)
        console.log(`  Total operations: ${finalStats.value.total_values}`)
        console.log(`  Operations per second: ${(finalStats.value.total_values / (numPropagations * numGroups * 0.001)).toFixed(0)}`)
      }
    })
  })
})