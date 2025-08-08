#!/usr/bin/env node
/**
 * Test different batch sizes to find optimal alignment with page sizes
 */

const Database = require('better-sqlite3')
const { join } = require('path')

const processId = process.argv[2]
const opsCount = parseInt(process.argv[3])
const batchSizeArg = parseInt(process.argv[4]) || 1000
const pageSizeArg = parseInt(process.argv[5]) || 16384

async function runWorker() {
  const initStartTime = Date.now()
  
  // Use in-memory database for consistent testing
  const db = new Database(':memory:')
  
  // Set page size BEFORE creating any tables
  db.pragma(`page_size = ${pageSizeArg}`)
  
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
  db.pragma('cache_size = 32768')  // 128MB with 4KB pages
  db.pragma('temp_store = MEMORY')
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO contacts (network_id, group_id, contact_id, content, blend_mode, name)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  const networkId = `network-${processId}`
  const groupId = `group-${processId}`
  
  // Warm up
  for (let i = 0; i < 10; i++) {
    stmt.run(networkId, groupId, `warmup-${i}`, '{}', 'accept-last', null)
  }
  
  // Calculate average row size for our data
  const sampleContent = JSON.stringify({ 
    value: Math.random(), 
    timestamp: Date.now(), 
    process: processId,
    batch: 0
  })
  const avgRowSize = 
    networkId.length + 
    groupId.length + 
    20 + // contact_id
    sampleContent.length + 
    'accept-last'.length +
    20 // overhead
  
  const rowsPerPage = Math.floor(pageSizeArg / avgRowSize)
  
  console.error(`Process ${processId}: Page size=${pageSizeArg}, Avg row size≈${avgRowSize}, Rows per page≈${rowsPerPage}`)
  console.error(`Process ${processId}: Testing batch size=${batchSizeArg}`)
  
  // Now start timing only the actual operations
  const startTime = Date.now()
  
  // Use specified batch size
  const numBatches = Math.ceil(opsCount / batchSizeArg)
  
  for (let batch = 0; batch < numBatches; batch++) {
    const insertMany = db.transaction((contacts) => {
      for (const contact of contacts) {
        stmt.run(networkId, groupId, contact.id, contact.content, 'accept-last', null)
      }
    })
    
    // Prepare batch data
    const contacts = []
    const start = batch * batchSizeArg
    const end = Math.min(start + batchSizeArg, opsCount)
    
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
  
  // Output JSON result
  console.log(JSON.stringify({
    processId,
    opsCount,
    duration,
    opsPerSec,
    batchSize: batchSizeArg,
    pageSize: pageSizeArg,
    rowsPerPage,
    batchesPerPage: batchSizeArg / rowsPerPage
  }))
  
  db.close()
}

runWorker().catch(error => {
  console.error('Worker error:', error)
  process.exit(1)
})