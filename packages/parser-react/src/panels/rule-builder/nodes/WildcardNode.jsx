/**
 * WildcardNode - Represents a wildcard (*) that matches anything
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export const WildcardNode = memo(({ id, data }) => {
    return (
        <div
            className="relative bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-full flex items-center justify-center font-bold text-5xl shadow-lg hover:from-orange-500 hover:to-orange-700 transition-all"
            style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(to bottom right, rgb(251, 146, 60), rgb(234, 88, 12))',
            }}
        >
            <Handle type="target" position={Position.Left} style={{ left: -4, width: 8, height: 8 }} />

            <span>*</span>

            <Handle type="source" position={Position.Right} style={{ right: -4, width: 8, height: 8 }} />
        </div>
    );
});

WildcardNode.displayName = "WildcardNode";
