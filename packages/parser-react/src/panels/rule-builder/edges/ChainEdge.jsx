/**
 * ChainEdge - Simple edge for connecting nodes in 4-node chains
 *
 * Forms quads via chains: Subject → Attribute → Target → Context
 * No labels needed - nodes themselves carry all the data
 */

import { BaseEdge, getBezierPath } from '@xyflow/react';

export function ChainEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
}) {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    return (
        <BaseEdge
            id={id}
            path={edgePath}
            markerEnd={markerEnd}
            style={{
                strokeWidth: 3,
                stroke: '#4f46e5',
                strokeLinecap: 'round',
            }}
        />
    );
}
