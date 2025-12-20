# @bassline/trust

Local trust computation and capability gating for Bassline.

## Install

```bash
pnpm add @bassline/trust
```

## Usage

```javascript
import { createTrust } from '@bassline/trust'

const trust = createTrust({
  thresholds: { read: 0.2, write: 0.5, install: 0.8 },
})

// Record observations
await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 1 }) // positive
await trust.put({ path: '/observe' }, { peer: 'alice', outcome: 0 }) // negative

// Check peer trust
const peerTrust = await trust.get({ path: '/peers/alice' })
// → { body: { id: 'alice', value: 0.75, samples: 2, capabilities: { read: true, write: true, install: false } } }

// Check capability
trust.checkCapability('alice', 'write') // true/false

// Get/set thresholds
const thresholds = await trust.get({ path: '/thresholds' })
await trust.put({ path: '/thresholds' }, { write: 0.6 })
```

## Why Trust?

In distributed systems, traditional approaches use ACLs, capability tokens, or central authorities. These have problems:

- ACLs require knowing all peers ahead of time
- Capabilities can be stolen or replayed
- Central authorities are single points of failure

**Trust-based systems** compute confidence from observed behavior. Instead of asking "is this peer allowed?", we ask "based on our history, how confident are we they'll behave well?"

## Trust is Local

There is no global trust score. Each node maintains its own view based on:

1. **Direct observation** - Did this peer's data validate?
2. **Sample verification** - Randomly check a fraction of interactions
3. **Decay over time** - Confidence decreases without recent interaction

Peer A might trust peer B while peer C doesn't - and that's correct. They have different histories.

## The Trust Lattice

Trust is modeled as a statistical estimate with monotonic merge semantics:

```javascript
{
  value: 0.75,      // Estimated trust (0-1)
  samples: 42,      // Number of observations
  variance: 0.03    // Statistical uncertainty
}
```

When merging observations:

- Values combine via weighted average
- Sample counts add
- Variance updates using proper statistical combination

Trust naturally converges as you gather more data.

## Capability Gating

Different operations require different trust levels:

| Capability | Default Threshold | Rationale                                |
| ---------- | ----------------- | ---------------------------------------- |
| `read`     | 0.2               | Low bar - reading is generally safe      |
| `write`    | 0.5               | Medium - changes require more confidence |
| `install`  | 0.8               | High - code execution is risky           |

New peers start with neutral trust (0.5) but need samples before meeting thresholds:

```javascript
trust.checkCapability('newpeer', 'write') // false - no samples yet
```

## Routes

| Route         | Method | Description                            |
| ------------- | ------ | -------------------------------------- |
| `/`           | GET    | Service info                           |
| `/peers`      | GET    | List known peers                       |
| `/peers/:id`  | GET    | Get trust info for peer                |
| `/observe`    | PUT    | Record observation `{ peer, outcome }` |
| `/thresholds` | GET    | Get capability thresholds              |
| `/thresholds` | PUT    | Update thresholds                      |

## Direct API

```javascript
import { createTrust, trustEstimate } from '@bassline/trust'

const trust = createTrust()

// Direct methods (skip resource interface)
trust.observe('bob', 1) // Record positive observation
trust.getTrust('bob') // Get trust estimate
trust.checkCapability('bob', 'read') // Check capability

// Trust lattice operations
const initial = trustEstimate.initial() // { value: 0.5, samples: 0, variance: 0.25 }
const updated = trustEstimate.observe(initial, 1)
const merged = trustEstimate.merge(a, b)
const decayed = trustEstimate.decay(estimate, 0.5)
trustEstimate.meetsThreshold(estimate, 0.5) // true/false
trustEstimate.confidenceInterval(estimate) // { low, high }
```

## Design Principles

1. **No global state** - Trust is per-node, computed locally
2. **Statistical foundation** - Uses proper estimation with variance tracking
3. **Monotonic merge** - Can safely combine observations from different sources
4. **Decoupled identity** - Works with any peer identification scheme
5. **Errors as data** - Trust failures return conditions, not exceptions

## Related

- [@bassline/core](../core) - Resource primitives
