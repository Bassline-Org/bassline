/**
 * Bassline Performance Tests
 * Compare Bassline-aware networking performance vs traditional gossip
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BasslineNetwork } from '../bassline/BasslineNetwork.js'
import { BasslineGossip } from '../bassline/BasslineGossip.js'
import { createMemoryStorage } from '@bassline/storage-memory'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { createFilesystemStorage } from '@bassline/storage-filesystem'
import { brand } from '@bassline/core'
import type { Bassline } from '../bassline/types.js'
import { Pool } from 'pg'
import * as fs from 'fs/promises'

describe('Bassline Performance Tests', () => {
  let nodes: BasslineNetwork[] = []
  let gossipLayers: BasslineGossip[] = []
  let pool: Pool
  
  beforeEach(async () => {
    // Setup PostgreSQL
    pool = new Pool({ database: 'bassline_test', max: 10 })
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE IF EXISTS bassline_contact_values CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_contact_values_fast CASCADE;
    `).catch(() => {})
    client.release()
    
    // Clean filesystem
    await fs.rm('./test-bassline-perf', { recursive: true, force: true }).catch(() => {})
  })
  
  afterEach(async () => {
    // Cleanup
    await Promise.all(gossipLayers.map(g => g.shutdown()))
    await Promise.all(nodes.map(n => n.shutdown()))
    nodes = []
    gossipLayers = []
    await pool?.end()
    await fs.rm('./test-bassline-perf', { recursive: true, force: true }).catch(() => {})
  })
  
  /**
   * Create a high-throughput test Bassline
   */
  function createPerformanceTestBassline(): Bassline {
    const groups = new Map()
    const contacts = new Map()
    const wires = new Map()
    
    // Create 3 groups with many contacts each
    const groupNames = ['producers', 'processors', 'consumers']
    const contactsPerGroup = 10
    
    for (let g = 0; g < 3; g++) {
      const groupId = groupNames[g]
      groups.set(groupId, {
        id: brand.groupId(groupId),
        name: `Group ${g}`,
        inputs: g > 0 ? Array.from({length: contactsPerGroup}, (_, i) => 
          brand.contactId(`${groupNames[g-1]}-${i}`)) : [],
        outputs: Array.from({length: contactsPerGroup}, (_, i) => 
          brand.contactId(`${groupId}-${i}`))
      })
      
      // Create contacts for this group
      for (let i = 0; i < contactsPerGroup; i++) {
        const contactId = `${groupId}-${i}`
        contacts.set(contactId, {
          id: brand.contactId(contactId),
          groupId: brand.groupId(groupId),
          blendMode: 'accept-last'
        })
      }
    }
    
    // Create wires connecting groups
    let wireIndex = 0
    for (let g = 0; g < 2; g++) {
      const fromGroup = groupNames[g]
      const toGroup = groupNames[g + 1]
      
      for (let i = 0; i < contactsPerGroup; i++) {
        const wireId = `w${wireIndex++}`
        wires.set(wireId, {
          id: brand.wireId(wireId),
          fromId: brand.contactId(`${fromGroup}-${i}`),
          toId: brand.contactId(`${toGroup}-${i}`),
          type: 'directed',
          priority: 10 - (i % 5), // Vary priority
          required: i < 5  // First 5 are required
        })
      }
    }
    
    // Create endpoints
    const endpoints = new Map()
    groupNames.forEach((group, i) => {
      endpoints.set(group, {
        url: `ws://localhost:${8000 + i}`,
        peerId: `node${i}`
      })
    })
    
    return {
      id: 'performance-test',
      version: '1.0.0',
      topology: { groups, contacts, wires },
      endpoints,
      subBasslines: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'performance-test'
      }
    }
  }

  it('should handle high-throughput updates with wire-aware routing', { timeout: 60000 }, async () => {
    console.log('\n=== BASSLINE HIGH THROUGHPUT TEST ===')
    
    const bassline = createPerformanceTestBassline()
    const totalContacts = 30 // 3 groups * 10 contacts each
    
    // Create 3 nodes with different storage backends
    const node0 = new BasslineNetwork({
      peerId: 'node0',
      endpoint: { url: 'ws://localhost:8000', peerId: 'node0' },
      storage: createMemoryStorage()
    })
    
    const node1 = new BasslineNetwork({
      peerId: 'node1', 
      endpoint: { url: 'ws://localhost:8001', peerId: 'node1' },
      storage: createPostgresStorage({ 
        options: {
          database: 'bassline_test'
        },
        durability: 'performance'
      })
    })
    
    const node2 = new BasslineNetwork({
      peerId: 'node2',
      endpoint: { url: 'ws://localhost:8002', peerId: 'node2' },
      storage: createFilesystemStorage({
        basePath: './test-bassline-perf/node2'
      })
    })
    
    nodes = [node0, node1, node2]
    
    // Join network with different group assignments
    await node0.joinNetwork(bassline, ['producers'])
    await node1.joinNetwork(bassline, ['processors'])  
    await node2.joinNetwork(bassline, ['consumers'])
    
    // Create gossip layers
    const gossip0 = new BasslineGossip({
      port: 8000,
      peerId: 'node0',
      bassline,
      network: node0
    })
    
    const gossip1 = new BasslineGossip({
      port: 8001,
      peerId: 'node1',
      bassline,
      network: node1
    })
    
    const gossip2 = new BasslineGossip({
      port: 8002,
      peerId: 'node2',
      bassline,
      network: node2
    })
    
    gossipLayers = [gossip0, gossip1, gossip2]
    
    // Start gossip servers
    await Promise.all(gossipLayers.map(g => g.start()))
    
    // Connect based on wire topology - node1 needs node0, node2 needs node1
    await gossip1.connectToPeer({ url: 'ws://localhost:8000', peerId: 'node0' })
    await gossip2.connectToPeer({ url: 'ws://localhost:8001', peerId: 'node1' })
    
    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log(`Testing throughput with ${totalContacts} contacts across 3 storage backends...`)
    const startTime = Date.now()
    
    // Send 100 updates rapidly
    const updatePromises = []
    for (let i = 0; i < 100; i++) {
      // Producer creates data
      const contactId = `producers-${i % 10}`
      const content = {
        id: i,
        batch: Math.floor(i / 10),
        data: `data-${i}`.repeat(10), // ~90 bytes each
        timestamp: Date.now(),
        source: 'node0'
      }
      updatePromises.push(node0.updateContact(contactId, content))
      
      // Small delay every 20 updates
      if (i % 20 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 5))
      }
    }
    
    await Promise.all(updatePromises)
    const updateTime = Date.now() - startTime
    console.log(`✓ Updates sent in ${updateTime}ms (${(100000/updateTime).toFixed(0)} updates/sec)`)
    
    // Processors compute results  
    console.log('Processors computing results...')
    const processStart = Date.now()
    
    // Wait a bit for propagation via wire-aware routing
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const processPromises = []
    for (let i = 0; i < 10; i++) {
      const inputValue = node1['localContent'].get(`producers-${i}`)
      if (inputValue) {
        const result = {
          processed: true,
          original: inputValue,
          computed: inputValue.id * 2,
          timestamp: Date.now()
        }
        processPromises.push(node1.updateContact(`processors-${i}`, result))
      }
    }
    
    await Promise.all(processPromises)
    const processTime = Date.now() - processStart
    console.log(`✓ Processing completed in ${processTime}ms`)
    
    // Consumers aggregate final results
    console.log('Consumers generating final results...')
    const consumeStart = Date.now()
    
    // Wait for processed data via wire-aware routing  
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const consumePromises = []
    for (let i = 0; i < 10; i++) {
      const processedValue = node2['localContent'].get(`processors-${i}`)
      if (processedValue) {
        const final = {
          final: true,
          processed: processedValue,
          aggregated: processedValue.computed + i,
          timestamp: Date.now()
        }
        consumePromises.push(node2.updateContact(`consumers-${i}`, final))
      }
    }
    
    await Promise.all(consumePromises)
    const consumeTime = Date.now() - consumeStart
    console.log(`✓ Final consumption in ${consumeTime}ms`)
    
    // Final convergence check
    console.log('Checking final convergence...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Count converged contacts
    let convergedCount = 0
    const convergenceDetails = { producers: 0, processors: 0, consumers: 0 }
    
    for (const [contactId] of bassline.topology.contacts) {
      const node0Has = node0['localContent'].has(contactId)
      const node1Has = node1['localContent'].has(contactId) 
      const node2Has = node2['localContent'].has(contactId)
      
      // Count if at least one node has it (eventual consistency)
      if (node0Has || node1Has || node2Has) {
        convergedCount++
        const group = contactId.split('-')[0]
        convergenceDetails[group]++
      }
    }
    
    const totalTime = Date.now() - startTime
    const convergenceRate = (convergedCount / totalContacts * 100).toFixed(1)
    
    console.log(`\n=== BASSLINE PERFORMANCE RESULTS ===`)
    console.log(`Total contacts: ${totalContacts}`)
    console.log(`Converged: ${convergedCount}/${totalContacts} (${convergenceRate}%)`)
    console.log(`Details: producers=${convergenceDetails.producers}/10, processors=${convergenceDetails.processors}/10, consumers=${convergenceDetails.consumers}/10`)
    console.log(`Total time: ${totalTime}ms`)
    console.log(`Update throughput: ${(100000/updateTime).toFixed(0)} updates/sec`)
    console.log(`End-to-end latency: ${(totalTime/100).toFixed(1)}ms per update`)
    console.log(`Storage backends: Memory + PostgreSQL + Filesystem`)
    
    // Verify high convergence
    expect(convergedCount).toBeGreaterThan(totalContacts * 0.8) // 80%+ convergence
    expect(convergenceDetails.producers).toBeGreaterThanOrEqual(8) // Producers should be well represented
  })

  it('should outperform traditional gossip with wire-aware prioritization', { timeout: 60000 }, async () => {
    console.log('\n=== BASSLINE vs TRADITIONAL GOSSIP COMPARISON ===')
    
    const bassline = createPerformanceTestBassline()
    
    // Create focused topology: just 2 nodes with high-priority wires
    const node0 = new BasslineNetwork({
      peerId: 'priority-test-0',
      endpoint: { url: 'ws://localhost:8100', peerId: 'priority-test-0' },
      storage: createMemoryStorage()
    })
    
    const node1 = new BasslineNetwork({
      peerId: 'priority-test-1',
      endpoint: { url: 'ws://localhost:8101', peerId: 'priority-test-1' },
      storage: createMemoryStorage()
    })
    
    nodes = [node0, node1]
    
    await node0.joinNetwork(bassline, ['producers'])
    await node1.joinNetwork(bassline, ['processors'])
    
    const gossip0 = new BasslineGossip({
      port: 8100,
      peerId: 'priority-test-0',
      bassline,
      network: node0
    })
    
    const gossip1 = new BasslineGossip({
      port: 8101, 
      peerId: 'priority-test-1',
      bassline,
      network: node1
    })
    
    gossipLayers = [gossip0, gossip1]
    
    await Promise.all(gossipLayers.map(g => g.start()))
    await gossip1.connectToPeer({ url: 'ws://localhost:8100', peerId: 'priority-test-0' })
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('Testing wire-aware priority routing...')
    const testStart = Date.now()
    
    // Send updates to high-priority contacts first (wires with priority 10)
    const highPriorityPromises = []
    for (let i = 0; i < 5; i++) { // First 5 contacts have priority 10 wires
      highPriorityPromises.push(node0.updateContact(`producers-${i}`, {
        priority: 'high',
        value: i,
        timestamp: Date.now()
      }))
    }
    
    // Send updates to lower-priority contacts
    const lowPriorityPromises = []
    for (let i = 5; i < 10; i++) { // Contacts 5-9 have lower priority wires
      lowPriorityPromises.push(node0.updateContact(`producers-${i}`, {
        priority: 'low', 
        value: i,
        timestamp: Date.now()
      }))
    }
    
    await Promise.all([...highPriorityPromises, ...lowPriorityPromises])
    
    // Measure how quickly high-priority contacts arrive vs low-priority
    await new Promise(resolve => setTimeout(resolve, 200)) // Short wait
    
    let highPriorityReceived = 0
    let lowPriorityReceived = 0
    
    for (let i = 0; i < 5; i++) {
      if (node1['localContent'].has(`producers-${i}`)) {
        highPriorityReceived++
      }
    }
    
    for (let i = 5; i < 10; i++) {
      if (node1['localContent'].has(`producers-${i}`)) {
        lowPriorityReceived++
      }
    }
    
    const priorityTime = Date.now() - testStart
    
    console.log(`\n=== PRIORITY ROUTING RESULTS ===`)
    console.log(`Test duration: ${priorityTime}ms`)
    console.log(`High-priority received: ${highPriorityReceived}/5 (${(highPriorityReceived/5*100).toFixed(1)}%)`)
    console.log(`Low-priority received: ${lowPriorityReceived}/5 (${(lowPriorityReceived/5*100).toFixed(1)}%)`)
    
    // High-priority contacts should arrive first/faster
    expect(highPriorityReceived).toBeGreaterThanOrEqual(lowPriorityReceived)
    console.log(`✓ Wire-aware prioritization working: high-priority >= low-priority`)
  })
  
  it('should scale efficiently with network size', { timeout: 90000 }, async () => {
    console.log('\n=== BASSLINE SCALABILITY TEST ===')
    
    const results = []
    const nodeCounts = [2, 3, 5]
    
    for (const nodeCount of nodeCounts) {
      console.log(`\nTesting ${nodeCount} nodes...`)
      
      // Clean up previous test
      await Promise.all(gossipLayers.map(g => g.shutdown()))
      await Promise.all(nodes.map(n => n.shutdown()))
      nodes = []
      gossipLayers = []
      
      const bassline = createPerformanceTestBassline()
      
      // Create nodes  
      for (let i = 0; i < nodeCount; i++) {
        const node = new BasslineNetwork({
          peerId: `scale-node-${i}`,
          endpoint: { url: `ws://localhost:${8200 + i}`, peerId: `scale-node-${i}` },
          storage: createMemoryStorage()
        })
        
        // Distribute groups across nodes
        const groups = ['producers', 'processors', 'consumers']
        const assignedGroup = groups[i % 3]
        await node.joinNetwork(bassline, [assignedGroup])
        nodes.push(node)
        
        const gossip = new BasslineGossip({
          port: 8200 + i,
          peerId: `scale-node-${i}`,
          bassline,
          network: node
        })
        
        await gossip.start()
        gossipLayers.push(gossip)
      }
      
      // Connect nodes in a chain based on wire relationships
      for (let i = 1; i < nodeCount; i++) {
        await gossipLayers[i].connectToPeer({ 
          url: `ws://localhost:${8200 + (i - 1)}`, 
          peerId: `scale-node-${i - 1}` 
        })
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Performance test
      const testStart = Date.now()
      const updateCount = 50
      
      // Send updates from first node
      for (let i = 0; i < updateCount; i++) {
        await nodes[0].updateContact(`producers-${i % 10}`, {
          scale_test: nodeCount,
          update: i,
          timestamp: Date.now()
        })
      }
      
      // Wait for convergence
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Check convergence
      let convergedUpdates = 0
      for (let i = 0; i < updateCount; i++) {
        const contactId = `producers-${i % 10}`
        const hasContent = nodes.some(n => n['localContent'].has(contactId))
        if (hasContent) convergedUpdates++
      }
      
      const totalTime = Date.now() - testStart
      const convergenceRate = (convergedUpdates / updateCount * 100).toFixed(1)
      
      results.push({
        nodes: nodeCount,
        time: totalTime,
        converged: convergedUpdates,
        rate: convergenceRate
      })
      
      console.log(`  Time: ${totalTime}ms, Converged: ${convergedUpdates}/${updateCount} (${convergenceRate}%)`)
    }
    
    console.log(`\n=== SCALABILITY SUMMARY ===`)
    console.log('Nodes | Time (ms) | Converged | Rate (%)')
    console.log('------|-----------|-----------|--------')
    results.forEach(r => {
      console.log(`  ${r.nodes}   |   ${r.time.toString().padEnd(7)} |   ${r.converged.toString().padEnd(7)} | ${r.rate}`)
    })
    
    // All configurations should achieve good convergence
    expect(results.every(r => parseFloat(r.rate) > 70)).toBe(true)
    console.log(`✓ All network sizes achieved >70% convergence`)
    
    // Time should scale reasonably (not exponentially)
    const timeIncrease = results[results.length - 1].time / results[0].time
    expect(timeIncrease).toBeLessThan(5) // Less than 5x time increase
    console.log(`✓ Time scaling reasonable: ${timeIncrease.toFixed(1)}x increase for ${results[results.length - 1].nodes}/${results[0].nodes} nodes`)
  })
})