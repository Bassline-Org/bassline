import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'

describe('In-Memory vs PostgreSQL Performance Comparison', () => {
  let pool: Pool
  let networkId: NetworkId
  
  beforeAll(async () => {
    pool = new Pool({ 
      database: 'bassline_test', 
      max: 50,
      statement_timeout: 30000,
    })
    
    networkId = brand.networkId('memory-comparison')
    
    // Clean database
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE bassline_contact_values_fast CASCADE;
      ALTER SEQUENCE bassline_version_seq RESTART WITH 1;
    `)
    client.release()
  }, 60000)
  
  afterAll(async () => {
    await pool.end()
  }, 30000)

  // Pure in-memory JavaScript Map implementation
  class InMemoryStorage {
    private data: Map<string, any> = new Map()
    private versions: Map<string, number> = new Map()
    private versionCounter = 0
    
    save(networkId: string, groupId: string, contactId: string, content: any) {
      const key = `${networkId}:${groupId}:${contactId}`
      this.data.set(key, content)
      this.versions.set(key, ++this.versionCounter)
    }
    
    load(networkId: string, groupId: string, contactId: string) {
      const key = `${networkId}:${groupId}:${contactId}`
      return this.data.get(key)
    }
    
    batchSave(operations: Array<{n: string, g: string, c: string, content: any}>) {
      for (const op of operations) {
        this.save(op.n, op.g, op.c, op.content)
      }
    }
  }

  // Simple memory database with JSON serialization
  class SerializedMemoryStorage {
    private data: Map<string, string> = new Map()
    
    save(networkId: string, groupId: string, contactId: string, content: any) {
      const key = `${networkId}:${groupId}:${contactId}`
      this.data.set(key, JSON.stringify(content))
    }
    
    load(networkId: string, groupId: string, contactId: string) {
      const key = `${networkId}:${groupId}:${contactId}`
      const val = this.data.get(key)
      return val ? JSON.parse(val) : null
    }
    
    batchSave(operations: Array<{n: string, g: string, c: string, content: any}>) {
      for (const op of operations) {
        this.save(op.n, op.g, op.c, op.content)
      }
    }
  }

  describe('Speed Comparison', () => {
    it('should compare single operations', async () => {
      console.log('\n=== SINGLE OPERATION COMPARISON ===\n')
      
      const iterations = 10000
      const groupId = brand.groupId('single-test')
      
      // Test 1: Pure In-Memory (no serialization)
      console.log('1. Pure In-Memory (JavaScript Map):')
      const memStorage = new InMemoryStorage()
      
      const memStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        memStorage.save(
          networkId, 
          groupId, 
          brand.contactId(`mem-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const memTime = performance.now() - memStart
      
      console.log(`  Time: ${memTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(memTime/iterations * 1000).toFixed(2)}ns`)
      console.log(`  Ops/second: ${Math.round(iterations/(memTime/1000)).toLocaleString()}`)
      
      // Test 2: In-Memory with JSON serialization
      console.log('\n2. In-Memory with JSON Serialization:')
      const serializedStorage = new SerializedMemoryStorage()
      
      const serializedStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        serializedStorage.save(
          networkId,
          groupId,
          brand.contactId(`ser-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const serializedTime = performance.now() - serializedStart
      
      console.log(`  Time: ${serializedTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(serializedTime/iterations * 1000).toFixed(2)}ns`)
      console.log(`  Ops/second: ${Math.round(iterations/(serializedTime/1000)).toLocaleString()}`)
      
      // Test 3: PostgreSQL Unlogged Append-Only
      console.log('\n3. PostgreSQL Unlogged Append-Only:')
      const client = await pool.connect()
      
      const pgStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await client.query(
          `SELECT append_value_unlogged($1, $2, $3, $4)`,
          [networkId, groupId, brand.contactId(`pg-${i}`), JSON.stringify({ value: i, data: `Test ${i}` })]
        )
      }
      const pgTime = performance.now() - pgStart
      client.release()
      
      console.log(`  Time: ${pgTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgTime/iterations * 1000).toFixed(2)}ns`)
      console.log(`  Ops/second: ${Math.round(iterations/(pgTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== PERFORMANCE RATIOS ===')
      console.log(`PostgreSQL is ${(pgTime/memTime).toFixed(1)}x slower than pure in-memory`)
      console.log(`PostgreSQL is ${(pgTime/serializedTime).toFixed(1)}x slower than in-memory with JSON`)
      console.log(`Serialization overhead: ${(serializedTime/memTime).toFixed(1)}x`)
    })

    it('should compare batch operations', async () => {
      console.log('\n=== BATCH OPERATION COMPARISON ===\n')
      
      const batchSize = 100000
      const groupId = brand.groupId('batch-test')
      
      // Prepare batch data
      const memOps = []
      const pgOps = []
      for (let i = 0; i < batchSize; i++) {
        memOps.push({
          n: networkId,
          g: groupId,
          c: brand.contactId(`batch-${i}`),
          content: { value: i, data: `Item ${i}` }
        })
        pgOps.push({
          network_id: networkId,
          group_id: groupId,
          contact_id: brand.contactId(`batch-${i}`),
          content_value: JSON.stringify({ value: i, data: `Item ${i}` }),
          content_type: 'json'
        })
      }
      
      // Test 1: Pure In-Memory batch
      console.log('1. Pure In-Memory Batch:')
      const memStorage = new InMemoryStorage()
      
      const memBatchStart = performance.now()
      memStorage.batchSave(memOps)
      const memBatchTime = performance.now() - memBatchStart
      
      console.log(`  Time: ${memBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(memBatchTime/batchSize * 1000).toFixed(2)}ns`)
      console.log(`  Ops/second: ${Math.round(batchSize/(memBatchTime/1000)).toLocaleString()}`)
      
      // Test 2: In-Memory with serialization batch
      console.log('\n2. In-Memory with JSON Batch:')
      const serializedStorage = new SerializedMemoryStorage()
      
      const serializedBatchStart = performance.now()
      serializedStorage.batchSave(memOps)
      const serializedBatchTime = performance.now() - serializedBatchStart
      
      console.log(`  Time: ${serializedBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(serializedBatchTime/batchSize * 1000).toFixed(2)}ns`)
      console.log(`  Ops/second: ${Math.round(batchSize/(serializedBatchTime/1000)).toLocaleString()}`)
      
      // Test 3: PostgreSQL batch
      console.log('\n3. PostgreSQL Unlogged Batch:')
      const client = await pool.connect()
      
      const pgBatchStart = performance.now()
      await client.query(
        `SELECT batch_append_unlogged($1::jsonb[])`,
        [pgOps]
      )
      const pgBatchTime = performance.now() - pgBatchStart
      client.release()
      
      console.log(`  Time: ${pgBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgBatchTime/batchSize * 1000).toFixed(2)}ns`)
      console.log(`  Ops/second: ${Math.round(batchSize/(pgBatchTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== BATCH PERFORMANCE RATIOS ===')
      console.log(`PostgreSQL batch is ${(pgBatchTime/memBatchTime).toFixed(1)}x slower than pure in-memory`)
      console.log(`PostgreSQL batch is ${(pgBatchTime/serializedBatchTime).toFixed(1)}x slower than in-memory with JSON`)
      console.log(`Batch efficiency gain for PostgreSQL: ${((batchSize * (412/1000)) / pgBatchTime).toFixed(1)}x`)
    })

    it('should test theoretical maximum throughput', async () => {
      console.log('\n=== THEORETICAL MAXIMUM THROUGHPUT ===\n')
      
      const testDuration = 1000 // 1 second
      let operations = 0
      
      // Test 1: How many in-memory operations in 1 second?
      console.log('1. Pure In-Memory Operations in 1 second:')
      const memStorage = new InMemoryStorage()
      const memEnd = performance.now() + testDuration
      
      while (performance.now() < memEnd) {
        for (let i = 0; i < 1000; i++) {
          memStorage.save('n', 'g', `c${operations}`, { v: operations })
          operations++
        }
      }
      
      console.log(`  Total operations: ${operations.toLocaleString()}`)
      console.log(`  Ops/second: ${operations.toLocaleString()}`)
      
      // Test 2: With serialization
      console.log('\n2. In-Memory with JSON in 1 second:')
      const serializedStorage = new SerializedMemoryStorage()
      let serializedOps = 0
      const serEnd = performance.now() + testDuration
      
      while (performance.now() < serEnd) {
        for (let i = 0; i < 1000; i++) {
          serializedStorage.save('n', 'g', `c${serializedOps}`, { v: serializedOps })
          serializedOps++
        }
      }
      
      console.log(`  Total operations: ${serializedOps.toLocaleString()}`)
      console.log(`  Ops/second: ${serializedOps.toLocaleString()}`)
      
      // Test 3: PostgreSQL maximum batch
      console.log('\n3. PostgreSQL Maximum Batch in 1 second:')
      const client = await pool.connect()
      
      // Create largest batch that fits in 1 second (based on our tests)
      const optimalBatch = 120000 // Based on ~120K ops/sec we saw
      const pgOps = []
      for (let i = 0; i < optimalBatch; i++) {
        pgOps.push({
          network_id: 'max',
          group_id: 'test',
          contact_id: `max-${i}`,
          content_value: JSON.stringify({ v: i }),
          content_type: 'json'
        })
      }
      
      const pgMaxStart = performance.now()
      await client.query(
        `SELECT batch_append_unlogged($1::jsonb[])`,
        [pgOps]
      )
      const pgMaxTime = performance.now() - pgMaxStart
      const pgOpsPerSec = Math.round(optimalBatch / (pgMaxTime / 1000))
      client.release()
      
      console.log(`  Batch size: ${optimalBatch.toLocaleString()}`)
      console.log(`  Time: ${pgMaxTime.toFixed(2)}ms`)
      console.log(`  Ops/second: ${pgOpsPerSec.toLocaleString()}`)
      
      // Summary
      console.log('\n=== THEORETICAL SPEED COMPARISON ===')
      console.log(`Pure in-memory: ${operations.toLocaleString()} ops/sec`)
      console.log(`With JSON: ${serializedOps.toLocaleString()} ops/sec`)
      console.log(`PostgreSQL: ${pgOpsPerSec.toLocaleString()} ops/sec`)
      console.log(`\nPostgreSQL achieves ${(pgOpsPerSec/operations * 100).toFixed(1)}% of pure in-memory speed`)
      console.log(`PostgreSQL achieves ${(pgOpsPerSec/serializedOps * 100).toFixed(1)}% of in-memory with JSON speed`)
    })

    it('should test read performance', async () => {
      console.log('\n=== READ PERFORMANCE COMPARISON ===\n')
      
      const numRecords = 10000
      const groupId = brand.groupId('read-test')
      
      // Setup data
      const memStorage = new InMemoryStorage()
      const serializedStorage = new SerializedMemoryStorage()
      
      // Insert test data
      for (let i = 0; i < numRecords; i++) {
        const contactId = brand.contactId(`read-${i}`)
        const content = { value: i, data: `Test ${i}` }
        
        memStorage.save(networkId, groupId, contactId, content)
        serializedStorage.save(networkId, groupId, contactId, content)
      }
      
      // PostgreSQL data
      const client = await pool.connect()
      const pgData = []
      for (let i = 0; i < numRecords; i++) {
        pgData.push({
          network_id: networkId,
          group_id: groupId,
          contact_id: brand.contactId(`read-${i}`),
          content_value: JSON.stringify({ value: i, data: `Test ${i}` }),
          content_type: 'json'
        })
      }
      await client.query(`SELECT batch_append_unlogged($1::jsonb[])`, [pgData])
      
      // Test reads
      const readIterations = 10000
      
      // Test 1: In-memory reads
      console.log('1. Pure In-Memory Reads:')
      const memReadStart = performance.now()
      for (let i = 0; i < readIterations; i++) {
        const idx = Math.floor(Math.random() * numRecords)
        memStorage.load(networkId, groupId, brand.contactId(`read-${idx}`))
      }
      const memReadTime = performance.now() - memReadStart
      
      console.log(`  Time: ${memReadTime.toFixed(2)}ms`)
      console.log(`  Per read: ${(memReadTime/readIterations * 1000).toFixed(2)}ns`)
      console.log(`  Reads/second: ${Math.round(readIterations/(memReadTime/1000)).toLocaleString()}`)
      
      // Test 2: Serialized reads
      console.log('\n2. In-Memory with JSON Reads:')
      const serReadStart = performance.now()
      for (let i = 0; i < readIterations; i++) {
        const idx = Math.floor(Math.random() * numRecords)
        serializedStorage.load(networkId, groupId, brand.contactId(`read-${idx}`))
      }
      const serReadTime = performance.now() - serReadStart
      
      console.log(`  Time: ${serReadTime.toFixed(2)}ms`)
      console.log(`  Per read: ${(serReadTime/readIterations * 1000).toFixed(2)}ns`)
      console.log(`  Reads/second: ${Math.round(readIterations/(serReadTime/1000)).toLocaleString()}`)
      
      // Test 3: PostgreSQL reads
      console.log('\n3. PostgreSQL Reads:')
      const pgReadStart = performance.now()
      for (let i = 0; i < 1000; i++) { // Less iterations for PG
        const idx = Math.floor(Math.random() * numRecords)
        await client.query(
          `SELECT * FROM get_latest_value($1, $2, $3)`,
          [networkId, groupId, brand.contactId(`read-${idx}`)]
        )
      }
      const pgReadTime = performance.now() - pgReadStart
      const pgReadsPerSec = Math.round(1000/(pgReadTime/1000))
      client.release()
      
      console.log(`  Time for 1000 reads: ${pgReadTime.toFixed(2)}ms`)
      console.log(`  Per read: ${(pgReadTime/1000).toFixed(2)}ms`)
      console.log(`  Reads/second: ${pgReadsPerSec.toLocaleString()}`)
      
      // Comparison
      console.log('\n=== READ PERFORMANCE RATIOS ===')
      const memReadsPerSec = Math.round(readIterations/(memReadTime/1000))
      const serReadsPerSec = Math.round(readIterations/(serReadTime/1000))
      console.log(`PostgreSQL reads are ${(memReadsPerSec/pgReadsPerSec).toFixed(0)}x slower than pure in-memory`)
      console.log(`PostgreSQL reads are ${(serReadsPerSec/pgReadsPerSec).toFixed(0)}x slower than in-memory with JSON`)
    })
  })
})