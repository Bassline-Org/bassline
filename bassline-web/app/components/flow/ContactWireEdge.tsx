import React, { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
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
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: 2,
          stroke: isInterGroup 
            ? selected ? '#3B82F6' : '#9333EA'
            : selected ? '#3B82F6' : '#9CA3AF'
        }}
      />
      
      {isPulsing && (
        <circle className="fill-blue-400 dark:fill-blue-500">
          <animateMotion dur="1s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
          <animate
            attributeName="r"
            values="2;4;2"
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
            className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ContactWireEdge.displayName = 'ContactWireEdge';