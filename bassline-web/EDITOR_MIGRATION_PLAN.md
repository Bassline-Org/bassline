# Editor Migration Plan: React Router Architecture

## Overview

This document outlines the migration strategy for converting the SimpleEditor from a context-based state management system to React Router's loader/action architecture with worker-based propagation networks.

## Current Architecture Analysis

### Current Stack
- **State Management**: React Context (NetworkStateProvider)
- **Propagation**: Local state with immediate updates
- **UI Updates**: Context subscriptions trigger re-renders
- **Mutations**: Direct function calls through context
- **Navigation**: URL params with manual sync

### Issues with Current Approach
1. Tight coupling between UI and propagation logic
2. Complex context hierarchies causing unnecessary re-renders
3. Difficult to test mutations in isolation
4. No natural undo/redo mechanism
5. State synchronization issues with multiple tabs

## Target Architecture

### New Stack
- **State Management**: Worker-based propagation network
- **Data Loading**: React Router clientLoader
- **Mutations**: React Router clientAction with form submissions
- **UI Updates**: Component-level subscriptions to worker
- **Navigation**: React Router params with automatic handling

### Benefits
1. Clean separation of concerns
2. Better performance (no context re-renders)
3. Easier testing (actions are pure functions)
4. Natural undo/redo via action replay
5. Multi-tab support via worker

## Migration Strategy

### Phase 1: Infrastructure Setup

#### 1.1 Create Route Structure
```
app/routes/
  editor.tsx          // Main editor route
  editor.actions.tsx  // Action handler route
```

#### 1.2 Editor Route with Loader
```typescript
// app/routes/editor.tsx
import { useLoaderData, useSubmit } from "react-router"
import { getNetworkClient } from "~/network/client"
import { useGroupState } from "~/hooks/useWorkerData"

export async function clientLoader({ params }) {
  const client = getNetworkClient()
  const groupId = params.groupId || 'root'
  
  // Ensure root group exists
  try {
    await client.registerGroup({
      id: 'root',
      name: 'Root Group',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
  } catch (e) {
    // Root already exists
  }
  
  const groupState = await client.getState(groupId)
  
  return {
    groupId,
    initialGroupState: groupState
  }
}

export default function Editor() {
  const { groupId, initialGroupState } = useLoaderData()
  const { state: groupState, loading, error } = useGroupState(groupId, initialGroupState)
  
  // Editor implementation...
}
```

### Phase 2: Action Handler Implementation

#### 2.1 Comprehensive Action Handler
```typescript
// app/routes/editor.actions.tsx
export async function clientAction({ request }) {
  const client = getNetworkClient()
  const formData = await request.formData()
  const intent = formData.get('intent')
  
  switch (intent) {
    // Contact operations
    case 'add-contact':
    case 'update-contact':
    case 'delete-contact':
    case 'move-contact':
    
    // Group operations
    case 'add-group':
    case 'update-group':
    case 'delete-group':
    case 'extract-to-group':
    case 'inline-group':
    
    // Wire operations
    case 'add-wire':
    case 'update-wire':
    case 'delete-wire':
    
    // Refactoring operations
    case 'extract-contacts':
    case 'merge-groups':
    
    // Primitive gadget operations
    case 'create-gadget':
    case 'update-gadget-params':
  }
}
```

### Phase 3: Component Updates

#### 3.1 Update Hooks Usage
```typescript
// Before (with context)
const { updateContact, addWire } = useNetworkState()
updateContact(id, { content: newValue })

// After (with actions)
const submit = useSubmit()
submit({
  intent: 'update-contact',
  contactId: id,
  content: JSON.stringify(newValue)
}, {
  method: 'post',
  action: '/editor/actions',
  navigate: false
})
```

#### 3.2 Property Panel Forms
```typescript
// Convert property updates to form submissions
<Form method="post" action="/editor/actions">
  <input type="hidden" name="intent" value="update-contact" />
  <input type="hidden" name="contactId" value={contact.id} />
  <input 
    name="content" 
    defaultValue={contact.content}
    onBlur={(e) => e.currentTarget.form?.requestSubmit()}
  />
</Form>
```

### Phase 4: Helper Utilities

#### 4.1 Form Submission Helpers
```typescript
// app/utils/editor-actions.ts
export function submitContactUpdate(submit, contactId, updates) {
  submit({
    intent: 'update-contact',
    contactId,
    ...updates
  }, {
    method: 'post',
    action: '/editor/actions',
    navigate: false
  })
}

export function submitWireCreate(submit, groupId, fromId, toId, type = 'bidirectional') {
  submit({
    intent: 'add-wire',
    groupId,
    fromId,
    toId,
    type
  }, {
    method: 'post',
    action: '/editor/actions',
    navigate: false
  })
}
```

## Implementation Checklist

### Core Infrastructure
- [ ] Create editor.tsx route file
- [ ] Create editor.actions.tsx route file
- [ ] Update app/routes.ts configuration
- [ ] Create editor-specific hooks
- [ ] Create action helper utilities

### Feature Migration
- [ ] Contact CRUD operations
- [ ] Group CRUD operations
- [ ] Wire management
- [ ] Drag and drop positioning
- [ ] Selection management
- [ ] Copy/paste functionality
- [ ] Undo/redo system
- [ ] Keyboard shortcuts
- [ ] Mode system (select, wire, etc.)

### Component Updates
- [ ] SimpleContactNode
- [ ] EnhancedGroupNode
- [ ] SimplePropertyPanel
- [ ] BreadcrumbNav
- [ ] GadgetToolbar
- [ ] FloatingActions
- [ ] ModeHandler

### Advanced Features
- [ ] Extract to group refactoring
- [ ] Inline group refactoring
- [ ] Primitive gadget creation
- [ ] Boundary contact management
- [ ] Multi-select operations
- [ ] Batch updates

### Testing & Cleanup
- [ ] Unit tests for actions
- [ ] Integration tests for flows
- [ ] Remove old context files
- [ ] Remove old provider components
- [ ] Update documentation

## Code Examples

### Example: Adding a Contact
```typescript
// In component
const submit = useSubmit()

const handleAddContact = (position) => {
  submit({
    intent: 'add-contact',
    groupId: currentGroupId,
    content: JSON.stringify('New Contact'),
    blendMode: 'accept-last',
    position: JSON.stringify(position)
  }, {
    method: 'post',
    action: '/editor/actions',
    navigate: false
  })
}

// In action handler
case 'add-contact': {
  const groupId = formData.get('groupId')
  const content = JSON.parse(formData.get('content'))
  const blendMode = formData.get('blendMode')
  const position = JSON.parse(formData.get('position'))
  
  const contactId = await client.addContact(groupId, {
    content,
    blendMode,
    groupId
  })
  
  return { success: true, contactId }
}
```

### Example: Real-time Updates
```typescript
// Component subscribes to changes
const { state: groupState } = useGroupState(groupId, initialGroupState)

// Automatically updates when worker sends changes
// No manual invalidation needed
```

## Migration Timeline

1. **Week 1**: Infrastructure setup and basic CRUD
2. **Week 2**: Component migration and property panel
3. **Week 3**: Advanced features and refactoring operations
4. **Week 4**: Testing, optimization, and cleanup

## Notes

- Keep both editors running during migration
- Test each feature as it's migrated
- Document any API changes
- Consider backwards compatibility for saved networks