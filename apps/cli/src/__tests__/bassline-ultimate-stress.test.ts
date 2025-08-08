/**
 * Ultimate Bassline Stress Test
 * The most extreme test to push the system to its absolute limits
 */

import { describe, it, expect } from 'vitest'
import { BasslineNetwork } from '../bassline/BasslineNetwork.js'
import { BasslineGossip } from '../bassline/BasslineGossip.js'
import { createMemoryStorage } from '@bassline/storage-memory'
import { brand } from '@bassline/core'
import type { Bassline } from '../bassline/types.js'

describe('Bassline Ultimate Stress Test', () => {
  
  function createUltimateBassline(nodeCount: number): Bassline {
    const groups = new Map()
    const contacts = new Map()
    const wires = new Map()
    
    // Create groups with many contacts
    for (let i = 0; i < nodeCount; i++) {
      const groupId = `g${i}`
      
      // Each group has 10 contacts
      const inputContacts = []
      const outputContacts = []
      
      for (let j = 0; j < 5; j++) {
        inputContacts.push(`${groupId}-i${j}`)
        outputContacts.push(`${groupId}-o${j}`)
        
        contacts.set(`${groupId}-i${j}`, {
          id: brand.contactId(`${groupId}-i${j}`),
          groupId: brand.groupId(groupId),
          blendMode: 'accept-last'
        })
        
        contacts.set(`${groupId}-o${j}`, {
          id: brand.contactId(`${groupId}-o${j}`),
          groupId: brand.groupId(groupId),
          blendMode: 'accept-last'
        })
      }
      
      groups.set(groupId, {
        id: brand.groupId(groupId),
        name: `G${i}`,
        inputs: inputContacts,
        outputs: outputContacts
      })
    }
    
    // Create dense mesh of wires
    let wireId = 0
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < Math.min(i + 5, nodeCount); j++) {
        // Connect multiple contacts between groups
        for (let k = 0; k < 2; k++) {
          wires.set(`w${wireId++}`, {
            id: brand.wireId(`w${wireId}`),
            fromId: brand.contactId(`g${i}-o${k}`),
            toId: brand.contactId(`g${j}-i${k}`),
            type: 'directed'
          })
        }
      }
    }
    
    return {
      id: 'ultimate-test',
      version: '1.0.0',
      topology: { groups, contacts, wires },
      endpoints: new Map(),
      subBasslines: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'ultimate-test'
      }
    }
  }

  it('should handle 50 nodes with 100K updates at maximum throughput', { timeout: 600000 }, async () => {
    console.log('\n')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('              BASSLINE ULTIMATE STRESS TEST')
    console.log('                  50 NODES | 100K UPDATES')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log()
    
    const nodeCount = 50
    const bassline = createUltimateBassline(nodeCount)
    
    console.log('📊 NETWORK TOPOLOGY')
    console.log(`   Nodes: ${nodeCount}`)
    console.log(`   Contacts: ${bassline.topology.contacts.size}`)
    console.log(`   Wires: ${bassline.topology.wires.size}`)
    console.log()
    
    const nodes: BasslineNetwork[] = []
    const gossipLayers: BasslineGossip[] = []
    
    try {
      // Phase 1: Node Creation
      console.log('🚀 PHASE 1: NODE CREATION')
      const creationStart = Date.now()
      
      for (let i = 0; i < nodeCount; i++) {
        const node = new BasslineNetwork({
          peerId: `u${i}`,
          endpoint: { url: `ws://localhost:${20000 + i}`, peerId: `u${i}` },
          storage: createMemoryStorage()
        })
        
        const groupNames = Array.from(bassline.topology.groups.keys())
        await node.joinNetwork(bassline, [groupNames[i]])
        nodes.push(node)
        
        const gossip = new BasslineGossip({
          port: 20000 + i,
          peerId: `u${i}`,
          bassline,
          network: node,
          heartbeatInterval: 30000 // Long heartbeat to reduce overhead
        })
        
        await gossip.start()
        gossipLayers.push(gossip)
        
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`   ✓ ${i + 1}/${nodeCount} nodes\r`)
        }
      }
      
      const creationTime = Date.now() - creationStart
      console.log(`   ✅ All ${nodeCount} nodes created in ${creationTime}ms`)
      console.log()
      
      // Phase 2: Network Formation
      console.log('🔗 PHASE 2: NETWORK FORMATION')
      const connectionStart = Date.now()
      
      // Create random mesh topology
      const connectionPromises = []
      const targetConnPerNode = 5
      
      for (let i = 0; i < nodeCount; i++) {
        const peers = new Set<number>()
        while (peers.size < Math.min(targetConnPerNode, nodeCount - 1)) {
          const peer = Math.floor(Math.random() * nodeCount)
          if (peer !== i) peers.add(peer)
        }
        
        for (const peer of peers) {
          connectionPromises.push(
            gossipLayers[i].connectToPeer({ 
              url: `ws://localhost:${20000 + peer}`, 
              peerId: `u${peer}` 
            }).catch(() => null)
          )
        }
      }
      
      const results = await Promise.all(connectionPromises)
      const successfulConnections = results.filter(r => r !== null).length
      const connectionTime = Date.now() - connectionStart
      
      console.log(`   ✅ ${successfulConnections}/${connectionPromises.length} connections in ${connectionTime}ms`)
      console.log(`   Average: ${(successfulConnections / nodeCount).toFixed(1)} connections per node`)
      console.log()
      
      // Small stabilization delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Phase 3: Maximum Throughput Test
      console.log('💥 PHASE 3: MAXIMUM THROUGHPUT TEST')
      const throughputStart = Date.now()
      
      const totalUpdates = 100000
      const batchSize = 10000
      const batches = Math.ceil(totalUpdates / batchSize)
      
      console.log(`   Target: ${totalUpdates.toLocaleString()} updates`)
      console.log()
      
      let updatesSent = 0
      const updatePromises = []
      
      for (let batch = 0; batch < batches; batch++) {
        const batchStart = Date.now()
        const batchUpdates = Math.min(batchSize, totalUpdates - updatesSent)
        
        for (let i = 0; i < batchUpdates; i++) {
          const nodeIndex = Math.floor(Math.random() * nodeCount)
          const node = nodes[nodeIndex]
          const contactIndex = Math.floor(Math.random() * 5)
          const contactId = `g${nodeIndex}-o${contactIndex}`
          
          updatePromises.push(
            node.updateContact(contactId, {
              batch,
              seq: updatesSent + i,
              ts: Date.now(),
              r: Math.random()
            }).catch(() => null)
          )
          
          // Process in chunks
          if (updatePromises.length >= 1000) {
            await Promise.all(updatePromises.splice(0, 1000))
          }
        }
        
        await Promise.all(updatePromises.splice(0))
        updatesSent += batchUpdates
        
        const batchTime = Date.now() - batchStart
        const batchThroughput = (batchUpdates * 1000 / batchTime).toFixed(0)
        
        console.log(`   Batch ${batch + 1}/${batches}: ${batchUpdates.toLocaleString()} updates @ ${batchThroughput}/sec`)
      }
      
      const throughputTime = Date.now() - throughputStart
      const overallThroughput = (totalUpdates * 1000 / throughputTime).toFixed(0)
      
      console.log()
      console.log(`   ✅ ${totalUpdates.toLocaleString()} updates completed`)
      console.log()
      
      // Phase 4: Convergence Measurement
      console.log('📈 PHASE 4: CONVERGENCE ANALYSIS')
      
      // Allow propagation time
      console.log('   Waiting for propagation...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Sample convergence from subset of nodes
      const sampleSize = Math.min(10, nodeCount)
      const samples = []
      
      for (let i = 0; i < sampleSize; i++) {
        const nodeIndex = Math.floor(i * nodeCount / sampleSize)
        const localContent = nodes[nodeIndex]['localContent'] as Map<string, any>
        samples.push(localContent.size)
      }
      
      const avgContacts = samples.reduce((a, b) => a + b, 0) / sampleSize
      const minContacts = Math.min(...samples)
      const maxContacts = Math.max(...samples)
      
      console.log(`   Sample size: ${sampleSize} nodes`)
      console.log(`   Average contacts: ${avgContacts.toFixed(1)}`)
      console.log(`   Range: ${minContacts} - ${maxContacts}`)
      console.log()
      
      // Phase 5: Results
      console.log('═══════════════════════════════════════════════════════════════')
      console.log('                        FINAL RESULTS')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log()
      console.log(`  🌐 Network Scale`)
      console.log(`     • Nodes: ${nodeCount}`)
      console.log(`     • Connections: ${successfulConnections}`)
      console.log(`     • Topology: ${bassline.topology.contacts.size} contacts, ${bassline.topology.wires.size} wires`)
      console.log()
      console.log(`  ⚡ Performance`)
      console.log(`     • Updates sent: ${totalUpdates.toLocaleString()}`)
      console.log(`     • Time taken: ${(throughputTime / 1000).toFixed(1)}s`)
      console.log(`     • Throughput: ${parseInt(overallThroughput).toLocaleString()} updates/sec`)
      console.log()
      console.log(`  📊 Convergence`)
      console.log(`     • Average contacts: ${avgContacts.toFixed(1)}`)
      console.log(`     • Min/Max: ${minContacts}/${maxContacts}`)
      console.log()
      
      // Assertions
      expect(parseInt(overallThroughput)).toBeGreaterThan(10000) // 10K+ updates/sec
      expect(avgContacts).toBeGreaterThan(5) // Some propagation occurred
      expect(successfulConnections).toBeGreaterThan(nodeCount * 3) // Good connectivity
      
      console.log('  ✅ ULTIMATE STRESS TEST PASSED!')
      console.log('═══════════════════════════════════════════════════════════════')
      console.log()
      
    } finally {
      // Cleanup
      console.log('🧹 Cleaning up...')
      await Promise.race([
        Promise.all([
          ...gossipLayers.map(g => g.shutdown().catch(() => {})),
          ...nodes.map(n => n.shutdown().catch(() => {}))
        ]),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
      console.log('   ✓ Cleanup complete')
    }
  })
})