import { useCallback, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";

import { usePropagationNetwork } from "~/propagation-react/hooks/usePropagationNetworkCompat";
import { usePalette } from "~/propagation-react/hooks/usePalette";
import { useProximityConnect } from "~/propagation-react/hooks/useProximityConnect";
import { useViewSettings } from "~/propagation-react/hooks/useViewSettings";
import { usePropertyPanel } from "~/propagation-react/hooks/usePropertyPanel";
import { useLayout } from "~/propagation-react/hooks/useLayout";
import { useValenceConnect } from "~/propagation-react/hooks/useValenceConnect";
import { NetworkProvider } from "~/propagation-react/contexts/NetworkContext";
import { ValenceModeProvider, useValenceMode } from "~/propagation-react/contexts/ValenceModeContext";
import { ContactNode } from "~/components/nodes/ContactNode";
import { GroupNode } from "~/components/nodes/GroupNode";
import { Button } from "~/components/ui/button";
import { Breadcrumbs } from "~/components/Breadcrumbs";
import { GadgetPalette } from "~/components/palette/GadgetPalette";
import { InlineGadgetMenu } from "~/components/gadgets/InlineGadgetMenu";
import { ToolsMenu } from "~/components/ToolsMenu";
import { ClientOnly } from "~/components/ClientOnly";
import { PropertyPanel } from "~/components/PropertyPanel";
import { ConfigurationPanel } from "~/components/ConfigurationPanel";
import { FatEdge } from "~/components/edges/FatEdge";
import type { GadgetTemplate } from "~/propagation-core/types/template";
import type { Position } from "~/propagation-core";
import { useNetworkContext } from "~/propagation-react/contexts/NetworkContext";
import { SoundSystemProvider } from "~/components/SoundSystem";

const nodeTypes = {
  contact: ContactNode,
  boundary: ContactNode, // Same component, different data
  group: GroupNode,
};

const edgeTypes = {
  fat: FatEdge,
};

function Flow() {
  const { screenToFlowPosition } = useReactFlow();
  const {
    appSettings,
    updatePropagationSettings,
    updateVisualSettings,
    updateBehaviorSettings,
    resetSettings,
  } = useNetworkContext();

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
      propertyPanel.show(true); // true = focus input
    },
  });

  const palette = usePalette();
  const propertyPanel = usePropertyPanel();
  const { viewSettings, setViewSettings } = useViewSettings();
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [showDreamsGadgetMenu, setShowDreamsGadgetMenu] = useState(false);
  const { applyLayout, applyLayoutToSelection } = useLayout();
  const { canValenceConnect, valenceConnect, valenceConnectionType, totalSourceCount } = useValenceConnect();
  const { isValenceMode, enterValenceMode, exitValenceMode, valenceSource } = useValenceMode();

  // Proximity connect hook
  const proximity = useProximityConnect(nodes, edges);

  const handleAddContact = useCallback(() => {
    const position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    };
    addContact(position);
    if (viewSettings.showShortcutHints) {
      toast.success("Contact added! Tip: Press A for quick add", {
        duration: 4000,
      });
    }
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
      if (viewSettings.showShortcutHints) {
        toast.success("Gadget created! Tip: Press S for quick add", {
          duration: 4000,
        });
      }
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
            if (viewSettings.showShortcutHints) {
              toast.success(`"${name}" added to palette! Press Q to view.`);
            }
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
      toast.success("Applied layout to selection");
    } else {
      // Layout all nodes
      applyLayout();
      toast.success("Applied auto layout");
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
      
      toast.success(`Saved bassline as ${name}.json`);
    } catch (error) {
      console.error('Failed to save bassline:', error);
      toast.error('Failed to save bassline');
    }
  }, [network]);

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

  // Show welcome toast on mount (if hints are enabled)
  useEffect(() => {
    if (viewSettings.showShortcutHints && !hasShownWelcome.current) {
      hasShownWelcome.current = true;
      toast("Welcome! Press W to see keyboard shortcuts", {
        duration: 5000,
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

      // Tab + P to toggle palette (left hand: Tab with thumb, P with pinky)
      if (e.key === "Tab") {
        e.preventDefault(); // Prevent default tab behavior
      }

      // G to toggle gadget menu (left hand: G with index finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "g") {
        e.preventDefault();
        setShowDreamsGadgetMenu(!showDreamsGadgetMenu);
      }

      // T to toggle property panel (left hand: T with index finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "t") {
        e.preventDefault();
        propertyPanel.toggleVisibility();
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

      // E to toggle minimap (left hand: E with middle finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "e") {
        e.preventDefault();
        setViewSettings({
          ...viewSettings,
          showMiniMap: !viewSettings.showMiniMap,
        });
      }

      // A to add contact (left hand: A with pinky)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "a") {
        e.preventDefault();
        const position = {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
        };
        addContact(position);
      }

      // S to add gadget (left hand: S with ring finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "s") {
        e.preventDefault();
        handleAddGroup();
      }

      // D to toggle grid (left hand: D with middle finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "d") {
        e.preventDefault();
        setViewSettings({
          ...viewSettings,
          showGrid: !viewSettings.showGrid,
        });
      }

      // R to reset palette (for debugging)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "r") {
        e.preventDefault();
        palette.resetToDefaults();
        if (viewSettings.showShortcutHints) {
          toast.success("Reset palette to default gadgets");
        }
      }

      // V for valence mode
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "v") {
        e.preventDefault();
        if (isValenceMode) {
          exitValenceMode();
        } else if (selection.contacts.size > 0 || selection.groups.size > 0) {
          enterValenceMode();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    palette,
    propertyPanel,
    viewSettings,
    setViewSettings,
    addContact,
    handleAddGroup,
    handleAutoLayout,
    toast,
    showDreamsGadgetMenu,
    isValenceMode,
    enterValenceMode,
    exitValenceMode,
    selection,
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
      toast.success(`Placed "${paletteItem.name}" gadget`);
    },
    [palette, instantiateTemplate],
  );

  // Combine edges with potential proximity edge
  const displayEdges = proximity.potentialEdge
    ? [...edges, proximity.potentialEdge]
    : edges;

  return (
    <div
      className="w-full h-screen select-none bg-background"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
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
        className="select-none"
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnDrag={true}
      >
        {viewSettings.showGrid && (
          <Background gap={12} className="!bg-muted/20" size={1} />
        )}
        {/* <Controls /> */}
        {viewSettings.showMiniMap && <MiniMap />}

        <Panel position="top-left" className="flex flex-col gap-2">
          <Breadcrumbs items={breadcrumbs} onNavigate={navigateToGroup} />
          {isValenceMode && (
            <div className="bg-green-500 text-white px-4 py-2 rounded-md animate-pulse flex items-center justify-between">
              <span className="font-semibold">
                Valence Mode: Click gadgets with {valenceSource?.totalOutputCount || 0} inputs
              </span>
              <Button
                onClick={exitValenceMode}
                size="sm"
                variant="ghost"
                className="text-white hover:bg-green-600"
              >
                Exit (Esc)
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleAddContact} size="sm">
              Add Contact
            </Button>
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
            <Button onClick={handleAddGroup} size="sm" variant="secondary">
              Add Gadget
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
                        toast.success(
                          `"${gadget?.name || "Gadget"}" added to palette`,
                        );
                      }
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Add to Palette
                  </Button>
                </>
              )}
              {(selection.contacts.size > 0 || selection.groups.size > 0) && !isValenceMode && (
                <Button
                  onClick={enterValenceMode}
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
              <div>E → Toggle minimap</div>
              <div>A → Add contact</div>
              <div>S → Add gadget</div>
              <div>D → Toggle grid</div>
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
              onOpenGadgets={() => setShowDreamsGadgetMenu(true)}
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
          onClose={() => setShowDreamsGadgetMenu(false)}
          items={palette.items}
          categories={palette.categories}
          onUseItem={palette.incrementUsageCount}
          getItemsByCategory={palette.getItemsByCategory}
        />
      </ClientOnly>

      <ClientOnly>
        <PropertyPanel
          isVisible={propertyPanel.isVisible}
          onToggleVisibility={propertyPanel.toggleVisibility}
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
  return (
    <NetworkProvider>
      <ReactFlowProvider>
        <ClientOnly>
          <SoundSystemProvider>
            <ValenceModeProvider>
              <Flow />
            </ValenceModeProvider>
          </SoundSystemProvider>
        </ClientOnly>
      </ReactFlowProvider>
    </NetworkProvider>
  );
}
