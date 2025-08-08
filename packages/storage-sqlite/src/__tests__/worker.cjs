#!/usr/bin/env node
/**
 * Worker script for parallel process testing
 * Simple JavaScript worker that can be run directly with node
 */

const Database = require('better-sqlite3')
const { join } = require('path')

const processId = process.argv[2]
const opsCount = parseInt(process.argv[3])
const useMemory = process.argv[4] === 'memory'

if (!processId || !opsCount) {
  console.error('Usage: worker.js <processId> <opsCount> [memory]')
  process.exit(1)
}

async function runWorker() {
  const initStartTime = Date.now()
  let db
  
  if (useMemory) {
    // Use in-memory database
    db = new Database(':memory:')
    console.error(`Process ${processId}: Using in-memory database`)
  } else {
    // Use file-based database in separate subdirectories
    const { mkdirSync } = require('fs')
    const dbDir = join('/tmp/bassline-parallel-test', `worker-${processId}`)
    mkdirSync(dbDir, { recursive: true })
    
    const dbPath = join(dbDir, 'database.db')
    console.error(`Process ${processId}: Using database ${dbPath}`)
    
    db = new Database(dbPath)
  }
  
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
  db.pragma('cache_size = -64000')
  db.pragma('temp_store = MEMORY')
  
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
  
  // Log timing breakdown to stderr
  console.error(`Process ${processId}: Init took ${initDuration}ms, ops took ${duration}ms`)
  
  // Output JSON result
  console.log(JSON.stringify({
    processId,
    opsCount,
    duration,
    opsPerSec,
    initDuration
  }))
  
  db.close()
}

runWorker().catch(error => {
  console.error('Worker error:', error)
  process.exit(1)
})