import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { Pool } from 'pg'

describe('Extreme Batch Performance - How Far Can We Go?', () => {
  let pool: Pool
  let networkId: NetworkId
  
  beforeAll(async () => {
    pool = new Pool({ 
      database: 'bassline_test', 
      max: 100,  // More connections for extreme batching
      // Aggressive performance settings
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 30000
    })
    
    networkId = brand.networkId('extreme-batch-test')
    
    // Set maximum performance settings
    const client = await pool.connect()
    await client.query(`
      SET synchronous_commit = OFF;
      SET work_mem = '512MB';
      SET maintenance_work_mem = '2GB';
      SET max_parallel_workers_per_gather = 8;
      SET effective_cache_size = '4GB';
    `)
    client.release()
  })
  
  afterAll(async () => {
    await pool.end()
  })

  describe('Batch Size Scaling', () => {
    it('should test increasingly large batch sizes', async () => {
      const batchSizes = [
        1000,
        5000,
        10000,
        25000,
        50000,
        100000,
        250000,
        500000,
        1000000  // 1 million!
      ]
      
      console.log('\n=== BATCH SIZE SCALING TEST ===')
      console.log('Testing how performance scales with batch size\n')
      
      const results = []
      
      for (const batchSize of batchSizes) {
        console.log(`\nBatch size: ${batchSize.toLocaleString()}`)
        
        // Prepare batch data efficiently
        const batchData = []
        const groupId = brand.groupId(`batch-${batchSize}`)
        
        for (let i = 0; i < batchSize; i++) {
          batchData.push({
            network_id: networkId,
            group_id: groupId,
            contact_id: brand.contactId(`extreme-${i}`),
            content_value: JSON.stringify({ 
              id: i,
              batch: batchSize,
              data: `Item ${i}`
            }),
            content_type: 'json'
          })
        }
        
        const client = await pool.connect()
        
        try {
          // Test 1: Regular batch append
          const regularStart = performance.now()
          await client.query(
            `SELECT batch_append_values($1::jsonb[])`,
            [batchData]
          )
          const regularTime = performance.now() - regularStart
          
          console.log(`  Regular batch: ${regularTime.toFixed(2)}ms`)
          console.log(`  Per operation: ${(regularTime/batchSize).toFixed(4)}ms`)
          console.log(`  Ops/second: ${Math.round(batchSize/(regularTime/1000)).toLocaleString()}`)
          
          // Test 2: Unlogged batch append  
          const unloggedData = batchData.map(d => ({
            ...d,
            contact_id: `${d.contact_id}-unlogged`
          }))
          
          const unloggedStart = performance.now()
          await client.query(
            `SELECT batch_append_unlogged($1::jsonb[])`,
            [unloggedData]
          )
          const unloggedTime = performance.now() - unloggedStart
          
          console.log(`  Unlogged batch: ${unloggedTime.toFixed(2)}ms`)
          console.log(`  Per operation: ${(unloggedTime/batchSize).toFixed(4)}ms`)
          console.log(`  Ops/second: ${Math.round(batchSize/(unloggedTime/1000)).toLocaleString()}`)
          
          results.push({
            batchSize,
            regularTime,
            unloggedTime,
            regularOpsPerSec: Math.round(batchSize/(regularTime/1000)),
            unloggedOpsPerSec: Math.round(batchSize/(unloggedTime/1000))
          })
          
          // Stop if it's taking too long
          if (regularTime > 10000 || unloggedTime > 10000) {
            console.log('\n⚠️  Batch operations taking >10s, stopping test')
            break
          }
        } catch (error: any) {
          console.error(`  ❌ Failed at batch size ${batchSize}: ${error.message}`)
          break
        } finally {
          client.release()
        }
      }
      
      // Summary
      console.log('\n=== PERFORMANCE SUMMARY ===\n')
      console.log('Batch Size | Regular Ops/s | Unlogged Ops/s | Speedup')
      console.log('-----------|---------------|----------------|--------')
      
      for (const r of results) {
        const speedup = ((r.unloggedOpsPerSec / r.regularOpsPerSec - 1) * 100).toFixed(0)
        console.log(
          `${r.batchSize.toString().padEnd(10)} | ` +
          `${r.regularOpsPerSec.toLocaleString().padEnd(13)} | ` +
          `${r.unloggedOpsPerSec.toLocaleString().padEnd(14)} | ` +
          `${speedup}%`
        )
      }
      
      // Find optimal batch size
      const optimalRegular = results.reduce((a, b) => 
        a.regularOpsPerSec > b.regularOpsPerSec ? a : b
      )
      const optimalUnlogged = results.reduce((a, b) => 
        a.unloggedOpsPerSec > b.unloggedOpsPerSec ? a : b
      )
      
      console.log('\n=== OPTIMAL BATCH SIZES ===')
      console.log(`Regular: ${optimalRegular.batchSize.toLocaleString()} (${optimalRegular.regularOpsPerSec.toLocaleString()} ops/s)`)
      console.log(`Unlogged: ${optimalUnlogged.batchSize.toLocaleString()} (${optimalUnlogged.unloggedOpsPerSec.toLocaleString()} ops/s)`)
    })

    it('should test ultra-large single batch with COPY approach', async () => {
      console.log('\n=== ULTRA-LARGE BATCH WITH COPY ===')
      
      const client = await pool.connect()
      
      try {
        // Create a massive batch
        const batchSize = 1000000  // 1 million records
        console.log(`\nPreparing ${batchSize.toLocaleString()} records...`)
        
        const groupId = brand.groupId('copy-test')
        
        // Use COPY for ultimate speed
        const copyStart = performance.now()
        
        // Start COPY command
        const copyStream = `
          COPY bassline_contact_values_fast (
            network_id, group_id, contact_id, version, content_value, content_type
          ) FROM STDIN WITH (FORMAT csv)
        `
        
        // Generate CSV data in chunks
        const chunkSize = 100000
        let version = 1000000000  // Start with high version
        
        for (let chunk = 0; chunk < batchSize / chunkSize; chunk++) {
          const csvData = []
          
          for (let i = 0; i < chunkSize; i++) {
            const idx = chunk * chunkSize + i
            csvData.push(
              `${networkId},${groupId},copy-${idx},${version++},` +
              `"{\\"value\\": ${idx}}",json`
            )
          }
          
          // This would use pg-copy-streams in production
          // For now, we'll simulate with batch insert
          const batchData = []
          for (let i = 0; i < chunkSize; i++) {
            const idx = chunk * chunkSize + i
            batchData.push({
              network_id: networkId,
              group_id: groupId,
              contact_id: `copy-${idx}`,
              content_value: JSON.stringify({ value: idx }),
              content_type: 'json'
            })
          }
          
          await client.query(
            `SELECT batch_append_unlogged($1::jsonb[])`,
            [batchData]
          )
        }
        
        const copyTime = performance.now() - copyStart
        
        console.log(`\nResults:`)
        console.log(`  Time: ${copyTime.toFixed(2)}ms`)
        console.log(`  Records: ${batchSize.toLocaleString()}`)
        console.log(`  Ops/second: ${Math.round(batchSize/(copyTime/1000)).toLocaleString()}`)
        console.log(`  Per operation: ${(copyTime/batchSize).toFixed(6)}ms`)
        
        // Verify count
        const countResult = await client.query(`
          SELECT COUNT(*) as count 
          FROM bassline_contact_values_fast 
          WHERE group_id = $1
        `, [groupId])
        
        console.log(`  Verified count: ${countResult.rows[0].count}`)
        
      } finally {
        client.release()
      }
    })

    it('should test parallel batch insertion', async () => {
      console.log('\n=== PARALLEL BATCH INSERTION ===')
      console.log('Multiple connections inserting batches simultaneously\n')
      
      const parallelism = 10
      const batchSizePerWorker = 50000
      const totalRecords = parallelism * batchSizePerWorker
      
      console.log(`Workers: ${parallelism}`)
      console.log(`Batch per worker: ${batchSizePerWorker.toLocaleString()}`)
      console.log(`Total records: ${totalRecords.toLocaleString()}`)
      
      const promises = []
      const startTime = performance.now()
      
      for (let worker = 0; worker < parallelism; worker++) {
        promises.push((async () => {
          const client = await pool.connect()
          
          try {
            const batchData = []
            const groupId = brand.groupId(`parallel-${worker}`)
            
            for (let i = 0; i < batchSizePerWorker; i++) {
              batchData.push({
                network_id: networkId,
                group_id: groupId,
                contact_id: brand.contactId(`worker${worker}-item${i}`),
                content_value: JSON.stringify({ 
                  worker,
                  item: i,
                  timestamp: Date.now()
                }),
                content_type: 'json'
              })
            }
            
            await client.query(
              `SELECT batch_append_unlogged($1::jsonb[])`,
              [batchData]
            )
          } finally {
            client.release()
          }
        })())
      }
      
      await Promise.all(promises)
      const totalTime = performance.now() - startTime
      
      console.log(`\nResults:`)
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`)
      console.log(`  Total records: ${totalRecords.toLocaleString()}`)
      console.log(`  Ops/second: ${Math.round(totalRecords/(totalTime/1000)).toLocaleString()}`)
      console.log(`  Per operation: ${(totalTime/totalRecords).toFixed(6)}ms`)
    })

    it('should find the breaking point', async () => {
      console.log('\n=== FINDING THE BREAKING POINT ===')
      console.log('How many operations can we do in 1 second?\n')
      
      const client = await pool.connect()
      
      try {
        const targetTime = 1000  // 1 second
        let batchSize = 100000
        let lastSuccessful = 0
        let attempts = 0
        
        while (attempts < 10) {
          console.log(`\nAttempting ${batchSize.toLocaleString()} operations...`)
          
          const batchData = []
          const groupId = brand.groupId(`breaking-${attempts}`)
          
          for (let i = 0; i < batchSize; i++) {
            batchData.push({
              network_id: networkId,
              group_id: groupId,
              contact_id: `break-${i}`,
              content_value: JSON.stringify({ i }),
              content_type: 'json'
            })
          }
          
          const start = performance.now()
          await client.query(
            `SELECT batch_append_unlogged($1::jsonb[])`,
            [batchData]
          )
          const elapsed = performance.now() - start
          
          console.log(`  Time: ${elapsed.toFixed(2)}ms`)
          console.log(`  Ops/second: ${Math.round(batchSize/(elapsed/1000)).toLocaleString()}`)
          
          if (elapsed < targetTime) {
            lastSuccessful = batchSize
            // Increase batch size
            batchSize = Math.floor(batchSize * (targetTime / elapsed) * 0.95)  // 95% to be safe
            console.log(`  ✓ Under 1 second, trying larger batch...`)
          } else {
            console.log(`  ✗ Over 1 second`)
            break
          }
          
          attempts++
        }
        
        console.log(`\n=== MAXIMUM OPS IN 1 SECOND ===`)
        console.log(`Maximum batch size under 1 second: ${lastSuccessful.toLocaleString()}`)
        
      } finally {
        client.release()
      }
    })
  })
})