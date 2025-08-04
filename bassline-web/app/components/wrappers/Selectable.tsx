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
    console.log('[Selectable] Click event:', {
      id,
      type,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      hasOnClick: !!onClick,
      hasOnShiftClick: !!onShiftClick,
      hasOnCommandClick: !!onCommandClick,
      currentSelection: selection,
      inFlow
    });
    
    // Don't stop propagation for React Flow nodes - let React Flow handle selection
    // if (inFlow) {
    //   e.stopPropagation();
    // }
    
    // Only fire callbacks - React Flow handles selection
    if (e.shiftKey && onShiftClick) {
      console.log('[Selectable] Firing onShiftClick');
      onShiftClick(selection);
    } else if ((e.metaKey || e.ctrlKey) && onCommandClick) {
      console.log('[Selectable] Firing onCommandClick');
      onCommandClick(selection);
    } else if (!e.shiftKey && !e.metaKey && !e.ctrlKey && onClick) {
      console.log('[Selectable] Firing onClick');
      onClick(selection);
    }
  }, [id, type, selection, onClick, onShiftClick, onCommandClick, inFlow]);
  
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