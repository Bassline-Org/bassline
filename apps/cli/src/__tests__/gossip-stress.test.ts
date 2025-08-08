/**
 * Gossip Protocol Stress Tests
 * Tests network behavior under adverse conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GossipLayer } from '../runtime/GossipLayer'
import { createFilesystemStorage } from '@bassline/storage-filesystem'
import { createMemoryStorage } from '@bassline/storage-memory'
import * as fs from 'fs/promises'

describe('Gossip stress tests', () => {
  let nodes: GossipLayer[] = []
  
  beforeEach(async () => {
    // Clean up
    await fs.rm('./test-gossip-stress', { recursive: true, force: true }).catch(() => {})
  })
  
  afterEach(async () => {
    // Clean up all nodes
    await Promise.all(nodes.map(n => n.stop()))
    nodes = []
    await fs.rm('./test-gossip-stress', { recursive: true, force: true }).catch(() => {})
  })

  it('should handle high-throughput updates (100 contacts, 3 nodes)', { timeout: 30000 }, async () => {
    console.log('\n=== HIGH THROUGHPUT TEST ===')
    console.log('Creating 3 nodes with mixed storage backends...')
    
    // Create 3 nodes with different storage
    nodes = [
      new GossipLayer({
        id: 'node1',
        port: 9001,
        storage: createMemoryStorage(),
        syncInterval: 300,
        peerExchangeInterval: 1000
      }),
      new GossipLayer({
        id: 'node2', 
        port: 9002,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9001'],
        syncInterval: 300,
        peerExchangeInterval: 1000
      }),
      new GossipLayer({
        id: 'node3',
        port: 9003,
        storage: createFilesystemStorage({
          basePath: './test-gossip-stress/node3'
        }),
        peers: ['ws://localhost:9001', 'ws://localhost:9002'],
        syncInterval: 300,
        peerExchangeInterval: 1000
      })
    ]
    
    // Start all nodes
    await Promise.all(nodes.map(n => n.start()))
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('Sending 100 updates across all nodes...')
    const startTime = Date.now()
    
    // Send 100 updates randomly distributed
    const updatePromises = []
    for (let i = 0; i < 100; i++) {
      const node = nodes[i % nodes.length]
      const contactId = `stress-${i}`
      const content = {
        id: i,
        data: `x`.repeat(100), // 100 bytes of data
        timestamp: Date.now(),
        source: node.config.id
      }
      updatePromises.push(node.updateContact(contactId, content))
      
      // Small delay every 100 updates to avoid overwhelming
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    await Promise.all(updatePromises)
    const updateTime = Date.now() - startTime
    console.log(`Updates sent in ${updateTime}ms (${(100000/updateTime).toFixed(0)} updates/sec)`)
    
    // Trigger aggressive sync
    console.log('Triggering sync rounds...')
    const syncStart = Date.now()
    
    for (let round = 0; round < 3; round++) {
      await Promise.all(nodes.map(n => n.triggerSync()))
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    const syncTime = Date.now() - syncStart
    console.log(`Sync completed in ${syncTime}ms`)
    
    // Check convergence
    console.log('Checking convergence...')
    let mismatches = 0
    let matches = 0
    
    for (let i = 0; i < 100; i++) {
      const contactId = `stress-${i}`
      const hashes = nodes.map(n => n.getContentHash(contactId))
      const firstHash = hashes[0]
      
      if (hashes.every(h => h === firstHash)) {
        matches++
      } else {
        mismatches++
        if (mismatches <= 5) { // Only log first few mismatches
          console.log(`  Mismatch on ${contactId}: ${hashes.map(h => h?.substring(0, 8))}`)
        }
      }
    }
    
    const convergenceRate = (matches / 100 * 100).toFixed(1)
    console.log(`\nResults:`)
    console.log(`  Convergence: ${matches}/100 (${convergenceRate}%)`)
    console.log(`  Total time: ${(Date.now() - startTime)}ms`)
    console.log(`  Throughput: ${(100000/updateTime).toFixed(0)} updates/sec`)
    
    expect(matches).toBeGreaterThan(95) // Allow for some eventual consistency lag
  })

  it('should converge under network delays', { timeout: 60000 }, async () => {
    console.log('\n=== NETWORK DELAY TEST ===')
    
    console.log('Creating nodes with simulated delays...')
    // Use regular nodes but with slower sync intervals to simulate delays
    nodes = [
      new GossipLayer({
        id: 'fast',
        port: 9010,
        storage: createMemoryStorage(),
        syncInterval: 500
      }),
      
      new GossipLayer({
        id: 'medium',
        port: 9011,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9010'],
        syncInterval: 1000 // Slower sync
      }),
      
      new GossipLayer({
        id: 'slow',
        port: 9012,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9010', 'ws://localhost:9011'],
        syncInterval: 2000 // Even slower sync
      })
    ]
    
    await Promise.all(nodes.map(n => n.start()))
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('Sending updates with network delays...')
    const updates = 100
    
    for (let i = 0; i < updates; i++) {
      const node = nodes[i % 3]
      await node.updateContact(`delay-${i}`, {
        value: i,
        source: node.config.id,
        timestamp: Date.now()
      })
    }
    
    console.log('Waiting for convergence with delays...')
    const startTime = Date.now()
    
    // Poll for convergence
    let converged = false
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max
    
    while (!converged && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
      
      // Trigger sync
      await Promise.all(nodes.map(n => n.triggerSync()))
      
      // Check convergence
      let allMatch = true
      for (let i = 0; i < updates; i++) {
        const hashes = nodes.map(n => n.getContentHash(`delay-${i}`))
        if (!hashes.every(h => h === hashes[0])) {
          allMatch = false
          break
        }
      }
      
      if (allMatch) {
        converged = true
      }
    }
    
    const convergenceTime = Date.now() - startTime
    console.log(`\nResults:`)
    console.log(`  Converged: ${converged}`)
    console.log(`  Time to converge: ${convergenceTime}ms`)
    console.log(`  Sync rounds needed: ${attempts}`)
    
    expect(converged).toBe(true)
  })

  it('should handle network partitions and healing', { timeout: 60000 }, async () => {
    console.log('\n=== PARTITION TOLERANCE TEST ===')
    
    // Create a line topology: A - B - C - D - E
    console.log('Creating line topology: A - B - C - D - E')
    
    nodes = [
      new GossipLayer({
        id: 'A',
        port: 9020,
        storage: createMemoryStorage(),
        syncInterval: 300
      }),
      new GossipLayer({
        id: 'B',
        port: 9021,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9020'],
        syncInterval: 300
      }),
      new GossipLayer({
        id: 'C',
        port: 9022,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9021'],
        syncInterval: 300
      }),
      new GossipLayer({
        id: 'D',
        port: 9023,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9022'],
        syncInterval: 300
      }),
      new GossipLayer({
        id: 'E',
        port: 9024,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9023'],
        syncInterval: 300
      })
    ]
    
    await Promise.all(nodes.map(n => n.start()))
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    console.log('Sending initial updates...')
    // Each node creates some contacts
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 10; j++) {
        await nodes[i].updateContact(`node${i}-${j}`, {
          value: `${i}-${j}`,
          source: nodes[i].config.id
        })
      }
    }
    
    // Let them sync
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    console.log('Creating partition by stopping node C...')
    await nodes[2].stop() // Stop C, partitioning A-B from D-E
    
    console.log('Sending updates during partition...')
    // Updates on both sides of partition
    for (let i = 0; i < 10; i++) {
      await nodes[0].updateContact(`partition-left-${i}`, { value: `left-${i}` })
      await nodes[4].updateContact(`partition-right-${i}`, { value: `right-${i}` })
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Check that partition exists
    const leftHash = nodes[0].getContentHash('partition-right-0')
    const rightHash = nodes[4].getContentHash('partition-left-0')
    console.log(`During partition:`)
    console.log(`  A knows about right-0: ${!!leftHash}`)
    console.log(`  E knows about left-0: ${!!rightHash}`)
    
    console.log('Healing partition by restarting C...')
    nodes[2] = new GossipLayer({
      id: 'C',
      port: 9022,
      storage: createMemoryStorage(),
      peers: ['ws://localhost:9021', 'ws://localhost:9023'], // Connect to both sides
      syncInterval: 300
    })
    await nodes[2].start()
    
    console.log('Waiting for convergence after healing...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Trigger aggressive sync
    for (let i = 0; i < 3; i++) {
      await Promise.all(nodes.map(n => n.triggerSync()))
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Check convergence
    const leftHashAfter = nodes[0].getContentHash('partition-right-0')
    const rightHashAfter = nodes[4].getContentHash('partition-left-0')
    
    console.log(`\nAfter healing:`)
    console.log(`  A knows about right-0: ${!!leftHashAfter}`)
    console.log(`  E knows about left-0: ${!!rightHashAfter}`)
    
    // Count total convergence
    let convergedCount = 0
    const totalContacts = 50 + 20 // Initial + partition updates
    
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 10; j++) {
        const hashes = nodes.map(n => n.getContentHash(`node${i}-${j}`))
        if (hashes.every(h => h === hashes[0])) convergedCount++
      }
    }
    
    for (let i = 0; i < 10; i++) {
      const leftHashes = nodes.map(n => n.getContentHash(`partition-left-${i}`))
      const rightHashes = nodes.map(n => n.getContentHash(`partition-right-${i}`))
      if (leftHashes.every(h => h === leftHashes[0])) convergedCount++
      if (rightHashes.every(h => h === rightHashes[0])) convergedCount++
    }
    
    console.log(`  Converged: ${convergedCount}/${totalContacts} contacts`)
    
    expect(convergedCount).toBeGreaterThan(totalContacts * 0.8) // 80% convergence
  })

  it.skip('should measure convergence time vs network size', { timeout: 120000 }, async () => {
    console.log('\n=== SCALABILITY TEST ===')
    
    const results = []
    
    for (const nodeCount of [3, 5, 7]) {
      console.log(`\nTesting with ${nodeCount} nodes...`)
      
      // Create nodes
      nodes = []
      for (let i = 0; i < nodeCount; i++) {
        const peers = i > 0 ? [`ws://localhost:${9030 + Math.floor(Math.random() * i)}`] : []
        nodes.push(new GossipLayer({
          id: `node${i}`,
          port: 9030 + i,
          storage: createMemoryStorage(),
          peers,
          syncInterval: 200
        }))
      }
      
      await Promise.all(nodes.map(n => n.start()))
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Send updates
      const updateCount = 100
      const startTime = Date.now()
      
      for (let i = 0; i < updateCount; i++) {
        const node = nodes[i % nodeCount]
        await node.updateContact(`scale-${i}`, {
          value: i,
          source: node.config.id
        })
      }
      
      // Measure convergence time
      let converged = false
      let syncRounds = 0
      const maxRounds = 20
      
      while (!converged && syncRounds < maxRounds) {
        await Promise.all(nodes.map(n => n.triggerSync()))
        await new Promise(resolve => setTimeout(resolve, 500))
        syncRounds++
        
        // Check convergence
        let allMatch = true
        for (let i = 0; i < updateCount; i++) {
          const hashes = nodes.map(n => n.getContentHash(`scale-${i}`))
          if (!hashes.every(h => h && h === hashes[0])) {
            allMatch = false
            break
          }
        }
        
        if (allMatch) {
          converged = true
        }
      }
      
      const convergenceTime = Date.now() - startTime
      
      results.push({
        nodes: nodeCount,
        convergenceTime,
        syncRounds,
        converged
      })
      
      console.log(`  Convergence time: ${convergenceTime}ms`)
      console.log(`  Sync rounds: ${syncRounds}`)
      console.log(`  Converged: ${converged}`)
      
      // Clean up for next iteration
      await Promise.all(nodes.map(n => n.stop()))
      nodes = []
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('\n=== SCALABILITY SUMMARY ===')
    console.log('Nodes | Time (ms) | Rounds | Converged')
    console.log('------|-----------|--------|----------')
    results.forEach(r => {
      console.log(`  ${r.nodes}   |   ${r.convergenceTime.toString().padEnd(7)} | ${r.syncRounds.toString().padEnd(6)} | ${r.converged}`)
    })
    
    // Check that larger networks take longer but still converge
    expect(results.every(r => r.converged)).toBe(true)
    expect(results[2].convergenceTime).toBeGreaterThan(results[0].convergenceTime)
  })

  it('should handle burst traffic patterns', { timeout: 60000 }, async () => {
    console.log('\n=== BURST TRAFFIC TEST ===')
    
    // Create 3 nodes
    nodes = [
      new GossipLayer({
        id: 'burst1',
        port: 9040,
        storage: createMemoryStorage(),
        syncInterval: 100
      }),
      new GossipLayer({
        id: 'burst2',
        port: 9041,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9040'],
        syncInterval: 100
      }),
      new GossipLayer({
        id: 'burst3',
        port: 9042,
        storage: createMemoryStorage(),
        peers: ['ws://localhost:9040', 'ws://localhost:9041'],
        syncInterval: 100
      })
    ]
    
    await Promise.all(nodes.map(n => n.start()))
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const burstSizes = [10, 50, 100, 500]
    const results = []
    
    for (const burstSize of burstSizes) {
      console.log(`\nSending burst of ${burstSize} updates...`)
      const startTime = Date.now()
      
      // Send burst with small delays to avoid overwhelming
      for (let i = 0; i < burstSize; i++) {
        const node = nodes[Math.floor(Math.random() * 3)]
        await node.updateContact(`burst-${burstSize}-${i}`, {
          value: i,
          burst: burstSize,
          timestamp: Date.now()
        })
        // Add tiny delay for large bursts
        if (burstSize > 100 && i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
      const sendTime = Date.now() - startTime
      
      // Wait for convergence
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Trigger sync
      for (let i = 0; i < 3; i++) {
        await Promise.all(nodes.map(n => n.triggerSync()))
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      // Check convergence
      let converged = 0
      for (let i = 0; i < burstSize; i++) {
        const hashes = nodes.map(n => n.getContentHash(`burst-${burstSize}-${i}`))
        if (hashes.every(h => h && h === hashes[0])) {
          converged++
        }
      }
      
      const convergenceRate = (converged / burstSize * 100).toFixed(1)
      const throughput = (burstSize * 1000 / sendTime).toFixed(0)
      
      results.push({
        burstSize,
        sendTime,
        converged,
        convergenceRate,
        throughput
      })
      
      console.log(`  Send time: ${sendTime}ms`)
      console.log(`  Throughput: ${throughput} msgs/sec`)
      console.log(`  Convergence: ${converged}/${burstSize} (${convergenceRate}%)`)
    }
    
    console.log('\n=== BURST TRAFFIC SUMMARY ===')
    console.log('Burst | Send(ms) | Throughput | Convergence')
    console.log('------|----------|------------|------------')
    results.forEach(r => {
      console.log(`${r.burstSize.toString().padEnd(5)} | ${r.sendTime.toString().padEnd(8)} | ${r.throughput.padEnd(10)} | ${r.convergenceRate}%`)
    })
    
    // All bursts should achieve high convergence
    expect(results.every(r => parseFloat(r.convergenceRate) > 90)).toBe(true)
  })
})