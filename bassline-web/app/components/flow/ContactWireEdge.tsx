import React, { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import { cn } from '~/lib/utils';

export interface ContactWireEdgeData {
  isPulsing?: boolean;
  isInterGroup?: boolean;
  label?: string;
}

export const ContactWireEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<ContactWireEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { isPulsing, isInterGroup, label } = data || {};

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        className="react-flow__edge-path"
        style={{
          strokeWidth: 2,
          stroke: isInterGroup ? '#9333EA' : '#6B7280',
          strokeDasharray: isInterGroup ? '5,5' : 'none',
          opacity: selected ? 1 : 0.7
        }}
        markerEnd={markerEnd}
      />
      
      {isPulsing && (
        <circle className="fill-primary" r="6">
          <animateMotion dur="1s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
          <animate
            attributeName="r"
            values="4;8;4"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="px-2 py-1 text-xs bg-card border-2 border-border rounded-md shadow-md font-mono text-foreground"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ContactWireEdge.displayName = 'ContactWireEdge';