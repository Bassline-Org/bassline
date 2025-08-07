import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'
import { spawn } from 'child_process'

describe('Parallel Scaling - Multiple Test Instances', () => {
  let pool: Pool
  let networkId: NetworkId
  
  beforeAll(async () => {
    pool = new Pool({ 
      database: 'bassline_test', 
      max: 200,  // High connection limit for extreme parallelism
      // Aggressive performance settings
      statement_timeout: 60000,
      idle_in_transaction_session_timeout: 60000
    })
    
    networkId = brand.networkId('parallel-scaling-test')
    
    // Clean database completely
    console.log('🧹 Cleaning database...')
    const client = await pool.connect()
    
    try {
      // Drop and recreate all tables for a fresh start
      await client.query(`
        -- Drop all bassline tables
        DROP TABLE IF EXISTS bassline_contact_values CASCADE;
        DROP TABLE IF EXISTS bassline_contact_values_fast CASCADE;
        DROP TABLE IF EXISTS bassline_contact_collections CASCADE;
        DROP TABLE IF EXISTS bassline_contact_versions CASCADE;
        DROP TABLE IF EXISTS bassline_contact_versions_fast CASCADE;
        DROP TABLE IF EXISTS bassline_propagation_log CASCADE;
        DROP TABLE IF EXISTS bassline_propagation_log_fast CASCADE;
        DROP TABLE IF EXISTS bassline_latest_cache CASCADE;
        DROP TABLE IF EXISTS bassline_hot_values CASCADE;
        DROP SEQUENCE IF EXISTS bassline_version_seq CASCADE;
      `)
      
      // Recreate from migrations
      console.log('📦 Recreating schema...')
      
      // Run migrations 005, 006, 007
      const migrations = [
        '/Users/goose/prg/bassline/packages/storage-postgres/src/migrations/005_append_only_schema.sql',
        '/Users/goose/prg/bassline/packages/storage-postgres/src/migrations/006_append_optimizations.sql', 
        '/Users/goose/prg/bassline/packages/storage-postgres/src/migrations/007_unlogged_tables.sql'
      ]
      
      for (const migration of migrations) {
        const fs = await import('fs')
        const sql = fs.readFileSync(migration, 'utf8')
        await client.query(sql)
      }
      
      // Set maximum performance settings (session-level only)
      await client.query(`
        SET synchronous_commit = OFF;
        SET work_mem = '1GB';
        SET maintenance_work_mem = '4GB';
        SET max_parallel_workers_per_gather = 16;
        SET effective_cache_size = '8GB';
        SET random_page_cost = 1.1;
      `)
      
      console.log('✅ Database cleaned and optimized')
    } finally {
      client.release()
    }
  }, 60000)  // 60 second timeout for setup
  
  afterAll(async () => {
    await pool.end()
  }, 30000)

  describe('Concurrent Instance Scaling', () => {
    it('should test single instance baseline', async () => {
      console.log('\n=== SINGLE INSTANCE BASELINE ===\n')
      
      const batchSize = 50000
      const iterations = 10
      
      const times: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const groupId = brand.groupId(`single-${i}`)
        const batchData = []
        
        for (let j = 0; j < batchSize; j++) {
          batchData.push({
            network_id: networkId,
            group_id: groupId,
            contact_id: brand.contactId(`single-${i}-${j}`),
            content_value: JSON.stringify({ batch: i, item: j }),
            content_type: 'json'
          })
        }
        
        const client = await pool.connect()
        const start = performance.now()
        
        await client.query(
          `SELECT batch_append_unlogged($1::jsonb[])`,
          [batchData]
        )
        
        const elapsed = performance.now() - start
        times.push(elapsed)
        client.release()
        
        console.log(`  Iteration ${i + 1}: ${elapsed.toFixed(2)}ms (${Math.round(batchSize/(elapsed/1000)).toLocaleString()} ops/s)`)
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length
      const totalOps = batchSize * iterations
      const totalTime = times.reduce((a, b) => a + b)
      
      console.log(`\nSingle Instance Summary:`)
      console.log(`  Average time: ${avgTime.toFixed(2)}ms`)
      console.log(`  Total operations: ${totalOps.toLocaleString()}`)
      console.log(`  Overall ops/second: ${Math.round(totalOps/(totalTime/1000)).toLocaleString()}`)
    }, 120000)  // 2 minute timeout

    it('should test multiple parallel instances', async () => {
      console.log('\n=== PARALLEL INSTANCES SCALING ===\n')
      
      const instanceCounts = [2, 4, 8, 16, 32]
      const batchSize = 25000
      const iterationsPerInstance = 5
      
      for (const numInstances of instanceCounts) {
        console.log(`\n--- Testing with ${numInstances} parallel instances ---`)
        
        const startTime = performance.now()
        const promises = []
        
        for (let instance = 0; instance < numInstances; instance++) {
          promises.push((async () => {
            const instanceTimes: number[] = []
            
            for (let iter = 0; iter < iterationsPerInstance; iter++) {
              const groupId = brand.groupId(`parallel-${instance}-${iter}`)
              const batchData = []
              
              for (let j = 0; j < batchSize; j++) {
                batchData.push({
                  network_id: networkId,
                  group_id: groupId,
                  contact_id: brand.contactId(`inst${instance}-iter${iter}-item${j}`),
                  content_value: JSON.stringify({ 
                    instance,
                    iteration: iter,
                    item: j,
                    timestamp: Date.now()
                  }),
                  content_type: 'json'
                })
              }
              
              const client = await pool.connect()
              const iterStart = performance.now()
              
              try {
                await client.query(
                  `SELECT batch_append_unlogged($1::jsonb[])`,
                  [batchData]
                )
              } finally {
                client.release()
              }
              
              const iterTime = performance.now() - iterStart
              instanceTimes.push(iterTime)
            }
            
            return {
              instance,
              times: instanceTimes,
              avgTime: instanceTimes.reduce((a, b) => a + b) / instanceTimes.length
            }
          })())
        }
        
        const results = await Promise.all(promises)
        const totalTime = performance.now() - startTime
        const totalOps = numInstances * iterationsPerInstance * batchSize
        
        // Calculate statistics
        const avgTimes = results.map(r => r.avgTime)
        const overallAvg = avgTimes.reduce((a, b) => a + b) / avgTimes.length
        const minTime = Math.min(...avgTimes)
        const maxTime = Math.max(...avgTimes)
        
        console.log(`\nResults for ${numInstances} instances:`)
        console.log(`  Total time: ${totalTime.toFixed(2)}ms`)
        console.log(`  Total operations: ${totalOps.toLocaleString()}`)
        console.log(`  Aggregate ops/second: ${Math.round(totalOps/(totalTime/1000)).toLocaleString()}`)
        console.log(`  Average instance time: ${overallAvg.toFixed(2)}ms`)
        console.log(`  Min instance time: ${minTime.toFixed(2)}ms`)
        console.log(`  Max instance time: ${maxTime.toFixed(2)}ms`)
        console.log(`  Time variance: ${((maxTime - minTime) / minTime * 100).toFixed(1)}%`)
        
        // Stop if performance degrades significantly
        if (overallAvg > 5000) {
          console.log('\n⚠️  Performance degrading significantly, stopping test')
          break
        }
      }
    }, 300000)  // 5 minute timeout

    it('should test maximum concurrent connections', async () => {
      console.log('\n=== MAXIMUM CONCURRENT CONNECTIONS ===\n')
      
      // Test how many concurrent connections we can handle
      const connectionCounts = [50, 100, 150, 200]
      const opsPerConnection = 1000
      
      for (const numConnections of connectionCounts) {
        console.log(`\nTesting ${numConnections} concurrent connections...`)
        
        const promises = []
        const startTime = performance.now()
        let successCount = 0
        let errorCount = 0
        
        for (let conn = 0; conn < numConnections; conn++) {
          promises.push((async () => {
            try {
              const client = await pool.connect()
              
              try {
                // Each connection does a small batch
                const batchData = []
                const groupId = brand.groupId(`maxconn-${conn}`)
                
                for (let i = 0; i < opsPerConnection; i++) {
                  batchData.push({
                    network_id: networkId,
                    group_id: groupId,
                    contact_id: brand.contactId(`conn${conn}-op${i}`),
                    content_value: JSON.stringify({ conn, op: i }),
                    content_type: 'json'
                  })
                }
                
                await client.query(
                  `SELECT batch_append_unlogged($1::jsonb[])`,
                  [batchData]
                )
                
                successCount++
              } finally {
                client.release()
              }
            } catch (error: any) {
              errorCount++
              console.error(`  Connection ${conn} failed: ${error.message}`)
            }
          })())
        }
        
        await Promise.all(promises)
        const totalTime = performance.now() - startTime
        const totalOps = successCount * opsPerConnection
        
        console.log(`Results:`)
        console.log(`  Successful connections: ${successCount}/${numConnections}`)
        console.log(`  Failed connections: ${errorCount}`)
        console.log(`  Total time: ${totalTime.toFixed(2)}ms`)
        console.log(`  Total operations: ${totalOps.toLocaleString()}`)
        console.log(`  Ops/second: ${Math.round(totalOps/(totalTime/1000)).toLocaleString()}`)
        
        if (errorCount > numConnections * 0.1) {  // More than 10% failures
          console.log('\n⚠️  Too many connection failures, stopping test')
          break
        }
      }
    }, 300000)  // 5 minute timeout

    it('should show system resource usage', async () => {
      console.log('\n=== SYSTEM RESOURCE ANALYSIS ===\n')
      
      const client = await pool.connect()
      
      try {
        // Get database statistics
        const dbStats = await client.query(`
          SELECT 
            numbackends as active_connections,
            xact_commit as transactions_committed,
            xact_rollback as transactions_rolled_back,
            blks_read as blocks_read,
            blks_hit as blocks_hit,
            tup_returned as tuples_returned,
            tup_fetched as tuples_fetched,
            tup_inserted as tuples_inserted,
            tup_updated as tuples_updated,
            tup_deleted as tuples_deleted
          FROM pg_stat_database
          WHERE datname = 'bassline_test'
        `)
        
        if (dbStats.rows.length > 0) {
          const stats = dbStats.rows[0]
          console.log('Database Statistics:')
          console.log(`  Active connections: ${stats.active_connections}`)
          console.log(`  Transactions committed: ${stats.transactions_committed}`)
          console.log(`  Tuples inserted: ${stats.tuples_inserted}`)
          console.log(`  Cache hit ratio: ${((stats.blocks_hit / (stats.blocks_hit + stats.blocks_read + 0.001)) * 100).toFixed(2)}%`)
        }
        
        // Get table sizes
        const tableSizes = await client.query(`
          SELECT 
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            n_tup_ins as inserts
          FROM pg_stat_user_tables
          WHERE schemaname = 'public' 
            AND tablename LIKE 'bassline%'
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
          LIMIT 5
        `)
        
        console.log('\nTop 5 Tables by Size:')
        for (const row of tableSizes.rows) {
          console.log(`  ${row.tablename}: ${row.size} (${row.inserts} inserts)`)
        }
        
        // Get connection pool stats
        const poolStats = await client.query(`
          SELECT 
            count(*) as total,
            count(*) FILTER (WHERE state = 'active') as active,
            count(*) FILTER (WHERE state = 'idle') as idle,
            count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
          FROM pg_stat_activity
          WHERE datname = 'bassline_test'
        `)
        
        if (poolStats.rows.length > 0) {
          const stats = poolStats.rows[0]
          console.log('\nConnection Pool:')
          console.log(`  Total: ${stats.total}`)
          console.log(`  Active: ${stats.active}`)
          console.log(`  Idle: ${stats.idle}`)
          console.log(`  Idle in transaction: ${stats.idle_in_transaction}`)
        }
        
      } finally {
        client.release()
      }
    }, 60000)
  })
})