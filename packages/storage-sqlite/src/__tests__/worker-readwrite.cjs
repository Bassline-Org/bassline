#!/usr/bin/env node
/**
 * Worker script that tests both write and read performance
 */

const Database = require('better-sqlite3')
const { join } = require('path')

const processId = process.argv[2]
const opsCount = parseInt(process.argv[3])

if (!processId || !opsCount) {
  console.error('Usage: worker-readwrite.js <processId> <opsCount>')
  process.exit(1)
}

async function runWorker() {
  const db = new Database(':memory:')
  
  // Optimize for speed
  db.pragma('page_size = 16384')
  db.pragma('cache_size = 8192')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = OFF')
  db.pragma('temp_store = MEMORY')
  
  // Create table with index for reads
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      network_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      content TEXT,
      blend_mode TEXT,
      value REAL,
      PRIMARY KEY (network_id, group_id, contact_id)
    );
    CREATE INDEX idx_value ON contacts(value);
  `)
  
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO contacts (network_id, group_id, contact_id, content, blend_mode, value)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  const selectByIdStmt = db.prepare(`
    SELECT content FROM contacts 
    WHERE network_id = ? AND group_id = ? AND contact_id = ?
  `)
  
  const selectByValueStmt = db.prepare(`
    SELECT contact_id, content FROM contacts 
    WHERE value > ? AND value < ?
    LIMIT 100
  `)
  
  const networkId = `network-${processId}`
  const groupId = `group-${processId}`
  const values = []
  
  console.error(`Process ${processId}: === WRITE PHASE ===`)
  
  // === WRITE PHASE ===
  const writeStart = Date.now()
  
  const batchSize = 2000
  const numBatches = Math.ceil(opsCount / batchSize)
  
  for (let batch = 0; batch < numBatches; batch++) {
    const insertMany = db.transaction((contacts) => {
      for (const contact of contacts) {
        insertStmt.run(
          networkId, 
          groupId, 
          contact.id, 
          contact.content,
          'accept-last',
          contact.value
        )
      }
    })
    
    const contacts = []
    const start = batch * batchSize
    const end = Math.min(start + batchSize, opsCount)
    
    for (let i = start; i < end; i++) {
      const value = Math.random()
      values.push(value)
      
      contacts.push({
        id: `contact-${i}`,
        content: JSON.stringify({ 
          value: value,
          timestamp: Date.now(),
          data: `Data for contact ${i}`
        }),
        value: value
      })
    }
    
    insertMany(contacts)
  }
  
  const writeDuration = Date.now() - writeStart
  const writeOpsPerSec = (opsCount / writeDuration) * 1000
  
  console.error(`Process ${processId}: Wrote ${opsCount} records in ${writeDuration}ms`)
  console.error(`Process ${processId}: Write speed: ${writeOpsPerSec.toFixed(0)} ops/sec`)
  
  // === READ PHASE - Sequential by ID ===
  console.error(`Process ${processId}: === READ PHASE (Sequential) ===`)
  
  const readStart = Date.now()
  let readCount = 0
  
  for (let i = 0; i < Math.min(10000, opsCount); i++) {
    const result = selectByIdStmt.get(networkId, groupId, `contact-${i}`)
    if (result && result.content) {
      readCount++
    }
  }
  
  const readDuration = Date.now() - readStart
  const readOpsPerSec = (readCount / readDuration) * 1000
  
  console.error(`Process ${processId}: Read ${readCount} records in ${readDuration}ms`)
  console.error(`Process ${processId}: Read speed: ${readOpsPerSec.toFixed(0)} ops/sec`)
  
  // === READ PHASE - Random range queries ===
  console.error(`Process ${processId}: === READ PHASE (Range Queries) ===`)
  
  const rangeStart = Date.now()
  let rangeResults = 0
  
  for (let i = 0; i < 1000; i++) {
    const minValue = Math.random() * 0.8
    const maxValue = minValue + 0.1
    
    const results = selectByValueStmt.all(minValue, maxValue)
    rangeResults += results.length
  }
  
  const rangeDuration = Date.now() - rangeStart
  const rangeQueriesPerSec = (1000 / rangeDuration) * 1000
  
  console.error(`Process ${processId}: Executed 1000 range queries in ${rangeDuration}ms`)
  console.error(`Process ${processId}: Range query speed: ${rangeQueriesPerSec.toFixed(0)} queries/sec`)
  console.error(`Process ${processId}: Retrieved ${rangeResults} total records`)
  
  // === MIXED WORKLOAD ===
  console.error(`Process ${processId}: === MIXED WORKLOAD (70% read, 30% write) ===`)
  
  const mixedStart = Date.now()
  let mixedOps = 0
  const mixedTarget = 10000
  
  const mixedTransaction = db.transaction(() => {
    for (let i = 0; i < mixedTarget; i++) {
      if (Math.random() < 0.7) {
        // Read operation
        const idx = Math.floor(Math.random() * opsCount)
        selectByIdStmt.get(networkId, groupId, `contact-${idx}`)
      } else {
        // Write operation
        const idx = opsCount + i
        insertStmt.run(
          networkId,
          groupId,
          `contact-${idx}`,
          JSON.stringify({ mixed: true, index: idx }),
          'accept-last',
          Math.random()
        )
      }
      mixedOps++
    }
  })
  
  mixedTransaction()
  
  const mixedDuration = Date.now() - mixedStart
  const mixedOpsPerSec = (mixedOps / mixedDuration) * 1000
  
  console.error(`Process ${processId}: Mixed workload: ${mixedOps} ops in ${mixedDuration}ms`)
  console.error(`Process ${processId}: Mixed speed: ${mixedOpsPerSec.toFixed(0)} ops/sec`)
  
  // Get final stats
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get()
  const pageCount = db.pragma('page_count')[0].page_count
  const pageSize = db.pragma('page_size')[0].page_size
  const dbSizeMB = (pageCount * pageSize) / (1024 * 1024)
  
  console.error(`Process ${processId}: === FINAL STATS ===`)
  console.error(`Process ${processId}: Total records: ${finalCount.count}`)
  console.error(`Process ${processId}: Database size: ${dbSizeMB.toFixed(2)}MB`)
  
  console.log(JSON.stringify({
    processId,
    writeOpsPerSec,
    readOpsPerSec,
    rangeQueriesPerSec,
    mixedOpsPerSec,
    totalRecords: finalCount.count,
    dbSizeMB
  }))
  
  db.close()
}

runWorker().catch(error => {
  console.error('Worker error:', error)
  process.exit(1)
})