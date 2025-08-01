# Bassline Implementation Journal

## Overview
This document captures the implementation of a propagation network system in React, based on a Smalltalk implementation. The goal was to create a visual programming environment supporting bidirectional constraint propagation.

## Architecture Decisions That Worked

### 1. Clean Separation of Concerns
**Decision**: Separate core propagation logic from UI completely
- `propagation-core/` - Pure TypeScript, no React dependencies
- `propagation-react/` - React adapter layer  
- UI components use the adapter, never touch core directly

**Why it worked**: 
- Core logic is testable without UI
- Could swap React Flow for another library easily
- Propagation logic stays simple and focused

### 2. Contact-Driven Propagation
**Decision**: Contacts handle their own propagation, not ContactGroup
```typescript
// Contact asks its group for connections, then propagates
class Contact {
  propagate() {
    const connections = this.group.getOutgoingConnections(this.id)
    for (const {wire, targetId} of connections) {
      this.group.deliverContent(targetId, this.content, this.id)
    }
  }
}
```

**Why it worked**:
- Mirrors real propagator networks (cells are active)
- Decentralized - no central propagation engine needed
- Contacts stay independent

### 3. Simple Wire Model
**Decision**: Just two wire types - bidirectional (default) and directed
- No complex wire behaviors
- Wires are just data (id, from, to, type)

**Why it worked**:
- Transformations happen through network topology, not wire types
- Keeps the mental model simple

## Key Implementation Details

### UUID Generation
```typescript
const generateId = (): string => crypto.randomUUID()
```
- Every entity gets a proper UUID
- No counters or timestamps
- Works across distributed systems

### Blend Modes
Only two modes implemented:
1. **accept-last**: Default, just overwrites
2. **merge**: Semi-lattice merge with contradiction detection

```typescript
interface Mergeable<T> {
  merge(other: T): T | Contradiction
}
```

### React Flow Integration
```typescript
// Map core models to React Flow format
const newNodes: Node[] = contacts.map(contact => ({
  id: contact.id,
  position: contact.position,
  type: contact.isBoundary ? 'boundary' : 'contact',
  data: { /* contact data */ }
}))
```

## What Didn't Work Initially

### 1. Wrong React Flow Package
**Problem**: Started with `reactflow` but should have used `@xyflow/react`
**Fix**: Migrated all imports and adjusted for API differences

### 2. Type Issues with TypeScript
**Problem**: `verbatimModuleSyntax` required explicit type imports
**Fix**: Changed all type imports to use `import type { ... }`

### 3. Missing Deletion Support
**Problem**: No way to remove nodes/edges
**Solution**: Added `removeContact()` and `removeWire()` methods that:
- Remove the entity
- Clean up connected wires automatically
- Update React Flow state

### 4. React Flow Provider Context
**Problem**: Handle components used outside provider context
**Fix**: Ensure proper component hierarchy with ReactFlowProvider

## Current System Capabilities

### Working Features
- ✅ Visual node editor with React Flow
- ✅ Bidirectional propagation between contacts
- ✅ Blend modes (accept-last, merge)
- ✅ Custom nodes (Contact, Boundary)
- ✅ Node/edge deletion with cleanup
- ✅ Double-click to edit content
- ✅ Proper TypeScript types throughout

### Example Mergeable Types
```typescript
// Interval - narrows to intersection
new Interval(0, 10).merge(new Interval(5, 15)) // → Interval(5, 10)

// SetValue - accumulates values  
new SetValue([1, 2]).merge(new SetValue([2, 3])) // → SetValue([1, 2, 3])

// Temperature - monotonic increase
new Temperature(20).merge(new Temperature(25)) // → Temperature(25)
```

## Next Steps (Not Yet Implemented)

1. **Hierarchical Navigation**
   - Navigate into ContactGroups
   - Breadcrumb navigation
   - URL-based routing for groups

2. **Boundary Contacts**
   - Connect parent/child groups
   - Create abstraction boundaries

3. **Visual Propagation Feedback**
   - Animate edges during propagation
   - Highlight changing values

4. **Persistence**
   - Save/load networks
   - Undo/redo support

## Key Files Reference

### Core System
- `app/propagation-core/models/Contact.ts` - Active cell with propagation
- `app/propagation-core/models/Wire.ts` - Simple connection data
- `app/propagation-core/models/ContactGroup.ts` - Container and router
- `app/propagation-core/types/mergeable.ts` - Example mergeable types

### React Integration  
- `app/propagation-react/hooks/usePropagationNetwork.ts` - Main React hook
- `app/components/nodes/ContactNode.tsx` - Editable node component
- `app/routes/editor.tsx` - Main editor page

## Phase 2: Hierarchical Navigation & Boundary Contacts

### What We Built
Implemented gadgets (user-defined components) as ContactGroups with hierarchical navigation:

1. **Visual Gadget Representation**
   - GroupNode component displays gadgets with input/output ports
   - Shows boundary contacts as connection points on the gadget
   - Double-click navigation to enter gadgets
   
2. **Boundary Contact Implementation**
   - Boundary contacts are regular contacts with special visibility rules
   - Can be connected from parent group even though they live in subgroup
   - Act as parameters/interface for gadgets (inputs/outputs)
   - Support bidirectional propagation across group boundaries

3. **Navigation System**
   - Breadcrumb navigation shows current location in hierarchy
   - State management tracks current group context
   - React Flow re-renders correctly when switching contexts

### Key Architecture Insights

#### Boundary Contacts Are Just Special Contacts
**Initial misconception**: Thought boundary contacts needed complex bridging logic
**Reality**: They're regular contacts with one special rule - parent group can see and connect to them

```typescript
// The key insight - check parent's subgroups for boundary contacts
canConnectTo(contactId: ContactId): Contact | undefined {
  // First check own contacts
  const ownContact = this.contacts.get(contactId)
  if (ownContact) return ownContact
  
  // Then check boundary contacts in immediate subgroups
  for (const subgroup of this.subgroups.values()) {
    if (subgroup.boundaryContacts.has(contactId)) {
      return subgroup.contacts.get(contactId)
    }
  }
}
```

#### Propagation Across Boundaries
Boundary contacts propagate in both directions:
- Within their own group (normal propagation)
- To/from parent group connections (special case)

```typescript
// Boundary contacts check parent group for connections too
if (this.isBoundary && this.group.parent) {
  const parentConnections = this.group.parent.getOutgoingConnections(this.id)
  for (const { wire, targetId } of parentConnections) {
    this.group.parent.deliverContent(targetId, this._content, this.id)
  }
}
```

#### React Flow Handle Mapping
Group nodes use handle IDs to identify boundary contacts:
- Node ID = Group ID
- Handle ID = Boundary Contact ID
- Connection logic maps handles back to contact IDs

### What Worked Well
1. **Minimal Changes to Core** - Boundary contacts required only small additions to existing logic
2. **Reusing Existing Patterns** - Contacts remain the active propagators
3. **Clean Abstraction** - Gadgets hide internal complexity while exposing clear interfaces

### Gotchas & Solutions
1. **State Management on Navigation** - Used React state to trigger re-renders when changing groups
2. **Edge Rendering** - Had to map boundary contact connections to show edges to/from group nodes
3. **Handle IDs in React Flow** - Used boundary contact IDs as handle IDs for proper connection mapping
4. **React Flow Default Node Styling** - React Flow wraps custom nodes in a container with grey background and black border. Fixed by adding style props to nodes:
   ```typescript
   style: {
     background: 'transparent',
     border: 'none',
     padding: 0,
     borderRadius: 0
   }
   ```

## Phase 3: Refactoring Operations

### What We Built
Implemented compositional refactoring operations starting with "Extract to Gadget":

1. **Selection System**
   - Tracks selected contacts, wires, and groups
   - Integrates with React Flow's selection state
   - Foundation for all refactoring operations

2. **Wire Classification**
   - Categorizes wires during refactoring: internal, incoming, outgoing, external
   - Groups wires by external endpoint for smart boundary creation
   - Preserves all connections through refactoring

3. **Extract to Gadget Operation**
   - Select multiple contacts and extract them into a reusable gadget
   - Automatically creates boundary contacts for crossing wires
   - Maintains all propagation paths through proper rewiring
   - Validates all connections follow propagation rules

### Architecture Insights

#### Compositional Design
Built refactoring as composable operations:
```typescript
// Primitive operations compose into complex refactorings
extractToGadget = selectSubgraph + moveToNewGroup + createBoundaries + rewireConnections
```

#### Wire Handling Strategy
Key insight: When extracting to gadget, wires fall into clear categories:
- **Internal wires** → Just move to new group
- **Incoming wires** → Create input boundary, rewire: external → boundary → internal
- **Outgoing wires** → Create output boundary, rewire: internal → boundary → external

#### Connection Validation
Made Contact.group public readonly to enable validation:
```typescript
canConnect(from: Contact, to: Contact): boolean {
  // Same group - always OK
  if (from.group === to.group) return true
  
  // Parent to child boundary - OK
  if (to.isBoundary && to.group.parent === from.group) return true
  
  // Other cases...
}
```

### Implementation Details

#### Smart Boundary Creation
- Groups wires by external endpoint
- Creates one boundary per external contact (not per wire)
- Names boundaries based on their connections
- Positions boundaries logically (inputs left, outputs right)

#### Selection Integration
```typescript
// React Flow selection → Core selection model
onSelectionChange={({ nodes, edges }) => {
  updateSelection(nodes, edges)
}}

// Selection drives refactoring UI
{hasSelection && selection.contacts.size > 0 && (
  <Button onClick={handleExtractToGadget}>
    Extract to Gadget ({selection.contacts.size} contacts)
  </Button>
)}
```

### What Worked Well
1. **Compositional approach** - Operations build on each other naturally
2. **Selection as first-class** - All refactoring works on selections
3. **Automatic boundary creation** - Users don't manually wire boundaries
4. **Connection preservation** - No lost connections during refactoring

### Inline Gadget Operation
Implemented the inverse of extract - expands a gadget back into its parent:

#### How It Works
1. **Track boundary connections** - Maps which external contacts connect to each boundary
2. **Move internal contacts** - Recreates all non-boundary contacts in parent with adjusted positions
3. **Rewire connections** - Bypasses boundaries by connecting external contacts directly
4. **Clean up** - Removes empty gadget and boundary contacts

#### Key Implementation Details
```typescript
// Adjust positions when inlining
const adjustedPosition = {
  x: gadget.position.x + contact.position.x,
  y: gadget.position.y + contact.position.y
}

// Skip boundaries when rewiring
if (boundary -> internal) {
  // Rewire: external -> internal (skip boundary)
  parentGroup.connect(externalId, internalId)
}
```

### Extract with Nested Gadgets
Enhanced extract operation to support selecting gadgets along with contacts:

#### Implementation Changes
1. **Move entire subgroups** - When gadgets are selected, move them intact into new parent
2. **Update parent references** - `subgroup.parent = gadget`
3. **Include boundary contacts** - Add boundary contacts of moved groups to selection for wire classification
4. **Preserve IDs** - Boundary contacts of moved gadgets keep their original IDs

#### Key Code
```typescript
// Move selected subgroups first
selection.groups.forEach(groupId => {
  const subgroup = parentGroup.subgroups.get(groupId)
  if (subgroup) {
    gadget.subgroups.set(groupId, subgroup)
    parentGroup.subgroups.delete(groupId)
    subgroup.parent = gadget
    
    // Include boundaries in wire classification
    subgroup.boundaryContacts.forEach(contactId => {
      selection.contacts.add(contactId)
    })
  }
})
```

This enables true hierarchical composition - gadgets containing gadgets containing gadgets, etc.

### Inline Gadget - Fixed to Preserve Hierarchy
Fixed the inline operation to only collapse a single level instead of flattening all nested gadgets:

#### Implementation
1. **Move contacts** - Transfer non-boundary contacts to parent with adjusted positions
2. **Move subgroups** - Transfer nested gadgets intact, preserving their internal structure
3. **Rewire connections** - Skip boundaries of inlined gadget, preserve connections to moved subgroups

```typescript
// Move subgroups with adjusted positions
for (const [subgroupId, subgroup] of gadget.subgroups) {
  subgroup.position = {
    x: gadget.position.x + subgroup.position.x,
    y: gadget.position.y + subgroup.position.y
  }
  parentGroup.subgroups.set(subgroupId, subgroup)
  subgroup.parent = parentGroup
}
```

This maintains the hierarchical structure while removing one level of nesting.

#### Inline Gadget - Connection Preservation Fix
Fixed issue where connections to nested gadget boundaries were lost during inline:

```typescript
// Trace connections through gadget boundaries to subgroup boundaries
// Before: parent contact -> gadget boundary -> subgroup boundary
// After: parent contact -> subgroup boundary (direct connection)
```

The fix detects parent wires that route through the gadget being inlined to reach nested subgroup boundaries, and creates direct connections to preserve the data flow.

### Next Refactoring Operations
With this foundation, we can add:
- **Move Between Groups** - Relocate contacts while preserving wires
- **Merge Gadgets** - Combine multiple gadgets into one

### UI Improvements

1. **Output Boundary Contacts** - Fixed UI to support creating both input and output boundary contacts
   - Separate buttons for "Add Input Boundary" and "Add Output Boundary"
   - Smart positioning: inputs on left (x=50), outputs on right (x=550)

2. **Convert to Boundary Operation** - New refactoring operation to convert internal contacts to boundaries
   - Automatically infers direction (input/output) based on existing connections
   - Adds selected contacts to the group's boundary set
   - Shows up when contacts are selected without groups

3. **Gadget Deletion Fix** - Fixed issue where deleting gadgets didn't update the view
   - Added `removeSubgroup` method to ContactGroup
   - Enhanced node deletion handler to check for both contacts and groups
   - Properly cleans up wires connected to deleted gadget's boundaries

4. **React Flow Edge Warning Fix** - Removed custom edge types that caused warnings
   - React Flow doesn't support custom edge type names like "bidirectional"
   - Now uses default edge type with markers to show directionality
   - Bidirectional edges have arrows on both ends

## Summary of Today's Accomplishments

### Refactoring Operations Completed
- ✅ **Extract to Gadget** - Works with nested gadgets, creates appropriate boundaries
- ✅ **Inline Gadget** - Preserves hierarchy, only collapses one level, maintains all connections
- ✅ **Convert to Boundary** - Transforms internal contacts into interface boundaries with smart direction inference

### UI/UX Improvements
- ✅ Separate buttons for input/output boundary creation with smart positioning
- ✅ Fixed gadget deletion to properly update the view
- ✅ Added visual feedback for all refactoring operations
- ✅ Fixed React Flow warnings about edge types

### Core Fixes
- ✅ Inline operation now preserves connections to nested gadget boundaries
- ✅ Proper cleanup of wires when deleting gadgets
- ✅ Support for both input and output boundary contacts throughout the system

The propagation network implementation now supports sophisticated hierarchical composition with powerful refactoring operations that maintain system integrity. Users can build complex gadgets, nest them arbitrarily deep, and refactor them while preserving all connections and data flow.

## Phase 4: Gadget Palette & Smart UI Features

### What We Built
Implemented a comprehensive gadget palette system with drag-and-drop and smart connection features:

1. **Gadget Templates**
   - Added `toTemplate()` and `fromTemplate()` methods to ContactGroup
   - Templates capture structure without runtime state
   - Index-based wire mapping for portability
   - Recursive support for nested gadgets

2. **Palette UI System**
   - Collapsible sidebar with drag-and-drop gadgets
   - Categories, search, usage tracking
   - Recent/popular views for quick access
   - Persistent storage in localStorage
   - Visual preview showing input/output counts

3. **Smart Connection Features**
   - **Proximity Connect**: Auto-connect when handles are dragged within 50px
   - **Edge Drop Menu**: Drop edge on canvas shows quick-add menu
   - **Handle-based Distance**: Calculates proximity from handle positions, not node centers
   - Visual feedback with opacity based on distance

### Key Architecture Decisions

#### Template System Design
```typescript
interface GadgetTemplate {
  name: string
  contacts: ContactTemplate[]  // Position, type, blend mode
  wires: WireTemplate[]       // Index-based references
  subgroupTemplates: GadgetTemplate[]  // Recursive
  boundaryIndices: number[]   // Which contacts are boundaries
}
```

**Why it works**:
- Index-based wire references make templates portable
- No runtime IDs or state in templates
- Clean separation between structure and instance

#### Client-Only Components
**Problem**: localStorage access caused SSR hydration mismatches
**Solution**: Created `ClientOnly` wrapper component
```typescript
<ClientOnly>
  <GadgetPalette {...props} />
</ClientOnly>
```

#### Handle-Based Proximity
Improved proximity connect to use handle positions:
- Calculate actual handle locations based on node dimensions
- Only connect compatible handles (source to target)
- Opacity feedback based on proximity
- 50px threshold for handle snapping

### Implementation Challenges & Solutions

1. **Hydration Errors**
   - **Issue**: `localStorage` doesn't exist during SSR
   - **Fix**: Load default state first, then hydrate from localStorage in useEffect

2. **Drag & Drop Coordinates**
   - **Issue**: Screen coordinates don't match React Flow coordinates
   - **Fix**: Use `screenToFlowPosition()` from useReactFlow hook

3. **Z-Index Layering**
   - **Issue**: Palette hidden behind other elements
   - **Fix**: Increased z-index to 50 for proper layering

### Usage Patterns

#### Creating Reusable Gadgets
1. Build complex logic with contacts and wires
2. Select and extract to gadget
3. Automatically added to palette
4. Drag from palette to instantiate

#### Smart Connections
- Drag nodes close together for auto-connect
- Drop edges on empty space for quick-add menu
- Visual feedback shows connection strength

### What Worked Well
1. **Drag & Drop UX** - Natural interaction pattern for component reuse
2. **Automatic Palette Addition** - Extract operation adds to palette seamlessly
3. **Usage Tracking** - Helps identify most useful gadgets
4. **Proximity Feedback** - Clear visual indication of potential connections

### Future Enhancements
- Import/export palette as JSON
- Share palettes between projects
- Gadget versioning and updates
- Custom categories and tags

## Phase 5: Tools Menu & UI Polish

### What We Built
Implemented a comprehensive view management system with contextual UI controls and user feedback:

1. **Flexible Tools Menu**
   - Bottom-center positioning with upward expansion
   - Horizontal layout for better screen usage
   - Toggle buttons with icons and keyboard shortcuts
   - Persistent view settings in localStorage
   - Clean, modern design with compact buttons

2. **View Settings System**
   - **Instructions** (W) - Toggle help panel
   - **Mini Map** (E) - Show/hide React Flow minimap
   - **Grid** (D) - Toggle background grid
   - **Flow** - Ready for propagation visualization
   - **Labels** - Ready for node label control
   - **Debug** - Ready for debug overlays
   - **Hints** - Control toast notifications

3. **Left-Hand Keyboard Shortcuts**
   - Redesigned for single-hand operation:
     - Q → Toggle palette (pinky)
     - W → Toggle instructions (ring finger)
     - E → Toggle minimap (middle finger)
     - A → Add contact (pinky)
     - S → Add gadget (ring finger)
     - D → Toggle grid (middle finger)
   - Natural finger positions for mouse + keyboard workflow

4. **Toast Notification System**
   - Integrated `sonner` library for elegant toasts
   - Top-center positioning with downward stacking
   - White background with proper contrast (fixed hover issue)
   - Contextual hints when clicking buttons
   - Respects "Shortcut Hints" user preference
   - No toasts when using keyboard shortcuts (non-intrusive)

5. **Auto-Propagation on Connect**
   - When creating new connections, existing content flows immediately
   - Bidirectional wires propagate from both ends if content exists
   - Makes the network feel more alive and responsive

### Architecture Decisions

#### View Settings Hook
```typescript
const defaultSettings: ViewSettings = {
  showInstructions: true,
  showMiniMap: true,
  showGrid: true,
  showPropagationFlow: false,
  showNodeLabels: true,
  showDebugInfo: false,
  showShortcutHints: true
}
```
- Centralized view state management
- Automatic persistence to localStorage
- Avoids hydration issues with proper useEffect loading

#### Toast Implementation
- **Unstyled mode** with Tailwind classes for full control
- Conditional display based on user preferences
- Success variants for positive feedback
- useRef to prevent duplicate welcome messages

#### Left-Hand Ergonomics
- Shortcuts clustered around QWEASD keys
- No modifier keys needed (direct key presses)
- Complementary to right-hand mouse usage
- Memorable positions (Q for palette like "Queue")

### Implementation Challenges & Solutions

1. **Toast Styling Issues**
   - **Problem**: Toasts appeared with same color as background
   - **Investigation**: Read sonner docs, discovered CSS conflicts
   - **Solution**: Used `unstyled: true` with explicit Tailwind classes

2. **Duplicate Welcome Toast**
   - **Problem**: Toast appeared twice on mount
   - **Solution**: Added useRef flag to ensure single display

3. **Keyboard Shortcut Discovery**
   - **Problem**: Users don't know shortcuts exist
   - **Solution**: Toast hints on button clicks (not on shortcut use)

### UI/UX Improvements

1. **Progressive Disclosure**
   - Tools menu collapsed by default
   - Shortcuts shown in menu for learning
   - Optional hint system for new users

2. **Visual Feedback**
   - Button states clearly indicate on/off
   - Keyboard shortcuts displayed inline
   - Toast notifications for important actions

3. **Customization**
   - All view options toggleable
   - Settings persist across sessions
   - Hints can be disabled when learned

### What Worked Well

1. **Bottom-Center Tools** - Easy to reach, doesn't obstruct canvas
2. **Horizontal Layout** - Better use of wide screens
3. **Left-Hand Shortcuts** - Natural for mouse users
4. **Conditional Toasts** - Helpful without being annoying
5. **View Persistence** - Settings remembered between sessions

## Lessons Learned

1. **Start with the simplest thing** - Two wire types, two blend modes
2. **Keep core logic pure** - No UI concerns in models
3. **Let cells be active** - Contacts handle their own propagation
4. **UUIDs everywhere** - Proper IDs from the start
5. **Test the architecture early** - Clean separation pays off
6. **Question assumptions** - Boundary contacts didn't need complex bridging, just visibility rules
7. **Leverage existing patterns** - Gadgets are just groups with boundary contacts as their interface
8. **Selection enables refactoring** - Making selection first-class enables powerful operations
9. **Classify then transform** - Breaking down the problem (wire classification) simplifies the solution
10. **Handle all entity types in operations** - Deletion needs to handle contacts AND groups
11. **Client-side storage needs SSR consideration** - Use ClientOnly wrappers or hydrate after mount
12. **Visual feedback improves UX** - Proximity indicators and drag previews guide users
13. **Templates enable reusability** - Separating structure from state makes gadgets portable
14. **Read the docs!** - Library documentation often has the exact solution you need
15. **Ergonomics matter** - Left-hand shortcuts + right-hand mouse creates fluid workflow
16. **Progressive disclosure** - Hide complexity until users need it
17. **Respect user preferences** - Make hints and helpers optional

This architecture successfully implements the core propagation network concepts while maintaining flexibility for future enhancements.