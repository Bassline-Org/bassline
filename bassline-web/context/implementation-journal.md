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

## Session 6: Dreams-Style Gadget Menu (2025-08-03)

### What We Built

Redesigned the gadget palette to follow Dreams (PlayStation) UI patterns with a multi-layered bottom menu:

#### 1. Three-Layer Menu System
- **Closed State**: Just the "Gadgets" button in ToolsMenu
- **Category Layer**: Horizontal scrolling list of categories with icons
- **Gadget Layer**: Grid of gadget icons within selected category

#### 2. Component Architecture
- **DreamsGadgetMenu**: Main orchestrator with state management
- **CategorySelector**: Horizontal scrolling category picker with arrows
- **GadgetGrid**: Icon grid display with drag-and-drop support

#### 3. Visual Design
- Category icons using Unicode symbols (∑ for Math, ⊻ for Logic, etc.)
- Gadget icons shared with node display via centralized icon system
- Smooth slide-up animations with backdrop
- Semi-transparent backgrounds for modern layered look
- Doom 64 theme integration

#### 4. Interaction Patterns
- **G key**: Toggle gadget menu (replaced Q for palette)
- **Escape**: Go back one layer or close
- **Click outside**: Close menu
- **Drag & Drop**: Direct from grid to canvas
- **Tooltips**: Show name/description on hover

### Key Decisions

#### Shared Icon System
Created `gadget-icons.tsx` to centralize icon mappings:
- Single source of truth for gadget icons
- Used by both GroupNode and GadgetGrid
- Easy to extend with new gadgets

#### State Management
- Menu state managed in editor component
- Three distinct states: closed, categories, gadgets
- Smooth transitions between states

#### Layout Approach
- Fixed positioning at bottom of screen
- Layered approach with each level above previous
- Responsive grid that adapts to content

### Benefits Over Sidebar
1. **Better use of horizontal space** - Wide screens utilized effectively
2. **Scalable** - Can handle many more gadgets/categories
3. **Modern UX** - Matches creative tools like Dreams, Blender
4. **Icons over text** - More universal, quicker recognition
5. **Keyboard friendly** - Single key access, escape navigation

### Lessons Learned
1. **Portal rendering** - Essential for overlay menus to avoid z-index issues
2. **Backdrop clicks** - Need careful event handling to prevent accidental closes
3. **Icon systems** - Centralizing icons prevents duplication and inconsistency
4. **Animation timing** - Subtle animations (200ms) feel responsive but smooth
5. **Keyboard navigation** - Escape for back is intuitive for modal interfaces

### Boundary Direction Logic Fix

Fixed a critical bug where boundary contact directions were being inferred incorrectly:

#### The Problem
When converting contacts to boundaries, the logic was backwards:
- Contacts with only incoming connections were marked as INPUT (wrong!)
- Contacts with only outgoing connections were marked as OUTPUT (wrong!)

#### The Correct Logic
Think of it like function parameters:
- **INPUT boundaries** = function parameters (have NO incoming connections, only send data out)
- **OUTPUT boundaries** = return values (have NO outgoing connections, only receive data)

#### The Fix
In `ConvertToBoundaryOperation`:
```typescript
// CORRECT:
if (!hasIncoming && hasOutgoing) {
  contact.boundaryDirection = 'input'  // Like a function parameter
} else if (hasIncoming && !hasOutgoing) {
  contact.boundaryDirection = 'output' // Like a return value
}
```

This matches the conceptual model where:
- INPUT boundaries provide input TO the gadget's internals
- OUTPUT boundaries collect output FROM the gadget's internals

## Session 5: Layout System and Audio Feedback (2025-08-03)

### What We Built

#### 1. Automatic Node Layout with Dagre
Implemented a complete layout system using the Dagre library:

**Features:**
- Auto-layout button in ToolsMenu with 'L' keyboard shortcut
- Left-to-right layout by default (matches data flow direction)
- Smart layout that handles different node sizes (contacts: 60x48px, gadgets: variable)
- Can layout entire network or just selected nodes
- Properly updates both React Flow and core network positions

**Key Implementation Details:**
- Created `useLayout` hook that wraps Dagre functionality
- Direct position updates in core network (not just React Flow state)
- 50px node spacing, 100px rank spacing by default
- Support for all layout directions (TB, BT, LR, RL)

#### 2. Comprehensive Audio System
Built a custom Web Audio API-based sound system (SSR-compatible):

**Sound Categories:**
- **Connection sounds**: create (440Hz), delete (220Hz)
- **Node sounds**: create (523Hz), delete (261Hz)
- **Gadget sounds**: create (440Hz - tab open), delete (196Hz), inline (330Hz - tab close)
- **Navigation sounds**: enter (587Hz - ascending), exit (294Hz - descending)
- **UI sounds**: layout (550Hz), plus ready sounds for buttons, toggles, success, error

**Smart Sound Management:**
- Idempotent sound playing within 100ms windows
- Shared cooldown for related operations (node + edge deletion)
- Different sounds for nodes vs gadgets deletion
- Tab open/close metaphor for gadget creation/inlining

**Technical Implementation:**
- Custom `SoundSystemProvider` using Web Audio API
- Simple sine wave generation (ready for real sound files)
- Auto-initializes on first user interaction
- Global volume control support

#### 3. Enhanced Boundary Contact Controls
Added full boundary management to PropertyPanel:

**New Features:**
- Toggle any contact to/from boundary status
- Direction selector (Input/Output) for boundary contacts
- Maintains selection after boundary changes (no focus loss)
- Visual feedback shows current boundary status

**Implementation:**
- Enhanced `useContact` hook with `setBoundary()` and `setBoundaryDirection()`
- Auto-sync with React Flow after changes
- Re-selection logic to maintain PropertyPanel focus

### Key Architecture Decisions

#### Layout System Design
- **Separate concern**: Layout logic isolated in dedicated hook
- **Direct updates**: Positions updated in core network, not just UI
- **Flexible API**: Support for full or partial layout

#### Audio System Architecture
- **Web Audio API**: More control than HTML5 audio elements
- **Context-based**: Centralized sound management
- **Debouncing strategy**: Prevents audio spam during bulk operations

#### Boundary Control Pattern
- **Hook-based mutations**: All changes go through useContact methods
- **Auto-sync**: Every mutation triggers syncToReactFlow()
- **Selection preservation**: Re-select after structural changes

### Lessons Learned

1. **Layout libraries need proper integration** - Dagre works well but requires translating between coordinate systems
2. **Audio feedback enhances UX** - Even simple beeps make the system feel more responsive
3. **State preservation matters** - Re-selecting nodes after changes prevents frustrating focus loss
4. **Idempotent operations** - Critical for good audio UX during bulk operations
5. **Tab metaphors work** - Open/close sounds for create/inline operations feel intuitive

### What Works Well

1. **Layout is fast and predictable** - Dagre handles complex networks efficiently
2. **Audio provides clear feedback** - Different sounds for different operations help users understand what's happening
3. **Boundary controls are intuitive** - Toggle + direction selector is clearer than separate buttons
4. **Selection preservation** - Smooth workflow when making multiple property changes

### Future Enhancements

1. **Layout animations** - Smooth transitions when applying layout
2. **Custom sound files** - Replace sine waves with designed sounds
3. **Layout presets** - Save favorite layout configurations
4. **Propagation sounds** - Audio feedback during value propagation
5. **Sound settings** - Per-category volume controls

## Phase 8: React Hooks Refactoring

### The Problem
The codebase had accumulated significant technical debt:
- Manual `syncToReactFlow()` calls scattered everywhere
- Complex prop drilling (network, callbacks, selection)
- Imperative state updates
- Components tightly coupled to implementation details

### The Solution: Clean Hooks Architecture

#### 1. NetworkContext Provider
Created a central context that provides:
- The propagation network instance
- React Flow state management
- Selection state (shared across all components)
- Auto-sync functionality

```typescript
interface NetworkContextValue {
  network: PropagationNetwork
  syncToReactFlow: () => void
  currentGroupId: string
  setCurrentGroupId: (id: string) => void
  nodes: Node[]
  edges: Edge[]
  selection: Selection
  setSelection: React.Dispatch<React.SetStateAction<Selection>>
}
```

#### 2. Core Hooks Implementation

**useContact(contactId)**
- Direct access to contact state
- Auto-sync on all mutations
- No more manual callbacks

**useGroup(groupId)**
- Full group/gadget control
- Navigation, operations, queries
- Handles primitive gadgets properly

**useContactSelection()**
- Returns actual objects, not just IDs
- Shared state via context (fixed the selection bug!)
- Bulk operations built-in

**useCurrentGroup()**
- Navigation context
- Operations on current view
- Breadcrumb support

#### 3. Component Refactoring

**Before:**
```typescript
<ContactNode 
  data={{
    content,
    setContent: (c) => {
      contact.setContent(c)
      syncToReactFlow()
    },
    onDoubleClick: () => propertyPanel.show()
  }}
/>
```

**After:**
```typescript
<ContactNode id={contact.id} selected={selected} />
// Component uses hooks internally
```

### Key Wins

1. **Eliminated ~200 lines of boilerplate** - No more manual syncing
2. **Fixed selection synchronization** - Moved selection to shared context
3. **Cleaner components** - ContactNode, PropertyPanel, GroupNode all simplified
4. **Better separation** - UI components don't know about network internals
5. **Type safety** - Full TypeScript inference throughout

### Selection Bug Fix

The PropertyPanel wasn't showing selected contacts because:
- Each `useContactSelection()` call created isolated state
- Selection wasn't properly shared between components

**Fix**: Moved selection state to NetworkContext, ensuring all components share the same selection.

### Lessons Learned

1. **Context is powerful** - Shared state solves many React problems
2. **Hooks enable clean APIs** - Hide complexity behind simple interfaces
3. **Auto-sync is essential** - Manual sync calls are error-prone
4. **Selection needs special care** - It's cross-cutting state that many components need

This refactoring sets a solid foundation for future features while making the codebase much more maintainable and truly embracing React's declarative model.

## Phase 7: UI Refinements & Handle-Centric Design

### What We Built
Redesigned the visual appearance of nodes to create a cleaner, more intuitive interface:

1. **Contact Node Redesign**
   - Transformed contacts into minimal 60x48px cards
   - Replaced top drag handle with left/right drag borders
   - Made entire node body draggable (removed dragHandle restriction)
   - Changed from invisible full-body handles to visible handle boxes (16x16px)
   - Single-click to edit content (improved from double-click)
   - Maintained blend mode indicator as small dot

2. **Primitive Gadget Refinements**
   - Reduced size to compact 50px width (auto-height based on content)
   - Replaced text names with mathematical symbols:
     - Adder → Plus (+) icon
     - Subtractor → Minus (-) icon
     - Multiplier → X (×) icon
     - Divider → Divide (÷) icon
   - Input/output names moved to tooltips on hover
   - Smaller handles (20x20px) with closer spacing

3. **Group Node Handle Improvements**
   - Unified handle styling across all node types
   - Gradient backgrounds matching node type colors
   - Consistent hover effects and shadows
   - Fixed React Flow's default width override with `width: 'auto'`

### Key Architecture Decisions

#### Handle Design Philosophy
**Initial approach**: Invisible handles covering node halves
**Final approach**: Small visible handle boxes

**Why visible handles work better**:
- Clear connection points for users
- Consistent with gadget design
- Avoids click/drag conflicts
- Better visual feedback

#### Quick Add Menu Click-Outside Fix
**Problem**: Menu would instantly close when dropping connection
**Root cause**: Both `onConnectEnd` and `onPaneClick` fire from same event

**Solution**: Added timing flag to prevent race condition:
```typescript
// In handleConnectEnd
setMenuJustOpened(true)
setTimeout(() => setMenuJustOpened(false), 100)

// In onPaneClick
if (quickAddMenuPosition && !menuJustOpened) {
  setQuickAddMenuPosition(null)
}
```

### Visual Hierarchy Summary
- **Contacts**: Minimal 60x48px cards with small visible handles
- **Primitives**: Compact 50px icons with mathematical symbols
- **Gadgets**: Full-sized cards with labeled ports

### Lessons Learned
1. **Visible is often better than invisible** - Users need clear interaction points
2. **Race conditions in event handling** - Same user action can trigger multiple events
3. **React Flow has default styles** - Need to explicitly override with inline styles
4. **Icons communicate better than text** - Especially for mathematical operations
5. **Consistent handle design** - Unifies the visual language across node types

### Primitive Gadget Sizing Fix

**Problem**: Primitive gadgets were too tall due to hidden default padding
**Investigation**: 
- Initially thought it was hardcoded height
- Tried complex flexbox solutions for handle positioning
- Discovered CardContent has default `padding-bottom: 24px` from shadcn

**Solution**:
1. Add explicit padding to Card: `p-[5px]` for primitives
2. Set CardContent to `w-[40px] h-[40px]` with `p-0 pb-0`
3. Total size: 50x50px (40px content + 5px padding × 2)
4. Simple handle positioning with `top: ${15 + index * 20}px`

**Lessons**:
- Always check for default styles from component libraries
- Explicit overrides (`pb-0`) needed for shadcn components
- Simple solutions (direct positioning) often better than complex ones (flexbox containers)
- Browser DevTools are essential for debugging layout issues

### Latch Behavior for All Contacts

Fixed an issue where the latch behavior (contacts keeping their value until receiving a new one) wasn't working correctly for bidirectional connections:

#### The Problem
- `removeWire` only checked the "target" contact (wire.toId) for remaining connections
- It ignored the "source" contact (wire.fromId)
- This broke the latch behavior when contacts were connected via their "output" side

#### The Solution
1. Added `hasAnyConnections(contactId)` helper that checks for ANY connections (not just incoming)
2. Updated `removeWire` to check BOTH endpoints of the removed wire
3. Made `hasAnyConnections` check parent group for boundary contacts
4. Properly handle boundary contacts in subgroups (including primitive gadgets)

```typescript
// Now checks both endpoints when removing a wire
for (const contactId of [wire.fromId, wire.toId]) {
  if (!hasAnyConnections(contactId)) {
    contact['_content'] = undefined
  }
}
```

This ensures that:
- Regular contacts maintain their value until all connections are removed
- Primitive gadgets properly handle disconnection of boundary contacts
- The system works correctly regardless of connection direction (truly bidirectional)

#### Critical: Always Call syncToReactFlow() After State Changes

**Recurring Issue**: The React Flow UI and core propagation network can get out of sync
**Solution**: Always call `syncToReactFlow()` after any operation that changes the network state

```typescript
// Example from wire removal fix:
if (changes.some(change => change.type === 'remove')) {
  syncToReactFlow()  // Critical! Without this, UI won't reflect cleared contact values
}
```

This pattern should be followed for:
- Wire removal/addition
- Contact value changes
- Group navigation
- Any operation that modifies the propagation network state

The `syncToReactFlow()` method rebuilds the React Flow nodes/edges from the core network state, ensuring the UI accurately reflects the current state of the propagation network.

### Primitive Gadget Behavior Fix

Fixed an issue where primitive gadgets weren't clearing their outputs when inputs were missing:

#### The Problem
- Initially, outputs were only cleared when ALL inputs were undefined
- But primitive gadgets should clear outputs when ANY required input is missing
- For example, an Adder can't compute if either input is missing

#### The Solution
Changed the `maybeRun()` logic in PrimitiveGadget:
```typescript
// Before: Only cleared when all inputs undefined
if (allInputsUndefined) {
  this.clearAllOutputs()
}

// After: Clear whenever activation returns false
if (this.activation(inputs)) {
  const outputs = this.body(inputs)
  this.propagateOutputs(outputs)
} else {
  this.clearAllOutputs()  // Missing required inputs
}
```

Now primitive gadgets properly clear outputs when any required input is disconnected.

### Context Menu for Resetting Contact Values

Added right-click context menu to reset contact values:

#### Implementation
- Right-click any contact to show context menu
- "Reset Value (∅)" option sets content to undefined
- Uses React portal to render at exact cursor position
- Fixed positioning by using `createPortal` to document.body with clientX/clientY

```typescript
const handleContextMenu = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  setContextMenuPos({ x: e.clientX, y: e.clientY })
  setShowContextMenu(true)
}, [])
```

### Theme System Refactoring

Refactored the entire theming system to follow shadcn/ui patterns:

#### 1. Semantic Color Variables
Added node-specific colors that adapt to light/dark mode:
```css
--node-contact: var(--primary);
--node-group: oklch(0.65 0.15 280);
--node-primitive: oklch(0.55 0.18 250);
--node-boundary: oklch(0.75 0.15 85);
```

#### 2. Utility Classes
Created reusable gradient and border utilities:
```css
.node-gradient-contact { /* gradient using theme colors */ }
.node-border-contact { /* border using theme colors */ }
.node-ring-contact { /* selection ring using theme colors */ }
```

#### 3. CVA Variants
Used class-variance-authority for node styling:
```typescript
const nodeVariants = cva("min-w-[100px] transition-all", {
  variants: {
    nodeType: {
      contact: "node-gradient-contact node-border-contact",
      boundary: "node-gradient-boundary node-border-boundary"
    }
  }
})
```

#### Benefits
- No more hardcoded colors or inline styles
- Proper dark mode support
- Easy to customize via CSS variables
- Follows shadcn's extensibility philosophy
- Clean, maintainable component code

### Theme Implementation - Doom 64

Applied the Doom 64 theme from shadcn/ui themes collection:

#### Key Theme Characteristics
1. **Sharp, angular design** - `--radius: 0px` for retro gaming aesthetic
2. **Gaming-inspired colors** - Oranges, greens, blues with darker palette
3. **Custom fonts**:
   - Sans: "Oxanium" (futuristic gaming font)
   - Mono: "Source Code Pro"
4. **Dramatic shadows** - Higher opacity and blur for depth

#### Font Loading Fix
**Issue**: Fonts weren't being applied even though CSS variables were set

**Solution**: Updated the font imports in `root.tsx`:
```typescript
// Before: Loading Inter font
href: "https://fonts.googleapis.com/css2?family=Inter..."

// After: Loading theme fonts
href: "https://fonts.googleapis.com/css2?family=Oxanium:wght@200..800&family=Source+Code+Pro..."
```

**Key Learning**: When applying shadcn themes with custom fonts, you must:
1. Update the Google Fonts import in `root.tsx` to load the theme's fonts
2. The CSS variables alone aren't enough - the fonts need to be loaded
3. The base styles in `app.css` already apply `font-family: var(--font-sans)` to body

The Doom 64 theme now fully applies with its distinctive angular design and gaming-inspired typography.

## Phase 7: Property Panel and React Best Practices

### Critical Lessons Learned

#### 1. React Best Practices MUST Be Followed
- **NEVER use document.addEventListener in React components** - This is an anti-pattern that breaks React's event system
- Instead use React's event handlers, portals with backdrops, or proper state management
- Bad: `document.addEventListener('click', handler)` 
- Good: Backdrop div with onClick handler or using React Flow's built-in events

#### 2. Event Handling and Focus Management
- Keyboard shortcuts must check if user is typing in input fields:
  ```typescript
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
  ```
- Blur handlers on inputs can cause unwanted side effects (lost selection, focus fighting)
- Use explicit actions (buttons, Enter key) instead of onBlur for saving changes

#### 3. UI State Separation
- Inline editing in nodes creates complexity and focus issues
- Better pattern: Separate property panel for editing, nodes just display values
- Single click = select, Double click = edit (industry standard pattern)

#### 4. Circular Dependencies and Re-render Loops
- Be extremely careful with useCallback dependencies
- Adding state that the callback modifies to its deps creates infinite loops
- Example: `syncToReactFlow` modifying `nodes` while having `nodes` in deps
- Solution: Use separate state (like selection state) instead of reading from what you're updating

#### 5. Cursor Feedback
- ALL interactive elements need proper cursor styling
- Buttons, Switches, Selects should have `cursor-pointer`
- Disabled state should have `cursor-not-allowed`
- This is often missing from UI libraries and needs to be added

#### 6. Selection Preservation
- When updating UI state, preserve user's selection
- Use selection state to mark nodes as selected when rebuilding
- Don't let UI updates reset user's workflow

#### 7. Controlled vs Uncontrolled Focus
- Don't auto-focus inputs on selection - it's jarring
- Only focus when explicitly requested (double-click, keyboard shortcut)
- Use refs and flags to control when focus should happen

### Hacky Patterns to Avoid
1. Timing-based solutions (setTimeout for race conditions)
2. Global document listeners in React components
3. String parsing for complex data types
4. Blur handlers for saving data
5. Not cleaning up event listeners
6. Using refs for state that should be in React state

### Better Patterns Implemented
1. Property panel as a slide-out panel (like Figma)
2. Rich type-specific inputs instead of string parsing
3. Explicit Apply button instead of blur saves
4. React portal with backdrop for context menus
5. Selection state separate from node state
6. Flag-based focus control for property panel

### Merge Mode and Contradiction UI
- Added toggle switch for blend modes (accept-last vs merge)
- Visual indicators for merge mode (green dot) and contradictions (red ring)
- Implemented mergeable types: Color (RGB blending), ConsensusBoolean, Point2D, ExactString
- Property panel provides type-specific inputs for all mergeable types

### Future Improvements: Better React Patterns

#### Current Code Smells
1. **Manual syncToReactFlow() calls everywhere** - Error-prone and easy to forget
2. **Direct network manipulation** - Components reaching into network internals
3. **Imperative updates** - Calling methods instead of declarative state changes
4. **Scattered state updates** - Same logic repeated in multiple places

#### Proposed Hook-Based Architecture
Instead of:
```typescript
// Current (bad) pattern
nodeData.setContent(newContent)
network.syncToReactFlow() // Easy to forget!
```

Build proper React hooks:
```typescript
// Future (good) pattern
const contact = useContact(contactId)
contact.setContent(newContent) // Automatically triggers sync

// Or even better - fully declarative
const [content, setContent] = useContactContent(contactId)
setContent(newContent) // React handles everything
```

#### Suggested Hooks to Implement
1. **useContact(id)** - Returns contact state and mutation methods
   - `content`, `setContent()` 
   - `blendMode`, `setBlendMode()`
   - `position`, `setPosition()`
   - Automatically handles sync and re-renders

2. **useWire(id)** - Wire state management
   - `connect()`, `disconnect()`
   - `type`, `setType()`

3. **useGroup(id)** - Group/gadget operations
   - `navigate()`, `rename()`, `delete()`
   - `boundaries`, `addBoundary()`

4. **useSelection()** - Already exists but could be enhanced
   - `selectedContacts`, `selectedGroups`
   - `selectContact()`, `clearSelection()`

5. **usePropagation()** - Propagation control
   - `isPropagating`, `propagationPath`
   - `triggerPropagation()`

#### Benefits
- **Declarative** - React manages when to update UI
- **Type-safe** - TypeScript can infer types from hooks
- **Testable** - Hooks can be tested in isolation
- **Reusable** - Same hooks work across all components
- **No manual sync** - Updates automatically trigger re-renders
- **Single source of truth** - State managed in one place

This would make the codebase much more maintainable and truly embrace React's programming model.

## Phase 6: Primitive Gadgets

### What We Built
Implemented primitive gadgets - host-implemented propagators that look like regular gadgets but execute native code:

1. **PrimitiveGadget Base Class**
   - Extends ContactGroup with special `isPrimitive` flag
   - Intercepts `deliverContent` to trigger computation
   - Abstract `computeOutputs()` method for implementations
   - Manually handles output propagation to bypass recursion

2. **Arithmetic Primitives (Unidirectional)**
   - **Adder**: `(a, b) → sum` - Supports numbers and Intervals
   - **Subtractor**: `(minuend, subtrahend) → difference`
   - **Multiplier**: `(a, b) → product` - Full interval arithmetic
   - **Divider**: `(dividend, divisor) → quotient` - Division by zero handling

3. **UI Integration**
   - Lock icon instead of package icon for primitives
   - Blue gradient background (vs purple for regular gadgets)
   - Navigation disabled (no double-click to enter)
   - Automatically added to palette on first load

### Key Architecture Insights

#### Primitives Are Unidirectional
**Key Decision**: Primitive gadgets are simple functions, not bidirectional constraints
- This matches how CPUs work - add instructions don't solve for inputs
- Bidirectional behavior achieved by composing multiple primitives
- Example: `(a + b = c)` constraint built from:
  - Adder: `(a, b) → c`
  - Subtractor: `(c, b) → a`  
  - Subtractor: `(c, a) → b`

#### Clean Primitive Integration
```typescript
// Check if template is primitive during instantiation
if (template.name in PRIMITIVE_GADGETS) {
  const primitive = createPrimitiveGadget(template.name, this.currentGroup)
  // ... position and add to parent
}
```

#### Propagation Interception
```typescript
override deliverContent(contactId: ContactId, content: any, sourceId: ContactId): void {
  // Let contact update normally
  super.deliverContent(contactId, content, sourceId)
  
  // Then compute outputs if input changed
  if (contact.content !== oldContent) {
    this.computeAndPropagate()
  }
}
```

### Implementation Challenges & Solutions

1. **Private Propagate Method**
   - **Issue**: Contact.propagate() is private
   - **Solution**: Manually handle propagation in PrimitiveGadget
   - Access `_content` directly and call deliverContent on connections

2. **Import Organization**
   - **Issue**: Contact not exported from ContactGroup module
   - **Solution**: Import Contact from its own module

3. **Hydration with Default Gadgets**
   - **Issue**: Need primitives in palette on first load
   - **Solution**: Check localStorage, if empty add default primitives

### What Worked Well

1. **Uniform Interface** - Primitives look identical to regular gadgets externally
2. **Efficient Implementation** - Native TypeScript code for calculations
3. **Composability** - Can build complex constraints from simple primitives
4. **Visual Distinction** - Lock icon clearly indicates non-navigable gadgets

### Future Primitive Gadgets to Add

- **Comparison**: GreaterThan, LessThan, Equals
- **Logic**: And, Or, Not
- **Data**: Splitter, Joiner, Selector
- **Control**: Switch, Mux, Demux

### Lessons Learned

1. **Keep primitives simple** - They're building blocks, not complete solutions
2. **Unidirectional is cleaner** - Bidirectional behavior emerges from composition
3. **Visual cues matter** - Lock icon immediately communicates "can't open"
4. **Defaults improve UX** - Having primitives pre-loaded helps users start quickly

### Architecture Evolution: Activation/Body Pattern

After initial implementation, we refactored primitive gadgets to use a cleaner activation/body pattern:

#### The Pattern
```typescript
class PrimitiveGadget {
  protected abstract activation(boundaryValues: Map<ContactId, [Contact, any]>): boolean
  protected abstract body(boundaryValues: Map<ContactId, [Contact, any]>): Map<ContactId, any>
  
  protected maybeRun() {
    const inputs = this.getAllBoundaryValues()
    if (this.activation(inputs)) {
      const outputs = this.body(inputs)
      this.propagateOutputs(outputs)
    } else {
      // Keep existing outputs (latch behavior)
      // Only clear if ALL inputs are undefined
    }
  }
}
```

#### Key Insights

1. **Primitive gadgets are function wrappers** - They make regular JS functions work in the propagation network
2. **Activation determines WHEN to run** - Typically checks if all required inputs are present
3. **Body computes WHAT to output** - Pure computation based on inputs
4. **Latch behavior** - Outputs persist until new computation or full disconnection
5. **Wire removal triggers recomputation** - When wire removed, undefined is delivered, triggering maybeRun()

#### Implementation Details

- `deliverContent()` stores input value then calls `maybeRun()`
- `removeWire()` in ContactGroup clears content if no incoming connections remain
- Outputs only cleared when ALL inputs are undefined (complete disconnection)
- This gives stateless computation with sensible persistence

#### Future Extensions
This pattern will make it trivial to:
- Import JS libraries and wrap their functions as primitive gadgets
- Support async operations (activation could check if async operation is ready)
- Add more complex activation policies (e.g., run only if value changed by threshold)

## Session 4: UI Polish and Edge Interactions (2025-08-02)

### What We Built
1. **Configuration System**
   - Comprehensive settings panel with tabs (propagation, visual, behavior)
   - Persistent settings with localStorage
   - Default blend modes for contacts and boundaries
   - Visual settings for edge visibility, opacity, and fat edge rendering

2. **Improved Merge System**
   - Added new mergeable types: NumericRange, StringSet, WeightedAverage, TimestampValue
   - Better error handling with MergeResult type
   - Fixed merge rules that weren't working correctly

3. **New Primitive Gadgets**
   - Set operations: Union, Intersection, Difference
   - Array operations: Splitter3, Joiner3 (3-way variants)
   - Fixed splitters/joiners to be true array constructors/destructors
   - Added icons for all new gadgets

4. **Visual Improvements**
   - Fat edge rendering with gradients for complex data types
   - Removed excessive edge animations
   - Proper theme-based canvas background
   - Smaller, better-aligned text in contacts (9px font, 3-line clamp)
   - Added select-none to prevent text selection during drag

5. **Interaction Improvements**
   - Edge drop now spawns contact directly (no menu)
   - Auto-select for all number inputs
   - Fixed infinite render loop during drag selection

### Key Technical Decisions
- **Selection State Management**: Let React Flow manage the `selected` property internally while maintaining our own selection state for UI purposes. This prevents circular dependencies.
- **Fat Value Detection**: Created utility functions to detect and measure "thickness" of values (arrays, sets, objects)
- **Effect Splitting**: Separated concerns into multiple useEffect hooks for better maintainability

### Lessons Learned
- React Flow's internal selection management can conflict with external state synchronization
- Missing dependencies in useEffect can cause stale closures and infinite loops
- Visual feedback (like fat edges) greatly improves understanding of data flow
- Small UI improvements (font size, auto-select) have big impact on usability

## Next Steps

- Performance optimization for large networks
- Undo/redo system  
- Network persistence and serialization
- Additional primitive gadgets (filters, transformers, aggregators)
- Enhanced debugging tools (value inspection, propagation tracing)
- Keyboard shortcuts for common operations
- Copy/paste functionality for contacts and gadgets