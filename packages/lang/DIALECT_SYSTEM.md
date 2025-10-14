# Bassline Dialect System

## Overview

The Bassline language now has a **dialect system** that allows different interpretation contexts for blocks of code. This enables expressing structure and coordination patterns in domain-specific ways.

## Architecture

### Core Components

1. **Stream** ([utils.js](src/utils.js)) - Enhanced with helper methods:
   - `expect(type, spelling)` - consume and validate
   - `match(type, spelling)` - peek and check
   - `consume(type, spelling)` - try to consume
   - `save()` / `restore(pos)` - backtracking

2. **Dialect Protocol** ([dialectProto.js](src/dialectProto.js)) - Base prototype for all dialects:
   - `enter(block, context)` - entry point
   - `interpret()` - default interpretation loop
   - `build()` - construct final result
   - Keywords as methods on the prototype

3. **Native Functions** ([natives.js](src/natives.js)) - Helpers for creating callables:
   - `native(fn)` - wrap JS function as callable
   - `evalValue(val, context)` - evaluate value in context

4. **Prelude Evaluator** ([prelude.js](src/prelude.js)) - Main evaluator with callable protocol:
   - Invokes dialect words (they consume blocks)
   - Calls native functions (they consume arguments)
   - Handles variable assignment/lookup

## Implemented Dialects

### Gadget Dialect

Define gadget prototypes using declarative syntax:

```rebol
counter: gadget [
  pkg: "@myapp/gadgets"
  name: "counter"
  state: 0
  validate: [input]
  step: [state input]
  handle: [action]
]
```

**Implementation**: [dialects/gadget.js](src/dialects/gadget.js)

**Features**:
- Field assignment via `field: value` syntax
- Keywords: `validate`, `step`, `handle` (consume blocks)
- Builds gadget prototype with metadata
- Stores behavior blocks as data (compilation comes later)

### Link Dialect

Express wiring patterns between gadgets:

```rebol
link [
  a -> b          ; pipe: a feeds to b
  a => [b c d]    ; fanout: a feeds to multiple targets
  [a b] => c      ; fanin: multiple sources feed to c
]
```

**Implementation**: [dialects/link.js](src/dialects/link.js)

**Features**:
- Pipe connections: `a -> b` or `a => b`
- Fanout: `a => [b c d]`
- Fanin: `[a b] => c`
- Creates tap connections between gadgets
- Returns cleanup function

## Prelude Natives

Built-in functions available in the prelude context:

### Dialects
- `gadget [block]` - Define a gadget prototype
- `link [block]` - Create connections between gadgets

### Gadget Operations
- `spawn <proto> [<state>]` - Spawn a gadget instance
- `send <gadget> <value>` - Send a value to a gadget
- `current <gadget>` - Get current state of a gadget

### Utilities
- `print <value>` - Print a value to console

## Usage Example

```rebol
; Define gadget prototypes
counter: gadget [
  pkg: "@demo/gadgets"
  name: "counter"
  state: 0
]

display: gadget [
  pkg: "@demo/gadgets"
  name: "display"
  state: ""
]

; Spawn instances
c1: spawn counter
c2: spawn counter 10
d: spawn display

; Send values
send c1 5
send c2 25

; Get state
result: current c1
print result  ; 5

; Wire gadgets
link [
  c1 -> d
  c2 => [d]
]
```

Run the demo:
```bash
node packages/lang/examples/dialect-demo.js
```

## Design Principles

1. **Data First** - All bassline code is inert data until interpreted by a dialect
2. **Dialects as Prototypes** - Each dialect is a prototype-based interpreter
3. **Keywords as Methods** - Dialect keywords are methods on the proto
4. **Callable Protocol** - Natives and dialects have a `call(stream, context)` method
5. **Stream Consumption** - Both dialects and natives consume arguments from the stream
6. **Context Access** - Dialects have access to the context for word resolution

## Testing

Run the test suite:
```bash
cd packages/lang
pnpm test dialects
```

All tests pass! ✅

## Future Work

### Near Term
1. **Integrate with @bassline/core** - Use real gadget prototypes instead of mock ones
2. **Pack Dialect** - Define packages in bassline
3. **Mold** - Serialize runtime values back to bassline code

### Medium Term
4. **Behavior Compilation** - Compile bassline blocks into JS functions
5. **Do Dialect** - Expression evaluation (arithmetic, control flow)
6. **More Natives** - Math, comparison, string operations

### Long Term
7. **REPL** - Interactive prelude environment
8. **System Snapshots** - Save/load entire gadget systems
9. **Time Travel** - Debug by replaying bassline code

## API Reference

### Creating a Custom Dialect

```javascript
import { dialectProto } from "./dialectProto.js";
import { Block } from "./values.js";

// Create dialect prototype
const myDialectProto = Object.create(dialectProto);

Object.assign(myDialectProto, {
  // Keyword methods (use Symbol.for for case-insensitive matching)
  [Symbol.for("MYKEYWORD")]() {
    const block = this.stream.expect(Block);
    this.state.myKeyword = block;
  },

  // Build final result
  build() {
    // Return whatever you want
    return this.state;
  }
});

// Create interpreter function
export function interpretMyDialect(block, context) {
  const instance = Object.create(myDialectProto);
  return instance.enter(block, context);
}

// Export as callable native
export const myDialectNative = {
  call(stream, context) {
    const block = stream.next();
    return interpretMyDialect(block, context);
  }
};
```

Then register it in the prelude:

```javascript
// In prelude.js
import { myDialectNative } from "./dialects/myDialect.js";

export function createPreludeContext() {
  const context = new Context();
  context.set("mydialect", myDialectNative);
  // ...
  return context;
}
```

Now you can use it:

```rebol
result: mydialect [
  mykeyword [some data]
  field: value
]
```

## File Structure

```
packages/lang/src/
├── parser.js          - Parse bassline syntax to values
├── values.js          - Value types (Num, Str, Word, Block, etc.)
├── context.js         - Symbol-based binding map
├── utils.js           - Stream with helpers, isa, normalize
├── dialectProto.js    - Base dialect protocol
├── prelude.js         - Main evaluator + prelude context
├── natives.js         - Native function helpers
└── dialects/
    ├── ex.js          - Original simple evaluator (kept for reference)
    ├── gadget.js      - Gadget dialect
    └── link.js        - Link dialect
```

## Philosophy

The dialect system embodies Bassline's core philosophy:

- **Homoiconic** - Code is data, data is code
- **Semantic Openness** - Interpretation is context-dependent
- **Minimal Core** - Small primitives, emergent complexity
- **Prototype-Based** - One pattern, infinite extension
- **Fire-and-Forget** - Simple coordination semantics

The goal is to make it **natural to express coordination patterns** without baking in rigid semantics. Dialects are just different lenses for viewing the same data structure.
