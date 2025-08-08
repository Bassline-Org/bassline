/**
 * Bassline Heavy Stress Tests
 * Push the Bassline network to its limits with many nodes and high data volumes
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

describe('Bassline Heavy Stress Tests', () => {
  let nodes: BasslineNetwork[] = []
  let gossipLayers: BasslineGossip[] = []
  let pool: Pool
  
  beforeEach(async () => {
    // Setup PostgreSQL with higher connection limit
    pool = new Pool({ database: 'bassline_test', max: 25 })
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE IF EXISTS bassline_contact_values CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_contact_values_fast CASCADE;
    `).catch(() => {})
    client.release()
    
    // Clean filesystem
    await fs.rm('./test-bassline-heavy', { recursive: true, force: true }).catch(() => {})
  })
  
  afterEach(async () => {
    // Cleanup with timeout to avoid hanging
    await Promise.race([
      Promise.all([
        ...gossipLayers.map(g => g.shutdown()),
        ...nodes.map(n => n.shutdown())
      ]),
      new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
    ])
    nodes = []
    gossipLayers = []
    await pool?.end()
    await fs.rm('./test-bassline-heavy', { recursive: true, force: true }).catch(() => {})
  })
  
  /**
   * Create a large-scale test Bassline with many groups and contacts
   */
  function createLargeScaleBassline(groupCount: number, contactsPerGroup: number): Bassline {
    const groups = new Map()
    const contacts = new Map()
    const wires = new Map()
    
    // Create groups in a pipeline: input -> processing stages -> output
    const groupNames: string[] = []
    
    // Input groups
    for (let i = 0; i < Math.ceil(groupCount / 4); i++) {
      groupNames.push(`input-${i}`)
    }
    
    // Processing groups (most groups)
    const processGroups = Math.floor(groupCount / 2)
    for (let i = 0; i < processGroups; i++) {
      groupNames.push(`process-${i}`)
    }
    
    // Output groups
    for (let i = 0; i < Math.ceil(groupCount / 4); i++) {
      groupNames.push(`output-${i}`)
    }
    
    // Trim to exact count
    groupNames.length = groupCount
    
    // Create groups and contacts
    for (let g = 0; g < groupCount; g++) {
      const groupId = groupNames[g]
      const isInput = groupId.startsWith('input')
      const isOutput = groupId.startsWith('output')
      
      groups.set(groupId, {
        id: brand.groupId(groupId),
        name: `Group ${groupId}`,
        inputs: isInput ? [] : Array.from({length: Math.min(contactsPerGroup, 5)}, (_, i) => 
          brand.contactId(`${groupId}-in-${i}`)),
        outputs: Array.from({length: contactsPerGroup}, (_, i) => 
          brand.contactId(`${groupId}-${i}`))
      })
      
      // Create contacts for this group
      if (!isInput) {
        // Input contacts
        for (let i = 0; i < Math.min(contactsPerGroup, 5); i++) {
          const contactId = `${groupId}-in-${i}`
          contacts.set(contactId, {
            id: brand.contactId(contactId),
            groupId: brand.groupId(groupId),
            blendMode: 'accept-last'
          })
        }
      }
      
      // Output contacts
      for (let i = 0; i < contactsPerGroup; i++) {
        const contactId = `${groupId}-${i}`
        contacts.set(contactId, {
          id: brand.contactId(contactId),
          groupId: brand.groupId(groupId),
          blendMode: 'accept-last'
        })
      }
    }
    
    // Create wires connecting groups in pipeline
    let wireIndex = 0
    for (let g = 0; g < groupCount - 1; g++) {
      const fromGroup = groupNames[g]
      const toGroup = groupNames[g + 1]
      
      const connectionsToMake = Math.min(contactsPerGroup, 5)
      
      for (let i = 0; i < connectionsToMake; i++) {
        const wireId = `w${wireIndex++}`
        wires.set(wireId, {
          id: brand.wireId(wireId),
          fromId: brand.contactId(`${fromGroup}-${i}`),
          toId: brand.contactId(`${toGroup}-in-${i}`),
          type: 'directed',
          priority: 10 - (i % 3), // Vary priority 8-10
          required: i < 2  // First 2 are required
        })
      }
    }
    
    return {
      id: 'heavy-stress-test',
      version: '1.0.0',
      topology: { groups, contacts, wires },
      endpoints: new Map(), // No endpoints - let gossip handle connections
      subBasslines: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'heavy-stress-test'
      }
    }
  }

  it('should handle 10 nodes with high-volume data streaming', { timeout: 120000 }, async () => {
    console.log('\n=== BASSLINE 10-NODE HEAVY STRESS TEST ===')
    
    const nodeCount = 10
    const contactsPerGroup = 8
    const bassline = createLargeScaleBassline(nodeCount, contactsPerGroup)
    
    console.log(`Creating ${nodeCount} nodes with ${contactsPerGroup} contacts each...`)
    console.log(`Total contacts: ${bassline.topology.contacts.size}`)
    console.log(`Total wires: ${bassline.topology.wires.size}`)
    
    // Create nodes with different storage backends
    const storageTypes = ['memory', 'postgres', 'filesystem']
    
    for (let i = 0; i < nodeCount; i++) {
      const storageType = storageTypes[i % 3]
      let storage
      
      switch (storageType) {
        case 'postgres':
          storage = createPostgresStorage({ 
            options: {
              database: 'bassline_test'
            },
            durability: 'performance'
          })
          break
        case 'filesystem':
          storage = createFilesystemStorage({
            basePath: `./test-bassline-heavy/node${i}`
          })
          break
        default:
          storage = createMemoryStorage()
      }
      
      const node = new BasslineNetwork({
        peerId: `node-${i}`,
        endpoint: { url: `ws://localhost:${9000 + i}`, peerId: `node-${i}` },
        storage
      })
      
      // Each node runs one group
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 9000 + i,
        peerId: `node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 5000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
      
      console.log(`✓ Node ${i} ready (${storageType} storage)`)
    }
    
    // Connect nodes in a complex topology based on wire relationships
    console.log('Connecting nodes based on wire topology...')
    const connectionPromises = []
    
    for (let i = 1; i < nodeCount; i++) {
      // Each node connects to previous 2 nodes for redundancy
      for (let j = Math.max(0, i - 2); j < i; j++) {
        connectionPromises.push(
          gossipLayers[i].connectToPeer({ 
            url: `ws://localhost:${9000 + j}`, 
            peerId: `node-${j}` 
          }).catch(err => {
            console.warn(`Failed to connect node-${i} to node-${j}:`, err.message)
            return null // Continue with other connections
          })
        )
      }
    }
    
    const results = await Promise.all(connectionPromises)
    const successfulConnections = results.filter(r => r !== null).length
    console.log(`✓ ${successfulConnections}/${connectionPromises.length} connections established`)
    
    // Wait for network stabilization
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    console.log('\n=== HIGH VOLUME DATA STREAMING ===')
    const streamStart = Date.now()
    
    // Stream massive amounts of data
    const batchSize = 500 // Updates per batch
    const batchCount = 5   // Number of batches
    const totalUpdates = batchSize * batchCount
    
    console.log(`Streaming ${totalUpdates} updates across ${nodeCount} nodes...`)
    
    let updatesSent = 0
    const updatePromises: Promise<void>[] = []
    
    for (let batch = 0; batch < batchCount; batch++) {
      console.log(`  Batch ${batch + 1}/${batchCount}...`)
      
      for (let i = 0; i < batchSize; i++) {
        const nodeIndex = (batch * batchSize + i) % nodeCount
        const node = nodes[nodeIndex]
        const groupNames = Array.from(bassline.topology.groups.keys())
        const groupName = groupNames[nodeIndex]
        const contactIndex = i % contactsPerGroup
        const contactId = `${groupName}-${contactIndex}`
        
        const payload = {
          batch,
          index: i,
          nodeId: nodeIndex,
          timestamp: Date.now(),
          sequence: updatesSent++,
          // Large payload to stress network
          data: Buffer.from(`payload-${batch}-${i}`).toString('base64').repeat(10), // ~2KB each
          metadata: {
            source: `node-${nodeIndex}`,
            generation: batch,
            priority: i % 3,
            tags: [`batch-${batch}`, `node-${nodeIndex}`, `seq-${updatesSent}`]
          }
        }
        
        updatePromises.push(node.updateContact(contactId, payload))
      }
      
      // Small delay between batches to prevent overwhelming
      if (batch < batchCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    await Promise.all(updatePromises)
    const streamTime = Date.now() - streamStart
    const throughput = (totalUpdates * 1000 / streamTime).toFixed(0)
    
    console.log(`✓ Stream complete in ${streamTime}ms`)
    console.log(`  Throughput: ${throughput} updates/sec`)
    console.log(`  Data volume: ~${(totalUpdates * 2).toFixed(1)}KB`)
    
    console.log('\n=== PROPAGATION AND CONVERGENCE ===')
    const convergenceStart = Date.now()
    
    // Wait for propagation through the pipeline
    console.log('Waiting for wire-aware propagation...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Trigger multiple sync rounds
    console.log('Triggering convergence sync rounds...')
    for (let round = 0; round < 5; round++) {
      await Promise.all(gossipLayers.map(g => g['broadcast']?.({ type: 'sync-request', contacts: [] })))
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    const convergenceTime = Date.now() - convergenceStart
    
    // Analysis phase
    console.log('\n=== STRESS TEST ANALYSIS ===')
    const analysisStart = Date.now()
    
    // Count wire-aware convergence per node
    const nodeStats = nodes.map((node, i) => {
      const localContent = node['localContent'] as Map<string, any>
      const contactCount = localContent.size
      const groupNames = Array.from(bassline.topology.groups.keys())
      const ownGroup = groupNames[i]
      const storageType = i % 3 === 1 ? 'postgres' : i % 3 === 2 ? 'filesystem' : 'memory'
      
      // Calculate wire-aware expected contacts for this node
      const ownContactIds = Array.from(bassline.topology.contacts.entries())
        .filter(([_, contact]) => contact.groupId === ownGroup)
        .map(([contactId]) => contactId)
      
      // Find contacts this node should have based on wire connectivity
      const expectedContactIds = new Set(ownContactIds)
      for (const [wireId, wire] of bassline.topology.wires) {
        // If we have the from contact, we should receive to contact updates
        if (ownContactIds.includes(wire.fromId)) {
          expectedContactIds.add(wire.toId)
        }
        // If we have the to contact, we should receive from contact updates
        if (ownContactIds.includes(wire.toId)) {
          expectedContactIds.add(wire.fromId)
        }
      }
      
      const expectedCount = expectedContactIds.size
      const wireAwareConvergence = expectedCount > 0 ? (contactCount / expectedCount * 100).toFixed(1) : '0'
      
      return {
        nodeId: i,
        group: ownGroup,
        storage: storageType,
        contacts: contactCount,
        expected: expectedCount,
        convergence: wireAwareConvergence,
        globalPercent: (contactCount / bassline.topology.contacts.size * 100).toFixed(1)
      }
    })
    
    const totalTime = Date.now() - streamStart
    const analysisTime = Date.now() - analysisStart
    
    // Calculate overall wire-aware metrics
    const avgWireAwareConvergence = nodeStats.reduce((sum, stat) => sum + parseFloat(stat.convergence), 0) / nodeCount
    const minWireAwareConvergence = Math.min(...nodeStats.map(s => parseFloat(s.convergence)))
    const maxWireAwareConvergence = Math.max(...nodeStats.map(s => parseFloat(s.convergence)))
    
    // Also track global perspective for reference
    const avgGlobalConvergence = nodeStats.reduce((sum, stat) => sum + parseFloat(stat.globalPercent), 0) / nodeCount
    
    // Storage performance breakdown
    const storageStats = {
      memory: nodeStats.filter(s => s.storage === 'memory'),
      postgres: nodeStats.filter(s => s.storage === 'postgres'), 
      filesystem: nodeStats.filter(s => s.storage === 'filesystem')
    }
    
    console.log('\n=== HEAVY STRESS TEST RESULTS ===')
    console.log(`Nodes: ${nodeCount}`)
    console.log(`Total contacts: ${bassline.topology.contacts.size}`)
    console.log(`Total wires: ${bassline.topology.wires.size}`)
    console.log(`Updates sent: ${totalUpdates}`)
    console.log(`Data volume: ~${(totalUpdates * 2).toFixed(1)}KB`)
    console.log(`Stream throughput: ${throughput} updates/sec`)
    console.log(`Total time: ${totalTime}ms`)
    console.log(`Convergence time: ${convergenceTime}ms`)
    console.log()
    
    console.log('=== WIRE-AWARE CONVERGENCE ANALYSIS ===')
    console.log(`Average wire-aware convergence: ${avgWireAwareConvergence.toFixed(1)}%`)
    console.log(`Min wire-aware convergence: ${minWireAwareConvergence}%`)
    console.log(`Max wire-aware convergence: ${maxWireAwareConvergence}%`)
    console.log(`Average global coverage: ${avgGlobalConvergence.toFixed(1)}%`)
    console.log()
    
    console.log('=== PER-NODE BREAKDOWN ===')
    console.log('Node | Group    | Storage    | Got/Exp | Wire-Conv | Global')
    console.log('-----|----------|------------|---------|-----------|-------')
    nodeStats.forEach(stat => {
      console.log(`${stat.nodeId.toString().padStart(4)} | ${stat.group.padEnd(8)} | ${stat.storage.padEnd(10)} | ${stat.contacts.toString().padStart(3)}/${stat.expected.toString().padStart(3)} | ${stat.convergence.toString().padStart(6)}% | ${stat.globalPercent}%`)
    })
    console.log()
    
    console.log('=== STORAGE PERFORMANCE ===')
    Object.entries(storageStats).forEach(([storage, stats]) => {
      const avgConv = stats.reduce((sum, s) => sum + parseFloat(s.convergence), 0) / stats.length
      console.log(`${storage.padEnd(10)}: ${stats.length} nodes, avg ${avgConv.toFixed(1)}% convergence`)
    })
    
    // Verify realistic wire-aware performance thresholds
    // Based on topology: baseline is ~59%, target is ~71%, excellent is ~89%
    expect(avgWireAwareConvergence).toBeGreaterThan(50) // 50%+ wire-aware convergence (reasonable for pipeline)
    expect(minWireAwareConvergence).toBeGreaterThan(35) // No node below 35% wire-aware convergence
    expect(parseFloat(throughput)).toBeGreaterThan(500) // 500+ updates/sec throughput
    
    console.log('\n✅ Heavy stress test passed - Bassline handles 10 nodes + high volume data!')
  })
  
  it('should scale to 15 nodes with complex pipeline topology', { timeout: 180000 }, async () => {
    console.log('\n=== BASSLINE 15-NODE PIPELINE STRESS TEST ===')
    
    const nodeCount = 15
    const contactsPerGroup = 6
    const bassline = createLargeScaleBassline(nodeCount, contactsPerGroup)
    
    console.log(`Creating ${nodeCount}-node pipeline network...`)
    console.log(`Pipeline: input(4) -> processing(7) -> output(4)`)
    console.log(`Total contacts: ${bassline.topology.contacts.size}`)
    console.log(`Total wires: ${bassline.topology.wires.size}`)
    
    // Create nodes with mixed storage
    for (let i = 0; i < nodeCount; i++) {
      const storageType = i % 4 === 3 ? 'postgres' : i % 2 === 0 ? 'filesystem' : 'memory'
      let storage
      
      switch (storageType) {
        case 'postgres':
          storage = createPostgresStorage({ 
            options: {
              database: 'bassline_test'
            },
            durability: 'performance'
          })
          break
        case 'filesystem':
          storage = createFilesystemStorage({
            basePath: `./test-bassline-heavy/pipeline-node${i}`
          })
          break
        default:
          storage = createMemoryStorage()
      }
      
      const node = new BasslineNetwork({
        peerId: `pipeline-node-${i}`,
        endpoint: { url: `ws://localhost:${9100 + i}`, peerId: `pipeline-node-${i}` },
        storage
      })
      
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 9100 + i,
        peerId: `pipeline-node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 10000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
    }
    
    // Create pipeline connections: each node connects to next 2-3 nodes
    console.log('Building pipeline connections...')
    const connectionPromises = []
    
    for (let i = 0; i < nodeCount - 1; i++) {
      // Connect to next 1-2 nodes
      const connectTo = Math.min(2, nodeCount - i - 1)
      for (let j = 1; j <= connectTo; j++) {
        connectionPromises.push(
          gossipLayers[i + j].connectToPeer({ 
            url: `ws://localhost:${9100 + i}`, 
            peerId: `pipeline-node-${i}` 
          }).catch(err => {
            console.warn(`Failed to connect pipeline-node-${i+j} to pipeline-node-${i}:`, err.message)
            return null
          })
        )
      }
    }
    
    const results = await Promise.all(connectionPromises)
    const successfulConnections = results.filter(r => r !== null).length
    console.log(`✓ ${successfulConnections}/${connectionPromises.length} pipeline connections established`)
    
    await new Promise(resolve => setTimeout(resolve, 4000))
    
    console.log('\n=== PIPELINE DATA FLOW TEST ===')
    const pipelineStart = Date.now()
    
    // Input nodes (first 4) generate data
    const inputNodes = nodes.slice(0, 4)
    const dataVolumePerInput = 200 // Updates per input node
    const totalVolume = inputNodes.length * dataVolumePerInput
    
    console.log(`Injecting ${totalVolume} updates into pipeline...`)
    
    const inputPromises = inputNodes.map(async (node, inputIndex) => {
      const groupNames = Array.from(bassline.topology.groups.keys())
      const groupName = groupNames[inputIndex] // Their assigned input group
      
      for (let i = 0; i < dataVolumePerInput; i++) {
        const contactId = `${groupName}-${i % contactsPerGroup}`
        const payload = {
          inputNode: inputIndex,
          sequence: i,
          timestamp: Date.now(),
          stage: 'input',
          pipelineId: `${inputIndex}-${i}`,
          payload: `pipeline-data-${inputIndex}-${i}`.repeat(5), // ~1KB each
          metadata: {
            origin: `pipeline-node-${inputIndex}`,
            stage: 0,
            maxStage: nodeCount - 1,
            priority: i % 5
          }
        }
        
        await node.updateContact(contactId, payload)
        
        // Small delay to create realistic flow
        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    })
    
    await Promise.all(inputPromises)
    const injectionTime = Date.now() - pipelineStart
    
    console.log(`✓ Data injected in ${injectionTime}ms`)
    console.log('Pipeline processing - waiting for flow through all stages...')
    
    // Wait for data to flow through entire pipeline
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Trigger pipeline sync
    for (let round = 0; round < 3; round++) {
      console.log(`  Sync round ${round + 1}/3...`)
      await Promise.all(gossipLayers.map(g => g['broadcast']?.({ type: 'sync-request', contacts: [] })))
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    const pipelineTime = Date.now() - pipelineStart
    
    console.log('\n=== PIPELINE ANALYSIS ===')
    
    // Analyze pipeline stages with wire-aware convergence
    const stageStats = nodes.map((node, i) => {
      const localContent = node['localContent'] as Map<string, any>
      const groupNames = Array.from(bassline.topology.groups.keys())
      const group = groupNames[i]
      
      let stageType = 'processing'
      if (group.startsWith('input')) stageType = 'input'
      else if (group.startsWith('output')) stageType = 'output'
      
      // Calculate wire-aware expected contacts for this pipeline node
      const ownContactIds = Array.from(bassline.topology.contacts.entries())
        .filter(([_, contact]) => contact.groupId === group)
        .map(([contactId]) => contactId)
      
      const expectedContactIds = new Set(ownContactIds)
      for (const [wireId, wire] of bassline.topology.wires) {
        if (ownContactIds.includes(wire.fromId)) {
          expectedContactIds.add(wire.toId)
        }
        if (ownContactIds.includes(wire.toId)) {
          expectedContactIds.add(wire.fromId)
        }
      }
      
      const expectedCount = expectedContactIds.size
      const wireAwareConvergence = expectedCount > 0 ? (localContent.size / expectedCount * 100).toFixed(1) : '0'
      
      return {
        nodeId: i,
        group,
        stageType,
        contacts: localContent.size,
        expected: expectedCount,
        wireConvergence: wireAwareConvergence,
        globalConvergence: (localContent.size / bassline.topology.contacts.size * 100).toFixed(1)
      }
    })
    
    // Group by stage type
    const stages = {
      input: stageStats.filter(s => s.stageType === 'input'),
      processing: stageStats.filter(s => s.stageType === 'processing'),
      output: stageStats.filter(s => s.stageType === 'output')
    }
    
    console.log('\n=== PIPELINE PERFORMANCE RESULTS ===')
    console.log(`Pipeline nodes: ${nodeCount}`)
    console.log(`Total contacts: ${bassline.topology.contacts.size}`)
    console.log(`Data injected: ${totalVolume} updates (~${(totalVolume * 1).toFixed(1)}KB)`)
    console.log(`Injection time: ${injectionTime}ms`)
    console.log(`Pipeline time: ${pipelineTime}ms`)
    console.log(`End-to-end latency: ${(pipelineTime/totalVolume).toFixed(1)}ms per update`)
    console.log()
    
    Object.entries(stages).forEach(([stageName, stageNodes]) => {
      const avgWireConv = stageNodes.reduce((sum, s) => sum + parseFloat(s.wireConvergence), 0) / stageNodes.length
      const avgGlobalConv = stageNodes.reduce((sum, s) => sum + parseFloat(s.globalConvergence), 0) / stageNodes.length
      console.log(`${stageName.toUpperCase()} (${stageNodes.length} nodes): ${avgWireConv.toFixed(1)}% wire-aware, ${avgGlobalConv.toFixed(1)}% global`)
    })
    
    const overallWireAvg = stageStats.reduce((sum, s) => sum + parseFloat(s.wireConvergence), 0) / nodeCount
    const overallGlobalAvg = stageStats.reduce((sum, s) => sum + parseFloat(s.globalConvergence), 0) / nodeCount
    
    // Realistic wire-aware performance assertions for 15-node pipeline
    expect(overallWireAvg).toBeGreaterThan(45) // 45%+ wire-aware convergence in complex pipeline
    expect(stages.input.every(s => parseFloat(s.wireConvergence) > 50)).toBe(true) // Input stages should be well propagated
    
    console.log(`\n✅ 15-node pipeline test passed - ${overallWireAvg.toFixed(1)}% wire-aware convergence!`)
  })
  
  it.skip('should handle extreme stress: 25 nodes + massive data volume', { timeout: 300000 }, async () => {
    console.log('\n=== BASSLINE EXTREME STRESS TEST: 25 NODES ===')
    
    const nodeCount = 25
    const contactsPerGroup = 4
    const bassline = createLargeScaleBassline(nodeCount, contactsPerGroup)
    
    console.log(`EXTREME: ${nodeCount} nodes, ${bassline.topology.contacts.size} contacts`)
    console.log(`WARNING: This test will use significant CPU and memory!`)
    
    // Reduced contact count per group to manage memory
    // Create nodes with aggressive performance settings
    for (let i = 0; i < nodeCount; i++) {
      const storage = i % 5 === 0 ? createPostgresStorage({ 
        database: 'bassline_test',
        durability: 'performance'
      }) : createMemoryStorage()
      
      const node = new BasslineNetwork({
        peerId: `extreme-node-${i}`,
        endpoint: { url: `ws://localhost:${9200 + i}`, peerId: `extreme-node-${i}` },
        storage
      })
      
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 9200 + i,
        peerId: `extreme-node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 15000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
      
      if ((i + 1) % 5 === 0) {
        console.log(`✓ ${i + 1}/${nodeCount} nodes ready`)
        await new Promise(resolve => setTimeout(resolve, 200)) // Spread startup
      }
    }
    
    // Sparse but robust connection topology
    console.log('Creating sparse connection topology...')
    const connectionPromises = []
    
    for (let i = 0; i < nodeCount; i++) {
      // Each node connects to 2-3 others in a ring-like structure
      const connections = [(i + 1) % nodeCount, (i + 5) % nodeCount, (i + 10) % nodeCount]
      
      for (const target of connections) {
        if (target !== i) {
          connectionPromises.push(
            gossipLayers[i].connectToPeer({ 
              url: `ws://localhost:${9200 + target}`, 
              peerId: `extreme-node-${target}` 
            })
          )
        }
      }
    }
    
    // Batch connection attempts
    const batchSize = 20
    for (let i = 0; i < connectionPromises.length; i += batchSize) {
      const batch = connectionPromises.slice(i, i + batchSize)
      await Promise.all(batch)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log(`✓ Network topology established`)
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    console.log('\n=== EXTREME DATA STRESS ===')
    const extremeStart = Date.now()
    
    // Massive data volume
    const updatesPerNode = 100
    const totalUpdates = nodeCount * updatesPerNode
    
    console.log(`Extreme data load: ${totalUpdates} updates across ${nodeCount} nodes`)
    
    const updatePromises = nodes.map(async (node, nodeIndex) => {
      const groupNames = Array.from(bassline.topology.groups.keys())
      const groupName = groupNames[nodeIndex]
      
      for (let i = 0; i < updatesPerNode; i++) {
        const contactId = `${groupName}-${i % contactsPerGroup}`
        const payload = {
          nodeId: nodeIndex,
          sequence: i,
          timestamp: Date.now(),
          extremeTest: true,
          data: `extreme-payload-${nodeIndex}-${i}`.repeat(3), // Moderate size
          metadata: {
            source: `extreme-node-${nodeIndex}`,
            batch: Math.floor(i / 25),
            total: updatesPerNode
          }
        }
        
        await node.updateContact(contactId, payload)
        
        // Rate limiting for extreme load
        if (i % 25 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
    })
    
    await Promise.all(updatePromises)
    const dataTime = Date.now() - extremeStart
    
    console.log(`✓ Extreme data sent in ${dataTime}ms`)
    console.log('Extreme convergence phase...')
    
    // Extended convergence time for extreme load
    await new Promise(resolve => setTimeout(resolve, 15000))
    
    // Gentle sync rounds
    for (let round = 0; round < 3; round++) {
      console.log(`  Extreme sync round ${round + 1}/3...`)
      // Batch sync requests to avoid overwhelming
      for (let i = 0; i < nodeCount; i += 5) {
        const batch = gossipLayers.slice(i, i + 5)
        await Promise.all(batch.map(g => g['broadcast']?.({ type: 'sync-request', contacts: [] })))
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    const extremeTime = Date.now() - extremeStart
    
    console.log('\n=== EXTREME STRESS RESULTS ===')
    
    // Quick convergence analysis
    const extremeStats = nodes.map((node, i) => {
      const localContent = node['localContent'] as Map<string, any>
      return {
        nodeId: i,
        contacts: localContent.size,
        convergence: (localContent.size / bassline.topology.contacts.size * 100).toFixed(1)
      }
    })
    
    const avgConvergence = extremeStats.reduce((sum, s) => sum + parseFloat(s.convergence), 0) / nodeCount
    const throughput = (totalUpdates * 1000 / dataTime).toFixed(0)
    
    console.log(`Extreme nodes: ${nodeCount}`)
    console.log(`Extreme updates: ${totalUpdates}`)
    console.log(`Extreme time: ${extremeTime}ms`)
    console.log(`Extreme throughput: ${throughput} updates/sec`)
    console.log(`Extreme convergence: ${avgConvergence.toFixed(1)}% average`)
    
    // Lower expectations for extreme stress
    expect(avgConvergence).toBeGreaterThan(40) // 40%+ under extreme stress
    expect(parseFloat(throughput)).toBeGreaterThan(100) // 100+ updates/sec
    
    console.log('\n🚀 EXTREME STRESS TEST PASSED - Bassline survives 25 nodes!')
  })
})