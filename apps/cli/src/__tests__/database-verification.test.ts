/**
 * Database Verification Test
 * Verify what actually gets persisted to PostgreSQL
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BasslineNetwork } from '../bassline/BasslineNetwork.js'
import { BasslineGossip } from '../bassline/BasslineGossip.js'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { brand } from '@bassline/core'
import type { Bassline } from '../bassline/types.js'
import { Pool } from 'pg'

describe('Database Verification', () => {
  let pool: Pool
  
  beforeEach(async () => {
    pool = new Pool({ database: 'bassline_test', max: 5 })
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE IF EXISTS bassline_networks CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_groups CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_contacts CASCADE;
    `).catch(() => {})
    client.release()
  })
  
  afterEach(async () => {
    await pool?.end()
  })
  
  it('should correctly persist updates to PostgreSQL', async () => {
    console.log('\n=== DATABASE PERSISTENCE VERIFICATION ===\n')
    
    // Create simple network
    const bassline: Bassline = {
      id: 'db-test',
      version: '1.0.0',
      topology: {
        groups: new Map([
          ['g1', { 
            id: brand.groupId('g1'), 
            name: 'Group 1',
            inputs: [],
            outputs: ['c1', 'c2', 'c3']
          }]
        ]),
        contacts: new Map([
          ['c1', { id: brand.contactId('c1'), groupId: brand.groupId('g1'), blendMode: 'accept-last' }],
          ['c2', { id: brand.contactId('c2'), groupId: brand.groupId('g1'), blendMode: 'accept-last' }],
          ['c3', { id: brand.contactId('c3'), groupId: brand.groupId('g1'), blendMode: 'accept-last' }]
        ]),
        wires: new Map()
      },
      endpoints: new Map(),
      subBasslines: new Map(),
      metadata: { created: new Date(), modified: new Date(), author: 'test' }
    }
    
    const storage = createPostgresStorage({ 
      options: { database: 'bassline_test' },
      durability: 'standard'
    })
    
    const node = new BasslineNetwork({
      peerId: 'db-node',
      endpoint: { url: 'ws://localhost:30000', peerId: 'db-node' },
      storage
    })
    
    await node.joinNetwork(bassline, ['g1'])
    
    console.log('📝 SENDING UPDATES')
    console.log('-------------------')
    
    // Send 100 updates to same 3 contacts
    const updateCount = 100
    const startTime = Date.now()
    
    for (let i = 0; i < updateCount; i++) {
      const contactId = `c${(i % 3) + 1}`
      await node.updateContact(contactId, {
        iteration: i,
        timestamp: Date.now(),
        data: `Update number ${i} to contact ${contactId}`
      })
      
      if ((i + 1) % 20 === 0) {
        console.log(`  Sent ${i + 1} updates...`)
      }
    }
    
    const duration = Date.now() - startTime
    const throughput = (updateCount * 1000 / duration).toFixed(0)
    
    console.log(`\n✅ Sent ${updateCount} updates in ${duration}ms`)
    console.log(`📊 Throughput: ${throughput} updates/sec`)
    
    // Wait for all pending operations to complete
    await node.waitForPendingOperations()
    
    console.log('\n💾 DATABASE STATE')
    console.log('------------------')
    
    // Check what's in the database
    const client = await pool.connect()
    
    const contactResult = await client.query(`
      SELECT COUNT(*) as total_contacts 
      FROM bassline_contacts 
      WHERE network_id = 'db-test'
    `)
    
    const contentResult = await client.query(`
      SELECT contact_id, content->>'iteration' as last_iteration
      FROM bassline_contacts 
      WHERE network_id = 'db-test' AND content IS NOT NULL
      ORDER BY contact_id
    `)
    
    const updateHistoryResult = await client.query(`
      SELECT contact_id, COUNT(*) as update_count
      FROM bassline_contacts
      WHERE network_id = 'db-test'
      GROUP BY contact_id
    `)
    
    client.release()
    
    console.log(`  Total contacts in DB: ${contactResult.rows[0].total_contacts}`)
    console.log(`  Final values:`)
    contentResult.rows.forEach(row => {
      console.log(`    ${row.contact_id}: iteration ${row.last_iteration}`)
    })
    
    console.log('\n📈 SUMMARY')
    console.log('-----------')
    console.log(`  Updates sent: ${updateCount}`)
    console.log(`  Throughput: ${throughput} updates/sec`)
    console.log(`  Unique contacts in DB: ${contactResult.rows[0].total_contacts}`)
    console.log(`  Updates per contact: ~${Math.floor(updateCount / 3)}`)
    console.log()
    console.log('  ℹ️  Note: Each update OVERWRITES the previous value.')
    console.log('  The throughput measures UPDATE OPERATIONS, not unique values.')
    
    expect(parseInt(contactResult.rows[0]?.total_contacts || '0')).toBe(3) // All 3 contacts should persist
    expect(parseInt(throughput)).toBeGreaterThan(100)
    
    // Check that last values are from recent updates
    contentResult.rows.forEach(row => {
      const lastIteration = parseInt(row.last_iteration)
      expect(lastIteration).toBeGreaterThanOrEqual(90) // Should be from final updates (97, 98, 99)
    })
    
    await node.shutdown()
  })
  
  it('should show the difference between updates and unique values', async () => {
    console.log('\n=== UPDATES vs UNIQUE VALUES ===\n')
    
    const storage = createPostgresStorage({ 
      options: { database: 'bassline_test' },
      durability: 'performance'
    })
    
    // Track metrics
    let totalUpdates = 0
    let uniqueContacts = new Set<string>()
    
    // Create a simple bassline
    const bassline: Bassline = {
      id: 'metrics-test',
      version: '1.0.0',
      topology: {
        groups: new Map([
          ['group', { 
            id: brand.groupId('group'), 
            name: 'Group',
            inputs: [],
            outputs: ['out1', 'out2']
          }]
        ]),
        contacts: new Map([
          ['out1', { id: brand.contactId('out1'), groupId: brand.groupId('group'), blendMode: 'accept-last' }],
          ['out2', { id: brand.contactId('out2'), groupId: brand.groupId('group'), blendMode: 'accept-last' }]
        ]),
        wires: new Map()
      },
      endpoints: new Map(),
      subBasslines: new Map(),
      metadata: { created: new Date(), modified: new Date(), author: 'test' }
    }
    
    const node = new BasslineNetwork({
      peerId: 'metrics-node',
      endpoint: { url: 'ws://localhost:30001', peerId: 'metrics-node' },
      storage
    })
    
    await node.joinNetwork(bassline, ['group'])
    
    console.log('📊 METRICS DEMONSTRATION')
    console.log('------------------------')
    
    // Send many updates to same contacts
    const startTime = Date.now()
    
    for (let i = 0; i < 1000; i++) {
      const contactId = i % 2 === 0 ? 'out1' : 'out2'
      await node.updateContact(contactId, {
        update: i,
        timestamp: Date.now()
      })
      totalUpdates++
      uniqueContacts.add(contactId)
    }
    
    const duration = Date.now() - startTime
    const throughput = (totalUpdates * 1000 / duration).toFixed(0)
    
    console.log(`  Total update operations: ${totalUpdates}`)
    console.log(`  Unique contacts updated: ${uniqueContacts.size}`)
    console.log(`  Throughput: ${throughput} updates/sec`)
    console.log(`  Time taken: ${duration}ms`)
    console.log()
    console.log(`  📌 Key insight:`)
    console.log(`     - We sent ${totalUpdates} UPDATE OPERATIONS`)
    console.log(`     - But only have ${uniqueContacts.size} UNIQUE CONTACTS in the database`)
    console.log(`     - Each contact was updated ~${Math.floor(totalUpdates/uniqueContacts.size)} times`)
    console.log()
    
    await node.shutdown()
    
    expect(totalUpdates).toBe(1000)
    expect(uniqueContacts.size).toBe(2)
  })
  
  it('should demonstrate mass contact creation vs repeated updates', async () => {
    console.log('\n=== MASS CONTACT CREATION TEST (PARALLEL) ===\n')
    
    const storage = createPostgresStorage({ 
      options: { database: 'bassline_test' },
      durability: 'performance'
    })
    
    // Create a dynamic bassline that allows creating many contacts
    const groups = new Map()
    const contacts = new Map()
    
    // Create multiple groups with many contacts
    const groupCount = 10
    const contactsPerGroup = 100
    
    for (let g = 0; g < groupCount; g++) {
      const groupId = `group-${g}`
      const outputContacts = []
      
      // Create many contacts for this group
      for (let c = 0; c < contactsPerGroup; c++) {
        const contactId = `${groupId}-contact-${c}`
        outputContacts.push(contactId)
        
        contacts.set(contactId, {
          id: brand.contactId(contactId),
          groupId: brand.groupId(groupId),
          blendMode: 'accept-last'
        })
      }
      
      groups.set(groupId, {
        id: brand.groupId(groupId),
        name: `Group ${g}`,
        inputs: [],
        outputs: outputContacts
      })
    }
    
    const bassline: Bassline = {
      id: 'mass-contact-test',
      version: '1.0.0',
      topology: { groups, contacts, wires: new Map() },
      endpoints: new Map(),
      subBasslines: new Map(),
      metadata: { created: new Date(), modified: new Date(), author: 'test' }
    }
    
    console.log('📈 TOPOLOGY')
    console.log('-----------')
    console.log(`  Groups: ${groupCount}`)
    console.log(`  Contacts per group: ${contactsPerGroup}`)
    console.log(`  Total contacts: ${contacts.size}`)
    console.log()
    
    const node = new BasslineNetwork({
      peerId: 'mass-node',
      endpoint: { url: 'ws://localhost:30002', peerId: 'mass-node' },
      storage
    })
    
    // Join with all groups
    const groupNames = Array.from(groups.keys())
    await node.joinNetwork(bassline, groupNames)
    
    console.log('🚀 MASS CONTACT UPDATES (PARALLEL BATCHES)')
    console.log('--------------------------------------------')
    
    const startTime = Date.now()
    const batchSize = 100 // Process 100 updates in parallel
    
    // Scenario 1: PARALLEL mass creation - update each contact ONCE
    console.log(`  Scenario 1: Creating ${contacts.size} unique values in parallel batches...`)
    console.log(`  Batch size: ${batchSize} parallel operations`)
    const massCreateStart = Date.now()
    
    const contactIds = Array.from(contacts.keys())
    const createPromises: Promise<void>[] = []
    let updatesCreated = 0
    let uniqueContactsUpdated = new Set<string>()
    
    for (let i = 0; i < contactIds.length; i++) {
      const contactId = contactIds[i]
      
      createPromises.push(
        node.updateContact(contactId, {
          type: 'mass-create',
          contactId,
          value: Math.random(),
          timestamp: Date.now()
        }).then(() => {
          updatesCreated++
          uniqueContactsUpdated.add(contactId)
        }).catch(() => {
          console.warn(`    Failed to create ${contactId}`)
        })
      )
      
      // Process batch when we hit the batch size or at the end
      if (createPromises.length >= batchSize || i === contactIds.length - 1) {
        await Promise.all(createPromises.splice(0))
        process.stdout.write(`    Created ${updatesCreated}/${contacts.size} contacts\r`)
      }
    }
    
    const massCreateTime = Date.now() - massCreateStart
    const massCreateThroughput = (updatesCreated * 1000 / massCreateTime).toFixed(0)
    
    console.log(`    ✓ Created ${updatesCreated} unique values in ${massCreateTime}ms`)
    console.log(`    Throughput: ${massCreateThroughput} creates/sec (parallel)`)
    console.log()
    
    // Scenario 2: PARALLEL repeated updates to same contacts
    console.log('  Scenario 2: Repeatedly updating 10 contacts in parallel...')
    console.log(`  Batch size: ${batchSize} parallel operations`)
    const repeatUpdateStart = Date.now()
    
    const targetContacts = Array.from(contacts.keys()).slice(0, 10)
    const totalRepeatUpdates = 1000
    const repeatPromises: Promise<void>[] = []
    let repeatUpdates = 0
    
    for (let i = 0; i < totalRepeatUpdates; i++) {
      const contactId = targetContacts[i % 10]
      
      repeatPromises.push(
        node.updateContact(contactId, {
          type: 'repeat-update',
          iteration: i,
          timestamp: Date.now()
        }).then(() => {
          repeatUpdates++
        }).catch(() => null)
      )
      
      // Process batch when we hit the batch size or at the end
      if (repeatPromises.length >= batchSize || i === totalRepeatUpdates - 1) {
        await Promise.all(repeatPromises.splice(0))
      }
    }
    
    const repeatUpdateTime = Date.now() - repeatUpdateStart
    const repeatUpdateThroughput = (repeatUpdates * 1000 / repeatUpdateTime).toFixed(0)
    
    console.log(`    ✓ Sent ${repeatUpdates} updates to 10 contacts in ${repeatUpdateTime}ms`)
    console.log(`    Throughput: ${repeatUpdateThroughput} updates/sec (parallel)`)
    console.log()
    
    // Scenario 3: MAXIMUM THROUGHPUT test with larger batches
    console.log('  Scenario 3: Maximum throughput test with 500-parallel batches...')
    const maxThroughputStart = Date.now()
    
    const maxBatchSize = 500
    const totalMaxUpdates = 5000
    const maxPromises: Promise<void>[] = []
    let maxUpdates = 0
    
    console.log(`  Total updates: ${totalMaxUpdates}, Batch size: ${maxBatchSize}`)
    
    for (let i = 0; i < totalMaxUpdates; i++) {
      // Spread updates across all contacts for realistic load
      const contactId = contactIds[i % contactIds.length]
      
      maxPromises.push(
        node.updateContact(contactId, {
          type: 'max-throughput',
          iteration: i,
          timestamp: Date.now(),
          batch: Math.floor(i / maxBatchSize)
        }).then(() => {
          maxUpdates++
        }).catch(() => null)
      )
      
      // Process larger batches for maximum throughput
      if (maxPromises.length >= maxBatchSize || i === totalMaxUpdates - 1) {
        await Promise.all(maxPromises.splice(0))
        process.stdout.write(`    Processed ${maxUpdates}/${totalMaxUpdates} updates\r`)
      }
    }
    
    const maxThroughputTime = Date.now() - maxThroughputStart
    const maxThroughput = (maxUpdates * 1000 / maxThroughputTime).toFixed(0)
    
    console.log(`    ✓ Sent ${maxUpdates} updates in ${maxThroughputTime}ms`)
    console.log(`    Throughput: ${maxThroughput} updates/sec (${maxBatchSize} parallel ops)`)
    console.log()
    
    // Wait for all pending storage operations to complete
    console.log('  Waiting for all pending database operations...')
    await node.waitForPendingOperations()
    
    // Check database state
    console.log('💾 DATABASE ANALYSIS')
    console.log('--------------------')
    
    const client = await pool.connect()
    
    const dbResult = await client.query(`
      SELECT 
        COUNT(DISTINCT contact_id) as unique_contacts,
        COUNT(*) as total_rows
      FROM bassline_contacts 
      WHERE network_id = 'mass-contact-test'
    `)
    
    const sampleContacts = await client.query(`
      SELECT contact_id, content->>'type' as update_type
      FROM bassline_contacts
      WHERE network_id = 'mass-contact-test' 
        AND content IS NOT NULL
      ORDER BY contact_id
      LIMIT 15
    `)
    
    client.release()
    
    const totalTime = Date.now() - startTime
    
    console.log(`  Database state:`)
    console.log(`    - Unique contacts with values: ${dbResult.rows[0].unique_contacts}`)
    console.log(`    - Total database rows: ${dbResult.rows[0].total_rows}`)
    console.log()
    console.log(`  Sample contacts (first 15):`)
    sampleContacts.rows.forEach(row => {
      console.log(`    ${row.contact_id}: ${row.update_type}`)
    })
    console.log()
    
    console.log('📊 COMPARISON')
    console.log('-------------')
    console.log(`  Scenario 1 - Mass Contact Creation (batch=${batchSize}):`)
    console.log(`    - Updates sent: ${updatesCreated}`)
    console.log(`    - Unique contacts: ${uniqueContactsUpdated.size}`)
    console.log(`    - Throughput: ${massCreateThroughput} creates/sec`)
    console.log(`    - Result: ${updatesCreated} UNIQUE VALUES in database`)
    console.log()
    console.log(`  Scenario 2 - Repeated Updates (batch=${batchSize}):`)
    console.log(`    - Updates sent: ${repeatUpdates}`)
    console.log(`    - Unique contacts: 10`)
    console.log(`    - Throughput: ${repeatUpdateThroughput} updates/sec`)
    console.log(`    - Result: Only 10 UNIQUE VALUES (last update wins)`)
    console.log()
    console.log(`  Scenario 3 - Maximum Throughput (batch=${maxBatchSize}):`)
    console.log(`    - Updates sent: ${maxUpdates}`)
    console.log(`    - Throughput: ${maxThroughput} updates/sec`)
    console.log(`    - Result: Updates spread across all ${contacts.size} contacts`)
    console.log()
    console.log(`  💡 KEY INSIGHTS:`)
    console.log(`     • Parallel batching dramatically improves throughput`)
    console.log(`     • Batch size ${batchSize}: ${massCreateThroughput}-${repeatUpdateThroughput} ops/sec`)
    console.log(`     • Batch size ${maxBatchSize}: ${maxThroughput} ops/sec`)
    console.log(`     • Larger batches = higher throughput (but more memory)`)
    console.log(`     • Trade-off: Throughput vs unique values created`)
    console.log()
    console.log(`  Total test time: ${totalTime}ms`)
    
    await node.shutdown()
    
    // Assertions
    expect(parseInt(dbResult.rows[0]?.unique_contacts || '0')).toBeGreaterThanOrEqual(900) // Most contacts should persist (90%+)
    expect(parseInt(massCreateThroughput)).toBeGreaterThan(10000) // Parallel creates should be fast
    expect(parseInt(repeatUpdateThroughput)).toBeGreaterThan(20000) // Parallel updates even faster
    expect(parseInt(maxThroughput)).toBeGreaterThan(50000) // Large batch should be fastest
  })
})