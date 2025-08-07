/**
 * PostgreSQL Storage Extreme Stress Tests
 * 
 * Testing with very large networks (50MB - 500MB+)
 */

import { describe, beforeAll, afterAll, test, expect } from 'vitest'
import { PostgresStorage } from '../index'
import { brand } from '@bassline/core'
import type { NetworkState, GroupState, Contact } from '@bassline/core'

describe('PostgreSQL Extreme Stress Tests', () => {
  let storage: PostgresStorage | null = null
  
  beforeAll(async () => {
    const tempStorage = new PostgresStorage({
      type: 'postgres',
      options: {
        database: 'bassline_test',
        user: process.env.USER,
        poolSize: 30, // Increase pool size for extreme tests
        statementTimeout: 300000 // 5 minute timeout for huge operations
      }
    })
    
    const initResult = await tempStorage.initialize()
    if (!initResult.ok) {
      console.warn('Skipping extreme stress tests - PostgreSQL not available')
      await tempStorage.close()
      return
    }
    storage = tempStorage
  })
  
  afterAll(async () => {
    if (storage) {
      await storage.close()
    }
  })
  
  test('50MB Network - 5,000 groups with rich content', async () => {
    if (!storage) return
    
    const networkId = brand.networkId('extreme-50mb')
    
    // Clean up first
    const pool = (storage as any).pool
    await pool.query('DELETE FROM bassline_networks WHERE id = $1', [networkId])
    
    console.log('\n🔥 50MB Network Test:')
    console.log('  Creating 5,000 groups with 10 contacts each...')
    
    const groupCount = 5000
    const contactsPerGroup = 10
    
    // Generate large content for each contact
    const generateLargeContent = (i: number, j: number) => ({
      id: `${i}-${j}`,
      timestamp: Date.now(),
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20),
      data: Array.from({ length: 50 }, (_, k) => ({
        index: k,
        value: Math.random(),
        nested: {
          field1: `Field value ${k}`,
          field2: Math.random() * 1000,
          field3: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
          metadata: {
            created: Date.now(),
            modified: Date.now(),
            version: '1.0.0',
            author: `author-${i}`,
            description: 'This is a longer description text that takes up more space in the database storage.'
          }
        }
      })),
      history: Array.from({ length: 10 }, (_, h) => ({
        action: `action-${h}`,
        timestamp: Date.now() - h * 1000,
        user: `user-${i}`,
        changes: { before: 'old value', after: 'new value' }
      }))
    })
    
    // First create a minimal network state just to establish the network
    console.log('  Initializing network...')
    const minimalNetworkState: NetworkState = {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    const initResult = await storage.saveNetworkState(networkId, minimalNetworkState)
    if (!initResult.ok) {
      console.error('Failed to initialize network:', initResult.error)
      return
    }
    
    // Now save groups individually in batches
    console.log('  Saving groups in batches...')
    const saveStart = Date.now()
    let savedCount = 0
    const batchSize = 100
    const savePromises = []
    
    for (let i = 0; i < groupCount; i++) {
      const groupId = brand.groupId(`large-group-${i}`)
      const contacts = new Map()
      
      for (let j = 0; j < contactsPerGroup; j++) {
        const contactId = brand.contactId(`large-contact-${i}-${j}`)
        contacts.set(contactId, {
          id: contactId,
          groupId,
          content: generateLargeContent(i, j),
          blendMode: 'accept-last' as const
        })
      }
      
      const groupState: GroupState = {
        group: {
          id: groupId,
          name: `Large Group ${i}`,
          contactIds: Array.from(contacts.keys()),
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: [],
          attributes: {
            index: i,
            category: `category-${i % 50}`,
            'bassline.tags': [`batch-${Math.floor(i / 100)}`, 'extreme-test', 'large-network'],
            'bassline.author': `author-${i % 10}`,
            description: 'A comprehensive description that includes various details about this group and its purpose in the testing framework. '.repeat(5),
            metadata: {
              created: Date.now(),
              size: 'large',
              version: '2.0.0',
              properties: Array.from({ length: 20 }, (_, p) => ({
                key: `prop-${p}`,
                value: `value-${p}`,
                type: 'string'
              }))
            }
          }
        },
        contacts,
        wires: new Map()
      }
      
      savePromises.push(storage.saveGroupState(networkId, groupId, groupState))
      
      if (savePromises.length >= batchSize) {
        await Promise.all(savePromises)
        savedCount += savePromises.length
        if (savedCount % 1000 === 0) {
          console.log(`    Saved ${savedCount}/${groupCount} groups...`)
        }
        savePromises.length = 0
      }
    }
    
    // Save remaining promises
    if (savePromises.length > 0) {
      await Promise.all(savePromises)
      savedCount += savePromises.length
    }
    
    const saveTime = Date.now() - saveStart
    console.log(`  ✅ Saved all ${savedCount} groups in ${saveTime}ms (${(saveTime/groupCount).toFixed(2)}ms/group)`)
    
    // Get statistics
    const statsResult = await storage.getNetworkStats(networkId)
    if (statsResult.ok) {
      const sizeInMB = (statsResult.value.totalSize / 1024 / 1024).toFixed(2)
      console.log(`\n  📊 Network Statistics:`)
      console.log(`     Groups: ${statsResult.value.groupCount}`)
      console.log(`     Contacts: ${statsResult.value.contactCount}`)
      console.log(`     Size: ${sizeInMB} MB`)
      
      // Verify we're actually testing a ~50MB network
      expect(statsResult.value.totalSize).toBeGreaterThan(30 * 1024 * 1024) // At least 30MB
    }
    
    // Test query performance on large dataset
    console.log('\n  🔍 Query Performance:')
    
    const tagQueryStart = Date.now()
    const tagResult = await storage.queryGroups(networkId, {
      tags: ['extreme-test']
    })
    const tagQueryTime = Date.now() - tagQueryStart
    console.log(`     Query by tag: ${tagQueryTime}ms (found ${tagResult.value?.length || 0} groups)`)
    expect(tagResult.ok).toBe(true)
    if (tagResult.ok) {
      expect(tagResult.value.length).toBe(groupCount)
    }
    
    const authorQueryStart = Date.now()
    const authorResult = await storage.queryGroups(networkId, {
      author: 'author-0'
    })
    const authorQueryTime = Date.now() - authorQueryStart
    console.log(`     Query by author: ${authorQueryTime}ms (found ${authorResult.value?.length || 0} groups)`)
    
    // Snapshot performance
    console.log('\n  📸 Snapshot Performance:')
    const snapshotStart = Date.now()
    
    // For large networks, we'll create a snapshot without the full network state
    // by querying and reconstructing it
    const allGroups = await storage.queryGroups(networkId, {})
    if (allGroups.ok && allGroups.value.length > 0) {
      const reconstructedState: NetworkState = {
        groups: new Map(allGroups.value.map(gs => [gs.group.id, gs])),
        currentGroupId: 'root',
        rootGroupId: 'root'
      }
      
      // Save the reconstructed state
      await storage.saveNetworkState(networkId, reconstructedState)
      const snapshotResult = await storage.saveSnapshot(networkId, '50MB Snapshot')
      const snapshotTime = Date.now() - snapshotStart
      console.log(`     Snapshot creation: ${snapshotTime}ms`)
      expect(snapshotResult.ok).toBe(true)
    }
    
    // Clean up
    console.log('\n  🧹 Cleanup:')
    const deleteStart = Date.now()
    const deleteResult = await storage.deleteNetwork(networkId)
    const deleteTime = Date.now() - deleteStart
    console.log(`     Network deletion: ${deleteTime}ms`)
    expect(deleteResult.ok).toBe(true)
  }, 300000) // 5 minute timeout
  
  test('500MB Network - 20,000 groups with massive content', async () => {
    if (!storage) return
    
    const networkId = brand.networkId('extreme-500mb')
    
    // Clean up first
    const pool = (storage as any).pool
    await pool.query('DELETE FROM bassline_networks WHERE id = $1', [networkId])
    
    console.log('\n💥 500MB Network Test:')
    console.log('  Creating 20,000 groups with very large content...')
    
    const groupCount = 20000
    const contactsPerGroup = 15
    
    // Generate very large content
    const generateMassiveContent = (i: number, j: number) => ({
      id: `massive-${i}-${j}`,
      timestamp: Date.now(),
      // Large text content
      description: 'This is a very detailed description. '.repeat(100),
      documentation: 'Technical documentation with extensive details. '.repeat(50),
      
      // Large array of complex objects
      items: Array.from({ length: 200 }, (_, k) => ({
        id: `item-${i}-${j}-${k}`,
        name: `Item ${k}`,
        value: Math.random() * 1000,
        tags: Array.from({ length: 10 }, (_, t) => `tag-${t}`),
        properties: {
          prop1: `Property value ${k}`,
          prop2: Math.random(),
          prop3: Date.now(),
          prop4: { nested: { deep: { value: k } } },
          prop5: Array.from({ length: 5 }, (_, p) => `sub-${p}`)
        },
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          author: `author-${i}`,
          version: `${i}.${j}.${k}`,
          flags: ['active', 'validated', 'processed', 'archived']
        }
      })),
      
      // History with many entries
      history: Array.from({ length: 50 }, (_, h) => ({
        id: `history-${h}`,
        action: `action-${h}`,
        timestamp: Date.now() - h * 60000,
        user: `user-${i % 100}`,
        details: {
          before: { state: 'old', value: h },
          after: { state: 'new', value: h + 1 },
          reason: 'Update due to system changes',
          metadata: { ip: '192.168.1.1', session: `session-${h}` }
        }
      })),
      
      // Large binary-like data (simulated with base64-like strings)
      binaryData: Buffer.from(Array.from({ length: 1000 }, () => Math.random() * 256)).toString('base64'),
      
      // Complex nested structure
      tree: {
        root: {
          children: Array.from({ length: 10 }, (_, c) => ({
            id: `child-${c}`,
            data: `Data for child ${c}`,
            children: Array.from({ length: 5 }, (_, gc) => ({
              id: `grandchild-${c}-${gc}`,
              data: `Data for grandchild ${gc}`,
              values: Array.from({ length: 10 }, () => Math.random())
            }))
          }))
        }
      }
    })
    
    // Initialize network
    console.log('  Initializing network...')
    const minimalNetworkState: NetworkState = {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    const initResult = await storage.saveNetworkState(networkId, minimalNetworkState)
    if (!initResult.ok) {
      console.error('Failed to initialize network:', initResult.error)
      return
    }
    
    // Save groups in larger batches for 500MB test
    console.log('  Saving groups in batches...')
    const saveStart = Date.now()
    let savedCount = 0
    const batchSize = 200
    const savePromises = []
    
    for (let i = 0; i < groupCount; i++) {
      const groupId = brand.groupId(`massive-group-${i}`)
      const contacts = new Map()
      
      for (let j = 0; j < contactsPerGroup; j++) {
        const contactId = brand.contactId(`massive-contact-${i}-${j}`)
        contacts.set(contactId, {
          id: contactId,
          groupId,
          content: generateMassiveContent(i, j),
          blendMode: 'accept-last' as const
        })
      }
      
      const groupState: GroupState = {
        group: {
          id: groupId,
          name: `Massive Group ${i}`,
          contactIds: Array.from(contacts.keys()),
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: [],
          attributes: {
            index: i,
            batch: Math.floor(i / 1000),
            category: `category-${i % 100}`,
            'bassline.tags': [
              `batch-${Math.floor(i / 1000)}`,
              'massive-test',
              '500mb-network',
              `category-${i % 100}`
            ],
            'bassline.author': `author-${i % 50}`,
            'bassline.type': i % 2 === 0 ? 'gadget' : 'group',
            description: 'Extensive group description with lots of details. '.repeat(20),
            documentation: 'Technical documentation. '.repeat(10),
            config: {
              settings: Array.from({ length: 30 }, (_, s) => ({
                key: `setting-${s}`,
                value: `value-${s}`,
                type: 'string',
                required: s % 2 === 0
              })),
              flags: Array.from({ length: 20 }, (_, f) => `flag-${f}`),
              metadata: {
                version: '3.0.0',
                compatibility: ['v1', 'v2', 'v3'],
                dependencies: Array.from({ length: 10 }, (_, d) => `dep-${d}`)
              }
            }
          }
        },
        contacts,
        wires: new Map()
      }
      
      savePromises.push(storage.saveGroupState(networkId, groupId, groupState))
      
      if (savePromises.length >= batchSize) {
        await Promise.all(savePromises)
        savedCount += savePromises.length
        if (savedCount % 2000 === 0) {
          console.log(`    Saved ${savedCount}/${groupCount} groups...`)
        }
        savePromises.length = 0
      }
    }
    
    // Save remaining promises
    if (savePromises.length > 0) {
      await Promise.all(savePromises)
      savedCount += savePromises.length
    }
    
    const saveTime = Date.now() - saveStart
    console.log(`  ✅ Saved all ${savedCount} groups in ${saveTime}ms (${(saveTime/groupCount).toFixed(2)}ms/group)`)
    
    // Get final statistics
    const statsResult = await storage.getNetworkStats(networkId)
    if (statsResult.ok) {
      const sizeInMB = (statsResult.value.totalSize / 1024 / 1024).toFixed(2)
      console.log(`\n  📊 Network Statistics:`)
      console.log(`     Groups: ${statsResult.value.groupCount}`)
      console.log(`     Contacts: ${statsResult.value.contactCount}`)
      console.log(`     Size: ${sizeInMB} MB`)
      
      // Verify we're testing a ~500MB network
      expect(statsResult.value.totalSize).toBeGreaterThan(400 * 1024 * 1024) // At least 400MB
    }
    
    // Test query performance on massive dataset
    console.log('\n  🔍 Query Performance on 500MB:')
    
    const batchQueryStart = Date.now()
    const batchResult = await storage.queryGroups(networkId, {
      tags: ['batch-5']
    })
    const batchQueryTime = Date.now() - batchQueryStart
    console.log(`     Query by batch tag: ${batchQueryTime}ms (found ${batchResult.value?.length || 0} groups)`)
    
    const typeQueryStart = Date.now()
    const typeResult = await storage.queryGroups(networkId, {
      type: 'gadget'
    })
    const typeQueryTime = Date.now() - typeQueryStart
    console.log(`     Query by type: ${typeQueryTime}ms (found ${typeResult.value?.length || 0} groups)`)
    
    // Test full-text search on massive dataset
    const searchStart = Date.now()
    const searchResult = await storage.searchGroups(networkId, 'massive group')
    const searchTime = Date.now() - searchStart
    console.log(`     Full-text search: ${searchTime}ms (found ${searchResult.value?.length || 0} groups)`)
    
    // Clean up the massive network
    console.log('\n  🧹 Cleanup of 500MB network:')
    const deleteStart = Date.now()
    const deleteResult = await storage.deleteNetwork(networkId)
    const deleteTime = Date.now() - deleteStart
    console.log(`     Network deletion: ${deleteTime}ms`)
    expect(deleteResult.ok).toBe(true)
    
    // Final memory check
    const memUsage = process.memoryUsage()
    console.log(`\n  💾 Memory Usage:`)
    console.log(`     RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`)
    console.log(`     Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`     Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`)
  }, 600000) // 10 minute timeout for 500MB test
})