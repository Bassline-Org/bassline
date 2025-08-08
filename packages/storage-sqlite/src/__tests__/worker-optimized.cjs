#!/usr/bin/env node
/**
 * Optimized worker script with configurable page size and memory settings
 */

const Database = require('better-sqlite3')
const { join } = require('path')

const processId = process.argv[2]
const opsCount = parseInt(process.argv[3])
const useMemory = process.argv[4] === 'memory'
const pageSize = parseInt(process.argv[5]) || 4096  // Default 4KB

if (!processId || !opsCount) {
  console.error('Usage: worker-optimized.js <processId> <opsCount> [memory] [pageSize]')
  process.exit(1)
}

async function runWorker() {
  const initStartTime = Date.now()
  let db
  
  if (useMemory) {
    // Use in-memory database
    db = new Database(':memory:')
    console.error(`Process ${processId}: Using in-memory database with page_size=${pageSize}`)
  } else {
    // Use file-based database in separate subdirectories
    const { mkdirSync } = require('fs')
    const dbDir = join('/tmp/bassline-parallel-test', `worker-${processId}`)
    mkdirSync(dbDir, { recursive: true })
    
    const dbPath = join(dbDir, 'database.db')
    console.error(`Process ${processId}: Using database ${dbPath} with page_size=${pageSize}`)
    
    db = new Database(dbPath)
  }
  
  // Check current settings - pragma returns [{key: value}]
  const currentPageSize = db.pragma('page_size')[0].page_size
  const currentCacheSize = db.pragma('cache_size')[0].cache_size
  const currentMmapSize = db.pragma('mmap_size')[0]?.mmap_size || 0
  console.error(`Process ${processId}: Initial settings - page_size=${currentPageSize}, cache_size=${currentCacheSize}, mmap_size=${currentMmapSize}`)
  
  // Set page size BEFORE creating any tables (must be done on empty database)
  db.pragma(`page_size = ${pageSize}`)
  
  // Create table
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
  
  // Optimize for speed
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = OFF')
  
  // Set cache size based on page size
  // -64000 means 64MB, but actual pages depend on page_size
  const cacheMB = 128  // Try 128MB cache
  const cachePages = (cacheMB * 1024 * 1024) / pageSize
  db.pragma(`cache_size = ${cachePages}`)
  
  db.pragma('temp_store = MEMORY')
  
  // Use memory-mapped I/O for disk databases
  if (!useMemory) {
    db.pragma('mmap_size = 268435456')  // 256MB mmap
  }
  
  // Check final settings
  const finalPageSize = db.pragma('page_size')[0].page_size
  const finalCacheSize = db.pragma('cache_size')[0].cache_size
  const finalMmapSize = db.pragma('mmap_size')[0]?.mmap_size || 0
  console.error(`Process ${processId}: Final settings - page_size=${finalPageSize}, cache_size=${finalCacheSize}, mmap_size=${finalMmapSize}`)
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO contacts (network_id, group_id, contact_id, content, blend_mode, name)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  const networkId = `network-${processId}`
  const groupId = `group-${processId}`
  
  // Warm up - run a few operations to ensure everything is initialized
  for (let i = 0; i < 10; i++) {
    stmt.run(networkId, groupId, `warmup-${i}`, '{}', 'accept-last', null)
  }
  
  // Now start timing only the actual operations
  const startTime = Date.now()
  
  // Use a transaction for batching - massive performance improvement!
  const batchSize = 1000
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
      contacts.push({
        id: `contact-${i}`,
        content: JSON.stringify({ 
          value: Math.random(), 
          timestamp: Date.now(), 
          process: processId,
          batch: batch
        })
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
  const currentPageSizeFinal = db.pragma('page_size')[0].page_size
  const dbSizeMB = (pageCount * currentPageSizeFinal) / (1024 * 1024)
  
  // Log timing breakdown to stderr
  console.error(`Process ${processId}: Init took ${initDuration}ms, ops took ${duration}ms`)
  console.error(`Process ${processId}: Database has ${dbStats.count} records, size: ${dbSizeMB.toFixed(2)}MB`)
  
  // Output JSON result
  console.log(JSON.stringify({
    processId,
    opsCount,
    duration,
    opsPerSec,
    initDuration,
    pageSize: finalPageSize,
    cacheSize: finalCacheSize,
    recordCount: dbStats.count,
    dbSizeMB
  }))
  
  db.close()
}

runWorker().catch(error => {
  console.error('Worker error:', error)
  process.exit(1)
})