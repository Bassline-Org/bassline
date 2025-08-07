import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'

describe('Ultimate Performance Test - All Optimizations', () => {
  let pool: Pool
  let networkId: NetworkId
  
  beforeAll(async () => {
    pool = new Pool({ 
      database: 'bassline_test', 
      max: 50,
      // Connection optimizations
      statement_timeout: 5000,
      idle_in_transaction_session_timeout: 10000
    })
    
    networkId = brand.networkId('ultimate-test')
    
    // Set aggressive performance settings for this session
    const client = await pool.connect()
    await client.query(`
      SET synchronous_commit = OFF;
      SET work_mem = '256MB';
      SET maintenance_work_mem = '1GB';
    `)
    client.release()
  })
  
  afterAll(async () => {
    await pool.end()
  })

  describe('Comparison: Traditional vs Normalized vs Append-Only vs Unlogged', () => {
    it('should compare all storage approaches', async () => {
      const iterations = 10000
      const groupId = brand.groupId('comparison-test')
      const contactId = brand.contactId('test-contact')
      
      console.log('\n=== ULTIMATE PERFORMANCE COMPARISON ===')
      console.log(`Testing ${iterations} sequential updates to same contact\n`)
      
      // 1. Traditional JSONB approach (simulated with UPDATE)
      console.log('1. Traditional JSONB (UPDATE with large payload):')
      const client1 = await pool.connect()
      
      // Setup traditional table
      await client1.query(`
        CREATE TEMP TABLE IF NOT EXISTS traditional_test (
          id TEXT PRIMARY KEY,
          data JSONB
        )
      `)
      await client1.query(`INSERT INTO traditional_test VALUES ($1, $2)`, [
        contactId, JSON.stringify({ value: 0 })
      ])
      
      const traditionalStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await client1.query(
          `UPDATE traditional_test SET data = $1 WHERE id = $2`,
          [JSON.stringify({ value: i, timestamp: Date.now() }), contactId]
        )
      }
      const traditionalTime = performance.now() - traditionalStart
      client1.release()
      
      console.log(`  Time: ${traditionalTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(traditionalTime/iterations).toFixed(4)}ms`)
      
      // 2. Normalized approach (INSERT with ON CONFLICT UPDATE)
      console.log('\n2. Normalized (ON CONFLICT DO UPDATE):')
      const client2 = await pool.connect()
      
      // Ensure network and group exist
      await client2.query(`
        INSERT INTO bassline_networks (network_id)
        VALUES ($1)
        ON CONFLICT DO NOTHING
      `, [networkId])
      
      await client2.query(`
        INSERT INTO bassline_groups_v2 (network_id, group_id, group_type)
        VALUES ($1, $2, 'standard')
        ON CONFLICT DO NOTHING
      `, [networkId, groupId])
      
      const normalizedStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await client2.query(`
          INSERT INTO bassline_contacts_v2 (network_id, group_id, contact_id)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [networkId, groupId, contactId])
        
        await client2.query(`
          INSERT INTO bassline_contact_content (network_id, group_id, contact_id, content_type, content_value)
          VALUES ($1, $2, $3, 'json', $4)
          ON CONFLICT (network_id, group_id, contact_id)
          DO UPDATE SET content_value = $4, updated_at = NOW()
        `, [networkId, groupId, contactId, JSON.stringify({ value: i })])
      }
      const normalizedTime = performance.now() - normalizedStart
      client2.release()
      
      console.log(`  Time: ${normalizedTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(normalizedTime/iterations).toFixed(4)}ms`)
      console.log(`  Improvement over traditional: ${((1 - normalizedTime/traditionalTime) * 100).toFixed(1)}%`)
      
      // 3. Append-only approach (INSERT only)
      console.log('\n3. Append-Only (INSERT only, no UPDATE):')
      const client3 = await pool.connect()
      
      const appendStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await client3.query(
          `SELECT append_contact_value($1, $2, $3, $4)`,
          [networkId, groupId, contactId, JSON.stringify({ value: i })]
        )
      }
      const appendTime = performance.now() - appendStart
      client3.release()
      
      console.log(`  Time: ${appendTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(appendTime/iterations).toFixed(4)}ms`)
      console.log(`  Improvement over traditional: ${((1 - appendTime/traditionalTime) * 100).toFixed(1)}%`)
      console.log(`  Improvement over normalized: ${((1 - appendTime/normalizedTime) * 100).toFixed(1)}%`)
      
      // 4. Unlogged append-only (maximum speed)
      console.log('\n4. Unlogged Append-Only (INSERT to unlogged tables):')
      const client4 = await pool.connect()
      
      const unloggedStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await client4.query(
          `SELECT append_value_unlogged($1, $2, $3, $4)`,
          [networkId, groupId, `${contactId}-unlogged`, JSON.stringify({ value: i })]
        )
      }
      const unloggedTime = performance.now() - unloggedStart
      client4.release()
      
      console.log(`  Time: ${unloggedTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(unloggedTime/iterations).toFixed(4)}ms`)
      console.log(`  Improvement over traditional: ${((1 - unloggedTime/traditionalTime) * 100).toFixed(1)}%`)
      console.log(`  Improvement over normalized: ${((1 - unloggedTime/normalizedTime) * 100).toFixed(1)}%`)
      console.log(`  Improvement over append-only: ${((1 - unloggedTime/appendTime) * 100).toFixed(1)}%`)
    })

    it('should test batch operations at scale', async () => {
      const batchSize = 10000
      
      console.log('\n=== BATCH OPERATIONS COMPARISON ===')
      console.log(`Inserting ${batchSize} contacts in a single batch\n`)
      
      // Prepare batch data
      const batchData = []
      for (let i = 0; i < batchSize; i++) {
        batchData.push({
          network_id: networkId,
          group_id: brand.groupId('batch-test'),
          contact_id: brand.contactId(`batch-${i}`),
          content_value: JSON.stringify({ 
            value: i, 
            data: `Contact ${i}`,
            timestamp: Date.now() 
          }),
          content_type: 'json'
        })
      }
      
      // 1. Batch with append-only function
      console.log('1. Batch Append (optimized function):')
      const client1 = await pool.connect()
      
      const batchAppendStart = performance.now()
      await client1.query(
        `SELECT batch_append_values($1::jsonb[])`,
        [batchData]
      )
      const batchAppendTime = performance.now() - batchAppendStart
      client1.release()
      
      console.log(`  Time: ${batchAppendTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(batchAppendTime/batchSize).toFixed(4)}ms`)
      console.log(`  Operations per second: ${Math.round(batchSize/(batchAppendTime/1000)).toLocaleString()}`)
      
      // 2. Batch with unlogged tables
      console.log('\n2. Batch Unlogged (ultra-fast):')
      const client2 = await pool.connect()
      
      const batchUnloggedStart = performance.now()
      await client2.query(
        `SELECT batch_append_unlogged($1::jsonb[])`,
        [batchData.map(d => ({ ...d, contact_id: `${d.contact_id}-unlogged` }))]
      )
      const batchUnloggedTime = performance.now() - batchUnloggedStart
      client2.release()
      
      console.log(`  Time: ${batchUnloggedTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(batchUnloggedTime/batchSize).toFixed(4)}ms`)
      console.log(`  Operations per second: ${Math.round(batchSize/(batchUnloggedTime/1000)).toLocaleString()}`)
    })

    it('should test concurrent operations without contention', async () => {
      const concurrency = 1000
      const contactId = brand.contactId('concurrent-test')
      
      console.log('\n=== CONCURRENT OPERATIONS (${concurrency} parallel) ===\n')
      
      // Append-only approach - zero contention
      console.log('Append-Only Concurrent Updates:')
      const promises = []
      
      const concurrentStart = performance.now()
      for (let i = 0; i < concurrency; i++) {
        promises.push(
          pool.query(
            `SELECT append_contact_value($1, $2, $3, $4)`,
            [networkId, brand.groupId('concurrent'), contactId, JSON.stringify({ value: i, thread: i })]
          )
        )
      }
      await Promise.all(promises)
      const concurrentTime = performance.now() - concurrentStart
      
      console.log(`  Time: ${concurrentTime.toFixed(2)}ms`)
      console.log(`  Per operation: ${(concurrentTime/concurrency).toFixed(4)}ms`)
      console.log(`  Operations per second: ${Math.round(concurrency/(concurrentTime/1000)).toLocaleString()}`)
    })

    it('should show table statistics', async () => {
      console.log('\n=== TABLE PERFORMANCE METRICS ===\n')
      
      const client = await pool.connect()
      
      // Get table performance stats
      const stats = await client.query(`
        SELECT * FROM bassline_table_performance
        WHERE tablename IN (
          'bassline_contact_values',
          'bassline_contact_values_fast',
          'bassline_contact_versions',
          'bassline_contact_versions_fast'
        )
        ORDER BY tablename
      `)
      
      console.log('Table Statistics:')
      for (const row of stats.rows) {
        console.log(`\n${row.tablename}:`)
        console.log(`  Logging: ${row.logging_mode}`)
        console.log(`  Size: ${row.size}`)
        console.log(`  Inserts: ${row.inserts || 0}`)
        console.log(`  Updates: ${row.updates || 0}`)
        console.log(`  Update ratio: ${row.update_ratio_pct || 0}%`)
      }
      
      // Get append-only stats
      const appendStats = await client.query(`SELECT * FROM bassline_append_stats`)
      
      if (appendStats.rows.length > 0) {
        const s = appendStats.rows[0]
        console.log('\nAppend-Only Statistics:')
        console.log(`  Total values: ${s.total_values}`)
        console.log(`  Active values: ${s.active_values}`)
        console.log(`  Subsumed values: ${s.subsumed_values}`)
        console.log(`  Table size: ${s.table_size}`)
        console.log(`  Max version: ${s.max_version}`)
      }
      
      client.release()
    })
  })
})