import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { ContactGroup } from '~/models/types';
import { cn } from '~/lib/utils';
import { Folder, FolderOpen } from 'lucide-react';

export interface ContactGroupNodeData {
  group: ContactGroup;
  selected?: boolean;
  expanded?: boolean;
  onExpand?: () => void;
}

export const ContactGroupNode = memo(({ data, selected }: NodeProps<ContactGroupNodeData>) => {
  const { group, expanded, onExpand } = data;
  const contactCount = group.contacts.size;
  const subgroupCount = group.subgroups.size;
  
  return (
    <div
      className={cn(
        "px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px]",
        "bg-gradient-to-br from-blue-50 to-cyan-50",
        "dark:from-blue-900/20 dark:to-cyan-900/20",
        "border-blue-300 dark:border-blue-700",
        selected && "border-blue-500 dark:border-blue-400",
        "transition-all duration-200",
        "cursor-pointer hover:shadow-xl"
      )}
      onClick={onExpand}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-400 dark:bg-blue-600"
      />
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {expanded ? (
            <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Folder className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
          <div className="font-semibold text-base text-blue-700 dark:text-blue-300">
            {group.name}
          </div>
        </div>
        
        <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <span className="font-medium">{contactCount}</span>
            <span>contacts</span>
          </div>
          {subgroupCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="font-medium">{subgroupCount}</span>
              <span>subgroups</span>
            </div>
          )}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-400 dark:bg-blue-600"
      />
    </div>
  );
});

ContactGroupNode.displayName = 'ContactGroupNode';