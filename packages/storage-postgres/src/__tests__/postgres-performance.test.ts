/**
 * PostgreSQL Storage Performance Benchmarks
 * 
 * Production readiness tests with performance metrics
 */

import { describe, beforeAll, afterAll, test, expect } from 'vitest'
import { PostgresStorage } from '../index'
import { brand } from '@bassline/core'
import type { NetworkState, GroupState, Contact } from '@bassline/core'

describe('PostgreSQL Performance Benchmarks', () => {
  let storage: PostgresStorage | null = null
  const networkId = brand.networkId('perf-test')
  
  beforeAll(async () => {
    const tempStorage = new PostgresStorage({
      type: 'postgres',
      options: {
        database: 'bassline_test',
        user: process.env.USER,
        poolSize: 20 // Use production-like pool size
      }
    })
    
    const initResult = await tempStorage.initialize()
    if (!initResult.ok) {
      console.warn('Skipping performance tests - PostgreSQL not available')
      await tempStorage.close()
      return
    }
    storage = tempStorage
    
    // Clean up
    const pool = (storage as any).pool
    await pool.query('DELETE FROM bassline_networks WHERE id = $1', [networkId])
  })
  
  afterAll(async () => {
    if (storage) {
      await storage.close()
    }
  })
  
  test('Performance: 1000 groups write/read', async () => {
    if (!storage) return
    
    const groupCount = 1000
    const groups = new Map()
    
    // Create 1000 groups with 5 contacts each
    for (let i = 0; i < groupCount; i++) {
      const groupId = brand.groupId(`perf-group-${i}`)
      const contacts = new Map()
      
      for (let j = 0; j < 5; j++) {
        const contactId = brand.contactId(`contact-${i}-${j}`)
        contacts.set(contactId, {
          id: contactId,
          groupId,
          content: { 
            value: Math.random(),
            timestamp: Date.now(),
            data: `Contact ${i}-${j}`
          },
          blendMode: 'accept-last' as const
        })
      }
      
      groups.set(groupId, {
        group: {
          id: groupId,
          name: `Performance Group ${i}`,
          contactIds: Array.from(contacts.keys()),
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: [],
          attributes: {
            index: i,
            category: i % 10, // 10 categories
            'bassline.tags': [`category-${i % 10}`, 'performance-test']
          }
        },
        contacts,
        wires: new Map()
      })
    }
    
    const networkState: NetworkState = {
      groups,
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    // Benchmark network save
    const saveNetworkStart = Date.now()
    await storage.saveNetworkState(networkId, networkState)
    const saveNetworkTime = Date.now() - saveNetworkStart
    
    console.log(`\n📊 Performance Metrics:`)
    console.log(`  Network save (${groupCount} groups): ${saveNetworkTime}ms`)
    expect(saveNetworkTime).toBeLessThan(1000) // Should complete in under 1 second
    
    // Benchmark individual group saves
    const saveGroupsStart = Date.now()
    const savePromises = []
    for (const [groupId, groupState] of groups.entries()) {
      savePromises.push(storage.saveGroupState(networkId, groupId, groupState))
      if (savePromises.length >= 10) {
        await Promise.all(savePromises)
        savePromises.length = 0
      }
    }
    await Promise.all(savePromises)
    const saveGroupsTime = Date.now() - saveGroupsStart
    
    console.log(`  Individual group saves: ${saveGroupsTime}ms (${(saveGroupsTime/groupCount).toFixed(2)}ms/group)`)
    
    // Benchmark network load
    const loadNetworkStart = Date.now()
    const loadResult = await storage.loadNetworkState(networkId)
    const loadNetworkTime = Date.now() - loadNetworkStart
    
    console.log(`  Network load: ${loadNetworkTime}ms`)
    expect(loadNetworkTime).toBeLessThan(500) // Should load quickly
    expect(loadResult.ok).toBe(true)
    if (loadResult.ok && loadResult.value) {
      expect(loadResult.value.groups.size).toBe(groupCount)
    }
    
    // Benchmark queries
    const queryStart = Date.now()
    const queryResult = await storage.queryGroups(networkId, {
      tags: ['performance-test']
    })
    const queryTime = Date.now() - queryStart
    
    console.log(`  Query all groups by tag: ${queryTime}ms`)
    expect(queryTime).toBeLessThan(100) // Queries should be fast
    expect(queryResult.ok).toBe(true)
    if (queryResult.ok) {
      expect(queryResult.value.length).toBe(groupCount)
    }
    
    // Benchmark category query
    const categoryQueryStart = Date.now()
    const categoryResult = await storage.queryGroups(networkId, {
      attributes: { category: 5 }
    })
    const categoryQueryTime = Date.now() - categoryQueryStart
    
    console.log(`  Query by attribute: ${categoryQueryTime}ms`)
    expect(categoryQueryTime).toBeLessThan(50)
    expect(categoryResult.ok).toBe(true)
    if (categoryResult.ok) {
      expect(categoryResult.value.length).toBe(100) // 1000 / 10 categories
    }
    
    // Benchmark snapshot
    const snapshotStart = Date.now()
    const snapshotResult = await storage.saveSnapshot(networkId, 'Performance Snapshot')
    const snapshotTime = Date.now() - snapshotStart
    
    console.log(`  Snapshot creation: ${snapshotTime}ms`)
    expect(snapshotTime).toBeLessThan(500)
    expect(snapshotResult.ok).toBe(true)
    
    // Benchmark stats
    const statsStart = Date.now()
    const statsResult = await storage.getNetworkStats(networkId)
    const statsTime = Date.now() - statsStart
    
    console.log(`  Network stats: ${statsTime}ms`)
    expect(statsTime).toBeLessThan(50)
    expect(statsResult.ok).toBe(true)
    if (statsResult.ok) {
      console.log(`\n📈 Network Statistics:`)
      console.log(`  Groups: ${statsResult.value.groupCount}`)
      console.log(`  Contacts: ${statsResult.value.contactCount}`)
      console.log(`  Size: ${(statsResult.value.totalSize / 1024 / 1024).toFixed(2)} MB`)
    }
  })
  
  test('Concurrent write performance', async () => {
    if (!storage) return
    
    const concurrentWrites = 100
    const testGroups = []
    
    // Prepare test data
    for (let i = 0; i < concurrentWrites; i++) {
      const groupId = brand.groupId(`concurrent-${i}`)
      testGroups.push({
        groupId,
        groupState: {
          group: {
            id: groupId,
            name: `Concurrent ${i}`,
            contactIds: [],
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: [],
            attributes: { index: i }
          },
          contacts: new Map(),
          wires: new Map()
        } as GroupState
      })
    }
    
    // Ensure network exists
    await storage.saveNetworkState(networkId, {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    })
    
    // Benchmark concurrent writes
    const concurrentStart = Date.now()
    const writePromises = testGroups.map(({ groupId, groupState }) => 
      storage!.saveGroupState(networkId, groupId, groupState)
    )
    
    const results = await Promise.all(writePromises)
    const concurrentTime = Date.now() - concurrentStart
    
    console.log(`\n⚡ Concurrent Performance:`)
    console.log(`  ${concurrentWrites} concurrent writes: ${concurrentTime}ms`)
    console.log(`  Average: ${(concurrentTime/concurrentWrites).toFixed(2)}ms per write`)
    
    expect(results.every(r => r.ok)).toBe(true)
    expect(concurrentTime).toBeLessThan(5000) // Should handle 100 concurrent writes in < 5s
  })
  
  test('Connection pool efficiency', async () => {
    if (!storage) return
    
    const iterations = 50
    const operations = []
    
    console.log(`\n🏊 Connection Pool Test:`)  
    
    // Rapid fire operations to test pool efficiency
    const poolStart = Date.now()
    for (let i = 0; i < iterations; i++) {
      operations.push(
        storage.exists(networkId),
        storage.listNetworks(),
        storage.loadNetworkState(networkId)
      )
    }
    
    const poolResults = await Promise.all(operations)
    const poolTime = Date.now() - poolStart
    
    console.log(`  ${iterations * 3} operations: ${poolTime}ms`)
    console.log(`  Average: ${(poolTime/(iterations * 3)).toFixed(2)}ms per operation`)
    
    expect(poolResults.every(r => r.ok)).toBe(true)
    expect(poolTime).toBeLessThan(3000) // Pool should handle this efficiently
  })
})