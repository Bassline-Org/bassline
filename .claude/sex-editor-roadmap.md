# Sex Editor Enhancement Roadmap

## Current State

The Sex Editor is a **canvas-based IDE for Bassline gadgets** built with React
Flow. We've successfully implemented:

✅ **Canvas Navigation**

- Breadcrumb navigation showing path (root › workspace › nested)
- Double-click sex nodes to navigate into nested workspaces
- Click breadcrumbs to navigate back up
- Visual indicators (↴ symbol, purple hover) for navigable sex nodes

✅ **Core Operations**

- Spawn gadgets from left sidebar
- Wire gadgets via drag-connect
- Delete nodes and edges
- Auto-layout with dagre
- Nested workspace support (operations target `currentSex` not `rootSex`)

✅ **Inspector Panel**

- Shows selected gadget state
- Quick send with smart parsing (JSON, booleans, numbers)
- Effects history (last 5 effects)
- Empty state when nothing selected

✅ **Wire Serialization**

- Dual storage pattern: refs (runtime) + names (persistence)
- `scopedWire` afterSpawn pattern: `receive()` not just `update()`
- Proper cleanup on wire deletion

## Known Bugs (Priority: URGENT)

### Bug 1: Quick Value Buttons Don't Work

**Problem**: Buttons like "0", "true", "false" don't send values to gadget

**Root Cause**:

```typescript
// Current broken code:
onClick={() => { setInputValue("0"); setTimeout(handleSend, 0); }}
```

React's setState is async, so `handleSend()` reads old value before update

**Fix**:

```typescript
onClick={() => {
    const parsed = smartParse("0");
    gadget.receive(parsed);
    setInputValue("");
}}
```

### Bug 2: Effects Don't Clear Per-Gadget

**Problem**: Effects panel shows accumulated effects from all gadgets, not just
selected one

**Root Cause**: Effects array doesn't clear when switching gadgets

**Fix**:

```typescript
useEffect(() => {
    setEffects([]); // Clear immediately on every gadget change

    if (!gadget) {
        emptyGadget.kill();
        return;
    }

    const cleanup = gadget.tap((effect: any) => {
        setEffects(
            (prev) => [...prev.slice(-4), { timestamp: Date.now(), effect }]
        );
    });

    return cleanup;
}, [gadget, emptyGadget]);
```

---

## Enhancement Phases

### Phase 1: Bug Fixes ⚡️ (URGENT)

**Time**: 15 minutes

Fix the two Inspector bugs above. These are blocking basic usability.

**Why this matters**: Quick value buttons are essential for rapid testing.
Per-gadget effects are critical for understanding what's happening.

---

### Phase 2: Command Palette 🚀 (HIGHEST IMPACT)

**Time**: 2-3 hours

**Why this is transformative**: Keyboard-first workflow is what makes a tool
feel like an IDE vs a toy. The command palette is the single most important
feature for productivity.

#### Features:

1. **Cmd+K to open** fuzzy search palette
2. **Search all packages** with real-time filtering
3. **Preview gadget metadata** (pkg, name, description)
4. **Spawn at cursor** or canvas center
5. **Recent gadgets** shown first (with timestamps)
6. **Escape to close**, Enter to spawn
7. **Arrow keys** to navigate results

#### Implementation:

```typescript
// New component: CommandPalette.tsx
interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onSpawn: (pkg: string, name: string) => void;
    packages: any;
}

// route.tsx additions:
const [isPaletteOpen, setIsPaletteOpen] = useState(false);

useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            setIsPaletteOpen(true);
        }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

#### UX Details:

- Modal overlay with blur backdrop
- Centered search input (auto-focus)
- List of results below (max 10 visible)
- Highlight matching characters
- Group by package
- Show icons for gadget types

**Priority**: #1 after bug fixes - this unlocks speed

---

### Phase 3: Keyboard Shortcuts ⌨️

**Time**: 1-2 hours

**Why this matters**: Mouse-only workflows are slow. Keyboard shortcuts = 10x
faster iteration.

#### Core Shortcuts:

- **Delete** - Delete selected node(s)/edge(s)
- **Cmd+D** - Duplicate selected node
- **Cmd+Enter** - Quick send in Inspector (focus input)
- **Escape** - Deselect all, close panels
- **Cmd+W** - Wire mode (select source, then target)
- **Cmd+L** - Auto-layout current workspace
- **Cmd+/** - Toggle inspector panel
- **Space+Drag** - Pan canvas (already works in React Flow)
- **Cmd+Plus/Minus** - Zoom in/out
- **Cmd+0** - Fit to view

#### Implementation:

```typescript
// route.tsx - add global keyboard handler
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Don't intercept when typing in inputs
        if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement
        ) {
            if (e.key === "Escape") {
                (e.target as HTMLElement).blur();
            }
            return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
            // Delete selected nodes/edges
        } else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
            e.preventDefault();
            // Duplicate selected
        } else if (e.key === "Escape") {
            // Deselect all
        }
        // ... etc
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
}, [selectedNodes, selectedEdges]);
```

**Priority**: #2 - complements command palette for full keyboard workflow

---

### Phase 4: Context Menus 🖱️

**Time**: 2-3 hours

**Why this matters**: Discoverability. New users don't know keyboard shortcuts.
Context menus reveal capabilities.

#### Node Context Menu (Right-click node):

- **Inspect** - Open in inspector
- **Send Value...** - Quick send dialog
- **Duplicate** - Copy node
- **Rename** - Edit node name inline
- **Delete** - Remove node
- **Wire to...** - Select target to wire
- **Navigate into** (sex nodes only) - Enter workspace
- **Copy Spec** - Copy JSON spec to clipboard

#### Canvas Context Menu (Right-click empty space):

- **Spawn Gadget...** - Open command palette at cursor position
- **Paste** - Paste copied spec
- **Auto-layout** - Run dagre
- **Fit to View** - Center and zoom to fit all nodes
- **New Sex Workspace** - Quick spawn sex at cursor

#### Wire Context Menu (Right-click edge):

- **Delete Wire** - Remove connection
- **Inspect Wire** - Show wire gadget in inspector

#### Implementation:

```typescript
// New component: ContextMenu.tsx
interface ContextMenuProps {
    x: number;
    y: number;
    items: Array<
        { label: string; icon?: string; onClick: () => void; divider?: boolean }
    >;
    onClose: () => void;
}

// GadgetNode.tsx - add right-click handler
const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onShowContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
            { label: "Inspect", icon: "🔍", onClick: () => onSelect(name) },
            {
                label: "Send Value...",
                icon: "📤",
                onClick: () => showSendDialog(),
            },
            { divider: true },
            {
                label: "Duplicate",
                icon: "📋",
                onClick: () => onDuplicate(name),
            },
            { label: "Rename", icon: "✏️", onClick: () => startRename() },
            { divider: true },
            { label: "Delete", icon: "🗑️", onClick: () => onDelete(name) },
        ],
    });
};
```

**Priority**: #3 - enhances discoverability and onboarding

---

### Phase 5: Left Sidebar Redesign 📚

**Time**: 3-4 hours

**Why this matters**: Current sidebar is a flat list. As packages grow,
navigation becomes painful.

#### Features:

1. **Collapsible package groups** (expand/collapse)
2. **Search/filter** within sidebar
3. **Favorites** star gadgets for quick access
4. **Recent** section showing last 10 spawned
5. **Icons** per gadget type (cell, function, system, etc.)
6. **Tooltips** showing pkg + description on hover

#### Layout:

```
┌─────────────────┐
│ 🔍 Search...    │
├─────────────────┤
│ ⭐ Favorites    │
│   • max         │
│   • sex         │
├─────────────────┤
│ 🕒 Recent       │
│   • union       │
│   • counter     │
├─────────────────┤
│ ▼ @bassline/cells
│   📊 max        │
│   📊 min        │
│   📊 union      │
├─────────────────┤
│ ▼ @bassline/systems
│   🎯 sex        │
│   🎯 compound   │
└─────────────────┘
```

**Priority**: #4 - improves organization but not critical yet

---

### Phase 6: Canvas Polish 🎨

**Time**: 2-3 hours

**Why this matters**: Professional feel. Little things add up to create
delightful experience.

#### Enhancements:

1. **Minimap** (React Flow built-in) - show overview in corner
2. **Controls panel** (React Flow built-in) - zoom buttons, fit view
3. **Background grid** with snap-to-grid option
4. **Smooth animations** on spawn/delete
5. **Node shadows** that respond to selection
6. **Connection preview** while dragging
7. **Port indicators** on hover (which handles connect where)
8. **Loading states** for async operations
9. **Undo/Redo** (Cmd+Z/Cmd+Shift+Z) - track action history

#### Mini-enhancements:

- Show gadget type badge (Cell, Function, System, etc.)
- Color-code nodes by package
- Pulse animation on state change
- Connection strength visualization (how many effects flowing?)

**Priority**: #5 - polish after functionality is solid

---

### Phase 7: Smart Wire Creation 🔗

**Time**: 2-3 hours

**Why this matters**: Right now wiring is manual. We can infer connections.

#### Features:

1. **Auto-wire on spawn** - if one node selected, offer to wire to it
2. **Wire suggestions** - highlight compatible targets when dragging
3. **Multi-wire** - select multiple sources, one target (or vice versa)
4. **Wire templates** - save common patterns (e.g., "sync two max cells")
5. **Quick wire mode** (Cmd+W) - click source, click target, done

#### Smart Patterns:

```typescript
// When spawning near another node:
"Wire new gadget to selected node?"
[Wire as Source] [Wire as Target] [No Wire]

// When selecting two nodes:
Cmd+W hotkey → wire first to second
```

**Priority**: #6 - quality of life improvement

---

### Phase 8: Visual Enhancements 🌟

**Time**: 3-4 hours

**Why this matters**: Understanding system behavior at a glance.

#### Features:

1. **Effect flow animation** - pulse along edges when effects fire
2. **State diff visualization** - highlight what changed in state preview
3. **Tap count badges** - show number of active taps on a gadget
4. **Error indicators** - red border if gadget throws
5. **Performance overlay** - show effect frequency (msgs/sec)
6. **Time travel mode** - scrub through history (requires trace gadget)

#### Advanced Visualizations:

- **Heat map** - color nodes by activity (hot = many effects)
- **Connection thickness** - thicker = more data flowing
- **Gadget health** - green (active), yellow (idle), red (error)

**Priority**: #7 - after core workflow is polished

---

## Additional Features (Future)

### Multi-selection Operations

- Select multiple nodes → batch operations
- Group into new sex workspace
- Export as package definition

### Collaboration Features

- Export workspace as JSON
- Import workspace from JSON/URL
- Share via link (encode in URL)

### Persistence

- Auto-save to localStorage
- Named workspaces
- Version history per workspace

### Developer Tools

- Console panel (below canvas) showing all effects
- Profiler showing bottlenecks
- Debugger with breakpoints on effects

### Mobile Support

- Touch gestures for pan/zoom
- Simplified UI for mobile
- Read-only "viewer" mode

---

## Technical Debt

### Code Organization

- Extract components from route.tsx into `/components`
- Shared types in `types.ts`
- Utility functions in `utils.ts`

### Performance

- Memoize expensive computations
- Virtualize sidebar list (react-window)
- Debounce layout recalculations

### Testing

- Unit tests for smart parsing
- Integration tests for wire creation
- E2E tests for navigation flow

---

## Success Metrics

### Usability

- **Spawn time**: Cmd+K → type → Enter < 2 seconds
- **Wire time**: < 3 seconds per connection
- **Navigation**: < 1 second to enter/exit workspace

### Discoverability

- New user can create first gadget in < 30 seconds
- All features discoverable via UI (context menus, tooltips)

### Stability

- Zero runtime errors in normal operation
- Proper cleanup (no memory leaks)
- Graceful degradation (if package missing, show placeholder)

---

## Implementation Priority

### Sprint 1: Foundation (Week 1)

1. ✅ ~~Sex navigation with breadcrumbs~~
2. ✅ ~~Wire serialization~~
3. ⚡️ **Fix Inspector bugs** (URGENT)
4. 🚀 **Command Palette** (Cmd+K)
5. ⌨️ **Keyboard shortcuts**

### Sprint 2: Discoverability (Week 2)

6. 🖱️ **Context menus**
7. 📚 **Sidebar redesign**
8. 🎨 **Canvas polish** (minimap, controls, grid)

### Sprint 3: Intelligence (Week 3)

9. 🔗 **Smart wire creation**
10. 🌟 **Visual enhancements** (effect flow, state diff)
11. ⏮️ **Undo/redo**

### Sprint 4: Scale (Week 4)

12. 📦 **Multi-selection operations**
13. 💾 **Persistence** (localStorage, import/export)
14. 🔧 **Developer tools** (console, profiler)

---

## What Makes This "Next Level"?

### 1. Keyboard-First Workflow

Most graph editors are mouse-heavy. Command Palette + keyboard shortcuts = **10x
faster** for power users.

### 2. Nested Workspaces

No other graph editor lets you **navigate inside nodes**. This enables fractal
complexity without visual clutter.

### 3. Live System Introspection

Tapping into effects + real-time state = **see the system thinking**. Like
Chrome DevTools but for propagation networks.

### 4. Meta-Circular Power

Because gadgets describe gadgets, we can **export any workspace as a reusable
package**. The IDE becomes a package factory.

### 5. Semantic Openness

We don't prescribe communication patterns. Users can wire however they want.
This flexibility is **unique** in graph editors.

### 6. Fire-and-Forget Simplicity

No await, no promises, no callbacks. Just `receive()` and `tap()`. This
simplicity enables **composition at massive scale**.

---

---

## Phase 9: Quick Wins ⚡ (NEW - High Impact, Low Effort)

These features deliver massive productivity boosts with minimal implementation
time.

### ✅ Undo/Redo (Cmd+Z / Cmd+Shift+Z) - COMPLETED

**Time**: 2-3 hours **Impact**: MASSIVE - mistakes become recoverable

**Implementation**:

```typescript
// route.tsx - Add history stack
const historyStackCell = useMemo(() =>
    fromSpec({
        pkg: "@bassline/cells/unsafe",
        name: "last",
        state: [], // Array of stateSpecs
    }), []);

const [historyStack] = historyStackCell.useState();
const [historyIndex, setHistoryIndex] = useState(0);

// Before each action, capture snapshot
const captureSnapshot = () => {
    const spec = currentSex.stateSpec();
    const newStack = historyStack.slice(0, historyIndex + 1);
    newStack.push(spec);
    historyStackCell.receive(newStack);
    setHistoryIndex(newStack.length - 1);
};

// Cmd+Z: rollback
const handleUndo = () => {
    if (historyIndex > 0) {
        const prevSpec = historyStack[historyIndex - 1];
        currentSex.receive(prevSpec);
        setHistoryIndex(historyIndex - 1);
    }
};

// Cmd+Shift+Z: redo
const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
        const nextSpec = historyStack[historyIndex + 1];
        currentSex.receive(nextSpec);
        setHistoryIndex(historyIndex + 1);
    }
};
```

**Why this matters**: Experimentation becomes safe. Users can try risky
operations knowing they can undo.

---

### ✅ Copy/Paste (Cmd+C / Cmd+V) - COMPLETED

**Time**: 1-2 hours **Impact**: HIGH - enables "gadget library" workflow

**Implementation**:

```typescript
// route.tsx - Add copy/paste handlers
const handleCopy = () => {
    const selectedNodes = canvasRef.current?.getSelectedNodes() || [];
    const specs = selectedNodes
        .filter((n) => !n.data?.["isWire"])
        .map((n) => n.data?.["gadget"]?.toSpec());

    navigator.clipboard.writeText(JSON.stringify(specs, null, 2));
};

const handlePaste = async () => {
    try {
        const text = await navigator.clipboard.readText();
        const specs = JSON.parse(text);

        // Spawn with unique names
        (Array.isArray(specs) ? specs : [specs]).forEach((spec) => {
            const baseName = spec.name;
            let name = baseName;
            let counter = 1;
            while (workspace[name]) {
                name = `${baseName}_${counter++}`;
            }
            currentSex.receive([["spawn", name, spec]]);
        });
    } catch (e) {
        console.error("Paste failed:", e);
    }
};
```

**Why this matters**: Copy patterns between workspaces. Build "gadget libraries"
to paste from.

---

### ✅ Multi-Workspace Tabs (Cmd+T / Cmd+W / Cmd+1-9) - COMPLETED

**Time**: 2-3 hours **Impact**: MASSIVE - enables pattern libraries and
multi-project workflows

**Implementation**:

```typescript
// route.tsx - Workspace state
interface Workspace {
    id: string;
    name: string;
    sexCell: any;
}

const [workspaces, setWorkspaces] = useState<Workspace[]>([...]);
const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');

// Tab management
const handleNewTab = () => {
    const id = `workspace-${Date.now()}`;
    const initialSex = fromSpec({ pkg: "@bassline/systems", name: "sex", state: [] });
    const sexCell = fromSpec({ pkg: "@bassline/cells/unsafe", name: "last", state: initialSex });
    setWorkspaces([...workspaces, { id, name: `Workspace ${workspaces.length + 1}`, sexCell }]);
    setActiveWorkspaceId(id);
};

const handleCloseTab = (tabId: string) => {
    if (workspaces.length === 1) return alert("Cannot close the last workspace");
    if (!confirm("Close this workspace? Unsaved changes will be lost.")) return;

    const newWorkspaces = workspaces.filter(w => w.id !== tabId);
    setWorkspaces(newWorkspaces);
    if (tabId === activeWorkspaceId) {
        setActiveWorkspaceId(newWorkspaces[0]!.id);
    }
};

// Persistence - auto-save to localStorage
useEffect(() => {
    const timeoutId = setTimeout(() => {
        const workspacesData = workspaces.map(ws => ({
            id: ws.id,
            name: ws.name,
            spec: ws.sexCell.current().toSpec(),
        }));
        localStorage.setItem("bassline-workspaces", JSON.stringify({
            workspaces: workspacesData,
            activeWorkspaceId,
        }));
    }, 1000);
    return () => clearTimeout(timeoutId);
}, [workspaces, activeWorkspaceId]);
```

**Tab Bar UI**:

```tsx
<div className="flex items-center gap-1 px-2 py-1 bg-gray-100 border-b overflow-x-auto">
    {workspaces.map((ws, index) => (
        <div
            key={ws.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-t text-sm ${
                ws.id === activeWorkspaceId
                    ? "bg-white border-t border-x text-gray-900 font-medium"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
        >
            <button
                onClick={() => setActiveWorkspaceId(ws.id)}
                className="flex-1"
            >
                {ws.name}
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleRenameTab(ws.id);
                }}
            >
                ✏️
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(ws.id);
                }}
            >
                ✕
            </button>
            {index < 9 && (
                <span className="text-xs text-gray-400">⌘{index + 1}</span>
            )}
        </div>
    ))}
    <button onClick={handleNewTab}>+ New</button>
</div>;
```

**Why this matters**:

- **Pattern Library Workflow**: Keep common patterns in one tab, current project
  in another
- **Multi-Project**: Work on different gadget networks simultaneously without
  losing context
- **Experimentation**: Try variations without destroying original
- **Teaching**: Prepare examples in separate tabs, switch between them live

**Each tab gets**:

- Independent sex gadget (separate action array)
- Separate navigation stack (nested workspace paths)
- Independent undo/redo history
- Persistent across sessions (localStorage)

---

### Node Search (Cmd+F)

**Time**: 1-2 hours **Impact**: MEDIUM - quick navigation in large workspaces

**Implementation**:

```typescript
// New component: NodeSearch.tsx
export function NodeSearch({ isOpen, onClose, nodes, onSelectNode }) {
    const [query, setQuery] = useState("");

    const filtered = nodes.filter((n) =>
        n.data?.["name"]?.toLowerCase().includes(query.toLowerCase())
    );

    return isOpen
        ? (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search nodes..."
                    className="px-4 py-2 border rounded shadow-lg"
                />
                <div className="mt-2 max-h-60 overflow-y-auto bg-white border rounded shadow-lg">
                    {filtered.map((node) => (
                        <button
                            key={node.id}
                            onClick={() => {
                                onSelectNode(node);
                                onClose();
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100"
                        >
                            {node.data?.["name"]}
                        </button>
                    ))}
                </div>
            </div>
        )
        : null;
}
```

**Why this matters**: Find nodes instantly in large workspaces. No
scrolling/panning needed.

---

### Spawn at Cursor Position

**Time**: 30 minutes **Impact**: LOW - but nice UX improvement

**Implementation**:

```typescript
// CanvasView.tsx - Track mouse position
const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

const onMouseMove = useCallback((e: React.MouseEvent) => {
    setLastMousePos({ x: e.clientX, y: e.clientY });
}, []);

// Pass to parent via ref
useImperativeHandle(ref, () => ({
    ...existingMethods,
    getLastMousePos: () => lastMousePos,
}));

// route.tsx - Use mouse position when spawning
const handleSpawnFromPalette = (pkg: string, name: string) => {
    const spec: GadgetSpec = { pkg, name, state: null };
    const mousePos = canvasRef.current?.getLastMousePos();

    // Convert screen coords to canvas coords
    const canvasPos = screenToCanvasCoords(mousePos);

    currentSex.receive([
        ["spawn", gadgetName, spec],
        ["setPosition", gadgetName, canvasPos], // New position command
    ]);
};
```

**Why this matters**: Spawn where you're looking, not random location.

---

## Revolutionary Features (To Be Built as Gadgets)

These features will be implemented **inside Bassline** using gadget composition,
once function gadgets mature. This dogfoods the system and proves its power.

### Natural Language Spawning

Build as LLM function gadget that parses intent and spawns/configures gadgets.

### Live Collaboration

Build as WebSocket transport gadgets with CRDT merge strategies.

### Performance Heat Map

Build as metrics collector gadgets that track effect frequency per gadget.

### Gadget Marketplace

Build as registry gadgets with NPM integration and rating cells.

### Mobile Companion

Build as WebSocket bridge gadgets with mobile-optimized UI.

**Philosophy**: The best IDE for gadgets is built using gadgets. Meta-circular
power!

---

## Next Steps (Updated)

### Completed ✅

1. ~~Fix Inspector bugs~~ (quick buttons + effects clearing)
2. ~~Update context.md~~ with canvas architecture
3. ~~Implement Command Palette~~ (Cmd+K)
4. ~~Add keyboard shortcuts~~ (Cmd+D, Cmd+L, Cmd+/, Escape)
5. ~~Fix Command Palette gadget list~~ (parse flat scope structure)
6. ~~Undo/Redo~~ (Cmd+Z/Cmd+Shift+Z)
7. ~~Copy/Paste~~ (Cmd+C/Cmd+V)
8. ~~Multi-Workspace Tabs~~ (Cmd+T/Cmd+W/Cmd+1-9)
9. ~~Export/Import as Package~~ (📦 Export / 📥 Import) ← META-CIRCULAR POWER
   UNLOCKED! 🎉

### Up Next ⚡

10. **Cross-Context Gadget Links** ← PATTERN LIBRARY ENABLER
    - Reference gadgets from other workspace tabs
    - `["link", name, sourceTabId, sourceGadgetName]` action
    - Visual distinction for linked gadgets

11. **Node Search** (Cmd+F)
12. **Spawn at Cursor**

### Future Phases

13. Grid + snap-to-grid
14. Effect flow animations
15. Time-travel debugging
16. Gadget composition mode
17. Context menus (right-click nodes/canvas/wires)

Let's keep crushing it! 🚀
