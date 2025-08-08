#!/usr/bin/env node
/**
 * Worker script for parallel process testing
 * Run with: node --loader tsx worker-script.ts <processId> <opsCount>
 */

import { SQLiteStorage } from '../index.js'
import { brand } from '@bassline/core'

const processId = process.argv[2]
const opsCount = parseInt(process.argv[3])

if (!processId || !opsCount) {
  console.error('Usage: worker-script.ts <processId> <opsCount>')
  process.exit(1)
}

async function runWorker() {
  const storage = new SQLiteStorage({
    type: 'memory',
    options: {
      dataDir: '/tmp/bassline-parallel-test',
      filename: `worker-${processId}.db`,
      mode: 'single',
      walMode: true,
      synchronous: 'OFF'
    }
  })
  
  await storage.initialize()
  
  const networkId = brand.networkId(`network-${processId}`)
  const groupId = brand.groupId(`group-${processId}`)
  
  const startTime = Date.now()
  
  // Perform operations
  for (let i = 0; i < opsCount; i++) {
    const contactId = brand.contactId(`contact-${i}`)
    await storage.saveContactContent(
      networkId,
      groupId,
      contactId,
      { value: Math.random(), timestamp: Date.now(), process: processId }
    )
  }
  
  const duration = Date.now() - startTime
  const opsPerSec = (opsCount / duration) * 1000
  
  // Output JSON result
  console.log(JSON.stringify({
    processId,
    opsCount,
    duration,
    opsPerSec
  }))
  
  await storage.close()
}

runWorker().catch(error => {
  console.error('Worker error:', error)
  process.exit(1)
})