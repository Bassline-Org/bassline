/**
 * Operations Per Second (OPS) Benchmark
 * Tests throughput under various configurations and workloads
 */

import { describe, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { OptimizedPostgresStorage } from '../optimized-storage.js'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'

interface WorkloadResult {
  totalOps: number
  duration: number
  opsPerSecond: number
  avgLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  errors: number
}

class OPSBenchmark {
  private storage: OptimizedPostgresStorage
  private networkId: NetworkId
  
  constructor(storage: OptimizedPostgresStorage, networkId: NetworkId) {
    this.storage = storage
    this.networkId = networkId
  }
  
  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[index] || 0
  }
  
  async runWorkload(
    name: string,
    durationMs: number,
    operation: () => Promise<void>
  ): Promise<WorkloadResult> {
    console.log(`\n  Running: ${name}`)
    
    const startTime = performance.now()
    const endTime = startTime + durationMs
    const latencies: number[] = []
    let completedOps = 0
    let errors = 0
    
    // Run operations for the specified duration
    while (performance.now() < endTime) {
      const opStart = performance.now()
      try {
        await operation()
        completedOps++
        const latency = performance.now() - opStart
        latencies.push(latency)
      } catch (error) {
        errors++
        console.error(`Operation failed: ${error}`)
      }
    }
    
    const actualDuration = performance.now() - startTime
    const opsPerSecond = (completedOps / actualDuration) * 1000
    
    return {
      totalOps: completedOps,
      duration: actualDuration,
      opsPerSecond,
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50Latency: this.percentile(latencies, 50),
      p95Latency: this.percentile(latencies, 95),
      p99Latency: this.percentile(latencies, 99),
      errors
    }
  }
  
  async runParallelWorkload(
    name: string,
    durationMs: number,
    concurrency: number,
    operation: () => Promise<void>
  ): Promise<WorkloadResult> {
    console.log(`\n  Running: ${name} (${concurrency} parallel)`)
    
    const startTime = performance.now()
    const endTime = startTime + durationMs
    const latencies: number[] = []
    let completedOps = 0
    let errors = 0
    
    // Worker function
    const worker = async () => {
      while (performance.now() < endTime) {
        const opStart = performance.now()
        try {
          await operation()
          completedOps++
          const latency = performance.now() - opStart
          latencies.push(latency)
        } catch (error) {
          errors++
        }
      }
    }
    
    // Run workers in parallel
    const workers = Array(concurrency).fill(null).map(() => worker())
    await Promise.all(workers)
    
    const actualDuration = performance.now() - startTime
    const opsPerSecond = (completedOps / actualDuration) * 1000
    
    return {
      totalOps: completedOps,
      duration: actualDuration,
      opsPerSecond,
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50Latency: this.percentile(latencies, 50),
      p95Latency: this.percentile(latencies, 95),
      p99Latency: this.percentile(latencies, 99),
      errors
    }
  }
  
  printResult(name: string, result: WorkloadResult) {
    console.log(`\n  ${name} Results:`)
    console.log(`    Operations/sec: ${result.opsPerSecond.toFixed(0)}`)
    console.log(`    Total operations: ${result.totalOps}`)
    console.log(`    Average latency: ${result.avgLatency.toFixed(2)}ms`)
    console.log(`    P50 latency: ${result.p50Latency.toFixed(2)}ms`)
    console.log(`    P95 latency: ${result.p95Latency.toFixed(2)}ms`)
    console.log(`    P99 latency: ${result.p99Latency.toFixed(2)}ms`)
    if (result.errors > 0) {
      console.log(`    ⚠️  Errors: ${result.errors}`)
    }
  }
}

describe('Operations Per Second Benchmark', () => {
  let storage: OptimizedPostgresStorage
  let pool: Pool
  let networkId: NetworkId
  let benchmark: OPSBenchmark
  const TEST_DURATION = 3000 // 3 seconds per test
  
  beforeAll(async () => {
    storage = new OptimizedPostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 50, // Larger pool for parallel tests
      }
    })
    
    pool = new Pool({
      database: 'bassline_test',
      max: 5
    })
    
    await storage.initialize()
    
    networkId = brand.networkId(`ops-bench-${Date.now()}`)
    await storage.saveNetworkState(networkId, {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    })
    
    benchmark = new OPSBenchmark(storage, networkId)
    
    console.log('\n=== Operations Per Second Benchmark ===')
    console.log(`Test duration: ${TEST_DURATION}ms per workload`)
  })
  
  afterAll(async () => {
    await storage.deleteNetwork(networkId)
    await storage.close()
    await pool.end()
  })
  
  describe('Single Contact Operations', () => {
    it('should measure single contact write OPS', async () => {
      console.log('\n📝 Single Contact Write Operations')
      
      const groupId = brand.groupId('single-write')
      let counter = 0
      
      // Setup group
      await storage.saveGroupState(networkId, groupId, {
        group: {
          id: groupId,
          name: 'Single Write Test',
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map(),
        wires: new Map()
      })
      
      const result = await benchmark.runWorkload(
        'Single contact writes',
        TEST_DURATION,
        async () => {
          await storage.saveContactContent(
            networkId,
            groupId,
            brand.contactId('test-contact'),
            { value: counter++, timestamp: Date.now() }
          )
        }
      )
      
      benchmark.printResult('Single Write', result)
    }, 10000)
    
    it('should measure single contact read OPS', async () => {
      console.log('\n📖 Single Contact Read Operations')
      
      const groupId = brand.groupId('single-read')
      const contactId = brand.contactId('read-contact')
      
      // Setup
      await storage.saveContactContent(
        networkId,
        groupId,
        contactId,
        { value: 'test data', timestamp: Date.now() }
      )
      
      const result = await benchmark.runWorkload(
        'Single contact reads',
        TEST_DURATION,
        async () => {
          await storage.loadContactContent(networkId, groupId, contactId)
        }
      )
      
      benchmark.printResult('Single Read', result)
    }, 10000)
  })
  
  describe('Batch Operations', () => {
    it('should measure batch write OPS (10 contacts per batch)', async () => {
      console.log('\n📦 Batch Write Operations (10 contacts/batch)')
      
      const groupId = brand.groupId('batch-10')
      let batchCounter = 0
      
      const result = await benchmark.runWorkload(
        'Batch writes (10 contacts)',
        TEST_DURATION,
        async () => {
          const contacts = new Map()
          for (let i = 0; i < 10; i++) {
            contacts.set(brand.contactId(`batch-${i}`), {
              id: brand.contactId(`batch-${i}`),
              content: { batch: batchCounter, index: i, timestamp: Date.now() },
              blendMode: 'accept-last'
            })
          }
          
          await storage.batchSaveContacts(networkId, groupId, contacts)
          batchCounter++
        }
      )
      
      benchmark.printResult('Batch-10 Write', result)
      console.log(`    Effective contact writes/sec: ${(result.opsPerSecond * 10).toFixed(0)}`)
    }, 10000)
    
    it('should measure batch write OPS (100 contacts per batch)', async () => {
      console.log('\n📦 Batch Write Operations (100 contacts/batch)')
      
      const groupId = brand.groupId('batch-100')
      let batchCounter = 0
      
      const result = await benchmark.runWorkload(
        'Batch writes (100 contacts)',
        TEST_DURATION,
        async () => {
          const contacts = new Map()
          for (let i = 0; i < 100; i++) {
            contacts.set(brand.contactId(`batch-${i}`), {
              id: brand.contactId(`batch-${i}`),
              content: { batch: batchCounter, index: i },
              blendMode: 'accept-last'
            })
          }
          
          await storage.batchSaveContacts(networkId, groupId, contacts)
          batchCounter++
        }
      )
      
      benchmark.printResult('Batch-100 Write', result)
      console.log(`    Effective contact writes/sec: ${(result.opsPerSecond * 100).toFixed(0)}`)
    }, 10000)
  })
  
  describe('Group Operations', () => {
    it('should measure full group save OPS', async () => {
      console.log('\n👥 Group Save Operations')
      
      let groupCounter = 0
      
      const result = await benchmark.runWorkload(
        'Full group saves (50 contacts)',
        TEST_DURATION,
        async () => {
          const groupId = brand.groupId(`group-${groupCounter++}`)
          const contacts = new Map()
          
          for (let i = 0; i < 50; i++) {
            contacts.set(brand.contactId(`contact-${i}`), {
              id: brand.contactId(`contact-${i}`),
              content: { value: i },
              blendMode: 'accept-last'
            })
          }
          
          await storage.saveGroupState(networkId, groupId, {
            group: {
              id: groupId,
              name: `Group ${groupCounter}`,
              contactIds: Array.from(contacts.keys()),
              wireIds: [],
              subgroupIds: [],
              boundaryContactIds: []
            },
            contacts,
            wires: new Map()
          })
        }
      )
      
      benchmark.printResult('Group Save', result)
    }, 10000)
    
    it('should measure group load OPS', async () => {
      console.log('\n👥 Group Load Operations')
      
      // Setup groups
      const groupIds: GroupId[] = []
      for (let g = 0; g < 10; g++) {
        const groupId = brand.groupId(`load-group-${g}`)
        groupIds.push(groupId)
        
        const contacts = new Map()
        for (let i = 0; i < 50; i++) {
          contacts.set(brand.contactId(`contact-${i}`), {
            id: brand.contactId(`contact-${i}`),
            content: { value: i },
            blendMode: 'accept-last'
          })
        }
        
        await storage.saveGroupState(networkId, groupId, {
          group: {
            id: groupId,
            name: `Load Group ${g}`,
            contactIds: Array.from(contacts.keys()),
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: []
          },
          contacts,
          wires: new Map()
        })
      }
      
      let loadIndex = 0
      const result = await benchmark.runWorkload(
        'Group loads (50 contacts each)',
        TEST_DURATION,
        async () => {
          await storage.loadGroupState(networkId, groupIds[loadIndex % groupIds.length])
          loadIndex++
        }
      )
      
      benchmark.printResult('Group Load', result)
    }, 10000)
  })
  
  describe('Parallel Operations', () => {
    it('should measure parallel write OPS', async () => {
      console.log('\n⚡ Parallel Write Operations')
      
      for (const concurrency of [5, 10, 20]) {
        const groupId = brand.groupId(`parallel-${concurrency}`)
        let counter = 0
        
        const result = await benchmark.runParallelWorkload(
          `Parallel writes`,
          TEST_DURATION,
          concurrency,
          async () => {
            const id = counter++
            await storage.saveContactContent(
              networkId,
              groupId,
              brand.contactId(`contact-${id % 100}`), // Rotate through 100 contacts
              { value: id, timestamp: Date.now() }
            )
          }
        )
        
        benchmark.printResult(`Parallel-${concurrency} Write`, result)
      }
    }, 10000)
    
    it('should measure parallel read OPS', async () => {
      console.log('\n⚡ Parallel Read Operations')
      
      // Setup contacts to read
      const groupId = brand.groupId('parallel-read')
      for (let i = 0; i < 100; i++) {
        await storage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`read-${i}`),
          { value: i, data: `Contact ${i}` }
        )
      }
      
      for (const concurrency of [5, 10, 20]) {
        let readIndex = 0
        
        const result = await benchmark.runParallelWorkload(
          `Parallel reads`,
          TEST_DURATION,
          concurrency,
          async () => {
            const id = readIndex++ % 100
            await storage.loadContactContent(
              networkId,
              groupId,
              brand.contactId(`read-${id}`)
            )
          }
        )
        
        benchmark.printResult(`Parallel-${concurrency} Read`, result)
      }
    }, 10000)
  })
  
  describe('Mixed Workload', () => {
    it('should measure mixed read/write OPS', async () => {
      console.log('\n🔀 Mixed Workload (70% read, 30% write)')
      
      const groupId = brand.groupId('mixed')
      let opCounter = 0
      
      // Setup some initial data
      for (let i = 0; i < 100; i++) {
        await storage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`mixed-${i}`),
          { value: i }
        )
      }
      
      const result = await benchmark.runParallelWorkload(
        'Mixed workload',
        TEST_DURATION,
        10,
        async () => {
          const op = opCounter++
          const contactId = brand.contactId(`mixed-${op % 100}`)
          
          if (Math.random() < 0.7) {
            // Read operation (70%)
            await storage.loadContactContent(networkId, groupId, contactId)
          } else {
            // Write operation (30%)
            await storage.saveContactContent(
              networkId,
              groupId,
              contactId,
              { value: op, timestamp: Date.now() }
            )
          }
        }
      )
      
      benchmark.printResult('Mixed Workload', result)
    }, 10000)
  })
  
  describe('Stress Test', () => {
    it('should measure OPS under extreme load', async () => {
      console.log('\n🔥 Stress Test (Maximum Throughput)')
      
      const groupId = brand.groupId('stress')
      let counter = 0
      
      // Maximum parallel operations
      const result = await benchmark.runParallelWorkload(
        'Maximum throughput',
        TEST_DURATION,
        50, // Match pool size
        async () => {
          const batch = counter++
          const contacts = new Map()
          
          // Small batches for high throughput
          for (let i = 0; i < 5; i++) {
            contacts.set(brand.contactId(`stress-${batch}-${i}`), {
              id: brand.contactId(`stress-${batch}-${i}`),
              content: { batch, index: i },
              blendMode: 'accept-last'
            })
          }
          
          await storage.batchSaveContacts(networkId, groupId, contacts)
        }
      )
      
      benchmark.printResult('Stress Test', result)
      console.log(`    Effective contact writes/sec: ${(result.opsPerSecond * 5).toFixed(0)}`)
      
      // Database stats
      const statsResult = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM bassline_contacts WHERE network_id = $1) as total_contacts,
          (SELECT COUNT(*) FROM bassline_groups WHERE network_id = $1) as total_groups,
          pg_database_size('bassline_test') / 1024 / 1024 as db_size_mb
      `, [networkId])
      
      console.log(`\n  Database Statistics:`)
      console.log(`    Total contacts created: ${statsResult.rows[0].total_contacts}`)
      console.log(`    Total groups created: ${statsResult.rows[0].total_groups}`)
      console.log(`    Database size: ${parseFloat(statsResult.rows[0].db_size_mb).toFixed(2)} MB`)
    }, 10000)
  })
})