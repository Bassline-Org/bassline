/**
 * SQLite vs PostgreSQL Performance Comparison
 */

import { describe, it, beforeAll, afterAll } from 'vitest'
import { SQLiteStorage } from '../index.js'
import { OptimizedPostgresStorage } from '../../../storage-postgres/src/optimized-storage.js'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId } from '@bassline/core'
import { rmSync } from 'fs'

describe('SQLite vs PostgreSQL Performance', () => {
  let sqliteStorage: SQLiteStorage
  let postgresStorage: OptimizedPostgresStorage
  let networkId: NetworkId
  const testDir = './test-data-perf'
  
  beforeAll(async () => {
    // Clean up SQLite test data
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch (e) {}
    
    // Initialize SQLite
    sqliteStorage = new SQLiteStorage({
      options: {
        dataDir: testDir,
        mode: 'single', // Single DB for fair comparison
        synchronous: 'OFF', // Fastest mode
        walMode: true,
        cacheSize: -64000, // 64MB cache
      }
    })
    
    // Initialize PostgreSQL
    postgresStorage = new OptimizedPostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 20,
      }
    })
    
    await sqliteStorage.initialize()
    await postgresStorage.initialize()
    
    networkId = brand.networkId(`perf-test-${Date.now()}`)
    
    // Create network in both
    await sqliteStorage.saveNetworkState(networkId, {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    })
    
    await postgresStorage.saveNetworkState(networkId, {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    })
    
    console.log('\n🏁 === SQLite vs PostgreSQL Performance ===\n')
  })
  
  afterAll(async () => {
    await postgresStorage.deleteNetwork(networkId)
    await postgresStorage.close()
    await sqliteStorage.close()
    rmSync(testDir, { recursive: true, force: true })
  })
  
  describe('Single Contact Operations', () => {
    it('should compare single contact write performance', async () => {
      console.log('📝 Single Contact Writes (1000 operations):\n')
      
      const groupId = brand.groupId('single-write')
      const iterations = 1000
      
      // SQLite
      const sqliteStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await sqliteStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`sqlite-${i}`),
          { value: i, timestamp: Date.now() }
        )
      }
      const sqliteTime = performance.now() - sqliteStart
      
      // PostgreSQL
      const pgStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await postgresStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`pg-${i}`),
          { value: i, timestamp: Date.now() }
        )
      }
      const pgTime = performance.now() - pgStart
      
      console.log(`  SQLite:     ${sqliteTime.toFixed(2)}ms (${(iterations / sqliteTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  PostgreSQL: ${pgTime.toFixed(2)}ms (${(iterations / pgTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Speedup:    ${(pgTime / sqliteTime).toFixed(2)}x`)
    })
    
    it('should compare single contact read performance', async () => {
      console.log('\n📖 Single Contact Reads (10000 operations):\n')
      
      const groupId = brand.groupId('single-read')
      const contactId = brand.contactId('read-test')
      const iterations = 10000
      
      // Setup data
      await sqliteStorage.saveContactContent(networkId, groupId, contactId, { test: 'data' })
      await postgresStorage.saveContactContent(networkId, groupId, contactId, { test: 'data' })
      
      // SQLite
      const sqliteStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await sqliteStorage.loadContactContent(networkId, groupId, contactId)
      }
      const sqliteTime = performance.now() - sqliteStart
      
      // PostgreSQL
      const pgStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await postgresStorage.loadContactContent(networkId, groupId, contactId)
      }
      const pgTime = performance.now() - pgStart
      
      console.log(`  SQLite:     ${sqliteTime.toFixed(2)}ms (${(iterations / sqliteTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  PostgreSQL: ${pgTime.toFixed(2)}ms (${(iterations / pgTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Speedup:    ${(pgTime / sqliteTime).toFixed(2)}x`)
    })
  })
  
  describe('Batch Operations', () => {
    it('should compare batch insert performance', async () => {
      console.log('\n📦 Batch Insert (10K contacts in one transaction):\n')
      
      const groupId = brand.groupId('batch-insert')
      const contactCount = 10000
      
      // Prepare data
      const contacts = new Map()
      for (let i = 0; i < contactCount; i++) {
        contacts.set(brand.contactId(`batch-${i}`), {
          id: brand.contactId(`batch-${i}`),
          content: { 
            value: i,
            data: `Contact ${i}`,
            timestamp: Date.now()
          },
          blendMode: 'accept-last'
        })
      }
      
      const groupState = {
        group: {
          id: groupId,
          name: 'Batch Test',
          contactIds: Array.from(contacts.keys()),
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts,
        wires: new Map()
      }
      
      // SQLite
      const sqliteStart = performance.now()
      await sqliteStorage.saveGroupState(networkId, groupId, groupState)
      const sqliteTime = performance.now() - sqliteStart
      
      // PostgreSQL
      const pgStart = performance.now()
      await postgresStorage.saveGroupState(networkId, brand.groupId(`${groupId}-pg`), groupState)
      const pgTime = performance.now() - pgStart
      
      console.log(`  SQLite:     ${sqliteTime.toFixed(2)}ms (${(contactCount / sqliteTime * 1000).toFixed(0)} contacts/sec)`)
      console.log(`  PostgreSQL: ${pgTime.toFixed(2)}ms (${(contactCount / pgTime * 1000).toFixed(0)} contacts/sec)`)
      console.log(`  Speedup:    ${(pgTime / sqliteTime).toFixed(2)}x`)
    })
    
    it('should compare group load performance', async () => {
      console.log('\n📂 Group Load (1000 contacts):\n')
      
      const groupId = brand.groupId('load-test')
      
      // Setup data
      const contacts = new Map()
      for (let i = 0; i < 1000; i++) {
        contacts.set(brand.contactId(`load-${i}`), {
          id: brand.contactId(`load-${i}`),
          content: { value: i },
          blendMode: 'accept-last'
        })
      }
      
      const groupState = {
        group: {
          id: groupId,
          name: 'Load Test',
          contactIds: Array.from(contacts.keys()),
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts,
        wires: new Map()
      }
      
      await sqliteStorage.saveGroupState(networkId, groupId, groupState)
      await postgresStorage.saveGroupState(networkId, groupId, groupState)
      
      const iterations = 100
      
      // SQLite
      const sqliteStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await sqliteStorage.loadGroupState(networkId, groupId)
      }
      const sqliteTime = performance.now() - sqliteStart
      
      // PostgreSQL
      const pgStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await postgresStorage.loadGroupState(networkId, groupId)
      }
      const pgTime = performance.now() - pgStart
      
      console.log(`  SQLite:     ${sqliteTime.toFixed(2)}ms (${(iterations / sqliteTime * 1000).toFixed(0)} loads/sec)`)
      console.log(`  PostgreSQL: ${pgTime.toFixed(2)}ms (${(iterations / pgTime * 1000).toFixed(0)} loads/sec)`)
      console.log(`  Speedup:    ${(pgTime / sqliteTime).toFixed(2)}x`)
    })
  })
  
  describe('Realistic Workload', () => {
    it('should simulate realistic mixed workload', async () => {
      console.log('\n🔀 Mixed Workload (70% reads, 20% updates, 10% inserts):\n')
      
      const groupId = brand.groupId('mixed')
      const duration = 5000 // 5 seconds
      const contactIds = Array.from({ length: 100 }, (_, i) => brand.contactId(`mixed-${i}`))
      
      // Pre-populate some data
      for (const contactId of contactIds.slice(0, 50)) {
        await sqliteStorage.saveContactContent(networkId, groupId, contactId, { initial: true })
        await postgresStorage.saveContactContent(networkId, groupId, contactId, { initial: true })
      }
      
      // SQLite workload
      const sqliteStart = performance.now()
      let sqliteOps = 0
      while (performance.now() - sqliteStart < duration) {
        const rand = Math.random()
        const contactId = contactIds[Math.floor(Math.random() * contactIds.length)]
        
        if (rand < 0.7) {
          // Read (70%)
          await sqliteStorage.loadContactContent(networkId, groupId, contactId)
        } else if (rand < 0.9) {
          // Update (20%)
          await sqliteStorage.saveContactContent(networkId, groupId, contactId, { 
            updated: true, 
            timestamp: Date.now() 
          })
        } else {
          // Insert (10%)
          await sqliteStorage.saveContactContent(
            networkId, 
            groupId, 
            brand.contactId(`new-${sqliteOps}`),
            { new: true }
          )
        }
        sqliteOps++
      }
      const sqliteActualTime = performance.now() - sqliteStart
      
      // PostgreSQL workload
      const pgStart = performance.now()
      let pgOps = 0
      while (performance.now() - pgStart < duration) {
        const rand = Math.random()
        const contactId = contactIds[Math.floor(Math.random() * contactIds.length)]
        
        if (rand < 0.7) {
          // Read (70%)
          await postgresStorage.loadContactContent(networkId, groupId, contactId)
        } else if (rand < 0.9) {
          // Update (20%)
          await postgresStorage.saveContactContent(networkId, groupId, contactId, { 
            updated: true, 
            timestamp: Date.now() 
          })
        } else {
          // Insert (10%)
          await postgresStorage.saveContactContent(
            networkId, 
            groupId, 
            brand.contactId(`new-pg-${pgOps}`),
            { new: true }
          )
        }
        pgOps++
      }
      const pgActualTime = performance.now() - pgStart
      
      console.log(`  SQLite:     ${sqliteOps} ops in ${sqliteActualTime.toFixed(0)}ms (${(sqliteOps / sqliteActualTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  PostgreSQL: ${pgOps} ops in ${pgActualTime.toFixed(0)}ms (${(pgOps / pgActualTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Speedup:    ${(sqliteOps / pgOps).toFixed(2)}x more operations`)
    }, 15000)
  })
  
  describe('Key Differences', () => {
    it('should highlight architectural differences', async () => {
      console.log('\n🏗️  Architectural Comparison:\n')
      console.log('  SQLite:')
      console.log('    - In-process (no network overhead)')
      console.log('    - Single writer (but no contention)')
      console.log('    - File-based (portable)')
      console.log('    - No connection pooling needed')
      console.log('    - WAL mode for concurrency')
      
      console.log('\n  PostgreSQL:')
      console.log('    - Client-server (network latency)')
      console.log('    - Multiple writers (with lock contention)')
      console.log('    - Server-based (requires setup)')
      console.log('    - Connection pooling overhead')
      console.log('    - MVCC for concurrency')
      
      console.log('\n  Best Use Cases:')
      console.log('    SQLite: Edge nodes, single-user, embedded, offline-first')
      console.log('    PostgreSQL: Multi-user, centralized, ACID compliance, complex queries')
    })
  })
})