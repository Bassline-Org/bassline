#!/usr/bin/env node

// Worker process for parallel database operations
const { Pool } = require('pg')

const workerNum = parseInt(process.argv[2])
const batchSize = parseInt(process.argv[3])
const iterations = parseInt(process.argv[4])

async function runWorker() {
  const pool = new Pool({
    database: 'bassline_test',
    max: 10
  })

  const networkId = 'multiprocess-test'
  const times = []

  try {
    for (let i = 0; i < iterations; i++) {
      const groupId = `worker-${workerNum}-iter-${i}`
      const batchData = []
      
      for (let j = 0; j < batchSize; j++) {
        batchData.push({
          network_id: networkId,
          group_id: groupId,
          contact_id: `w${workerNum}-i${i}-item${j}`,
          content_value: JSON.stringify({ 
            worker: workerNum,
            iteration: i,
            item: j,
            pid: process.pid,
            timestamp: Date.now()
          }),
          content_type: 'json'
        })
      }

      const client = await pool.connect()
      const start = Date.now()
      
      await client.query(
        `SELECT batch_append_unlogged($1::jsonb[])`,
        [batchData]
      )
      
      const elapsed = Date.now() - start
      times.push(elapsed)
      client.release()
    }

    await pool.end()
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length
    const totalOps = batchSize * iterations
    
    console.log(JSON.stringify({
      worker: workerNum,
      pid: process.pid,
      times,
      avgTime,
      totalOps,
      opsPerSecond: Math.round(totalOps / (times.reduce((a, b) => a + b, 0) / 1000))
    }))
    
    process.exit(0)
  } catch (error) {
    console.error(JSON.stringify({
      worker: workerNum,
      error: error.message
    }))
    process.exit(1)
  }
}

runWorker()