# Test Plan for Gadget Rendering

## Steps to Test:

1. Navigate to http://localhost:5174/editor-v2
2. Click the "Gadgets" button to open the gadget palette
3. Select a gadget (e.g., "Add" from the math category)
4. The gadget should appear with:
   - Orange background (vs purple for regular groups)
   - Lightning bolt icon
   - Multiple handles on left (inputs) and right (outputs)
   - Labels showing input/output names (e.g., "a", "b" for inputs, "result" for output)

## Expected Behavior:

- Gadgets should have boundary contacts visible as handles
- Input handles on the left, output handles on the right
- Handles should be connectable to regular contacts
- Gadget names should show the primitive type

## Debugging:

Check console for:
- `[useSubgroupData] Fetched subgroup` logs showing boundary contacts
- `[Scheduler] Creating boundary contacts for primitive gadget` logs
- `[EditorAction] Creating gadget:` logs showing gadget creation