import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'
import { createAppendOnlyStorage } from '../append-only-storage'

describe('LOGGED vs UNLOGGED Performance Comparison', () => {
  let pool: Pool
  let networkId: NetworkId
  
  beforeAll(async () => {
    pool = new Pool({ database: 'bassline_test', max: 10 })
    networkId = brand.networkId('durability-test')
    
    // Run migration to ensure both table types exist
    const client = await pool.connect()
    const migrationPath = new URL('../migrations/008_configurable_durability.sql', import.meta.url)
    const fs = await import('fs')
    const migrationSql = fs.readFileSync(migrationPath.pathname, 'utf8')
    
    try {
      await client.query(migrationSql)
      console.log('✅ Migration 008 applied')
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.error('Migration error:', error.message)
      }
    }
    
    // Clean both table types
    await client.query(`
      TRUNCATE TABLE bassline_contact_values CASCADE;
      TRUNCATE TABLE bassline_contact_values_fast CASCADE;
      ALTER SEQUENCE bassline_version_seq RESTART WITH 1;
    `)
    
    client.release()
  }, 60000)
  
  afterAll(async () => {
    await pool.end()
  }, 30000)

  describe('Durability Mode Comparison', () => {
    it('should compare single operation performance', async () => {
      console.log('\n=== SINGLE OPERATION PERFORMANCE ===\n')
      
      const iterations = 1000
      const groupId = brand.groupId('single-test')
      
      // Test 1: Full durability (LOGGED tables)
      console.log('1. Full Durability Mode (LOGGED tables):')
      const loggedStorage = createAppendOnlyStorage('production')
      await loggedStorage.initialize()
      
      const loggedStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await loggedStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`logged-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const loggedTime = performance.now() - loggedStart
      
      console.log(`  Time: ${loggedTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(loggedTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(loggedTime/1000)).toLocaleString()}`)
      
      // Test 2: Performance mode (UNLOGGED tables)
      console.log('\n2. Performance Mode (UNLOGGED tables):')
      const unloggedStorage = createAppendOnlyStorage('development')
      await unloggedStorage.initialize()
      
      const unloggedStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await unloggedStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`unlogged-${i}`),
          { value: i, data: `Test ${i}` }
        )
      }
      const unloggedTime = performance.now() - unloggedStart
      
      console.log(`  Time: ${unloggedTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(unloggedTime/iterations).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(iterations/(unloggedTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== COMPARISON ===')
      const speedup = (loggedTime / unloggedTime).toFixed(1)
      console.log(`UNLOGGED is ${speedup}x faster than LOGGED`)
      console.log(`Durability cost: ${((loggedTime - unloggedTime) / unloggedTime * 100).toFixed(0)}% overhead`)
      
      await loggedStorage.close()
      await unloggedStorage.close()
    })

    it('should compare batch operation performance', async () => {
      console.log('\n=== BATCH OPERATION PERFORMANCE ===\n')
      
      const batchSize = 10000
      const groupId = brand.groupId('batch-test')
      
      // Prepare batch data
      const operations = []
      for (let i = 0; i < batchSize; i++) {
        operations.push({
          networkId,
          groupId,
          contactId: brand.contactId(`batch-${i}`),
          content: { value: i, data: `Item ${i}` }
        })
      }
      
      // Test 1: Full durability batch
      console.log('1. Full Durability Batch:')
      const loggedStorage = createAppendOnlyStorage('production')
      await loggedStorage.initialize()
      
      const loggedBatchStart = performance.now()
      await loggedStorage.batchAppend(operations)
      const loggedBatchTime = performance.now() - loggedBatchStart
      
      console.log(`  Time: ${loggedBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(loggedBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(loggedBatchTime/1000)).toLocaleString()}`)
      
      // Test 2: Performance mode batch
      console.log('\n2. Performance Mode Batch:')
      const unloggedStorage = createAppendOnlyStorage('development')
      await unloggedStorage.initialize()
      
      const unloggedBatchStart = performance.now()
      await unloggedStorage.batchAppend(operations.map(op => ({
        ...op,
        contactId: brand.contactId(`batch-unlogged-${op.contactId}`)
      })))
      const unloggedBatchTime = performance.now() - unloggedBatchStart
      
      console.log(`  Time: ${unloggedBatchTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(unloggedBatchTime/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(unloggedBatchTime/1000)).toLocaleString()}`)
      
      // Comparison
      console.log('\n=== BATCH COMPARISON ===')
      const batchSpeedup = (loggedBatchTime / unloggedBatchTime).toFixed(1)
      console.log(`UNLOGGED batch is ${batchSpeedup}x faster than LOGGED`)
      console.log(`Durability cost for batches: ${((loggedBatchTime - unloggedBatchTime) / unloggedBatchTime * 100).toFixed(0)}% overhead`)
      
      await loggedStorage.close()
      await unloggedStorage.close()
    })

    it('should verify durability differences', async () => {
      console.log('\n=== DURABILITY VERIFICATION ===\n')
      
      const client = await pool.connect()
      
      // Check table persistence settings
      const tableInfo = await client.query(`
        SELECT 
          c.relname as table_name,
          CASE c.relpersistence 
            WHEN 'p' THEN 'LOGGED (Durable)'
            WHEN 'u' THEN 'UNLOGGED (Not Durable)'
          END as durability,
          pg_size_pretty(pg_total_relation_size(c.oid)) as size,
          (SELECT COUNT(*) FROM pg_stat_user_tables s WHERE s.relid = c.oid) as has_stats
        FROM pg_class c
        WHERE c.relname IN ('bassline_contact_values', 'bassline_contact_values_fast')
        ORDER BY c.relname
      `)
      
      console.log('Table Durability Settings:')
      for (const row of tableInfo.rows) {
        console.log(`  ${row.table_name}:`)
        console.log(`    Durability: ${row.durability}`)
        console.log(`    Size: ${row.size}`)
      }
      
      // Check actual data counts
      const counts = await client.query(`
        SELECT 
          'LOGGED' as type,
          COUNT(*) as count
        FROM bassline_contact_values
        UNION ALL
        SELECT 
          'UNLOGGED' as type,
          COUNT(*) as count
        FROM bassline_contact_values_fast
      `)
      
      console.log('\nData Distribution:')
      for (const row of counts.rows) {
        console.log(`  ${row.type} table: ${row.count} records`)
      }
      
      console.log('\n=== KEY DIFFERENCES ===')
      console.log('LOGGED tables:')
      console.log('  ✅ Survive database crashes')
      console.log('  ✅ Support point-in-time recovery')
      console.log('  ✅ Can be replicated')
      console.log('  ❌ Slower writes (WAL overhead)')
      
      console.log('\nUNLOGGED tables:')
      console.log('  ❌ Data lost on crash')
      console.log('  ❌ No replication support')
      console.log('  ❌ No point-in-time recovery')
      console.log('  ✅ Much faster writes (no WAL)')
      
      console.log('\n=== RECOMMENDATION ===')
      console.log('Production: Use LOGGED (durability="full")')
      console.log('Development/Test: Use UNLOGGED (durability="performance")')
      console.log('Propagation Networks: Either works due to self-healing nature!')
      
      client.release()
    })
  })
})