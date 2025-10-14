# Testing the Bassline REPL UI

This guide walks you through testing the new UI panels and async/remote features.

## Prerequisites

1. **Dev server running**: `cd apps/web && pnpm dev` → http://localhost:5174/bassline-repl
2. **Daemon ready**: `cd packages/lang && pnpm daemon` (optional, for remote testing)

## Visual Checks

### 1. Initial Load
Open http://localhost:5174/bassline-repl

**Expected**:
- Main REPL area on the left (70% width)
- Right sidebar visible (30% width) with two panels:
  - **Async Tasks Panel** (top)
  - **Remote Peers Panel** (bottom)
- **Status bar** between header and output showing:
  - "0 tasks" in green
  - "0 peers" in gray
  - "Browser REPL" badge
  - "Cmd+K" hint

### 2. Keyboard Shortcut
Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)

**Expected**:
- Sidebar collapses (disappears)
- Press `Cmd+K` again → sidebar reappears

## Testing Async Tasks

### 3. Simple Async Task
Type in the REPL:
```bassline
task: async [+ 1 2]
```

**Expected in Async Tasks Panel**:
- Task appears with:
  - Yellow "Pending" badge with spinning icon
  - Task ID (e.g., "task-abc123")
  - Name: "Task task-abc123"
  - Start time
  - "Click to expand" hint
- After ~1ms, status changes to:
  - Green "Complete" badge with checkmark
  - Duration shown
  - "Finished in Xms"

### 4. Multiple Async Tasks
Execute these in sequence:
```bassline
t1: async [+ 10 20]
t2: async [* 5 6]
t3: async [- 100 50]
```

**Expected**:
- All three tasks appear in panel
- Filter tabs show counts: "All (3)", "Complete (3)"
- Click "Complete" tab → only shows completed tasks

### 5. Task Details
Click on any task in the panel

**Expected**:
- Task expands to show full details:
  - Task ID
  - Name
  - Status
  - Start Time (timestamp)
  - End Time (timestamp)
  - Duration (milliseconds)

### 6. Async Task Status Polling
Create a task and watch:
```bassline
task: async [+ 1 2]
```

**Expected**:
- Task appears instantly with "Pending" status
- Within 500ms (polling interval), status updates to "Complete"
- This proves the polling system is working

### 7. Task with Name
```bassline
task: async/name "My Calculation" [+ 42 58]
```

**Expected**:
- Task appears with name "My Calculation" instead of generic name

## Testing Remote Connections

### 8. Start Daemon
In a separate terminal:
```bash
cd packages/lang
pnpm daemon
```

**Expected output**:
```
✓ REPL initialized
✓ WebSocket server listening on ws://localhost:8080
✓ Runtime contact saved to .bassline-contact.json
```

### 9. Connect to Daemon from Browser
In the REPL:
```bassline
server: remote connect "ws://localhost:8080"
```

**Expected in Remote Peers Panel**:
- Connection form disappears
- New peer appears:
  - URL: "ws://localhost:8080"
  - Green "Connected" badge with WiFi icon
  - "Connected" status
  - Uptime counter (e.g., "Just now" → "30s ago")
  - Two buttons: "Ping" and "Disconnect"

**Expected in Status Bar**:
- "1 peer" badge turns green

### 10. Ping Remote Peer
Click the "Ping" button in the Remote Peers Panel

**Expected**:
- REPL history shows: `status (get REMOTE_PEERS "ws://localhost:8080")`
- Output shows: `"connected"`

### 11. Remote Execution
Execute code on the daemon:
```bassline
result: remote exec server [+ 100 200]
```

**Expected**:
- Returns immediately with a task handle
- **Async Tasks Panel** shows new task:
  - Name includes "remote" or task ID
  - Initially "Pending"
  - Quickly becomes "Complete"
  - Result: 300

### 12. Remote Execution with Daemon Logs
Watch the daemon terminal while executing:
```bassline
remote exec server [print "Hello from browser!"]
```

**Expected**:
- Daemon terminal shows: `Hello from browser!`
- Browser shows task completed successfully

### 13. Disconnect Remote Peer
Click "Disconnect" button in Remote Peers Panel

**Expected**:
- Peer status changes to "Disconnected"
- Gray "Disconnected" badge with WifiOff icon
- Status bar shows "0 peers"
- Peer may disappear after next poll cycle

## Testing Edge Cases

### 14. Error Handling - Invalid Remote URL
```bassline
bad: remote connect "ws://localhost:9999"
```

**Expected**:
- Error appears in REPL output
- No peer added to panel
- Or peer appears with "Error" status (red badge)

### 15. Multiple Remote Connections
Start two daemons:
```bash
# Terminal 1
pnpm daemon --port 8080

# Terminal 2
pnpm daemon --port 8081
```

Connect to both:
```bassline
server1: remote connect "ws://localhost:8080"
server2: remote connect "ws://localhost:8081"
```

**Expected**:
- Both peers appear in Remote Peers Panel
- Status bar shows "2 peers"

### 16. Task Filtering
Create tasks with different states:
```bassline
t1: async [+ 1 2]
t2: async [+ 3 4]
```

**Expected**:
- Click "All" tab → shows all tasks
- Click "Pending" tab → shows tasks while running
- Click "Complete" tab → shows finished tasks
- Counts update in tab labels

### 17. Empty States
Refresh the page (Cmd+R)

**Expected**:
- Async Tasks Panel shows:
  - "No async tasks yet"
  - Example code: `task: async [+ 1 2]`
- Remote Peers Panel shows:
  - "No connected peers"
  - Connect button
  - Instructions to start daemon

### 18. Auto-scroll
Execute multiple lines:
```bassline
+ 1 2
* 3 4
- 10 5
+ 7 8
```

**Expected**:
- Output area automatically scrolls to show latest result
- No manual scrolling needed

## Performance Testing

### 19. Many Tasks
Execute in a loop (copy-paste):
```bassline
async [+ 1 2]
async [+ 2 3]
async [+ 3 4]
async [+ 4 5]
async [+ 5 6]
async [+ 6 7]
async [+ 7 8]
async [+ 8 9]
async [+ 9 10]
async [+ 10 11]
```

**Expected**:
- All 10 tasks appear in panel
- Filter tabs work correctly
- No lag or stuttering
- Panel scrolls if needed

### 20. Polling Performance
Watch the browser's network/console tab while idle

**Expected**:
- No errors in console
- Polling happens every 500ms quietly
- No performance issues

## UI Polish Checks

### 21. Responsive Layout
Resize browser window

**Expected**:
- Main REPL area shrinks/grows appropriately
- Sidebar stays fixed width (384px / 96 tailwind units)
- Input area always visible at bottom
- No overflow or layout breaks

### 22. Theme Consistency
Check visual design:

**Expected**:
- Panels use white background
- Status badges use semantic colors:
  - Green for success/complete
  - Yellow for pending
  - Red for error
  - Gray for neutral
- Icons from lucide-react match design
- Borders are subtle (slate-200)

### 23. Interactive States
Hover over buttons (Connect, Ping, Disconnect, Export, Clear)

**Expected**:
- Buttons show hover state (bg-slate-50 or similar)
- Cursor changes to pointer
- Disabled buttons (e.g., Export when no history) are grayed out

## Integration Testing

### 24. Full Workflow
1. Start daemon: `pnpm daemon`
2. Open REPL: http://localhost:5174/bassline-repl
3. Connect: `server: remote connect "ws://localhost:8080"`
4. Execute remote async task: `result: remote exec server [* 123 456]`
5. Watch task appear in Async Tasks Panel
6. Watch it complete with result: 56088
7. Export session: Click "Export" button
8. Download should save `.bl` file with session history
9. Clear: Click "Clear" button
10. Confirm everything resets
11. Import: Click "Import", select the exported file
12. Verify history restored

## Troubleshooting

### Tasks not appearing
- Check browser console for errors
- Verify polling is running (check Network tab)
- Try: `keys ASYNC_TASKS` to see raw data

### Peers not appearing
- Verify daemon is running
- Check WebSocket connection in Network tab
- Try: `keys REMOTE_PEERS` to see raw data

### Sidebar not toggling
- Check browser console for errors
- Try hard refresh (Cmd+Shift+R)
- Verify keyboard event listener is attached

### Polling too slow/fast
- Current interval: 500ms
- To change, edit `route.tsx` line ~132:
  ```typescript
  const interval = setInterval(pollData, 500); // Change 500 to desired ms
  ```

## Success Criteria

✅ All async tasks appear in panel with correct status
✅ Remote connections appear in panel with status
✅ Polling updates panels in real-time
✅ Cmd+K toggles sidebar
✅ Status bar shows accurate counts
✅ Remote execution creates observable async tasks
✅ UI feels polished and responsive
✅ No console errors
✅ Export/Import works with new features
✅ Empty states are helpful

## Next Steps

If all tests pass, consider:
- Toast notifications for connection events
- More keyboard shortcuts (Cmd+E for export, etc.)
- Task cancellation UI
- Peer nickname editing
- Task result preview in panel
- Search/filter tasks by name or ID
- Connection history
- Daemon health checks
