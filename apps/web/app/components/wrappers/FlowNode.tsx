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
  // If we have interactive props, use the Interactive wrapper
  if (interactive) {
    return (
      <Interactive
        id={id}
        selected={selected}
        className={className}
        {...interactive}
      >
        {children}
      </Interactive>
    );
  }
  
  // Otherwise, just render children directly
  return <>{children}</>;
});

FlowNode.displayName = 'FlowNode';