/**
 * GroupNode - Refactored with wrapper components
 * Clean separation between interaction logic and presentation
 */

import { memo, useCallback, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { FlowNode, type ModeBehavior, type NodeDisplayConfig, type Selection } from '~/components/wrappers';
import { GroupNodeView } from './GroupNodeView';
import { useGroup } from '~/propagation-react/hooks/useGroup';
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext';
import { useEditorModes, useURLState } from '~/propagation-react/hooks/useURLState';
import { useFetcher } from 'react-router';
import { ValenceConnectOperation, type ValenceConnectionResult } from '~/propagation-core/refactoring/operations/ValenceConnect';
import { toast } from 'sonner';
import { useSound } from '~/components/SoundSystem';
import { useContextSelection } from '~/propagation-react/hooks/useContextSelection';
import { useValenceConnect } from '~/propagation-react/hooks/useValenceConnect';
import { useModeContext } from '~/propagation-react/contexts/ModeContext';

export const GroupNode = memo(({ id, selected }: NodeProps) => {
  const { highlightedNodeId, network, syncToReactFlow } = useNetworkContext();
  const { name, inputContacts, outputContacts, isPrimitive, navigate } = useGroup(id);
  const { enterPropertyMode, currentMode } = useEditorModes();
  const { urlState } = useURLState();
  const fetcher = useFetcher();
  const { play: playConnectionSound } = useSound('connection/create');
  const { play: playCelebrationSound } = useSound('special/celebrate');
  const modeSystem = useModeContext();
  
  // Get visual class from mode system
  const modeClassName = modeSystem.getNodeClassName(id);
  
  // Use existing hooks for valence checking
  const { selectedGroups, selectedContacts } = useContextSelection();
  const { areGadgetsCompatible, isMixedSelectionCompatibleWithGadget } = useValenceConnect();
  
  // Check if valence mode is active in either URL or mode system
  const isValenceModeActive = currentMode === 'valence' || modeSystem.activeMinorModes.includes('valence');
  
  // Check valence compatibility
  const isValenceCompatible = useMemo(() => {
    // In valence mode, check if this gadget can be connected to
    const hasSelection = selectedGroups.length > 0 || selectedContacts.length > 0;
    if (isValenceModeActive && hasSelection) {
      // Don't highlight if this gadget is selected
      if (selected) return false;
      
      // Use the same logic as the original GroupNode
      // Case 1: Another gadget is selected
      if (selectedGroups.length === 1 && selectedContacts.length === 0) {
        const selectedGadget = selectedGroups[0];
        return areGadgetsCompatible(selectedGadget.id, id);
      }
      
      // Case 2: Contacts are selected, check if they match this gadget's inputs/outputs
      if (selectedGroups.length === 0 && selectedContacts.length > 0) {
        const thisGroup = network.currentGroup.subgroups.get(id);
        if (!thisGroup) return false;
        
        return ValenceConnectOperation.canConnectContactsToGadget(selectedContacts, thisGroup) ||
               ValenceConnectOperation.canConnectGadgetToContacts(thisGroup, selectedContacts);
      }
      
      // Case 3: Mixed selection (gadgets + contacts)
      if (selectedGroups.length >= 1 && selectedContacts.length > 0) {
        return isMixedSelectionCompatibleWithGadget(id);
      }
      
      // No other cases match
      return false;
    }
    
    return false;
  }, [id, selected, isValenceModeActive, network, selectedGroups, selectedContacts, areGadgetsCompatible, isMixedSelectionCompatibleWithGadget]);
  
  // Visual states
  const isSourceGadget = isValenceModeActive && (selectedGroups.some(g => g.id === id) || selectedContacts.some(c => c.id === id));
  const isDimmed = (isValenceModeActive && !isSourceGadget && !isValenceCompatible) ||
                   (highlightedNodeId !== null && !selected);
  const isHighlighted = highlightedNodeId === id;
  
  // Valence connection handler
  const handleValenceConnection = useCallback(() => {
    if (!isValenceCompatible) return;
    
    // Get source IDs from current selection
    const contactIds = selectedContacts.map(c => c.id);
    const gadgetIds = selectedGroups.map(g => g.id);
    const sourceIds = [...contactIds, ...gadgetIds];
    
    // Perform the connection
    const operation = new ValenceConnectOperation();
    let result: ValenceConnectionResult;
    
    // Case 1: Gadget-to-gadget connection
    if (gadgetIds.length === 1 && contactIds.length === 0) {
      result = operation.execute(network.currentGroup, gadgetIds[0], id);
    }
    // Case 2: Contacts-to-gadget connection
    else if (gadgetIds.length === 0 && contactIds.length > 0) {
      result = operation.executeContactsToGadget(network.currentGroup, contactIds, id);
    }
    // Case 3: Mixed selection
    else {
      result = operation.executeMixedToGadget(
        network.currentGroup,
        gadgetIds,
        contactIds,
        id
      );
    }
    
    if (result.success) {
      syncToReactFlow();
      
      // Play connection sounds
      if (result.connectionCount) {
        if (result.connectionCount > 3) {
          // Play celebration sound for many connections
          playCelebrationSound();
        } else {
          // Play individual connection sounds
          for (let i = 0; i < result.connectionCount; i++) {
            setTimeout(() => playConnectionSound(), i * 50);
          }
        }
      }
    } else {
      toast.error(result.message || 'Failed to connect', { duration: 2000 });
    }
    
    // Submit form to exit valence mode
    fetcher.submit(
      {
        intent: 'connect-valence',
        sourceIds: JSON.stringify(sourceIds),
        targetId: id
      },
      { method: 'post' }
    );
  }, [id, isValenceCompatible, selectedContacts, selectedGroups, network, syncToReactFlow, playConnectionSound, playCelebrationSound, fetcher]);
  
  // Define mode behaviors
  const modeBehaviors: Record<string, ModeBehavior> = {
    valence: {
      onClick: handleValenceConnection,
      canInteract: () => isValenceCompatible,
      cursor: isValenceCompatible ? 'pointer' : 'default',
    }
  };
  
  
  return (
    <FlowNode
      id={id}
      selected={selected}
      interactive={{
        type: 'group',
        
        // Selection behaviors
        selection: {
          // Don't provide onClick - let React Flow handle selection
          // onClick: () => enterPropertyMode(id),
          onDoubleClick: () => {
            if (!isPrimitive) navigate();
          },
        },
        
        // Mode-specific behaviors
        modes: modeBehaviors,
      }}
    >
      <GroupNodeView
        name={name}
        inputContacts={inputContacts}
        outputContacts={outputContacts}
        isPrimitive={isPrimitive}
        selected={selected}
        valenceCompatible={isValenceCompatible}
        valenceSource={isSourceGadget}
        highlighted={isHighlighted}
        dimmed={isDimmed}
        className={modeClassName}
      />
    </FlowNode>
  );
});

GroupNode.displayName = 'GroupNode';