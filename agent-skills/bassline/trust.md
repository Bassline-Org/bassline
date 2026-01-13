# Trust - Capability Gating

The trust package provides peer trust computation and capability gating, allowing you to control access based on observed behavior.

## Creating the Trust System

```javascript
import { createTrust } from '@bassline/trust'

const trust = createTrust({
  thresholds: {
    read: 0.2, // Minimum trust for read access
    write: 0.5, // Minimum trust for write access
    install: 0.8, // Minimum trust for installing code
  },
})
```

## Recording Observations

Build trust through observed outcomes:

```javascript
// Record a successful interaction
await trust.put(
  { path: '/observe' },
  {
    peer: 'peer-123',
    outcome: 1, // Success (positive outcome)
  }
)

// Record a failed/bad interaction
await trust.put(
  { path: '/observe' },
  {
    peer: 'peer-123',
    outcome: 0, // Failure (negative outcome)
  }
)
```

Outcomes should be between 0 and 1:

- `1` = fully positive (successful, trustworthy)
- `0` = fully negative (failed, untrustworthy)
- Values between for partial success

## Checking Trust

### Get Peer Trust Info

```javascript
const { body } = await trust.get({ path: '/peers/peer-123' })

// {
//   id: 'peer-123',
//   alpha: 3,           // Positive observations + 1
//   beta: 2,            // Negative observations + 1
//   confidence: [0.3, 0.7],  // 95% confidence interval
//   capabilities: {
//     read: true,
//     write: false,
//     install: false
//   }
// }
```

### List All Peers

```javascript
const { body } = await trust.get({ path: '/peers' })

// {
//   name: 'peers',
//   resources: {
//     '/peer-123': { alpha: 3, beta: 2, confidence: [0.3, 0.7] },
//     '/peer-456': { alpha: 10, beta: 1, confidence: [0.7, 0.95] }
//   }
// }
```

## Managing Thresholds

### Get Current Thresholds

```javascript
const { body } = await trust.get({ path: '/thresholds' })
// { read: 0.2, write: 0.5, install: 0.8 }
```

### Update Thresholds

```javascript
await trust.put(
  { path: '/thresholds' },
  {
    read: 0.1, // Lower bar for reading
    write: 0.6, // Higher bar for writing
    install: 0.9, // Much higher bar for installing
  }
)
```

## Programmatic API

The trust resource exposes helper methods for middleware use:

```javascript
// Check if peer can perform action
const canWrite = trust.checkCapability('peer-123', 'write')
// Returns true/false

// Record observation directly
trust.observe('peer-123', 0.8) // Mostly successful

// Get trust estimate
const trustInfo = trust.getTrust('peer-123')
// { alpha: N, beta: M }
```

## How Trust Works

Trust is computed using Beta distribution statistics:

1. **Initial state**: `alpha = 1, beta = 1` (uniform prior, no observations)
2. **Each observation** updates the parameters:
   - Success (outcome=1): `alpha += 1`
   - Failure (outcome=0): `beta += 1`
   - Partial: proportionally updates both
3. **Trust estimate**: `alpha / (alpha + beta)`
4. **Confidence interval**: Narrows as more observations accumulate

The more observations, the more confident the trust estimate becomes.

## Patterns

### Gating Middleware

```javascript
import { resource, routes } from '@bassline/core'

function withTrust(trustSystem, capability, handler) {
  return resource({
    get: async h => {
      const peerId = h.headers?.['x-peer-id']
      if (peerId && !trustSystem.checkCapability(peerId, capability)) {
        return {
          headers: { condition: 'forbidden', message: `Insufficient trust for ${capability}` },
          body: null,
        }
      }
      return handler.get(h)
    },
    put: async (h, b) => {
      const peerId = h.headers?.['x-peer-id']
      if (peerId && !trustSystem.checkCapability(peerId, capability)) {
        return {
          headers: { condition: 'forbidden', message: `Insufficient trust for ${capability}` },
          body: null,
        }
      }
      return handler.put(h, b)
    },
  })
}

// Apply to resources
const protectedStore = withTrust(trust, 'write', storeResource)
const protectedInstall = withTrust(trust, 'install', installResource)
```

### Building Trust Over Time

```javascript
async function handlePeerRequest(peerId, action) {
  try {
    const result = await performAction(action)

    // Record successful interaction
    await trust.put(
      { path: '/observe' },
      {
        peer: peerId,
        outcome: 1,
      }
    )

    return result
  } catch (err) {
    // Record failed interaction
    await trust.put(
      { path: '/observe' },
      {
        peer: peerId,
        outcome: 0,
      }
    )

    throw err
  }
}
```

### Gradual Capability Escalation

```javascript
const CAPABILITY_LEVELS = [
  { name: 'read', threshold: 0.2, required: 3 }, // 3 successful reads
  { name: 'write', threshold: 0.5, required: 10 }, // 10 successful ops
  { name: 'install', threshold: 0.8, required: 50 }, // 50 successful ops
]

async function getAvailableCapabilities(peerId) {
  const { body } = await trust.get({ path: `/peers/${peerId}` })

  return CAPABILITY_LEVELS.filter(level => body.capabilities[level.name]).map(level => level.name)
}
```

### Trust Decay (Manual)

If you want trust to decay over time, periodically add neutral observations:

```javascript
async function decayTrust() {
  const { body } = await trust.get({ path: '/peers' })

  for (const peerId of Object.keys(body.resources)) {
    // Add slightly negative observation to decay trust
    await trust.put(
      { path: '/observe' },
      {
        peer: peerId.slice(1), // Remove leading /
        outcome: 0.4, // Slightly negative
      }
    )
  }
}

// Run decay weekly
setInterval(decayTrust, 7 * 24 * 60 * 60 * 1000)
```

### Trust-Based Routing

```javascript
const app = routes({
  // Public endpoints - no trust required
  public: publicResource,

  // Trusted endpoints
  data: resource({
    get: async h => {
      const peerId = h.params?.peerId
      const { body } = await trust.get({ path: `/peers/${peerId}` })

      if (body.capabilities.read) {
        return dataResource.get(h)
      }
      return { headers: { condition: 'forbidden' }, body: null }
    },
  }),

  // Highly trusted endpoints
  admin: resource({
    put: async (h, b) => {
      const peerId = h.params?.peerId
      const { body } = await trust.get({ path: `/peers/${peerId}` })

      if (body.capabilities.install) {
        return adminResource.put(h, b)
      }
      return { headers: { condition: 'forbidden' }, body: null }
    },
  }),
})
```

### Integration with Kit

```javascript
// Create a trust-aware kit
function createTrustKit(inner, trustSystem, peerId) {
  return resource({
    get: async h => {
      if (!trustSystem.checkCapability(peerId, 'read')) {
        return { headers: { condition: 'forbidden' }, body: null }
      }
      const result = await inner.get(h)
      trustSystem.observe(peerId, result.headers.condition ? 0.5 : 1)
      return result
    },
    put: async (h, b) => {
      if (!trustSystem.checkCapability(peerId, 'write')) {
        return { headers: { condition: 'forbidden' }, body: null }
      }
      const result = await inner.put(h, b)
      trustSystem.observe(peerId, result.headers.condition ? 0.5 : 1)
      return result
    },
  })
}
```
