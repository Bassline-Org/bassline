/**
 * AttributeEdge - Labeled edge showing the attribute of a quad
 *
 * Represents: subject --[attribute]--> target
 * Click to edit attribute name
 */

import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react';

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
    const { setEdges } = useReactFlow();
    const [isEditing, setIsEditing] = useState(false);
    const [labelValue, setLabelValue] = useState(data?.label || '');

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const handleLabelChange = (newLabel) => {
        setLabelValue(newLabel);
        setEdges((eds) =>
            eds.map((edge) =>
                edge.id === id
                    ? { ...edge, data: { ...edge.data, label: newLabel } }
                    : edge
            )
        );
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (labelValue.trim() === '') {
            handleLabelChange('?');
            setLabelValue('?');
        }
    };

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    strokeWidth: 2.5,
                    stroke: '#6366f1',
                }}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan"
                >
                    {isEditing ? (
                        <input
                            type="text"
                            value={labelValue}
                            onChange={(e) => setLabelValue(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleLabelChange(labelValue);
                                    setIsEditing(false);
                                } else if (e.key === 'Escape') {
                                    setLabelValue(data?.label || '?');
                                    setIsEditing(false);
                                }
                            }}
                            className="bg-white border-2 border-blue-500 rounded-md px-3 py-1.5 text-sm font-mono shadow-lg"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-2 border-indigo-700 rounded-md px-3 py-1.5 text-sm font-mono font-semibold cursor-pointer hover:from-indigo-600 hover:to-indigo-700 shadow-md transition-all"
                            title="Click to edit attribute"
                        >
                            {data?.label || '?'}
                        </div>
                    )}
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
