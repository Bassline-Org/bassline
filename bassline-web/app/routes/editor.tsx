import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { type ActionFunctionArgs, type LoaderFunctionArgs, useLoaderData, useFetcher } from "react-router";
import { useURLState, useEditorModes, useNavigationState, useSelectionState } from "~/propagation-react/hooks/useURLState";

import { usePropagationNetwork } from "~/propagation-react/hooks/usePropagationNetworkCompat";
import { usePalette } from "~/propagation-react/hooks/usePalette";
import { useProximityConnect } from "~/propagation-react/hooks/useProximityConnect";
import { useViewSettings } from "~/propagation-react/hooks/useViewSettings";
import { usePropertyPanel } from "~/propagation-react/hooks/usePropertyPanel";
import { useLayout } from "~/propagation-react/hooks/useLayout";
import { useValenceConnect } from "~/propagation-react/hooks/useValenceConnect";
import { NetworkProvider } from "~/propagation-react/contexts/NetworkContext";
import { UIStackProvider, useUIStack } from "~/propagation-react/contexts/UIStackContext";
import { PropertyPanelStackProvider } from "~/propagation-react/contexts/PropertyPanelStackContext";
import { ContextFrameProvider, useContextFrame } from "~/propagation-react/contexts/ContextFrameContext";
import { ContactNode } from "~/components/nodes/ContactNode";
import { GroupNode } from "~/components/nodes/GroupNode";
import { Button } from "~/components/ui/button";
import { Breadcrumbs } from "~/components/Breadcrumbs";
import { cn } from "~/lib/utils";
import { GadgetPalette } from "~/components/palette/GadgetPalette";
import { InlineGadgetMenu } from "~/components/gadgets/InlineGadgetMenu";
import { ToolsMenu } from "~/components/ToolsMenu";
import { ClientOnly } from "~/components/ClientOnly";
import { PropertyPanel } from "~/components/PropertyPanel";
import { ConfigurationPanel } from "~/components/ConfigurationPanel";
import { FatEdge } from "~/components/edges/FatEdge";
import { ValenceModeEdge } from "~/components/edges/ValenceModeEdge";
import type { GadgetTemplate } from "~/propagation-core/types/template";
import type { Position } from "~/propagation-core";
import { useNetworkContext } from "~/propagation-react/contexts/NetworkContext";
import { SoundSystemProvider } from "~/components/SoundSystem";
import { StackDebugger } from "~/components/StackDebugger";
import { ContextDebugger } from "~/components/ContextDebugger";
import { ToolRegistry } from "~/propagation-react/tools/ToolRegistry";
import { PropagationNetwork } from "~/propagation-core/models/PropagationNetwork";
import { ValenceConnectOperation } from "~/propagation-core/refactoring/operations/ValenceConnect";
import { ModeSystemProvider, useModeContext } from "~/propagation-react/contexts/ModeContext";
import { ModeMenu } from "~/components/ModeMenu";

// Client loader - provides mode state from URL and optionally loads a bassline
export async function clientLoader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'normal';
  const nodeId = url.searchParams.get('node');
  const selection = url.searchParams.get('selection');
  const basslineName = url.searchParams.get('bassline');
  
  let template = null;
  
  // Load bassline if specified
  if (basslineName) {
    // Special case for uploaded basslines
    if (basslineName === 'uploaded') {
      const encodedData = url.searchParams.get('data');
      const name = url.searchParams.get('name');
      
      if (encodedData) {
        try {
          const decodedData = atob(encodedData);
          template = JSON.parse(decodedData);
        } catch (error) {
          console.error('Failed to decode uploaded bassline:', error);
        }
      }
    } else {
      // Load from file
      try {
        const response = await fetch(`/basslines/${basslineName}.json`);
        if (response.ok) {
          template = await response.json();
        }
      } catch (error) {
        console.error(`Failed to load bassline ${basslineName}:`, error);
      }
    }
  }
  
  return {
    mode,
    nodeId,
    selection: selection ? JSON.parse(selection) : null,
    template,
    basslineName,
  };
}

// Ensure the clientLoader runs on hydration
clientLoader.hydrate = true;

// Loading fallback
export function HydrateFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mb-4 text-lg">Loading editor...</div>
        <div className="animate-pulse text-4xl">🎨</div>
      </div>
    </div>
  );
}

// Client action - handles valence mode exit
export async function clientAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const url = new URL(request.url);
  
  switch (intent) {
    case 'connect-valence': {
      // Clear valence mode after connection
      url.searchParams.delete('mode');
      url.searchParams.delete('selection');
      
      return Response.redirect(url.toString());
    }
    
    default:
      return { error: `Unknown intent: ${intent}` };
  }
}


const nodeTypes = {
  contact: ContactNode,
  boundary: ContactNode, // Same component, different data
  group: GroupNode,
};

const edgeTypes = {
  fat: FatEdge,
  valence: ValenceModeEdge,
};

function Flow() {
  const { screenToFlowPosition } = useReactFlow();
  const loaderData = useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher();
  
  // Mode system
  const modeSystem = useModeContext();
  
  // URL state management hooks
  const { urlState, pushState, clearMode } = useURLState();
  const { currentMode, enterPropertyMode, enterValenceMode, exitMode, toggleMode } = useEditorModes();
  const { navigateToGroup: urlNavigateToGroup, navigateToParent: urlNavigateToParent } = useNavigationState();
  const { selection: urlSelection, setSelection, clearSelection } = useSelectionState();
  
  const {
    appSettings,
    updatePropagationSettings,
    updateVisualSettings,
    updateBehaviorSettings,
    resetSettings,
    highlightedNodeId,
    setHighlightedNodeId,
  } = useNetworkContext();


  const palette = usePalette();
  const propertyPanel = usePropertyPanel();
  const { viewSettings, setViewSettings } = useViewSettings();
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [showDreamsGadgetMenu, setShowDreamsGadgetMenu] = useState(false);
  const { applyLayout, applyLayoutToSelection } = useLayout();
  const { canValenceConnect, valenceConnect, valenceConnectionType, totalSourceCount } = useValenceConnect();
  const uiStack = useUIStack();
  const { activeTool, activeToolInstance, activateTool, deactivateTool } = useContextFrame();

  // UI Stack integration for property panel
  const showPropertyPanel = useCallback((focusInput = false) => {
    if (!propertyPanel.isVisible) {
      propertyPanel.toggleVisibility();
    }
    
    if (focusInput && highlightedNodeId) {
      // Push property focus mode onto stack
      uiStack.push({
        type: 'propertyFocus',
        data: { nodeId: highlightedNodeId },
        onEscape: () => {
          // Clear focus but keep panel open
          setHighlightedNodeId(null);
          // Removed toast for clearing property focus
          return true; // Prevent default pop
        }
      });
    }
  }, [propertyPanel, uiStack, highlightedNodeId, setHighlightedNodeId, viewSettings.showShortcutHints]);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    addContact,
    addBoundaryContact,
    createGroup,
    navigateToGroup,
    navigateToParent,
    getBreadcrumbs,
    network,
    connect,
    selection,
    hasSelection,
    extractToGadget,
    inlineGadget,
    convertToBoundary,
    saveAsTemplate,
    instantiateTemplate,
  } = usePropagationNetwork({
    onContactDoubleClick: (contactId) => {
      // Enter property mode with the double-clicked contact
      enterPropertyMode(contactId, true);
    },
  });

  // Proximity connect hook
  const proximity = useProximityConnect(nodes, edges);


  // UI Stack integration for gadget menu
  const toggleGadgetMenu = useCallback(() => {
    if (showDreamsGadgetMenu) {
      setShowDreamsGadgetMenu(false);
      // Find and pop the gadget menu layer
      const gadgetLayer = uiStack.stack.find(item => item.type === 'gadgetMenu');
      if (gadgetLayer) {
        uiStack.popTo(gadgetLayer.id);
      }
    } else {
      setShowDreamsGadgetMenu(true);
      uiStack.push({
        type: 'gadgetMenu',
        onEscape: () => {
          setShowDreamsGadgetMenu(false);
        }
      });
    }
  }, [showDreamsGadgetMenu, setShowDreamsGadgetMenu, uiStack]);

  const handleAddContact = useCallback(() => {
    const position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    };
    addContact(position);
    // Removed toast for adding contact
  }, [addContact, viewSettings]);

  const handleAddInputBoundary = useCallback(() => {
    const position = {
      x: 50,
      y: Math.random() * 300 + 100,
    };
    addBoundaryContact(position, "input");
  }, [addBoundaryContact]);

  const handleAddOutputBoundary = useCallback(() => {
    const position = {
      x: 550,
      y: Math.random() * 300 + 100,
    };
    addBoundaryContact(position, "output");
  }, [addBoundaryContact]);

  const handleAddGroup = useCallback(() => {
    const name = prompt("Enter gadget name:");
    if (name) {
      createGroup(name);
      // Removed toast for creating gadget
    }
  }, [createGroup, viewSettings]);

  const handleAddGadgetAtPosition = useCallback(
    (position: Position) => {
      const name = prompt("Enter gadget name:");
      if (name) {
        const gadget = createGroup(name);
        gadget.position = position;
      }
    },
    [createGroup],
  );

  const handleExtractToGadget = useCallback(() => {
    const name = prompt("Enter name for new gadget:");
    if (name) {
      const success = extractToGadget(name);
      if (success) {
        // Find the newly created gadget
        const newGadget = Array.from(
          network.currentGroup.subgroups.values(),
        ).find((g) => g.name === name);

        if (newGadget) {
          const template = saveAsTemplate(newGadget.id);
          if (template) {
            palette.addToPalette(template);
            // Show toast for palette addition (important feedback)
            toast.success(`Added "${name}" to palette`, { duration: 2000 });
          }
        }
      }
    }
  }, [extractToGadget, network, saveAsTemplate, palette]);

  const handleInlineGadget = useCallback(
    (gadgetId: string) => {
      if (
        confirm(
          "Inline this gadget? This will expand its contents into the current group.",
        )
      ) {
        inlineGadget(gadgetId);
      }
    },
    [inlineGadget],
  );

  const handleConvertToBoundary = useCallback(() => {
    convertToBoundary();
  }, [convertToBoundary]);

  const handleAutoLayout = useCallback(() => {
    if (selection.contacts.size > 0 || selection.groups.size > 0) {
      // Layout only selected nodes
      const selectedNodeIds = new Set([
        ...selection.contacts,
        ...selection.groups,
      ]);
      applyLayoutToSelection(selectedNodeIds);
      // Removed toast for layout
    } else {
      // Layout all nodes
      applyLayout();
      // Removed toast for auto layout
    }
  }, [selection, applyLayout, applyLayoutToSelection]);

  const handleSaveBassline = useCallback(async () => {
    try {
      const name = prompt("Enter a name for this bassline:", "my-bassline");
      if (!name) return;
      
      const networkTemplate = network.toTemplate(name, `Created in editor`);
      
      // Convert to JSON
      const jsonContent = JSON.stringify(networkTemplate, null, 2);
      
      // Create a blob and download it
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Saved: ${name}.json`, { duration: 2000 });
    } catch (error) {
      console.error('Failed to save bassline:', error);
      toast.error('Failed to save', { duration: 2000 });
    }
  }, [network]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    const allContactIds = Array.from(network.currentGroup.contacts.keys());
    const allGroupIds = Array.from(network.currentGroup.subgroups.keys());
    
    // Update selection through React Flow
    const allNodes = [...allContactIds, ...allGroupIds];
    onSelectionChange({ nodes: allNodes.map(id => ({ id })), edges: [] });
    
    // Removed toast for select all
  }, [network.currentGroup, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    // Clear selection through React Flow
    onSelectionChange({ nodes: [], edges: [] });
    // Removed toast for clear selection
  }, [onSelectionChange]);

  const handleInvertSelection = useCallback(() => {
    const allContactIds = Array.from(network.currentGroup.contacts.keys());
    const allGroupIds = Array.from(network.currentGroup.subgroups.keys());
    
    const currentContactIds = Array.from(selection.contacts);
    const currentGroupIds = Array.from(selection.groups);
    
    const newContactIds = allContactIds.filter(id => !currentContactIds.includes(id));
    const newGroupIds = allGroupIds.filter(id => !currentGroupIds.includes(id));
    
    // Update selection through React Flow
    const newNodes = [...newContactIds, ...newGroupIds];
    onSelectionChange({ nodes: newNodes.map(id => ({ id })), edges: [] });
    
    // Removed toast for invert selection
  }, [network.currentGroup, selection, onSelectionChange]);

  const handleSelectConnected = useCallback(() => {
    // Get all currently selected items
    const selectedContactIds = Array.from(selection.contacts);
    const selectedGroupIds = Array.from(selection.groups);
    
    // Find all connected items
    const connectedIds = new Set<string>();
    
    // Check wires for connections from selected contacts
    network.currentGroup.wires.forEach(wire => {
      if (selectedContactIds.includes(wire.fromId)) {
        connectedIds.add(wire.toId);
      }
      if (selectedContactIds.includes(wire.toId)) {
        connectedIds.add(wire.fromId);
      }
    });
    
    // For selected groups, find connections via their boundary contacts
    selectedGroupIds.forEach(groupId => {
      const group = network.currentGroup.subgroups.get(groupId);
      if (group) {
        const boundary = group.getBoundaryContacts();
        const boundaryIds = [...boundary.inputs, ...boundary.outputs].map(c => c.id);
        
        network.currentGroup.wires.forEach(wire => {
          if (boundaryIds.includes(wire.fromId)) {
            connectedIds.add(wire.toId);
          }
          if (boundaryIds.includes(wire.toId)) {
            connectedIds.add(wire.fromId);
          }
        });
      }
    });
    
    // Add connected items to selection
    const newContactIds = [...selectedContactIds];
    const newGroupIds = [...selectedGroupIds];
    
    connectedIds.forEach(id => {
      if (network.currentGroup.contacts.has(id) && !newContactIds.includes(id)) {
        newContactIds.push(id);
      } else if (network.currentGroup.subgroups.has(id) && !newGroupIds.includes(id)) {
        newGroupIds.push(id);
      }
    });
    
    // Update selection through React Flow
    const allNodes = [...newContactIds, ...newGroupIds];
    onSelectionChange({ nodes: allNodes.map(id => ({ id })), edges: [] });
    
    const addedCount = (newContactIds.length - selectedContactIds.length) + 
                      (newGroupIds.length - selectedGroupIds.length);
    // Removed toast for select connected
  }, [network.currentGroup, selection, onSelectionChange]);

  const breadcrumbs = getBreadcrumbs();
  const hasShownWelcome = useRef(false);
  
  // Track current group ID for navigation changes
  const currentGroupIdRef = useRef(network.currentGroup.id);
  
  // Update after navigation to ensure proper rendering
  useEffect(() => {
    if (currentGroupIdRef.current !== network.currentGroup.id) {
      currentGroupIdRef.current = network.currentGroup.id;
      // React Flow should handle node updates automatically in newer versions
    }
  }, [network.currentGroup.id]);
  
  // Handle property mode from URL changes
  useEffect(() => {
    if (currentMode === 'property') {
      // Show property panel when in property mode
      if (!propertyPanel.isVisible) {
        propertyPanel.show(urlState.nodeId ? true : false);
      }
    } else {
      // Hide property panel when not in property mode
      if (propertyPanel.isVisible) {
        propertyPanel.hide();
      }
    }
  }, [currentMode, urlState.nodeId, propertyPanel]);

  // Show welcome toast on mount (if hints are enabled)
  useEffect(() => {
    if (viewSettings.showShortcutHints && !hasShownWelcome.current) {
      hasShownWelcome.current = true;
      toast("Welcome! Press W to see keyboard shortcuts", {
        duration: 2000,
      });
    }
  }, [viewSettings.showShortcutHints]);

  // Keyboard shortcuts (left-hand friendly)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      
      // Let mode system handle keyboard events first
      if (modeSystem.handleKeyPress(e)) {
        return;
      }

      // Tab + P to toggle palette (left hand: Tab with thumb, P with pinky)
      if (e.key === "Tab") {
        e.preventDefault(); // Prevent default tab behavior
      }

      // Escape - exit any mode, deactivate tools, or close panels
      if (e.key === "Escape") {
        e.preventDefault();
        
        // First check if there's an active tool
        if (activeTool) {
          // If the tool has a handleKeyPress method, let it handle escape first
          if (activeToolInstance && activeToolInstance.handleKeyPress) {
            const handled = activeToolInstance.handleKeyPress(e, null as any); // TODO: pass actual context
            if (handled) return;
          }
          // Otherwise deactivate the tool
          deactivateTool();
        } else if (currentMode !== 'normal') {
          // Exit any mode
          exitMode();
        } else if (propertyPanel.isVisible) {
          // If in normal mode and property panel is open, close it
          propertyPanel.toggleVisibility();
        }
      }
      
      // Pass other key events to active tool if it has a handler
      if (activeTool && activeToolInstance && activeToolInstance.handleKeyPress) {
        const handled = activeToolInstance.handleKeyPress(e, null as any); // TODO: pass actual context
        if (handled) return; // Stop processing if tool handled the key
      }

      // G to toggle gadget menu (left hand: G with index finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "g") {
        e.preventDefault();
        toggleGadgetMenu();
      }

      // T to toggle property panel (left hand: T with index finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "t") {
        e.preventDefault();
        if (currentMode === 'property') {
          exitMode();
        } else {
          const selectedIds = [...selection.contacts, ...selection.groups];
          if (selectedIds.length > 0) {
            enterPropertyMode(selectedIds[0]);
          }
        }
      }
      // L for auto layout
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "l") {
        e.preventDefault();
        handleAutoLayout();
      }

      // W to toggle instructions (left hand: W with ring finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "w") {
        e.preventDefault();
        setViewSettings({
          ...viewSettings,
          showInstructions: !viewSettings.showInstructions,
        });
      }

      // E to open property panel
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "e") {
        e.preventDefault();
        if (currentMode === 'property') {
          exitMode();
        } else {
          const selectedIds = [...selection.contacts, ...selection.groups];
          if (selectedIds.length > 0) {
            enterPropertyMode(selectedIds[0]);
            // Removed toast for opening properties panel
          } else {
            toast.error("Select a node first");
          }
        }
      }

      // Q to auto-layout selection
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "q") {
        e.preventDefault();
        if (selection.contacts.size > 0 || selection.groups.size > 0) {
          const selectedIds = new Set([...selection.contacts, ...selection.groups]);
          applyLayoutToSelection(selectedIds);
          // Removed toast for formatting selection
        } else {
          // Format all if nothing selected
          handleAutoLayout();
          // Removed toast for formatting all
        }
      }


      // V for valence mode is now handled by the mode system
      // The ValenceMode minor mode handles the 'v' key

      // Cmd/Ctrl+A for select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        if (e.shiftKey) {
          // Cmd/Ctrl+Shift+A for deselect all
          handleDeselectAll();
        } else {
          // Cmd/Ctrl+A for select all
          handleSelectAll();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    modeSystem,
    palette,
    propertyPanel,
    viewSettings,
    setViewSettings,
    handleAutoLayout,
    applyLayoutToSelection,
    toast,
    showDreamsGadgetMenu,
    selection,
    highlightedNodeId,
    setHighlightedNodeId,
    uiStack,
    toggleGadgetMenu,
    activeTool,
    activeToolInstance,
    activateTool,
    deactivateTool,
    currentMode,
    exitMode,
    enterPropertyMode,
    enterValenceMode,
    toggleMode,
    handleSelectAll,
    handleDeselectAll,
  ]);

  // Handle node drag with proximity connect
  const handleNodeDrag = useCallback(
    (event: any, node: any) => {
      proximity.onNodeDrag(event, node);
    },
    [proximity],
  );

  const handleNodeDragStop = useCallback(
    (event: any, node: any) => {
      const connection = proximity.onNodeDragStop(event, node);
      if (connection) {
        connect(connection.source, connection.target);
      }
    },
    [proximity, connect],
  );

  // Handle edge drop - create contact directly
  const handleConnectEnd = useCallback(
    (event: any, connectionState: any) => {
      // Only create contact if connection is not valid (dropped on empty space)
      if (!connectionState?.isValid && connectionState?.fromNode) {
        // Get the flow position for creating the contact
        const screenPos = {
          x: event.clientX,
          y: event.clientY,
        };
        const flowPos = screenToFlowPosition(screenPos);

        // Create a new contact at the drop position
        const newContact = addContact({ x: flowPos.x, y: flowPos.y });

        if (newContact) {
          // Use handle ID if dragging from a gadget, otherwise use node ID
          const sourceId =
            connectionState.fromHandle?.id || connectionState.fromNode.id;

          // Connect based on the handle type
          if (connectionState.fromHandle?.type === "source") {
            connect(sourceId, newContact.id);
          } else {
            connect(newContact.id, sourceId);
          }
        }
      }
    },
    [screenToFlowPosition, addContact, connect],
  );

  // Handle drag over for palette items
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  // Handle drop from palette
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const paletteItemId = event.dataTransfer.getData("gadgetPaletteItem");
      if (!paletteItemId) return;

      const paletteItem = palette.items.find(
        (item) => item.id === paletteItemId,
      );
      if (!paletteItem) return;

      // Get the drop position in flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Instantiate the template at the drop position
      instantiateTemplate(paletteItem, position);
      palette.incrementUsageCount(paletteItemId);
      // Removed toast for placing gadget
    },
    [palette, instantiateTemplate],
  );

  // Combine edges with potential proximity edge
  const displayEdges = proximity.potentialEdge
    ? [...edges, proximity.potentialEdge]
    : edges;

  // Compute background color based on mode
  const getBackgroundClass = () => {
    if (currentMode === 'property') return "bg-gray-800";
    if (currentMode !== 'normal') return "bg-gray-700";
    return "bg-gray-600";
  };

  return (
    <div
      className={cn("w-full h-screen select-none transition-colors duration-300 relative", 
        getBackgroundClass()
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Mode-based visual indicators are now handled by the mode system */}
      
      {/* Debug: Stack visualizer */}
      {viewSettings.showDebugInfo && (
        <>
          <StackDebugger />
          <ContextDebugger />
        </>
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        onSelectionChange={onSelectionChange}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={["Delete", "Backspace"]}
        selectNodesOnDrag={false}
        elementsSelectable={true}
        fitView
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnDrag={true}
      >
        {viewSettings.showGrid && (
          <Background 
            gap={12} 
            className={cn(
              "transition-colors duration-300",
              currentMode === 'property' ? "!bg-gray-700" : 
              currentMode !== 'normal' ? "!bg-gray-600" : 
              "!bg-gray-500"
            )} 
            size={1} 
          />
        )}

        <Panel position="top-left" className="flex flex-col gap-2">
          <Breadcrumbs items={breadcrumbs} onNavigate={urlNavigateToGroup} />
          <ModeMenu
            currentMajorMode={modeSystem.currentMajorMode}
            activeMinorModes={modeSystem.activeMinorModes}
            availableModes={modeSystem.availableModes}
            onSwitchMajorMode={modeSystem.switchMajorMode}
            onToggleMinorMode={modeSystem.toggleMinorMode}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleAddInputBoundary}
              size="sm"
              variant="outline"
            >
              Add Input Boundary
            </Button>
            <Button
              onClick={handleAddOutputBoundary}
              size="sm"
              variant="outline"
            >
              Add Output Boundary
            </Button>
            <Button 
              onClick={handleSaveBassline} 
              size="sm" 
              variant="outline"
              title="Save bassline (Cmd/Ctrl+S)"
            >
              💾 Save
            </Button>
          </div>
          {hasSelection && (
            <div className="flex gap-2">
              {(selection.contacts.size > 0 || selection.groups.size > 0) && (
                <Button
                  onClick={handleExtractToGadget}
                  size="sm"
                  variant="default"
                >
                  Extract to Gadget ({selection.contacts.size} contacts
                  {selection.groups.size > 0
                    ? `, ${selection.groups.size} gadgets`
                    : ""}
                  )
                </Button>
              )}
              {selection.groups.size === 1 && (
                <>
                  <Button
                    onClick={() =>
                      handleInlineGadget(Array.from(selection.groups)[0])
                    }
                    size="sm"
                    variant="secondary"
                  >
                    Inline Gadget
                  </Button>
                  <Button
                    onClick={() => {
                      const gadgetId = Array.from(selection.groups)[0];
                      const gadget = network.findGroup(gadgetId);
                      const template = saveAsTemplate(gadgetId);
                      if (template) {
                        palette.addToPalette(template);
                        toast.success(`Added to palette`, { duration: 2000 });
                      }
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Add to Palette
                  </Button>
                </>
              )}
              {(selection.contacts.size > 0 || selection.groups.size > 0) && currentMode !== 'valence' && (
                <Button
                  onClick={() => {
                    // Convert Set values to array of IDs
                    const selectedIds = [...Array.from(selection.contacts), ...Array.from(selection.groups)];
                    enterValenceMode(selectedIds);
                  }}
                  size="sm"
                  variant="default"
                  title="Enter valence mode to connect selected items (V)"
                >
                  Valence Mode
                </Button>
              )}
              {selection.contacts.size > 0 && selection.groups.size === 0 && (
                <Button
                  onClick={handleConvertToBoundary}
                  size="sm"
                  variant="outline"
                >
                  Convert to Boundary ({selection.contacts.size} contacts)
                </Button>
              )}
            </div>
          )}
          {viewSettings.showInstructions && (
            <div className="text-xs text-gray-600 bg-white/80 p-2 rounded">
              <div className="font-semibold mb-1">Controls:</div>
              <div>Double-click gadget → Navigate inside</div>
              <div>Double-click node → Edit content</div>
              <div>Select & Extract → Create gadget</div>
              <div>Delete/Backspace → Remove items</div>
              <div className="font-semibold mt-2 mb-1">
                Left-hand shortcuts:
              </div>
              <div>G → Toggle gadgets</div>
              <div>W → Toggle instructions (this)</div>
              <div>E → Open properties</div>
              <div>Q → Format selection/all</div>
              <div>T → Toggle properties</div>
              <div>L → Auto layout</div>
              <div>V → Valence mode (select first)</div>
            </div>
          )}
        </Panel>

        <Panel position="bottom-center" className="mb-2">
          <ClientOnly>
            <ToolsMenu
              viewSettings={viewSettings}
              onViewSettingsChange={setViewSettings}
              onOpenConfiguration={() => setShowConfiguration(true)}
              onAutoLayout={handleAutoLayout}
              onOpenGadgets={toggleGadgetMenu}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onInvertSelection={handleInvertSelection}
              onSelectConnected={handleSelectConnected}
            />
          </ClientOnly>
        </Panel>
      </ReactFlow>

      {/* Old palette - replaced with Dreams-style menu
      <ClientOnly>
        <GadgetPalette
          items={palette.items}
          categories={palette.categories}
          isVisible={palette.isVisible}
          onToggleVisibility={palette.toggleVisibility}
          onRemoveItem={palette.removeFromPalette}
          onUseItem={palette.incrementUsageCount}
          getItemsByCategory={palette.getItemsByCategory}
          getMostUsed={palette.getMostUsed}
          getRecent={palette.getRecent}
        />
      </ClientOnly>
      */}
      
      <ClientOnly>
        <InlineGadgetMenu
          isOpen={showDreamsGadgetMenu}
          onClose={() => {
            const gadgetLayer = uiStack.stack.find(item => item.type === 'gadgetMenu');
            if (gadgetLayer) {
              uiStack.popTo(gadgetLayer.id);
            }
          }}
          items={palette.items}
          categories={palette.categories}
          onUseItem={palette.incrementUsageCount}
          getItemsByCategory={palette.getItemsByCategory}
        />
      </ClientOnly>

      <ClientOnly>
        <PropertyPanel
          isVisible={currentMode === 'property'}
          onToggleVisibility={() => {
            if (currentMode === 'property') {
              exitMode();
            } else {
              const selectedIds = [...selection.contacts, ...selection.groups];
              if (selectedIds.length > 0) {
                enterPropertyMode(selectedIds[0]);
              }
            }
          }}
          shouldFocus={propertyPanel.shouldFocus}
        />
      </ClientOnly>

      {showConfiguration && (
        <ConfigurationPanel
          appSettings={appSettings}
          onUpdatePropagation={updatePropagationSettings}
          onUpdateVisual={updateVisualSettings}
          onUpdateBehavior={updateBehaviorSettings}
          onReset={resetSettings}
          onClose={() => setShowConfiguration(false)}
        />
      )}
    </div>
  );
}

export default function Editor() {
  const { template, basslineName } = useLoaderData<typeof clientLoader>();
  
  // Create network from template if provided
  const network = useMemo(() => {
    if (template) {
      return PropagationNetwork.fromTemplate(template);
    }
    return new PropagationNetwork();
  }, [template]);
  
  // Show loaded toast only on initial mount
  const hasShownLoadedToast = useRef(false);
  useEffect(() => {
    if (template && basslineName && !hasShownLoadedToast.current) {
      hasShownLoadedToast.current = true;
      toast.success(`Loaded: ${basslineName}`, { duration: 2000 });
    }
  }, [template, basslineName]);
  
  return (
    <NetworkProvider initialNetwork={network} key={basslineName || 'default'} skipDefaultContent={!!template}>
      <UIStackProvider>
        <PropertyPanelStackProvider>
          <ReactFlowProvider>
            <ContextFrameProvider>
              <ModeSystemProvider>
                <ClientOnly>
                  <SoundSystemProvider>
                    <Flow />
                  </SoundSystemProvider>
                </ClientOnly>
              </ModeSystemProvider>
            </ContextFrameProvider>
          </ReactFlowProvider>
        </PropertyPanelStackProvider>
      </UIStackProvider>
    </NetworkProvider>
  );
}
