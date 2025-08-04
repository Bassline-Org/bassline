/**
 * ContactNode - Refactored with wrapper components
 * Clean separation between interaction logic and presentation
 */

import { memo, useCallback, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { FlowNode, type ModeBehavior, type NodeDisplayConfig, type Selection } from '~/components/wrappers';
import { ContactNodeView } from './ContactNodeView';
import { useContact } from '~/propagation-react/hooks/useContact';
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext';
import { useEditorModes, useURLState } from '~/propagation-react/hooks/useURLState';
import { useContextFrame } from '~/propagation-react/hooks/useContextFrame';
import { useModeContext } from '~/propagation-react/contexts/ModeContext';
import { useContextSelection } from '~/propagation-react/hooks/useContextSelection';
import { useSound } from '~/components/SoundSystem';
import { toast } from 'sonner';

export const ContactNode = memo(({ id, selected }: NodeProps) => {
  const { content, blendMode, isBoundary, lastContradiction, setContent, setBlendMode } = useContact(id);
  const { highlightedNodeId, network, syncToReactFlow } = useNetworkContext();
  const { enterPropertyMode, currentMode } = useEditorModes();
  const { urlState } = useURLState();
  const { } = useContextFrame();
  const modeSystem = useModeContext();
  const { selectedContacts, selectedGroups, clearSelection } = useContextSelection();
  const { play: playConnectionSound } = useSound('connection/create');
  
  // Get visual class from mode system
  const modeClassName = modeSystem.getNodeClassName(id);
  
  // Check if valence mode is active
  const isValenceModeActive = currentMode === 'valence' || modeSystem.activeMinorModes.includes('valence');
  
  // Check if this contact can be connected to in valence mode
  const isValenceTarget = useMemo(() => {
    if (!isValenceModeActive) return false;
    
    // Don't allow connecting to self
    if (selectedContacts.some(c => c.id === id)) return false;
    
    // Allow if there's exactly one other contact selected
    return selectedContacts.length === 1 && selectedGroups.length === 0;
  }, [isValenceModeActive, selectedContacts, selectedGroups, id]);
  
  // Check if dimmed or highlighted (kept for compatibility during transition)
  const isSourceContact = isValenceModeActive && selectedContacts.some(c => c.id === id);
  const isDimmed = (isValenceModeActive && !isSourceContact && !isValenceTarget) ||
                   (highlightedNodeId !== null && !selected);
  const isHighlighted = highlightedNodeId === id;
  
  // Valence connection handler for contact-to-contact
  const handleValenceConnection = useCallback(() => {
    if (!isValenceTarget || selectedContacts.length !== 1) return;
    
    const sourceContact = selectedContacts[0];
    try {
      // Create bidirectional connection between contacts
      network.connect(sourceContact.id, id, 'bidirectional');
      syncToReactFlow();
      
      // Play connection sound
      playConnectionSound();
      
      // Clear selection and exit valence mode
      clearSelection();
      modeSystem.toggleMinorMode('valence');
      
      toast.success('Connected contacts', { duration: 2000 });
    } catch (error) {
      console.error('Failed to connect contacts:', error);
      toast.error('Failed to connect contacts', { duration: 2000 });
    }
  }, [isValenceTarget, selectedContacts, id, network, syncToReactFlow, playConnectionSound, clearSelection, modeSystem]);
  
  // Define mode behaviors
  const modeBehaviors: Record<string, ModeBehavior> = {
    valence: {
      onClick: handleValenceConnection,
      canInteract: () => isValenceTarget,
      cursor: isValenceTarget ? 'pointer' : 'default',
    }
  };
  
  
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
          // Let React Flow handle selection
          onClick: undefined,
          onDoubleClick: () => enterPropertyMode(id, true), // with focus
          // onShiftClick and onCommandClick use default behaviors
        },
        
        // Mode-specific behaviors
        modes: modeBehaviors,
        
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
        valenceCompatible={isValenceTarget}
        valenceSource={isSourceContact}
      />
    </FlowNode>
  );
});

ContactNode.displayName = 'ContactNode';