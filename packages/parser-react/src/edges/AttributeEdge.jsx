import { BaseEdge, getBezierPath, useStore } from '@xyflow/react';
import { getEdgeParams } from './floatingEdgeHelpers.js';

/**
 * Custom edge component for attribute edges with floating connection points
 *
 * Uses dynamic edge positions that attach to node borders based on relative positioning
 */
export function AttributeEdge({
    id,
    source,
    target,
    markerEnd,
}) {
    // Get source and target nodes from the store using the nodes array
    const sourceNode = useStore((state) => state.nodes.find((n) => n.id === source));
    const targetNode = useStore((state) => state.nodes.find((n) => n.id === target));

    // If nodes aren't ready, don't render
    if (!sourceNode || !targetNode) {
        return null;
    }

    // Calculate dynamic edge positions based on node geometry
    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
        sourceNode,
        targetNode
    );

    const [edgePath] = getBezierPath({
        sourceX: sx,
        sourceY: sy,
        sourcePosition: sourcePos,
        targetX: tx,
        targetY: ty,
        targetPosition: targetPos,
    });

    return (
        <BaseEdge
            id={id}
            path={edgePath}
            markerEnd={markerEnd}
            style={{
                stroke: '#94a3b8',
                strokeWidth: 2,
            }}
        />
    );
}
