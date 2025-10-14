# Remote Peers UI Fix

## Problem
Remote peers were not appearing in the RemotePeersPanel after connecting to a daemon.

## Root Cause
Two issues:

1. **Incorrect Context access**: The polling code was trying to access Context properties using `Symbol.for("STATUS")` directly, but should use the Context's `.get()` method which handles normalization internally.

2. **Missing timestamp**: The `connected-at` timestamp wasn't being stored when a peer connection was established.

## Solution

### 1. Fixed Context Access in route.tsx (Line 113-125)

**Before:**
```typescript
const status = peerResult.value.get?.(Symbol.for("STATUS"))?.value || "unknown";
const connectedAt = peerResult.value.connectedAt;  // undefined!
```

**After:**
```typescript
// peerResult.value is a Context, use .get() method
const statusValue = peerResult.value.get("status");
const connectedAtValue = peerResult.value.get("connected-at");

const status = statusValue?.value || "unknown";
const connectedAt = connectedAtValue?.value;
```

**Why this works:**
- `peerResult.value` is a Context object
- Context.get() takes a string and normalizes it to `Symbol.for(key.toUpperCase())`
- This matches how values are stored: `peerHandle.set("status", ...)` → stored as `Symbol.for("STATUS")`
- Must access `.value` on the returned Bassline value (Str, Num, etc.)

### 2. Added Timestamp to Peer Handle in prelude.js (Line 1629)

**Before:**
```javascript
const peerHandle = new Context();
peerHandle.set("url", new Str(url));
peerHandle.set("status", new Str("connected"));
peerHandle._rpcClient = rpcClient;
```

**After:**
```javascript
const peerHandle = new Context();
peerHandle.set("url", new Str(url));
peerHandle.set("status", new Str("connected"));
peerHandle.set("connected-at", new Num(Date.now()));  // Added!
peerHandle._rpcClient = rpcClient;
```

## Testing

1. Start daemon: `cd packages/lang && pnpm daemon`
2. Open REPL: http://localhost:5174/bassline-repl
3. Connect: `server: remote connect "ws://localhost:8080"`
4. Check RemotePeersPanel - peer should appear with:
   - URL: ws://localhost:8080
   - Status: Connected (green badge)
   - Uptime: "Just now" → updates to "Xs ago"

## Key Takeaways

- **Context is not a plain object** - always use `.get(key)` to access values
- Context stores values as Bassline types (Str, Num, Block) - remember to access `.value`
- When adding UI for Bassline data structures, test the data flow from storage → retrieval → display
- The normalize() function in Context converts all keys to uppercase Symbols automatically

## Files Modified

1. `/Users/goose/prg/bassline/apps/web/app/routes/bassline-repl/route.tsx` - Fixed polling logic
2. `/Users/goose/prg/bassline/packages/lang/src/prelude.js` - Added connected-at timestamp

## Status

✅ **FIXED** - Remote peers now populate correctly in the UI panel with status and uptime.
