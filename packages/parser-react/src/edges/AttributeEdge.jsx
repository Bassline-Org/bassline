import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

/**
 * Custom edge component for attribute edges
 *
 * Displays edges with attribute names as labels and improved styling
 */
export function AttributeEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
}) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

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
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize: '11px',
                        fontWeight: '600',
                        background: '#f8fafc',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                        fontFamily: 'ui-monospace, monospace',
                        pointerEvents: 'all',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                    }}
                    className="nodrag nopan"
                >
                    {data?.label || ''}
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
