# Boot System Documentation

## Overview

The Atto-Bassline boot system provides a reproducible, auditable way to initialize propagation networks. It establishes the root of trust, initial gain distribution, and runtime policies through declarative boot scripts.

## Core Concepts

### Bootstrap vs Runtime

The system has two distinct phases:

1. **Bootstrap Phase** (one-time initialization)
   - Creates the user control socket
   - Establishes initial gain distribution
   - Sets up minting authorities
   - Loads primitive gadgets
   - Generates audit receipts

2. **Runtime Phase** (normal operation)
   - Strict gain conservation
   - Only authorized minting
   - All operations generate receipts
   - No gain creation from thin air

### Root of Trust

The root of all trust is the literal user at the computer. The boot system creates a "user control socket" that represents this authority:

```typescript
{
  userControl: {
    id: "user-socket",
    initialGain: 100000,  // 10.0 worth of gain
    authority: "root"
  }
}
```

## Boot Script Format

Boot scripts are JSON files that define network initialization:

```json
{
  "version": "1.0",
  "timestamp": "2024-01-20T10:00:00Z",
  "bootstrap": {
    "userControl": {
      "id": "user-socket",
      "type": "control",
      "initialGain": 100000,
      "authority": "root"
    },
    "primitives": {
      "source": "builtin",
      "allowed": ["add", "multiply", "transistor", "spawner"],
      "denied": ["dangerous-op"]
    },
    "initialGadgets": [
      {
        "id": "main-minter",
        "type": "gainMinter",
        "gain": 10000,
        "authority": "mint",
        "parent": "user-socket"
      },
      {
        "id": "trusted-spawner",
        "type": "spawner",
        "gain": 5000,
        "parent": "user-socket"
      }
    ]
  },
  "policy": {
    "gainConservation": "strict",
    "propagationSemantics": "argmax-strict",
    "contradictionHandling": "signal",
    "receiptGeneration": true
  }
}
```

## Boot Script Fields

### Required Fields

- `version`: Boot script format version
- `bootstrap.userControl.id`: Unique ID for user control socket
- `bootstrap.userControl.initialGain`: Starting gain amount

### Optional Fields

- `timestamp`: When the script was created
- `bootstrap.userControl.type`: Type of control socket
- `bootstrap.userControl.authority`: Authority level (default: "root")
- `bootstrap.primitives`: Which primitive gadgets to load
- `bootstrap.initialGadgets`: Pre-created gadgets with gain
- `policy`: Runtime policy configuration

## Using Boot Scripts

### Basic Usage

```typescript
import { bootNetwork } from 'atto-bassline'

// Load from file
const network = await bootNetwork('./config/boot.json')

// Or provide inline
const network = await bootNetwork({
  version: "1.0",
  bootstrap: {
    userControl: {
      id: "user",
      initialGain: 100000
    }
  }
})
```

### Accessing Network Components

```typescript
const network = await bootNetwork(script)

// Access user control socket
const userSocket = network.gadgets.get('user')

// Access initial gadgets
const minter = network.gadgets.get('main-minter')

// View boot receipts
const receipts = network.receipts
```

## Gain Distribution

### Initial Gain

The user control socket receives initial gain during bootstrap:

```typescript
{
  userControl: {
    initialGain: 100000  // 10.0 worth of gain
  }
}
```

This generates a receipt:
```typescript
{
  id: "boot-001",
  gadgetId: "user-socket",
  amount: 100000,
  timestamp: 1706270400000,
  reason: "Bootstrap: Initial gain for user control"
}
```

### Distributing Gain to Gadgets

Initial gadgets can receive gain from the user control:

```typescript
{
  initialGadgets: [{
    id: "spawner-1",
    type: "spawner",
    gain: 5000,  // 0.5 worth of gain
    parent: "user-socket"
  }]
}
```

This transfers gain from user control to the gadget and generates receipts.

## Minting Authority

### Authorized Minters

Only gadgets with minting authority can create new gain during runtime:

```typescript
{
  initialGadgets: [{
    id: "runtime-minter",
    type: "gainMinter",
    gain: 0,  // Doesn't need initial gain
    authority: "mint"  // Can create gain
  }]
}
```

### Minting During Runtime

```typescript
// Wire up the minter
const minter = network.gadgets.get('runtime-minter')
propagate(minter.contacts.get('amount'), signal(1000, 1.0))
propagate(minter.contacts.get('validator'), signal(true, 1.1))
propagate(minter.contacts.get('target'), signal('gadget-id', 1.2))

// Minter creates gain when validated
// Generates receipt for audit trail
```

## Policy Configuration

### Gain Conservation

```typescript
{
  policy: {
    gainConservation: "strict"  // or "relaxed"
  }
}
```

- `strict`: No gain creation without authority (recommended)
- `relaxed`: Allows some gain creation (testing only)

### Propagation Semantics

```typescript
{
  policy: {
    propagationSemantics: "argmax-strict"  // or "legacy"
  }
}
```

- `argmax-strict`: Strict > propagation with contradiction detection
- `legacy`: Old >= semantics (not recommended)

### Contradiction Handling

```typescript
{
  policy: {
    contradictionHandling: "signal"  // or "throw"
  }
}
```

- `signal`: Contradictions become signals that propagate
- `throw`: Contradictions throw errors (debugging)

## Security Considerations

### Minimal Bootstrap

Keep the bootstrap phase minimal:
- Only create essential gadgets
- Distribute minimal initial gain
- Use specific primitive allowlists

### Auditable Scripts

Boot scripts should be:
- Version controlled
- Timestamped
- Documented
- Reviewed before use

### Receipt Verification

All bootstrap operations generate receipts:

```typescript
const network = await bootNetwork(script)

// Verify expected receipts
for (const receipt of network.receipts) {
  console.log(`${receipt.gadgetId}: ${receipt.amount} units`)
}

// Total gain should match initial amount
const total = network.receipts.reduce((sum, r) => sum + r.amount, 0)
assert(total === script.bootstrap.userControl.initialGain)
```

## Examples

### Minimal Boot Script

```json
{
  "version": "1.0",
  "bootstrap": {
    "userControl": {
      "id": "user",
      "initialGain": 10000
    }
  }
}
```

### Development Boot Script

```json
{
  "version": "1.0",
  "bootstrap": {
    "userControl": {
      "id": "dev-user",
      "initialGain": 1000000
    },
    "primitives": {
      "source": "builtin"
    },
    "initialGadgets": [
      {
        "id": "test-minter",
        "type": "gainMinter",
        "authority": "mint"
      },
      {
        "id": "test-spawner",
        "type": "spawner",
        "gain": 100000
      }
    ]
  },
  "policy": {
    "gainConservation": "relaxed",
    "contradictionHandling": "throw"
  }
}
```

### Production Boot Script

```json
{
  "version": "1.0",
  "timestamp": "2024-01-20T10:00:00Z",
  "bootstrap": {
    "userControl": {
      "id": "prod-user",
      "initialGain": 50000,
      "authority": "root"
    },
    "primitives": {
      "source": "builtin",
      "allowed": ["add", "multiply", "transistor"],
      "denied": ["spawner", "evolver"]
    },
    "initialGadgets": [
      {
        "id": "system-minter",
        "type": "gainMinter",
        "gain": 0,
        "authority": "mint",
        "config": {
          "maxMint": 1000,
          "cooldown": 60000
        }
      }
    ]
  },
  "policy": {
    "gainConservation": "strict",
    "propagationSemantics": "argmax-strict",
    "contradictionHandling": "signal",
    "receiptGeneration": true
  }
}
```

## Testing

### Creating Test Scripts

```typescript
import { createTestBootScript } from 'atto-bassline'

const script = createTestBootScript({
  initialGain: 100000,
  enableMinter: true,
  enableSpawner: true
})

const network = await bootNetwork(script)
```

### Validating Boot Scripts

```typescript
import { loadBootScript } from 'atto-bassline'

try {
  const script = await loadBootScript('./boot.json')
  // Script is valid
} catch (error) {
  console.error('Invalid boot script:', error)
}
```

## Best Practices

1. **Version Control**: Always version control boot scripts
2. **Documentation**: Document why each gadget needs initial gain
3. **Minimal Authority**: Only grant minting authority when necessary
4. **Receipt Review**: Regularly audit receipts from bootstrap
5. **Testing**: Test boot scripts thoroughly before production
6. **Reproducibility**: Use timestamps and versions for reproducible boots

## Migration Guide

### From Hardcoded Initialization

Before:
```typescript
const network = createNetwork()
network.userGain = 100000
const minter = createGainMinter('minter')
network.gadgets.set('minter', minter)
```

After:
```typescript
const network = await bootNetwork({
  version: "1.0",
  bootstrap: {
    userControl: {
      id: "user",
      initialGain: 100000
    },
    initialGadgets: [{
      id: "minter",
      type: "gainMinter",
      authority: "mint"
    }]
  }
})
```

### From Environment Variables

Before:
```typescript
const gain = parseInt(process.env.INITIAL_GAIN || "10000")
```

After:
```typescript
const script = {
  version: "1.0",
  bootstrap: {
    userControl: {
      initialGain: parseInt(process.env.INITIAL_GAIN || "10000")
    }
  }
}
const network = await bootNetwork(script)
```

## Troubleshooting

### Common Issues

**"No gain to transfer"**
- Check that user control has sufficient initial gain
- Verify gadgets are requesting reasonable amounts

**"Unauthorized minting"**
- Only gadgets with `authority: "mint"` can create gain
- Check the gadget has minting authority in boot script

**"Invalid boot script"**
- Ensure required fields are present
- Validate JSON syntax
- Check version compatibility

**"Receipt mismatch"**
- Sum of all receipts should equal initial gain
- Check for duplicate gadget IDs
- Verify gain transfers are logged

## Future Directions

- **Signed Scripts**: Cryptographic signatures for scripts
- **Remote Scripts**: Load scripts from secure servers
- **Script Composition**: Combine multiple boot scripts
- **Hot Reload**: Update policies without restart
- **Capability System**: Fine-grained authority model