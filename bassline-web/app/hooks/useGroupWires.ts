import { useState, useEffect } from 'react'
import { getNetworkClient } from '~/network/client'
import type { Wire, GroupState } from '~/propagation-core-v2/types'

interface ProcessedWire {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
  type: 'default' | 'straight'
  animated: boolean
}

/**
 * Hook to get all wires that should be displayed in a group, including:
 * 1. Wires between contacts in the current group
 * 2. Wires from parent contacts to subgroup boundary contacts (inputs)
 * 3. Wires from subgroup boundary contacts to parent contacts (outputs)
 * 
 * Handles proper subscription to changes in both parent and subgroups
 */
export function useGroupWires(
  groupState: GroupState,
  subgroupData: Map<string, { id: string; boundaryContacts?: Array<{ id: string }> }>
): ProcessedWire[] {
  const [subgroupWires, setSubgroupWires] = useState<Map<string, Wire[]>>(new Map())
  const [processedWires, setProcessedWires] = useState<ProcessedWire[]>([])
  
  // Fetch wires from subgroups that connect to parent
  useEffect(() => {
    const client = getNetworkClient()
    const subgroupIds = Array.from(groupState.group.subgroupIds)
    
    const fetchSubgroupWires = async () => {
      const newSubgroupWires = new Map<string, Wire[]>()
      
      for (const subgroupId of subgroupIds) {
        try {
          const subgroupState = await client.getState(subgroupId)
          const externalWires: Wire[] = []
          
          // Find wires that connect boundary contacts to parent contacts
          subgroupState.wires.forEach((wire) => {
            // Check if this wire connects to a contact in the parent group
            const fromInParent = groupState.contacts.has(wire.fromId)
            const toInParent = groupState.contacts.has(wire.toId)
            
            if (fromInParent || toInParent) {
              externalWires.push(wire)
            }
          })
          
          if (externalWires.length > 0) {
            newSubgroupWires.set(subgroupId, externalWires)
          }
        } catch (error) {
          console.warn(`Failed to fetch wires for subgroup ${subgroupId}:`, error)
        }
      }
      
      setSubgroupWires(newSubgroupWires)
    }
    
    if (subgroupIds.length > 0) {
      fetchSubgroupWires()
    }
    
    // Subscribe to changes in subgroups
    const unsubscribes: (() => void)[] = []
    
    for (const subgroupId of subgroupIds) {
      // Subscribe to changes for this specific subgroup
      const unsubscribe = client.subscribe(subgroupId, (changes) => {
        // Check if any wire was added/removed in this subgroup
        const hasWireChange = changes.some(change => {
          if (change.type === 'wire-added' || change.type === 'wire-removed') {
            const data = change.data as { groupId: string }
            return data.groupId === subgroupId
          }
          return false
        })
        
        if (hasWireChange) {
          // Refetch wires for this subgroup
          fetchSubgroupWires()
        }
      })
      
      unsubscribes.push(unsubscribe)
    }
    
    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [groupState.group.subgroupIds, groupState.contacts])
  
  // Process all wires whenever dependencies change
  useEffect(() => {
    const newProcessedWires: ProcessedWire[] = []
    
    // Process wires from the current group
    groupState.wires.forEach((wire) => {
      // Skip wires where both endpoints are boundary contacts going outside
      const fromContact = groupState.contacts.get(wire.fromId)
      const toContact = groupState.contacts.get(wire.toId)
      
      // If both are boundary contacts or both are missing, skip this wire
      if ((fromContact?.isBoundary && toContact?.isBoundary) ||
          (!fromContact && !toContact)) {
        return
      }
      let sourceNode = wire.fromId
      let sourceHandle: string | undefined = undefined
      let targetNode = wire.toId
      let targetHandle: string | undefined = undefined
      
      // Check if source is a boundary contact of any subgroup
      let sourceIsBoundary = false
      for (const [subgroupId, subgroup] of subgroupData) {
        if (subgroup.boundaryContacts?.some(bc => bc.id === wire.fromId)) {
          sourceNode = subgroupId
          sourceHandle = wire.fromId
          sourceIsBoundary = true
          break
        }
      }
      
      // Check if target is a boundary contact of any subgroup  
      let targetIsBoundary = false
      for (const [subgroupId, subgroup] of subgroupData) {
        if (subgroup.boundaryContacts?.some(bc => bc.id === wire.toId)) {
          targetNode = subgroupId
          targetHandle = wire.toId
          targetIsBoundary = true
          break
        }
      }
      
      // Only create edge if both source and target exist in current view
      const sourceExists = sourceIsBoundary ? subgroupData.has(sourceNode) : groupState.contacts.has(sourceNode)
      const targetExists = targetIsBoundary ? subgroupData.has(targetNode) : groupState.contacts.has(targetNode)
      
      if (sourceExists && targetExists) {
        newProcessedWires.push({
          id: wire.id,
          source: sourceNode,
          sourceHandle,
          target: targetNode,
          targetHandle,
          type: wire.type === 'directed' ? 'default' : 'straight',
          animated: wire.type === 'directed',
        })
      }
    })
    
    // Process wires from subgroups that connect to parent
    subgroupWires.forEach((wires, subgroupId) => {
      wires.forEach((wire) => {
        let sourceNode = wire.fromId
        let sourceHandle: string | undefined = undefined
        let targetNode = wire.toId
        let targetHandle: string | undefined = undefined
        
        // Check if source is in parent (regular contact) or subgroup (boundary)
        if (groupState.contacts.has(wire.fromId)) {
          // Source is in parent, target must be boundary contact
          targetNode = subgroupId
          targetHandle = wire.toId
        } else {
          // Source must be boundary contact, target is in parent
          sourceNode = subgroupId
          sourceHandle = wire.fromId
        }
        
        newProcessedWires.push({
          id: wire.id,
          source: sourceNode,
          sourceHandle,
          target: targetNode,
          targetHandle,
          type: wire.type === 'directed' ? 'default' : 'straight',
          animated: wire.type === 'directed',
        })
      })
    })
    
    setProcessedWires(newProcessedWires)
  }, [groupState.wires, groupState.contacts, subgroupData, subgroupWires])
  
  return processedWires
}