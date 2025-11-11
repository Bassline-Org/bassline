# Layered Control UI Architecture Plan

**Goal**: Build a composable, interactive panel-based UI for LayeredControl with minimal, well-composing primitives.

**Philosophy**: Panels are **interactive affordances**, not just visualizations. You manipulate the system visually and directly.

---

## Architecture Overview

### Core Primitives

1. **LayeredControl** - The single source of truth (data structure)
2. **Panels** - Interactive, functional components operating on data
3. **Layouts** - Compositions of panels (saved/loaded as UI state)
4. **Hooks** - Minimal reactive bindings using `useSyncExternalStore`

### Key Principles

- **Interactive, not just visual** - Plugboard lets you rewire, history lets you branch, REPL lets you execute
- **Composable** - Panels work independently, compose into layouts
- **Minimal** - Fewer hooks, better composition
- **Testable** - Each stage can be verified in the UI before moving forward

---

## Stage 1: Make LayeredControl Reactive

### Goal
Add EventTarget to LayeredControl so React can subscribe to all mutations.

### Files Modified
- `packages/parser/src/control.js`

### Changes

**Make LayeredControl extend EventTarget:**

```javascript
export class LayeredControl extends EventTarget {
  constructor() {
    super();
    this.layers = {};
    this.quadStore = new Graph();
    this.refs = {};
  }
}
```

**Emit events for all mutations:**

| Method | Event | Detail |
|--------|-------|--------|
| `addLayer(name)` | `layer-added` | `{ name }` |
| `removeLayer(name)` | `layer-removed` | `{ name }` |
| `addBus(name)` | `bus-added` | `{ name }` |
| `route(from, to)` | `routing-changed` | `{ from, to }` |
| `commit(name, msg)` | `committed` | `{ name, commitHash, message }` |
| `restore(name, hash)` | `restored` | `{ name, commitHash }` |
| `createBranch(layer, branch)` | `branch-created` | `{ layerName, branchName, commitHash }` |
| `switchBranch(layer, branch)` | `branch-switched` | `{ layerName, branchName, commitHash }` |
| `deleteBranch(layer, branch)` | `branch-deleted` | `{ layerName, branchName }` |
| `detachHead(layer, hash)` | `head-detached` | `{ layerName, commitHash }` |

**Example implementation:**

```javascript
addLayer(name) {
  if (this.layers[name]) {
    throw new Error("Must remove the layer before adding a new layer!");
  }
  const control = new Control();
  this.layers[name] = {
    control,
    staging: new Set(),
    commits: new Map(),
    head: null,
    currentBranch: null,
  };
  control.listen((quad) => {
    const layer = this.layers[name];
    layer.staging.add(quad.hash());
    this.quadStore.add(quad);
  });

  // EMIT EVENT
  this.dispatchEvent(new CustomEvent("layer-added", {
    detail: { name }
  }));

  return control;
}

commit(name, message = "") {
  const layer = this.layers[name];
  if (!layer) throw new Error(`Layer not found: ${name}`);

  const quadHashes = Array.from(layer.staging);
  if (quadHashes.length === 0) {
    return layer.head;
  }

  // ... existing commit logic ...

  // EMIT EVENT
  this.dispatchEvent(new CustomEvent("committed", {
    detail: { name, commitHash, message }
  }));

  return commitHash;
}
```

### Testing

**Test file: `packages/parser/test/reactive-layered-control.test.js`**

```javascript
import { describe, it, expect } from "vitest";
import { LayeredControl } from "../src/control.js";

describe("Reactive LayeredControl", () => {
  it("should emit layer-added event", () => {
    const lc = new LayeredControl();
    let emitted = false;

    lc.addEventListener("layer-added", (e) => {
      expect(e.detail.name).toBe("foo");
      emitted = true;
    });

    lc.addLayer("foo");
    expect(emitted).toBe(true);
  });

  it("should emit committed event", () => {
    const lc = new LayeredControl();
    const layer = lc.addLayer("foo");

    let emitted = false;
    lc.addEventListener("committed", (e) => {
      expect(e.detail.name).toBe("foo");
      expect(e.detail.commitHash).toBeDefined();
      expect(e.detail.message).toBe("test commit");
      emitted = true;
    });

    layer.run("insert { alice age 30 * }");
    lc.commit("foo", "test commit");

    expect(emitted).toBe(true);
  });

  it("should emit routing-changed event", () => {
    const lc = new LayeredControl();
    lc.addLayer("foo");
    lc.addLayer("bar");

    let emitted = false;
    lc.addEventListener("routing-changed", (e) => {
      expect(e.detail.from).toBe("foo");
      expect(e.detail.to).toBe("bar");
      emitted = true;
    });

    lc.route("foo", "bar");
    expect(emitted).toBe(true);
  });

  // Add tests for all other events...
});
```

**Manual UI test:**
```javascript
// In browser console or demo component
const lc = new LayeredControl();

lc.addEventListener("layer-added", (e) => {
  console.log("Layer added:", e.detail);
});

lc.addLayer("test");
// Should log: "Layer added: { name: 'test' }"
```

### Success Criteria

✅ All LayeredControl mutations emit events
✅ Tests pass for all event types
✅ Events contain correct detail payloads
✅ No breaking changes to existing LayeredControl API

---

## Stage 2: Core React Hooks

### Goal
Build minimal reactive hooks using `useSyncExternalStore` to subscribe to LayeredControl events.

### Files Created
- `packages/parser-react/src/hooks/useLayeredControl.js`
- `packages/parser-react/src/hooks/index.js`

### Hook Implementations

#### 1. Provider & Core Access

```javascript
// useLayeredControl.js
import { createContext, useContext, useSyncExternalStore } from "react";

const LayeredControlContext = createContext(null);

export function LayeredControlProvider({ value, children }) {
  return (
    <LayeredControlContext.Provider value={value}>
      {children}
    </LayeredControlContext.Provider>
  );
}

export function useLayeredControl() {
  const lc = useContext(LayeredControlContext);
  if (!lc) {
    throw new Error("useLayeredControl must be used within LayeredControlProvider");
  }
  return lc;
}

export function useLayer(name) {
  const lc = useLayeredControl();
  const layer = lc.getLayer(name);
  if (!layer) {
    throw new Error(`Layer not found: ${name}`);
  }
  return layer.control;
}
```

#### 2. Reactive List Hooks

```javascript
export function useLayers() {
  const lc = useLayeredControl();

  return useSyncExternalStore(
    (callback) => {
      lc.addEventListener("layer-added", callback);
      lc.addEventListener("layer-removed", callback);
      lc.addEventListener("bus-added", callback);

      return () => {
        lc.removeEventListener("layer-added", callback);
        lc.removeEventListener("layer-removed", callback);
        lc.removeEventListener("bus-added", callback);
      };
    },
    () => Object.keys(lc.layers)
  );
}

export function useRouting() {
  const lc = useLayeredControl();

  return useSyncExternalStore(
    (callback) => {
      lc.addEventListener("routing-changed", callback);
      return () => lc.removeEventListener("routing-changed", callback);
    },
    () => {
      const routes = [];
      for (const [name, layer] of Object.entries(lc.layers)) {
        if (layer.output) {
          routes.push({ from: name, to: layer.output });
        }
      }
      return routes;
    }
  );
}
```

#### 3. Layer-Specific Hooks

```javascript
export function useLayerQuads(layerName) {
  const lc = useLayeredControl();
  const layer = lc.getLayer(layerName);

  if (!layer?.control) {
    throw new Error(`Layer not found: ${layerName}`);
  }

  return useSyncExternalStore(
    (callback) => {
      const cleanup = layer.control.listen(callback);
      return cleanup;
    },
    () => layer.control.graph.quads
  );
}

export function useStaging(layerName) {
  const lc = useLayeredControl();

  return useSyncExternalStore(
    (callback) => {
      // Staging changes when quads are added
      const layer = lc.getLayer(layerName);
      if (!layer?.control) return () => {};

      const cleanup = layer.control.listen(callback);
      return cleanup;
    },
    () => {
      const layer = lc.getLayer(layerName);
      return {
        count: layer?.staging?.size ?? 0,
        hasChanges: (layer?.staging?.size ?? 0) > 0
      };
    }
  );
}

export function useCommits(layerName) {
  const lc = useLayeredControl();

  return useSyncExternalStore(
    (callback) => {
      const handler = (e) => {
        if (e.detail.name === layerName || e.detail.layerName === layerName) {
          callback();
        }
      };

      lc.addEventListener("committed", handler);
      lc.addEventListener("restored", handler);
      lc.addEventListener("branch-switched", handler);

      return () => {
        lc.removeEventListener("committed", handler);
        lc.removeEventListener("restored", handler);
        lc.removeEventListener("branch-switched", handler);
      };
    },
    () => lc.getCommitHistory(layerName, 20)
  );
}

export function useBranches(layerName) {
  const lc = useLayeredControl();

  return useSyncExternalStore(
    (callback) => {
      const handler = (e) => {
        if (e.detail.layerName === layerName) callback();
      };

      lc.addEventListener("branch-created", handler);
      lc.addEventListener("branch-deleted", handler);
      lc.addEventListener("branch-switched", handler);

      return () => {
        lc.removeEventListener("branch-created", handler);
        lc.removeEventListener("branch-deleted", handler);
        lc.removeEventListener("branch-switched", handler);
      };
    },
    () => ({
      branches: lc.listBranches(layerName),
      current: lc.getCurrentBranch(layerName)
    })
  );
}
```

### Complete Hook API

**8 hooks total:**

| Hook | Returns | Reactive To |
|------|---------|-------------|
| `useLayeredControl()` | LayeredControl instance | N/A (context) |
| `useLayer(name)` | Control instance | N/A (direct access) |
| `useLayers()` | `string[]` | layer-added, layer-removed, bus-added |
| `useRouting()` | `{from, to}[]` | routing-changed |
| `useLayerQuads(name)` | `Quad[]` | quad-added (via control.listen) |
| `useStaging(name)` | `{count, hasChanges}` | quad-added (staging updates) |
| `useCommits(name)` | `Commit[]` | committed, restored, branch-switched |
| `useBranches(name)` | `{branches, current}` | branch-created, branch-deleted, branch-switched |

### Testing

**Test file: `packages/parser-react/test/hooks.test.jsx`**

```javascript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { LayeredControl } from "@bassline/parser/control";
import {
  LayeredControlProvider,
  useLayeredControl,
  useLayers,
  useRouting,
  useStaging
} from "../src/hooks";

describe("Hooks", () => {
  it("useLayeredControl returns instance", () => {
    const lc = new LayeredControl();
    const wrapper = ({ children }) => (
      <LayeredControlProvider value={lc}>{children}</LayeredControlProvider>
    );

    const { result } = renderHook(() => useLayeredControl(), { wrapper });
    expect(result.current).toBe(lc);
  });

  it("useLayers reacts to layer additions", () => {
    const lc = new LayeredControl();
    const wrapper = ({ children }) => (
      <LayeredControlProvider value={lc}>{children}</LayeredControlProvider>
    );

    const { result } = renderHook(() => useLayers(), { wrapper });
    expect(result.current).toEqual([]);

    act(() => {
      lc.addLayer("foo");
    });

    expect(result.current).toEqual(["foo"]);

    act(() => {
      lc.addLayer("bar");
    });

    expect(result.current).toEqual(["foo", "bar"]);
  });

  it("useRouting reacts to routing changes", () => {
    const lc = new LayeredControl();
    lc.addLayer("foo");
    lc.addLayer("bar");

    const wrapper = ({ children }) => (
      <LayeredControlProvider value={lc}>{children}</LayeredControlProvider>
    );

    const { result } = renderHook(() => useRouting(), { wrapper });
    expect(result.current).toEqual([]);

    act(() => {
      lc.route("foo", "bar");
    });

    expect(result.current).toEqual([{ from: "foo", to: "bar" }]);
  });

  // Add tests for all hooks...
});
```

**Manual UI test component:**

```jsx
// packages/parser-react/examples/HookDemo.jsx
import { LayeredControl } from "@bassline/parser/control";
import {
  LayeredControlProvider,
  useLayers,
  useRouting,
  useStaging
} from "../src/hooks";

const lc = new LayeredControl();

function Demo() {
  const layers = useLayers();
  const routing = useRouting();
  const staging = useStaging("test");

  return (
    <div>
      <h2>Layers: {layers.join(", ")}</h2>
      <h2>Routing: {JSON.stringify(routing)}</h2>
      <h2>Staging: {staging.count} changes</h2>

      <button onClick={() => lc.addLayer("test")}>Add Layer</button>
      <button onClick={() => {
        const layer = lc.getLayer("test")?.control;
        layer?.run("insert { alice age 30 * }");
      }}>Add Quad</button>
    </div>
  );
}

export default function HookDemo() {
  return (
    <LayeredControlProvider value={lc}>
      <Demo />
    </LayeredControlProvider>
  );
}
```

### Success Criteria

✅ All 8 hooks implemented with useSyncExternalStore
✅ Unit tests pass for all hooks
✅ Manual UI demo shows reactive updates
✅ No unnecessary re-renders (verified with React DevTools)

---

## Stage 3: Layer List Panel (Simple Interactive)

### Goal
Build the simplest interactive panel - a list of layers with add/remove actions.

### Files Created
- `packages/parser-react/src/panels/LayerListPanel.jsx`
- `packages/parser-react/src/panels/index.js`

### Implementation

```jsx
// LayerListPanel.jsx
import { useState } from "react";
import { useLayeredControl, useLayers, useBranches, useStaging } from "../hooks";

export function LayerListPanel({ groups = {} }) {
  const lc = useLayeredControl();
  const layers = useLayers();
  const [newLayerName, setNewLayerName] = useState("");

  const handleAddLayer = () => {
    if (newLayerName.trim()) {
      lc.addLayer(newLayerName);
      setNewLayerName("");
    }
  };

  const handleRemoveLayer = (name) => {
    if (confirm(`Remove layer "${name}"?`)) {
      lc.removeLayer(name);
    }
  };

  return (
    <div className="layer-list-panel">
      <h3>Layers</h3>

      <div className="layer-list">
        {layers.map(name => (
          <LayerItem
            key={name}
            name={name}
            onRemove={() => handleRemoveLayer(name)}
          />
        ))}
      </div>

      <div className="add-layer">
        <input
          value={newLayerName}
          onChange={(e) => setNewLayerName(e.target.value)}
          placeholder="Layer name"
          onKeyDown={(e) => e.key === "Enter" && handleAddLayer()}
        />
        <button onClick={handleAddLayer}>Add Layer</button>
      </div>
    </div>
  );
}

function LayerItem({ name, onRemove }) {
  const staging = useStaging(name);
  const branches = useBranches(name);

  return (
    <div className="layer-item">
      <span className="layer-name">{name}</span>
      {branches.current && (
        <span className="branch-badge">{branches.current}</span>
      )}
      {staging.hasChanges && (
        <span className="staging-badge">{staging.count} staged</span>
      )}
      <button onClick={onRemove}>Remove</button>
    </div>
  );
}
```

### Testing

**Manual UI test:**

```jsx
// In app
import { LayeredControl } from "@bassline/parser/control";
import { LayeredControlProvider } from "@bassline/parser-react/hooks";
import { LayerListPanel } from "@bassline/parser-react/panels";

const lc = new LayeredControl();

function App() {
  return (
    <LayeredControlProvider value={lc}>
      <LayerListPanel />
    </LayeredControlProvider>
  );
}
```

**Test cases:**
1. Add layer via input → layer appears in list
2. Add quads to layer → staging badge updates
3. Commit layer → staging badge disappears
4. Create branch → branch badge appears
5. Remove layer → layer disappears from list

### Success Criteria

✅ Can add/remove layers interactively
✅ Staging count updates reactively
✅ Branch name displays when on branch
✅ UI updates without manual refresh

---

## Stage 4: REPL Panel (Layer Interaction)

### Goal
Build interactive text-based panel for running commands on a layer.

### Files Created
- `packages/parser-react/src/panels/ReplPanel.jsx`

### Implementation

```jsx
// ReplPanel.jsx
import { useState, useRef, useEffect } from "react";
import { useLayer, useLayerQuads } from "../hooks";

export function ReplPanel({ layerName }) {
  const layer = useLayer(layerName);
  const quads = useLayerQuads(layerName);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const outputRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const handleExecute = () => {
    if (!input.trim()) return;

    try {
      const result = layer.run(input);
      setHistory([
        ...history,
        { type: "input", content: input },
        { type: "output", content: formatResult(result) }
      ]);
    } catch (err) {
      setHistory([
        ...history,
        { type: "input", content: input },
        { type: "error", content: err.message }
      ]);
    }

    setInput("");
  };

  return (
    <div className="repl-panel">
      <div className="repl-header">
        <h3>REPL: {layerName}</h3>
        <span className="quad-count">{quads.length} quads</span>
      </div>

      <div className="repl-output" ref={outputRef}>
        {history.map((entry, i) => (
          <div key={i} className={`repl-entry ${entry.type}`}>
            {entry.type === "input" && <span className="prompt">&gt; </span>}
            <span>{entry.content}</span>
          </div>
        ))}
      </div>

      <div className="repl-input">
        <span className="prompt">&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleExecute()}
          placeholder="Enter command..."
        />
        <button onClick={handleExecute}>Run</button>
      </div>
    </div>
  );
}

function formatResult(result) {
  if (Array.isArray(result)) {
    if (result.length === 0) return "No results";
    if (result[0] instanceof Map) {
      // Query results
      return result.map(m => {
        const entries = Array.from(m.entries());
        return entries.map(([k, v]) => `${k}=${v}`).join(" ");
      }).join("\n");
    }
  }
  return JSON.stringify(result, null, 2);
}
```

### Testing

**Test cases:**
1. Run `insert { alice age 30 * }` → quad count increases
2. Run `query where { ?s ?a ?t * }` → shows query results
3. Run invalid command → shows error message
4. Add multiple commands → history shows all entries
5. Quad count badge updates reactively

### Success Criteria

✅ Can execute commands on layer
✅ Results display correctly
✅ Errors are handled gracefully
✅ History persists during session
✅ Quad count updates reactively

---

## Stage 5: Plugboard Panel (Interactive Routing)

### Goal
Build visual routing diagram with React Flow that allows interactive rewiring.

### Files Created
- `packages/parser-react/src/panels/PlugboardPanel.jsx`
- `packages/parser-react/src/utils/layoutLayers.js`

### Implementation

```jsx
// PlugboardPanel.jsx
import { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useLayeredControl, useLayers, useRouting } from "../hooks";
import { layoutLayers } from "../utils/layoutLayers";

export function PlugboardPanel() {
  const lc = useLayeredControl();
  const layers = useLayers();
  const routing = useRouting();

  // Convert layers + routing to React Flow format
  const { nodes: initialNodes, edges: initialEdges } = layersToFlow(
    layers,
    routing,
    lc
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update when layers/routing change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = layersToFlow(layers, routing, lc);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [layers, routing]);

  // INTERACTIVE: Connect layers by drawing edges
  const onConnect = useCallback((connection) => {
    const sourceLayer = connection.source;
    const targetLayer = connection.target;

    // Actually route in LayeredControl
    lc.route(sourceLayer, targetLayer);

    // React Flow will update via useRouting hook
  }, [lc]);

  // INTERACTIVE: Remove routing by deleting edges
  const onEdgesDelete = useCallback((edgesToDelete) => {
    edgesToDelete.forEach(edge => {
      const sourceLayer = edge.source;
      const layer = lc.getLayer(sourceLayer);

      // Remove routing
      if (layer?.output) {
        layer.output = null;
        layer.cleanup?.();
        lc.dispatchEvent(new CustomEvent("routing-changed", {
          detail: { from: sourceLayer, to: null }
        }));
      }
    });
  }, [lc]);

  return (
    <div className="plugboard-panel" style={{ height: "100%", width: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function layersToFlow(layers, routing, lc) {
  const nodes = layers.map((name, i) => {
    const layer = lc.getLayer(name);
    const isBus = !!layer?.bus;
    const quadCount = layer?.control?.graph?.quads?.length ?? 0;

    return {
      id: name,
      type: isBus ? "bus" : "layer",
      position: layoutLayers(layers, routing)[i],
      data: {
        label: name,
        isBus,
        quadCount,
        hasStaging: (layer?.staging?.size ?? 0) > 0,
        branch: layer?.currentBranch ?? null
      }
    };
  });

  const edges = routing.map(({ from, to }) => ({
    id: `${from}-${to}`,
    source: from,
    target: to,
    animated: true,
    style: { stroke: "#555", strokeWidth: 2 }
  }));

  return { nodes, edges };
}
```

**Custom Node Types:**

```jsx
// LayerNode.jsx
export function LayerNode({ data }) {
  return (
    <div className="layer-node">
      <Handle type="target" position="left" />

      <div className="node-header">
        <span className="node-name">{data.label}</span>
        {data.branch && <span className="branch-badge">{data.branch}</span>}
      </div>

      <div className="node-body">
        <span className="quad-count">{data.quadCount} quads</span>
        {data.hasStaging && <span className="staging-indicator">●</span>}
      </div>

      <Handle type="source" position="right" />
    </div>
  );
}

// BusNode.jsx
export function BusNode({ data }) {
  return (
    <div className="bus-node">
      <Handle type="target" position="left" />
      <div className="bus-icon">⊙</div>
      <span className="bus-name">{data.label}</span>
      <Handle type="source" position="right" />
    </div>
  );
}
```

**Layout Helper:**

```javascript
// layoutLayers.js
export function layoutLayers(layers, routing) {
  // Simple force-directed layout or dagre
  // For now, just vertical stack with 100px spacing
  return layers.map((_, i) => ({ x: 200, y: i * 100 }));

  // TODO: Use dagre for better automatic layout:
  // - Layers with no inputs on left
  // - Layers with outputs flow left-to-right
  // - Buses in middle
}
```

### Testing

**Test cases:**
1. Drag from layer output → layer input → creates route
2. Routing updates in LayeredControl
3. Delete edge → removes route
4. Add layer via LayerListPanel → appears in plugboard
5. Add quads → node shows updated quad count
6. Commit → staging indicator disappears

### Success Criteria

✅ Visual routing diagram with nodes for layers/buses
✅ Can connect layers by drawing edges
✅ Can disconnect by deleting edges
✅ Node data updates reactively (quad count, staging, branch)
✅ Layout updates when layers added/removed

---

## Stage 6: Staging & Commit Panel

### Goal
Interactive panel for viewing staged changes and committing with messages.

### Files Created
- `packages/parser-react/src/panels/StagingPanel.jsx`

### Implementation

```jsx
// StagingPanel.jsx
import { useState } from "react";
import { useLayeredControl, useStaging, useLayerQuads } from "../hooks";

export function StagingPanel({ layerName }) {
  const lc = useLayeredControl();
  const staging = useStaging(layerName);
  const quads = useLayerQuads(layerName);
  const [commitMessage, setCommitMessage] = useState("");

  const handleCommit = () => {
    if (!commitMessage.trim()) {
      alert("Commit message required");
      return;
    }

    lc.commit(layerName, commitMessage);
    setCommitMessage("");
  };

  // Get staged quads (last N quads = staged)
  const stagedQuads = quads.slice(-staging.count);

  return (
    <div className="staging-panel">
      <h3>Staging: {layerName}</h3>

      <div className="staging-status">
        {staging.hasChanges ? (
          <span className="changes">{staging.count} changes staged</span>
        ) : (
          <span className="no-changes">No changes</span>
        )}
      </div>

      {staging.hasChanges && (
        <>
          <div className="staged-quads">
            <h4>Staged Changes:</h4>
            {stagedQuads.map((quad, i) => (
              <div key={i} className="staged-quad">
                {formatQuad(quad)}
              </div>
            ))}
          </div>

          <div className="commit-form">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message..."
              rows={3}
            />
            <button onClick={handleCommit}>Commit</button>
          </div>
        </>
      )}
    </div>
  );
}

function formatQuad(quad) {
  return `${quad.values[0]} ${quad.values[1]} ${quad.values[2]} ${quad.values[3]}`;
}
```

### Testing

**Test cases:**
1. Add quads → staged changes appear
2. Write commit message → enable commit button
3. Click commit → changes committed, staging clears
4. Commit message resets after commit

### Success Criteria

✅ Shows staged quad count
✅ Displays staged quads
✅ Can write commit message
✅ Commit button triggers commit
✅ Staging clears after commit

---

## Stage 7: History Panel (Interactive Git Graph)

### Goal
Visual commit history with interactive checkout, branching, and merging.

### Files Created
- `packages/parser-react/src/panels/HistoryPanel.jsx`

### Implementation

```jsx
// HistoryPanel.jsx
import { useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState
} from "@xyflow/react";
import { useLayeredControl, useCommits, useBranches } from "../hooks";

export function HistoryPanel({ layerName }) {
  const lc = useLayeredControl();
  const commits = useCommits(layerName);
  const { branches, current } = useBranches(layerName);
  const [selectedCommit, setSelectedCommit] = useState(null);

  // Convert commits to graph
  const { nodes, edges } = commitsToGraph(commits, branches, current);

  // INTERACTIVE: Click commit to show actions
  const handleNodeClick = (event, node) => {
    setSelectedCommit(node.id);
  };

  // INTERACTIVE: Checkout commit
  const handleCheckout = (commitHash) => {
    if (confirm("Checkout this commit? You'll be in detached HEAD state.")) {
      lc.detachHead(layerName, commitHash);
      setSelectedCommit(null);
    }
  };

  // INTERACTIVE: Create branch from commit
  const handleCreateBranch = (commitHash) => {
    const branchName = prompt("Branch name:");
    if (branchName) {
      lc.createBranch(layerName, branchName, commitHash);
      lc.switchBranch(layerName, branchName);
    }
  };

  // INTERACTIVE: Switch branch
  const handleSwitchBranch = (branchName) => {
    lc.switchBranch(layerName, branchName);
  };

  return (
    <div className="history-panel">
      <div className="history-header">
        <h3>History: {layerName}</h3>
        {current ? (
          <span className="current-branch">On {current}</span>
        ) : (
          <span className="detached">Detached HEAD</span>
        )}
      </div>

      <div className="branch-list">
        {branches.map(branch => (
          <button
            key={branch}
            className={branch === current ? "active" : ""}
            onClick={() => handleSwitchBranch(branch)}
          >
            {branch}
          </button>
        ))}
      </div>

      <div className="commit-graph" style={{ height: "400px" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          fitView
          nodesDraggable={false}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {selectedCommit && (
        <div className="commit-actions">
          <h4>Commit Actions</h4>
          <button onClick={() => handleCheckout(selectedCommit)}>
            Checkout
          </button>
          <button onClick={() => handleCreateBranch(selectedCommit)}>
            Branch from here
          </button>
        </div>
      )}
    </div>
  );
}

function commitsToGraph(commits, branches, currentBranch) {
  const nodes = commits.map((commit, i) => {
    // Find branches pointing to this commit
    const branchLabels = branches.filter(b => {
      // Check if branch ref points to this commit
      // (Would need to add getBranchCommit method to LC)
      return false; // TODO
    });

    return {
      id: commit.hash.toString(),
      type: "commit",
      position: { x: 100, y: i * 80 },
      data: {
        message: commit.message,
        timestamp: commit.timestamp,
        quadCount: commit.quadCount,
        branches: branchLabels,
        isCurrent: false // TODO: check if HEAD points here
      }
    };
  });

  const edges = commits
    .filter(c => c.parent !== null)
    .map(c => ({
      id: `${c.hash}-${c.parent}`,
      source: c.hash.toString(),
      target: c.parent.toString(),
      type: "smoothstep"
    }));

  return { nodes, edges };
}
```

### Testing

**Test cases:**
1. Make commits → appear in graph
2. Click commit → show action menu
3. Checkout commit → detached HEAD state
4. Create branch from commit → new branch appears
5. Switch branch → graph updates to show branch history

### Success Criteria

✅ Commit graph visualizes history
✅ Can checkout any commit interactively
✅ Can create branch from any commit
✅ Can switch between branches
✅ Current HEAD/branch highlighted

---

## Stage 8: Panel Layout System

### Goal
Composable panel system with save/load layouts.

### Files Created
- `packages/parser-react/src/layout/PanelLayout.jsx`
- `packages/parser-react/src/layout/PanelRegistry.js`
- `packages/parser-react/src/layout/useLayoutState.js`

### Implementation

```jsx
// PanelRegistry.js
import { LayerListPanel } from "../panels/LayerListPanel";
import { PlugboardPanel } from "../panels/PlugboardPanel";
import { ReplPanel } from "../panels/ReplPanel";
import { StagingPanel } from "../panels/StagingPanel";
import { HistoryPanel } from "../panels/HistoryPanel";

export const PANEL_REGISTRY = {
  "LayerListPanel": LayerListPanel,
  "PlugboardPanel": PlugboardPanel,
  "ReplPanel": ReplPanel,
  "StagingPanel": StagingPanel,
  "HistoryPanel": HistoryPanel
};
```

```jsx
// PanelLayout.jsx
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { PANEL_REGISTRY } from "./PanelRegistry";

const ResponsiveGridLayout = WidthProvider(Responsive);

export function PanelLayout({ layout, onLayoutChange, groups = {} }) {
  const { panels, gridLayout } = layout;

  return (
    <ResponsiveGridLayout
      className="panel-layout"
      layouts={{ lg: gridLayout }}
      onLayoutChange={(newLayout) => {
        onLayoutChange({ panels, gridLayout: newLayout });
      }}
      breakpoints={{ lg: 1200, md: 996, sm: 768 }}
      cols={{ lg: 12, md: 10, sm: 6 }}
      rowHeight={60}
      draggableHandle=".panel-header"
    >
      {panels.map(panel => {
        const PanelComponent = PANEL_REGISTRY[panel.type];

        return (
          <div key={panel.id} data-grid={panel.grid}>
            <div className="panel-container">
              <div className="panel-header">
                <span className="panel-title">{panel.type}</span>
                <button className="panel-close">×</button>
              </div>
              <div className="panel-content">
                <PanelComponent {...panel.props} />
              </div>
            </div>
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
```

```javascript
// useLayoutState.js
import { useState, useEffect } from "react";

export function useLayoutState(storageKey = "layeredControlLayout") {
  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : getDefaultLayout();
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(layout));
  }, [layout, storageKey]);

  const addPanel = (panelType, props = {}) => {
    const newPanel = {
      id: `${panelType}-${Date.now()}`,
      type: panelType,
      props,
      grid: { x: 0, y: Infinity, w: 6, h: 4 } // Auto-place at bottom
    };

    setLayout({
      ...layout,
      panels: [...layout.panels, newPanel]
    });
  };

  const removePanel = (panelId) => {
    setLayout({
      ...layout,
      panels: layout.panels.filter(p => p.id !== panelId)
    });
  };

  return { layout, setLayout, addPanel, removePanel };
}

function getDefaultLayout() {
  return {
    panels: [
      {
        id: "plugboard-main",
        type: "PlugboardPanel",
        props: {},
        grid: { x: 0, y: 0, w: 12, h: 6 }
      },
      {
        id: "layers-list",
        type: "LayerListPanel",
        props: {},
        grid: { x: 0, y: 6, w: 4, h: 4 }
      }
    ],
    groups: {}
  };
}
```

### Testing

**Test cases:**
1. Load default layout → plugboard + layer list
2. Drag panel → position persists
3. Add new REPL panel → appears at bottom
4. Close panel → removed from layout
5. Refresh page → layout restored from localStorage

### Success Criteria

✅ Panels can be dragged and resized
✅ Layout persists to localStorage
✅ Can add panels dynamically
✅ Can remove panels
✅ Multiple instances of same panel type (e.g., 3 REPLs for different layers)

---

## Stage 9: Integration & Polish

### Goal
Integrate everything into main app with polished UX.

### Tasks

1. **Add panel menu** - Dropdown to add any panel type with config
2. **Layer selector** - When adding layer-specific panel (REPL, History), choose layer
3. **Groups UI** - Add group management (create group, add layers to group)
4. **Keyboard shortcuts** - Common actions (add layer, commit, switch branch)
5. **Themes** - Dark/light mode for panels
6. **Panel icons** - Visual indicators for panel types
7. **Status bar** - Global status (total layers, total quads, current active layer)

### Success Criteria

✅ Fully functional multi-panel UI
✅ All interactions work smoothly
✅ Layout persists and restores correctly
✅ Performance is acceptable with multiple panels
✅ User can build custom workflows by composing panels

---

## Final Architecture Summary

### Core Components

```
packages/parser/src/
└── control.js (LayeredControl extends EventTarget)

packages/parser-react/src/
├── hooks/
│   ├── useLayeredControl.js (8 hooks)
│   └── index.js
├── panels/
│   ├── LayerListPanel.jsx
│   ├── PlugboardPanel.jsx
│   ├── ReplPanel.jsx
│   ├── StagingPanel.jsx
│   ├── HistoryPanel.jsx
│   ├── QueryPanel.jsx (TODO)
│   ├── InspectorPanel.jsx (TODO)
│   └── index.js
├── layout/
│   ├── PanelLayout.jsx
│   ├── PanelRegistry.js
│   ├── useLayoutState.js
│   └── index.js
└── index.js
```

### Data Flow

```
LayeredControl (EventTarget)
     ↓ (events)
useSyncExternalStore hooks
     ↓ (reactive data)
Panel components
     ↓ (user actions)
LayeredControl mutations
     ↓ (events)
(cycle repeats)
```

### Key Principles Maintained

✅ **Interactive, not just visual** - All panels allow direct manipulation
✅ **Composable** - Panels work independently, compose via layout system
✅ **Minimal** - 8 hooks, 7 panels, 1 layout system
✅ **Testable** - Each stage can be verified before moving to next
✅ **Reactive** - All updates flow through events + useSyncExternalStore

---

## Testing Strategy

### Unit Tests
- LayeredControl event emission
- All 8 hooks with React Testing Library
- Panel component logic

### Integration Tests
- Multi-panel interactions (e.g., add layer in list → appears in plugboard)
- Cross-panel updates (e.g., commit in staging → history updates)
- Layout persistence

### Manual Tests
- Build a project with 5+ layers
- Route layers in plugboard
- Make commits and create branches
- Switch between branches
- Rearrange panels
- Refresh and verify persistence

---

## Performance Considerations

- **useSyncExternalStore** ensures minimal re-renders
- **Event filtering** in hooks (only trigger on relevant events)
- **React Flow** uses virtualization for large graphs
- **LocalStorage** for layout (not entire LayeredControl state)

---

## Future Enhancements

- **QueryPanel** - Visualize specific query results
- **InspectorPanel** - Follow entity across layers
- **DiffPanel** - Compare two commits
- **MergePanel** - Merge branches (requires merge logic in LayeredControl)
- **TimelinePanel** - Scrub through history
- **MetricsPanel** - Performance metrics (quads/sec, pattern match times)
- **RemotePanel** - Connect to remote LayeredControl instance

---

**This plan provides incremental, testable stages while building toward a fully interactive, composable panel system for LayeredControl.**
