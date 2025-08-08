#!/usr/bin/env node
/**
 * Worker script testing with 1KB aligned data payloads
 */

const Database = require('better-sqlite3')
const { join } = require('path')

const processId = process.argv[2]
const opsCount = parseInt(process.argv[3])
const useMemory = process.argv[4] === 'memory'
const dataSize = parseInt(process.argv[5]) || 1024  // Default 1KB

if (!processId || !opsCount) {
  console.error('Usage: worker-1kb.js <processId> <opsCount> [memory] [dataSize]')
  process.exit(1)
}

// Create padding data of specific size
function createPayload(size, index) {
  const base = {
    id: index,
    timestamp: Date.now(),
    process: processId,
  }
  
  // Calculate how much padding we need
  const baseSize = JSON.stringify(base).length
  const paddingSize = Math.max(0, size - baseSize - 2) // -2 for quotes
  
  // Create padding that will result in exactly 'size' bytes when stringified
  base.padding = 'x'.repeat(paddingSize)
  
  const result = JSON.stringify(base)
  console.error(`Process ${processId}: First payload size: ${result.length} bytes (target: ${size})`)
  return result
}

async function runWorker() {
  const initStartTime = Date.now()
  let db
  
  if (useMemory) {
    db = new Database(':memory:')
    console.error(`Process ${processId}: Using in-memory database with ${dataSize}B payloads`)
  } else {
    const { mkdirSync } = require('fs')
    const dbDir = join('/tmp/bassline-parallel-test', `worker-${processId}`)
    mkdirSync(dbDir, { recursive: true })
    
    const dbPath = join(dbDir, 'database.db')
    console.error(`Process ${processId}: Using database ${dbPath} with ${dataSize}B payloads`)
    
    db = new Database(dbPath)
  }
  
  // Optimize for speed - MUST set page_size BEFORE creating any tables!
  db.pragma('page_size = 16384')  // 16KB pages
  
  // Set cache size - use more cache for larger data
  const cacheMB = 256  // Increase cache for larger payloads
  const cachePages = (cacheMB * 1024 * 1024) / 16384
  db.pragma(`cache_size = ${cachePages}`)
  
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = OFF')
  db.pragma('temp_store = MEMORY')
  
  if (!useMemory) {
    db.pragma('mmap_size = 536870912')  // 512MB mmap for larger data
  }
  
  // Create table AFTER setting page_size
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      network_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      content TEXT,
      blend_mode TEXT,
      name TEXT,
      PRIMARY KEY (network_id, group_id, contact_id)
    )
  `)
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO contacts (network_id, group_id, contact_id, content, blend_mode, name)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  const networkId = `network-${processId}`
  const groupId = `group-${processId}`
  
  // Create sample payload to verify size
  const samplePayload = createPayload(dataSize, 0)
  
  // Warm up
  for (let i = 0; i < 10; i++) {
    stmt.run(networkId, groupId, `warmup-${i}`, samplePayload, 'accept-last', null)
  }
  
  // Calculate optimal batch size based on data size
  // For 1KB data: smaller batches to avoid memory pressure
  // For 100B data: larger batches for efficiency
  const batchSize = dataSize >= 1024 ? 500 : 2000
  console.error(`Process ${processId}: Using batch size ${batchSize} for ${dataSize}B payloads`)
  
  // Start timing
  const startTime = Date.now()
  
  const numBatches = Math.ceil(opsCount / batchSize)
  
  for (let batch = 0; batch < numBatches; batch++) {
    const insertMany = db.transaction((contacts) => {
      for (const contact of contacts) {
        stmt.run(networkId, groupId, contact.id, contact.content, 'accept-last', null)
      }
    })
    
    // Prepare batch data
    const contacts = []
    const start = batch * batchSize
    const end = Math.min(start + batchSize, opsCount)
    
    for (let i = start; i < end; i++) {
      // Create aligned payload
      const payload = createPayload(dataSize, i)
      
      contacts.push({
        id: `contact-${i}`,
        content: payload
      })
    }
    
    // Execute batch transaction
    insertMany(contacts)
  }
  
  const duration = Date.now() - startTime
  const opsPerSec = (opsCount / duration) * 1000
  const initDuration = startTime - initStartTime
  
  // Get database stats
  const dbStats = db.prepare('SELECT COUNT(*) as count FROM contacts').get()
  const pageCount = db.pragma('page_count')[0].page_count
  const pageSize = db.pragma('page_size')[0].page_size
  const dbSizeMB = (pageCount * pageSize) / (1024 * 1024)
  
  // Calculate data throughput
  const totalDataMB = (opsCount * dataSize) / (1024 * 1024)
  const throughputMBps = (totalDataMB / duration) * 1000
  
  console.error(`Process ${processId}: Init ${initDuration}ms, ops ${duration}ms`)
  console.error(`Process ${processId}: ${dbStats.count} records, DB size: ${dbSizeMB.toFixed(2)}MB`)
  console.error(`Process ${processId}: Data throughput: ${throughputMBps.toFixed(2)} MB/sec`)
  
  // Output JSON result
  console.log(JSON.stringify({
    processId,
    opsCount,
    duration,
    opsPerSec,
    initDuration,
    recordCount: dbStats.count,
    dbSizeMB,
    payloadSize: dataSize,
    totalDataMB,
    throughputMBps
  }))
  
  db.close()
}

runWorker().catch(error => {
  console.error('Worker error:', error)
  process.exit(1)
})