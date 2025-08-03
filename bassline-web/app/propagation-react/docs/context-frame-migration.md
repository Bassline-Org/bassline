# Context Frame Stack Migration Guide

## Overview

We're unifying the current dual-system (UIStack + ContextFrame) into a single, more powerful Context Frame Stack system. This provides a cleaner mental model where each frame represents a complete working environment.

## Key Concepts

### Before (Two Systems)
1. **UIStackContext** - Manages UI interaction modes (property editing, valence mode, etc.)
2. **ContextFrameContext** - Manages navigation context and selection state

### After (Unified System)
1. **ContextFrameStackContext** - Single stack managing both navigation and UI modes

## Migration Steps

### 1. Replace Providers in Root

```tsx
// Before
<NetworkProvider>
  <UIStackProvider>
    <ContextFrameProvider>
      <App />
    </ContextFrameProvider>
  </UIStackProvider>
</NetworkProvider>

// After
<NetworkProvider>
  <ContextFrameStackProvider>
    <App />
  </ContextFrameStackProvider>
</NetworkProvider>
```

### 2. Update Selection Hooks

```tsx
// Before
import { useContextSelection } from '~/propagation-react/hooks/useContextSelection'
const { selectedContacts, selectedGroups } = useContextSelection()

// After
import { useFrameSelection } from '~/propagation-react/hooks/useFrameSelection'
const { selectedContacts, selectedGroups } = useFrameSelection()
```

### 3. Update UI Mode Management

```tsx
// Before
const uiStack = useUIStack()
uiStack.push({
  type: 'propertyFocus',
  onEscape: () => { /* ... */ }
})

// After
const frameStack = useContextFrameStack()
frameStack.pushPropertyMode(nodeId, true)
```

### 4. Update Navigation

```tsx
// Before
const { pushContext, popContext } = useContextFrame()
pushContext(groupId)

// After
const { pushNavigation, popNavigation } = useContextFrameStack()
pushNavigation(groupId)
```

### 5. Update Escape Key Handling

```tsx
// Before
if (e.key === "Escape") {
  const currentLayer = uiStack.peek()
  if (currentLayer?.onEscape) {
    const preventPop = currentLayer.onEscape()
    if (!preventPop) uiStack.pop()
  }
}

// After
if (e.key === "Escape") {
  const { currentFrame, pop } = frameStack
  if (currentFrame?.onEscape) {
    const preventPop = currentFrame.onEscape()
    if (!preventPop) pop()
  } else {
    pop()
  }
}
```

### 6. Update Tool Integration

```tsx
// Before
const { activateTool, deactivateTool } = useContextFrame()
activateTool(tool)

// After
const { pushToolFrame } = useContextFrameStack()
pushToolFrame(tool)
// Tool is automatically activated/deactivated with frame lifecycle
```

## Frame Types

### Navigation Frame
Pushed when navigating into a subgroup:
```tsx
frameStack.pushNavigation(gadgetId)
```

### Property Frame
Pushed when editing properties:
```tsx
frameStack.pushPropertyMode(nodeId, focusInput)
```

### Valence Frame
Pushed when entering valence connection mode:
```tsx
frameStack.pushValenceMode({
  contactIds: ['c1', 'c2'],
  groupIds: ['g1'],
  totalOutputCount: 3
})
```

### Gadget Menu Frame
Pushed when showing gadget palette:
```tsx
frameStack.pushGadgetMenu(selectedCategory)
```

### Tool Frame
Pushed when activating a custom tool:
```tsx
frameStack.pushToolFrame(myTool)
```

## Benefits

1. **Unified Mental Model** - One stack to rule them all
2. **Better Escape Navigation** - Natural back button behavior
3. **Preserved Context** - Each frame maintains its own selection and view state
4. **Tool Integration** - Tools are first-class citizens in the stack
5. **Debugging** - Easy to visualize and debug the entire UI state

## Example: Complete Migration

### Old Code
```tsx
function Editor() {
  const uiStack = useUIStack()
  const { currentContext, setSelection } = useContextFrame()
  const { selectedContacts } = useContextSelection()
  
  const handlePropertyEdit = () => {
    uiStack.push({
      type: 'propertyFocus',
      onEscape: () => {
        setHighlightedNodeId(null)
      }
    })
  }
  
  const handleValenceMode = () => {
    enterValenceMode()
    uiStack.push({ type: 'valenceMode' })
  }
  
  return <EditorUI />
}
```

### New Code
```tsx
function Editor() {
  const frameStack = useContextFrameStack()
  const { selectedContacts } = useFrameSelection()
  
  const handlePropertyEdit = () => {
    frameStack.pushPropertyMode(nodeId, true)
  }
  
  const handleValenceMode = () => {
    frameStack.pushValenceMode({
      contactIds: Array.from(selectedContactIds),
      groupIds: Array.from(selectedGroupIds),
      totalOutputCount: calculateOutputCount()
    })
  }
  
  return <EditorUI />
}
```

## Gradual Migration

The system can be migrated gradually:

1. Start by replacing UIStackProvider with ContextFrameStackProvider
2. Update selection hooks one component at a time
3. Migrate UI modes (property, valence, etc.) individually
4. Finally remove old contexts and hooks

## Debug Visualization

Add the FrameStackDebugger component to visualize the stack:

```tsx
import { FrameStackDebugger } from '~/components/FrameStackDebugger'

<FrameStackDebugger />
```