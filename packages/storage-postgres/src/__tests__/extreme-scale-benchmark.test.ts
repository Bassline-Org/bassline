/**
 * Extreme Scale Benchmark
 * Tests storage performance with large-scale data (1K, 10K contacts)
 * Measures throughput in operations/sec and bytes/sec
 */

import { describe, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { OptimizedPostgresStorage } from '../optimized-storage.js'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'

interface ScaleTestResult {
  totalContacts: number
  totalOperations: number
  durationMs: number
  opsPerSecond: number
  bytesWritten: number
  bytesPerSecond: number
  mbPerSecond: number
  avgLatencyMs: number
  dbSizeMB: number
  dbGrowthMB: number
}

class ExtremeScaleBenchmark {
  private storage: OptimizedPostgresStorage
  private pool: Pool
  private networkId: NetworkId
  
  constructor(storage: OptimizedPostgresStorage, pool: Pool, networkId: NetworkId) {
    this.storage = storage
    this.pool = pool
    this.networkId = networkId
  }
  
  private generateLargeContent(index: number): any {
    // Generate realistic content with ~500 bytes per contact
    return {
      id: index,
      name: `Contact ${index}`,
      email: `contact${index}@example.com`,
      phone: `+1-555-${String(index).padStart(4, '0')}`,
      address: {
        street: `${index} Main Street`,
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        country: 'USA'
      },
      metadata: {
        created: Date.now(),
        updated: Date.now(),
        tags: [`tag${index % 10}`, `category${index % 5}`, `group${index % 20}`],
        notes: `This is a longer description for contact ${index} that contains various information and details about this particular contact in our system.`,
        customFields: {
          field1: `value${index}`,
          field2: index * 2,
          field3: index % 2 === 0
        }
      },
      relationships: Array.from({ length: 5 }, (_, i) => ({
        type: 'colleague',
        contactId: `contact-${(index + i + 1) % 1000}`
      }))
    }
  }
  
  private async getDatabaseSize(): Promise<number> {
    const result = await this.pool.query(`
      SELECT pg_database_size('bassline_test') / 1024.0 / 1024.0 as size_mb
    `)
    return parseFloat(result.rows[0].size_mb)
  }
  
  private async getTableStats(): Promise<any> {
    const result = await this.pool.query(`
      SELECT 
        'contacts' as table_name,
        pg_size_pretty(pg_total_relation_size('bassline_contacts')) as total_size,
        pg_total_relation_size('bassline_contacts') as bytes,
        COUNT(*) as row_count
      FROM bassline_contacts
      WHERE network_id = $1
      UNION ALL
      SELECT 
        'groups' as table_name,
        pg_size_pretty(pg_total_relation_size('bassline_groups')) as total_size,
        pg_total_relation_size('bassline_groups') as bytes,
        COUNT(*) as row_count
      FROM bassline_groups
      WHERE network_id = $1
      UNION ALL
      SELECT 
        'wires' as table_name,
        pg_size_pretty(pg_total_relation_size('bassline_wires')) as total_size,
        pg_total_relation_size('bassline_wires') as bytes,
        COUNT(*) as row_count
      FROM bassline_wires
      WHERE network_id = $1
    `, [this.networkId])
    
    return result.rows
  }
  
  async testBulkInsert(contactCount: number): Promise<ScaleTestResult> {
    console.log(`\n📊 Testing bulk insert of ${contactCount.toLocaleString()} contacts...`)
    
    const groupId = brand.groupId(`bulk-${contactCount}`)
    const initialDbSize = await this.getDatabaseSize()
    
    // Generate contacts with realistic data
    const contacts = new Map()
    let totalBytes = 0
    
    for (let i = 0; i < contactCount; i++) {
      const content = this.generateLargeContent(i)
      const contentStr = JSON.stringify(content)
      totalBytes += contentStr.length
      
      contacts.set(brand.contactId(`contact-${i}`), {
        id: brand.contactId(`contact-${i}`),
        content,
        blendMode: 'accept-last'
      })
    }
    
    console.log(`  Generated ${(totalBytes / 1024 / 1024).toFixed(2)} MB of contact data`)
    
    // Measure insertion time
    const startTime = performance.now()
    
    await this.storage.saveGroupState(this.networkId, groupId, {
      group: {
        id: groupId,
        name: `Bulk Test ${contactCount}`,
        contactIds: Array.from(contacts.keys()),
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      },
      contacts,
      wires: new Map()
    })
    
    const duration = performance.now() - startTime
    const finalDbSize = await this.getDatabaseSize()
    
    return {
      totalContacts: contactCount,
      totalOperations: 1,
      durationMs: duration,
      opsPerSecond: (contactCount / duration) * 1000,
      bytesWritten: totalBytes,
      bytesPerSecond: (totalBytes / duration) * 1000,
      mbPerSecond: (totalBytes / duration) * 1000 / 1024 / 1024,
      avgLatencyMs: duration / contactCount,
      dbSizeMB: finalDbSize,
      dbGrowthMB: finalDbSize - initialDbSize
    }
  }
  
  async testBatchUpdates(contactCount: number, batchSize: number): Promise<ScaleTestResult> {
    console.log(`\n🔄 Testing batch updates: ${contactCount.toLocaleString()} contacts in batches of ${batchSize}...`)
    
    const groupId = brand.groupId(`batch-update-${contactCount}`)
    const initialDbSize = await this.getDatabaseSize()
    
    // First, create the initial contacts
    const contacts = new Map()
    for (let i = 0; i < contactCount; i++) {
      contacts.set(brand.contactId(`update-${i}`), {
        id: brand.contactId(`update-${i}`),
        content: { value: i, initial: true },
        blendMode: 'accept-last'
      })
    }
    
    await this.storage.saveGroupState(this.networkId, groupId, {
      group: {
        id: groupId,
        name: `Update Test ${contactCount}`,
        contactIds: Array.from(contacts.keys()),
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      },
      contacts,
      wires: new Map()
    })
    
    // Now perform batch updates
    const startTime = performance.now()
    let totalBytes = 0
    let totalOps = 0
    
    for (let batch = 0; batch < Math.ceil(contactCount / batchSize); batch++) {
      const batchContacts = new Map()
      const startIdx = batch * batchSize
      const endIdx = Math.min(startIdx + batchSize, contactCount)
      
      for (let i = startIdx; i < endIdx; i++) {
        const content = this.generateLargeContent(i)
        const contentStr = JSON.stringify(content)
        totalBytes += contentStr.length
        
        batchContacts.set(brand.contactId(`update-${i}`), {
          id: brand.contactId(`update-${i}`),
          content,
          blendMode: 'accept-last'
        })
      }
      
      await this.storage.batchSaveContacts(this.networkId, groupId, batchContacts)
      totalOps++
    }
    
    const duration = performance.now() - startTime
    const finalDbSize = await this.getDatabaseSize()
    
    return {
      totalContacts: contactCount,
      totalOperations: totalOps,
      durationMs: duration,
      opsPerSecond: (contactCount / duration) * 1000,
      bytesWritten: totalBytes,
      bytesPerSecond: (totalBytes / duration) * 1000,
      mbPerSecond: (totalBytes / duration) * 1000 / 1024 / 1024,
      avgLatencyMs: duration / contactCount,
      dbSizeMB: finalDbSize,
      dbGrowthMB: finalDbSize - initialDbSize
    }
  }
  
  async testParallelWrites(contactCount: number, parallelism: number): Promise<ScaleTestResult> {
    console.log(`\n⚡ Testing parallel writes: ${contactCount.toLocaleString()} contacts with ${parallelism} workers...`)
    
    const initialDbSize = await this.getDatabaseSize()
    const contactsPerWorker = Math.ceil(contactCount / parallelism)
    
    const startTime = performance.now()
    let totalBytes = 0
    
    // Create parallel write operations
    const workers = Array.from({ length: parallelism }, async (_, workerIdx) => {
      const groupId = brand.groupId(`parallel-${workerIdx}`)
      const contacts = new Map()
      let workerBytes = 0
      
      for (let i = 0; i < contactsPerWorker; i++) {
        const globalIdx = workerIdx * contactsPerWorker + i
        if (globalIdx >= contactCount) break
        
        const content = this.generateLargeContent(globalIdx)
        const contentStr = JSON.stringify(content)
        workerBytes += contentStr.length
        
        contacts.set(brand.contactId(`parallel-${globalIdx}`), {
          id: brand.contactId(`parallel-${globalIdx}`),
          content,
          blendMode: 'accept-last'
        })
      }
      
      await this.storage.batchSaveContacts(this.networkId, groupId, contacts)
      return workerBytes
    })
    
    const bytesPerWorker = await Promise.all(workers)
    totalBytes = bytesPerWorker.reduce((sum, bytes) => sum + bytes, 0)
    
    const duration = performance.now() - startTime
    const finalDbSize = await this.getDatabaseSize()
    
    return {
      totalContacts: contactCount,
      totalOperations: parallelism,
      durationMs: duration,
      opsPerSecond: (contactCount / duration) * 1000,
      bytesWritten: totalBytes,
      bytesPerSecond: (totalBytes / duration) * 1000,
      mbPerSecond: (totalBytes / duration) * 1000 / 1024 / 1024,
      avgLatencyMs: duration / contactCount,
      dbSizeMB: finalDbSize,
      dbGrowthMB: finalDbSize - initialDbSize
    }
  }
  
  printResult(name: string, result: ScaleTestResult) {
    console.log(`\n📈 ${name} Results:`)
    console.log(`  Total contacts: ${result.totalContacts.toLocaleString()}`)
    console.log(`  Duration: ${(result.durationMs / 1000).toFixed(2)}s`)
    console.log(`  Contacts/sec: ${result.opsPerSecond.toFixed(0).toLocaleString()}`)
    console.log(`  Throughput: ${result.mbPerSecond.toFixed(2)} MB/s (${(result.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s)`)
    console.log(`  Avg latency/contact: ${result.avgLatencyMs.toFixed(3)}ms`)
    console.log(`  Database size: ${result.dbSizeMB.toFixed(2)} MB`)
    console.log(`  Database growth: ${result.dbGrowthMB.toFixed(2)} MB`)
  }
}

describe('Extreme Scale Benchmark', () => {
  let storage: OptimizedPostgresStorage
  let pool: Pool
  let networkId: NetworkId
  let benchmark: ExtremeScaleBenchmark
  
  beforeAll(async () => {
    storage = new OptimizedPostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 100, // Increase pool size for extreme scale
      }
    })
    
    pool = new Pool({
      database: 'bassline_test',
      max: 10
    })
    
    await storage.initialize()
    
    networkId = brand.networkId(`extreme-scale-${Date.now()}`)
    await storage.saveNetworkState(networkId, {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    })
    
    benchmark = new ExtremeScaleBenchmark(storage, pool, networkId)
    
    console.log('\n🚀 === Extreme Scale Benchmark ===')
    
    // Get initial database size
    const dbSize = await benchmark['getDatabaseSize']()
    console.log(`Initial database size: ${dbSize.toFixed(2)} MB`)
  })
  
  afterAll(async () => {
    // Print final statistics
    const tableStats = await benchmark['getTableStats']()
    console.log('\n📊 Final Table Statistics:')
    for (const stat of tableStats) {
      console.log(`  ${stat.table_name}: ${stat.row_count.toLocaleString()} rows, ${stat.total_size}`)
    }
    
    await storage.deleteNetwork(networkId)
    await storage.close()
    await pool.end()
  })
  
  describe('Bulk Insert Performance', () => {
    it('should handle 1,000 contacts bulk insert', async () => {
      const result = await benchmark.testBulkInsert(1000)
      benchmark.printResult('1K Bulk Insert', result)
    }, 30000)
    
    it('should handle 10,000 contacts bulk insert', async () => {
      const result = await benchmark.testBulkInsert(10000)
      benchmark.printResult('10K Bulk Insert', result)
    }, 60000)
  })
  
  describe('Batch Update Performance', () => {
    it('should handle 1,000 contact updates in batches', async () => {
      const result = await benchmark.testBatchUpdates(1000, 100)
      benchmark.printResult('1K Batch Updates (100/batch)', result)
    }, 30000)
    
    it('should handle 10,000 contact updates in batches', async () => {
      const result = await benchmark.testBatchUpdates(10000, 500)
      benchmark.printResult('10K Batch Updates (500/batch)', result)
    }, 60000)
  })
  
  describe('Parallel Write Performance', () => {
    it('should handle 1,000 contacts with 10 parallel workers', async () => {
      const result = await benchmark.testParallelWrites(1000, 10)
      benchmark.printResult('1K Parallel Writes (10 workers)', result)
    }, 30000)
    
    it('should handle 10,000 contacts with 20 parallel workers', async () => {
      const result = await benchmark.testParallelWrites(10000, 20)
      benchmark.printResult('10K Parallel Writes (20 workers)', result)
    }, 60000)
  })
  
  describe('Maximum Throughput Test', () => {
    it('should measure maximum sustained throughput', async () => {
      console.log('\n🔥 Maximum Sustained Throughput Test (30 seconds)...')
      
      const duration = 30000 // 30 seconds
      const batchSize = 500
      const parallelism = 50
      
      const startTime = performance.now()
      const endTime = startTime + duration
      const initialDbSize = await benchmark['getDatabaseSize']()
      
      let totalContacts = 0
      let totalBytes = 0
      let batchCount = 0
      
      // Run parallel writers for the duration
      const workers = Array.from({ length: parallelism }, async (_, workerIdx) => {
        let workerContacts = 0
        let workerBytes = 0
        
        while (performance.now() < endTime) {
          const groupId = brand.groupId(`throughput-${workerIdx}-${batchCount++}`)
          const contacts = new Map()
          
          for (let i = 0; i < batchSize; i++) {
            const idx = totalContacts + workerContacts + i
            const content = benchmark['generateLargeContent'](idx)
            const contentStr = JSON.stringify(content)
            workerBytes += contentStr.length
            
            contacts.set(brand.contactId(`throughput-${idx}`), {
              id: brand.contactId(`throughput-${idx}`),
              content,
              blendMode: 'accept-last'
            })
          }
          
          await storage.batchSaveContacts(networkId, groupId, contacts)
          workerContacts += batchSize
        }
        
        return { contacts: workerContacts, bytes: workerBytes }
      })
      
      const results = await Promise.all(workers)
      totalContacts = results.reduce((sum, r) => sum + r.contacts, 0)
      totalBytes = results.reduce((sum, r) => sum + r.bytes, 0)
      
      const actualDuration = performance.now() - startTime
      const finalDbSize = await benchmark['getDatabaseSize']()
      
      const throughputResult: ScaleTestResult = {
        totalContacts,
        totalOperations: batchCount,
        durationMs: actualDuration,
        opsPerSecond: (totalContacts / actualDuration) * 1000,
        bytesWritten: totalBytes,
        bytesPerSecond: (totalBytes / actualDuration) * 1000,
        mbPerSecond: (totalBytes / actualDuration) * 1000 / 1024 / 1024,
        avgLatencyMs: actualDuration / totalContacts,
        dbSizeMB: finalDbSize,
        dbGrowthMB: finalDbSize - initialDbSize
      }
      
      benchmark.printResult('Maximum Sustained Throughput', throughputResult)
      
      console.log(`\n🎯 Peak Performance Metrics:`)
      console.log(`  Total contacts written: ${totalContacts.toLocaleString()}`)
      console.log(`  Total data written: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`)
      console.log(`  Average batch size: ${(totalContacts / batchCount).toFixed(0)} contacts`)
      console.log(`  Batches completed: ${batchCount.toLocaleString()}`)
    }, 60000)
  })
})