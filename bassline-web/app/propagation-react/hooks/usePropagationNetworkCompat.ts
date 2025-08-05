import { useCallback, useRef, useState, useEffect } from "react";
import {
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type { Position } from "../../propagation-core";
import { useNetworkContext } from "../contexts/NetworkContext";
import { useContactSelection } from "./useContactSelection";
import { useContextSelection } from "./useContextSelection";
import { useCurrentGroup } from "./useCurrentGroup";
import { usePalette } from "./usePalette";
import type { GadgetTemplate } from "../../propagation-core/types/template";
import { useSound } from "~/components/SoundSystem";

interface UsePropagationNetworkOptions {
  onContactDoubleClick?: (contactId: string) => void;
}

/**
 * Compatibility hook that provides the same interface as the old usePropagationNetwork
 * but uses the new context and hooks under the hood.
 */
export function usePropagationNetwork(
  options: UsePropagationNetworkOptions = {},
) {
  const { play: playDeleteNodeSound } = useSound("node/delete");
  const { play: playDeleteGadgetSound } = useSound("gadget/delete");
  const { play: playDeleteConnectionSound } = useSound("connection/delete");
  const { play: playSelectSound } = useSound("node/select", 0.2); // Quieter selection sound
  const { play: playPlaceSound } = useSound("ui/place");
  const { onContactDoubleClick } = options;
  
  // Use a single ref to track delete sound cooldown (shared between nodes and connections)
  const deleteSoundCooldownRef = useRef<boolean>(false);
  
  // Track selection sound state
  const selectionSoundTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelectionCountRef = useRef<number>(0);
  
  const { network, syncToReactFlow, nodes, edges, setNodes, setEdges, onNodesChange: rfOnNodesChange, onEdgesChange: rfOnEdgesChange } =
    useNetworkContext();
  const {
    selection: contextSelection,
    hasSelection,
    clearSelection,
    selectedContacts,
    selectedGroups,
    setSelection: setContextSelection,
  } = useContextSelection();
  
  const {
    selection: oldSelection,
    extractSelected,
    inlineSelectedGadget,
    convertSelectedToBoundary,
    updateSelection,
  } = useContactSelection();
  const {
    currentGroup,
    breadcrumbs,
    navigateToGroup,
    navigateToParent,
    addContact,
    addBoundaryContact,
    createSubgroup,
    connect,
  } = useCurrentGroup();
  const palette = usePalette();

  // Use refs to keep functions stable
  const updateSelectionRef = useRef(updateSelection);
  const setContextSelectionRef = useRef(setContextSelection);
  
  // Update refs on each render
  useEffect(() => {
    updateSelectionRef.current = updateSelection;
    setContextSelectionRef.current = setContextSelection;
  });
  
  // Handle selection changes
  const onSelectionChange = useCallback(
    ({ nodes, edges }: { nodes: any[]; edges: any[] }) => {
      // Update old selection system (for refactoring operations)
      updateSelectionRef.current(nodes, edges);
      
      // Update context frame selection (one-way sync)
      const contactIds = nodes.filter(n => n.type !== 'group').map(n => n.id);
      const groupIds = nodes.filter(n => n.type === 'group').map(n => n.id);
      setContextSelectionRef.current(contactIds, groupIds);
      
      // Play select sound with debouncing for drag selections
      const currentSelectionCount = nodes.length;
      
      if (currentSelectionCount > 0) {
        // Clear any existing timeout
        if (selectionSoundTimeoutRef.current) {
          clearTimeout(selectionSoundTimeoutRef.current);
        }
        
        // If this is a new selection (not just adding to existing selection during drag)
        if (lastSelectionCountRef.current === 0) {
          // Play immediately for first selection
          playSelectSound();
        }
        
        // Set a timeout to play sound when drag selection stops changing
        selectionSoundTimeoutRef.current = setTimeout(() => {
          // Only play if we've added nodes (not just changed during drag)
          if (currentSelectionCount > lastSelectionCountRef.current) {
            playSelectSound();
          }
        }, 200); // 200ms debounce
      }
      
      lastSelectionCountRef.current = currentSelectionCount;
    },
    [playSelectSound], // Include playSelectSound in deps
  );
  

  // Handle node changes - wrap React Flow's handler to add our custom logic
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Selection changes are handled by onSelectionChange
      
      // First, let React Flow handle all the state updates (including selection)
      rfOnNodesChange(changes);

      // Track if we have any deletions in this batch
      let hasNodeRemovals = false;
      let hasGadgetRemovals = false;

      // Then handle our custom logic for the network model
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          // Update position in our network model
          const contact = network.findContact(change.id);
          if (contact) {
            contact.position = change.position;
          } else {
            const group = network.findGroup(change.id);
            if (group) {
              group.position = change.position;
            }
          }
        } else if (change.type === "remove") {
          // Remove from our network model
          const removed = network.removeContact(change.id);
          if (removed) {
            hasNodeRemovals = true;
          } else {
            const removedGroup = network.removeGroup(change.id);
            if (removedGroup) {
              hasGadgetRemovals = true;
            }
          }
          
          // Sync to update edges that might have been removed
          syncToReactFlow();
        }
        // Note: We don't need to handle "select" - React Flow's hook handles it!
      });

      // Play sound only once for the entire batch
      if ((hasNodeRemovals || hasGadgetRemovals) && !deleteSoundCooldownRef.current) {
        if (hasGadgetRemovals) {
          playDeleteGadgetSound();
        } else {
          playDeleteNodeSound();
        }
        deleteSoundCooldownRef.current = true;
        setTimeout(() => {
          deleteSoundCooldownRef.current = false;
        }, 100);
      }
    },
    [network, syncToReactFlow, rfOnNodesChange, playDeleteNodeSound, playDeleteGadgetSound],
  );

  // Handle edge changes - wrap React Flow's handler to add our custom logic
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // First, let React Flow handle the state updates
      rfOnEdgesChange(changes);

      // Track if we have any deletions in this batch
      let hasRemovals = false;

      // Then handle our custom logic for the network model
      changes.forEach((change) => {
        if (change.type === "remove") {
          currentGroup.removeWire(change.id);
          hasRemovals = true;
        }
      });

      // Sync after processing changes to ensure UI reflects the updated state
      if (hasRemovals) {
        syncToReactFlow();
        
        // Play sound only once for the entire batch
        if (!deleteSoundCooldownRef.current) {
          playDeleteConnectionSound();
          deleteSoundCooldownRef.current = true;
          setTimeout(() => {
            deleteSoundCooldownRef.current = false;
          }, 100);
        }
      }
    },
    [currentGroup, syncToReactFlow, rfOnEdgesChange, playDeleteConnectionSound],
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        // Handle connections involving group nodes (which use handle IDs for boundary contacts)
        let sourceId = connection.source;
        let targetId = connection.target;

        // If source is a group node with a handle, use the handle ID (which is the boundary contact ID)
        if (connection.sourceHandle) {
          sourceId = connection.sourceHandle;
        }

        // If target is a group node with a handle, use the handle ID (which is the boundary contact ID)
        if (connection.targetHandle) {
          targetId = connection.targetHandle;
        }

        connect(sourceId, targetId);
      }
    },
    [connect],
  );

  // Refactoring operations wrapped for compatibility
  const extractToGadget = useCallback(
    (gadgetName: string) => {
      const newGadget = extractSelected(gadgetName);
      return newGadget !== null;
    },
    [extractSelected],
  );

  const inlineGadget = useCallback(
    (gadgetId: string) => {
      return inlineSelectedGadget();
    },
    [inlineSelectedGadget],
  );

  const convertToBoundary = useCallback(() => {
    return convertSelectedToBoundary();
  }, [convertSelectedToBoundary]);

  // Gadget template methods
  const saveAsTemplate = useCallback(
    (groupId: string): GadgetTemplate | null => {
      const group = network.findGroup(groupId);
      if (!group) return null;

      return group.toTemplate();
    },
    [network],
  );

  const instantiateTemplate = useCallback(
    (template: GadgetTemplate, position: Position) => {
      const gadget = network.instantiateTemplate(template, position);
      syncToReactFlow();
      playPlaceSound();
      return gadget;
    },
    [network, syncToReactFlow, playPlaceSound],
  );

  return {
    // React Flow props
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,

    // API methods
    addContact,
    addBoundaryContact,
    createGroup: createSubgroup,
    updateContent: () => {}, // No longer needed, components use hooks
    connect,

    // Direct access to network
    network,

    // Navigation
    navigateToGroup,
    navigateToParent,
    getBreadcrumbs: () => breadcrumbs,
    currentGroupId: currentGroup.id,

    // Selection and refactoring
    selection: oldSelection,
    hasSelection,
    extractToGadget,
    inlineGadget,
    convertToBoundary,

    // Templates
    saveAsTemplate,
    instantiateTemplate,
  };
}
