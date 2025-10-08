# Parameter System Explained

## The Big Picture

Parameters let you create **reusable gadget types** with **configurable values**.

Think of it like a class with constructor arguments, but using data instead of code.

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PACKAGE DEFINITION (JSON)                                   │
├─────────────────────────────────────────────────────────────┤
│ {                                                            │
│   "gadgets": {                                              │
│     "counter": {                                            │
│       "parameters": {                                       │
│         "min": 0,              ← DEFAULT VALUES            │
│         "max": 100              ← DEFAULT VALUES            │
│       },                                                    │
│       "template": {                                         │
│         "gadgets": {                                        │
│           "minCell": {                                      │
│             "type": "cells.max",                           │
│             "state": "$parameters.min"  ← PLACEHOLDER      │
│           },                                                │
│           "maxCell": {                                      │
│             "type": "cells.min",                           │
│             "state": "$parameters.max"  ← PLACEHOLDER      │
│           }                                                 │
│         }                                                   │
│       }                                                     │
│     }                                                       │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ loadPackage()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ PROTO (in memory, created ONCE)                             │
├─────────────────────────────────────────────────────────────┤
│ counterProto = {                                            │
│   name: "counter",                                          │
│   pkg: "@widgets/counter",                                  │
│   parameters: { min: 0, max: 100 },  ← STORED ON PROTO    │
│   template: {                         ← STORED ON PROTO    │
│     gadgets: {                                              │
│       minCell: { state: "$parameters.min" },               │
│       maxCell: { state: "$parameters.max" }                │
│     }                                                       │
│   },                                                        │
│   afterSpawn(state) {                                       │
│     // Resolves $parameters.* using state + defaults       │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Multiple spawns!
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ INSTANCE 1   │  │ INSTANCE 2   │  │ INSTANCE 3   │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ fromSpec({   │  │ fromSpec({   │  │ fromSpec({   │
│   type: "...",│  │   type: "...",│  │   type: "...",│
│   state: {}  │  │   state: {   │  │   state: {   │
│ })           │  │     min: 10, │  │     max: 50  │
│              │  │     max: 200 │  │   }          │
│ Uses:        │  │   }          │  │ })           │
│ min: 0 (def) │  │ })           │  │              │
│ max: 100(def)│  │              │  │ Uses:        │
│              │  │ Uses:        │  │ min: 0 (def) │
│ minCell: 0   │  │ min: 10 (✓)  │  │ max: 50 (✓)  │
│ maxCell: 100 │  │ max: 200 (✓) │  │              │
│              │  │              │  │ minCell: 0   │
│              │  │ minCell: 10  │  │ maxCell: 50  │
│              │  │ maxCell: 200 │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Step-by-Step Resolution

When you call `fromSpec({ type: "counter", state: { min: 10 } })`:

```javascript
// 1. Find the proto
const proto = bl().packages["@widgets/counter"].counter;

// 2. Call spawn with state
const instance = proto.spawn({ min: 10 });

// 3. Inside afterSpawn:
afterSpawn(state) {
  // state = { min: 10 }

  // 4. Resolve template with parameters
  const resolved = this.resolveParameters(template, state);

  // resolveParameters walks the template and finds strings starting with "$parameters."

  // For "$parameters.min":
  //   - Check state.min → 10 ✓ (use this!)

  // For "$parameters.max":
  //   - Check state.max → undefined
  //   - Check this.parameters.max → 100 ✓ (use default!)

  // 5. Template after resolution:
  // {
  //   gadgets: {
  //     minCell: { type: "cells.max", state: 10 },    ← resolved!
  //     maxCell: { type: "cells.min", state: 100 }   ← resolved!
  //   }
  // }

  // 6. Spawn the actual gadgets
  compound.afterSpawn.call(this, resolved);
}
```

## Key Concepts

### 1. Placeholders

`$parameters.name` is a **placeholder string** in the template:

```json
{
  "state": "$parameters.threshold"
}
```

At spawn time, this gets replaced with an actual value.

### 2. Two-Level Resolution

```javascript
// Priority 1: State (what you pass to spawn)
const instance = proto.spawn({ threshold: 100 });
// → $parameters.threshold becomes 100

// Priority 2: Defaults (what's in proto.parameters)
const instance = proto.spawn({});
// → $parameters.threshold becomes proto.parameters.threshold (e.g., 50)
```

### 3. Template vs Instance

```
PROTO (shared)              INSTANCE (unique)
├─ template (shared)        ├─ scope { minCell, maxCell }
├─ parameters (shared)      ├─ interface {...}
└─ afterSpawn (shared)      └─ state (unique values)
```

The template with `$parameters.*` is stored **once** on the proto.

Each instance gets a **resolved copy** with actual values.

## Example Use Cases

### Configurable Threshold Filter

```javascript
// Package definition
{
  "parameters": { "threshold": 50 },
  "template": {
    "gadgets": {
      "gate": { "type": "cells.max", "state": "$parameters.threshold" }
    }
  }
}

// Create different filters
const lowpass = fromSpec({ type: "filter", state: { threshold: 10 } });
const highpass = fromSpec({ type: "filter", state: { threshold: 90 } });
```

### Bounded Counter

```javascript
// Package definition
{
  "parameters": { "min": 0, "max": 100 },
  "template": {
    "gadgets": {
      "lower": { "state": "$parameters.min" },
      "upper": { "state": "$parameters.max" }
    }
  }
}

// Small counter (0-10)
const small = fromSpec({ type: "counter", state: { max: 10 } });

// Large counter (0-1000)
const large = fromSpec({ type: "counter", state: { max: 1000 } });
```

### UI Component Variants

```javascript
// Package definition
{
  "parameters": {
    "width": 100,
    "height": 100,
    "color": "blue"
  },
  "template": {
    "gadgets": {
      "dims": { "state": {
        "width": "$parameters.width",
        "height": "$parameters.height"
      }},
      "style": { "state": "$parameters.color" }
    }
  }
}

// Small button
const btn1 = fromSpec({ type: "button", state: { width: 50, height: 30 } });

// Large red button
const btn2 = fromSpec({
  type: "button",
  state: { width: 200, height: 60, color: "red" }
});
```

## Common Patterns

### All Defaults

```javascript
// Use all defaults from proto.parameters
const instance = fromSpec({ type: "myGadget", state: {} });
```

### Partial Override

```javascript
// Override some, use defaults for rest
const instance = fromSpec({
  type: "myGadget",
  state: { threshold: 75 }  // Other params use defaults
});
```

### Complete Override

```javascript
// Provide all parameters explicitly
const instance = fromSpec({
  type: "myGadget",
  state: {
    threshold: 100,
    timeout: 5000,
    retries: 3
  }
});
```

## Why This Matters

**Without parameters:**
```javascript
// Have to create a new package for each variant
loadPackage(smallButtonPackage);
loadPackage(mediumButtonPackage);
loadPackage(largeButtonPackage);
```

**With parameters:**
```javascript
// One package, infinite variants!
loadPackage(buttonPackage);
const small = fromSpec({ type: "button", state: { size: 50 } });
const medium = fromSpec({ type: "button", state: { size: 100 } });
const large = fromSpec({ type: "button", state: { size: 200 } });
```

**This is the key to building reusable component libraries!** 🎉

## See It In Action

Run the explanation demo:
```bash
node src/explain-parameters.js
```

Or the complete workflow demo:
```bash
node src/demo-complete-workflow.js
```
