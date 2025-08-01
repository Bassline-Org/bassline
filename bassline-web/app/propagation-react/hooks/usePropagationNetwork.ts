import { useState, useCallback, useEffect } from 'react'
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
  const [currentGroupId, setCurrentGroupId] = useState(network.currentGroup.id)
  
  // Initialize with a couple of example nodes
  const initializeNetwork = useCallback(() => {
    const c1 = network.addContact({ x: 100, y: 100 })
    const c2 = network.addContact({ x: 300, y: 100 })
    network.connect(c1.id, c2.id)
    
    // Add an example gadget
    const gadget = network.createGroup('Example Gadget')
    gadget.position = { x: 600, y: 100 }
    // Switch to gadget to add internals
    const prevGroup = network.currentGroup
    network.currentGroup = gadget
    
    // Add input and output boundary contacts
    const input = network.addBoundaryContact({ x: 50, y: 100 }, 'input', 'in')
    const output = network.addBoundaryContact({ x: 350, y: 100 }, 'output', 'out')
    
    // Add internal contact
    const internal = network.addContact({ x: 200, y: 100 })
    
    // Wire them up
    network.connect(input.id, internal.id)
    network.connect(internal.id, output.id)
    
    // Switch back
    network.currentGroup = prevGroup
    
    // Connect the gadget to the network
    network.connect(c2.id, input.id)
    network.connect(output.id, c1.id)
    
    return network.getCurrentView()
  }, [network])
  
  // React Flow state - initialize with data
  const [nodes, setNodes] = useState<Node[]>(() => {
    const view = initializeNetwork()
    return view.contacts.map(contact => ({
      id: contact.id,
      position: contact.position,
      type: network.rootGroup.boundaryContacts.has(contact.id) ? 'boundary' : 'contact',
      style: {
        background: 'transparent',
        border: 'none',
        padding: 0,
        borderRadius: 0
      },
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
    const contactNodes: Node[] = currentView.contacts.map(contact => ({
      id: contact.id,
      position: contact.position,
      type: contact.isBoundary ? 'boundary' : 'contact',
      style: {
        background: 'transparent',
        border: 'none',
        padding: 0,
        borderRadius: 0
      },
      data: {
        content: contact.content,
        blendMode: contact.blendMode,
        isBoundary: contact.isBoundary,
        setContent: (content: any) => {
          contact.setContent(content)
          syncToReactFlow() // Re-sync after change
        }
      }
    }))
    
    // Map subgroups to nodes - check if we have stored positions
    const groupNodes: Node[] = currentView.subgroups.map((group, index) => {
      const boundary = group.getBoundaryContacts()
      
      // Use stored position or create new one
      const position = group.position.x === 0 && group.position.y === 0 
        ? { 
            x: 500 + (index % 2) * 250, 
            y: 100 + Math.floor(index / 2) * 200 
          }
        : group.position
      
      return {
        id: group.id,
        position,
        type: 'group',
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0,
          borderRadius: 0
        },
        data: {
          name: group.name,
          onNavigate: () => {
            network.navigateToGroup(group.id)
            setCurrentGroupId(group.id)
          },
          inputContacts: boundary.inputs.map(c => ({ id: c.id, name: c.name })),
          outputContacts: boundary.outputs.map(c => ({ id: c.id, name: c.name }))
        }
      }
    })
    
    const newNodes = [...contactNodes, ...groupNodes]
    
    // Map wires to edges
    const newEdges: Edge[] = currentView.wires.map(wire => {
      // Check if the wire connects to boundary contacts in subgroups
      let sourceNodeId = wire.fromId
      let targetNodeId = wire.toId
      let sourceHandle: string | undefined
      let targetHandle: string | undefined
      
      // Check if source is a boundary contact in a subgroup
      for (const subgroup of currentView.subgroups) {
        if (subgroup.boundaryContacts.has(wire.fromId)) {
          sourceNodeId = subgroup.id
          sourceHandle = wire.fromId
          break
        }
      }
      
      // Check if target is a boundary contact in a subgroup
      for (const subgroup of currentView.subgroups) {
        if (subgroup.boundaryContacts.has(wire.toId)) {
          targetNodeId = subgroup.id
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
        type: wire.type,
        animated: true,
        style: { 
          stroke: wire.type === 'directed' ? '#555' : '#888',
          strokeWidth: 2
        },
        markerEnd: { type: MarkerType.ArrowClosed },
        markerStart: wire.type === 'bidirectional' ? { type: MarkerType.ArrowClosed } : undefined
      }
    })
    
    setNodes(newNodes)
    setEdges(newEdges)
  }, [network, setCurrentGroupId])
  
  // Re-sync when group changes
  useEffect(() => {
    syncToReactFlow()
  }, [currentGroupId, syncToReactFlow])
  
  // Handle node changes (position updates and deletions)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Apply changes to React Flow state
    setNodes(nds => applyNodeChanges(changes, nds))
    
    // Handle changes in core network
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        // Check if it's a contact or a group
        const contact = network.findContact(change.id)
        if (contact) {
          contact.position = change.position
        } else {
          // Check if it's a group
          const group = network.findGroup(change.id)
          if (group) {
            group.position = change.position
          }
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
      // Handle connections involving group nodes (which use handle IDs for boundary contacts)
      let sourceId = connection.source
      let targetId = connection.target
      
      // If source is a group node with a handle, use the handle ID (which is the boundary contact ID)
      if (connection.sourceHandle) {
        sourceId = connection.sourceHandle
      }
      
      // If target is a group node with a handle, use the handle ID (which is the boundary contact ID)
      if (connection.targetHandle) {
        targetId = connection.targetHandle
      }
      
      network.connect(sourceId, targetId)
      syncToReactFlow()
    }
  }, [network, syncToReactFlow])
  
  // API methods
  const addContact = useCallback((position: Position) => {
    const contact = network.addContact(position)
    syncToReactFlow()
    return contact
  }, [network, syncToReactFlow])
  
  const addBoundaryContact = useCallback((position: Position, direction: 'input' | 'output' = 'input', name?: string) => {
    const contact = network.addBoundaryContact(position, direction, name)
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
    network,
    
    // Navigation
    navigateToGroup: (groupId: string) => {
      network.navigateToGroup(groupId)
      setCurrentGroupId(groupId)
    },
    navigateToParent: () => {
      network.navigateToParent()
      setCurrentGroupId(network.currentGroup.id)
    },
    getBreadcrumbs: () => network.getBreadcrumbs(),
    currentGroupId
  }
}