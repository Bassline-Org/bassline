import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'
import { createClient } from 'redis'

describe('Redis vs PostgreSQL - Real Performance Test', () => {
  let pgPool: Pool
  let redisClient: any
  let networkId: NetworkId
  
  beforeAll(async () => {
    // PostgreSQL setup
    pgPool = new Pool({ 
      database: 'bassline_test', 
      max: 50,
      statement_timeout: 30000,
    })
    
    // Redis setup
    redisClient = createClient({
      url: 'redis://localhost:6379'
    })
    
    try {
      await redisClient.connect()
      console.log('✅ Connected to Redis')
    } catch (error: any) {
      console.log(`❌ Redis connection failed: ${error.message}`)
      throw error
    }
    
    networkId = brand.networkId('redis-pg-comparison')
    
    // Clean both databases
    const pgClient = await pgPool.connect()
    await pgClient.query(`
      TRUNCATE TABLE bassline_contact_values_fast CASCADE;
      ALTER SEQUENCE bassline_version_seq RESTART WITH 1;
    `)
    pgClient.release()
    
    await redisClient.flushAll()
    
  }, 60000)
  
  afterAll(async () => {
    if (redisClient) {
      await redisClient.disconnect()
    }
    await pgPool.end()
  }, 30000)

  describe('Head-to-Head Performance', () => {
    it('should compare single operations', async () => {
      console.log('\n=== REDIS vs POSTGRESQL - SINGLE OPERATIONS ===\n')
      
      const iterations = 10000
      const groupId = brand.groupId('single-test')
      
      // Test 1: Redis
      console.log('1. Redis (Real In-Memory Database):')
      
      const redisStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        const key = `${networkId}:${groupId}:redis-${i}`
        const content = JSON.stringify({ value: i, data: `Test ${i}` })
        await redisClient.hSet(key, {
          content: content,
          version: i + 1
        })
      }
      const redisTime = performance.now() - redisStart
      
      console.log(`  Time: ${redisTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(redisTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(redisTime/1000)).toLocaleString()}`)
      
      // Test 2: PostgreSQL
      console.log('\n2. PostgreSQL Unlogged Append-Only:')
      const pgClient = await pgPool.connect()
      
      const pgStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await pgClient.query(
          `SELECT append_value_unlogged($1, $2, $3, $4)`,
          [networkId, groupId, brand.contactId(`pg-${i}`), JSON.stringify({ value: i, data: `Test ${i}` })]
        )
      }
      const pgTime = performance.now() - pgStart
      pgClient.release()
      
      console.log(`  Time: ${pgTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(pgTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== SINGLE OPERATION RESULTS ===')
      const speedup = (pgTime / redisTime).toFixed(1)
      console.log(`Redis is ${speedup}x faster than PostgreSQL`)
      console.log(`PostgreSQL achieves ${(100 / parseFloat(speedup)).toFixed(1)}% of Redis speed`)
    })

    it('should compare batch operations', async () => {
      console.log('\n=== REDIS vs POSTGRESQL - BATCH OPERATIONS ===\n')
      
      const batchSize = 50000
      const groupId = brand.groupId('batch-test')
      
      // Test 1: Redis Pipeline (batch)
      console.log('1. Redis Pipeline (Optimized Batch):')
      
      const redisBatchStart = performance.now()
      const pipeline = redisClient.multi()
      
      for (let i = 0; i < batchSize; i++) {
        const key = `${networkId}:${groupId}:batch-${i}`
        const content = JSON.stringify({ value: i, data: `Item ${i}` })
        pipeline.hSet(key, {
          content: content,
          version: i + 1
        })
      }
      
      await pipeline.exec()
      const redisBatchTime = performance.now() - redisBatchStart
      
      console.log(`  Time: ${redisBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(redisBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(redisBatchTime/1000)).toLocaleString()}`)
      
      // Test 2: PostgreSQL Batch
      console.log('\n2. PostgreSQL Unlogged Batch:')
      const pgClient = await pgPool.connect()
      
      const pgBatchData = []
      for (let i = 0; i < batchSize; i++) {
        pgBatchData.push({
          network_id: networkId,
          group_id: groupId,
          contact_id: brand.contactId(`batch-${i}`),
          content_value: JSON.stringify({ value: i, data: `Item ${i}` }),
          content_type: 'json'
        })
      }
      
      const pgBatchStart = performance.now()
      await pgClient.query(
        `SELECT batch_append_unlogged($1::jsonb[])`,
        [pgBatchData]
      )
      const pgBatchTime = performance.now() - pgBatchStart
      pgClient.release()
      
      console.log(`  Time: ${pgBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(pgBatchTime/1000)).toLocaleString()}`)
      
      // Batch comparison
      console.log('\n=== BATCH OPERATION RESULTS ===')
      const batchSpeedup = (pgBatchTime / redisBatchTime).toFixed(1)
      console.log(`Redis batch is ${batchSpeedup}x faster than PostgreSQL`)
      console.log(`PostgreSQL batch achieves ${(100 / parseFloat(batchSpeedup)).toFixed(1)}% of Redis speed`)
    })

    it('should compare read performance', async () => {
      console.log('\n=== REDIS vs POSTGRESQL - READ PERFORMANCE ===\n')
      
      const numRecords = 10000
      const groupId = brand.groupId('read-test')
      
      // Setup test data in Redis
      console.log('Setting up test data...')
      for (let i = 0; i < numRecords; i++) {
        const key = `${networkId}:${groupId}:read-${i}`
        const content = JSON.stringify({ value: i, data: `Test ${i}` })
        await redisClient.hSet(key, { content })
      }
      
      // Setup test data in PostgreSQL
      const pgClient = await pgPool.connect()
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
      await pgClient.query(`SELECT batch_append_unlogged($1::jsonb[])`, [pgData])
      
      const readIterations = 10000
      
      // Test 1: Redis reads
      console.log('1. Redis Random Reads:')
      const redisReadStart = performance.now()
      for (let i = 0; i < readIterations; i++) {
        const idx = Math.floor(Math.random() * numRecords)
        const key = `${networkId}:${groupId}:read-${idx}`
        await redisClient.hGet(key, 'content')
      }
      const redisReadTime = performance.now() - redisReadStart
      
      console.log(`  Time: ${redisReadTime.toFixed(2)}ms`)
      console.log(`  Per read: ${(redisReadTime/readIterations).toFixed(3)}ms`)
      console.log(`  Reads/second: ${Math.round(readIterations/(redisReadTime/1000)).toLocaleString()}`)
      
      // Test 2: PostgreSQL reads
      console.log('\n2. PostgreSQL Random Reads:')
      const pgReadIterations = 1000 // Less for PG since it's slower
      const pgReadStart = performance.now()
      for (let i = 0; i < pgReadIterations; i++) {
        const idx = Math.floor(Math.random() * numRecords)
        await pgClient.query(
          `SELECT * FROM get_latest_value($1, $2, $3)`,
          [networkId, groupId, brand.contactId(`read-${idx}`)]
        )
      }
      const pgReadTime = performance.now() - pgReadStart
      pgClient.release()
      
      const pgReadsPerSec = Math.round(pgReadIterations/(pgReadTime/1000))
      const redisReadsPerSec = Math.round(readIterations/(redisReadTime/1000))
      
      console.log(`  Time for ${pgReadIterations} reads: ${pgReadTime.toFixed(2)}ms`)
      console.log(`  Per read: ${(pgReadTime/pgReadIterations).toFixed(3)}ms`)
      console.log(`  Reads/second: ${pgReadsPerSec.toLocaleString()}`)
      
      // Read comparison
      console.log('\n=== READ PERFORMANCE RESULTS ===')
      const readSpeedup = (redisReadsPerSec / pgReadsPerSec).toFixed(1)
      console.log(`Redis reads are ${readSpeedup}x faster than PostgreSQL`)
      console.log(`PostgreSQL reads achieve ${(100 / parseFloat(readSpeedup)).toFixed(1)}% of Redis speed`)
    })

    it('should test maximum throughput showdown', async () => {
      console.log('\n=== MAXIMUM THROUGHPUT SHOWDOWN ===\n')
      
      const testDuration = 3000 // 3 seconds
      
      // Test 1: Redis maximum throughput
      console.log('1. Redis Maximum Throughput (3 second test):')
      let redisOps = 0
      const redisEndTime = performance.now() + testDuration
      const redisStart = performance.now()
      
      while (performance.now() < redisEndTime) {
        // Use pipeline for maximum speed
        const pipeline = redisClient.multi()
        
        for (let i = 0; i < 1000 && performance.now() < redisEndTime; i++) {
          pipeline.hSet(`max:redis:${redisOps + i}`, {
            content: JSON.stringify({ value: redisOps + i }),
            version: redisOps + i
          })
        }
        
        await pipeline.exec()
        redisOps += 1000
      }
      
      const redisElapsed = performance.now() - redisStart
      const redisOpsPerSec = Math.round(redisOps / (redisElapsed / 1000))
      
      console.log(`  Operations: ${redisOps.toLocaleString()}`)
      console.log(`  Time: ${redisElapsed.toFixed(2)}ms`)
      console.log(`  Ops/second: ${redisOpsPerSec.toLocaleString()}`)
      
      // Test 2: PostgreSQL maximum throughput
      console.log('\n2. PostgreSQL Maximum Throughput (3 second test):')
      const pgClient = await pgPool.connect()
      
      let pgOps = 0
      const pgEndTime = performance.now() + testDuration
      const pgStart = performance.now()
      
      while (performance.now() < pgEndTime) {
        const batch = []
        for (let i = 0; i < 10000 && performance.now() < pgEndTime; i++) {
          batch.push({
            network_id: 'max',
            group_id: 'test',
            contact_id: `pg-${pgOps + i}`,
            content_value: JSON.stringify({ value: pgOps + i }),
            content_type: 'json'
          })
        }
        
        if (batch.length > 0) {
          await pgClient.query(`SELECT batch_append_unlogged($1::jsonb[])`, [batch])
          pgOps += batch.length
        }
      }
      
      const pgElapsed = performance.now() - pgStart
      const pgOpsPerSec = Math.round(pgOps / (pgElapsed / 1000))
      
      console.log(`  Operations: ${pgOps.toLocaleString()}`)
      console.log(`  Time: ${pgElapsed.toFixed(2)}ms`)
      console.log(`  Ops/second: ${pgOpsPerSec.toLocaleString()}`)
      
      pgClient.release()
      
      // Final showdown results
      console.log('\n=== 🥊 FINAL SHOWDOWN RESULTS 🥊 ===')
      const maxSpeedup = (redisOpsPerSec / pgOpsPerSec).toFixed(1)
      console.log(`🔥 Redis: ${redisOpsPerSec.toLocaleString()} ops/sec`)
      console.log(`🐘 PostgreSQL: ${pgOpsPerSec.toLocaleString()} ops/sec`)
      console.log(`📊 Redis is ${maxSpeedup}x faster`)
      console.log(`🎯 PostgreSQL achieves ${(pgOpsPerSec / redisOpsPerSec * 100).toFixed(1)}% of Redis performance`)
      
      console.log('\n=== VERDICT ===')
      if (parseFloat(maxSpeedup) < 5) {
        console.log('🏆 PostgreSQL puts up an impressive fight!')
      } else if (parseFloat(maxSpeedup) < 10) {
        console.log('⚔️  Redis wins, but PostgreSQL is competitive!')
      } else {
        console.log('🚀 Redis dominates, but PostgreSQL offers much more than just speed!')
      }
    })
  })
})