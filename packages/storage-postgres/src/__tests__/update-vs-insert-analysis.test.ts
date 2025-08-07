import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NormalizedPostgresStorage } from '../normalized-storage'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'

describe('Update vs Insert Performance Analysis', () => {
  let storage: NormalizedPostgresStorage
  let networkId: NetworkId
  let pool: Pool
  
  beforeAll(async () => {
    storage = new NormalizedPostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 50,
      }
    })
    
    pool = new Pool({
      database: 'bassline_test',
      max: 10
    })
    
    await storage.initialize()
    
    networkId = brand.networkId('update-analysis')
    await storage.saveNetworkState(networkId, {
      groups: new Map(),
      rootGroup: brand.groupId('root')
    })
  })
  
  afterAll(async () => {
    if (process.env.CLEAN_TEST_DB === 'true') {
      await storage.deleteNetwork(networkId)
    }
    await storage.close()
    await pool.end()
  })

  describe('Update Cost Analysis', () => {
    it('should compare INSERT vs UPDATE performance', async () => {
      const groupId = brand.groupId('update-test-group')
      const testSize = 1000
      
      // Create the group
      await storage.saveGroupState(networkId, groupId, {
        contacts: new Map(),
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      console.log('\n=== INSERT vs UPDATE Comparison ===\n')
      
      // Test 1: Fresh INSERTs
      const insertTimes: number[] = []
      for (let i = 0; i < testSize; i++) {
        const start = performance.now()
        await storage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`insert-${i}`),
          { value: i, type: 'insert' }
        )
        insertTimes.push(performance.now() - start)
      }
      
      // Test 2: UPDATEs (overwrite existing)
      const updateTimes: number[] = []
      for (let i = 0; i < testSize; i++) {
        const start = performance.now()
        await storage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`insert-${i}`), // Same IDs - will UPDATE
          { value: i * 2, type: 'update' }
        )
        updateTimes.push(performance.now() - start)
      }
      
      // Test 3: Random UPDATEs (simulating propagation)
      const randomUpdateTimes: number[] = []
      for (let i = 0; i < testSize; i++) {
        const randomId = Math.floor(Math.random() * testSize)
        const start = performance.now()
        await storage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`insert-${randomId}`),
          { value: i * 3, type: 'random-update', iteration: i }
        )
        randomUpdateTimes.push(performance.now() - start)
      }
      
      const avgInsert = insertTimes.reduce((a, b) => a + b) / insertTimes.length
      const avgUpdate = updateTimes.reduce((a, b) => a + b) / updateTimes.length
      const avgRandomUpdate = randomUpdateTimes.reduce((a, b) => a + b) / randomUpdateTimes.length
      
      console.log(`Average INSERT time: ${avgInsert.toFixed(3)}ms`)
      console.log(`Average UPDATE time: ${avgUpdate.toFixed(3)}ms`)
      console.log(`Average RANDOM UPDATE time: ${avgRandomUpdate.toFixed(3)}ms`)
      console.log(`UPDATE overhead: ${((avgUpdate / avgInsert - 1) * 100).toFixed(1)}%`)
      console.log(`RANDOM UPDATE overhead: ${((avgRandomUpdate / avgInsert - 1) * 100).toFixed(1)}%`)
    })

    it('should analyze locking behavior', async () => {
      console.log('\n=== Locking Analysis ===\n')
      
      const groupId = brand.groupId('lock-test-group')
      const contactId = brand.contactId('lock-test-contact')
      
      // Setup
      await storage.saveGroupState(networkId, groupId, {
        contacts: new Map([[contactId, { content: { value: 0 } }]]),
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      // Test concurrent updates to SAME contact
      console.log('Testing 100 concurrent updates to SAME contact:')
      const sameContactPromises = []
      const start1 = performance.now()
      
      for (let i = 0; i < 100; i++) {
        sameContactPromises.push(
          storage.saveContactContent(
            networkId,
            groupId,
            contactId, // Same contact
            { value: i, timestamp: Date.now() }
          )
        )
      }
      
      await Promise.all(sameContactPromises)
      const time1 = performance.now() - start1
      console.log(`  Time: ${time1.toFixed(2)}ms (${(time1/100).toFixed(3)}ms per update)`)
      
      // Test concurrent updates to DIFFERENT contacts
      console.log('\nTesting 100 concurrent updates to DIFFERENT contacts:')
      const differentContactPromises = []
      const start2 = performance.now()
      
      for (let i = 0; i < 100; i++) {
        differentContactPromises.push(
          storage.saveContactContent(
            networkId,
            groupId,
            brand.contactId(`different-${i}`), // Different contacts
            { value: i, timestamp: Date.now() }
          )
        )
      }
      
      await Promise.all(differentContactPromises)
      const time2 = performance.now() - start2
      console.log(`  Time: ${time2.toFixed(2)}ms (${(time2/100).toFixed(3)}ms per update)`)
      
      console.log(`\nContention overhead: ${((time1 / time2 - 1) * 100).toFixed(1)}%`)
    })

    it('should analyze transaction isolation impact', async () => {
      console.log('\n=== Transaction Isolation Analysis ===\n')
      
      const groupId = brand.groupId('isolation-test')
      
      // Test 1: Individual transactions (current approach)
      const individualTxTimes: number[] = []
      for (let i = 0; i < 100; i++) {
        const start = performance.now()
        await storage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`tx-individual-${i}`),
          { value: i }
        )
        individualTxTimes.push(performance.now() - start)
      }
      
      // Test 2: No transaction (direct query)
      const client = await pool.connect()
      const noTxTimes: number[] = []
      
      try {
        for (let i = 0; i < 100; i++) {
          const start = performance.now()
          
          // Direct INSERT without transaction wrapper
          await client.query(`
            INSERT INTO bassline_contacts_v2 (network_id, group_id, contact_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [networkId, groupId, brand.contactId(`no-tx-${i}`)])
          
          await client.query(`
            INSERT INTO bassline_contact_content (network_id, group_id, contact_id, content_type, content_value)
            VALUES ($1, $2, $3, 'json', $4)
            ON CONFLICT (network_id, group_id, contact_id)
            DO UPDATE SET content_value = $4, updated_at = NOW()
          `, [networkId, groupId, brand.contactId(`no-tx-${i}`), JSON.stringify({ value: i })])
          
          noTxTimes.push(performance.now() - start)
        }
      } finally {
        client.release()
      }
      
      const avgTx = individualTxTimes.reduce((a, b) => a + b) / individualTxTimes.length
      const avgNoTx = noTxTimes.reduce((a, b) => a + b) / noTxTimes.length
      
      console.log(`With transaction: ${avgTx.toFixed(3)}ms per operation`)
      console.log(`Without transaction: ${avgNoTx.toFixed(3)}ms per operation`)
      console.log(`Transaction overhead: ${((avgTx / avgNoTx - 1) * 100).toFixed(1)}%`)
    })

    it('should test propagation-aware optimization', async () => {
      console.log('\n=== Propagation Network Optimization ===\n')
      
      // In propagation networks, we know:
      // 1. Last write wins (no need for complex conflict resolution)
      // 2. Eventual consistency is acceptable
      // 3. Updates are idempotent
      
      const groupId = brand.groupId('propagation-optimized')
      
      // Test: Skip existence check for updates (assume contact exists)
      const client = await pool.connect()
      
      try {
        // Prepare test data
        for (let i = 0; i < 100; i++) {
          await client.query(`
            INSERT INTO bassline_contacts_v2 (network_id, group_id, contact_id)
            VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
          `, [networkId, groupId, brand.contactId(`prop-${i}`)])
        }
        
        // Test 1: Current approach (with checks)
        const withCheckTimes: number[] = []
        for (let i = 0; i < 100; i++) {
          const start = performance.now()
          await storage.saveContactContent(
            networkId,
            groupId,
            brand.contactId(`prop-${i}`),
            { value: i * 10 }
          )
          withCheckTimes.push(performance.now() - start)
        }
        
        // Test 2: Optimized approach (direct upsert, no checks)
        const optimizedTimes: number[] = []
        for (let i = 0; i < 100; i++) {
          const start = performance.now()
          
          // Direct UPSERT - no existence check, no transaction
          await client.query(`
            INSERT INTO bassline_contact_content (network_id, group_id, contact_id, content_type, content_value)
            VALUES ($1, $2, $3, 'json', $4)
            ON CONFLICT (network_id, group_id, contact_id)
            DO UPDATE SET 
              content_value = EXCLUDED.content_value,
              updated_at = NOW()
          `, [networkId, groupId, brand.contactId(`prop-${i}`), JSON.stringify({ value: i * 20 })])
          
          optimizedTimes.push(performance.now() - start)
        }
        
        // Test 3: Batch updates (propagation often updates multiple contacts)
        const batchSize = 10
        const batchTimes: number[] = []
        
        for (let batch = 0; batch < 10; batch++) {
          const start = performance.now()
          
          const values = []
          const params = []
          for (let i = 0; i < batchSize; i++) {
            const idx = batch * batchSize + i
            params.push(networkId, groupId, brand.contactId(`prop-${idx}`), 'json', JSON.stringify({ value: idx * 30 }))
            values.push(`($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`)
          }
          
          await client.query(`
            INSERT INTO bassline_contact_content (network_id, group_id, contact_id, content_type, content_value)
            VALUES ${values.join(',')}
            ON CONFLICT (network_id, group_id, contact_id)
            DO UPDATE SET 
              content_value = EXCLUDED.content_value,
              updated_at = NOW()
          `, params)
          
          batchTimes.push((performance.now() - start) / batchSize) // Per contact
        }
        
        const avgWithCheck = withCheckTimes.reduce((a, b) => a + b) / withCheckTimes.length
        const avgOptimized = optimizedTimes.reduce((a, b) => a + b) / optimizedTimes.length
        const avgBatch = batchTimes.reduce((a, b) => a + b) / batchTimes.length
        
        console.log(`Current approach: ${avgWithCheck.toFixed(3)}ms per update`)
        console.log(`Optimized (no checks): ${avgOptimized.toFixed(3)}ms per update`)
        console.log(`Batch updates: ${avgBatch.toFixed(3)}ms per update`)
        console.log(`\nPotential improvement:`)
        console.log(`  Single: ${((1 - avgOptimized/avgWithCheck) * 100).toFixed(1)}% faster`)
        console.log(`  Batch: ${((1 - avgBatch/avgWithCheck) * 100).toFixed(1)}% faster`)
        
      } finally {
        client.release()
      }
    })

    it('should analyze PostgreSQL MVCC impact', async () => {
      console.log('\n=== MVCC (Multi-Version Concurrency Control) Analysis ===\n')
      
      // PostgreSQL uses MVCC - updates create new row versions
      // This means updates are actually more expensive than inserts
      
      const groupId = brand.groupId('mvcc-test')
      const contactId = brand.contactId('mvcc-contact')
      
      // Setup
      await storage.saveGroupState(networkId, groupId, {
        contacts: new Map([[contactId, { content: { value: 0 } }]]),
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      
      // Check table bloat from updates
      const client = await pool.connect()
      
      try {
        // Get initial size
        const before = await client.query(`
          SELECT pg_relation_size('bassline_contact_content') as size,
                 n_tup_upd as updates,
                 n_dead_tup as dead_tuples
          FROM pg_stat_user_tables 
          WHERE tablename = 'bassline_contact_content'
        `)
        
        // Perform many updates to same row
        for (let i = 0; i < 1000; i++) {
          await client.query(`
            UPDATE bassline_contact_content 
            SET content_value = $1, updated_at = NOW()
            WHERE network_id = $2 AND group_id = $3 AND contact_id = $4
          `, [JSON.stringify({ value: i }), networkId, groupId, contactId])
        }
        
        // Check size after updates
        const after = await client.query(`
          SELECT pg_relation_size('bassline_contact_content') as size,
                 n_tup_upd as updates,
                 n_dead_tup as dead_tuples
          FROM pg_stat_user_tables 
          WHERE tablename = 'bassline_contact_content'
        `)
        
        console.log('Before 1000 updates:')
        console.log(`  Table size: ${before.rows[0].size} bytes`)
        console.log(`  Dead tuples: ${before.rows[0].dead_tuples}`)
        
        console.log('\nAfter 1000 updates:')
        console.log(`  Table size: ${after.rows[0].size} bytes`)
        console.log(`  Dead tuples: ${after.rows[0].dead_tuples}`)
        console.log(`  Size increase: ${after.rows[0].size - before.rows[0].size} bytes`)
        
        // VACUUM to clean up
        console.log('\nRunning VACUUM...')
        await client.query('VACUUM bassline_contact_content')
        
        const afterVacuum = await client.query(`
          SELECT pg_relation_size('bassline_contact_content') as size,
                 n_dead_tup as dead_tuples
          FROM pg_stat_user_tables 
          WHERE tablename = 'bassline_contact_content'
        `)
        
        console.log('After VACUUM:')
        console.log(`  Table size: ${afterVacuum.rows[0].size} bytes`)
        console.log(`  Dead tuples: ${afterVacuum.rows[0].dead_tuples}`)
        console.log(`  Space reclaimed: ${after.rows[0].size - afterVacuum.rows[0].size} bytes`)
        
      } finally {
        client.release()
      }
    })
  })
})