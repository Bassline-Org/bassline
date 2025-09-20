/**
 * Visual wrapper for any gadget with connection ports
 */

import React, { useRef, useEffect } from 'react';
import { TapPort, useTapBuilder, type Point } from 'port-graphs-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

export interface PortConfig {
  id: string;
  type: 'input' | 'output';
  position: 'top' | 'bottom' | 'left' | 'right';
  label?: string;
}

export interface GadgetCardProps {
  id: string;
  title: string;
  className?: string;
  children: React.ReactNode;
  ports?: PortConfig[];
  position?: { x: number; y: number };
  selected?: boolean;
  violated?: boolean;
  onSelect?: () => void;
}

export function GadgetCard({
  id,
  title,
  className,
  children,
  ports = [],
  position = { x: 0, y: 0 },
  selected = false,
  violated = false,
  onSelect
}: GadgetCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { registerPort, startDrag } = useTapBuilder();
  const lastPortsRegistered = useRef<string>('');

  // Register port positions when card mounts or moves
  useEffect(() => {
    if (!cardRef.current) return;

    // Create a cache key to avoid unnecessary re-registrations
    const cacheKey = `${id}-${position.x}-${position.y}-${ports.map(p => p.id + p.position).join(',')}`;
    if (lastPortsRegistered.current === cacheKey) return;

    const cardRect = cardRef.current.getBoundingClientRect();
    const cardWidth = cardRect.width;
    const cardHeight = cardRect.height;

    ports.forEach(port => {
      let portPosition: Point;

      switch (port.position) {
        case 'top':
          portPosition = { x: cardWidth / 2, y: 0 };
          break;
        case 'bottom':
          portPosition = { x: cardWidth / 2, y: cardHeight };
          break;
        case 'left':
          portPosition = { x: 0, y: cardHeight / 2 };
          break;
        case 'right':
          portPosition = { x: cardWidth, y: cardHeight / 2 };
          break;
      }

      // Adjust for card position
      portPosition.x += position.x;
      portPosition.y += position.y;

      registerPort(id, port.id, portPosition);
    });

    lastPortsRegistered.current = cacheKey;
  }, [ports, position, id]); // Removed registerPort from dependencies

  const handlePortMouseDown = (port: PortConfig, e: React.MouseEvent) => {
    if (port.type === 'output') {
      // Prevent event from bubbling to card selection
      e.stopPropagation();

      // Get the port position relative to the container
      const cardRect = cardRef.current?.getBoundingClientRect();
      if (!cardRect) return;

      let portX, portY;
      switch (port.position) {
        case 'top':
          portX = position.x + cardRect.width / 2;
          portY = position.y;
          break;
        case 'bottom':
          portX = position.x + cardRect.width / 2;
          portY = position.y + cardRect.height;
          break;
        case 'left':
          portX = position.x;
          portY = position.y + cardRect.height / 2;
          break;
        case 'right':
          portX = position.x + cardRect.width;
          portY = position.y + cardRect.height / 2;
          break;
      }

      startDrag(id, port.id, { x: portX, y: portY });
    }
  };

  return (
    <div
      ref={cardRef}
      className="absolute"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <Card
        className={[
          'relative cursor-pointer transition-all duration-200',
          'hover:shadow-lg overflow-visible',
          selected && 'ring-2 ring-blue-500',
          violated && 'ring-2 ring-red-500 bg-red-50',
          className
        ].filter(Boolean).join(' ')}
        onClick={onSelect}
        style={{ overflow: 'visible' }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {children}
        </CardContent>

        {/* Render ports */}
        {ports.map(port => (
          <TapPort
            key={port.id}
            type={port.type}
            position={port.position}
            {...(port.label && { label: port.label })}
            onMouseDown={(e) => handlePortMouseDown(port, e)}
            data-gadget-id={id}
            data-port-id={port.id}
            data-port-type={port.type}
          />
        ))}
      </Card>
    </div>
  );
}