# Async & Remote Operations in Bassline

This document describes the observable async and remote execution capabilities added to the Bassline language.

## Overview

Bassline now supports:
1. **Observable Async** - Non-blocking async operations with full observability
2. **Contact Protocol** - Identity and capability advertisement for runtimes
3. **WebSocket Transport** - Browser and Node.js WebSocket support
4. **Remote Execution** - Execute code on remote Bassline runtimes
5. **Daemon Server** - Run Bassline as a WebSocket server

## Observable Async Operations

### Creating Async Tasks

```bassline
; Create async task - returns immediately
task: async [fetch "https://api.github.com/repos/octocat/Hello-World"]

; Task handle returned immediately
print "Task created:" (inspect task)

; Do other work while task runs
x: + 1 2
```

### Checking Task Status

```bassline
; Check if task is done
status task  ; -> "pending" | "complete" | "error"

; Get all task stats
task-stats  ; -> {total: 5, pending: 2, complete: 3, error: 0}
```

### Awaiting Results

```bassline
; Block until task completes
result: await task

; Use the result
data: parse-json result
```

### Multiple Async Tasks

```bassline
; Create multiple tasks
t1: async [+ 10 20]
t2: async [* 5 6]
t3: async [- 100 30]

; Await all
r1: await t1
r2: await t2
r3: await t3

print "Results:" r1 r2 r3
```

### Global ASYNC_TASKS Context

All async tasks are tracked in the `ASYNC_TASKS` global context:

```bassline
; Inspect all running tasks
inspect ASYNC_TASKS

; Get specific task
task-id: get task "id"
task-info: get ASYNC_TASKS task-id
```

## Contact Protocol

Every Bassline runtime has a "contact" - an identity card describing itself.

### Runtime Contact

```bassline
; Inspect your runtime's contact
inspect RUNTIME_CONTACT

; Example output:
; {
;   id: "runtime-123",
;   name: "Browser REPL",
;   endpoints: [],
;   capabilities: ["browser", "view", "storage", "fetch", "websocket-client"]
; }
```

### Creating Contacts

```bassline
; Create a contact manually
server-contact: make-contact "My Server" ["ws://localhost:8080"]

; Serialize to JSON
json: to-contact-json server-contact

; Parse from JSON
contact: parse-contact json
```

### Checking Capabilities

```bassline
; Check if a contact has a capability
contact-has? server-contact "file-system"  ; -> true/false

; Get human-readable description
describe-contact server-contact
```

## Remote Execution

Connect to remote Bassline daemons and execute code on them.

### Starting a Daemon

```bash
# Terminal 1: Start the daemon
$ cd packages/lang
$ pnpm daemon

# Or with custom port
$ pnpm daemon --port 8181
```

### Connecting from Browser

```bassline
; Connect to daemon
server: remote connect "ws://localhost:8080"

; Connection successful!
; server is now a peer handle
```

### Executing Code Remotely

```bassline
; Execute simple code
task: remote exec server [+ 10 20]
result: await task  ; -> 30

; Execute complex code
task: remote exec server [
    x: * 5 6
    y: + x 10
    y
]
result: await task  ; -> 40
```

### Multiple Remote Tasks

```bassline
; Create multiple async remote tasks
t1: remote exec server [+ 1 2]
t2: remote exec server [* 3 4]
t3: remote exec server [- 10 5]

; All execute concurrently on the server
r1: await t1
r2: await t2
r3: await t3
```

### Global REMOTE_PEERS Context

All connected peers are tracked:

```bassline
; Inspect connected peers
inspect REMOTE_PEERS

; Check connection status
peer-status: get server "status"  ; -> "connected"
```

### Disconnecting

```bassline
; Disconnect from peer
remote disconnect server
```

## Architecture

### File Structure

```
packages/lang/src/
├── async.js                     # Task tracking system
├── contact.js                   # Contact protocol
├── daemon.js                    # WebSocket daemon server
├── prelude.js                   # Core operations (updated)
└── transports/
    ├── websocket-client.js      # Browser WebSocket client
    └── websocket-server.js      # Node.js WebSocket server
```

### How It Works

1. **Async Tasks**
   - Tasks are created with unique IDs
   - Stored in global registry
   - Exposed via `ASYNC_TASKS` context
   - Can be awaited or status-checked

2. **Remote Execution**
   - Browser uses WebSocket to connect to daemon
   - `remote exec` sends code as RPC request
   - Returns async task handle immediately
   - Result deserialized back to Bassline values

3. **Daemon Server**
   - Runs a Bassline REPL
   - Accepts WebSocket connections
   - Handles RPC methods: `eval`, `get`, `set`, `getContact`, `ping`
   - Serializes results for transmission

## Examples

### Example 1: Async HTTP Requests

```bassline
; Fetch data asynchronously
task: async [fetch "https://api.github.com/repos/octocat/Hello-World"]

; Do other work
print "Fetching..."

; Wait for result
response: await task
data: parse-json response
name: get data "name"

print "Repository:" name
```

### Example 2: Remote File System Access

```bassline
; Connect to daemon (has file-system capability)
server: remote connect "ws://localhost:8080"

; Execute file operations on server
task: remote exec server [
    ; This runs on the server!
    read-file "data.json"
]

content: await task
print "File contents:" content
```

### Example 3: Distributed Computation

```bassline
; Connect to multiple workers
worker1: remote connect "ws://localhost:8081"
worker2: remote connect "ws://localhost:8082"

; Distribute work
t1: remote exec worker1 [process-chunk chunk-1]
t2: remote exec worker2 [process-chunk chunk-2]

; Collect results
r1: await t1
r2: await t2

; Merge
final: merge r1 r2
```

## Benefits

### Observability
- All async operations visible in `ASYNC_TASKS`
- Check status without blocking
- Track pending/complete/error counts

### Non-Blocking
- `async` returns immediately
- REPL stays responsive
- Multiple tasks run concurrently

### Distributed
- Execute code on remote machines
- Access capabilities you don't have (files, compute, etc.)
- Scale across multiple nodes

### Composability
- Remote exec returns async tasks
- Use same async primitives for local and remote
- Seamless integration

## Future Enhancements

1. **Discovery Protocol** - Auto-discover peers on network
2. **Streaming** - Stream data between peers
3. **State Sync** - Automatic gadget state synchronization
4. **Security** - Authentication and authorization
5. **P2P** - WebRTC peer-to-peer connections

## Testing

Run the async tests:
```bash
cd packages/lang
pnpm test async -- --run
```

Try the examples:
```bash
# Start daemon
pnpm daemon

# In another terminal or browser REPL
# Load and run the examples
load "examples/async-demo.bl"
load "examples/remote-demo.bl"
```

## Status

**Phase 1: Observable Async** ✅ Complete
- Task tracking system
- `async`, `await`, `status` operations
- `ASYNC_TASKS` global context
- All tests passing

**Phase 2: Contact Protocol** ✅ Complete
- Contact schema
- Runtime auto-detection
- Serialization/deserialization

**Phase 3: WebSocket Transport** ✅ Complete
- Browser WebSocket client
- Node.js WebSocket server
- RPC protocol

**Phase 4: Remote Execution** ✅ Complete
- `remote connect`, `remote exec`, `remote disconnect`
- `REMOTE_PEERS` tracking
- Integration with async tasks

**Phase 5: Daemon Server** ✅ Complete
- CLI daemon
- RPC methods
- Contact advertisement

**Phase 6: UI Integration** 🚧 Pending
- AsyncTasksPanel component
- RemotePeersPanel component
- Live status updates

---

This foundation enables Bassline to become a truly distributed reactive system!
