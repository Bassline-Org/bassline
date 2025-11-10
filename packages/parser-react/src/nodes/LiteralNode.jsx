import { Handle, Position } from '@xyflow/react';

/**
 * Custom node component for literal value nodes
 *
 * Displays literal values with distinct styling to differentiate them from entities
 */
export function LiteralNode({ data }) {
    // Detect if value is a number
    const isNumber = !isNaN(parseFloat(data.label)) && isFinite(data.label);

    return (
        <div className="literal-node">
            <Handle type="target" position={Position.Left} />
            <div style={{
                padding: '10px 15px',
                borderRadius: '8px',
                background: isNumber
                    ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                    : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '13px',
                fontWeight: '500',
                minWidth: '80px',
                maxWidth: '200px',
                textAlign: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
            }}>
                {isNumber ? data.label : `"${data.label}"`}
            </div>
            <Handle type="source" position={Position.Right} />
        </div>
    );
}
