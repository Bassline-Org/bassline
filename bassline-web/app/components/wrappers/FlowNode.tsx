/**
 * FlowNode wrapper component
 * Integrates Interactive wrapper with React Flow node requirements
 */

import { memo } from 'react';
import { cn } from '~/lib/utils';
import { Interactive } from './Interactive';
import type { FlowNodeProps } from './types';

export const FlowNode = memo(({
  id,
  selected = false,
  interactive,
  className,
  children,
}: FlowNodeProps) => {
  // React Flow requires specific styles for proper node rendering
  const flowNodeStyle = {
    background: 'transparent',
    border: 'none',
    padding: 0,
    borderRadius: 0,
  };
  
  return (
    <div 
      className={cn(
        "flow-node-wrapper",
        selected && "selected",
        className
      )}
      style={flowNodeStyle}
    >
      {interactive ? (
        <Interactive
          id={id}
          {...interactive}
        >
          {children}
        </Interactive>
      ) : (
        children
      )}
    </div>
  );
});

FlowNode.displayName = 'FlowNode';