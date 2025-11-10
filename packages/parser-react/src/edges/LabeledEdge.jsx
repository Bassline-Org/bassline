import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore } from '@xyflow/react';
import { getEdgeParams } from './floatingEdgeHelpers.js';

/**
 * Custom edge component with centered text label
 *
 * Displays attribute name on the edge itself using EdgeLabelRenderer
 * Uses dynamic floating connection points for smooth node positioning
 */
export function LabeledEdge({
    id,
    source,
    target,
    data,
    markerEnd,
}) {
    // Get source and target nodes from the store
    const sourceNode = useStore((state) => state.nodes.find((n) => n.id === source));
    const targetNode = useStore((state) => state.nodes.find((n) => n.id === target));

    // Get zoom level for dynamic label hiding
    const zoom = useStore((state) => state.transform[2]);

    // If nodes aren't ready, don't render
    if (!sourceNode || !targetNode) {
        return null;
    }

    // Calculate dynamic edge positions based on node geometry
    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
        sourceNode,
        targetNode
    );

    // Handle multiple edges between same nodes with curvature
    const linknum = data.linknum || 1;
    const linkTotal = data.linkTotal || 1;

    let edgePath, labelX, labelY;

    if (linkTotal > 1) {
        // Multiple edges - use curved path with offset
        // Alternate direction: odd linknum = positive offset, even = negative
        const direction = linknum % 2 === 1 ? 1 : -1;
        const magnitude = Math.ceil(linknum / 2); // 1->1, 2->1, 3->2, 4->2, etc.
        const curvature = direction * magnitude * 40; // 40px per level

        // Calculate perpendicular offset for control point
        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2;
        const dx = tx - sx;
        const dy = ty - sy;
        const len = Math.sqrt(dx * dx + dy * dy);

        // Perpendicular vector (rotated 90 degrees)
        const offsetX = (-dy / len) * curvature;
        const offsetY = (dx / len) * curvature;

        const controlX = midX + offsetX;
        const controlY = midY + offsetY;

        // Create quadratic bezier curve
        edgePath = `M ${sx},${sy} Q ${controlX},${controlY} ${tx},${ty}`;

        // Position label near control point (slightly offset for readability)
        labelX = controlX;
        labelY = controlY - 15; // Offset above the curve
    } else {
        // Single edge - use standard bezier path
        [edgePath, labelX, labelY] = getBezierPath({
            sourceX: sx,
            sourceY: sy,
            sourcePosition: sourcePos,
            targetX: tx,
            targetY: ty,
            targetPosition: targetPos,
        });
    }

    // Calculate edge length for dynamic label hiding
    const edgeLength = Math.sqrt(Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2));

    // Only show label if:
    // 1. Edge is long enough (not too cramped)
    // 2. Zoom level is sufficient (not zoomed out too far)
    const minEdgeLengthForLabel = 60;
    const minZoomForLabel = 0.5;
    const showLabel = edgeLength > minEdgeLengthForLabel && zoom > minZoomForLabel;

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    stroke: '#94a3b8',
                    strokeWidth: 2,
                }}
            />
            {showLabel && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            background: 'rgba(248, 250, 252, 0.95)', // Semi-transparent
                            backdropFilter: 'blur(2px)', // Blur edges behind label
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600', // Bolder for better readability
                            color: '#475569',
                            border: '1px solid rgba(203, 213, 225, 0.8)',
                            pointerEvents: 'all',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', // Stronger shadow
                            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                            whiteSpace: 'nowrap',
                            maxWidth: '120px', // Shorter max width
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            zIndex: 1000, // Ensure labels above edges
                        }}
                        title={data.label} // Full text on hover
                    >
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
