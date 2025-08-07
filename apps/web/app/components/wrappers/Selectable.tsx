/**
 * Selectable wrapper component
 * Provides natural selection handling with modifier key support
 */

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '~/lib/utils';
import { useSelection } from './useSelection';
import type { SelectableProps } from './types';

export function Selectable({
  id,
  type,
  className,
  children,
  
  // Selection callbacks
  onClick,
  onShiftClick,
  onCommandClick,
  onDoubleClick,
  
  // State change callbacks
  onSelect,
  onDeselect,
  
  // Options
  inFlow = true,
}: SelectableProps) {
  const { selection, isSelected } = useSelection();
  const wasSelectedRef = useRef(false);
  
  // Removed verbose logging
  
  // Track selection state changes
  useEffect(() => {
    const isNowSelected = isSelected(id);
    
    if (isNowSelected && !wasSelectedRef.current) {
      // Just got selected
      onSelect?.(selection);
    } else if (!isNowSelected && wasSelectedRef.current) {
      // Just got deselected
      onDeselect?.(selection);
    }
    
    wasSelectedRef.current = isNowSelected;
  }, [id, isSelected, selection, onSelect, onDeselect]);
  
  // Handle click - only for callbacks, not selection
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't stop propagation for React Flow nodes - let React Flow handle selection
    
    // Only fire callbacks - React Flow handles selection
    if (e.shiftKey && onShiftClick) {
      onShiftClick(selection);
    } else if ((e.metaKey || e.ctrlKey) && onCommandClick) {
      onCommandClick(selection);
    } else if (!e.shiftKey && !e.metaKey && !e.ctrlKey && onClick) {
      onClick(selection);
    }
  }, [selection, onClick, onShiftClick, onCommandClick]);
  
  // Handle double-click
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (onDoubleClick) {
      onDoubleClick(selection);
    }
  }, [selection, onDoubleClick]);
  
  // For nodes in React Flow, we should not intercept clicks
  // React Flow handles selection automatically
  if (inFlow) {
    return (
      <div
        className={cn("selectable-wrapper", className)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        data-selected={isSelected(id)}
      >
        {children}
      </div>
    );
  }
  
  // For non-flow elements, handle clicks normally
  return (
    <div
      className={cn("selectable-wrapper", className)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-selected={isSelected(id)}
    >
      {children}
    </div>
  );
}