# @bassline/plumber

Rule-based message routing for Bassline.

## Overview

The plumber routes messages between resources based on pattern-matched rules. It provides:

- **Pattern Matching** - Route messages based on source, port, and type
- **Rule Management** - Add, remove, and query rules as resources
- **Message History** - Track recent message flow for debugging
- **Event Bus** - Decoupled communication between modules

## Installation

Plumber is installed early in bootstrap (before links):

```javascript
// apps/cli/src/bootstrap.js
await bl.put(
  'bl:///install/plumber',
  {},
  {
    path: './packages/plumber/src/upgrade.js',
  }
)
```

## Sending Messages

Messages are sent with routing metadata in headers and payload in body:

```javascript
// Using bl.plumb() helper
bl.plumb('bl:///cells/counter', 'cell-updated', {
  headers: { type: 'bl:///types/cell-value' },
  body: { value: 42 },
})

// Direct PUT to /plumb/send
await bl.put(
  'bl:///plumb/send',
  { source: 'bl:///cells/counter', port: 'cell-updated' },
  { headers: { type: 'bl:///types/cell-value' }, body: { value: 42 } }
)
```

## Rules

Rules define which messages to match and where to forward them.

### Adding Rules

```javascript
// Via resource API
await bl.put(
  'bl:///plumb/rules/cell-watcher',
  {},
  {
    match: { port: 'cell-updated' },
    to: 'bl:///handlers/on-cell-change',
  }
)

// Match multiple criteria
await bl.put(
  'bl:///plumb/rules/counter-watcher',
  {},
  {
    match: {
      source: '^bl:///cells/counter', // regex pattern
      port: 'cell-updated',
      type: 'bl:///types/cell-value',
    },
    to: 'bl:///handlers/on-counter-change',
  }
)
```

### Pattern Matching

- String values are treated as regex patterns
- Objects match recursively
- `null` or `undefined` values are wildcards (match anything)
- All specified keys must match for a rule to fire

```javascript
// Match any cell update
{
  match: {
    port: 'cell-updated'
  }
}

// Match specific source prefix
{
  match: {
    source: '^bl:///cells/user-.*'
  }
}

// Match by type
{
  match: {
    type: 'bl:///types/timer-tick'
  }
}
```

### Managing Rules

```javascript
// List all rules
await bl.get('bl:///plumb/rules')

// Get specific rule
await bl.get('bl:///plumb/rules/my-rule')

// Delete rule
await bl.put('bl:///plumb/rules/my-rule/delete', {}, {})
```

## Routes

| Route                       | Method | Description                                           |
| --------------------------- | ------ | ----------------------------------------------------- |
| `/plumb/send`               | PUT    | Send a message (headers: source, port; body: payload) |
| `/plumb/rules`              | GET    | List all rules                                        |
| `/plumb/rules/:name`        | GET    | Get rule configuration                                |
| `/plumb/rules/:name`        | PUT    | Create/update rule                                    |
| `/plumb/rules/:name/delete` | PUT    | Delete rule                                           |
| `/plumb/history`            | GET    | Get recent message history                            |
| `/plumb/state`              | GET    | Get plumber state for visualization                   |

## Well-Known Ports

```javascript
import { ports } from '@bassline/plumber'

// Resource lifecycle
ports.RESOURCE_CREATED // 'resource-created'
ports.RESOURCE_UPDATED // 'resource-updated'
ports.RESOURCE_REMOVED // 'resource-removed'
ports.RESOURCE_ENABLED // 'resource-enabled'
ports.RESOURCE_DISABLED // 'resource-disabled'

// Domain events
ports.TIMER_TICK // 'timer-tick'
ports.FETCH_RESPONSES // 'fetch-responses'
ports.FETCH_ERRORS // 'fetch-errors'
ports.MONITOR_UPDATES // 'monitor-updates'
ports.CONTRADICTIONS // 'contradictions'
ports.ROUTE_NOT_FOUND // 'route-not-found'
```

## Well-Known Types

```javascript
import { types } from '@bassline/plumber'

types.RESOURCE_CREATED // 'bl:///types/resource-created'
types.TIMER_TICK // 'bl:///types/timer-tick'
types.FETCH_RESPONSE // 'bl:///types/fetch-response'
types.CONTRADICTION // 'bl:///types/contradiction'
// ... etc
```

## Message History

The plumber keeps a circular buffer of recent messages:

```javascript
await bl.get('bl:///plumb/history')
// → {
//   entries: [
//     { id: 1, timestamp: '...', source: '...', port: '...', matchedRules: [...], destinations: [...] },
//     ...
//   ],
//   count: 42,
//   maxHistory: 50
// }
```

## Direct API

Access via `bl._plumber` or `bl.getModule('plumber')`:

```javascript
const plumber = await bl.getModule('plumber')

// Add rule programmatically
plumber.addRule('my-rule', {
  match: { port: 'custom-event' },
  to: 'bl:///handlers/custom',
})

// Remove rule
plumber.removeRule('my-rule')

// Get rule
plumber.getRule('my-rule')

// List rules
plumber.listRules()

// Listen on a port (convenience method)
plumber.listen('custom-event', (msg) => {
  console.log('Received:', msg)
})
```

## Use Cases

### Propagators Reacting to Cell Changes

```javascript
await bl.put(
  'bl:///plumb/rules/propagator-trigger',
  {},
  {
    match: { port: 'cell-updated', type: 'bl:///types/cell-value' },
    to: 'bl:///propagators/on-cell-change',
  }
)
```

### WebSocket Broadcast

```javascript
await bl.put(
  'bl:///plumb/rules/ws-broadcast',
  {},
  {
    match: { port: 'resource-updated' },
    to: 'bl:///ws/broadcast',
  }
)
```

### Activity Logging

```javascript
await bl.put(
  'bl:///plumb/rules/activity-log',
  {},
  {
    match: {}, // Match everything
    to: 'bl:///dashboard/activity',
  }
)
```

## Dynamic Installation

```javascript
import { createPlumber } from '@bassline/plumber'

const plumber = createPlumber()
plumber.install(bl)
bl.setModule('plumber', plumber)
bl._plumber = plumber // For bl.plumb() helper
```
