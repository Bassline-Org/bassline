#!/usr/bin/env node
/**
 * Worker script with data verification
 * Writes data, then verifies it's actually stored correctly
 */

const Database = require('better-sqlite3')
const { join } = require('path')
const crypto = require('crypto')

const processId = process.argv[2]
const opsCount = parseInt(process.argv[3])
const useMemory = process.argv[4] === 'memory'

if (!processId || !opsCount) {
  console.error('Usage: worker-verify.js <processId> <opsCount> [memory]')
  process.exit(1)
}

async function runWorker() {
  const initStartTime = Date.now()
  let db
  
  if (useMemory) {
    db = new Database(':memory:')
    console.error(`Process ${processId}: Using in-memory database`)
  } else {
    const { mkdirSync } = require('fs')
    const dbDir = join('/tmp/bassline-parallel-test', `worker-${processId}`)
    mkdirSync(dbDir, { recursive: true })
    
    const dbPath = join(dbDir, 'database.db')
    console.error(`Process ${processId}: Using database ${dbPath}`)
    
    db = new Database(dbPath)
  }
  
  // Optimize for speed
  db.pragma('page_size = 16384')  // 16KB pages
  db.pragma('cache_size = 8192')   // 128MB cache
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = OFF')
  db.pragma('temp_store = MEMORY')
  
  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      network_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      content TEXT,
      blend_mode TEXT,
      checksum TEXT,
      PRIMARY KEY (network_id, group_id, contact_id)
    )
  `)
  
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO contacts (network_id, group_id, contact_id, content, blend_mode, checksum)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  const networkId = `network-${processId}`
  const groupId = `group-${processId}`
  
  // Store checksums for verification
  const checksums = new Map()
  
  console.error(`Process ${processId}: Starting write phase...`)
  
  // === WRITE PHASE (TIMED) ===
  const startTime = Date.now()
  
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
          contact.checksum
        )
      }
    })
    
    // Prepare batch data with checksums
    const contacts = []
    const start = batch * batchSize
    const end = Math.min(start + batchSize, opsCount)
    
    for (let i = start; i < end; i++) {
      const contactId = `contact-${i}`
      const content = JSON.stringify({ 
        value: Math.random(), 
        timestamp: Date.now(), 
        process: processId,
        batch: batch,
        index: i,
        data: `This is test data for contact ${i} in process ${processId}`
      })
      
      // Calculate checksum
      const checksum = crypto.createHash('md5').update(content).digest('hex')
      checksums.set(contactId, { content, checksum })
      
      contacts.push({
        id: contactId,
        content: content,
        checksum: checksum
      })
    }
    
    // Execute batch transaction
    insertMany(contacts)
  }
  
  const writeDuration = Date.now() - startTime
  const opsPerSec = (opsCount / writeDuration) * 1000
  
  console.error(`Process ${processId}: Write phase completed in ${writeDuration}ms (${opsPerSec.toFixed(0)} ops/sec)`)
  
  // === VERIFICATION PHASE (NOT TIMED) ===
  console.error(`Process ${processId}: Starting verification phase...`)
  
  const verifyStart = Date.now()
  
  // 1. Verify record count
  const countResult = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE network_id = ?').get(networkId)
  if (countResult.count !== opsCount) {
    throw new Error(`Count mismatch! Expected ${opsCount}, got ${countResult.count}`)
  }
  
  // 2. Verify random sample of records
  const sampleSize = Math.min(1000, opsCount)
  const sampleIndices = new Set()
  while (sampleIndices.size < sampleSize) {
    sampleIndices.add(Math.floor(Math.random() * opsCount))
  }
  
  const selectStmt = db.prepare(`
    SELECT content, checksum FROM contacts 
    WHERE network_id = ? AND group_id = ? AND contact_id = ?
  `)
  
  let verifiedCount = 0
  let errors = 0
  
  for (const index of sampleIndices) {
    const contactId = `contact-${index}`
    const expected = checksums.get(contactId)
    
    if (!expected) {
      console.error(`Process ${processId}: No checksum found for ${contactId}`)
      errors++
      continue
    }
    
    const row = selectStmt.get(networkId, groupId, contactId)
    
    if (!row) {
      console.error(`Process ${processId}: Record not found: ${contactId}`)
      errors++
      continue
    }
    
    // Verify checksum
    const actualChecksum = crypto.createHash('md5').update(row.content).digest('hex')
    if (actualChecksum !== row.checksum) {
      console.error(`Process ${processId}: Checksum mismatch for ${contactId}`)
      errors++
      continue
    }
    
    // Verify content matches
    if (row.content !== expected.content) {
      console.error(`Process ${processId}: Content mismatch for ${contactId}`)
      errors++
      continue
    }
    
    verifiedCount++
  }
  
  const verifyDuration = Date.now() - verifyStart
  
  // 3. Verify database integrity
  const integrityCheck = db.pragma('integrity_check')
  const integrityOk = integrityCheck[0].integrity_check === 'ok'
  
  // Get database stats
  const pageCount = db.pragma('page_count')[0].page_count
  const pageSize = db.pragma('page_size')[0].page_size
  const dbSizeMB = (pageCount * pageSize) / (1024 * 1024)
  
  console.error(`Process ${processId}: Verification completed in ${verifyDuration}ms`)
  console.error(`Process ${processId}: Verified ${verifiedCount}/${sampleSize} samples, ${errors} errors`)
  console.error(`Process ${processId}: Database integrity: ${integrityOk ? 'OK' : 'FAILED'}`)
  console.error(`Process ${processId}: Database size: ${dbSizeMB.toFixed(2)}MB`)
  
  // Output JSON result
  console.log(JSON.stringify({
    processId,
    opsCount,
    writeDuration,
    opsPerSec,
    recordCount: countResult.count,
    samplesVerified: verifiedCount,
    sampleErrors: errors,
    integrityOk,
    dbSizeMB,
    verifyDuration
  }))
  
  db.close()
  
  if (errors > 0 || !integrityOk) {
    process.exit(1)
  }
}

runWorker().catch(error => {
  console.error('Worker error:', error)
  process.exit(1)
})