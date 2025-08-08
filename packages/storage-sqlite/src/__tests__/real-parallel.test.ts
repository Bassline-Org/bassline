/**
 * Real Parallel Process Benchmarking
 * 
 * Demonstrates true parallel scaling by spawning multiple Node.js processes,
 * each with its own SQLite database and propagation network.
 */

import { describe, it, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'
import { join } from 'path'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { SQLiteStorage } from '../index.js'
import { brand } from '@bassline/core'

interface WorkerResult {
  processId: string
  opsCount: number
  duration: number
  opsPerSec: number
}

describe('Real Parallel Process Performance', { timeout: 60000 }, () => {
  const testDir = '/tmp/bassline-parallel-test'
  
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })
  
  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })
  
  it('should demonstrate linear scaling with multiple processes', { timeout: 60000 }, async () => {
    // Test with different process counts
    const processCounts = [1, 2, 4, 6]
    const opsPerProcess = 5000  // Balanced workload
    
    console.log(`\n=== Real Parallel Process Benchmark ===`)
    console.log(`Testing with process counts: ${processCounts.join(', ')}`)
    console.log(`Each process will perform ${opsPerProcess} operations`)
    
    const results: { numProcesses: number; totalOps: number; duration: number; totalOpsPerSec: number; perProcessOpsPerSec: number; efficiency: number }[] = []
    
    for (const numProcesses of processCounts) {
      console.log(`\n--- Testing with ${numProcesses} processes ---`)
      const totalOps = numProcesses * opsPerProcess
    
    // Create worker script content
    const workerScript = `
      import { SQLiteStorage } from '@bassline/storage-sqlite'
      import { brand } from '@bassline/core'
      
      const processId = process.argv[2]
      const opsCount = parseInt(process.argv[3])
      
      async function runWorker() {
        const storage = new SQLiteStorage({
          options: {
            dataDir: '/tmp/bassline-parallel-test',
            filename: \`worker-\${processId}.db\`,
            mode: 'single',
            walMode: true,
            synchronous: 'OFF'
          }
        })
        
        await storage.initialize()
        
        const networkId = brand.networkId(\`network-\${processId}\`)
        const groupId = brand.groupId(\`group-\${processId}\`)
        
        const startTime = Date.now()
        
        // Perform operations
        for (let i = 0; i < opsCount; i++) {
          const contactId = brand.contactId(\`contact-\${i}\`)
          await storage.saveContactContent(
            networkId,
            groupId,
            contactId,
            { value: Math.random(), timestamp: Date.now() }
          )
        }
        
        const duration = Date.now() - startTime
        const opsPerSec = (opsCount / duration) * 1000
        
        console.log(JSON.stringify({
          processId,
          opsCount,
          duration,
          opsPerSec
        }))
        
        await storage.close()
      }
      
      runWorker().catch(console.error)
    `
    
    // Write worker script to a file
    const workerPath = join(testDir, 'worker.mjs')
    writeFileSync(workerPath, workerScript)
    
    const startTime = Date.now()
    
    // Use simple JS worker instead of TypeScript
    const simpleWorkerPath = join(import.meta.url.replace('file://', '').replace('/real-parallel.test.ts', ''), 'worker.cjs')
    
    // Spawn all processes
    const processes: Promise<WorkerResult>[] = []
    for (let i = 0; i < numProcesses; i++) {
      const process = spawn('node', [
        simpleWorkerPath,
        i.toString(),
        opsPerProcess.toString()
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
      
      processes.push(new Promise<WorkerResult>((resolve, reject) => {
        let output = ''
        
        process.stdout.on('data', (data) => {
          output += data.toString()
        })
        
        process.stderr.on('data', (data) => {
          console.error(`Process ${i} error:`, data.toString())
        })
        
        process.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Process ${i} exited with code ${code}`))
          } else {
            try {
              // Parse the last line which should be JSON
              const lines = output.trim().split('\n')
              const result = JSON.parse(lines[lines.length - 1]) as WorkerResult
              resolve(result)
            } catch (e) {
              reject(new Error(`Failed to parse output from process ${i}: ${output}`))
            }
          }
        })
      }))
    }
    
      // Wait for all processes to complete
      const workerResults = await Promise.all(processes)
      const totalDuration = Date.now() - startTime
      
      // Calculate aggregate metrics
      const totalOpsCompleted = workerResults.reduce((sum, r) => sum + r.opsCount, 0)
      const avgOpsPerSec = workerResults.reduce((sum, r) => sum + r.opsPerSec, 0) / numProcesses
      const totalOpsPerSec = (totalOpsCompleted / totalDuration) * 1000
      
      // Calculate efficiency based on single process baseline
      const singleProcessBaseline = results[0]?.perProcessOpsPerSec || avgOpsPerSec
      const efficiency = (totalOpsPerSec / (singleProcessBaseline * numProcesses)) * 100
      
      results.push({
        numProcesses,
        totalOps: totalOpsCompleted,
        duration: totalDuration,
        totalOpsPerSec,
        perProcessOpsPerSec: avgOpsPerSec,
        efficiency
      })
      
      console.log(`Completed in ${totalDuration}ms`)
      console.log(`Total throughput: ${totalOpsPerSec.toFixed(0)} ops/sec`)
      console.log(`Per-process average: ${avgOpsPerSec.toFixed(0)} ops/sec`)
      console.log(`Efficiency: ${efficiency.toFixed(1)}%`)
    }
    
    // Summary table
    console.log(`\n=== Scaling Summary ===`)
    console.log(`Processes | Total ops/sec | Per-process | Efficiency`)
    console.log(`----------|---------------|-------------|------------`)
    results.forEach(r => {
      console.log(`${r.numProcesses.toString().padEnd(9)} | ${r.totalOpsPerSec.toFixed(0).padEnd(13)} | ${r.perProcessOpsPerSec.toFixed(0).padEnd(11)} | ${r.efficiency.toFixed(1)}%`)
    })
    
    // Check if we're getting linear scaling
    const bestEfficiency = Math.max(...results.map(r => r.efficiency))
    console.log(`\n✅ Best efficiency: ${bestEfficiency.toFixed(1)}%`)
    console.log(`${bestEfficiency > 70 ? '🎉 Good parallel scaling!' : '⚠️ Parallel scaling could be better - check for contention'}`)
    
    // List database files to verify uniqueness
    const { readdirSync } = await import('fs')
    const dbFiles = readdirSync(testDir).filter(f => f.endsWith('.db')).sort()
    console.log(`\n📁 Database files created: ${dbFiles.length}`)
    console.log(`   ${dbFiles.slice(0, 5).join(', ')}${dbFiles.length > 5 ? '...' : ''}`)
  })
  
  it('should compare disk vs memory performance with batch transactions', { timeout: 60000 }, async () => {
    const processCounts = [1, 2, 4, 8]
    const opsPerProcess = 50000  // 50K operations per process with batching
    
    console.log(`\n=== Disk vs Memory Database Comparison ===`)
    console.log(`Testing with process counts: ${processCounts.join(', ')}`)
    console.log(`Each process will perform ${opsPerProcess} operations`)
    
    const diskResults: any[] = []
    const memoryResults: any[] = []
    
    // Use simple JS worker
    const simpleWorkerPath = join(import.meta.url.replace('file://', '').replace('/real-parallel.test.ts', ''), 'worker.cjs')
    
    // Test disk-based databases
    console.log(`\n--- DISK-BASED DATABASES ---`)
    for (const numProcesses of processCounts) {
      console.log(`Testing ${numProcesses} processes...`)
      const startTime = Date.now()
      
      const processes: Promise<WorkerResult>[] = []
      for (let i = 0; i < numProcesses; i++) {
        const process = spawn('node', [
          simpleWorkerPath,
          `disk-${i}`,
          opsPerProcess.toString(),
          'disk'
        ], {
          stdio: ['ignore', 'pipe', 'pipe']
        })
        
        processes.push(new Promise<WorkerResult>((resolve, reject) => {
          let output = ''
          process.stdout.on('data', (data) => output += data.toString())
          process.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Process exited with code ${code}`))
            else {
              try {
                const lines = output.trim().split('\n')
                const result = JSON.parse(lines[lines.length - 1]) as WorkerResult
                resolve(result)
              } catch (e) {
                reject(new Error(`Failed to parse output`))
              }
            }
          })
        }))
      }
      
      await Promise.all(processes)
      const duration = Date.now() - startTime
      const totalOpsPerSec = (numProcesses * opsPerProcess / duration) * 1000
      diskResults.push({ numProcesses, totalOpsPerSec, duration })
      console.log(`  ${totalOpsPerSec.toFixed(0)} ops/sec`)
    }
    
    // Test in-memory databases
    console.log(`\n--- IN-MEMORY DATABASES ---`)
    for (const numProcesses of processCounts) {
      console.log(`Testing ${numProcesses} processes...`)
      const startTime = Date.now()
      
      const processes: Promise<WorkerResult>[] = []
      for (let i = 0; i < numProcesses; i++) {
        const process = spawn('node', [
          simpleWorkerPath,
          `mem-${i}`,
          opsPerProcess.toString(),
          'memory'
        ], {
          stdio: ['ignore', 'pipe', 'pipe']
        })
        
        processes.push(new Promise<WorkerResult>((resolve, reject) => {
          let output = ''
          process.stdout.on('data', (data) => output += data.toString())
          process.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Process exited with code ${code}`))
            else {
              try {
                const lines = output.trim().split('\n')
                const result = JSON.parse(lines[lines.length - 1]) as WorkerResult
                resolve(result)
              } catch (e) {
                reject(new Error(`Failed to parse output`))
              }
            }
          })
        }))
      }
      
      await Promise.all(processes)
      const duration = Date.now() - startTime
      const totalOpsPerSec = (numProcesses * opsPerProcess / duration) * 1000
      memoryResults.push({ numProcesses, totalOpsPerSec, duration })
      console.log(`  ${totalOpsPerSec.toFixed(0)} ops/sec`)
    }
    
    // Comparison table
    console.log(`\n=== Performance Comparison ===`)
    console.log(`Procs | Disk ops/sec | Memory ops/sec | Memory speedup`)
    console.log(`------|--------------|----------------|---------------`)
    for (let i = 0; i < processCounts.length; i++) {
      const disk = diskResults[i]
      const mem = memoryResults[i]
      const speedup = mem.totalOpsPerSec / disk.totalOpsPerSec
      console.log(`${disk.numProcesses.toString().padEnd(5)} | ${disk.totalOpsPerSec.toFixed(0).padEnd(12)} | ${mem.totalOpsPerSec.toFixed(0).padEnd(14)} | ${speedup.toFixed(1)}x`)
    }
    
    // Scaling analysis
    console.log(`\n=== Scaling Analysis ===`)
    const diskScaling = diskResults[diskResults.length - 1].totalOpsPerSec / diskResults[0].totalOpsPerSec
    const memScaling = memoryResults[memoryResults.length - 1].totalOpsPerSec / memoryResults[0].totalOpsPerSec
    console.log(`Disk scaling (${processCounts[processCounts.length - 1]} vs 1 process): ${diskScaling.toFixed(1)}x`)
    console.log(`Memory scaling (${processCounts[processCounts.length - 1]} vs 1 process): ${memScaling.toFixed(1)}x`)
    console.log(`Memory eliminates I/O bottleneck: ${memScaling > diskScaling ? '✅ Yes' : '❌ No'}`)
  })
  
  it('should compare single vs multi-process performance', async () => {
    const totalOps = 10000
    
    console.log(`\n=== Single vs Multi-Process Comparison ===`)
    console.log(`Total operations: ${totalOps}`)
    
    // Single process benchmark
    const singleStorage = new SQLiteStorage({
      networkId: 'single-network',
      type: 'memory',
      options: {
        dataDir: testDir,
        filename: 'single-process.db',
        mode: 'single',
        walMode: true,
        synchronous: 'OFF'
      }
    } as any)
    
    const initResult = await singleStorage.initialize()
    if (!initResult.ok) {
      throw new Error(`Failed to initialize: ${initResult.error.message}`)
    }
    
    const networkId = brand.networkId('single-network')
    const groupId = brand.groupId('single-group')
    
    const singleStart = Date.now()
    for (let i = 0; i < totalOps; i++) {
      const contactId = brand.contactId(`contact-${i}`)
      await singleStorage.saveContactContent(
        networkId,
        groupId,
        contactId,
        { value: Math.random(), timestamp: Date.now() }
      )
    }
    const singleDuration = Date.now() - singleStart
    const singleOpsPerSec = (totalOps / singleDuration) * 1000
    
    await singleStorage.close()
    
    console.log(`\nSingle process: ${singleOpsPerSec.toFixed(0)} ops/sec (${singleDuration}ms)`)
    
    // Multi-process benchmark with different process counts
    const processCounts = [2, 4, 8]
    
    for (const numProcesses of processCounts) {
      const opsPerProcess = totalOps / numProcesses
      console.log(`\n--- Testing with ${numProcesses} processes (${opsPerProcess} ops each) ---`)
    
    // Use the simple JS worker
    const workerScriptPath = join(import.meta.url.replace('file://', '').replace('/real-parallel.test.ts', ''), 'worker.cjs')
    
    const multiStart = Date.now()
    const processes: Promise<WorkerResult>[] = []
    
    for (let i = 0; i < numProcesses; i++) {
      const process = spawn('node', [
        workerScriptPath,
        `multi-${i}`,
        opsPerProcess.toString()
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
      
      processes.push(new Promise<WorkerResult>((resolve, reject) => {
        let output = ''
        
        process.stdout.on('data', (data) => {
          output += data.toString()
        })
        
        process.stderr.on('data', (data) => {
          console.error(`Process multi-${i} error:`, data.toString())
        })
        
        process.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Process multi-${i} exited with code ${code}`))
          } else {
            try {
              const lines = output.trim().split('\n')
              const result = JSON.parse(lines[lines.length - 1]) as WorkerResult
              resolve(result)
            } catch (e) {
              reject(new Error(`Failed to parse output: ${output}`))
            }
          }
        })
      }))
    }
    
      const results = await Promise.all(processes)
      const multiDuration = Date.now() - multiStart
      const multiOpsPerSec = (totalOps / multiDuration) * 1000
      
      console.log(`Multi-process (${numProcesses} processes): ${multiOpsPerSec.toFixed(0)} ops/sec (${multiDuration}ms)`)
      console.log(`Speedup: ${(multiOpsPerSec / singleOpsPerSec).toFixed(1)}x`)
      console.log(`Efficiency: ${((multiOpsPerSec / singleOpsPerSec) / numProcesses * 100).toFixed(1)}%`)
    }
  })
})