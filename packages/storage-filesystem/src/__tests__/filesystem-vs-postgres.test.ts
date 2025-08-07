import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import * as fs from 'fs/promises'
import { createFilesystemStorage } from '../index'

// Dynamic imports to avoid type issues
let Pool: any
let createAppendOnlyStorage: any

describe('Filesystem vs PostgreSQL Performance', () => {
  const testBasePath = './test-bassline-data'
  let filesystemStorage: ReturnType<typeof createFilesystemStorage>
  let postgresStorage: any
  let pool: any
  let networkId: NetworkId
  let groupId: GroupId
  
  beforeAll(async () => {
    // Dynamic imports
    const pg = await import('pg')
    Pool = pg.Pool
    const postgresModule = await import('../../../storage-postgres/src/append-only-storage')
    createAppendOnlyStorage = postgresModule.createAppendOnlyStorage
    
    networkId = brand.networkId('perf-test')
    groupId = brand.groupId('perf-group')
    
    // Initialize PostgreSQL
    pool = new Pool({ database: 'bassline_test', max: 10 })
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE bassline_contact_values CASCADE;
      TRUNCATE TABLE bassline_contact_values_fast CASCADE;
      ALTER SEQUENCE bassline_version_seq RESTART WITH 1;
    `)
    client.release()
    
    // Initialize storages
    filesystemStorage = createFilesystemStorage({
      basePath: testBasePath,
      performance: {
        useSymlinks: true,
        parallelism: 50
      }
    })
    await filesystemStorage.initialize()
    
    postgresStorage = createAppendOnlyStorage('development') // Use UNLOGGED for fair comparison
    await postgresStorage.initialize()
  }, 60000)
  
  afterAll(async () => {
    await filesystemStorage.close()
    await postgresStorage.close()
    await pool.end()
    
    // Cleanup filesystem
    try {
      await fs.rm(testBasePath, { recursive: true, force: true })
    } catch {}
  }, 30000)
  
  describe('Write Performance', () => {
    it('should compare single write performance', async () => {
      console.log('\n=== SINGLE WRITE PERFORMANCE ===\n')
      const iterations = 1000
      
      // Test 1: Filesystem
      console.log('1. Filesystem Storage:')
      const fsStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await filesystemStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`fs-single-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const fsTime = performance.now() - fsStart
      
      console.log(`  Time: ${fsTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(fsTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(fsTime/1000)).toLocaleString()}`)
      
      // Test 2: PostgreSQL
      console.log('\n2. PostgreSQL (UNLOGGED):')
      const pgStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await postgresStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`pg-single-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const pgTime = performance.now() - pgStart
      
      console.log(`  Time: ${pgTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(pgTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== COMPARISON ===')
      const faster = fsTime < pgTime ? 'Filesystem' : 'PostgreSQL'
      const speedup = Math.max(fsTime, pgTime) / Math.min(fsTime, pgTime)
      console.log(`${faster} is ${speedup.toFixed(1)}x faster`)
      
      // Filesystem should be slower for single writes due to file I/O overhead
      expect(pgTime).toBeLessThan(fsTime)
    })
    
    it('should compare batch write performance', async () => {
      console.log('\n=== BATCH WRITE PERFORMANCE ===\n')
      const batchSize = 10000
      
      // Prepare batch data
      const fsOperations = []
      const pgOperations = []
      for (let i = 0; i < batchSize; i++) {
        fsOperations.push({
          networkId,
          groupId,
          contactId: brand.contactId(`fs-batch-${i}`),
          content: { value: i, data: `Item ${i}` }
        })
        pgOperations.push({
          networkId,
          groupId,
          contactId: brand.contactId(`pg-batch-${i}`),
          content: { value: i, data: `Item ${i}` }
        })
      }
      
      // Test 1: Filesystem batch
      console.log('1. Filesystem Batch:')
      const fsBatchStart = performance.now()
      await filesystemStorage.batchAppend(fsOperations)
      const fsBatchTime = performance.now() - fsBatchStart
      
      console.log(`  Time: ${fsBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(fsBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(fsBatchTime/1000)).toLocaleString()}`)
      
      // Test 2: PostgreSQL batch
      console.log('\n2. PostgreSQL Batch:')
      const pgBatchStart = performance.now()
      await postgresStorage.batchAppend(pgOperations)
      const pgBatchTime = performance.now() - pgBatchStart
      
      console.log(`  Time: ${pgBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(pgBatchTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== BATCH COMPARISON ===')
      const batchFaster = fsBatchTime < pgBatchTime ? 'Filesystem' : 'PostgreSQL'
      const batchSpeedup = Math.max(fsBatchTime, pgBatchTime) / Math.min(fsBatchTime, pgBatchTime)
      console.log(`${batchFaster} is ${batchSpeedup.toFixed(1)}x faster for batches`)
      
      // PostgreSQL should still be faster for batch operations
      expect(pgBatchTime).toBeLessThan(fsBatchTime)
    })
  })
  
  describe('Read Performance', () => {
    it('should compare read performance', async () => {
      console.log('\n=== READ PERFORMANCE ===\n')
      
      // First write test data
      const testSize = 1000
      const contactIds: ContactId[] = []
      
      for (let i = 0; i < testSize; i++) {
        const contactId = brand.contactId(`read-test-${i}`)
        contactIds.push(contactId)
        
        // Write to both storages
        await filesystemStorage.saveContactContent(
          networkId, groupId, contactId,
          { id: i, data: `Read test ${i}` }
        )
        await postgresStorage.saveContactContent(
          networkId, groupId, contactId,
          { id: i, data: `Read test ${i}` }
        )
      }
      
      // Test 1: Filesystem reads
      console.log('1. Filesystem Reads:')
      const fsReadStart = performance.now()
      for (const contactId of contactIds) {
        await filesystemStorage.loadContactContent(
          networkId, groupId, contactId
        )
      }
      const fsReadTime = performance.now() - fsReadStart
      
      console.log(`  Time: ${fsReadTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(fsReadTime/testSize).toFixed(3)}ms`)
      console.log(`  Reads/second: ${Math.round(testSize/(fsReadTime/1000)).toLocaleString()}`)
      
      // Test 2: PostgreSQL reads
      console.log('\n2. PostgreSQL Reads:')
      const pgReadStart = performance.now()
      for (const contactId of contactIds) {
        await postgresStorage.loadContactContent(
          networkId, groupId, contactId
        )
      }
      const pgReadTime = performance.now() - pgReadStart
      
      console.log(`  Time: ${pgReadTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgReadTime/testSize).toFixed(3)}ms`)
      console.log(`  Reads/second: ${Math.round(testSize/(pgReadTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== READ COMPARISON ===')
      const readFaster = fsReadTime < pgReadTime ? 'Filesystem' : 'PostgreSQL'
      const readSpeedup = Math.max(fsReadTime, pgReadTime) / Math.min(fsReadTime, pgReadTime)
      console.log(`${readFaster} is ${readSpeedup.toFixed(1)}x faster for reads`)
    })
  })
  
  describe('Concurrent Operations', () => {
    it('should compare concurrent write performance', async () => {
      console.log('\n=== CONCURRENT WRITE PERFORMANCE ===\n')
      const concurrentOps = 5000
      
      // Test 1: Filesystem concurrent writes
      console.log('1. Filesystem Concurrent Writes:')
      const fsPromises = []
      const fsConcurrentStart = performance.now()
      
      for (let i = 0; i < concurrentOps; i++) {
        fsPromises.push(
          filesystemStorage.saveContactContent(
            networkId,
            groupId,
            brand.contactId(`fs-concurrent-${i}`),
            { id: i, timestamp: Date.now() }
          )
        )
      }
      
      await Promise.all(fsPromises)
      const fsConcurrentTime = performance.now() - fsConcurrentStart
      
      console.log(`  Time: ${fsConcurrentTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(fsConcurrentTime/concurrentOps).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(concurrentOps/(fsConcurrentTime/1000)).toLocaleString()}`)
      
      // Test 2: PostgreSQL concurrent writes
      console.log('\n2. PostgreSQL Concurrent Writes:')
      const pgPromises = []
      const pgConcurrentStart = performance.now()
      
      for (let i = 0; i < concurrentOps; i++) {
        pgPromises.push(
          postgresStorage.saveContactContent(
            networkId,
            groupId,
            brand.contactId(`pg-concurrent-${i}`),
            { id: i, timestamp: Date.now() }
          )
        )
      }
      
      await Promise.all(pgPromises)
      const pgConcurrentTime = performance.now() - pgConcurrentStart
      
      console.log(`  Time: ${pgConcurrentTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgConcurrentTime/concurrentOps).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(concurrentOps/(pgConcurrentTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== CONCURRENT COMPARISON ===')
      const concurrentFaster = fsConcurrentTime < pgConcurrentTime ? 'Filesystem' : 'PostgreSQL'
      const concurrentSpeedup = Math.max(fsConcurrentTime, pgConcurrentTime) / Math.min(fsConcurrentTime, pgConcurrentTime)
      console.log(`${concurrentFaster} is ${concurrentSpeedup.toFixed(1)}x faster for concurrent ops`)
      
      // Filesystem might actually be competitive here due to zero lock contention
      console.log('\nNote: Filesystem has zero lock contention, each write is independent')
    })
  })
  
  describe('Storage Characteristics', () => {
    it('should compare storage characteristics', async () => {
      console.log('\n=== STORAGE CHARACTERISTICS ===\n')
      
      console.log('Filesystem Append-Only:')
      console.log('  ✅ Zero lock contention')
      console.log('  ✅ Natural backup/restore (copy files)')
      console.log('  ✅ Git-friendly (version control data)')
      console.log('  ✅ Debug-friendly (inspect with cat)')
      console.log('  ✅ Works on any filesystem')
      console.log('  ❌ Slower single writes (file I/O overhead)')
      console.log('  ❌ More disk space (each version is a file)')
      console.log('  ❌ No built-in query capabilities')
      
      console.log('\nPostgreSQL Append-Only:')
      console.log('  ✅ Fast batch operations')
      console.log('  ✅ Built-in indexing and queries')
      console.log('  ✅ Space efficient (database compression)')
      console.log('  ✅ ACID compliance (with LOGGED tables)')
      console.log('  ✅ Replication support')
      console.log('  ❌ Requires database server')
      console.log('  ❌ More complex backup/restore')
      console.log('  ❌ Harder to debug')
      
      console.log('\n=== RECOMMENDATIONS ===')
      console.log('Use Filesystem when:')
      console.log('  - Simple local storage needed')
      console.log('  - Version history is important')
      console.log('  - Debugging/inspection needed')
      console.log('  - Git integration desired')
      
      console.log('\nUse PostgreSQL when:')
      console.log('  - High throughput required')
      console.log('  - Complex queries needed')
      console.log('  - Multi-user access required')
      console.log('  - Production deployment')
    })
  })
})