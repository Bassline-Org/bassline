import { Handle, Position } from '@xyflow/react';

/**
 * Custom node component for entity nodes
 *
 * Displays entities with distinct styling to differentiate them from literal values
 */
export function EntityNode({ data }) {
    return (
        <div className="entity-node">
            <Handle type="target" position={Position.Left} />
            <div style={{
                padding: '10px 15px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '13px',
                fontWeight: '600',
                minWidth: '100px',
                maxWidth: '200px',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
            }}>
                {data.label}
            </div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
}
