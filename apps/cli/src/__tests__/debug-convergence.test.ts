/**
 * Debug Convergence Test
 * Isolate and understand the convergence measurement issues
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BasslineNetwork } from '../bassline/BasslineNetwork'
import { BasslineGossip } from '../bassline/BasslineGossip'
import { createMemoryStorage } from '@bassline/storage-memory'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { brand } from '@bassline/core'
import type { Bassline } from '../bassline/types'
import { Pool } from 'pg'

describe('Debug Convergence Issues', () => {
  let nodes: BasslineNetwork[] = []
  let gossipLayers: BasslineGossip[] = []
  let pool: Pool

  beforeEach(async () => {
    pool = new Pool({ database: 'bassline_test', max: 10 })
  })

  afterEach(async () => {
    await Promise.all(gossipLayers.map(g => g.stop()))
    await Promise.all(nodes.map(n => n.shutdown()))
    await pool?.end()
  })

  it('should debug 3-node convergence step by step', { timeout: 30000 }, async () => {
    console.log('\n=== DEBUG CONVERGENCE TEST ===')
    
    // Simple 3-node bassline
    const bassline: Bassline = {
      id: brand.networkId('debug-convergence'),
      version: '1.0.0',
      topology: {
        groups: new Map([
          ['input', { name: 'Input Group', inputs: [], outputs: ['input-out'] }],
          ['compute', { name: 'Compute Group', inputs: ['compute-in'], outputs: ['compute-out'] }],
          ['output', { name: 'Output Group', inputs: ['output-in'], outputs: [] }]
        ]),
        contacts: new Map([
          ['input-out', { groupId: 'input', blendMode: 'accept-last', name: 'Input Output' }],
          ['compute-in', { groupId: 'compute', blendMode: 'accept-last', name: 'Compute Input' }],
          ['compute-out', { groupId: 'compute', blendMode: 'accept-last', name: 'Compute Output' }],
          ['output-in', { groupId: 'output', blendMode: 'accept-last', name: 'Output Input' }]
        ]),
        wires: new Map([
          ['wire1', { fromId: 'input-out', toId: 'compute-in', type: 'bidirectional' }],
          ['wire2', { fromId: 'compute-out', toId: 'output-in', type: 'bidirectional' }]
        ])
      },
      endpoints: new Map(),
      metadata: {
        name: 'Debug Convergence Network',
        description: 'Simple 3-node network for debugging',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }
    }

    console.log(`Topology contacts: ${bassline.topology.contacts.size}`)
    console.log(`Topology groups: ${bassline.topology.groups.size}`)
    console.log(`Topology wires: ${bassline.topology.wires.size}`)

    // Create 3 nodes with different storage
    const storageTypes = ['memory', 'postgres', 'memory']
    const nodeCount = 3

    for (let i = 0; i < nodeCount; i++) {
      let storage
      switch (storageTypes[i]) {
        case 'postgres':
          storage = createPostgresStorage({ 
            options: { database: 'bassline_test' },
            durability: 'performance'
          })
          break
        default:
          storage = createMemoryStorage()
      }

      const node = new BasslineNetwork({
        peerId: `debug-node-${i}`,
        endpoint: { url: `ws://localhost:${8000 + i}`, peerId: `debug-node-${i}` },
        storage
      })

      // Each node runs one group
      const groupNames = Array.from(bassline.topology.groups.keys())
      console.log(`Node ${i} will run group: ${groupNames[i]}`)
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)

      const gossip = new BasslineGossip({
        port: 8000 + i,
        peerId: `debug-node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 5000
      })

      await gossip.start()
      gossipLayers.push(gossip)
      
      console.log(`✓ Node ${i} ready (${storageTypes[i]} storage)`)
    }

    // Connect nodes
    console.log('\nConnecting nodes...')
    await gossipLayers[1].connectToPeer({ url: 'ws://localhost:8000', peerId: 'debug-node-0' })
    await gossipLayers[2].connectToPeer({ url: 'ws://localhost:8001', peerId: 'debug-node-1' })
    
    console.log('✓ Connections established')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check initial state
    console.log('\n=== INITIAL STATE ===')
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i]
      const localContent = node['localContent'] as Map<string, any>
      console.log(`Node ${i} has ${localContent.size} contacts:`, Array.from(localContent.keys()))
    }

    // Send a few test updates
    console.log('\n=== SENDING TEST UPDATES ===')
    await nodes[0].updateContact('input-out', { message: 'Hello from input', timestamp: Date.now() })
    console.log('✓ Sent update to input-out')
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await nodes[1].updateContact('compute-out', { result: 42, timestamp: Date.now() })
    console.log('✓ Sent update to compute-out')
    
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check convergence after updates
    console.log('\n=== STATE AFTER UPDATES ===')
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i]
      const localContent = node['localContent'] as Map<string, any>
      console.log(`Node ${i} has ${localContent.size} contacts:`, Array.from(localContent.keys()))
      
      for (const [contactId, content] of localContent.entries()) {
        console.log(`  ${contactId}:`, JSON.stringify(content).slice(0, 100))
      }
    }

    // Wait longer for propagation
    console.log('\n=== WAITING FOR PROPAGATION ===')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Final state check
    console.log('\n=== FINAL STATE ===')
    const allContactIds = new Set<string>()
    
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i]
      const localContent = node['localContent'] as Map<string, any>
      
      for (const contactId of localContent.keys()) {
        allContactIds.add(contactId)
      }
      
      console.log(`Node ${i} final state:`)
      console.log(`  Contacts: ${localContent.size}`)
      console.log(`  IDs: [${Array.from(localContent.keys()).join(', ')}]`)
    }

    const totalUniqueContacts = allContactIds.size
    console.log(`\nTotal unique contacts across all nodes: ${totalUniqueContacts}`)
    console.log(`Topology contacts: ${bassline.topology.contacts.size}`)

    // Calculate convergence properly
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i]
      const localContent = node['localContent'] as Map<string, any>
      const convergencePercent = (localContent.size / totalUniqueContacts * 100).toFixed(1)
      console.log(`Node ${i} convergence: ${convergencePercent}% (${localContent.size}/${totalUniqueContacts})`)
    }
  })
})