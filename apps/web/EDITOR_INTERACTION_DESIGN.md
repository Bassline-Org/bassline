# Propagation Network View Library Design

## Core Insight

The propagation network in the worker thread is essentially our database, and React Router's loader/action pattern gives us a clean data synchronization model. The node editor is just one possible "view" into this data - we could equally build spreadsheets, timelines, dashboards, etc.

## Library Architecture

### Core Layer (View-Agnostic)

TODO: We should also build out a little cli, that allows us to run and manage our running propagation networks from a cli, then allow our interface to connect to this

```typescript
// Already exists - the worker-based propagation network
// This is our "database" layer
```

### Data Access Layer

```typescript
// Hooks for subscription and data access
// These are already fairly generic:
- useGroupState(groupId) 
- useContact(contactId)
- useGroupContacts(groupId)

// What's missing:
- useContactsByType(groupId, type)
- useWiresByContact(contactId) 
- useGroupHierarchy(rootId)
- usePropagationPath(fromId, toId)
```

### View Components Library

Instead of building specific editors, we build a library of view components that can be composed:

```typescript
// Contact Views
<ContactValue contact={contact} editor="auto" />
<ContactInlineEditor contact={contact} />
<ContactCard contact={contact} />
<ContactRow contact={contact} />

// Group Views  
<GroupContainer group={group} layout="grid" />
<GroupTree group={group} />
<GroupBreadcrumb path={groupPath} />

// Wire Views
<WireConnection from={contact1} to={contact2} />
<DataFlowIndicator wire={wire} />

// Composite Views
<PropagationNetworkDiagram groupId={groupId} />
<PropagationSpreadsheet groupId={groupId} />
<PropagationTimeline groupId={groupId} />
```

### Refactoring Architecture

Looking at v1's refactoring operations (extract-to-group, inline-group), these are complex graph transformations that:
- Move contacts between groups
- Create boundary contacts for external connections
- Rewire connections appropriately
- Maintain data flow integrity

**Two Architectural Approaches:**

#### 1. New Worker per Refactoring (Branch Model)
```typescript
// Create a new worker with transformed state
const refactoredWorker = await forkWorker(currentWorker)
await refactoredWorker.applyRefactoring(operation)
// User can preview, accept, or reject
```

**Pros:**
- Clean branching/versioning
- Easy undo (just discard worker)
- Safe experimentation
- Could support multiple drafts

**Cons:**
- Complex worker lifecycle management
- Memory overhead
- Sync issues between workers

#### 2. Transform and Load (Transaction Model)
```typescript
// Extract current state, transform, load back
const currentState = await worker.exportState()
const transformedState = applyRefactoring(currentState, operation)
await worker.importState(transformedState)
```

**Pros:**
- Single source of truth
- Simpler mental model
- Leverages existing subscription system
- More database-like

**Cons:**
- Need robust undo/redo
- All-or-nothing operations
- Harder to preview changes

**Recommendation: Transaction Model with Preview**

The worker-as-database pattern suggests using the transaction model, but with enhancements:

```typescript
interface RefactoringTransaction {
  // Preview what will change
  preview(): RefactoringPreview
  
  // Apply the refactoring
  apply(): Promise<void>
  
  // Undo if needed (store inverse operations)
  undo(): Promise<void>
}

// Usage
const extract = createExtractToGroup(selectedContacts, "New Group")
const preview = extract.preview() // Shows affected nodes/wires
if (userConfirms) {
  await extract.apply() // Atomic operation
  undoStack.push(extract)
}
```

This gives us:
- Database-like ACID properties
- Preview capability
- Clean undo/redo
- Single worker simplicity

### Refactoring Implementation Plan

**CRITICAL PRINCIPLE: VIEW AGNOSTIC OPERATIONS**

All refactoring operations must be pure transformations on the NetworkState data model. They should know NOTHING about:
- UI positions or layouts
- Node editors, spreadsheets, or any other view
- React components or DOM elements
- User interactions or gestures

They should ONLY operate on:
- Contacts, Groups, Wires (the core data model)
- Network topology and connections
- Propagation semantics

**Phase 1: Pure Function Refactorings**

Build refactoring operations as pure functions over NetworkState:

```typescript
// propagation-core-v2/refactoring/operations/extract-to-group.ts
export function extractToGroup(
  state: NetworkState,
  params: {
    contactIds: string[]
    groupName: string
    parentGroupId: string
  }
): NetworkState {
  // Pure transformation
  // Returns new state with:
  // - New group created
  // - Contacts moved to new group
  // - Boundary contacts for external connections
  // - Wires rewired appropriately
}

// propagation-core-v2/refactoring/operations/inline-group.ts
export function inlineGroup(
  state: NetworkState,
  params: {
    groupId: string
  }
): NetworkState {
  // Inverse of extract
  // - Move contacts back to parent
  // - Remove boundary contacts
  // - Rewire connections
  // - Delete group
}
```

**Worker Integration:**

```typescript
// Add to network-worker.ts
case 'APPLY_REFACTORING': {
  const { operation, params } = payload
  const currentState = exportState()
  
  let newState: NetworkState
  switch (operation) {
    case 'extract-to-group':
      newState = extractToGroup(currentState, params)
      break
    case 'inline-group':
      newState = inlineGroup(currentState, params)
      break
    // ... other refactorings
  }
  
  importState(newState)
  notifySubscribers(computeChangeSet(currentState, newState))
}
```

**Initial Refactoring Operations:**
1. Extract to Group
2. Inline Group
3. Rename Contact/Group
4. Duplicate Subgraph
5. Replace with Gadget
6. Create Template from Selection

### Future: Meta-Propagation Vision

**Network-Eval Gadget** (Future Task)

Implement a primitive gadget that can execute propagation networks as data:

```typescript
const networkEval: PrimitiveGadget = {
  id: 'network-eval',
  name: 'Network Evaluator',
  inputs: ['network-definition', 'inputs'],
  outputs: ['outputs', 'network-state'],
  
  body: async (inputs) => {
    // Create isolated propagation environment
    // Load and execute network
    // Return results and final network state
  }
}
```

This enables:
- Propagation networks that optimize other networks
- Visual refactoring designers
- Self-modifying networks
- Network synthesis from specifications

**Migration Path:**
Since refactorings are pure functions `(State, Params) -> State`, they can be easily wrapped as propagation gadgets later:

```typescript
// Future: Refactoring as propagation network
const extractToGroupNetwork = {
  contacts: [
    { id: 'input-state', content: null },
    { id: 'params', content: null },
    { id: 'output-state', content: null }
  ],
  gadgets: [
    { 
      type: 'pure-function',
      function: extractToGroup,
      inputs: ['input-state', 'params'],
      outputs: ['output-state']
    }
  ]
}
```

# Editor Interaction Design

## Current Architecture Analysis

### What's Hardcoded vs Abstracted

**Hardcoded Elements:**
1. **Node Types** - Only 2 types: `contact` and `group` (hardcoded in `nodeTypes` object)
2. **Contact Editing** - Always uses text input, no type awareness
3. **Visual Representation** - Fixed styles, colors, and layouts
4. **Interaction Modes** - Only 'select' and 'add-contact' modes
5. **Node Positioning** - Default positions calculated with simple formulas
6. **Handle Positions** - Always left/right for all nodes
7. **Actions** - All actions go through a single switch statement in api.editor-v2.actions.tsx

**Abstracted Elements:**
1. **Data Flow** - Worker-based propagation engine is well abstracted
2. **State Management** - React Router loaders/actions pattern
3. **Subscriptions** - Change notifications through hooks
4. **Network Operations** - NetworkClient provides clean API
5. **Primitive Gadgets** - Plugin-like system for computation

### Key Architectural Decisions

1. **React Flow Integration**
   - Using React Flow's node/edge state management
   - Custom node components for rendering
   - Standard React Flow interaction handlers

2. **State Synchronization**
   - Group state from worker is source of truth
   - UI state (positions) kept separate in React
   - Subscriptions trigger full re-fetches

3. **Action Pattern**
   - All mutations go through React Router actions
   - Actions call NetworkClient methods
   - Results trigger subscription updates

### What Needs Abstraction for Richer Interactions

1. **Node Type System**
   ```typescript
   interface NodeTypeDefinition {
     type: string
     component: React.ComponentType<NodeProps>
     defaultData: () => any
     handles: HandleDefinition[]
     interactions: InteractionDefinition[]
   }
   ```

2. **Value Editor Registry**
   ```typescript
   interface ValueEditor {
     matches: (value: unknown) => boolean
     component: React.ComponentType<ValueEditorProps>
     preview: (value: unknown) => React.ReactNode
     validate: (value: unknown) => ValidationResult
   }
   ```

3. **Interaction Mode System**
   ```typescript
   interface InteractionMode {
     name: string
     cursor: string
     handlers: {
       onPaneClick?: (event: MouseEvent) => void
       onNodeClick?: (node: Node, event: MouseEvent) => void
       onEdgeClick?: (edge: Edge, event: MouseEvent) => void
       onKeyDown?: (event: KeyboardEvent) => void
     }
   }
   ```

4. **Visual Styling System**
   - Theme-based styling instead of hardcoded classes
   - Dynamic styling based on value types
   - Configurable node appearances

5. **Action System**
   - Command pattern for actions
   - Undo/redo support
   - Action composition

## Current State

The editor currently supports basic interactions:
- Click to select nodes
- Drag to move nodes
- Connect nodes by dragging from handle to handle
- Edit contact values inline (text only)
- Add contacts and gadgets via UI buttons
- Delete with keyboard shortcuts
- Double-click groups to navigate into them

## Vision for Richer Interactions

### 1. Direct Manipulation

**Inline Value Editing**
- Rich type-aware editors (sliders for numbers, color pickers, date pickers)
- Live preview of values as you type
- Validation feedback inline
- Auto-complete for known value types

**Visual Value Representation**
- Show small value previews on contacts (icons, colors, thumbnails)
- Sparklines for numeric arrays
- Color swatches for color values
- Truncated text with tooltips

### 2. Gesture-Based Creation

**Quick Creation Modes**
- Drag from palette to canvas
- Double-click empty space for quick-add menu
- Keyboard shortcuts for common gadgets (e.g., `A` for Add, `M` for Multiply)
- Cmd+Click to create and auto-wire to selected node

**Smart Wiring**
- Shift+drag to create multiple connections
- Option+drag to create directed connections
- Auto-wire compatible types when dragging near
- Wire preview showing data flow direction

### 3. Context-Aware Actions

**Right-Click Menus**
- Context-specific actions based on selection
- Quick gadget suggestions based on contact type
- Recent actions for quick repeat
- Clipboard operations (copy/paste nodes with values)

**Smart Suggestions**
- Suggest gadgets based on selected contact types
- Auto-complete wiring based on type compatibility
- Recommend common patterns (e.g., map-reduce)

### 4. Visual Feedback

**Live Data Flow**
- Animate values flowing through wires
- Highlight active propagation paths
- Show contradiction indicators
- Pulse on value changes

**Type Indicators**
- Color-code contacts by value type
- Show type badges on contacts
- Highlight type mismatches
- Preview type transformations

### 5. Advanced Editing Modes

**Batch Operations**
- Multi-select and edit common properties
- Find and replace values across network
- Bulk wiring operations
- Template application

**Debugging Mode**
- Step through propagation
- Breakpoints on contacts
- Value history timeline
- Propagation trace visualization

### 6. Improved Navigation

**Minimap**
- Bird's eye view of large networks
- Click to jump
- Show current viewport
- Highlight search results

**Breadcrumb Enhancements**
- Preview on hover
- Quick jump menu
- Recent locations
- Bookmarks for frequent groups

### 7. Rich Contact Types

**Specialized Contact Editors**
```typescript
interface ContactEditor {
  type: string
  component: React.Component
  validator: (value: any) => boolean
  preview: (value: any) => ReactNode
}

// Examples:
- NumberEditor: slider, min/max, step
- ColorEditor: color picker, palettes
- DateEditor: calendar picker
- ArrayEditor: list view, add/remove items
- ObjectEditor: property grid
- CodeEditor: syntax highlighting
```

**File/Media Contacts**
- Drag & drop file upload
- Image preview thumbnails
- Audio waveforms
- CSV data preview

### 8. Collaboration Features

**Presence Awareness**
- Show other users' cursors
- Highlight their selections
- Activity indicators
- Chat/comments on nodes

**Change Tracking**
- Show who modified what
- Change history per contact
- Revert to previous values
- Blame view for debugging

### 9. Performance & Scalability

**Virtualization**
- Only render visible nodes
- Level-of-detail rendering
- Progressive loading
- Semantic zoom (show more detail when zoomed in)

**Search & Filter**
- Fast fuzzy search
- Filter by type, value, name
- Search in nested groups
- Save search queries

### 10. Keyboard-First Workflows

**Command Palette**
- Cmd+K for quick actions
- Fuzzy search commands
- Recent commands
- Custom shortcuts

**Vim-Style Modes**
- Normal mode (navigation)
- Insert mode (editing values)
- Visual mode (selection)
- Command mode (operations)

## Implementation Priorities

### Phase 1: Foundation (Current)
✅ Basic node editing
✅ Wiring
✅ Navigation
✅ Property panel

### Phase 2: Enhanced Editing
- [ ] Type-aware contact editors
- [ ] Inline value previews
- [ ] Context menus
- [ ] Keyboard shortcuts

### Phase 3: Visual Feedback
- [ ] Live data flow animation
- [ ] Type indicators
- [ ] Contradiction visualization
- [ ] Minimap

### Phase 4: Advanced Features
- [ ] Command palette
- [ ] Search & filter
- [ ] Batch operations
- [ ] Debug mode

### Phase 5: Collaboration
- [ ] Multi-user presence
- [ ] Change tracking
- [ ] Comments
- [ ] Version control

## Technical Considerations

### Architecture Changes

1. **Contact Editor Registry**
   - Plugin system for custom editors
   - Type detection and matching
   - Fallback to generic editor

2. **Interaction State Machine**
   - Clear modes and transitions
   - Keyboard shortcut handling
   - Gesture recognition

3. **Performance Optimizations**
   - React Flow custom renderers
   - Web Workers for large networks
   - Virtual scrolling for long lists

4. **Data Flow Visualization**
   - WebGL for particle effects
   - CSS animations for simple flows
   - RequestAnimationFrame for smooth updates

### Component Structure

```
editor-v2/
  interactions/
    ContactEditor/
      registry.ts
      editors/
        NumberEditor.tsx
        StringEditor.tsx
        ArrayEditor.tsx
    CommandPalette/
    ContextMenu/
    Minimap/
  visualization/
    DataFlowRenderer.tsx
    TypeIndicators.tsx
    ContradictionOverlay.tsx
```

## Next Steps

1. Create interaction state machine
2. Implement contact editor registry
3. Add keyboard shortcut system
4. Build command palette
5. Enhance visual feedback

## Open Questions

1. How to handle custom value types?
2. Should we support node grouping/ungrouping?
3. How to visualize recursive propagation?
4. What's the best way to show contradictions?
5. Should we add a timeline/history view?