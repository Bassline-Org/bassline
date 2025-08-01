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
  
  return (
    <div
      className={cn(
        "w-10 h-10 shadow-sm rounded-sm border-2",
        "bg-accent/20 border-accent",
        selected && "shadow-md ring-2 ring-accent",
        "transition-all duration-200",
        "flex items-center justify-center"
      )}
    >
      {isInner ? (
        <Handle
          type="source"
          position={Position.Left}
          className="w-2 h-6 -left-[2px] bg-accent border-0 rounded-none"
        />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="w-2 h-6 -left-[2px] bg-accent border-0 rounded-none"
        />
      )}
      
      <Shield className="w-4 h-4 text-accent" />
      
      {isInner ? (
        <Handle
          type="target"
          position={Position.Right}
          className="w-2 h-6 -right-[2px] bg-accent border-0 rounded-none"
        />
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="w-2 h-6 -right-[2px] bg-accent border-0 rounded-none"
        />
      )}
    </div>
  );
});

BoundaryContactNode.displayName = 'BoundaryContactNode';