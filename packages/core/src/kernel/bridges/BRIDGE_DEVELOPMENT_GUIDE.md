# Bridge Driver Development Guide

This guide documents key lessons learned from implementing bridge drivers for the Bassline kernel architecture.

## Overview

Bridge drivers enable external systems to communicate with the kernel, providing bidirectional data flow between the propagation network and external sources like WebSockets, HTTP APIs, IPC channels, etc.

## Key Lessons Learned

### 1. Runtime Integration

#### Contact ID Management
```typescript
// ❌ WRONG: Runtime generates new IDs
const contact = { content: 'value' }

// ✅ CORRECT: Provide explicit IDs
const contact = { id: 'my-contact-id', content: 'value' }
```

The `UserspaceRuntime.addContact()` method will use provided IDs if available, otherwise generates new ones. Always provide IDs for predictable behavior.

#### Propagation Handling
- There is NO `processPropagation()` method
- Propagation happens automatically within `scheduleUpdate()`
- Just await the `scheduleUpdate()` call and propagation completes

#### Proper Initialization Sequence
```typescript
// 1. Create and register group first
await runtime.registerGroup({
  id: groupId,
  name: 'Test Group',
  contactIds: [],
  wireIds: [],
  subgroupIds: [],
  boundaryContactIds: []
})

// 2. Then add contacts with explicit IDs
await runtime.addContact(groupId, {
  id: contactId,
  content: 'initial-value',
  blendMode: 'accept-last'
})

// 3. Updates can now reference the contact
await runtime.scheduleUpdate(contactId, 'new-value')
```

### 2. Error Handling Patterns

#### Prevent Unhandled Errors
```typescript
// ❌ WRONG: Can crash if no error listeners
this.emit('error', { error: 'Something went wrong' })

// ✅ CORRECT: Check for listeners first
if (this.listenerCount('error') > 0) {
  this.emit('error', { error: 'Something went wrong' })
}
```

#### Test Error Handling
```typescript
// Always add error handlers in tests to prevent crashes
bridge.on('error', () => {
  // Expected error, ignore or handle as needed
})
```

#### Cleanup Error Handling
```typescript
afterEach(async () => {
  if (bridge) {
    try {
      await bridge.stopListening()
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
})
```

### 3. Connection Management

#### Clean Shutdown Pattern
```typescript
protected async onStopListening(): Promise<void> {
  this.connectionState = ConnectionState.CLOSING
  
  if (this.ws) {
    // Wait for close to complete
    await new Promise<void>((resolve) => {
      const onClose = () => {
        this.ws = undefined
        this.connectionState = ConnectionState.CLOSED
        resolve()
      }
      
      // Set up close handler
      this.ws.onclose = onClose
      
      // Initiate close
      this.ws.close(1000, 'Bridge stopping')
      
      // Timeout fallback
      setTimeout(() => {
        this.ws = undefined
        this.connectionState = ConnectionState.CLOSED
        resolve()
      }, 1000)
    })
  } else {
    this.connectionState = ConnectionState.CLOSED
  }
}
```

#### Reconnection Logic
- Use exponential backoff with configurable delays
- Don't reconnect on clean shutdowns (`wasClean = true`)
- Track reconnection attempts and emit events
- Have a maximum reconnection delay cap

### 4. Message Handling

#### Data Type Flexibility
```typescript
this.ws.onmessage = async (event) => {
  try {
    // Handle both string and Buffer data
    const data = typeof event.data === 'string' 
      ? event.data 
      : event.data.toString()
    const message = JSON.parse(data)
    await this.handleMessage(message)
  } catch (error) {
    // Handle gracefully
  }
}
```

#### Queue Management
- Queue messages when disconnected
- Set a maximum queue size to prevent memory issues
- Drop oldest messages on overflow, not newest
- Flush queue on reconnection

### 5. Testing Best Practices

#### Test Structure
1. **Core Functionality Tests** - Test the bridge in isolation
2. **Kernel Integration Tests** - Test with full kernel/runtime setup

#### Mock Server Pattern
```typescript
class MockWebSocketServer {
  async start(): Promise<void> { /* ... */ }
  async stop(): Promise<void> { /* ... */ }
  broadcast(message: any): void { /* ... */ }
  sendToAll(message: any): void { /* ... */ }
}
```

#### Timeout Handling
```typescript
it('should handle long operations', { timeout: 10000 }, async () => {
  // Use Promise.race for operations that might not complete
  const result = await Promise.race([
    someAsyncOperation(),
    new Promise(resolve => setTimeout(() => resolve(false), 5000))
  ])
  
  if (!result) {
    // Handle timeout case gracefully
  }
})
```

### 6. Common Implementation Checklist

When implementing a new bridge driver:

- [ ] Extend `AbstractBridgeDriver` base class
- [ ] Implement all abstract methods
- [ ] Add connection state management
- [ ] Implement message queuing for disconnected state
- [ ] Add reconnection logic (if applicable)
- [ ] Handle both successful and error cases
- [ ] Check for error listeners before emitting errors
- [ ] Add comprehensive tests (standalone + kernel integration)
- [ ] Test error scenarios and edge cases
- [ ] Document configuration options
- [ ] Add statistics tracking
- [ ] Implement graceful shutdown

### 7. Configuration Pattern

```typescript
export interface BridgeConfig {
  // Required
  url: string                    // Connection endpoint
  
  // Connection
  reconnect?: boolean            // Enable auto-reconnection
  reconnectDelay?: number        // Initial reconnect delay (ms)
  maxReconnectDelay?: number     // Maximum reconnect delay (ms)
  reconnectDecay?: number        // Exponential backoff multiplier
  
  // Performance
  queueSize?: number             // Max messages to queue
  batchSize?: number             // Batch message sending
  
  // Features
  heartbeatInterval?: number     // Keepalive interval (ms)
  compression?: boolean          // Enable compression
  
  // Identity
  id?: string                    // Custom bridge ID
  room?: string                  // Room/channel for isolation
}
```

## Next Steps

With these patterns established, implementing additional bridge drivers should be straightforward:

1. **HTTPBridgeDriver** - REST API integration with polling
2. **IPCBridgeDriver** - Inter-process communication
3. **EventSourceBridgeDriver** - Server-sent events

Each should follow the patterns documented here for consistency and reliability.