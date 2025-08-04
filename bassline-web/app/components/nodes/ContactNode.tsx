/**
 * ContactNode - Refactored with wrapper components
 * Clean separation between interaction logic and presentation
 */

import { memo, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { FlowNode, type ModeBehavior, type NodeDisplayConfig, type Selection } from '~/components/wrappers';
import { ContactNodeView } from './ContactNodeView';
import { useContact } from '~/propagation-react/hooks/useContact';
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext';
import { useEditorModes, useURLState } from '~/propagation-react/hooks/useURLState';
import { useContextFrame } from '~/propagation-react/contexts/ContextFrameContext';
import { useModeContext } from '~/propagation-react/contexts/ModeContext';

export const ContactNode = memo(({ id, selected }: NodeProps) => {
  const { content, blendMode, isBoundary, lastContradiction, setContent, setBlendMode } = useContact(id);
  const { highlightedNodeId, network, syncToReactFlow } = useNetworkContext();
  const { enterPropertyMode, currentMode } = useEditorModes();
  const { urlState } = useURLState();
  const { activeToolInstance } = useContextFrame();
  const modeSystem = useModeContext();
  
  // Get visual class from mode system
  const modeClassName = modeSystem.getNodeClassName(id);
  
  // Check if dimmed or highlighted (kept for compatibility during transition)
  const isDimmed = highlightedNodeId !== null && !selected;
  const isHighlighted = highlightedNodeId === id;
  
  // Define mode behaviors
  const modeBehaviors: Record<string, ModeBehavior> = {
    valence: {
      onClick: useCallback((selection: Selection) => {
        // In valence mode, clicking is handled by GroupNode components
        // Contacts in valence mode don't have special click behavior
      }, []),
      canInteract: () => false, // Contacts aren't clickable targets in valence mode
    }
  };
  
  // Tool display function
  const getToolDisplay = useCallback((tool: any, selection: Selection): NodeDisplayConfig | undefined => {
    // If there's an active tool with display rules, use them
    if (tool.displayRules?.getNodeDisplay) {
      return tool.displayRules.getNodeDisplay(id, selection);
    }
    return undefined;
  }, [id]);
  
  // Context menu
  const contextMenu = useCallback((selection: Selection) => (
    <>
      <button
        className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
        onClick={() => {
          setContent(undefined);
        }}
      >
        Reset Value (∅)
      </button>
      <div className="border-t my-1" />
      <button
        className="flex w-full items-center justify-between px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
        onClick={() => {
          setBlendMode(blendMode === 'merge' ? 'accept-last' : 'merge');
        }}
      >
        <span>Blend Mode</span>
        <span className="text-xs opacity-70">
          {blendMode === 'merge' ? 'Merge' : 'Accept Last'}
        </span>
      </button>
    </>
  ), [blendMode, setContent, setBlendMode]);
  
  return (
    <FlowNode
      id={id}
      selected={selected}
      interactive={{
        type: 'contact',
        
        // Selection behaviors
        selection: {
          // Let React Flow handle selection, but we can still have callbacks
          // The key is not to interfere with the selection state
          onClick: (selection) => {
            // Don't do anything that would change selection state
            console.log('[ContactNode] Selected:', id, selection);
          },
          onDoubleClick: () => enterPropertyMode(id, true), // with focus
          // onShiftClick and onCommandClick use default behaviors
        },
        
        // Mode-specific behaviors
        modes: modeBehaviors,
        
        // Tool display integration
        toolDisplay: getToolDisplay,
        
        // Context menu
        contextMenu,
        
        // Lifecycle
        onDelete: () => {
          // Deletion is handled by React Flow's onNodesChange
        },
      }}
    >
      <ContactNodeView
        content={content}
        blendMode={blendMode}
        isBoundary={isBoundary}
        lastContradiction={lastContradiction}
        selected={selected}
        highlighted={isHighlighted}
        dimmed={isDimmed}
        className={modeClassName}
      />
    </FlowNode>
  );
});

ContactNode.displayName = 'ContactNode';