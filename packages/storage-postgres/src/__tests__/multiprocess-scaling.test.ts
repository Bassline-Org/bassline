import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'
import { Pool } from 'pg'
import * as path from 'path'

describe('Multi-Process Scaling - True Parallel Execution', () => {
  let pool: Pool
  
  beforeAll(async () => {
    pool = new Pool({ database: 'bassline_test', max: 10 })
    
    // Clean database
    console.log('🧹 Cleaning database for multi-process test...')
    const client = await pool.connect()
    
    try {
      // Truncate all tables for fresh start
      await client.query(`
        TRUNCATE TABLE bassline_contact_values CASCADE;
        TRUNCATE TABLE bassline_contact_values_fast CASCADE;
        TRUNCATE TABLE bassline_contact_versions CASCADE;
        TRUNCATE TABLE bassline_contact_versions_fast CASCADE;
        TRUNCATE TABLE bassline_propagation_log CASCADE;
        TRUNCATE TABLE bassline_hot_values CASCADE;
      `)
      
      console.log('✅ Database cleaned')
    } finally {
      client.release()
    }
  }, 60000)
  
  afterAll(async () => {
    await pool.end()
  }, 30000)

  function spawnWorker(workerNum: number, batchSize: number, iterations: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, 'worker-process.cjs')
      const worker = spawn('node', [workerPath, workerNum.toString(), batchSize.toString(), iterations.toString()])
      
      let output = ''
      
      worker.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      worker.stderr.on('data', (data) => {
        console.error(`Worker ${workerNum} error: ${data}`)
      })
      
      worker.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim())
            resolve(result)
          } catch (e) {
            reject(new Error(`Worker ${workerNum} invalid output: ${output}`))
          }
        } else {
          reject(new Error(`Worker ${workerNum} exited with code ${code}`))
        }
      })
    })
  }

  describe('True Multi-Process Scaling', () => {
    it('should test performance with separate OS processes', async () => {
      console.log('\n=== MULTI-PROCESS PARALLEL EXECUTION ===')
      console.log('Each worker runs in a separate OS process\n')
      
      const processCounts = [1, 2, 4, 8, 16]
      const batchSize = 25000
      const iterationsPerProcess = 5
      
      for (const numProcesses of processCounts) {
        console.log(`\n--- Testing with ${numProcesses} separate processes ---`)
        
        const startTime = Date.now()
        const promises = []
        
        for (let i = 0; i < numProcesses; i++) {
          promises.push(spawnWorker(i, batchSize, iterationsPerProcess))
        }
        
        try {
          const results = await Promise.all(promises)
          const totalTime = Date.now() - startTime
          const totalOps = numProcesses * iterationsPerProcess * batchSize
          
          // Collect PIDs to show true multi-process
          const pids = new Set(results.map(r => r.pid))
          
          // Calculate statistics
          const avgTimes = results.map(r => r.avgTime)
          const overallAvg = avgTimes.reduce((a, b) => a + b) / avgTimes.length
          const minTime = Math.min(...avgTimes)
          const maxTime = Math.max(...avgTimes)
          
          console.log(`\nResults for ${numProcesses} processes:`)
          console.log(`  Unique PIDs: ${Array.from(pids).join(', ')}`)
          console.log(`  Total time: ${totalTime}ms`)
          console.log(`  Total operations: ${totalOps.toLocaleString()}`)
          console.log(`  Aggregate ops/second: ${Math.round(totalOps/(totalTime/1000)).toLocaleString()}`)
          console.log(`  Average process time: ${overallAvg.toFixed(2)}ms`)
          console.log(`  Min process time: ${minTime.toFixed(2)}ms`)
          console.log(`  Max process time: ${maxTime.toFixed(2)}ms`)
          console.log(`  Time variance: ${((maxTime - minTime) / minTime * 100).toFixed(1)}%`)
          
          // Per-process stats
          console.log(`\n  Per-process performance:`)
          for (const result of results) {
            console.log(`    Process ${result.worker} (PID ${result.pid}): ${result.opsPerSecond.toLocaleString()} ops/s`)
          }
        } catch (error: any) {
          console.error(`  Failed with ${numProcesses} processes: ${error.message}`)
        }
      }
    }, 300000)  // 5 minute timeout

    it('should test CPU core saturation', async () => {
      console.log('\n=== CPU CORE SATURATION TEST ===')
      
      // Get CPU info
      const os = await import('os')
      const numCPUs = os.cpus().length
      console.log(`System has ${numCPUs} CPU cores\n`)
      
      // Test with different core utilization levels
      const coreTests = [
        { processes: Math.floor(numCPUs / 2), label: '50% cores' },
        { processes: numCPUs, label: '100% cores' },
        { processes: numCPUs * 2, label: '200% cores (oversubscribed)' },
        { processes: numCPUs * 4, label: '400% cores (heavily oversubscribed)' }
      ]
      
      const batchSize = 20000
      const iterations = 3
      
      for (const test of coreTests) {
        console.log(`\nTesting with ${test.processes} processes (${test.label})...`)
        
        const startTime = Date.now()
        const promises = []
        
        for (let i = 0; i < test.processes; i++) {
          promises.push(spawnWorker(i, batchSize, iterations))
        }
        
        try {
          const results = await Promise.all(promises)
          const totalTime = Date.now() - startTime
          const totalOps = test.processes * iterations * batchSize
          
          const totalOpsPerSec = results.reduce((sum, r) => sum + r.opsPerSecond, 0)
          
          console.log(`  Total time: ${totalTime}ms`)
          console.log(`  Total operations: ${totalOps.toLocaleString()}`)
          console.log(`  Aggregate ops/second: ${Math.round(totalOps/(totalTime/1000)).toLocaleString()}`)
          console.log(`  Sum of individual ops/sec: ${totalOpsPerSec.toLocaleString()}`)
          console.log(`  Efficiency: ${((totalOps/(totalTime/1000)) / (totalOpsPerSec / test.processes) * 100).toFixed(1)}%`)
        } catch (error: any) {
          console.error(`  Failed: ${error.message}`)
        }
      }
    }, 300000)

    it('should find maximum sustainable throughput', async () => {
      console.log('\n=== MAXIMUM SUSTAINABLE THROUGHPUT ===')
      console.log('Finding the maximum ops/second the system can sustain\n')
      
      let bestConfig = { processes: 0, batchSize: 0, opsPerSec: 0 }
      
      // Test different configurations
      const configs = [
        { processes: 1, batchSize: 100000 },
        { processes: 2, batchSize: 50000 },
        { processes: 4, batchSize: 25000 },
        { processes: 8, batchSize: 12500 },
        { processes: 16, batchSize: 6250 },
      ]
      
      for (const config of configs) {
        console.log(`Testing ${config.processes} processes × ${config.batchSize} batch size...`)
        
        const startTime = Date.now()
        const promises = []
        
        for (let i = 0; i < config.processes; i++) {
          promises.push(spawnWorker(i, config.batchSize, 1))
        }
        
        try {
          const results = await Promise.all(promises)
          const totalTime = Date.now() - startTime
          const totalOps = config.processes * config.batchSize
          const opsPerSec = Math.round(totalOps / (totalTime / 1000))
          
          console.log(`  Result: ${opsPerSec.toLocaleString()} ops/second`)
          
          if (opsPerSec > bestConfig.opsPerSec) {
            bestConfig = { ...config, opsPerSec }
          }
        } catch (error: any) {
          console.error(`  Failed: ${error.message}`)
        }
      }
      
      console.log('\n=== OPTIMAL CONFIGURATION ===')
      console.log(`Best performance: ${bestConfig.opsPerSec.toLocaleString()} ops/second`)
      console.log(`Configuration: ${bestConfig.processes} processes × ${bestConfig.batchSize} batch size`)
    }, 300000)

    it('should show database statistics after load', async () => {
      console.log('\n=== POST-LOAD DATABASE STATISTICS ===\n')
      
      const client = await pool.connect()
      
      try {
        // Count total records
        const countResult = await client.query(`
          SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT (network_id, group_id, contact_id)) as unique_contacts,
            MAX(version) as max_version
          FROM bassline_contact_values_fast
        `)
        
        if (countResult.rows.length > 0) {
          const stats = countResult.rows[0]
          console.log('Data Statistics:')
          console.log(`  Total records: ${parseInt(stats.total_records).toLocaleString()}`)
          console.log(`  Unique contacts: ${parseInt(stats.unique_contacts).toLocaleString()}`)
          console.log(`  Max version: ${parseInt(stats.max_version || 0).toLocaleString()}`)
        }
        
        // Table sizes
        const sizeResult = await client.query(`
          SELECT 
            'contact_values_fast' as table_name,
            pg_size_pretty(pg_total_relation_size('bassline_contact_values_fast')) as size,
            (SELECT COUNT(*) FROM bassline_contact_values_fast) as row_count
          UNION ALL
          SELECT 
            'contact_values' as table_name,
            pg_size_pretty(pg_total_relation_size('bassline_contact_values')) as size,
            (SELECT COUNT(*) FROM bassline_contact_values) as row_count
        `)
        
        console.log('\nTable Sizes:')
        for (const row of sizeResult.rows) {
          console.log(`  ${row.table_name}: ${row.size} (${parseInt(row.row_count || 0).toLocaleString()} rows)`)
        }
        
        // Connection stats
        const connResult = await client.query(`
          SELECT 
            max_conn,
            used,
            res_for_super,
            max_conn - used - res_for_super AS available
          FROM 
            (SELECT COUNT(*) used FROM pg_stat_activity) t1,
            (SELECT setting::int res_for_super FROM pg_settings WHERE name = 'superuser_reserved_connections') t2,
            (SELECT setting::int max_conn FROM pg_settings WHERE name = 'max_connections') t3
        `)
        
        if (connResult.rows.length > 0) {
          const conn = connResult.rows[0]
          console.log('\nConnection Pool:')
          console.log(`  Max connections: ${conn.max_conn}`)
          console.log(`  Used: ${conn.used}`)
          console.log(`  Available: ${conn.available}`)
        }
        
      } finally {
        client.release()
      }
    }, 60000)
  })
})