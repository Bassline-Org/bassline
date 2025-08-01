import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import type { Node, Edge, Connection, NodeTypes, EdgeTypes } from 'reactflow';
import 'reactflow/dist/style.css';

import { usePropagation } from '~/contexts/PropagationContext';
import { ContactNode } from './flow/ContactNodeWithMenu';
import { BoundaryContactNode } from './flow/BoundaryContactNode';
import { ContactGroupNode } from './flow/ContactGroupNode';
import { ContactWireEdge } from './flow/ContactWireEdge';
import { CircularPalette } from './CircularPalette';
import { Button } from './ui/button';
import { Plus, Home, ArrowUp, Folder } from 'lucide-react';
import { cn } from '~/lib/utils';
import { wiresToEdges } from './flow/EdgeRenderer';

// Define node and edge types outside the component to prevent React Flow warnings
const nodeTypes: NodeTypes = {
  contact: ContactNode,
  boundaryContact: BoundaryContactNode,
  contactGroup: ContactGroupNode,
} as const;

const edgeTypes: EdgeTypes = {
  contactWire: ContactWireEdge,
} as const;

export const PropagationNetworkEditor: React.FC = () => {
  const {
    currentGroup,
    rootGroup,
    createContact,
    createBoundaryContact,
    createWire,
    createSubgroup,
    navigateToGroup,
    navigateToParent,
    eventEmitter,
    gadgetRegistry,
    instantiateGadget,
  } = usePropagation();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Handle node position changes
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    
    // Update positions in the model
    changes.forEach((change: any) => {
      if (change.type === 'position' && change.position && currentGroup) {
        const contact = currentGroup.contacts.get(change.id);
        if (contact) {
          contact.position = change.position;
        } else {
          const subgroup = currentGroup.subgroups.get(change.id);
          if (subgroup) {
            subgroup.position = change.position;
          }
        }
      }
    });
  }, [onNodesChange, currentGroup]);
  const [isAddingBoundary, setIsAddingBoundary] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePosition, setPalettePosition] = useState({ x: 0, y: 0 });

  // Convert contacts and groups to React Flow nodes and listen for changes
  useEffect(() => {
    if (!currentGroup) return;

    const updateNodes = () => {
      const newNodes: Node[] = [];

      console.log('Updating nodes for group:', currentGroup.id);
      console.log('Contacts in group:', Array.from(currentGroup.contacts.entries()).map(([id, c]) => ({ id, contact: c })));

      // Add contacts as nodes
      currentGroup.contacts.forEach((contact) => {
        const isBoundary = contact.isBoundary && contact.isBoundary();
        
        newNodes.push({
          id: contact.id,
          type: isBoundary ? 'boundaryContact' : 'contact',
          position: contact.position,
          data: {
            contact,
          },
        });
      });

      // Add subgroups as nodes
      currentGroup.subgroups.forEach((subgroup) => {
        newNodes.push({
          id: subgroup.id,
          type: 'contactGroup',
          position: subgroup.position,
          data: {
            group: subgroup,
            onExpand: () => navigateToGroup(subgroup.id),
          },
        });
      });

      setNodes(newNodes);
    };

    // Initial update
    updateNodes();

    // Listen for node changes
    const unsubscribeContactAdded = eventEmitter.on('ContactAdded', updateNodes);
    const unsubscribeContactRemoved = eventEmitter.on('ContactRemoved', updateNodes);
    const unsubscribeSubgroupAdded = eventEmitter.on('SubgroupAdded', updateNodes);
    const unsubscribeSubgroupRemoved = eventEmitter.on('SubgroupRemoved', updateNodes);

    return () => {
      unsubscribeContactAdded();
      unsubscribeContactRemoved();
      unsubscribeSubgroupAdded();
      unsubscribeSubgroupRemoved();
    };
  }, [currentGroup, setNodes, navigateToGroup, eventEmitter]);

  // Convert wires to React Flow edges and listen for changes
  useEffect(() => {
    if (!currentGroup) return;

    const updateEdges = () => {
      const newEdges = wiresToEdges(currentGroup);
      console.log('Updating edges:', newEdges);
      setEdges(newEdges);
    };

    // Initial update
    updateEdges();

    // Listen for wire changes
    const unsubscribeWireAdded = eventEmitter.on('WireAdded', (event) => {
      updateEdges();
    });
    const unsubscribeWireRemoved = eventEmitter.on('WireRemoved', (event) => {
      updateEdges();
    });

    return () => {
      unsubscribeWireAdded();
      unsubscribeWireRemoved();
    };
  }, [currentGroup, setEdges, eventEmitter]);

  // Listen for propagation events to animate edges
  useEffect(() => {
    const unsubscribe = eventEmitter.on('WirePulsed', (event) => {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === event.source.id) {
            return {
              ...edge,
              data: {
                ...edge.data,
                isPulsing: true,
              },
            };
          }
          return edge;
        })
      );

      // Stop pulsing after animation
      setTimeout(() => {
        setEdges((eds) =>
          eds.map((edge) => {
            if (edge.id === event.source.id) {
              return {
                ...edge,
                data: {
                  ...edge.data,
                  isPulsing: false,
                },
              };
            }
            return edge;
          })
        );
      }, 1000);
    });

    return unsubscribe;
  }, [eventEmitter, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('onConnect called with params:', params);
      if (!params.source || !params.target) return;
      
      // Extract contact IDs from the connection
      const sourceId = extractContactId(params.source, params.sourceHandle);
      const targetId = extractContactId(params.target, params.targetHandle);
      
      console.log('Creating wire from', sourceId, 'to', targetId);
      const wire = createWire(sourceId, targetId);
      console.log('Created wire:', wire);
    },
    [createWire]
  );
  
  // Helper to extract contact ID from node/handle combination
  const extractContactId = (nodeId: string, handleId?: string | null): string => {
    if (!handleId) return nodeId;
    
    // Handle IDs for boundary contacts are in format: contactId-side-type
    const match = handleId.match(/^([a-f0-9-]+)-(left|right)-(source|target)$/);
    return match ? match[1] : nodeId;
  };

  const handleAddContact = useCallback(() => {
    const position = { x: Math.random() * 400, y: Math.random() * 400 };
    const contact = isAddingBoundary ? createBoundaryContact(position) : createContact(position);
    // Node will be added via the event listener
    setIsAddingBoundary(false);
  }, [createContact, createBoundaryContact, isAddingBoundary]);

  const handleAddSubgroup = useCallback(() => {
    const position = { x: Math.random() * 400, y: Math.random() * 400 };
    const subgroup = createSubgroup(`Subgroup ${Date.now()}`, position);
    // Node will be added via the event listener
  }, [createSubgroup]);

  const breadcrumbs = [];
  let current = currentGroup;
  while (current && rootGroup) {
    breadcrumbs.unshift(current);
    if (current.id === rootGroup.id) break;
    // Find parent
    let parent = null;
    const findParent = (group: any, target: any): any => {
      if (group.subgroups.has(target.id)) return group;
      for (const subgroup of group.subgroups.values()) {
        const found = findParent(subgroup, target);
        if (found) return found;
      }
      return null;
    };
    parent = findParent(rootGroup, current);
    current = parent;
  }

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    // Regular click - do nothing
  }, []);

  // Handle right-click to show palette
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Get the position relative to the React Flow container
    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    const position = {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    };
    
    setPalettePosition(position);
    setPaletteOpen(true);
  }, []);

  const handleGadgetSelect = useCallback((template: any) => {
    // Convert screen position to flow position
    const flowPosition = {
      x: palettePosition.x - 100, // Center the gadget
      y: palettePosition.y - 50,
    };
    
    instantiateGadget(template, flowPosition);
  }, [palettePosition, instantiateGadget]);

  return (
    <div className="w-full h-screen bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        onPaneClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
      >
        <Background />
        <Controls />
        <MiniMap />
        <svg>
          <defs>
            <marker
              id="react-flow__arrowclosed"
              viewBox="0 0 20 20"
              refX="19"
              refY="10"
              markerWidth="10"
              markerHeight="10"
              orient="auto"
            >
              <path
                d="M 2 2 L 18 10 L 2 18 z"
                fill="#6B7280"
                stroke="#6B7280"
              />
            </marker>
          </defs>
        </svg>
        
        <Panel position="top-left" className="bg-card border-2 border-border p-2 rounded-md shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            {breadcrumbs.map((group, index) => (
              <React.Fragment key={group.id}>
                {index > 0 && <span className="text-gray-400">/</span>}
                <button
                  onClick={() => navigateToGroup(group.id)}
                  className={cn(
                    "text-sm hover:text-primary font-mono",
                    group.id === currentGroup?.id && "font-bold"
                  )}
                >
                  {group.name}
                </button>
              </React.Fragment>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigateToGroup(rootGroup!.id)}
              className="transition-all hover:scale-105"
            >
              <Home className="w-4 h-4" />
            </Button>
            
            {currentGroup?.parentId && (
              <Button
                size="sm"
                variant="outline"
                onClick={navigateToParent}
                className="transition-all hover:scale-105"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            )}
            
            <Button
              size="sm"
              variant={isAddingBoundary ? "secondary" : "default"}
              onClick={handleAddContact}
              className="transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4 mr-1" />
              {isAddingBoundary ? "Boundary" : "Contact"}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddingBoundary(!isAddingBoundary)}
              className="transition-all hover:scale-105"
            >
              {isAddingBoundary ? "Regular" : "Boundary"}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddSubgroup}
              className="transition-all hover:scale-105"
            >
              <Folder className="w-4 h-4 mr-1" />
              Subgroup
            </Button>
          </div>
        </Panel>
      </ReactFlow>
      
      <CircularPalette
        isOpen={paletteOpen}
        position={palettePosition}
        gadgets={gadgetRegistry.getAll()}
        onSelect={handleGadgetSelect}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
};

export const PropagationNetworkEditorWithProvider: React.FC = () => {
  return (
    <ReactFlowProvider>
      <PropagationNetworkEditor />
    </ReactFlowProvider>
  );
};