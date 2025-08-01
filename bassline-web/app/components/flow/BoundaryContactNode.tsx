import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { BoundaryContact } from '~/models/types';
import { cn } from '~/lib/utils';
import { Shield } from 'lucide-react';

export interface BoundaryContactNodeData {
  contact: BoundaryContact;
  selected?: boolean;
  isInner?: boolean;
}

export const BoundaryContactNode = memo(({ data, selected }: NodeProps<BoundaryContactNodeData>) => {
  const { contact, isInner } = data;
  const content = contact.content?.value;
  
  return (
    <div
      className={cn(
        "px-4 py-2 shadow-md rounded-md border-2 min-w-[150px]",
        "bg-gradient-to-br from-purple-50 to-indigo-50",
        "dark:from-purple-900/20 dark:to-indigo-900/20",
        "border-purple-300 dark:border-purple-700",
        selected && "border-purple-500 dark:border-purple-400",
        "transition-all duration-200"
      )}
    >
      {isInner ? (
        <Handle
          type="source"
          position={Position.Top}
          className="w-3 h-3 bg-purple-400 dark:bg-purple-600"
        />
      ) : (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-purple-400 dark:bg-purple-600"
        />
      )}
      
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <div className="font-medium text-sm text-purple-700 dark:text-purple-300">
            Boundary
          </div>
        </div>
        
        <div className="text-xs text-purple-600 dark:text-purple-400">
          {contact.id.slice(0, 8)}...
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {contact.blendMode.name}
        </div>
        
        {content !== null && content !== undefined && (
          <div className="mt-1 p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-sm">
            {typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content)}
          </div>
        )}
      </div>
      
      {isInner ? (
        <Handle
          type="target"
          position={Position.Bottom}
          className="w-3 h-3 bg-purple-400 dark:bg-purple-600"
        />
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-purple-400 dark:bg-purple-600"
        />
      )}
    </div>
  );
});

BoundaryContactNode.displayName = 'BoundaryContactNode';