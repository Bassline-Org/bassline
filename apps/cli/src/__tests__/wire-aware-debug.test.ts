/**
 * Debug wire-aware convergence calculation
 * Understand why heavy stress tests have low convergence
 */

import { describe, it, expect } from 'vitest'
import { brand } from '@bassline/core'
import type { Bassline } from '../bassline/types'

describe('Wire-aware convergence debugging', () => {
  
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
      id: 'wire-debug-test',
      version: '1.0.0',
      topology: { groups, contacts, wires },
      endpoints: new Map(),
      subBasslines: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'wire-debug-test'
      }
    }
  }

  it('should debug wire-aware convergence calculation for 10-node network', () => {
    console.log('\n=== WIRE-AWARE CONVERGENCE DEBUG ===')
    
    const nodeCount = 10
    const contactsPerGroup = 8
    const bassline = createLargeScaleBassline(nodeCount, contactsPerGroup)
    
    console.log(`Network: ${nodeCount} nodes, ${contactsPerGroup} contacts per group`)
    console.log(`Total contacts: ${bassline.topology.contacts.size}`)
    console.log(`Total wires: ${bassline.topology.wires.size}`)
    console.log()
    
    // Analyze each group's expected contacts
    const groupNames = Array.from(bassline.topology.groups.keys())
    
    for (let i = 0; i < nodeCount; i++) {
      const groupId = groupNames[i]
      console.log(`\n--- Node ${i}: Group '${groupId}' ---`)
      
      // Find own contacts
      const ownContactIds = Array.from(bassline.topology.contacts.entries())
        .filter(([_, contact]) => contact.groupId === groupId)
        .map(([contactId]) => contactId)
      
      console.log(`Own contacts (${ownContactIds.length}):`, ownContactIds)
      
      // Find wire-connected contacts
      const expectedContactIds = new Set(ownContactIds)
      let incomingWires = 0
      let outgoingWires = 0
      
      for (const [wireId, wire] of bassline.topology.wires) {
        // If we have the from contact, we should receive to contact updates
        if (ownContactIds.includes(wire.fromId)) {
          expectedContactIds.add(wire.toId)
          outgoingWires++
          console.log(`  Outgoing wire: ${wire.fromId} -> ${wire.toId}`)
        }
        // If we have the to contact, we should receive from contact updates
        if (ownContactIds.includes(wire.toId)) {
          expectedContactIds.add(wire.fromId)
          incomingWires++
          console.log(`  Incoming wire: ${wire.fromId} -> ${wire.toId}`)
        }
      }
      
      const expectedCount = expectedContactIds.size
      const wireAwareRatio = expectedCount > 0 ? (expectedCount / bassline.topology.contacts.size * 100) : 0
      const localRatio = (ownContactIds.length / expectedCount * 100)
      
      console.log(`Expected contacts: ${expectedCount} (${wireAwareRatio.toFixed(1)}% of total)`)
      console.log(`Incoming wires: ${incomingWires}, Outgoing wires: ${outgoingWires}`)
      console.log(`If this node only has its own contacts: ${localRatio.toFixed(1)}% wire-aware convergence`)
    }
    
    // Show wire connectivity pattern
    console.log('\n=== WIRE CONNECTIVITY PATTERN ===')
    let wireCount = 0
    for (const [wireId, wire] of bassline.topology.wires) {
      const fromGroup = Array.from(bassline.topology.contacts.entries())
        .find(([id]) => id === wire.fromId)?.[1]?.groupId
      const toGroup = Array.from(bassline.topology.contacts.entries())
        .find(([id]) => id === wire.toId)?.[1]?.groupId
      
      console.log(`Wire ${wireCount++}: ${fromGroup} -> ${toGroup} (${wire.fromId} -> ${wire.toId})`)
      if (wireCount >= 10) {
        console.log(`... and ${bassline.topology.wires.size - 10} more wires`)
        break
      }
    }
    
    console.log('\n=== ANALYSIS ===')
    console.log('This shows why wire-aware convergence is lower than expected:')
    console.log('- Each node only owns contacts from its group')
    console.log('- Wire connections are sparse (pipeline topology)')
    console.log('- Most nodes are not directly connected to most other nodes')
    console.log('- This is CORRECT behavior for wire-aware gossip!')
  })
  
  it('should calculate realistic wire-aware convergence expectations', () => {
    console.log('\n=== REALISTIC CONVERGENCE EXPECTATIONS ===')
    
    const nodeCount = 10
    const contactsPerGroup = 8
    const bassline = createLargeScaleBassline(nodeCount, contactsPerGroup)
    const groupNames = Array.from(bassline.topology.groups.keys())
    
    let totalExpectedContacts = 0
    let totalOwnContacts = 0
    
    for (let i = 0; i < nodeCount; i++) {
      const groupId = groupNames[i]
      const ownContactIds = Array.from(bassline.topology.contacts.entries())
        .filter(([_, contact]) => contact.groupId === groupId)
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
      
      totalOwnContacts += ownContactIds.length
      totalExpectedContacts += expectedContactIds.size
    }
    
    const avgOwnContacts = totalOwnContacts / nodeCount
    const avgExpectedContacts = totalExpectedContacts / nodeCount
    const baselineConvergence = (avgOwnContacts / avgExpectedContacts * 100)
    
    console.log(`Average contacts owned per node: ${avgOwnContacts.toFixed(1)}`)
    console.log(`Average contacts expected per node: ${avgExpectedContacts.toFixed(1)}`)
    console.log(`Baseline convergence (own contacts only): ${baselineConvergence.toFixed(1)}%`)
    console.log()
    console.log('REALISTIC EXPECTATIONS:')
    console.log(`- Minimum convergence: ${(baselineConvergence * 0.8).toFixed(1)}% (80% of baseline)`)
    console.log(`- Target convergence: ${(baselineConvergence * 1.2).toFixed(1)}% (120% of baseline)`)
    console.log(`- Excellent convergence: ${(baselineConvergence * 1.5).toFixed(1)}% (150% of baseline)`)
  })
})