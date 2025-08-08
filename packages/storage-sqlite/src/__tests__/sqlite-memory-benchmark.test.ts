/**
 * SQLite In-Memory Performance Benchmark
 * Compares disk-based vs in-memory SQLite performance
 */

import { describe, it, beforeAll, afterAll } from 'vitest'
import { SQLiteStorage } from '../index.js'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId } from '@bassline/core'
import { rmSync } from 'fs'

describe('SQLite In-Memory Performance', () => {
  let diskStorage: SQLiteStorage
  let memoryStorage: SQLiteStorage
  let memorySharedStorage: SQLiteStorage
  let networkId: NetworkId
  const testDir = './test-data-memory'
  
  beforeAll(async () => {
    // Clean up any existing test data
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch (e) {}
    
    // Disk-based SQLite (with optimizations)
    diskStorage = new SQLiteStorage({
      options: {
        dataDir: testDir,
        mode: 'single',
        synchronous: 'OFF',
        walMode: true,
        cacheSize: -64000,
        pageSize: 4096,
        tempStore: 'MEMORY'
      }
    })
    
    // In-memory SQLite (private)
    memoryStorage = new SQLiteStorage({
      options: {
        mode: 'memory',
        memoryShared: false
      }
    })
    
    // In-memory SQLite (shared)
    memorySharedStorage = new SQLiteStorage({
      options: {
        mode: 'memory',
        memoryShared: true
      }
    })
    
    await diskStorage.initialize()
    await memoryStorage.initialize()
    await memorySharedStorage.initialize()
    
    networkId = brand.networkId(`memory-bench-${Date.now()}`)
    
    // Initialize networks
    const networkState = {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    }
    
    await diskStorage.saveNetworkState(networkId, networkState)
    await memoryStorage.saveNetworkState(networkId, networkState)
    await memorySharedStorage.saveNetworkState(networkId, networkState)
    
    console.log('\n⚡ === SQLite In-Memory Performance Benchmark ===\n')
  })
  
  afterAll(async () => {
    await diskStorage.close()
    await memoryStorage.close()
    await memorySharedStorage.close()
    rmSync(testDir, { recursive: true, force: true })
  })
  
  describe('Write Performance', () => {
    it('should compare single contact write speeds', async () => {
      console.log('📝 Single Contact Writes (10,000 operations):\n')
      
      const iterations = 10000
      const groupId = brand.groupId('single-write')
      
      // Disk-based
      const diskStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await diskStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`disk-${i}`),
          { value: i, timestamp: Date.now() }
        )
      }
      const diskTime = performance.now() - diskStart
      
      // In-memory (private)
      const memStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await memoryStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`mem-${i}`),
          { value: i, timestamp: Date.now() }
        )
      }
      const memTime = performance.now() - memStart
      
      // In-memory (shared)
      const sharedStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await memorySharedStorage.saveContactContent(
          networkId,
          groupId,
          brand.contactId(`shared-${i}`),
          { value: i, timestamp: Date.now() }
        )
      }
      const sharedTime = performance.now() - sharedStart
      
      console.log(`  Disk-based:      ${diskTime.toFixed(2)}ms (${(iterations / diskTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Memory (private): ${memTime.toFixed(2)}ms (${(iterations / memTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Memory (shared):  ${sharedTime.toFixed(2)}ms (${(iterations / sharedTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Memory speedup:   ${(diskTime / memTime).toFixed(2)}x faster than disk`)
    })
    
    it('should compare batch insert performance', async () => {
      console.log('\n📦 Batch Insert (100K contacts):\n')
      
      const contactCount = 100000
      const groupId = brand.groupId('batch-insert')
      
      // Prepare large dataset
      const contacts = new Map()
      for (let i = 0; i < contactCount; i++) {
        contacts.set(brand.contactId(`batch-${i}`), {
          id: brand.contactId(`batch-${i}`),
          content: { 
            value: i,
            data: `Contact ${i} with some additional data to make it realistic`,
            timestamp: Date.now(),
            metadata: { index: i, batch: true }
          },
          blendMode: 'accept-last'
        })
      }
      
      const groupState = {
        group: {
          id: groupId,
          name: 'Batch Test',
          contactIds: Array.from(contacts.keys()),
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts,
        wires: new Map()
      }
      
      // Disk-based
      const diskStart = performance.now()
      await diskStorage.saveGroupState(networkId, brand.groupId(`${groupId}-disk`), groupState)
      const diskTime = performance.now() - diskStart
      
      // In-memory
      const memStart = performance.now()
      await memoryStorage.saveGroupState(networkId, brand.groupId(`${groupId}-mem`), groupState)
      const memTime = performance.now() - memStart
      
      // In-memory (shared)
      const sharedStart = performance.now()
      await memorySharedStorage.saveGroupState(networkId, brand.groupId(`${groupId}-shared`), groupState)
      const sharedTime = performance.now() - sharedStart
      
      const dataSize = JSON.stringify(Array.from(contacts.values())).length / 1024 / 1024
      
      console.log(`  Data size: ${dataSize.toFixed(2)} MB`)
      console.log(`  Disk-based:      ${diskTime.toFixed(2)}ms (${(dataSize / diskTime * 1000).toFixed(2)} MB/s)`)
      console.log(`  Memory (private): ${memTime.toFixed(2)}ms (${(dataSize / memTime * 1000).toFixed(2)} MB/s)`)
      console.log(`  Memory (shared):  ${sharedTime.toFixed(2)}ms (${(dataSize / sharedTime * 1000).toFixed(2)} MB/s)`)
      console.log(`  Memory speedup:   ${(diskTime / memTime).toFixed(2)}x faster than disk`)
    })
  })
  
  describe('Read Performance', () => {
    it('should compare read speeds', async () => {
      console.log('\n📖 Read Performance (100K reads):\n')
      
      const iterations = 100000
      const groupId = brand.groupId('read-test')
      const contactId = brand.contactId('read-contact')
      
      // Setup data
      const content = { test: 'data', value: 42 }
      await diskStorage.saveContactContent(networkId, groupId, contactId, content)
      await memoryStorage.saveContactContent(networkId, groupId, contactId, content)
      await memorySharedStorage.saveContactContent(networkId, groupId, contactId, content)
      
      // Disk-based
      const diskStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await diskStorage.loadContactContent(networkId, groupId, contactId)
      }
      const diskTime = performance.now() - diskStart
      
      // In-memory
      const memStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await memoryStorage.loadContactContent(networkId, groupId, contactId)
      }
      const memTime = performance.now() - memStart
      
      // In-memory (shared)
      const sharedStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await memorySharedStorage.loadContactContent(networkId, groupId, contactId)
      }
      const sharedTime = performance.now() - sharedStart
      
      console.log(`  Disk-based:      ${diskTime.toFixed(2)}ms (${(iterations / diskTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Memory (private): ${memTime.toFixed(2)}ms (${(iterations / memTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Memory (shared):  ${sharedTime.toFixed(2)}ms (${(iterations / sharedTime * 1000).toFixed(0)} ops/sec)`)
      console.log(`  Memory speedup:   ${(diskTime / memTime).toFixed(2)}x faster than disk`)
    })
  })
  
  describe('Mixed Workload', () => {
    it('should simulate realistic high-throughput workload', async () => {
      console.log('\n🔀 High-Throughput Mixed Workload (10 seconds):\n')
      
      const duration = 10000 // 10 seconds
      const groupId = brand.groupId('mixed')
      
      // Pre-populate some data
      for (let i = 0; i < 100; i++) {
        const contactId = brand.contactId(`init-${i}`)
        await diskStorage.saveContactContent(networkId, groupId, contactId, { initial: i })
        await memoryStorage.saveContactContent(networkId, groupId, contactId, { initial: i })
        await memorySharedStorage.saveContactContent(networkId, groupId, contactId, { initial: i })
      }
      
      const runWorkload = async (storage: SQLiteStorage, label: string) => {
        const start = performance.now()
        let ops = 0
        let reads = 0
        let writes = 0
        
        while (performance.now() - start < duration) {
          const rand = Math.random()
          
          if (rand < 0.7) {
            // Read (70%)
            await storage.loadContactContent(
              networkId,
              groupId,
              brand.contactId(`init-${Math.floor(Math.random() * 100)}`)
            )
            reads++
          } else {
            // Write (30%)
            await storage.saveContactContent(
              networkId,
              groupId,
              brand.contactId(`new-${ops}`),
              { value: ops, timestamp: Date.now() }
            )
            writes++
          }
          ops++
        }
        
        const actualTime = performance.now() - start
        return {
          label,
          ops,
          reads,
          writes,
          time: actualTime,
          opsPerSec: ops / actualTime * 1000
        }
      }
      
      // Run workloads
      const diskResult = await runWorkload(diskStorage, 'Disk-based')
      const memResult = await runWorkload(memoryStorage, 'Memory (private)')
      const sharedResult = await runWorkload(memorySharedStorage, 'Memory (shared)')
      
      // Print results
      for (const result of [diskResult, memResult, sharedResult]) {
        console.log(`  ${result.label.padEnd(16)} ${result.ops} ops (${result.reads} reads, ${result.writes} writes)`)
        console.log(`                   ${result.opsPerSec.toFixed(0)} ops/sec`)
      }
      
      console.log(`\n  Memory advantage: ${(memResult.opsPerSec / diskResult.opsPerSec).toFixed(2)}x more operations`)
    }, 30000)
  })
  
  describe('Extreme Throughput Test', () => {
    it('should test maximum possible throughput', async () => {
      console.log('\n🚀 Maximum Throughput Test (1M operations):\n')
      
      const operations = 1000000
      const groupId = brand.groupId('extreme')
      
      // In-memory only (disk would be too slow)
      const start = performance.now()
      
      for (let i = 0; i < operations; i++) {
        if (i % 2 === 0) {
          await memoryStorage.saveContactContent(
            networkId,
            groupId,
            brand.contactId(`extreme-${i % 10000}`), // Reuse some IDs
            { value: i }
          )
        } else {
          await memoryStorage.loadContactContent(
            networkId,
            groupId,
            brand.contactId(`extreme-${i % 10000}`)
          )
        }
      }
      
      const time = performance.now() - start
      const opsPerSec = operations / time * 1000
      const throughput = (operations * 50) / time / 1024 // Assuming ~50 bytes per op
      
      console.log(`  Total operations: ${operations.toLocaleString()}`)
      console.log(`  Total time:       ${time.toFixed(2)}ms`)
      console.log(`  Operations/sec:   ${opsPerSec.toFixed(0).toLocaleString()}`)
      console.log(`  Throughput:       ${throughput.toFixed(2)} MB/s`)
      console.log(`  Avg latency:      ${(time / operations).toFixed(4)}ms per operation`)
    })
  })
  
  describe('Memory vs Disk Trade-offs', () => {
    it('should explain when to use each mode', async () => {
      console.log('\n📊 Storage Mode Comparison:\n')
      console.log('  Disk-based SQLite:')
      console.log('    ✅ Data persists after restart')
      console.log('    ✅ Can handle datasets larger than RAM')
      console.log('    ✅ Crash recovery with WAL')
      console.log('    ❌ Slower due to disk I/O')
      console.log('    Use case: Persistent storage, large datasets')
      
      console.log('\n  In-Memory SQLite:')
      console.log('    ✅ 5-10x faster than disk')
      console.log('    ✅ Zero disk I/O')
      console.log('    ✅ Perfect for temporary/cache data')
      console.log('    ❌ Data lost on restart')
      console.log('    ❌ Limited by available RAM')
      console.log('    Use case: Caching, temporary processing, tests')
      
      console.log('\n  Hybrid Approach:')
      console.log('    - Use in-memory for hot data')
      console.log('    - Periodically snapshot to disk')
      console.log('    - Best of both worlds!')
    })
  })
})