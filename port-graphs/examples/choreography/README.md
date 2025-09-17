# Choreographic Construction with Gadgets

## The Concept

Traditional choreographic programming works top-down:
```
Global choreography → Projection → Local implementations
```

Our approach is bottom-up **choreographic construction**:
```
Partial roles → Accumulate → Complete pattern → Spawn & wire participants
```

The choreography itself is a gadget that:
1. **Receives** role and relationship definitions
2. **Considers** if it has enough information
3. **Acts** by spawning participant gadgets
4. **Emits** choreography lifecycle events

## How It Works

### 1. Define Roles
```typescript
{ name: 'coordinator', type: 'coordinator', capabilities: ['coordinate'] }
{ name: 'participant1', type: 'participant', capabilities: ['vote'] }
```

### 2. Define Relationships
```typescript
{ from: 'coordinator', to: 'participant1', type: 'sends', protocol: 'prepare' }
{ from: 'participant1', to: 'coordinator', type: 'responds', protocol: 'vote' }
```

### 3. Instantiate Choreography
The choreography gadget:
- Creates participant gadgets for each role
- Wires them according to relationships
- Manages the protocol lifecycle

### 4. Execute Protocol
Participants interact through normal gadget receive/emit, following the wired topology.

## Examples

### Two-Phase Commit
```bash
npx tsx two-phase-commit.ts
```

Shows a distributed transaction protocol where:
- Coordinator sends PREPARE to all participants
- Participants vote YES/NO
- Coordinator decides COMMIT/ABORT based on votes
- Decision broadcast to all participants

The entire protocol emerges from the gadget interactions.

## Key Insights

1. **Choreographies are gadgets** - They follow the same protocol as any other gadget

2. **Self-assembling systems** - Protocols build themselves from partial descriptions

3. **Dynamic topology** - Participants and connections created at runtime

4. **Protocol-agnostic** - Same pattern works for any multi-party protocol:
   - Two-phase commit
   - Leader election
   - Pub/sub
   - MapReduce
   - Consensus protocols

5. **Composable** - Choreographies can contain other choreographies

## Future Directions

### Distributed Choreographies
Participants could be on different machines, connected via transport gadgets:
```typescript
// Coordinator on machine A
const coordinator = createCoordinator();
wire(coordinator).to(tcpTransport('machine-b:3000'));

// Participant on machine B
const participant = createParticipant();
wire(tcpTransport(':3000')).to(participant);
```

### Adaptive Choreographies
Choreographies that modify themselves based on runtime conditions:
- Add participants dynamically
- Change relationships based on load
- Failover to backup roles

### Choreography Discovery
Participants find and join choreographies through discovery:
```typescript
registry.receive({
  name: 'transaction-protocol',
  endpoint: choreography,
  metadata: { needsRoles: ['participant'] }
});
```

## Summary

We've shown that complex distributed protocols can self-assemble from simple descriptions, using the gadget protocol itself as the construction mechanism. The choreography is not external to the system - it IS the system, built from the same primitives as everything else.