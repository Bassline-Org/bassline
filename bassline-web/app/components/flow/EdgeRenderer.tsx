import type { Edge } from 'reactflow';
import type { ContactGroup, ContactGroupWire } from '~/models/types';

/**
 * Converts wires from the model to React Flow edges
 * This is a pure function that maps model data to view data
 */
export function wiresToEdges(group: ContactGroup): Edge[] {
  const edges: Edge[] = [];
  
  group.wires.forEach((wire) => {
    // Determine the actual nodes that should be connected in React Flow
    const { sourceNode, targetNode, sourceHandle, targetHandle } = resolveWireEndpoints(wire, group);
    
    if (sourceNode && targetNode) {
      const edge = {
        id: wire.id,
        source: sourceNode,
        target: targetNode,
        sourceHandle,
        targetHandle,
        type: 'contactWire',
        markerEnd: {
          type: 'arrowclosed',
        },
        data: {
          wire,
        },
      };
      
      console.log(`Edge ${wire.id}: ${sourceNode}${sourceHandle ? `[${sourceHandle}]` : ''} -> ${targetNode}${targetHandle ? `[${targetHandle}]` : ''}`);
      edges.push(edge);
    }
  });
  
  return edges;
}

/**
 * Resolves wire endpoints to React Flow node IDs and handles
 * Handles the logic for boundary contacts in subgroups
 */
function resolveWireEndpoints(wire: ContactGroupWire, group: ContactGroup) {
  let sourceNode = wire.from;
  let targetNode = wire.to;
  let sourceHandle: string | undefined;
  let targetHandle: string | undefined;
  
  // Check if source is a regular contact in this group
  const sourceInGroup = group.contacts.has(wire.from);
  
  // Check if target is a regular contact in this group
  const targetInGroup = group.contacts.has(wire.to);
  
  // If source is not in the group, check if it's a boundary contact in a subgroup
  if (!sourceInGroup) {
    for (const [subgroupId, subgroup] of group.subgroups) {
      const contact = subgroup.contacts.get(wire.from);
      if (contact && contact.isBoundary()) {
        // For boundary contacts, the visual node is the subgroup
        sourceNode = subgroupId;
        // Determine which side based on boundary position
        sourceHandle = getBoundaryHandle(contact.id, contact.position, subgroup, 'source');
        break;
      }
    }
  }
  
  // If target is not in the group, check if it's a boundary contact in a subgroup
  if (!targetInGroup) {
    for (const [subgroupId, subgroup] of group.subgroups) {
      const contact = subgroup.contacts.get(wire.to);
      if (contact && contact.isBoundary()) {
        // For boundary contacts, the visual node is the subgroup
        targetNode = subgroupId;
        // Determine which side based on boundary position
        targetHandle = getBoundaryHandle(contact.id, contact.position, subgroup, 'target');
        break;
      }
    }
  }
  
  return { sourceNode, targetNode, sourceHandle, targetHandle };
}

/**
 * Determines the handle ID for a boundary contact based on its position
 */
function getBoundaryHandle(
  contactId: string,
  position: { x: number; y: number },
  subgroup: ContactGroup,
  type: 'source' | 'target'
): string {
  // Get all boundary contacts in the subgroup to determine layout
  const boundaries = Array.from(subgroup.contacts.values())
    .filter(c => c.isBoundary());
  
  if (boundaries.length === 0) return `${contactId}-left-${type}`;
  
  // Find the midpoint X to determine left/right
  const xPositions = boundaries.map(b => b.position.x);
  const midX = (Math.min(...xPositions) + Math.max(...xPositions)) / 2;
  
  // Determine side based on position relative to midpoint
  const side = position.x < midX ? 'left' : 'right';
  
  // IMPORTANT: Both source and target handles exist on both sides
  // This allows bidirectional connections
  return `${contactId}-${side}-${type}`;
}