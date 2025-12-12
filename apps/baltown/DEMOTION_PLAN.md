# Demotion System Design for Bassline Workbench

The inverse of promotion - breaking resources down into their constituent parts.

## 1. Clear Definitions: What Demotion Means for Each Resource Type

### Recipe -> Individual Resources ("Explode")

**Source**: A recipe instance at `bl:///instances/{name}`
**Result**: The constituent resources become "unbound" - visible as independent entities on the canvas, editable individually

**What happens**:

- The recipe instance record is deleted from the instance store
- The created resources (cells, propagators) remain in place but lose their "instance" grouping
- URIs remain the same (e.g., `bl:///cells/myrecipe-counter` stays as is)
- The visual group boundary on the canvas dissolves
- Resources become individually selectable and promotable

**Why useful**: User wants to customize one propagator in an instantiated recipe, or extract part of a recipe for reuse elsewhere.

### Propagator -> Handler Composition + Cell References ("Extract")

**Source**: A propagator at `bl:///propagators/{name}`
**Result**:

- Handler composition becomes a selectable/editable hiccup node in the workbench
- Input/output cell URIs are exposed as connection metadata
- The propagator can optionally be deleted, leaving cells intact

**What happens**:

- The handler definition (`handler` + `handlerConfig`) is extracted into a standalone composition object
- This composition can be edited in HiccupComposer
- Can be saved as a named handler at `bl:///handlers/custom/{name}`
- The original propagator can remain (inspect mode) or be deleted (destructive extract)

**Why useful**: User built a complex pipe/fork/converge in a propagator and wants to reuse that handler logic elsewhere.

### Composed Handler -> Sub-handlers ("Decompose")

**Source**: A hiccup array like `['pipe', 'sum', ['multiply', {value: 2}]]`
**Result**: The composition is "flattened" into individual handler nodes, each editable separately

**What happens**:

- `['pipe', A, B, C]` becomes three separate handler selections: A, B, C
- Each can be reconfigured independently
- Can be reassembled into a different combinator (e.g., change from `pipe` to `fork`)

**Why useful**: User wants to insert a step in the middle of a pipeline, or rearrange the composition order.

### Instance -> Recipe + Live Resources ("Detach")

**Source**: An instance created from a recipe
**Result**: The recipe definition is preserved but the instance link is severed

**What happens**:

- Instance record is removed from instance store
- Resources remain in place
- User can now modify resources without affecting other instances of the same recipe

## 2. UI Patterns for Triggering Demotion

### Primary Pattern: Inspector Panel Actions

When a resource is selected, the Inspector panel shows a "Demote" section at the bottom (above Delete):

```
+----------------------------------+
| Inspector                    [X] |
|----------------------------------|
| [PROPAGATOR] double-sum          |
|                                  |
| URI: bl:///propagators/double... |
| Handler: [pipe]                  |
| ...                              |
|----------------------------------|
| DEMOTE                           |
| [Extract Handler]                |
|   Save handler composition       |
|   as reusable resource           |
|                                  |
| [Detach Cells]                   |
|   Remove propagator, keep cells  |
|----------------------------------|
| [Delete]                         |
+----------------------------------+
```

For recipe instances:

```
+----------------------------------+
| Inspector                    [X] |
|----------------------------------|
| [INSTANCE] counter-v1            |
|                                  |
| Recipe: counter-recipe           |
| Resources: 3                     |
|----------------------------------|
| DEMOTE                           |
| [Explode Instance]               |
|   Ungroup resources, delete      |
|   instance binding               |
|                                  |
| [Fork & Explode]                 |
|   Create copies of resources     |
|   unbound from recipe            |
|----------------------------------|
| [Delete Instance]                |
+----------------------------------+
```

### Secondary Pattern: Context Menu (Right-Click)

Right-clicking a node on the canvas shows:

```
+------------------+
| Inspect          |
| Select Related   |
|------------------|
| Demote >         |
|   Extract Handler|
|   Detach Cells   |
|------------------|
| Delete           |
+------------------+
```

### Tertiary Pattern: Toolbox Actions (Multi-Select)

When multiple resources from the same instance are selected:

```
SELECTED (3)
- counter
- doubled
- double-prop

[DEMOTE]
[Explode Group]  <- Appears when all belong to same instance
```

## 3. Visual Feedback When Something is Demoted

### Explode Animation (Recipe -> Resources)

1. The group boundary (dotted box) starts pulsing
2. A "burst" effect emanates from the center
3. The boundary dissolves outward (fade + scale up)
4. Individual resources "settle" into place with a slight bounce
5. A toast appears: "Instance exploded - 3 resources now independent"

### Extract Animation (Propagator -> Handler)

1. The propagator node glows purple (handler color)
2. A "ghost" of the handler composition rises up from the propagator
3. The ghost floats to the Toolbox panel on the left
4. A new "Handler Composition" item appears in the toolbox
5. Toast: "Handler extracted - now available in Toolbox"

### Decompose Animation (Composed Handler -> Sub-handlers)

1. Inside HiccupComposer, the composed node expands
2. Children "pop out" with a spring animation
3. Each child becomes a separate draggable element
4. Visual brackets around the composition fade out

### CSS Animation Keyframes

```css
@keyframes explode-burst {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

@keyframes node-settle {
  0% {
    transform: translateY(-10px);
    opacity: 0.5;
  }
  60% {
    transform: translateY(3px);
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes extract-float {
  0% {
    transform: translateX(0) translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateX(-200px) translateY(-50px);
    opacity: 0.5;
  }
}
```

## 4. Ownership and Naming of Demoted Resources

### Naming Strategy

**Explode Instance**:

- Resources keep their existing URIs
- No renaming needed - they were already created with proper names

**Extract Handler**:

- Default name: `{propagator-name}-handler`
- User prompted: "Save handler as: [_________]"
- If handler already exists, offer to overwrite or rename

**Decompose Handler**:

- No persistent naming - these are ephemeral editing states
- If user wants to save a sub-handler, they use "Promote to Named Handler"

### Ownership Tracking

Add a `demotedFrom` field to track provenance:

```javascript
// When extracting a handler from a propagator
{
  uri: 'bl:///handlers/custom/double-handler',
  body: {
    definition: ['pipe', 'sum', ['multiply', {value: 2}]],
    demotedFrom: {
      type: 'propagator',
      uri: 'bl:///propagators/double-sum',
      timestamp: '2024-...'
    }
  }
}
```

This enables:

- "Where did this come from?" queries
- Potential "re-attach" or "undo demotion" features
- Audit trail for complex refactoring sessions

## 5. Edge Cases

### Resources Used Elsewhere

**Scenario**: User tries to explode an instance, but one of its cells is referenced by a propagator outside the instance.

**Solution**:

1. Detect external references using link index: `bl._links.getTo(cellUri)`
2. Show warning dialog:

   ```
   This resource is referenced by:
   - propagators/external-calc

   [Explode Anyway] [Cancel] [Show References]
   ```

3. If user proceeds, the external propagator keeps working (cell still exists)

### Circular References

**Scenario**: Propagator A reads from cell X and writes to cell Y. Propagator B reads from Y and writes to X. User tries to demote A.

**Solution**:

1. Demotion of propagators doesn't affect cells
2. The circular dependency continues to exist
3. When demoting to recipe, warn about cycles:

   ```
   Circular dependency detected:
   X -> A -> Y -> B -> X

   This may cause infinite loops if values change.
   [Proceed] [Show Cycle] [Cancel]
   ```

### Partial Demotion

**Scenario**: User selects 2 of 3 resources from an instance and tries to "Explode selected".

**Solution**:

1. Don't allow partial explode - it would leave an inconsistent instance
2. Offer alternatives:

   ```
   Cannot partially explode instance.

   [Select All Instance Resources]
   [Detach Selected Only] <- Creates copies, leaves instance intact
   [Cancel]
   ```

### Nested Compositions

**Scenario**: Handler is `['pipe', ['fork', 'sum', 'product'], 'negate']` - deeply nested.

**Solution**:

1. Decompose only "pops" one level at a time
2. First decompose: `['fork', 'sum', 'product']` and `'negate'` become separate
3. User can then decompose the fork if desired
4. Provide "Flatten All" option for aggressive decomposition

### Instance of Instance

**Scenario**: (Future) A recipe contains another recipe reference.

**Solution**:

1. Explode only affects the immediate instance
2. Nested recipe instances remain intact
3. Offer "Deep Explode" for recursive explosion

## 6. Step-by-Step Implementation Plan

### Phase 1: Backend Infrastructure

**1.1 Add `demote` endpoint to propagators**
File: `packages/propagators/src/propagator.js`

```javascript
// GET /propagators/:name/demote
// Returns the handler composition as a standalone resource
r.get('/:name/demote', ({ params }) => {
  const prop = getPropagator(params.name)
  if (!prop) return null

  return {
    headers: { type: 'bl:///types/handler-composition' },
    body: {
      handler: prop.handlerName,
      handlerConfig: prop.handlerConfig,
      inputs: prop.inputs,
      output: prop.output,
      sourceUri: `bl:///propagators/${params.name}`,
    },
  }
})
```

**1.2 Add `explode` endpoint to instances**
File: `packages/recipes/src/recipe.js`

```javascript
// PUT /instances/:name/explode
// Removes instance binding, keeps resources
r.put('/:name/explode', async ({ params }) => {
  const instance = getInstance(params.name)
  if (!instance) return null

  const resources = instance.createdResources
  instanceStore.delete(params.name)

  // Dispatch event
  bl._plumber?.dispatch({
    uri: `bl:///instances/${params.name}`,
    method: 'explode',
    headers: { type: 'bl:///types/instance-exploded' },
    body: {
      instance: params.name,
      freedResources: resources.map((r) => r.uri),
    },
  })

  return {
    headers: { type: 'bl:///types/instance-exploded' },
    body: { resources },
  }
})
```

**1.3 Add custom handler saving**
File: `packages/handlers/src/routes.js`

Track provenance when saving:

```javascript
r.put('/:name', ({ params, body }) => {
  registerCustom(params.name, {
    definition: body.definition,
    description: body.description,
    demotedFrom: body.demotedFrom, // Track source
  })
  // ...
})
```

### Phase 2: Selection Store Enhancements

**2.1 Add instance tracking**
File: `apps/baltown/src/stores/selection.ts`

```typescript
interface SelectedResource {
  uri: string
  type: SelectionType
  name: string
  data?: any
  instanceName?: string // NEW: Which instance does this belong to?
}

// NEW: Check if all selected resources belong to the same instance
const sameInstance = () => {
  const items = selected()
  if (items.length === 0) return null
  const instances = new Set(items.map((i) => i.instanceName).filter(Boolean))
  if (instances.size === 1) return [...instances][0]
  return null
}
```

### Phase 3: UI Components

**3.1 Create DemotionActions component**
File: `apps/baltown/src/components/workbench/DemotionActions.tsx`

```typescript
interface DemotionActionsProps {
  onResourceDemoted: () => void
}

export default function DemotionActions(props: DemotionActionsProps) {
  const { primarySelection, selectionType, sameInstance } = selectionStore

  // Show different actions based on what's selected
  const canExtractHandler = () => selectionType() === 'propagator'
  const canExplodeInstance = () => sameInstance() !== null
  const canDecomposeHandler = () => selectionType() === 'handler' && isComposed()

  // ... render buttons for each action
}
```

**3.2 Add to WorkbenchInspector**
File: `apps/baltown/src/components/workbench/WorkbenchInspector.tsx`

Add a "Demote" section between the resource details and the Delete button.

**3.3 Create ExtractHandlerModal**
File: `apps/baltown/src/components/workbench/ExtractHandlerModal.tsx`

Modal for naming and saving extracted handler:

- Shows handler preview (HiccupComposer in read-only mode)
- Name input field
- "Save as Named Handler" button
- "Save & Delete Propagator" button

**3.4 Create ExplodeConfirmModal**
File: `apps/baltown/src/components/workbench/ExplodeConfirmModal.tsx`

Confirmation dialog showing:

- List of resources that will be "freed"
- Warning about external references (if any)
- Confirm/Cancel buttons

### Phase 4: Graph Animations

**4.1 Add explosion animation to CytoscapeGraph**
File: `apps/baltown/src/components/graph/CytoscapeGraph.tsx`

```typescript
function animateExplode(instanceName: string) {
  // Find all nodes belonging to instance
  const nodes = cy.nodes(`[instanceName = "${instanceName}"]`)

  // Add burst effect
  nodes.addClass('exploding')

  // After animation, remove instance grouping
  setTimeout(() => {
    nodes.removeClass('exploding')
    nodes.data('instanceName', null)
  }, 500)
}
```

**4.2 Add extract animation**

```typescript
function animateExtract(propagatorUri: string) {
  const node = cy.getElementById(propagatorUri)

  // Create ghost node
  const ghost = createGhostNode(node)
  ghost.addClass('extracting')

  // Animate to toolbox position
  ghost.animate(
    {
      position: { x: -200, y: node.position().y - 50 },
      style: { opacity: 0.3 },
    },
    { duration: 400 }
  )

  setTimeout(() => ghost.remove(), 500)
}
```

### Phase 5: Integration & Polish

**5.1 Wire up plumber events**
Listen for `instance-exploded` events to trigger animations:

```typescript
bl._plumber.listen('explode-events', (msg) => {
  if (msg.headers.type === 'bl:///types/instance-exploded') {
    animateExplode(msg.body.instance)
    toast.success(`Instance "${msg.body.instance}" exploded`)
  }
})
```

**5.2 Add toast notifications**

- "Handler extracted and saved as {name}"
- "Instance exploded - {n} resources now independent"
- "Handler decomposed into {n} sub-handlers"

**5.3 Add keyboard shortcuts**

- `Cmd+Shift+D` - Demote selected (opens appropriate dialog)
- `Cmd+E` - Extract handler (when propagator selected)

**5.4 Update ToolboxPanel**
Show extracted handlers in a new "Saved Handlers" section.

### Phase 6: Testing & Documentation

**6.1 Add tests**

- Test propagator demotion preserves handler structure
- Test instance explosion keeps resources intact
- Test external reference warnings appear correctly
- Test animations complete without errors

**6.2 Update CLAUDE.md**
Document the demotion system alongside promotion.

---

## Summary

The demotion system provides the crucial "undo" capability for the Lego-style development model:

| Resource Type    | Demotion Operation | Result                         |
| ---------------- | ------------------ | ------------------------------ |
| Recipe Instance  | Explode            | Individual cells + propagators |
| Propagator       | Extract Handler    | Saved handler composition      |
| Propagator       | Detach Cells       | Handler removed, cells remain  |
| Composed Handler | Decompose          | Individual sub-handlers        |

This completes the promotion/demotion cycle, enabling true "refactoring" of Bassline resource compositions.
