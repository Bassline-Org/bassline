/**
 * Bottleneck Analysis Benchmark
 * Identifies what's limiting our throughput to ~20 MB/s
 */

import { describe, it, beforeAll, afterAll } from 'vitest'
import { Pool, PoolClient } from 'pg'
import { OptimizedPostgresStorage } from '../optimized-storage.js'
import { brand } from '@bassline/core'
import type { NetworkId } from '@bassline/core'

describe('Bottleneck Analysis', () => {
  let pool: Pool
  let networkId: NetworkId
  
  beforeAll(async () => {
    pool = new Pool({
      database: 'bassline_test',
      max: 50,
      // Performance tuning
      connectionTimeoutMillis: 0,
      idleTimeoutMillis: 0,
      statement_timeout: 0,
      query_timeout: 0,
    })
    
    networkId = brand.networkId(`bottleneck-${Date.now()}`)
    
    // Create the network and groups to satisfy foreign key constraints
    await pool.query(`INSERT INTO bassline_networks (id) VALUES ($1) ON CONFLICT DO NOTHING`, [networkId])
    
    console.log('\n🔍 === Bottleneck Analysis ===\n')
  })
  
  afterAll(async () => {
    await pool.query(`DELETE FROM bassline_contacts WHERE network_id = $1`, [networkId])
    await pool.query(`DELETE FROM bassline_groups WHERE network_id = $1`, [networkId])
    await pool.query(`DELETE FROM bassline_networks WHERE id = $1`, [networkId])
    await pool.end()
  })
  
  describe('Raw PostgreSQL Performance', () => {
    it('should measure raw INSERT performance', async () => {
      console.log('📊 Testing raw PostgreSQL INSERT performance...\n')
      
      const sizes = [1, 10, 100, 1000, 10000]
      const data = JSON.stringify({ 
        value: 42, 
        data: 'x'.repeat(700) // ~750 byte payload
      })
      
      for (const batchSize of sizes) {
        const groupId = brand.groupId(`raw-${batchSize}`)
        
        // Create the group first
        await pool.query(`
          INSERT INTO bassline_groups (network_id, group_id) 
          VALUES ($1, $2) 
          ON CONFLICT DO NOTHING
        `, [networkId, groupId])
        
        // Generate data arrays
        const ids = Array.from({ length: batchSize }, (_, i) => `raw-${i}`)
        const contents = Array(batchSize).fill(data)
        const modes = Array(batchSize).fill('accept-last')
        
        const startTime = performance.now()
        
        await pool.query(`
          INSERT INTO bassline_contacts (network_id, group_id, contact_id, content, blend_mode)
          SELECT $1, $2, unnest($3::text[]), unnest($4::jsonb[]), unnest($5::text[])
        `, [networkId, groupId, ids, contents, modes])
        
        const duration = performance.now() - startTime
        const totalBytes = data.length * batchSize
        const mbPerSec = (totalBytes / duration / 1024) // MB/s
        
        console.log(`Batch ${batchSize.toString().padStart(5)}:`)
        console.log(`  Time: ${duration.toFixed(2)}ms`)
        console.log(`  Throughput: ${mbPerSec.toFixed(2)} MB/s`)
        console.log(`  Rows/sec: ${((batchSize / duration) * 1000).toFixed(0)}`)
      }
    })
    
    it('should test with UNLOGGED table', async () => {
      console.log('\n📊 Testing with UNLOGGED table (no WAL)...\n')
      
      // Create unlogged table
      await pool.query(`
        CREATE UNLOGGED TABLE IF NOT EXISTS test_unlogged (
          id SERIAL PRIMARY KEY,
          data JSONB
        )
      `)
      
      const batchSize = 10000
      const data = JSON.stringify({ value: 42, data: 'x'.repeat(700) })
      const contents = Array(batchSize).fill(data)
      
      const startTime = performance.now()
      
      await pool.query(`
        INSERT INTO test_unlogged (data)
        SELECT unnest($1::jsonb[])
      `, [contents])
      
      const duration = performance.now() - startTime
      const totalBytes = data.length * batchSize
      const mbPerSec = (totalBytes / duration / 1024)
      
      console.log('Unlogged table (10K batch):')
      console.log(`  Time: ${duration.toFixed(2)}ms`)
      console.log(`  Throughput: ${mbPerSec.toFixed(2)} MB/s`)
      console.log(`  Rows/sec: ${((batchSize / duration) * 1000).toFixed(0)}`)
      
      await pool.query(`DROP TABLE test_unlogged`)
    })
    
    it('should test with prepared statements', async () => {
      console.log('\n📊 Testing with prepared statements...\n')
      
      const client = await pool.connect()
      const groupId = brand.groupId('prepared')
      
      try {
        // Create the group first
        await client.query(`
          INSERT INTO bassline_groups (network_id, group_id) 
          VALUES ($1, $2) 
          ON CONFLICT DO NOTHING
        `, [networkId, groupId])
        
        // Prepare statement
        await client.query({
          name: 'insert-contacts',
          text: `
            INSERT INTO bassline_contacts (network_id, group_id, contact_id, content, blend_mode)
            SELECT $1, $2, unnest($3::text[]), unnest($4::jsonb[]), unnest($5::text[])
          `
        })
        
        const batchSize = 10000
        const data = JSON.stringify({ value: 42, data: 'x'.repeat(700) })
        const ids = Array.from({ length: batchSize }, (_, i) => `prep-${i}`)
        const contents = Array(batchSize).fill(data)
        const modes = Array(batchSize).fill('accept-last')
        
        const startTime = performance.now()
        
        await client.query({
          name: 'insert-contacts',
          values: [networkId, groupId, ids, contents, modes]
        })
        
        const duration = performance.now() - startTime
        const totalBytes = data.length * batchSize
        const mbPerSec = (totalBytes / duration / 1024)
        
        console.log('Prepared statement (10K batch):')
        console.log(`  Time: ${duration.toFixed(2)}ms`)
        console.log(`  Throughput: ${mbPerSec.toFixed(2)} MB/s`)
        console.log(`  Rows/sec: ${((batchSize / duration) * 1000).toFixed(0)}`)
      } finally {
        client.release()
      }
    })
    
    it('should test with COPY command', async () => {
      console.log('\n📊 Testing with COPY command (fastest possible)...\n')
      
      try {
        const { Writable } = await import('stream')
        const copyFrom = require('pg-copy-streams').from
      } catch (error) {
        console.log('COPY test skipped (pg-copy-streams not installed)')
        return
      }
      
      const { Writable } = await import('stream')
      const copyFrom = require('pg-copy-streams').from
      
      const client = await pool.connect()
      const groupId = brand.groupId('copy')
      
      try {
        const batchSize = 100000 // 100K rows
        const data = JSON.stringify({ value: 42, data: 'x'.repeat(700) })
        
        const startTime = performance.now()
        
        const stream = client.query(copyFrom(`
          COPY bassline_contacts (network_id, group_id, contact_id, content, blend_mode)
          FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N')
        `))
        
        // Write data to stream
        for (let i = 0; i < batchSize; i++) {
          const row = `${networkId}\t${groupId}\tcopy-${i}\t${data}\taccept-last\n`
          stream.write(row)
        }
        stream.end()
        
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve)
          stream.on('error', reject)
        })
        
        const duration = performance.now() - startTime
        const totalBytes = data.length * batchSize
        const mbPerSec = (totalBytes / duration / 1024)
        
        console.log('COPY command (100K batch):')
        console.log(`  Time: ${duration.toFixed(2)}ms`)
        console.log(`  Throughput: ${mbPerSec.toFixed(2)} MB/s`)
        console.log(`  Rows/sec: ${((batchSize / duration) * 1000).toFixed(0)}`)
      } catch (error) {
        console.log('COPY test failed (pg-copy-streams not available):', error.message)
      } finally {
        client.release()
      }
    })
  })
  
  describe('Connection Pool Analysis', () => {
    it('should test different pool sizes', async () => {
      console.log('\n📊 Testing connection pool impact...\n')
      
      for (const poolSize of [1, 10, 50, 100]) {
        const testPool = new Pool({
          database: 'bassline_test',
          max: poolSize,
        })
        
        const storage = new OptimizedPostgresStorage({
          options: {
            database: 'bassline_test',
            poolSize: poolSize,
          }
        })
        
        await storage.initialize()
        
        const batchSize = 1000
        const parallelism = Math.min(poolSize, 20)
        const data = JSON.stringify({ value: 42, data: 'x'.repeat(700) })
        
        const startTime = performance.now()
        
        const promises = Array.from({ length: parallelism }, async (_, worker) => {
          const groupId = brand.groupId(`pool-${poolSize}-${worker}`)
          const contacts = new Map()
          
          for (let i = 0; i < batchSize / parallelism; i++) {
            const idx = worker * (batchSize / parallelism) + i
            contacts.set(brand.contactId(`pool-${idx}`), {
              id: brand.contactId(`pool-${idx}`),
              content: JSON.parse(data),
              blendMode: 'accept-last'
            })
          }
          
          await storage.batchSaveContacts(networkId, groupId, contacts)
        })
        
        await Promise.all(promises)
        
        const duration = performance.now() - startTime
        const totalBytes = data.length * batchSize
        const mbPerSec = (totalBytes / duration / 1024)
        
        console.log(`Pool size ${poolSize.toString().padStart(3)} (${parallelism} workers):`)
        console.log(`  Time: ${duration.toFixed(2)}ms`)
        console.log(`  Throughput: ${mbPerSec.toFixed(2)} MB/s`)
        console.log(`  Rows/sec: ${((batchSize / duration) * 1000).toFixed(0)}`)
        
        await storage.close()
        await testPool.end()
      }
    })
  })
  
  describe('JSONB vs Text Performance', () => {
    it('should compare JSONB vs TEXT column performance', async () => {
      console.log('\n📊 Testing JSONB vs TEXT storage...\n')
      
      // Create test tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS test_jsonb (
          id SERIAL PRIMARY KEY,
          data JSONB
        )
      `)
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS test_text (
          id SERIAL PRIMARY KEY,
          data TEXT
        )
      `)
      
      const batchSize = 10000
      const data = JSON.stringify({ value: 42, data: 'x'.repeat(700) })
      const jsonbData = Array(batchSize).fill(data)
      const textData = Array(batchSize).fill(data)
      
      // Test JSONB
      const jsonbStart = performance.now()
      await pool.query(`
        INSERT INTO test_jsonb (data)
        SELECT unnest($1::jsonb[])
      `, [jsonbData])
      const jsonbDuration = performance.now() - jsonbStart
      
      // Test TEXT
      const textStart = performance.now()
      await pool.query(`
        INSERT INTO test_text (data)
        SELECT unnest($1::text[])
      `, [textData])
      const textDuration = performance.now() - textStart
      
      const totalBytes = data.length * batchSize
      
      console.log('JSONB column (10K batch):')
      console.log(`  Time: ${jsonbDuration.toFixed(2)}ms`)
      console.log(`  Throughput: ${(totalBytes / jsonbDuration / 1024).toFixed(2)} MB/s`)
      
      console.log('\nTEXT column (10K batch):')
      console.log(`  Time: ${textDuration.toFixed(2)}ms`)
      console.log(`  Throughput: ${(totalBytes / textDuration / 1024).toFixed(2)} MB/s`)
      console.log(`  Speedup: ${(jsonbDuration / textDuration).toFixed(2)}x`)
      
      // Check storage sizes
      const jsonbSize = await pool.query(`
        SELECT pg_size_pretty(pg_total_relation_size('test_jsonb')) as size,
               pg_total_relation_size('test_jsonb') as bytes
      `)
      
      const textSize = await pool.query(`
        SELECT pg_size_pretty(pg_total_relation_size('test_text')) as size,
               pg_total_relation_size('test_text') as bytes
      `)
      
      console.log('\nStorage comparison:')
      console.log(`  JSONB: ${jsonbSize.rows[0].size}`)
      console.log(`  TEXT:  ${textSize.rows[0].size}`)
      console.log(`  JSONB overhead: ${((jsonbSize.rows[0].bytes / textSize.rows[0].bytes - 1) * 100).toFixed(1)}%`)
      
      await pool.query(`DROP TABLE test_jsonb`)
      await pool.query(`DROP TABLE test_text`)
    })
  })
  
  describe('System Bottlenecks', () => {
    it('should identify system-level bottlenecks', async () => {
      console.log('\n📊 System bottleneck analysis...\n')
      
      // Check PostgreSQL settings
      const settings = await pool.query(`
        SELECT name, setting, unit, short_desc
        FROM pg_settings
        WHERE name IN (
          'shared_buffers',
          'effective_cache_size',
          'work_mem',
          'maintenance_work_mem',
          'checkpoint_segments',
          'checkpoint_completion_target',
          'wal_buffers',
          'max_wal_size',
          'random_page_cost',
          'effective_io_concurrency',
          'max_worker_processes',
          'max_parallel_workers_per_gather',
          'max_parallel_workers',
          'synchronous_commit',
          'fsync'
        )
        ORDER BY name
      `)
      
      console.log('Key PostgreSQL settings:')
      for (const row of settings.rows) {
        const value = row.unit ? `${row.setting} ${row.unit}` : row.setting
        console.log(`  ${row.name}: ${value}`)
      }
      
      // Test with synchronous_commit off
      console.log('\n📊 Testing with synchronous_commit = off...\n')
      
      await pool.query(`SET synchronous_commit = off`)
      
      const batchSize = 10000
      const data = JSON.stringify({ value: 42, data: 'x'.repeat(700) })
      const groupId = brand.groupId('sync-off')
      
      // Create the group first
      await pool.query(`
        INSERT INTO bassline_groups (network_id, group_id) 
        VALUES ($1, $2) 
        ON CONFLICT DO NOTHING
      `, [networkId, groupId])
      
      const ids = Array.from({ length: batchSize }, (_, i) => `sync-${i}`)
      const contents = Array(batchSize).fill(data)
      const modes = Array(batchSize).fill('accept-last')
      
      const startTime = performance.now()
      
      await pool.query(`
        INSERT INTO bassline_contacts (network_id, group_id, contact_id, content, blend_mode)
        SELECT $1, $2, unnest($3::text[]), unnest($4::jsonb[]), unnest($5::text[])
      `, [networkId, groupId, ids, contents, modes])
      
      const duration = performance.now() - startTime
      const totalBytes = data.length * batchSize
      const mbPerSec = (totalBytes / duration / 1024)
      
      console.log('With synchronous_commit = off (10K batch):')
      console.log(`  Time: ${duration.toFixed(2)}ms`)
      console.log(`  Throughput: ${mbPerSec.toFixed(2)} MB/s`)
      console.log(`  Rows/sec: ${((batchSize / duration) * 1000).toFixed(0)}`)
      
      await pool.query(`SET synchronous_commit = on`)
    })
  })
})