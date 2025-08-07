import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NormalizedPostgresStorage } from '../normalized-storage'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId, GroupState } from '@bassline/core'
import { Pool } from 'pg'

// Performance tracking utilities
class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map()
  
  start(name: string): () => void {
    const startTime = performance.now()
    return () => {
      const duration = performance.now() - startTime
      if (!this.metrics.has(name)) {
        this.metrics.set(name, [])
      }
      this.metrics.get(name)!.push(duration)
    }
  }
  
  getStats(name: string) {
    const times = this.metrics.get(name) || []
    if (times.length === 0) return null
    
    const sorted = [...times].sort((a, b) => a - b)
    return {
      count: times.length,
      total: times.reduce((a, b) => a + b, 0),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }
  
  printReport() {
    console.log('\n=== Performance Analysis Report ===\n')
    
    for (const [name, times] of this.metrics) {
      const stats = this.getStats(name)
      if (!stats) continue
      
      console.log(`${name}:`)
      console.log(`  Calls: ${stats.count}`)
      console.log(`  Total: ${stats.total.toFixed(2)}ms`)
      console.log(`  Avg: ${stats.avg.toFixed(2)}ms`)
      console.log(`  Min: ${stats.min.toFixed(2)}ms`)
      console.log(`  Max: ${stats.max.toFixed(2)}ms`)
      console.log(`  P50: ${stats.p50.toFixed(2)}ms`)
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`)
      console.log(`  P99: ${stats.p99.toFixed(2)}ms`)
      console.log()
    }
  }
}

describe('Performance Analysis', () => {
  let storage: NormalizedPostgresStorage
  let networkId: NetworkId
  let tracker: PerformanceTracker
  let pool: Pool
  
  beforeAll(async () => {
    tracker = new PerformanceTracker()
    
    storage = new NormalizedPostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 50,
      },
      limits: {
        maxContactsPerGroup: 10000,
        maxGroupsPerNetwork: 1000,
        maxContentSizeBytes: 100 * 1024
      }
    })
    
    // Direct pool for query analysis
    pool = new Pool({
      database: 'bassline_test',
      max: 5
    })
    
    const initResult = await storage.initialize()
    if (!initResult.ok) {
      throw new Error(`Failed to initialize storage: ${initResult.error.message}`)
    }
    
    networkId = brand.networkId('perf-analysis-network')
    
    // Create the network
    const networkState = {
      groups: new Map(),
      rootGroup: brand.groupId('root')
    }
    await storage.saveNetworkState(networkId, networkState)
  })
  
  afterAll(async () => {
    tracker.printReport()
    
    if (process.env.CLEAN_TEST_DB === 'true') {
      await storage.deleteNetwork(networkId)
    }
    await storage.close()
    await pool.end()
  })

  describe('Insert Performance Breakdown', () => {
    it('should analyze different insert sizes', async () => {
      const sizes = [1, 10, 100, 500, 1000, 2000]
      
      console.log('\n=== Insert Size Analysis ===\n')
      
      for (const size of sizes) {
        const groupId = brand.groupId(`size-test-${size}`)
        const contacts = new Map()
        
        // Prepare data
        const prepEnd = tracker.start('data-preparation')
        for (let i = 0; i < size; i++) {
          contacts.set(brand.contactId(`contact-${i}`), {
            content: {
              id: i,
              value: Math.random(),
              timestamp: Date.now()
            }
          })
        }
        prepEnd()
        
        // Serialize data
        const serializeEnd = tracker.start('serialization')
        const groupState: GroupState = {
          contacts,
          wires: new Map(),
          boundaryContacts: {
            input: new Map(),
            output: new Map()
          }
        }
        serializeEnd()
        
        // Save to database
        const saveEnd = tracker.start(`save-${size}-contacts`)
        const result = await storage.saveGroupState(networkId, groupId, groupState)
        saveEnd()
        
        expect(result.ok).toBe(true)
        
        const time = tracker.getStats(`save-${size}-contacts`)?.avg || 0
        const timePerContact = time / size
        console.log(`${size} contacts: ${time.toFixed(2)}ms total, ${timePerContact.toFixed(3)}ms per contact`)
      }
    })

    it('should analyze transaction vs non-transaction performance', async () => {
      console.log('\n=== Transaction Analysis ===\n')
      
      // Test with transaction (current implementation)
      const transactionGroup = brand.groupId('transaction-test')
      const contacts = new Map()
      for (let i = 0; i < 100; i++) {
        contacts.set(brand.contactId(`tx-contact-${i}`), {
          content: { value: i }
        })
      }
      
      const txEnd = tracker.start('with-transaction')
      await storage.saveGroupState(networkId, transactionGroup, {
        contacts,
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      txEnd()
      
      console.log(`With transaction: ${tracker.getStats('with-transaction')?.avg.toFixed(2)}ms`)
    })

    it('should profile individual operation costs', async () => {
      console.log('\n=== Operation Breakdown ===\n')
      
      const groupId = brand.groupId('profile-group')
      
      // Profile individual operations
      const client = await pool.connect()
      
      try {
        // 1. Group insert
        const groupEnd = tracker.start('insert-group')
        await client.query(`
          INSERT INTO bassline_groups_v2 (network_id, group_id, group_type)
          VALUES ($1, $2, 'standard')
          ON CONFLICT DO NOTHING
        `, [networkId, groupId])
        groupEnd()
        
        // 2. Single contact insert
        const singleEnd = tracker.start('insert-single-contact')
        await client.query(`
          INSERT INTO bassline_contacts_v2 (network_id, group_id, contact_id)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [networkId, groupId, brand.contactId('single')])
        singleEnd()
        
        // 3. Batch contact insert (100)
        const batchData = []
        for (let i = 0; i < 100; i++) {
          batchData.push([networkId, groupId, brand.contactId(`batch-${i}`), 'standard', 'accept-last'])
        }
        
        const batchEnd = tracker.start('insert-100-contacts-batch')
        const values = batchData.map((_, i) => 
          `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`
        ).join(',')
        
        await client.query(`
          INSERT INTO bassline_contacts_v2 (network_id, group_id, contact_id, contact_type, blend_mode)
          VALUES ${values}
          ON CONFLICT DO NOTHING
        `, batchData.flat())
        batchEnd()
        
        // 4. Content insert
        const contentEnd = tracker.start('insert-content')
        await client.query(`
          INSERT INTO bassline_contact_content (network_id, group_id, contact_id, content_type, content_value)
          VALUES ($1, $2, $3, 'json', $4)
          ON CONFLICT DO NOTHING
        `, [networkId, groupId, brand.contactId('content-test'), '{"value": 123}'])
        contentEnd()
        
      } finally {
        client.release()
      }
    })
  })

  describe('Query Performance Analysis', () => {
    it('should analyze query performance with different data sizes', async () => {
      console.log('\n=== Query Performance ===\n')
      
      // First, create groups with varying sizes
      const groupSizes = [10, 100, 1000, 5000]
      const testGroups: GroupId[] = []
      
      for (const size of groupSizes) {
        const groupId = brand.groupId(`query-test-${size}`)
        testGroups.push(groupId)
        
        const contacts = new Map()
        for (let i = 0; i < size; i++) {
          contacts.set(brand.contactId(`q-${size}-${i}`), {
            content: { 
              value: i,
              size: size,
              data: 'x'.repeat(10)
            }
          })
        }
        
        await storage.saveGroupState(networkId, groupId, {
          contacts,
          wires: new Map(),
          boundaryContacts: { input: new Map(), output: new Map() }
        })
      }
      
      // Now test query performance
      for (const groupId of testGroups) {
        const size = parseInt(groupId.match(/\d+/)![0])
        
        // Load full group
        const loadEnd = tracker.start(`load-group-${size}`)
        const result = await storage.loadGroupState(networkId, groupId)
        loadEnd()
        
        if (result.ok && result.value) {
          console.log(`Load ${size} contacts: ${tracker.getStats(`load-group-${size}`)?.avg.toFixed(2)}ms`)
        }
      }
    })

    it('should analyze index effectiveness', async () => {
      console.log('\n=== Index Effectiveness ===\n')
      
      // Query with index (by network_id and group_id)
      const indexedEnd = tracker.start('indexed-query')
      await pool.query(`
        SELECT * FROM bassline_contacts_v2
        WHERE network_id = $1 AND group_id = $2
        LIMIT 100
      `, [networkId, brand.groupId('query-test-1000')])
      indexedEnd()
      
      // Query without optimal index (just by contact_id)
      const unindexedEnd = tracker.start('less-optimal-query')
      await pool.query(`
        SELECT * FROM bassline_contacts_v2
        WHERE contact_id LIKE 'q-1000-%'
        LIMIT 100
      `, [])
      unindexedEnd()
      
      console.log(`Indexed query: ${tracker.getStats('indexed-query')?.avg.toFixed(2)}ms`)
      console.log(`Less optimal query: ${tracker.getStats('less-optimal-query')?.avg.toFixed(2)}ms`)
    })
  })

  describe('Concurrent Operation Analysis', () => {
    it('should analyze concurrent write performance', async () => {
      console.log('\n=== Concurrent Write Analysis ===\n')
      
      const concurrencyLevels = [1, 10, 50, 100, 200]
      
      for (const level of concurrencyLevels) {
        const promises = []
        
        const concurrentEnd = tracker.start(`concurrent-${level}`)
        
        for (let i = 0; i < level; i++) {
          promises.push(
            storage.saveContactContent(
              networkId,
              brand.groupId('concurrent-test'),
              brand.contactId(`concurrent-${level}-${i}`),
              { value: i, level: level }
            )
          )
        }
        
        await Promise.all(promises)
        concurrentEnd()
        
        const stats = tracker.getStats(`concurrent-${level}`)
        console.log(`${level} concurrent writes: ${stats?.avg.toFixed(2)}ms total, ${((stats?.avg || 0) / level).toFixed(3)}ms per operation`)
      }
    })
  })

  describe('Bottleneck Identification', () => {
    it('should identify primary bottlenecks', async () => {
      console.log('\n=== Bottleneck Analysis ===\n')
      
      // Test various potential bottlenecks
      const groupId = brand.groupId('bottleneck-test')
      
      // 1. JSON serialization cost
      const bigObject = {
        data: Array(100).fill(0).map((_, i) => ({
          id: i,
          value: Math.random(),
          nested: { a: 1, b: 2, c: 3 }
        }))
      }
      
      const jsonEnd = tracker.start('json-serialization')
      for (let i = 0; i < 100; i++) {
        JSON.stringify(bigObject)
      }
      jsonEnd()
      
      // 2. Network round trip
      const networkEnd = tracker.start('network-roundtrip')
      await pool.query('SELECT 1')
      networkEnd()
      
      // 3. Complex query
      const complexEnd = tracker.start('complex-query')
      await pool.query(`
        SELECT 
          g.group_id,
          COUNT(c.contact_id) as contact_count,
          SUM(cc.content_size) as total_size
        FROM bassline_groups_v2 g
        LEFT JOIN bassline_contacts_v2 c ON g.network_id = c.network_id AND g.group_id = c.group_id
        LEFT JOIN bassline_contact_content cc ON c.network_id = cc.network_id AND c.group_id = cc.group_id AND c.contact_id = cc.contact_id
        WHERE g.network_id = $1
        GROUP BY g.group_id
        LIMIT 10
      `, [networkId])
      complexEnd()
      
      // 4. Transaction overhead
      const client = await pool.connect()
      const txOverheadEnd = tracker.start('transaction-overhead')
      await client.query('BEGIN')
      await client.query('SELECT 1')
      await client.query('COMMIT')
      txOverheadEnd()
      client.release()
      
      console.log(`JSON serialization (100x): ${tracker.getStats('json-serialization')?.avg.toFixed(2)}ms`)
      console.log(`Network roundtrip: ${tracker.getStats('network-roundtrip')?.avg.toFixed(2)}ms`)
      console.log(`Complex query: ${tracker.getStats('complex-query')?.avg.toFixed(2)}ms`)
      console.log(`Transaction overhead: ${tracker.getStats('transaction-overhead')?.avg.toFixed(2)}ms`)
    })
  })
})