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
import { ContactNode } from './flow/ContactNode';
import { BoundaryContactNode } from './flow/BoundaryContactNode';
import { ContactGroupNode } from './flow/ContactGroupNode';
import { ContactWireEdge } from './flow/ContactWireEdge';
import { Button } from './ui/button';
import { Plus, Home, ArrowUp, Folder } from 'lucide-react';
import { cn } from '~/lib/utils';

const nodeTypes: NodeTypes = {
  contact: ContactNode,
  boundaryContact: BoundaryContactNode,
  contactGroup: ContactGroupNode,
};

const edgeTypes: EdgeTypes = {
  contactWire: ContactWireEdge,
};

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
  } = usePropagation();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isAddingBoundary, setIsAddingBoundary] = useState(false);

  // Convert contacts and groups to React Flow nodes
  useEffect(() => {
    if (!currentGroup) return;

    const newNodes: Node[] = [];

    // Add contacts as nodes
    currentGroup.contacts.forEach((contact) => {
      const isBoundary = 'isBoundary' in contact && contact.isBoundary;
      
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
  }, [currentGroup, setNodes, navigateToGroup]);

  // Convert wires to React Flow edges
  useEffect(() => {
    if (!currentGroup) return;

    const newEdges: Edge[] = [];

    currentGroup.wires.forEach((wire) => {
      newEdges.push({
        id: wire.id,
        source: wire.from,
        target: wire.to,
        type: 'contactWire',
        data: {
          wire,
        },
      });
    });

    setEdges(newEdges);
  }, [currentGroup, setEdges]);

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
      if (!params.source || !params.target) return;
      
      const wire = createWire(params.source, params.target);
      if (wire) {
        const newEdge: Edge = {
          id: wire.id,
          source: wire.from,
          target: wire.to,
          type: 'contactWire',
          data: { wire },
        };
        setEdges((eds) => [...eds, newEdge]);
      }
    },
    [createWire, setEdges]
  );

  const handleAddContact = useCallback(() => {
    const position = { x: Math.random() * 400, y: Math.random() * 400 };
    const contact = isAddingBoundary ? createBoundaryContact(position) : createContact(position);
    
    const newNode: Node = {
      id: contact.id,
      type: isAddingBoundary ? 'boundaryContact' : 'contact',
      position: contact.position,
      data: { contact },
    };
    
    setNodes((nds) => [...nds, newNode]);
    setIsAddingBoundary(false);
  }, [createContact, createBoundaryContact, isAddingBoundary, setNodes]);

  const handleAddSubgroup = useCallback(() => {
    const position = { x: Math.random() * 400, y: Math.random() * 400 };
    const subgroup = createSubgroup(`Subgroup ${Date.now()}`, position);
    
    const newNode: Node = {
      id: subgroup.id,
      type: 'contactGroup',
      position: subgroup.position,
      data: {
        group: subgroup,
        onExpand: () => navigateToGroup(subgroup.id),
      },
    };
    
    setNodes((nds) => [...nds, newNode]);
  }, [createSubgroup, navigateToGroup, setNodes]);

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

  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
        
        <Panel position="top-left" className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            {breadcrumbs.map((group, index) => (
              <React.Fragment key={group.id}>
                {index > 0 && <span className="text-gray-400">/</span>}
                <button
                  onClick={() => navigateToGroup(group.id)}
                  className={cn(
                    "text-sm hover:text-blue-600 dark:hover:text-blue-400",
                    group.id === currentGroup?.id && "font-semibold"
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
            >
              <Home className="w-4 h-4" />
            </Button>
            
            {currentGroup?.parentId && (
              <Button
                size="sm"
                variant="outline"
                onClick={navigateToParent}
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            )}
            
            <Button
              size="sm"
              variant={isAddingBoundary ? "secondary" : "default"}
              onClick={handleAddContact}
            >
              <Plus className="w-4 h-4 mr-1" />
              {isAddingBoundary ? "Boundary" : "Contact"}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddingBoundary(!isAddingBoundary)}
            >
              {isAddingBoundary ? "Regular" : "Boundary"}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddSubgroup}
            >
              <Folder className="w-4 h-4 mr-1" />
              Subgroup
            </Button>
          </div>
        </Panel>
      </ReactFlow>
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