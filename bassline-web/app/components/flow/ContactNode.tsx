import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { Contact } from '~/models/types';
import { cn } from '~/lib/utils';

export interface ContactNodeData {
  contact: Contact;
  selected?: boolean;
}

export const ContactNode = memo(({ data, selected }: NodeProps<ContactNodeData>) => {
  const { contact } = data;
  const content = contact.content?.value;
  
  return (
    <div
      className={cn(
        "px-4 py-2 shadow-md rounded-md border-2 min-w-[150px]",
        "bg-white dark:bg-gray-800",
        "border-gray-200 dark:border-gray-700",
        selected && "border-blue-500 dark:border-blue-400",
        "transition-all duration-200"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-400 dark:bg-gray-600"
      />
      
      <div className="flex flex-col gap-1">
        <div className="font-medium text-sm text-gray-700 dark:text-gray-300">
          {contact.id.slice(0, 8)}...
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {contact.blendMode.name}
        </div>
        
        {content !== null && content !== undefined && (
          <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
            {typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content)}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-gray-400 dark:bg-gray-600"
      />
    </div>
  );
});

ContactNode.displayName = 'ContactNode';