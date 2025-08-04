/**
 * Interactive wrapper component
 * Unified interaction handler with mode support and tool integration
 */

import { useCallback, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '~/lib/utils';
import { useSelection } from './useSelection';
import { useContextFrame } from '~/propagation-react/contexts/ContextFrameContext';
import { useURLState } from '~/propagation-react/hooks/useURLState';
import { Selectable } from './Selectable';
import type { InteractiveProps, NodeDisplayConfig, Selection } from './types';

export function Interactive({
  id,
  type,
  className,
  children,
  
  // Selection behaviors
  selection,
  selected = false,
  
  // Mode-specific behaviors
  modes = {},
  
  // Tool display integration
  toolDisplay,
  
  // Lifecycle
  onDelete,
  onDragStart,
  onDragEnd,
  
  // Context menu
  contextMenu,
  
  // Tooltip
  tooltip,
}: InteractiveProps) {
  const { selection: currentSelection } = useSelection();
  const { activeToolInstance } = useContextFrame();
  const { urlState } = useURLState();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  
  // Get current mode from URL state
  const currentMode = urlState.mode || 'normal';
  
  // Get current mode behavior
  const modeBehavior = useMemo(() => {
    if (currentMode && modes[currentMode]) {
      return modes[currentMode];
    }
    return null;
  }, [currentMode, modes]);
  
  // Get tool display configuration
  const displayConfig = useMemo((): NodeDisplayConfig => {
    if (activeToolInstance && toolDisplay) {
      const config = toolDisplay(activeToolInstance, currentSelection);
      if (config) return config;
    }
    
    // Default display config
    return {
      interactive: true,
      opacity: 1,
    };
  }, [activeToolInstance, toolDisplay, currentSelection]);
  
  // Check if node can be interacted with
  const canInteract = useMemo(() => {
    if (modeBehavior?.canInteract) {
      return modeBehavior.canInteract(currentSelection);
    }
    return displayConfig.interactive !== false;
  }, [modeBehavior, currentSelection, displayConfig]);
  
  // Handle click based on mode
  const handleClick = useCallback((sel: Selection) => {
    // Mode-specific click
    if (modeBehavior?.onClick && canInteract) {
      modeBehavior.onClick(sel);
      return;
    }
    
    // Default selection click
    if (selection?.onClick) {
      selection.onClick(sel);
    }
  }, [modeBehavior, canInteract, selection]);
  
  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (contextMenu) {
      setContextMenuPos({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    }
  }, [contextMenu]);
  
  // React Flow handles deletion through its deleteKeyCode prop
  // We don't need custom keyboard handling for Delete/Backspace
  
  // Build className from display config
  const computedClassName = cn(
    className,
    displayConfig.className,
    modeBehavior?.className,
    // Don't add pointer-events-none for flow nodes - it prevents selection!
    // !canInteract && 'pointer-events-none',
    displayConfig.cursor && `cursor-${displayConfig.cursor}`,
    modeBehavior?.cursor && `cursor-${modeBehavior.cursor}`
  );
  
  // Build style from display config
  const computedStyle = {
    opacity: displayConfig.opacity,
  };
  
  return (
    <>
      <div
        ref={nodeRef}
        className={computedClassName}
        style={computedStyle}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Selectable
          id={id}
          type={type}
          onClick={selection?.onClick || handleClick}
          onShiftClick={selection?.onShiftClick}
          onCommandClick={selection?.onCommandClick}
          onDoubleClick={selection?.onDoubleClick || modeBehavior?.onDoubleClick}
        >
          {/* Main content */}
          {children}
          
          {/* Badge overlay */}
          {displayConfig.badge && (
            <div className="absolute -top-2 -right-2 z-10">
              {displayConfig.badge}
            </div>
          )}
          
          {/* Custom overlay */}
          {displayConfig.overlay && (
            <div className="absolute inset-0 pointer-events-none">
              {displayConfig.overlay}
            </div>
          )}
        </Selectable>
      </div>
      
      {/* Context Menu Portal */}
      {showContextMenu && contextMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="fixed z-[9999] min-w-[150px] bg-popover text-popover-foreground rounded-md border shadow-md"
            style={{ 
              left: `${contextMenuPos.x}px`, 
              top: `${contextMenuPos.y}px`
            }}
          >
            {contextMenu(currentSelection)}
          </div>
        </>,
        document.body
      )}
      
      {/* Tooltip Portal */}
      {showTooltip && tooltip && nodeRef.current && createPortal(
        <div
          className="fixed z-[9997] px-2 py-1 text-sm bg-popover text-popover-foreground rounded border shadow-md"
          style={{
            left: nodeRef.current.getBoundingClientRect().left + nodeRef.current.offsetWidth / 2,
            top: nodeRef.current.getBoundingClientRect().top - 30,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip(id, currentSelection)}
        </div>,
        document.body
      )}
    </>
  );
}