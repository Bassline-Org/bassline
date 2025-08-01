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
  const isAtomic = group.isAtomic && group.isAtomic();
  
  // Find boundary contacts
  const boundaryContacts = Array.from(group.contacts.values()).filter(
    contact => contact.isBoundary && contact.isBoundary()
  );
  
  // Separate input and output boundaries based on their positions
  // Sort by Y position to maintain consistent ordering
  const sortedBoundaries = boundaryContacts.sort((a, b) => a.position.y - b.position.y);
  
  // Find the midpoint X position
  const xPositions = sortedBoundaries.map(b => b.position.x);
  const midX = xPositions.length > 0 ? 
    (Math.min(...xPositions) + Math.max(...xPositions)) / 2 : 50;
  
  const inputBoundaries = sortedBoundaries.filter(boundary => {
    return boundary.position.x < midX;
  });
  
  const outputBoundaries = sortedBoundaries.filter(boundary => {
    return boundary.position.x >= midX;
  });
  
  return (
    <div
      className={cn(
        isAtomic ? "px-4 py-3 shadow-lg rounded-lg border-2 min-w-[140px]" : "px-6 py-4 shadow-lg rounded-lg border-2 min-w-[240px]",
        isAtomic ? 
          "bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-purple-400 dark:border-purple-600" : 
          "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-400 dark:border-blue-600",
        selected && "ring-2 ring-offset-2 ring-blue-500",
        "transition-all duration-200",
        !isAtomic && "cursor-pointer hover:shadow-xl hover:scale-105",
        "relative"
      )}
      onClick={isAtomic ? undefined : onExpand}
    >
      {/* Boundary contact handles - rectangular ports */}
      {inputBoundaries.map((boundary, index) => {
        const yPos = ((index + 1) / (inputBoundaries.length + 1)) * 100;
        return (
          <div
            key={`port-${boundary.id}`}
            className="absolute w-4 h-8 bg-gradient-to-r from-green-400 to-green-500 dark:from-green-600 dark:to-green-700 -left-[3px] rounded-sm shadow-sm"
            style={{ top: `${yPos}%`, transform: 'translateY(-50%)' }}
          >
            <Handle
              id={`${boundary.id}-left-target`}
              type="target"
              position={Position.Left}
              className="!absolute !left-0 !top-[25%] !w-2 !h-2 !bg-red-500"
              isConnectable={true}
            />
            <Handle
              id={`${boundary.id}-left-source`}
              type="source"
              position={Position.Left}
              className="!absolute !left-0 !top-[75%] !w-2 !h-2 !bg-blue-500"
              isConnectable={true}
            />
          </div>
        );
      })}
      
      {outputBoundaries.map((boundary, index) => {
        const yPos = ((index + 1) / (outputBoundaries.length + 1)) * 100;
        return (
          <div
            key={`port-${boundary.id}`}
            className="absolute w-4 h-8 bg-gradient-to-r from-orange-400 to-orange-500 dark:from-orange-600 dark:to-orange-700 -right-[3px] rounded-sm shadow-sm"
            style={{ top: `${yPos}%`, transform: 'translateY(-50%)' }}
          >
            <Handle
              id={`${boundary.id}-right-source`}
              type="source"
              position={Position.Right}
              className="!absolute !right-0 !top-[25%] !w-2 !h-2 !bg-blue-500"
              isConnectable={true}
            />
            <Handle
              id={`${boundary.id}-right-target`}
              type="target"
              position={Position.Right}
              className="!absolute !right-0 !top-[75%] !w-2 !h-2 !bg-red-500"
              isConnectable={true}
            />
          </div>
        );
      })}
      
      {isAtomic ? (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-bold text-green-600 dark:text-green-400 mb-1">IN</div>
            <div className="text-xs font-mono text-gray-500">{inputBoundaries.length}</div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-purple-700 dark:text-purple-300">
              {group.name === '+' ? '➕' : 
               group.name === '-' ? '➖' : 
               group.name === '*' ? '✖️' : 
               group.name === '/' ? '➗' : 
               group.name}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mb-1">OUT</div>
            <div className="text-xs font-mono text-gray-500">{outputBoundaries.length}</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {expanded ? (
              <FolderOpen className="w-5 h-5 text-primary" />
            ) : (
              <Folder className="w-5 h-5 text-primary" />
            )}
            <div className="font-semibold text-base text-foreground">
              {group.name}
            </div>
          </div>
          
          <div className="flex gap-4 text-xs font-mono text-muted-foreground">
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
          
          {/* Show boundary count */}
          <div className="text-xs font-mono text-accent">
            {boundaryContacts.length} boundaries ({inputBoundaries.length} in, {outputBoundaries.length} out)
          </div>
        </div>
      )}
    </div>
  );
});

ContactGroupNode.displayName = 'ContactGroupNode';