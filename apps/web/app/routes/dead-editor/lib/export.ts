import type { DeadNode, DeadConnection, DeadNetworkExport, DeadCellExport, DeadPropagatorExport } from '../types'
import { DeadCell } from '../nodes/DeadCell'
import { DeadPropagator } from '../nodes/DeadPropagator'

export function exportToIR(
  nodes: DeadNode[], 
  connections: DeadConnection[],
  format: 'flat' | 'grouped' = 'flat'
): DeadNetworkExport {
  const cells: DeadCellExport[] = []
  const propagators: DeadPropagatorExport[] = []
  
  // Process nodes
  nodes.forEach(node => {
    if (node instanceof DeadCell) {
      cells.push({
        id: node.id,
        merge: node.mergeFunction || 'last',
        initial: node.initialValue || null,
        ...(format === 'grouped' && { position: { x: 0, y: 0 } }) // Add position if grouped
      })
    } else if (node instanceof DeadPropagator) {
      // Find connections for this propagator
      const inputs = connections
        .filter(conn => conn.target === node.id)
        .map(conn => conn.source)
      
      const outputs = connections
        .filter(conn => conn.source === node.id)
        .map(conn => conn.target)
      
      propagators.push({
        id: node.id,
        fn: node.functionType,
        inputs,
        outputs,
        ...(format === 'grouped' && { position: { x: 0, y: 0 } }) // Add position if grouped
      })
    }
  })
  
  // Extract unique prefixes
  const prefixes = [...new Set(nodes.map(n => n.prefix))].sort()
  
  return {
    cells,
    propagators,
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      ...(format === 'grouped' && { prefixes })
    }
  }
}

export function importFromIR(ir: DeadNetworkExport): { 
  nodes: DeadNode[], 
  connections: DeadConnection[] 
} {
  const nodes: DeadNode[] = []
  const connections: DeadConnection[] = []
  const nodeMap = new Map<string, DeadNode>()
  
  // Create cell nodes
  ir.cells.forEach(cellDef => {
    const cell = new DeadCell(cellDef.id)
    cell.mergeFunction = cellDef.merge
    cell.initialValue = cellDef.initial
    nodes.push(cell)
    nodeMap.set(cellDef.id, cell)
  })
  
  // Create propagator nodes and connections
  ir.propagators.forEach(propDef => {
    const propagator = new DeadPropagator(propDef.id, propDef.fn)
    nodes.push(propagator)
    nodeMap.set(propDef.id, propagator)
    
    // Create connections from inputs
    propDef.inputs.forEach(inputId => {
      const sourceNode = nodeMap.get(inputId)
      if (sourceNode) {
        connections.push({
          id: `${inputId}->${propDef.id}`,
          source: inputId,
          target: propDef.id,
          sourceOutput: 'output',
          targetInput: 'input'
        } as DeadConnection)
      }
    })
    
    // Create connections to outputs
    propDef.outputs.forEach(outputId => {
      const targetNode = nodeMap.get(outputId)
      if (targetNode) {
        connections.push({
          id: `${propDef.id}->${outputId}`,
          source: propDef.id,
          target: outputId,
          sourceOutput: 'output',
          targetInput: 'input'
        } as DeadConnection)
      }
    })
  })
  
  return { nodes, connections }
}