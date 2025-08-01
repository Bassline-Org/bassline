import { useState, useCallback, useMemo } from 'react'
import { 
  type Node, 
  type Edge, 
  type Connection, 
  useNodesState, 
  useEdgesState,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType
} from '@xyflow/react'
import { PropagationNetwork, Contact, ContactGroup, type Position } from '../../propagation-core'

interface ContactNodeData {
  content: any
  blendMode: 'accept-last' | 'merge'
  isBoundary: boolean
  setContent: (content: any) => void
}

export function usePropagationNetwork() {
  // Create the core network
  const [network] = useState(() => new PropagationNetwork())
  
  // Initialize with a couple of example nodes
  const initializeNetwork = useCallback(() => {
    const c1 = network.addContact({ x: 100, y: 100 })
    const c2 = network.addContact({ x: 300, y: 100 })
    network.connect(c1.id, c2.id)
    return network.getCurrentView()
  }, [network])
  
  // React Flow state - initialize with data
  const [nodes, setNodes] = useState<Node[]>(() => {
    const view = initializeNetwork()
    return view.contacts.map(contact => ({
      id: contact.id,
      position: contact.position,
      type: network.rootGroup.boundaryContacts.has(contact.id) ? 'boundary' : 'contact',
      data: {
        content: contact.content,
        blendMode: contact.blendMode,
        isBoundary: network.rootGroup.boundaryContacts.has(contact.id),
        setContent: (content: any) => contact.setContent(content)
      }
    }))
  })
  
  const [edges, setEdges] = useState<Edge[]>(() => {
    const view = network.getCurrentView()
    return view.wires.map(wire => ({
      id: wire.id,
      source: wire.fromId,
      target: wire.toId,
      type: wire.type,
      animated: true,
      style: { 
        stroke: wire.type === 'directed' ? '#555' : '#888',
        strokeWidth: 2
      },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: wire.type === 'bidirectional' ? { type: MarkerType.ArrowClosed } : undefined
    }))
  })
  
  // Sync network state to React Flow
  const syncToReactFlow = useCallback(() => {
    const currentView = network.getCurrentView()
    
    // Map contacts to nodes
    const newNodes: Node[] = currentView.contacts.map(contact => ({
      id: contact.id,
      position: contact.position,
      type: network.rootGroup.boundaryContacts.has(contact.id) ? 'boundary' : 'contact',
      data: {
        content: contact.content,
        blendMode: contact.blendMode,
        isBoundary: network.rootGroup.boundaryContacts.has(contact.id),
        setContent: (content: any) => {
          contact.setContent(content)
          syncToReactFlow() // Re-sync after change
        }
      }
    }))
    
    // Map wires to edges
    const newEdges: Edge[] = currentView.wires.map(wire => ({
      id: wire.id,
      source: wire.fromId,
      target: wire.toId,
      type: wire.type,
      animated: true,
      style: { 
        stroke: wire.type === 'directed' ? '#555' : '#888',
        strokeWidth: 2
      },
      markerEnd: { type: MarkerType.ArrowClosed },
      markerStart: wire.type === 'bidirectional' ? { type: MarkerType.ArrowClosed } : undefined
    }))
    
    setNodes(newNodes)
    setEdges(newEdges)
  }, [network])
  
  // Handle node changes (position updates and deletions)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Apply changes to React Flow state
    setNodes(nds => applyNodeChanges(changes, nds))
    
    // Handle changes in core network
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        const contact = network.findContact(change.id)
        if (contact) {
          contact.position = change.position
        }
      } else if (change.type === 'remove') {
        // Remove from core network
        network.removeContact(change.id)
        // Sync to update edges that might have been removed
        syncToReactFlow()
      }
    })
  }, [network, syncToReactFlow])
  
  // Handle edge changes
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds))
    
    // Handle edge deletions in core network
    changes.forEach(change => {
      if (change.type === 'remove') {
        network.removeWire(change.id)
      }
    })
  }, [network])
  
  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      network.connect(connection.source, connection.target)
      syncToReactFlow()
    }
  }, [network, syncToReactFlow])
  
  // API methods
  const addContact = useCallback((position: Position) => {
    const contact = network.addContact(position)
    syncToReactFlow()
    return contact
  }, [network, syncToReactFlow])
  
  const addBoundaryContact = useCallback((position: Position) => {
    const contact = network.addBoundaryContact(position)
    syncToReactFlow()
    return contact
  }, [network, syncToReactFlow])
  
  const createGroup = useCallback((name: string) => {
    const group = network.createGroup(name)
    syncToReactFlow()
    return group
  }, [network, syncToReactFlow])
  
  const updateContent = useCallback((contactId: string, content: any) => {
    const contact = network.findContact(contactId)
    if (contact) {
      contact.setContent(content)
      syncToReactFlow()
    }
  }, [network, syncToReactFlow])
  
  return {
    // React Flow props
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    
    // API methods
    addContact,
    addBoundaryContact,
    createGroup,
    updateContent,
    
    // Direct access to network
    network
  }
}