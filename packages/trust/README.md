# @bassline/trust

Local trust computation and capability gating for distributed Bassline nodes.

## Why Trust?

In distributed systems, nodes interact with peers they don't fully control. Traditional approaches use:
- **ACLs** (Access Control Lists) - Static permissions declared upfront
- **Capabilities** - Tokens that grant specific access
- **Central authority** - A trusted server that validates everyone

These all have problems in truly distributed settings:
- ACLs require knowing all peers ahead of time
- Capabilities can be stolen or replayed
- Central authorities are single points of failure

**Trust-based systems** take a different approach: compute confidence from observed behavior. Instead of asking "is this peer allowed?", we ask "based on our history with this peer, how confident are we they'll behave well?"

## Trust is Local

There is no global trust score. Each node maintains its own view based on:

1. **Direct observation** - Did this peer's data validate? Did their responses make sense?
2. **Sample verification** - Randomly check a fraction of interactions
3. **Decay over time** - Confidence decreases without recent interaction

This means peer A might trust peer B while peer C doesn't - and that's correct! They have different interaction histories.

## Why Dynamic Installation Matters

The trust system can be installed at runtime:

```javascript
await bl.put('bl:///install/trust', {}, {
  path: './packages/trust/src/upgrade.js',
  thresholds: { read: 0.2, write: 0.5, install: 0.8 }
})
```

This is powerful because:

1. **Gradual adoption** - Start without trust, add it when you need it
2. **Different configurations** - Strict thresholds for production, relaxed for development
3. **Hot-swappable** - Update thresholds without restarting
4. **Composable** - Layer signature verification, rate limiting, etc. as separate middleware

## The Trust Lattice

Trust is modeled as a statistical estimate with monotonic merge semantics:

```javascript
{
  value: 0.75,      // Estimated trust (0-1)
  samples: 42,      // Number of observations
  variance: 0.03    // Statistical uncertainty
}
```

When merging observations (e.g., from different sources or time periods):
- Values combine via weighted average
- Sample counts add
- Variance updates using proper statistical combination

This means trust naturally converges as you gather more data, and uncertainty decreases with more observations.

## Capability Gating

Instead of binary allow/deny, capabilities require different trust levels:

| Capability | Default Threshold | Rationale |
|------------|------------------|-----------|
| `read` | 0.2 | Low bar - reading is generally safe |
| `write` | 0.5 | Medium - changes require more confidence |
| `install` | 0.8 | High - code execution is risky |

New peers start with neutral trust (0.5) but need samples before meeting thresholds:

```javascript
meetsThreshold(estimate, threshold, minSamples = 3)
```

This prevents gaming by requiring actual interaction history.

## Errors as Data

When trust is insufficient, the response is structured data, not an exception:

```javascript
{
  headers: { type: 'bl:///types/error', error: 'insufficient-trust' },
  body: {
    message: 'Peer alice lacks trust for write',
    required: 0.5,
    current: 0.42
  }
}
```

This lets systems reason about trust failures programmatically - maybe retry later, maybe ask for vouching from a trusted peer, maybe fall back to a different resource.

## Peer Identification

The trust system is intentionally decoupled from peer identification. Currently:

```
HTTP header: x-bassline-peer: alice
     ↓
Extracted to: ctx.headers.peer
     ↓
Trust middleware checks: checkCapability('alice', 'read')
```

This separation allows different identification schemes:

**Simple string IDs** (current):
```bash
curl -H "x-bassline-peer: alice" ...
```

**Public keys** (with signature middleware):
```javascript
bl.use(async (ctx, next) => {
  const sig = ctx.headers['x-bassline-signature']
  const pubkey = verifySignature(sig, ctx.body)
  ctx.headers.peer = pubkey  // Set from verified identity
  return next()
}, { priority: 10 })  // Runs before trust middleware
```

**JWT tokens** (with token middleware):
```javascript
bl.use(async (ctx, next) => {
  const token = ctx.headers['authorization']?.split(' ')[1]
  const claims = verifyJWT(token)
  ctx.headers.peer = claims.sub
  return next()
}, { priority: 10 })
```

## Install

```bash
pnpm add @bassline/trust
```

## Usage

### Programmatic

```javascript
import { createTrustSystem } from '@bassline/trust'

const trust = createTrustSystem({
  thresholds: { read: 0.2, write: 0.5, install: 0.8 },
  sampleRate: 0.1  // Verify 10% of requests
})

bl.install(trust.routes)
bl.use(trust.middleware, { priority: 20, id: 'trust' })

// Record observations
trust.observe('alice', 1)  // positive
trust.observe('alice', 0)  // negative

// Check capabilities
trust.checkCapability('alice', 'read')  // true/false
```

### Dynamic Installation

```javascript
await bl.put('bl:///install/trust', {}, {
  path: './packages/trust/src/upgrade.js',
  sampleRate: 0.1,
  thresholds: { read: 0.2, write: 0.5, install: 0.8 }
})
```

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/trust/peers` | GET | List all known peers with trust info |
| `/trust/peers/:id` | GET | Get trust info for specific peer |
| `/trust/observe` | PUT | Record an observation `{ peer, outcome }` |
| `/trust/thresholds` | GET | Get current thresholds |
| `/trust/thresholds` | PUT | Update thresholds |

## Example: Building Trust

```bash
# New peer starts with no trust
curl "http://localhost:9111?uri=bl:///trust/peers/bob"
# → { value: 0.5, samples: 0, variance: 0.25 }

# Record positive observations
curl -X PUT "http://localhost:9111?uri=bl:///trust/observe" \
  -d '{"peer": "bob", "outcome": 1}'

# After several observations
curl "http://localhost:9111?uri=bl:///trust/peers/bob"
# → { value: 0.85, samples: 7, variance: 0.02, capabilities: { read: true, write: true, install: true } }
```

## Design Principles

1. **No global state** - Trust is per-node, computed locally
2. **Statistical foundation** - Uses proper estimation with variance tracking
3. **Monotonic merge** - Can safely combine observations from different sources
4. **Decoupled identity** - Works with any peer identification scheme
5. **Errors as data** - Trust failures are queryable responses, not exceptions
6. **Dynamic installation** - Configure and reconfigure at runtime

## Related

- [@bassline/core](../core) - Router and middleware system
- [@bassline/cells](../cells) - Lattice-based values (could back trust persistence)
