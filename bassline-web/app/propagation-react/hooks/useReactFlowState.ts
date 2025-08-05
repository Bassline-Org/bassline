import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import { useNetworkState } from '../contexts/NetworkState'

export function useReactFlowState() {
  const { state } = useNetworkState()
  const { currentGroupId, selectedContactIds, selectedGroupIds } = state
  
  const { nodes, edges } = useMemo(() => {
    const currentGroup = state.groups[currentGroupId]
    if (!currentGroup) return { nodes: [], edges: [] }
    
    // Create nodes for contacts in current group
    const contactNodes: Node[] = currentGroup.contactIds.map(contactId => {
      const contact = state.contacts[contactId]
      if (!contact) return null
      
      return {
        id: contact.id,
        position: contact.position,
        type: contact.isBoundary ? 'boundary' : 'contact',
        draggable: true,
        selectable: true,
        selected: selectedContactIds.includes(contact.id),
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0,
          borderRadius: 0
        },
        data: {}
      }
    }).filter(Boolean) as Node[]
    
    // Create nodes for subgroups in current group
    const groupNodes: Node[] = currentGroup.subgroupIds.map(groupId => {
      const group = state.groups[groupId]
      if (!group) return null
      
      return {
        id: group.id,
        position: group.position,
        type: 'group',
        draggable: true,
        selectable: true,
        selected: selectedGroupIds.includes(group.id),
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0,
          borderRadius: 0,
          width: 'auto'
        },
        data: {}
      }
    }).filter(Boolean) as Node[]
    
    const allNodes = [...contactNodes, ...groupNodes]
    
    // Create edges for wires in current group
    const wireEdges: Edge[] = Object.values(state.wires)
      .filter(wire => wire.groupId === currentGroupId)
      .map(wire => {
        // Handle boundary contact connections (wires to/from subgroups)
        let sourceNodeId = wire.fromId
        let targetNodeId = wire.toId
        let sourceHandle: string | undefined
        let targetHandle: string | undefined
        
        // Check if source is a boundary contact in a subgroup
        for (const subgroupId of currentGroup.subgroupIds) {
          const subgroup = state.groups[subgroupId]
          if (subgroup?.boundaryContactIds.includes(wire.fromId)) {
            sourceNodeId = subgroupId
            sourceHandle = wire.fromId
            break
          }
        }
        
        // Check if target is a boundary contact in a subgroup
        for (const subgroupId of currentGroup.subgroupIds) {
          const subgroup = state.groups[subgroupId]
          if (subgroup?.boundaryContactIds.includes(wire.toId)) {
            targetNodeId = subgroupId
            targetHandle = wire.toId
            break
          }
        }
        
        return {
          id: wire.id,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle,
          targetHandle,
          selectable: true,
          style: { 
            stroke: wire.type === 'directed' ? '#555' : '#888',
            strokeWidth: 2,
            opacity: 0.8
          },
          markerEnd: wire.type === 'directed' ? { type: MarkerType.ArrowClosed } : undefined,
          markerStart: undefined
        }
      })
    
    return { nodes: allNodes, edges: wireEdges }
  }, [state, currentGroupId, selectedContactIds, selectedGroupIds])
  
  return { nodes, edges }
}