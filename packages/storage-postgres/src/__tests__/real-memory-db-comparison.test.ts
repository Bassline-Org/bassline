import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'

// We'll test against these real in-memory databases:
// 1. Redis (industry standard)
// 2. SQLite :memory: (SQL in-memory)
// 3. LevelDB (key-value store)

describe('Real In-Memory Database Comparison', () => {
  let pgPool: Pool
  let networkId: NetworkId
  
  beforeAll(async () => {
    pgPool = new Pool({ 
      database: 'bassline_test', 
      max: 50,
      statement_timeout: 30000,
    })
    
    networkId = brand.networkId('real-memory-comparison')
    
    // Clean PostgreSQL
    const client = await pgPool.connect()
    await client.query(`
      TRUNCATE TABLE bassline_contact_values_fast CASCADE;
      ALTER SEQUENCE bassline_version_seq RESTART WITH 1;
    `)
    client.release()
  }, 60000)
  
  afterAll(async () => {
    await pgPool.end()
  }, 30000)

  // Redis adapter
  class RedisStorage {
    private redis: any
    private versionCounter = 0
    private isConnected = false
    
    constructor() {
      try {
        // Import redis (ES module style)
        import('redis').then(Redis => {
          this.redis = Redis.createClient({
            url: 'redis://localhost:6379'
          })
        }).catch(() => {
          // Fallback if import fails
          const Redis = require('redis')
          this.redis = Redis.createClient({
            url: 'redis://localhost:6379'
          })
        })
      } catch (e) {
        console.log('   Redis not available - simulating with Map')
        // Fallback to Map for simulation
        this.redis = {
          data: new Map(),
          hSet: (key: string, field: string, value: string) => {
            if (!this.redis.data.has(key)) this.redis.data.set(key, new Map())
            this.redis.data.get(key).set(field, value)
            return Promise.resolve()
          },
          hGet: (key: string, field: string) => {
            const hash = this.redis.data.get(key)
            return Promise.resolve(hash ? hash.get(field) : null)
          },
          connect: () => Promise.resolve(),
          disconnect: () => Promise.resolve(),
          flushAll: () => {
            this.redis.data.clear()
            return Promise.resolve()
          }
        }
      }
    }
    
    async connect() {
      if (this.redis.connect) await this.redis.connect()
    }
    
    async disconnect() {
      if (this.redis.disconnect) await this.redis.disconnect()
    }
    
    async save(networkId: string, groupId: string, contactId: string, content: any) {
      const key = `${networkId}:${groupId}:${contactId}`
      const version = ++this.versionCounter
      
      // Store both current value and version
      await this.redis.hset(key, 'content', JSON.stringify(content))
      await this.redis.hset(key, 'version', version.toString())
    }
    
    async load(networkId: string, groupId: string, contactId: string) {
      const key = `${networkId}:${groupId}:${contactId}`
      const content = await this.redis.hget(key, 'content')
      return content ? JSON.parse(content) : null
    }
    
    async batchSave(operations: Array<{n: string, g: string, c: string, content: any}>) {
      // Redis doesn't have great batch support, so we'll pipeline
      for (const op of operations) {
        await this.save(op.n, op.g, op.c, op.content)
      }
    }
    
    async clear() {
      if (this.redis.flushall) await this.redis.flushall()
    }
  }

  // SQLite in-memory adapter
  class SQLiteMemoryStorage {
    private db: any
    
    constructor() {
      try {
        const Database = require('better-sqlite3')
        this.db = new Database(':memory:')
        
        // Create table
        this.db.exec(`
          CREATE TABLE contacts (
            key TEXT PRIMARY KEY,
            content TEXT,
            version INTEGER
          )
        `)
        
        // Prepare statements
        this.insertStmt = this.db.prepare(`
          INSERT OR REPLACE INTO contacts (key, content, version) VALUES (?, ?, ?)
        `)
        this.selectStmt = this.db.prepare(`
          SELECT content FROM contacts WHERE key = ?
        `)
      } catch (e) {
        console.log('   SQLite not available - simulating with Map')
        // Fallback simulation
        this.db = {
          data: new Map(),
          insertStmt: { run: (key: string, content: string, version: number) => {
            this.db.data.set(key, { content, version })
          }},
          selectStmt: { get: (key: string) => {
            const row = this.db.data.get(key)
            return row ? { content: row.content } : null
          }}
        }
      }
      this.versionCounter = 0
    }
    
    save(networkId: string, groupId: string, contactId: string, content: any) {
      const key = `${networkId}:${groupId}:${contactId}`
      const version = ++this.versionCounter
      this.db.insertStmt.run(key, JSON.stringify(content), version)
    }
    
    load(networkId: string, groupId: string, contactId: string) {
      const key = `${networkId}:${groupId}:${contactId}`
      const row = this.db.selectStmt.get(key)
      return row ? JSON.parse(row.content) : null
    }
    
    batchSave(operations: Array<{n: string, g: string, c: string, content: any}>) {
      // SQLite has excellent batch performance with transactions
      const transaction = this.db.transaction ? this.db.transaction(() => {
        for (const op of operations) {
          this.save(op.n, op.g, op.c, op.content)
        }
      }) : () => {
        for (const op of operations) {
          this.save(op.n, op.g, op.c, op.content)
        }
      }
      
      transaction()
    }
  }

  // LevelDB adapter (ultra-fast key-value)
  class LevelDBStorage {
    private db: any
    private versionCounter = 0
    
    constructor() {
      try {
        const level = require('level')
        this.db = level('temp-leveldb', { valueEncoding: 'json' })
      } catch (e) {
        console.log('   LevelDB not available - simulating with Map')
        this.db = {
          data: new Map(),
          put: (key: string, value: any) => this.db.data.set(key, value),
          get: (key: string) => Promise.resolve(this.db.data.get(key)),
          batch: (ops: any[]) => {
            for (const op of ops) {
              if (op.type === 'put') this.db.data.set(op.key, op.value)
            }
            return Promise.resolve()
          }
        }
      }
    }
    
    async save(networkId: string, groupId: string, contactId: string, content: any) {
      const key = `${networkId}:${groupId}:${contactId}`
      const version = ++this.versionCounter
      await this.db.put(key, { content, version })
    }
    
    async load(networkId: string, groupId: string, contactId: string) {
      const key = `${networkId}:${groupId}:${contactId}`
      try {
        const data = await this.db.get(key)
        return data.content
      } catch (e) {
        return null
      }
    }
    
    async batchSave(operations: Array<{n: string, g: string, c: string, content: any}>) {
      const batch = []
      for (const op of operations) {
        const key = `${op.n}:${op.g}:${op.c}`
        const version = ++this.versionCounter
        batch.push({
          type: 'put',
          key,
          value: { content: op.content, version }
        })
      }
      await this.db.batch(batch)
    }
  }

  describe('Real Database Performance', () => {
    it('should compare single operations across real databases', async () => {
      console.log('\n=== REAL IN-MEMORY DATABASE COMPARISON ===\n')
      
      const iterations = 10000
      const groupId = brand.groupId('real-single-test')
      
      // Test 1: Redis
      console.log('1. Redis (Industry Standard):')
      const redis = new RedisStorage()
      await redis.connect()
      await redis.clear()
      
      const redisStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await redis.save(
          networkId, 
          groupId, 
          brand.contactId(`redis-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const redisTime = performance.now() - redisStart
      
      console.log(`  Time: ${redisTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(redisTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(redisTime/1000)).toLocaleString()}`)
      
      await redis.disconnect()
      
      // Test 2: SQLite in-memory
      console.log('\n2. SQLite In-Memory (SQL):')
      const sqlite = new SQLiteMemoryStorage()
      
      const sqliteStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        sqlite.save(
          networkId,
          groupId,
          brand.contactId(`sqlite-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const sqliteTime = performance.now() - sqliteStart
      
      console.log(`  Time: ${sqliteTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(sqliteTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(sqliteTime/1000)).toLocaleString()}`)
      
      // Test 3: LevelDB
      console.log('\n3. LevelDB (Key-Value):')
      const leveldb = new LevelDBStorage()
      
      const levelStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await leveldb.save(
          networkId,
          groupId,
          brand.contactId(`level-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const levelTime = performance.now() - levelStart
      
      console.log(`  Time: ${levelTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(levelTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(levelTime/1000)).toLocaleString()}`)
      
      // Test 4: PostgreSQL (for comparison)
      console.log('\n4. PostgreSQL Unlogged (Our System):')
      const client = await pgPool.connect()
      
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
      console.log(`  Per operation: ${(pgTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(pgTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== PERFORMANCE RATIOS (vs PostgreSQL) ===')
      console.log(`Redis is ${(pgTime/redisTime).toFixed(1)}x faster than PostgreSQL`)
      console.log(`SQLite is ${(pgTime/sqliteTime).toFixed(1)}x faster than PostgreSQL`)
      console.log(`LevelDB is ${(pgTime/levelTime).toFixed(1)}x faster than PostgreSQL`)
    })

    it('should compare batch operations', async () => {
      console.log('\n=== BATCH OPERATION COMPARISON ===\n')
      
      const batchSize = 50000
      const groupId = brand.groupId('real-batch-test')
      
      // Prepare batch data
      const batchOps = []
      for (let i = 0; i < batchSize; i++) {
        batchOps.push({
          n: networkId,
          g: groupId,
          c: brand.contactId(`batch-${i}`),
          content: { value: i, data: `Item ${i}` }
        })
      }
      
      // Test 1: Redis batch
      console.log('1. Redis Batch:')
      const redis = new RedisStorage()
      await redis.connect()
      await redis.clear()
      
      const redisBatchStart = performance.now()
      await redis.batchSave(batchOps)
      const redisBatchTime = performance.now() - redisBatchStart
      
      console.log(`  Time: ${redisBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(redisBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(redisBatchTime/1000)).toLocaleString()}`)
      
      await redis.disconnect()
      
      // Test 2: SQLite batch (with transaction)
      console.log('\n2. SQLite Batch (Transaction):')
      const sqlite = new SQLiteMemoryStorage()
      
      const sqliteBatchStart = performance.now()
      sqlite.batchSave(batchOps)
      const sqliteBatchTime = performance.now() - sqliteBatchStart
      
      console.log(`  Time: ${sqliteBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(sqliteBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(sqliteBatchTime/1000)).toLocaleString()}`)
      
      // Test 3: LevelDB batch
      console.log('\n3. LevelDB Batch:')
      const leveldb = new LevelDBStorage()
      
      const levelBatchStart = performance.now()
      await leveldb.batchSave(batchOps)
      const levelBatchTime = performance.now() - levelBatchStart
      
      console.log(`  Time: ${levelBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(levelBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(levelBatchTime/1000)).toLocaleString()}`)
      
      // Test 4: PostgreSQL batch
      console.log('\n4. PostgreSQL Batch:')
      const client = await pgPool.connect()
      
      const pgBatchData = batchOps.map(op => ({
        network_id: op.n,
        group_id: op.g,
        contact_id: op.c,
        content_value: JSON.stringify(op.content),
        content_type: 'json'
      }))
      
      const pgBatchStart = performance.now()
      await client.query(
        `SELECT batch_append_unlogged($1::jsonb[])`,
        [pgBatchData]
      )
      const pgBatchTime = performance.now() - pgBatchStart
      client.release()
      
      console.log(`  Time: ${pgBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(pgBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(pgBatchTime/1000)).toLocaleString()}`)
      
      // Batch comparison
      console.log('\n=== BATCH PERFORMANCE RATIOS (vs PostgreSQL) ===')
      console.log(`Redis batch is ${(pgBatchTime/redisBatchTime).toFixed(1)}x faster than PostgreSQL`)
      console.log(`SQLite batch is ${(pgBatchTime/sqliteBatchTime).toFixed(1)}x faster than PostgreSQL`)
      console.log(`LevelDB batch is ${(pgBatchTime/levelBatchTime).toFixed(1)}x faster than PostgreSQL`)
    })

    it('should find the fastest real in-memory database', async () => {
      console.log('\n=== ULTIMATE SPEED TEST ===\n')
      
      const testDuration = 2000 // 2 seconds
      const results: any[] = []
      
      // Test each database for maximum throughput in 2 seconds
      const databases = [
        { name: 'Redis', storage: new RedisStorage() },
        { name: 'SQLite', storage: new SQLiteMemoryStorage() },
        { name: 'LevelDB', storage: new LevelDBStorage() }
      ]
      
      for (const { name, storage } of databases) {
        console.log(`Testing ${name} maximum throughput...`)
        
        if (storage.connect) await storage.connect()
        if (storage.clear) await storage.clear()
        
        let operations = 0
        const endTime = performance.now() + testDuration
        
        const start = performance.now()
        
        try {
          while (performance.now() < endTime) {
            // Batch of 1000 for efficiency
            const batch = []
            for (let i = 0; i < 1000 && performance.now() < endTime; i++) {
              batch.push({
                n: 'speed',
                g: 'test', 
                c: `${name.toLowerCase()}-${operations + i}`,
                content: { value: operations + i }
              })
            }
            
            if (storage.batchSave) {
              await storage.batchSave(batch)
            } else {
              for (const op of batch) {
                await storage.save(op.n, op.g, op.c, op.content)
              }
            }
            
            operations += batch.length
          }
        } catch (error: any) {
          console.log(`  Error: ${error.message}`)
        }
        
        const elapsed = performance.now() - start
        const opsPerSec = Math.round(operations / (elapsed / 1000))
        
        console.log(`  Operations: ${operations.toLocaleString()}`)
        console.log(`  Time: ${elapsed.toFixed(2)}ms`)
        console.log(`  Ops/second: ${opsPerSec.toLocaleString()}`)
        
        results.push({ name, operations, elapsed, opsPerSec })
        
        if (storage.disconnect) await storage.disconnect()
      }
      
      // Test PostgreSQL for comparison
      console.log('\nTesting PostgreSQL maximum throughput...')
      const pgClient = await pgPool.connect()
      
      let pgOps = 0
      const pgEndTime = performance.now() + testDuration
      const pgStart = performance.now()
      
      while (performance.now() < pgEndTime) {
        const batch = []
        for (let i = 0; i < 10000 && performance.now() < pgEndTime; i++) {
          batch.push({
            network_id: 'speed',
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
      
      // Final ranking
      results.push({ name: 'PostgreSQL', operations: pgOps, elapsed: pgElapsed, opsPerSec: pgOpsPerSec })
      results.sort((a, b) => b.opsPerSec - a.opsPerSec)
      
      console.log('\n=== FINAL RANKING (by ops/second) ===')
      results.forEach((result, i) => {
        const speedup = i === results.length - 1 ? '1.0x' : `${(result.opsPerSec / results[results.length - 1].opsPerSec).toFixed(1)}x`
        console.log(`${i + 1}. ${result.name}: ${result.opsPerSec.toLocaleString()} ops/sec (${speedup})`)
      })
    })
  })
})