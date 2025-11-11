# Bassline Session Context - 2025-01-15

## Current Work: LayeredControl UI Architecture

**See [LAYERED-CONTROL-UI-PLAN.md](/Users/goose/prg/bassline/LAYERED-CONTROL-UI-PLAN.md) for complete UI architecture plan.**

We're implementing a composable, interactive panel-based UI for the LayeredControl system (Git-style version control for graph layers). The plan follows an incremental, testable approach with 9 stages:

1. **Stage 1 (IN PROGRESS)**: Make LayeredControl reactive (extend EventTarget, emit events)
2. **Stage 2**: Build 8 core React hooks with useSyncExternalStore
3. **Stage 3**: LayerListPanel (simple interactive panel)
4. **Stage 4**: ReplPanel (text-based layer interaction)
5. **Stage 5**: PlugboardPanel (React Flow visual routing - fully interactive)
6. **Stage 6**: StagingPanel (commit UI)
7. **Stage 7**: HistoryPanel (interactive Git graph)
8. **Stage 8**: Panel layout system (react-grid-layout)
9. **Stage 9**: Polish & integration

**Key principles:**
- Interactive, not just visual (plugboard lets you rewire, history lets you branch)
- Composable panels
- Minimal hooks (8 total)
- Testable at each stage

## Major Accomplishments This Session

### 1. Documentation System (COMPLETED ✅)
- **Fixed `doc` function** to use `Symbol.for("DOC")` instead of string keys
- **Fixed `describe` function** to:
  - Take literal word arguments (not evaluated)
  - Return Bassline `Str` instead of plain JS objects
  - Show function signature + documentation
- **Extended `native()` function** in natives.js to accept optional metadata:
  ```javascript
  native(fn, { doc, args, examples })
  ```
  - Metadata stored as Symbol properties on native objects
  - Supports DOC, ARGS, EXAMPLES
- **Updated `help` and `describe`** to read native documentation from Symbol properties
- **Documented 11 core natives**:
  - arithmetic.js: `+`, `-`, `*`, `/`, `%`
  - comparison.js: `=`, `<`, `>`, `<=`, `>=`, `not=`

### 2. VIEW Dialect Enhancements (COMPLETED ✅)
- **Added `table` component** for structured data display
  - Takes headers and rows
  - Renders as styled HTML table in React
- **Added `code` component** for code blocks
  - Syntax highlighting support
  - Language parameter
- **Added `reduce` primitive** to series.js:
  - Evaluates each element in a block
  - Returns array of evaluated results
  - Solves the pattern: `reduce [x y (+ x y)]` → `[5 10 15]`
  - Critical for building arrays from computed values

### 3. Gadgets Integration (COMPLETED ✅)
**The big achievement of this session!**

Created full integration of @bassline/core gadgets into Bassline language:

**Core Functions:**
```bassline
gadget proto state   ; Create gadget from prototype
receive gadget value ; Send input to gadget
current gadget       ; Get current state
tap gadget [handler] ; Subscribe to changes
```

**Available Cell Types:**
- `MAX` / `MIN` - Numeric monotonic cells
- `UNION` / `INTERSECTION` - Set operations  
- `FIRST` / `LAST` - Write strategies
- `UNSAFE-LAST` - Always replace

**Critical Implementation Details:**
1. **Value Conversion** (ESSENTIAL!):
   - Gadgets work with JavaScript primitives
   - Bassline has wrapped values (Num, Str, Block)
   - Must convert at every boundary:
     - `gadget`: Convert initial state Bassline → JS before `spawn()`
     - `receive`: Convert input Bassline → JS before `receive()`
     - `current`: Convert state JS → Bassline when returning
     - `tap`: Convert effects JS → Bassline before executing handler
   - Use `basslineToJs()` and `jsToBassline()` from helpers.js

2. **Context Handling in Taps**:
   - Each tap handler gets its own child context: `new Context(context)`
   - NOT `context.createChild()` - that method doesn't exist!
   - Prevents handlers from polluting global context
   - Effects converted to Bassline and set in child context

3. **Package Setup**:
   - Added @bassline/cells and @bassline/taps to package.json dependencies
   - Import and install packages at module load time:
     ```javascript
     import { bl } from "@bassline/core";
     bl();  // Initialize bassline
     import cellsPackage from "@bassline/cells";
     const { installPackage } = bl();
     installPackage(cellsPackage);
     import { installTaps } from "@bassline/taps";
     installTaps();  // Add tap support to all gadgets
     ```

**Files Modified/Created:**
- packages/lang/src/prelude/gadgets.js - Full gadget integration (~150 lines)
- packages/lang/package.json - Added dependencies
- packages/lang/examples/counter-gadget.bl - Comprehensive examples
- packages/lang/src/prelude/dialects.js - Removed old gadget import

### 4. Examples Created (COMPLETED ✅)
**Documentation Examples:**
- documentation-demo.bl - How to use doc/help/describe
- stdlib-docs.bl - Reference for all built-in functions
- native-documentation.bl - Guide for native documentation

**Language Basics:**
- arithmetic.bl - Math operations with examples
- variables.bl - Variable usage patterns
- conditionals.bl - if/either patterns
- loops.bl - foreach/repeat/while
- blocks.bl - Array/list operations

**VIEW Examples:**
- table-demo.bl - Table component showcase (fixed with `reduce`)
- code-demo.bl - Code block examples
- view-demo.bl - Basic VIEW components

**Gadget Examples:**
- counter-gadget.bl - 10 comprehensive gadget examples

## Key Architectural Decisions

### Why Integrate Existing Gadgets (Not Reimplement)
- Leverage proven @bassline/core implementation
- Get all cells for free (max, min, union, etc.)
- Native JS performance
- Taps extension already exists and works

### Value Conversion Strategy
- Convert at the boundary, not internally
- Gadgets remain pure JavaScript
- Bassline side handles all wrapping/unwrapping
- Transparent to the user

### Context Isolation for Taps
- Each tap gets `new Context(parentContext)`
- Effects bound in child context
- Prevents variable collisions between taps

## Known Issues & Limitations

1. **Blocks Don't Auto-Evaluate**
   - `[x y z]` creates a Block of unevaluated Words
   - Must use `reduce [x y z]` to evaluate elements
   - This is by design (blocks are literal)

2. **Method Syntax Not Supported**
   - Can't do `counter.receive(5)` - only `receive counter 5`
   - Can't do `counter.current()` - only `current counter`
   - Bassline doesn't have method call syntax

## Next Steps (Not Started)

### Phase 2: VIEW Integration with Gadgets
- Make VIEW components reactive to gadget changes
- Auto-subscribe and re-render when gadgets update
- Two-way binding for input components
- Reactive text component: `text (my-gadget)` auto-updates

### Phase 3: More Examples
- todo-gadgets.bl - Todo list with gadget state
- live-table-gadgets.bl - Reactive data table
- Real-time dashboard examples

### Future: Complete Documentation
- Document remaining ~40 native functions
- Control-flow, series, strings, types, reflection
- Create "undocumented" helper to track progress

## Important Code Patterns

### Creating Documented Natives
```javascript
context.set("my-func", native(async (stream, context) => {
    const arg = await evalNext(stream, context);
    return result;
}, {
    doc: "Description here",
    args: ["arg1", "arg2"],
    examples: [
        "my-func 5  ; => result"
    ]
}));
```

### Using Gadgets in Bassline
```bassline
; Create
counter: gadget max 0

; Subscribe to changes
tap counter [
    value: current counter
    print value
]

; Send input
receive counter 10  ; Prints "10"
receive counter 5   ; Does nothing (rejected, not > 10)
receive counter 20  ; Prints "20"
```

### Building Arrays with Reduce
```bassline
; Old way (verbose):
row: []
append row name
append row price
append row total
row

; New way (clean):
reduce [name price total]
```

## Critical Files Reference

**Core System:**
- packages/lang/src/natives.js - Native function wrapper (metadata support)
- packages/lang/src/context.js - Context class (constructor(parent))
- packages/lang/src/prelude/helpers.js - basslineToJs/jsToBassline

**Documentation:**
- packages/lang/src/prelude/reflection.js - help, doc, describe
- packages/lang/src/prelude/functions.js - func with Symbol.for("DOC")

**Gadgets:**
- packages/lang/src/prelude/gadgets.js - Full integration
- packages/cells/src/*.js - Cell implementations
- packages/taps/src/index.js - Tap extension (auto-installs)

**VIEW:**
- packages/lang/src/prelude/view.js - VIEW dialect parser
- apps/web/app/routes/bassline-repl/components/ReplOutput.tsx - React renderers

## Session Statistics
- Files created: 13
- Files modified: 8
- Functions documented: 11
- New primitives: 1 (reduce)
- New components: 2 (table, code)
- Lines of code added: ~800
- Major features completed: 3 (documentation, VIEW enhancements, gadgets)
