import { useCallback, useState, useEffect, useRef, useMemo } from "react";
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
import { useLoaderData, type LoaderFunctionArgs } from "react-router";

import { usePropagationNetwork } from "~/propagation-react/hooks/usePropagationNetworkCompat";
import { useInitializedPalette } from "~/propagation-react/hooks/useInitializedPalette";
import { useProximityConnect } from "~/propagation-react/hooks/useProximityConnect";
import { useViewSettings } from "~/propagation-react/hooks/useViewSettings";
import { usePropertyPanel } from "~/propagation-react/hooks/usePropertyPanel";
import { useLayout } from "~/propagation-react/hooks/useLayout";
import { NetworkProvider } from "~/propagation-react/contexts/NetworkContext";
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
import { PropagationNetwork, type NetworkTemplate } from "~/propagation-core/models/PropagationNetwork";

// Loader to fetch the bassline template
export async function loader({ params, request }: LoaderFunctionArgs) {
  const basslineName = params.bassline;
  const url = new URL(request.url);
  
  // Special case for uploaded basslines
  if (basslineName === 'uploaded') {
    const encodedData = url.searchParams.get('data');
    const name = url.searchParams.get('name');
    
    if (encodedData) {
      try {
        // Decode the template from base64
        const decodedData = Buffer.from(encodedData, 'base64').toString('utf-8');
        const template: NetworkTemplate = JSON.parse(decodedData);
        return { template, basslineName: name || 'uploaded' };
      } catch (error) {
        console.error('Failed to decode uploaded bassline:', error);
        throw new Response("Invalid bassline data", { status: 400 });
      }
    } else {
      throw new Response("No bassline data provided", { status: 400 });
    }
  }
  
  try {
    // In React Router v7, we need to read files directly from the file system in loaders
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Get the absolute path to the bassline file
    const basslineFilePath = path.join(process.cwd(), 'public', 'basslines', `${basslineName}.json`);
    
    // Read the file
    const fileContent = await fs.readFile(basslineFilePath, 'utf-8');
    const template: NetworkTemplate = JSON.parse(fileContent);
    
    return { template, basslineName };
  } catch (error) {
    console.error(`Failed to load bassline ${basslineName}:`, error);
    throw new Response("Bassline not found", { status: 404 });
  }
}

const nodeTypes = {
  contact: ContactNode,
  boundary: ContactNode, // Same component, different data
  group: GroupNode,
};

const edgeTypes = {
  fat: FatEdge,
};

function Flow({ basslineName }: { basslineName: string }) {
  const { screenToFlowPosition } = useReactFlow();
  const {
    appSettings,
    updatePropagationSettings,
    updateVisualSettings,
    updateBehaviorSettings,
    resetSettings,
    network: contextNetwork,
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

  const palette = useInitializedPalette(contextNetwork);
  const propertyPanel = usePropertyPanel();
  const { viewSettings, setViewSettings } = useViewSettings();
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [showDreamsGadgetMenu, setShowDreamsGadgetMenu] = useState(false);
  const { applyLayout, applyLayoutToSelection } = useLayout();

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
          contextNetwork.currentGroup.subgroups.values(),
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
  }, [extractToGadget, contextNetwork, saveAsTemplate, palette]);

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
      // Use the network from context which has the current state
      const networkTemplate = contextNetwork.toTemplate(basslineName || 'untitled', `Saved from editor`);
      
      // Convert to JSON
      const jsonContent = JSON.stringify(networkTemplate, null, 2);
      
      // Create a blob and download it
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${basslineName || 'untitled'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Saved bassline as ${basslineName || 'untitled'}.json`);
    } catch (error) {
      console.error('Failed to save bassline:', error);
      toast.error('Failed to save bassline');
    }
  }, [contextNetwork, basslineName]);

  const breadcrumbs = getBreadcrumbs();
  const hasShownWelcome = useRef(false);
  
  // Track current group ID for navigation changes
  const currentGroupIdRef = useRef(contextNetwork.currentGroup.id);
  
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
    [palette, instantiateTemplate, screenToFlowPosition],
  );
  
  // Update after navigation to ensure proper rendering
  useEffect(() => {
    if (currentGroupIdRef.current !== contextNetwork.currentGroup.id) {
      currentGroupIdRef.current = contextNetwork.currentGroup.id;
      // React Flow should handle node updates automatically in newer versions
    }
  }, [contextNetwork.currentGroup.id]);

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

      // Cmd/Ctrl + S to save bassline
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveBassline();
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

      // Q to toggle palette (left hand: Q with ring finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "q") {
        e.preventDefault();
        palette.toggleVisibility();
      }

      // W to toggle tools menu (left hand: W with ring finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "w") {
        e.preventDefault();
        // Toggle tools menu visibility (implement this)
      }

      // A to add contact (left hand: A with pinky)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "a") {
        e.preventDefault();
        const position = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        addContact(position);
      }

      // S to add gadget (left hand: S with ring finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "s") {
        e.preventDefault();
        const position = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        handleAddGadgetAtPosition(position);
      }

      // D to delete selection (left hand: D with middle finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "d") {
        e.preventDefault();
        // Delete is handled by React Flow natively
      }

      // E to extract to gadget (left hand: E with middle finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "e") {
        e.preventDefault();
        if (hasSelection) {
          handleExtractToGadget();
        }
      }

      // R to auto-layout (left hand: R with index finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "r") {
        e.preventDefault();
        handleAutoLayout();
      }

      // F to convert to boundary (left hand: F with index finger)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "f") {
        e.preventDefault();
        if (hasSelection) {
          handleConvertToBoundary();
        }
      }

      // Tab to navigate up
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        navigateToParent();
      }

      // X to toggle proximity connect
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "x") {
        e.preventDefault();
        toast.info("Proximity connect is always active when dragging nodes");
      }

      // Z to show a quick tips toast
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "z") {
        e.preventDefault();
        const tips = [
          "A: Add contact",
          "S: Add gadget",
          "E: Extract to gadget",
          "R: Auto-layout",
          "Q: Toggle palette",
          "X: Toggle proximity connect",
        ];
        toast.info(tips.join(" • "), { duration: 5000 });
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    addContact,
    createGroup,
    handleExtractToGadget,
    handleConvertToBoundary,
    handleAutoLayout,
    handleSaveBassline,
    hasSelection,
    navigateToParent,
    screenToFlowPosition,
    palette,
    proximity,
    propertyPanel,
    showDreamsGadgetMenu,
    handleAddGadgetAtPosition,
  ]);

  return (
    <>
      <div
        className="w-full h-screen select-none bg-background"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        onSelectionChange={onSelectionChange}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={["Delete", "Backspace", "d", "D"]}
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnDrag={true}
        selectionOnDrag={true}
        elevateEdgesOnSelect={false}
      >
        <Background />
        <Controls />
        <MiniMap className="!bg-white/80" />

        <Panel position="top-center" className="m-0 flex items-center gap-3">
          <Breadcrumbs
            items={breadcrumbs}
            onNavigate={(groupId) => navigateToGroup(groupId)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveBassline}
            title="Save bassline (Cmd/Ctrl+S)"
          >
            💾
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfiguration(!showConfiguration)}
          >
            ⚙️
          </Button>
        </Panel>

        <Panel position="top-left" className="m-2">
          <div className="flex gap-2">
            <Button onClick={handleAddContact}>Add Contact</Button>
            <Button onClick={handleAddGroup}>Add Gadget</Button>
            {contextNetwork.currentGroup !== contextNetwork.rootGroup && (
              <>
                <Button onClick={handleAddInputBoundary} variant="outline">
                  Add Input
                </Button>
                <Button onClick={handleAddOutputBoundary} variant="outline">
                  Add Output
                </Button>
              </>
            )}
          </div>
        </Panel>

        <Panel position="bottom-left" className="m-2">
          <ToolsMenu
            viewSettings={viewSettings}
            onViewSettingsChange={setViewSettings}
            onOpenConfiguration={() => setShowConfiguration(true)}
            onAutoLayout={handleAutoLayout}
            onOpenGadgets={() => setShowDreamsGadgetMenu(true)}
          />
        </Panel>

        {/* Proximity connection indicator */}
        {proximity.potentialEdge && (
          <div className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1000 }}>
            {/* React Flow will handle the actual edge preview */}
          </div>
        )}
      </ReactFlow>
    </div>

    {palette.isVisible && (
        <GadgetPalette
          items={palette.items}
          categories={palette.categories}
          isVisible={palette.isVisible}
          onToggleVisibility={palette.toggleVisibility}
          onRemoveItem={palette.removeFromPalette}
          onUseItem={(itemId) => {
            const item = palette.items.find(i => i.id === itemId);
            if (item) {
              const position = { x: 100, y: 100 };
              instantiateTemplate(item, position);
              palette.incrementUsageCount(itemId);
            }
          }}
          getItemsByCategory={palette.getItemsByCategory}
          getMostUsed={palette.getMostUsed}
          getRecent={palette.getRecent}
        />
      )}

      {propertyPanel.isVisible && (
        <PropertyPanel
          isVisible={propertyPanel.isVisible}
          onToggleVisibility={propertyPanel.toggleVisibility}
          shouldFocus={propertyPanel.shouldFocus}
        />
      )}

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

      {showDreamsGadgetMenu && (
        <InlineGadgetMenu
          isOpen={showDreamsGadgetMenu}
          onClose={() => setShowDreamsGadgetMenu(false)}
          items={palette.items}
          categories={palette.categories}
          onUseItem={(itemId) => {
            const item = palette.items.find(i => i.id === itemId);
            if (item) {
              const position = { x: 100, y: 100 };
              instantiateTemplate(item, position);
              palette.incrementUsageCount(itemId);
              setShowDreamsGadgetMenu(false);
            }
          }}
          getItemsByCategory={palette.getItemsByCategory}
        />
      )}
    </>
  );
}

export default function EditorWithBassline() {
  const { template, basslineName } = useLoaderData<typeof loader>();
  
  // Create network from template
  const network = useMemo(() => {
    if (template) {
      return PropagationNetwork.fromTemplate(template);
    }
    return new PropagationNetwork();
  }, [template]);
  
  useEffect(() => {
    if (template) {
      toast.success(`Loaded bassline: ${basslineName}`);
    }
  }, [template, basslineName]);
  
  return (
    <SoundSystemProvider>
      <div className="h-screen w-screen bg-slate-50">
        <NetworkProvider initialNetwork={network} key={basslineName} skipDefaultContent={true}>
          <ReactFlowProvider>
            <ClientOnly fallback={<div>Loading...</div>}>
              <Flow basslineName={basslineName || 'untitled'} />
            </ClientOnly>
          </ReactFlowProvider>
        </NetworkProvider>
      </div>
    </SoundSystemProvider>
  );
}