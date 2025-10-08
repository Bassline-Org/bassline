# Parameter Extraction Explained

## The Problem It Solves

You have a compound gadget that works great:

```javascript
const myCompound = {
  gadgets: {
    threshold: { type: "cells.max", state: 50 },
    input: { type: "cells.max", state: 0 },
    output: { type: "cells.last", state: 0 }
  }
};
```

You want to make it **reusable** so others can create it with different thresholds.

**Manual approach** (tedious):
```javascript
// 1. Replace value with placeholder
const template = {
  gadgets: {
    threshold: { type: "cells.max", state: "$parameters.threshold" }, // ← Manual!
    ...
  }
};

// 2. Extract default manually
const parameters = { threshold: 50 }; // ← Manual!

// 3. Export
exportAsPackage({ template, parameters });
```

**Automated approach** (easy):
```javascript
// Just tell it WHICH gadgets to parameterize
const { spec, parameters } = extractParameters(myCompound, {
  include: ["threshold"]
});

// Done! spec has $parameters.threshold, parameters has { threshold: 50 }
exportAsPackage(spec, { parameters });
```

## Visual Flow

```
INPUT: Compound spec with concrete values
┌──────────────────────────────────────────┐
│ {                                         │
│   gadgets: {                             │
│     minThreshold: {                      │
│       type: "cells.max",                 │
│       state: 50          ← Want to make │
│     },                      configurable │
│     maxThreshold: {                      │
│       type: "cells.min",                 │
│       state: 200         ← Want to make │
│     },                      configurable │
│     input: {                             │
│       type: "cells.max",                 │
│       state: 0           ← Keep as-is   │
│     }                                    │
│   }                                      │
│ }                                        │
└──────────────────────────────────────────┘
                 │
                 │ extractParameters(spec, {
                 │   include: ["minThreshold", "maxThreshold"]
                 │ })
                 │
                 ▼
┌──────────────────────────────────────────┐
│ DETECTION PHASE                           │
├──────────────────────────────────────────┤
│ Scan each gadget:                        │
│                                           │
│ minThreshold:                            │
│   ✓ In include list                     │
│   ✓ State is primitive (50)             │
│   → Add to parameterization list        │
│                                           │
│ maxThreshold:                            │
│   ✓ In include list                     │
│   ✓ State is primitive (200)            │
│   → Add to parameterization list        │
│                                           │
│ input:                                   │
│   ✗ Not in include list                 │
│   → Skip                                 │
└──────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ PATH MAPPING                              │
├──────────────────────────────────────────┤
│ Build path → param name mapping:         │
│                                           │
│ {                                         │
│   "state.gadgets.minThreshold.state":    │
│       "minThreshold",                    │
│   "state.gadgets.maxThreshold.state":    │
│       "maxThreshold"                     │
│ }                                         │
└──────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ VALUE EXTRACTION                          │
├──────────────────────────────────────────┤
│ For each path, extract current value:    │
│                                           │
│ Navigate to:                              │
│   spec.state.gadgets.minThreshold.state  │
│   → Found: 50                            │
│   → parameters.minThreshold = 50         │
│                                           │
│ Navigate to:                              │
│   spec.state.gadgets.maxThreshold.state  │
│   → Found: 200                           │
│   → parameters.maxThreshold = 200        │
└──────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ REPLACEMENT                               │
├──────────────────────────────────────────┤
│ Replace values with placeholders:        │
│                                           │
│ At "state.gadgets.minThreshold.state":   │
│   50 → "$parameters.minThreshold"        │
│                                           │
│ At "state.gadgets.maxThreshold.state":   │
│   200 → "$parameters.maxThreshold"       │
└──────────────────────────────────────────┘
                 │
                 ▼
OUTPUT: Parameterized spec + defaults
┌──────────────────────────────────────────┐
│ SPEC (parameterized):                     │
│ {                                         │
│   gadgets: {                             │
│     minThreshold: {                      │
│       type: "cells.max",                 │
│       state: "$parameters.minThreshold" │
│     },                                    │
│     maxThreshold: {                      │
│       type: "cells.min",                 │
│       state: "$parameters.maxThreshold" │
│     },                                    │
│     input: {                             │
│       type: "cells.max",                 │
│       state: 0                           │
│     }                                    │
│   }                                      │
│ }                                        │
│                                           │
│ PARAMETERS (defaults):                   │
│ {                                         │
│   minThreshold: 50,                      │
│   maxThreshold: 200                      │
│ }                                        │
└──────────────────────────────────────────┘
```

## Step-by-Step Example

### Starting Point

```javascript
const spec = {
  state: {
    gadgets: {
      min: { type: "cells.max", state: 10 },
      max: { type: "cells.min", state: 100 },
      count: { type: "cells.max", state: 0 }
    }
  }
};
```

### Call extractParameters

```javascript
const result = extractParameters(spec, {
  include: ["min", "max"]  // Only these two
});
```

### What Happens Inside

#### Phase 1: Detection
```javascript
// Loop through gadgets
for (const [name, gadgetSpec] of Object.entries(spec.state.gadgets)) {
  // name = "min", gadgetSpec = { type: "cells.max", state: 10 }

  if (!include.includes(name)) continue; // Skip "count"

  if (typeof gadgetSpec.state !== "object") {
    // It's a primitive! Add to list
    detected["state.gadgets.min.state"] = "min";
  }
}

// Result: detected = {
//   "state.gadgets.min.state": "min",
//   "state.gadgets.max.state": "max"
// }
```

#### Phase 2: Extract Values
```javascript
const parameters = {};

for (const [path, paramName] of Object.entries(detected)) {
  // path = "state.gadgets.min.state"
  // Navigate through spec to get the value

  let obj = spec;
  obj = obj["state"];     // spec.state
  obj = obj["gadgets"];   // spec.state.gadgets
  obj = obj["min"];       // spec.state.gadgets.min
  const value = obj["state"]; // spec.state.gadgets.min.state → 10

  parameters[paramName] = value; // parameters.min = 10
}

// Result: parameters = { min: 10, max: 100 }
```

#### Phase 3: Replace
```javascript
const parameterized = parameterizeSpec(spec, detected);
// Walks spec and replaces:
//   spec.state.gadgets.min.state: 10 → "$parameters.min"
//   spec.state.gadgets.max.state: 100 → "$parameters.max"
```

### Result

```javascript
console.log(result);
// {
//   spec: {
//     state: {
//       gadgets: {
//         min: { type: "cells.max", state: "$parameters.min" },
//         max: { type: "cells.min", state: "$parameters.max" },
//         count: { type: "cells.max", state: 0 }  // Unchanged!
//       }
//     }
//   },
//   parameters: {
//     min: 10,
//     max: 100
//   }
// }
```

## Options

### Include Only Specific Gadgets

```javascript
extractParameters(spec, {
  include: ["threshold", "timeout"]
});
// Only these two gadgets will be parameterized
```

### Exclude Specific Gadgets

```javascript
extractParameters(spec, {
  exclude: ["internal", "temp"]
});
// Everything EXCEPT these will be parameterized
```

### No Options = Parameterize Everything

```javascript
extractParameters(spec);
// All gadgets with primitive states become parameters
```

## What Gets Parameterized

### ✅ Primitives (numbers, strings, booleans)
```javascript
{ type: "cells.max", state: 50 }           → "$parameters.gadgetName"
{ type: "cells.last", state: "hello" }     → "$parameters.gadgetName"
{ type: "toggle", state: true }            → "$parameters.gadgetName"
```

### ✅ Nested Object Properties
```javascript
{
  type: "rect",
  state: { width: 100, height: 200 }
}
// Becomes:
// {
//   type: "rect",
//   state: {
//     width: "$parameters.rect_width",
//     height: "$parameters.rect_height"
//   }
// }
```

### ✗ Refs (Skipped)
```javascript
{ ref: "input" }  // Not parameterized (it's a reference, not a value)
```

### ✗ Arrays and Complex Objects (Skipped)
```javascript
{ state: [1, 2, 3] }          // Not parameterized (array)
{ state: { nested: {...} } }  // Not parameterized (complex object)
```

## Real-World Usage

### Making a Reusable Counter

```javascript
// 1. Create concrete version
const counterSpec = {
  gadgets: {
    min: { type: "cells.max", state: 0 },
    max: { type: "cells.min", state: 100 },
    count: { type: "cells.max", state: 0 }
  }
};

// 2. Extract parameters (only bounds are configurable)
const { spec, parameters } = extractParameters(counterSpec, {
  include: ["min", "max"]
});

// 3. Export as package
const pkg = exportAsPackage(spec, {
  name: "@widgets/counter",
  gadgetName: "boundedCounter",
  parameters  // { min: 0, max: 100 }
});

// 4. Save and load
await savePackage(pkg, "./counter.json");
await loadPackageFromFile("./counter.json");

// 5. Create different counters!
const small = fromSpec({ type: "boundedCounter", state: { max: 10 } });
const large = fromSpec({ type: "boundedCounter", state: { max: 1000 } });
```

## Why This Matters

**Without extraction:**
- Manually write path strings like `"state.gadgets.threshold.state"`
- Manually build parameter defaults object
- Error-prone and tedious for complex specs

**With extraction:**
- Just say `{ include: ["threshold"] }`
- Paths and defaults extracted automatically
- Fast, correct, easy

**This makes the package system actually usable!** 🎉

## See It In Action

Run the detailed walkthrough:
```bash
node src/explain-extraction.js
```

Or see it in the complete demo:
```bash
node src/demo-complete-workflow.js
```
