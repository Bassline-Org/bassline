# Action Stack Pattern

A stack-based command queue interaction pattern for Bassline, inspired by Magic: The Gathering's stack mechanic and research in Human-Computer Interaction.

## Overview

Instead of immediate execution, user actions queue on a **stack** and resolve in LIFO (last-in, first-out) order. This enables:

- **Deferred execution** - Configure actions before committing
- **Composition** - Build complex operations from simple parts
- **Meta-actions** - Actions that target other pending actions
- **Undo before commit** - Cancel queued actions before they run
- **Visibility** - See exactly what will happen before it does

## Theoretical Foundation

### Instrumental Interaction (Beaudouin-Lafon, CHI 2000)

Our pattern implements Michel Beaudouin-Lafon's four principles for post-WIMP interfaces:

1. **Reification** - Abstract operations become manipulable objects (our `StackedAction`)
2. **Polymorphism** - Same action pattern works on different resource types
3. **Reuse** - Previously-configured actions can be duplicated
4. **Currying** - Partial application via "building" state before commitment

> "Reification results in increased power, while polymorphism keeps interfaces simple."

### Command Pattern + Event Sourcing

Each `StackedAction` is a first-class command object that can be:

- Inspected before execution
- Modified while building
- Cancelled before resolution
- Duplicated for reuse
- Logged for audit trail

This mirrors The Composable Architecture (TCA) in Swift, where all user actions flow through a central store as typed objects.

### Verb-Object Grammar (Vim) vs Object-Verb (Kakoune)

Two competing interaction grammars exist:

| Pattern                   | Example                | Feedback            | Error Recovery |
| ------------------------- | ---------------------- | ------------------- | -------------- |
| **Verb-Object** (Vim)     | `d3w` (delete 3 words) | None until done     | Undo after     |
| **Object-Verb** (Kakoune) | `3W` then `d`          | See selection first | Adjust before  |

Our current implementation is **verb-first** (pick action, then configure). Future versions could support **selection-first** for better visual feedback.

## Inspiration

### Magic: The Gathering Stack

In MTG, spells and abilities don't resolve immediately. They go on "the stack" and players can respond before resolution. The last thing added resolves first (LIFO).

```
Player A: Cast Lightning Bolt (goes on stack)
Player B: Cast Counterspell targeting Lightning Bolt (goes on stack)
Resolution: Counterspell resolves first → Lightning Bolt is countered
```

Our system uses the same mechanic for UI operations.

### Similar Patterns

| Pattern               | Relationship                                             |
| --------------------- | -------------------------------------------------------- |
| **Command Queue**     | Direct match - deferred command execution                |
| **Undo/Redo Stack**   | Structural similarity (stack of operations)              |
| **Modal Interaction** | Building mode = explicit interaction mode                |
| **State Machine**     | Action lifecycle (building → pending → resolving → done) |
| **Event Sourcing**    | Commands as first-class objects                          |

### Similar Tools

- **MTG Arena** - Visual stack with response windows
- **Vim** - Composable commands (verb + object)
- **Houdini/Blender** - Node-based visual programming
- **VS Code Command Palette** - Searchable action list

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ActionTest Page                          │
├──────────────┬─────────────────────────┬───────────────────────┤
│ ActionSidebar │      ActionGraph        │     StackPanel        │
│              │                         │                       │
│ ┌──────────┐ │  ┌─────────────────┐    │  ┌─────────────────┐  │
│ │Create    │ │  │                 │    │  │ Building        │  │
│ │  Cell    │ │  │   Cytoscape     │    │  │ [Create Cell]   │  │
│ │  Prop    │ │  │   Graph +       │    │  ├─────────────────┤  │
│ ├──────────┤ │  │   Action        │    │  │ Pending Stack   │  │
│ │Stack     │ │  │   Overlay       │    │  │ [Prop] ← next   │  │
│ │  Cancel  │ │  │                 │    │  │ [Cell]          │  │
│ │  Dup     │ │  └─────────────────┘    │  ├─────────────────┤  │
│ └──────────┘ │                         │  │ [Resolve Next]  │  │
│              │                         │  │ [Auto-resolve]  │  │
└──────────────┴─────────────────────────┴───────────────────────┘
```

## Key Types

### Action

The base action interface. Actions are factories that produce UI + execution logic.

```typescript
interface Action {
  id: string
  name: string
  description?: string
  icon: () => JSXElement

  // Lifecycle
  onStart(ctx: ActionContext): void
  onCancel(): void
  onClick(node: NodeSingular): void
  onKeyDown(event: KeyboardEvent): void

  // UI
  renderOverlay(): JSXElement

  // Completion
  isComplete(): boolean
  execute(): Promise<void>
}
```

### StackedAction

An action instance on the stack with status and collected targets.

```typescript
interface StackedAction {
  id: string // Unique instance ID
  action: Action // The action definition
  status: StackedActionStatus
  targets: ActionTargets // Collected data (nodes, cells, etc.)
  summary?: string // Human-readable description
}

type StackedActionStatus =
  | 'building' // Currently being configured
  | 'pending' // Waiting on stack
  | 'resolving' // Currently executing
  | 'resolved' // Completed successfully
  | 'cancelled' // Removed without executing
```

### MetaAction

Actions that target other pending actions on the stack.

```typescript
interface MetaAction extends Action {
  isMeta: true
  onStackItemClick(item: StackedAction): void
}
```

### ActionContext

The context provided to actions for interacting with the system.

```typescript
interface ActionContext {
  bl: BasslineClient // API client
  toast: ToastManager // Notifications
  complete(): void // Signal action is ready
  cancel(): void // Abort the action
  refresh(): void // Refresh graph data
}
```

## Action Lifecycle

```
┌──────────┐    complete()    ┌─────────┐    resolveNext()    ┌───────────┐
│ building │ ───────────────► │ pending │ ─────────────────► │ resolving │
└──────────┘                  └─────────┘                     └───────────┘
     │                             │                               │
     │ cancel()                    │ cancelAction(id)              │ success
     ▼                             ▼                               ▼
┌──────────┐                  ┌───────────┐                  ┌──────────┐
│ (removed)│                  │ cancelled │                  │ resolved │
└──────────┘                  └───────────┘                  └──────────┘
```

1. **Building** - User is configuring the action (selecting targets, filling forms)
2. **Pending** - Action is complete and waiting on the stack
3. **Resolving** - Action's `execute()` is running
4. **Resolved** - Action completed successfully
5. **Cancelled** - Action was removed without executing

## Creating Actions

### Simple Form Action

Actions that show a form overlay and execute on submit.

```typescript
// actions/createCell.tsx
export function createCellAction(): Action {
  let ctx: ActionContext | null = null
  const [name, setName] = createSignal('')
  const [lattice, setLattice] = createSignal('lww')
  const [ready, setReady] = createSignal(false)

  return {
    id: 'create-cell',
    name: 'Create Cell',

    icon: () => <CellIcon />,

    onStart(context) {
      ctx = context
      setName('')
      setLattice('lww')
      setReady(false)
    },

    onCancel() { ctx = null },
    onClick() { /* Form actions don't use graph clicks */ },

    onKeyDown(event) {
      if (event.key === 'Enter' && name().trim()) {
        setReady(true)
        ctx?.complete()
      }
    },

    renderOverlay() {
      return (
        <div class="overlay-card">
          <input value={name()} onInput={e => setName(e.target.value)} />
          <select value={lattice()} onChange={e => setLattice(e.target.value)}>
            <option value="lww">LWW</option>
            <option value="maxNumber">Max Number</option>
          </select>
          <button onClick={() => { setReady(true); ctx?.complete() }}>
            Create
          </button>
        </div>
      )
    },

    isComplete() { return ready() && name().trim().length > 0 },

    async execute() {
      await ctx.bl.put(`bl:///r/cells/${name()}`, {}, { lattice: lattice() })
      ctx.toast.success(`Created cell "${name()}"`)
      ctx.refresh()
    }
  }
}
```

### Multi-Step Targeting Action

Actions that collect multiple targets through graph interaction.

```typescript
// actions/createPropagator.tsx
export function createPropagatorAction(): Action {
  let ctx: ActionContext | null = null
  const [step, setStep] = createSignal<'inputs' | 'output' | 'config'>('inputs')
  const [inputs, setInputs] = createSignal<string[]>([])
  const [output, setOutput] = createSignal<string | null>(null)
  const [handler, setHandler] = createSignal('identity')

  return {
    id: 'create-propagator',
    name: 'Create Propagator',

    onStart(context) {
      ctx = context
      setStep('inputs')
      setInputs([])
      setOutput(null)
    },

    onClick(node) {
      const uri = node.data('uri')
      const currentStep = step()

      if (currentStep === 'inputs') {
        // Toggle input selection
        const current = inputs()
        if (current.includes(uri)) {
          setInputs(current.filter(u => u !== uri))
        } else {
          setInputs([...current, uri])
        }
      } else if (currentStep === 'output') {
        setOutput(uri)
        setStep('config')  // Advance to config
      }
    },

    onKeyDown(event) {
      if (event.key === 'Enter') {
        if (step() === 'inputs' && inputs().length > 0) {
          setStep('output')
        } else if (step() === 'config' && output()) {
          ctx?.complete()
        }
      }
    },

    renderOverlay() {
      return (
        <div class="targeting-prompt">
          <Show when={step() === 'inputs'}>
            <p>Click cells to select inputs ({inputs().length} selected)</p>
            <p>Press Enter when done</p>
          </Show>
          <Show when={step() === 'output'}>
            <p>Click a cell for output</p>
          </Show>
          <Show when={step() === 'config'}>
            <select value={handler()} onChange={e => setHandler(e.target.value)}>
              <option value="sum">Sum</option>
              <option value="product">Product</option>
            </select>
            <button onClick={() => ctx?.complete()}>Create</button>
          </Show>
        </div>
      )
    },

    isComplete() {
      return step() === 'config' && inputs().length > 0 && output() !== null
    },

    async execute() {
      await ctx.bl.put(`bl:///r/propagators/prop-${Date.now()}`, {}, {
        inputs: inputs(),
        output: output(),
        handler: handler()
      })
      ctx.toast.success('Created propagator')
      ctx.refresh()
    }
  }
}
```

### Meta-Action

Actions that target other pending actions on the stack.

```typescript
// actions/cancel.tsx
export function cancelAction(): MetaAction {
  let ctx: StackActionContext | null = null
  const [targetId, setTargetId] = createSignal<string | null>(null)

  const availableTargets = () => {
    const building = stackStore.buildingAction()
    return stackStore.pendingItems().filter(item => item.id !== building?.id)
  }

  return {
    id: 'cancel-action',
    name: 'Cancel',
    isMeta: true,  // Marks this as a meta-action

    onStart(context) {
      ctx = context as StackActionContext
      setTargetId(null)
    },

    onClick() { /* Meta-actions don't use graph clicks */ },

    onStackItemClick(item: StackedAction) {
      // Called when user clicks a stack item
      setTargetId(item.id)
      ctx?.complete()
    },

    renderOverlay() {
      return (
        <div class="meta-prompt">
          <h3>Cancel Action</h3>
          <p>Click an action in the stack to cancel it</p>
          <For each={availableTargets()}>
            {(item) => (
              <button onClick={() => { setTargetId(item.id); ctx?.complete() }}>
                {item.action.name}
              </button>
            )}
          </For>
        </div>
      )
    },

    isComplete() { return targetId() !== null },

    async execute() {
      stackStore.cancelAction(targetId()!)
      ctx?.toast.info('Cancelled action')
    }
  }
}
```

## Stack Store

The central store managing the action stack.

```typescript
// stores/stack.ts
function createStackStore() {
  const [stack, setStack] = createSignal<StackedAction[]>([])
  const [autoResolve, setAutoResolve] = createSignal(false)
  const [buildingAction, setBuildingAction] = createSignal<StackedAction | null>(null)
  const [isResolving, setIsResolving] = createSignal(false)

  // Derived state
  const pendingItems = createMemo(() => stack().filter((item) => item.status === 'pending'))

  // Start building a new action
  function startAction(action: Action, context: Omit<ActionContext, 'complete' | 'cancel'>) {
    const id = `action-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const stacked: StackedAction = {
      id,
      action,
      status: 'building',
      targets: {},
    }

    const fullContext: ActionContext = {
      ...context,
      complete: () => completeBuilding(),
      cancel: () => cancelBuilding(),
    }

    setBuildingAction(stacked)
    action.onStart(fullContext)
  }

  // Move building action to pending
  async function completeBuilding() {
    const building = buildingAction()
    if (!building || !building.action.isComplete()) return

    setBuildingAction(null)
    const pending = { ...building, status: 'pending' as const }
    setStack((prev) => [...prev, pending])

    if (autoResolve()) {
      await resolveNext()
    }
  }

  // Resolve the top pending action
  async function resolveNext() {
    const pending = pendingItems()
    if (pending.length === 0 || isResolving()) return

    const top = pending[pending.length - 1] // LIFO
    setIsResolving(true)

    // Update status to resolving
    setStack((prev) =>
      prev.map((item) => (item.id === top.id ? { ...item, status: 'resolving' } : item))
    )

    try {
      await top.action.execute()
      // Update status to resolved
      setStack((prev) =>
        prev.map((item) => (item.id === top.id ? { ...item, status: 'resolved' } : item))
      )
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setIsResolving(false)
    }
  }

  return {
    stack,
    buildingAction,
    pendingItems,
    autoResolve,
    isResolving,
    startAction,
    completeBuilding,
    cancelBuilding,
    resolveNext,
    resolveAll,
    cancelAction,
    duplicateAction,
    toggleAutoResolve,
    handleClick,
    handleStackItemClick,
    handleKeyDown,
  }
}

export const stackStore = createStackStore()
```

## Keyboard Shortcuts

| Key      | Action                          |
| -------- | ------------------------------- |
| `Space`  | Resolve next pending action     |
| `Escape` | Cancel building action          |
| `Enter`  | Advance/complete current action |

## Resolution Modes

### Manual Mode (Auto-resolve OFF)

Actions queue on the stack. User explicitly resolves with:

- "Resolve Next" button
- Space key
- "Resolve All" button

This allows building up multiple operations and reviewing before execution.

### Auto Mode (Auto-resolve ON)

Actions execute immediately when completed. Stack stays empty (or briefly shows resolving state).

Good for rapid iteration when you trust each action.

## Visual Design

### Stack Panel

- Right sidebar (280px width)
- Shows pending actions in visual stack order
- "Next to resolve" badge on top item
- Resolve/Clear controls at bottom

### Stack Card

```
┌─────────────────────────────────────┐
│ ● Create Cell           [building] │
│   name: my-counter                 │
│   lattice: maxNumber               │
└─────────────────────────────────────┘
```

Status indicators:

- Orange dot = building
- Blue dot = pending
- Spinning = resolving
- Green check = resolved
- Red X = cancelled

### Action Overlays

Overlays appear over the graph area:

- Form overlays: Centered card with form fields
- Targeting overlays: Top banner with instructions
- Meta overlays: List of targetable stack items

## File Structure

```
apps/baltown/src/
├── stores/
│   └── stack.ts              # Stack store
├── actions/
│   ├── types.ts              # Action, StackedAction, MetaAction
│   ├── createCell.tsx        # Simple form action
│   ├── createPropagator.tsx  # Multi-step targeting action
│   ├── cancel.tsx            # Meta-action
│   └── duplicate.tsx         # Meta-action
├── components/actions/
│   ├── ActionSidebar.tsx     # Action picker
│   ├── ActionGraph.tsx       # Graph + overlay
│   ├── StackPanel.tsx        # Stack visualization
│   └── StackCard.tsx         # Individual stack item
└── pages/
    └── ActionTest.tsx        # Test page
```

## Future Directions

### Expanded Action Library

- `deleteResource` - Delete cell/propagator with confirmation
- `editCellValue` - Set cell value with preview
- `createHandler` - Create inline handler
- `linkResources` - Create reference links
- `batchOperation` - Group multiple actions

### Command Palette

Cmd+K to open searchable action list:

```
┌─────────────────────────────────────┐
│ > create cell                       │
├─────────────────────────────────────┤
│ Create Cell          C              │
│ Create Propagator    P              │
│ Create Handler       H              │
└─────────────────────────────────────┘
```

### Workbench Integration

Replace all `prompt()`/`confirm()` dialogs with stack actions:

- Context menu → action dispatch
- Inspector buttons → action launchers
- All mutations flow through stack

### Undo Support

Since actions are discrete objects:

- Store resolved actions for undo
- Generate inverse actions
- Redo = re-resolve undone action
