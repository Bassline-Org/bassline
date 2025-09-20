/**
 * Component for building visual tap connections with drag-and-drop
 */

import React, { useState, useRef, useEffect } from 'react';
import { TapWire, TapWireCanvas, type Point } from './TapWire';

export interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
}

export interface TapBuilderProps {
  connections: Connection[];
  onConnectionCreate?: (connection: Omit<Connection, 'id'>) => void;
  onConnectionDelete?: (connectionId: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface DragState {
  isActive: boolean;
  start?: Point;
  current?: Point;
  fromGadget?: string;
  fromPort?: string;
}

export function TapBuilder({
  connections,
  onConnectionCreate,
  onConnectionDelete,
  children,
  className
}: TapBuilderProps) {
  const [dragState, setDragState] = useState<DragState>({ isActive: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const [portPositions, setPortPositions] = useState<Map<string, Point>>(new Map());

  // Track mouse movement during drag
  useEffect(() => {
    if (!dragState.isActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      setDragState(prev => ({
        ...prev,
        current: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      console.log('TapBuilder: handleMouseUp', { dragState });

      // Check if we're dropping on a valid port
      const target = e.target as Element;
      const portElement = target.closest('[data-port-id]');

      console.log('Drop target:', { target, portElement });

      if (portElement && dragState.fromGadget && dragState.fromPort) {
        const toGadget = portElement.getAttribute('data-gadget-id');
        const toPort = portElement.getAttribute('data-port-id');
        const toType = portElement.getAttribute('data-port-type');

        console.log('Connection attempt:', { toGadget, toPort, toType });

        // Only allow connections from output to input
        if (toType === 'input' && toGadget && toPort) {
          const newConnection = {
            from: dragState.fromGadget,
            to: toGadget,
            fromPort: dragState.fromPort,
            toPort: toPort
          };
          console.log('Creating connection:', newConnection);
          onConnectionCreate?.(newConnection);
        }
      }

      setDragState({ isActive: false });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isActive, dragState.fromGadget, dragState.fromPort, onConnectionCreate]);

  // Start drag operation from a port
  const startDrag = (gadgetId: string, portId: string, startPoint: Point) => {
    console.log('TapBuilder: startDrag called', { gadgetId, portId, startPoint });
    setDragState({
      isActive: true,
      start: startPoint,
      current: startPoint,
      fromGadget: gadgetId,
      fromPort: portId
    });
  };

  // Register port position for wire rendering
  const registerPort = (gadgetId: string, portId: string, position: Point) => {
    const key = `${gadgetId}-${portId}`;
    setPortPositions(prev => new Map(prev.set(key, position)));
  };

  // Get wire coordinates for existing connections
  const getWireCoords = (connection: Connection) => {
    const fromKey = `${connection.from}-${connection.fromPort}`;
    const toKey = `${connection.to}-${connection.toPort}`;

    const start = portPositions.get(fromKey);
    const end = portPositions.get(toKey);

    if (!start || !end) return null;

    return { start, end };
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className || ''}`}
      style={{ position: 'relative' }}
    >
      {/* Render children with connection context */}
      <TapBuilderContext.Provider value={{
        startDrag,
        registerPort,
        connections,
        onConnectionDelete
      }}>
        {children}
      </TapBuilderContext.Provider>

      {/* Wire canvas overlay */}
      <TapWireCanvas>
        {/* Existing connections */}
        {connections.map(connection => {
          const coords = getWireCoords(connection);
          if (!coords) return null;

          return (
            <TapWire
              key={connection.id}
              start={coords.start}
              end={coords.end}
              animated={true}
            />
          );
        })}

        {/* Active drag wire */}
        {dragState.isActive && dragState.start && dragState.current && (
          <TapWire
            start={dragState.start}
            end={dragState.current}
            active={true}
          />
        )}
      </TapWireCanvas>
    </div>
  );
}

// Context for child components to register ports and start drags
interface TapBuilderContextType {
  startDrag: (gadgetId: string, portId: string, startPoint: Point) => void;
  registerPort: (gadgetId: string, portId: string, position: Point) => void;
  connections: Connection[];
  onConnectionDelete?: (connectionId: string) => void;
}

const TapBuilderContext = React.createContext<TapBuilderContextType | null>(null);

export function useTapBuilder() {
  const context = React.useContext(TapBuilderContext);
  if (!context) {
    throw new Error('useTapBuilder must be used within TapBuilder');
  }
  return context;
}