# WebRTC Peer-to-Peer Client Implementation Plan

## Overview
Implement a WebRTC-based network client that enables direct peer-to-peer connections between Bassline editors, allowing real-time collaboration without requiring a central server.

## Architecture

### 1. Connection Modes
```
Current:
- worker (local in-browser)
- remote (WebSocket to server)

New Addition:
- webrtc (peer-to-peer)
```

### 2. Components

#### A. WebRTCNetworkClient (`app/network/webrtc-client.ts`)
- Implements the same NetworkClient interface
- Manages WebRTC peer connections
- Handles data channel communication
- Maintains network state synchronization

#### B. Signaling Server (`cli/src/commands/signal.ts`)
- Minimal server for initial peer discovery
- WebSocket-based room management
- Only handles signaling (SDP/ICE exchange)
- No application data passes through it

#### C. Room Management
- Peer discovery via room codes
- Host/guest model:
  - Host: Creates room, owns network state
  - Guests: Join room, sync with host
- Automatic host migration if host disconnects

### 3. Connection Flow

```
1. Host creates room
   → Connects to signaling server
   → Gets room code
   → Waits for peers

2. Guest joins room
   → Enters room code
   → Connects to signaling server
   → Exchanges SDP/ICE with host

3. Direct P2P established
   → Data channels open
   → Initial state sync
   → Real-time updates flow
```

### 4. Data Synchronization

#### State Management
- Host maintains authoritative state
- Conflict resolution: Last-write-wins with vector clocks
- Automatic reconnection and state recovery

#### Message Types
```typescript
type P2PMessage = 
  | { type: 'state-sync', state: NetworkState }
  | { type: 'change', change: Change }
  | { type: 'request', id: string, request: NetworkRequest }
  | { type: 'response', id: string, response: any }
  | { type: 'heartbeat' }
```

### 5. Security Considerations
- Room codes are randomly generated (6-character alphanumeric)
- Optional password protection
- DTLS encryption for data channels
- No data persisted on signaling server
- Signaling messages expire after 30 seconds

### 6. UI Integration

#### NetworkModeSelector Update
```tsx
// Add WebRTC option
<Button onClick={() => setMode('webrtc')}>
  P2P Connection
</Button>

// Room management UI
{mode === 'webrtc' && (
  <WebRTCRoomManager 
    onHostRoom={handleHostRoom}
    onJoinRoom={handleJoinRoom}
  />
)}
```

### 7. Implementation Phases

#### Phase 1: Basic P2P Connection
1. Create WebRTCNetworkClient class
2. Implement signaling server
3. Basic peer connection establishment
4. Simple message passing

#### Phase 2: State Synchronization
1. Initial state sync on connection
2. Change propagation
3. Conflict resolution
4. Reconnection handling

#### Phase 3: UI Integration
1. Update NetworkModeSelector
2. Add room management UI
3. Connection status indicators
4. Error handling

#### Phase 4: Advanced Features
1. Multiple peer support (mesh network)
2. Host migration
3. Bandwidth optimization
4. NAT traversal improvements

### 8. File Structure
```
app/network/
  webrtc-client.ts       # Main WebRTC client
  webrtc-room.ts         # Room management logic
  webrtc-types.ts        # Type definitions

app/components/
  WebRTCRoomManager.tsx  # UI for room creation/joining
  ConnectionStatus.tsx   # P2P connection indicators

cli/src/commands/
  signal.ts              # Signaling server command

app/config/
  network-config.ts      # Update to include webrtc mode
```

### 9. Dependencies
```json
{
  "simple-peer": "^9.11.1",    // WebRTC wrapper
  "uuid": "^9.0.0"              // Room code generation
}
```

### 10. Testing Strategy
- Unit tests for message handling
- Integration tests with mock RTCPeerConnection
- Manual testing across different networks
- Performance testing with large state sizes

## Benefits
1. **No server required** for collaboration
2. **Low latency** - direct connections
3. **Privacy** - data never leaves peer network
4. **Cost effective** - minimal infrastructure
5. **Works behind firewalls** with STUN/TURN

## Challenges & Solutions
1. **NAT traversal** → Use public STUN servers, optional TURN
2. **State consistency** → Vector clocks, authoritative host
3. **Peer discovery** → Simple signaling server
4. **Scalability** → Limit to ~5 peers, consider mesh vs star topology
5. **Offline sync** → Export/import state for async collaboration

## Implementation Details

### WebRTC Configuration
```javascript
const peerConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
}

const dataChannelConfig = {
  ordered: true,
  maxRetransmits: 3,
  maxPacketLifeTime: 3000
}
```

### Room Code Generation
- 6 characters: `[A-Z0-9]`
- Example: `A3B7K9`
- Collision probability negligible for small user base
- Expires after 1 hour of inactivity

### Message Protocol
All messages are JSON encoded with the following envelope:
```typescript
interface MessageEnvelope {
  id: string           // Message ID for request/response correlation
  timestamp: number    // Unix timestamp
  from: string        // Peer ID
  type: string        // Message type
  payload: any        // Message-specific data
}
```

### State Sync Protocol
1. **New peer joins:**
   - Guest sends `REQUEST_STATE` message
   - Host responds with compressed full state
   - Guest acknowledges receipt

2. **Incremental updates:**
   - Changes broadcast to all peers
   - Each peer applies changes locally
   - Periodic state hash comparison for consistency

3. **Conflict resolution:**
   - Vector clocks track causality
   - Last-write-wins for concurrent updates
   - Host breaks ties

### Error Handling
- Automatic reconnection with exponential backoff
- State recovery from peers on reconnect
- Graceful degradation to read-only mode if host lost
- User notification for connection issues

### Performance Optimizations
1. **Message batching:** Group changes within 16ms window
2. **Compression:** Use pako for large state transfers
3. **Delta encoding:** Send only changed fields
4. **Lazy loading:** Sync only visible groups initially
5. **Binary protocol:** Consider MessagePack for efficiency

## Future Enhancements
1. **Federation:** Connect multiple P2P rooms
2. **Persistence:** Optional cloud backup
3. **Mobile support:** React Native client
4. **Voice/video:** Add communication channels
5. **Presence:** Show cursor positions, selections
6. **Time travel:** Synchronized undo/redo
7. **Permissions:** Read/write access control
8. **Analytics:** Connection quality metrics