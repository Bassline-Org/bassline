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
import { ValenceConnectOperation } from '~/propagation-core/refactoring/operations/ValenceConnect';
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
  const modeSystem = useModeContext();
  
  // Get visual class from mode system
  const modeClassName = modeSystem.getNodeClassName(id);
  
  // Use existing hooks for valence checking
  const { selectedGroups, selectedContacts } = useContextSelection();
  const { areGadgetsCompatible, isMixedSelectionCompatibleWithGadget } = useValenceConnect();
  
  // Check valence compatibility
  const isValenceCompatible = useMemo(() => {
    // In valence mode, check if this gadget can be connected to
    if (currentMode === 'valence' && urlState.selection) {
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
      
      // Also handle the URL-based selection for valence mode
      const selection = urlState.selection;
      if (selection && selection.includes(id)) return false;
      
      // Calculate total outputs from URL selection
      let totalOutputCount = 0;
      if (selection) {
        for (const itemId of selection) {
          const contact = network.currentGroup.contacts.get(itemId);
          if (contact) {
            totalOutputCount++;
          } else {
            const gadget = network.currentGroup.subgroups.get(itemId);
            if (gadget) {
              const { outputs } = gadget.getBoundaryContacts();
              totalOutputCount += outputs.length;
            }
          }
        }
      }
      
      // Check if this gadget can accept the outputs
      const targetGadget = network.currentGroup.subgroups.get(id);
      if (!targetGadget) return false;
      
      const { inputs } = targetGadget.getBoundaryContacts();
      return inputs.length === totalOutputCount;
    }
    
    return false;
  }, [id, selected, currentMode, urlState.selection, network, selectedGroups, selectedContacts, areGadgetsCompatible, isMixedSelectionCompatibleWithGadget]);
  
  // Visual states
  const isSourceGadget = currentMode === 'valence' && urlState.selection?.includes(id);
  const isDimmed = (currentMode === 'valence' && !isSourceGadget && !isValenceCompatible) ||
                   (highlightedNodeId !== null && !selected);
  const isHighlighted = highlightedNodeId === id;
  
  // Valence connection handler
  const handleValenceConnection = useCallback(() => {
    if (!isValenceCompatible) return;
    
    const sourceIds = urlState.selection || [];
    
    // Separate contacts and gadgets
    const contactIds: string[] = [];
    const gadgetIds: string[] = [];
    
    for (const itemId of sourceIds) {
      if (network.currentGroup.contacts.has(itemId)) {
        contactIds.push(itemId);
      } else if (network.currentGroup.subgroups.has(itemId)) {
        gadgetIds.push(itemId);
      }
    }
    
    // Perform the connection
    const operation = new ValenceConnectOperation();
    const result = operation.executeMixedToGadget(
      network.currentGroup,
      gadgetIds,
      contactIds,
      id
    );
    
    if (result.success) {
      syncToReactFlow();
      
      // Play connection sounds
      if (result.connectionCount) {
        for (let i = 0; i < result.connectionCount; i++) {
          setTimeout(() => playConnectionSound(), i * 50);
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
  }, [id, isValenceCompatible, urlState.selection, network, syncToReactFlow, playConnectionSound, fetcher]);
  
  // Define mode behaviors
  const modeBehaviors: Record<string, ModeBehavior> = {
    valence: {
      onClick: handleValenceConnection,
      canInteract: () => isValenceCompatible,
      cursor: isValenceCompatible ? 'pointer' : 'default',
    }
  };
  
  // Tool display function
  const getToolDisplay = useCallback((tool: any, selection: Selection): NodeDisplayConfig | undefined => {
    if (tool.displayRules?.getNodeDisplay) {
      return tool.displayRules.getNodeDisplay(id, selection);
    }
    return undefined;
  }, [id]);
  
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
        
        // Tool display integration
        toolDisplay: getToolDisplay,
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