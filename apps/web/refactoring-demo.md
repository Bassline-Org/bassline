# Refactoring Demo Instructions

## Keyboard Shortcuts

- **Extract to Group**: Cmd/Ctrl + G
- **Inline Group**: Cmd/Ctrl + Shift + G
- **Copy/Duplicate**: Cmd/Ctrl + D
- **Delete**: Delete or Backspace

## Testing Extract-to-Group

1. Open http://localhost:5173/editor-v2
2. Click "Add Contact" button and click to place 2-3 contacts
3. Double-click each contact to add some content (e.g., "A", "B", "C")
4. Select multiple contacts by clicking and dragging a selection box
5. Either:
   - Right-click and choose "Extract to Group", or
   - Press Cmd/Ctrl + G
6. Enter a name for the new group
8. Verify:
   - The contacts disappear from root
   - A new group node appears
   - The group has boundary contacts as handles

## Testing Inline-Group

1. After extracting to a group
2. Right-click on the group node
3. Choose "Inline Group"
4. Verify:
   - The group disappears
   - The contacts reappear in the root
   - Any connections are preserved

## Testing Copy Operations

### Copy Contacts
1. Select one or more contacts
2. Either:
   - Right-click and choose "Copy Contacts", or
   - Press Cmd/Ctrl + D
3. Verify:
   - New contacts appear with the same content
   - Wires between copied contacts are also copied
   - Original contacts remain unchanged

### Copy Group
1. Select a group node
2. Either:
   - Right-click and choose "Copy Group", or  
   - Press Cmd/Ctrl + D
3. Verify:
   - A new group appears with "(Copy)" suffix
   - All contacts and internal wires are duplicated
   - Subgroups are also copied (deep copy)
   - External connections are not copied

## Debugging in Console

```javascript
// Check current state
const client = window.getNetworkClient();
const state = await client.getState('root');
console.log('Contacts:', Array.from(state.contacts.keys()));
console.log('Subgroups:', state.group.subgroupIds);

// Manually test refactoring
const result = await client.applyRefactoring('extract-to-group', {
  contactIds: ['contact-id-1', 'contact-id-2'],
  groupName: 'Test Group',
  parentGroupId: 'root'
});
console.log('Result:', result);
```