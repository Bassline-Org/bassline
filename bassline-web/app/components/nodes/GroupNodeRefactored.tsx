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
import { useEditorModes } from '~/propagation-react/hooks/useURLState';
import { useLoaderData, useFetcher } from 'react-router';
import type { clientLoader } from '~/routes/editor';
import { ValenceConnectOperation } from '~/propagation-core/refactoring/operations/ValenceConnect';
import { toast } from 'sonner';
import { useSound } from '~/components/SoundSystem';

export const GroupNodeRefactored = memo(({ id, selected }: NodeProps) => {
  const { highlightedNodeId, network, syncToReactFlow } = useNetworkContext();
  const { name, inputContacts, outputContacts, isPrimitive, navigate } = useGroup(id);
  const { enterPropertyMode } = useEditorModes();
  const loaderData = useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher();
  const { play: playConnectionSound } = useSound('connection/create');
  
  // Check valence compatibility
  const isValenceCompatible = useMemo(() => {
    if (loaderData.mode === 'valence' && loaderData.selection) {
      const selection = loaderData.selection as string[];
      if (selection.includes(id)) return false; // Don't highlight if selected
      
      // Calculate total outputs from selection
      let totalOutputCount = 0;
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
      
      // Check if this gadget can accept the outputs
      const targetGadget = network.currentGroup.subgroups.get(id);
      if (!targetGadget) return false;
      
      const { inputs } = targetGadget.getBoundaryContacts();
      return inputs.length === totalOutputCount;
    }
    
    return false;
  }, [id, loaderData.mode, loaderData.selection, network]);
  
  // Visual states
  const isSourceGadget = loaderData.mode === 'valence' && loaderData.selection?.includes(id);
  const isDimmed = (loaderData.mode === 'valence' && !isSourceGadget && !isValenceCompatible) ||
                   (highlightedNodeId !== null && !selected);
  const isHighlighted = highlightedNodeId === id;
  
  // Valence connection handler
  const handleValenceConnection = useCallback(() => {
    if (!isValenceCompatible) return;
    
    const sourceIds = loaderData.selection as string[];
    
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
  }, [id, isValenceCompatible, loaderData.selection, network, syncToReactFlow, playConnectionSound, fetcher]);
  
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
          onClick: () => enterPropertyMode(id),
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
      />
    </FlowNode>
  );
});

GroupNodeRefactored.displayName = 'GroupNodeRefactored';