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
  const { selection, selectOnly, addToSelection, toggleInSelection, isSelected } = useSelection();
  const wasSelectedRef = useRef(false);
  
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
  
  // Handle click with modifier keys
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Handle modifier keys
    if (e.shiftKey) {
      // Shift-click: add to selection
      if (onShiftClick) {
        onShiftClick(selection);
      } else {
        // Default behavior: add to selection
        addToSelection(id, type);
      }
    } else if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl-click: toggle selection
      if (onCommandClick) {
        onCommandClick(selection);
      } else {
        // Default behavior: toggle
        toggleInSelection(id, type);
      }
    } else {
      // Regular click
      if (onClick) {
        onClick(selection);
      } else {
        // Default behavior: select only this
        selectOnly(id, type);
      }
    }
  }, [id, type, selection, onClick, onShiftClick, onCommandClick, selectOnly, addToSelection, toggleInSelection]);
  
  // Handle double-click
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (onDoubleClick) {
      onDoubleClick(selection);
    }
  }, [selection, onDoubleClick]);
  
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