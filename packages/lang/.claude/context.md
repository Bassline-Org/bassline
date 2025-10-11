# Bassline Language - Development Context

## Recent Work (Session: File! Datatype & Async Execution Fix)

### Completed

#### 1. File! Datatype Implementation
- **Added File AST node** (`File` class in `nodes.js`)
- **Parser support** for `%filename.txt` syntax
  - Unquoted: `%file.txt`, `%path/to/file.js`
  - Quoted (spaces): `%"file with spaces.txt"`
  - Escape sequences supported in quoted paths
- **File operations** (all synchronous, matching REBOL):
  - `read %file` - Read file contents as string
  - `write %file "content"` - Write string to file
  - `exists? %file` - Check if file exists
  - `delete %file` - Delete file
  - `dir? %file` - Check if path is directory
  - `load %file` - Load and execute Bassline code from file

#### 2. Fixed Async Execution Model
**Problem**: `seq()` was corrupting evaluator state by modifying `this.values` after consuming arguments, then yielding control during `await`.

**Solution**: Fork-based isolation
- **Added `Evaluator.fork()` method**: Creates child evaluator with isolated `values` array but shared `env`
- **Fixed `seq()`**: Now uses fork to create isolated execution context for each statement
- **Added `fork` dialect word**: Users can create isolated contexts explicitly

**The Dialect Word Contract** (Critical Design Rule):
Every dialect word MUST:
1. Consume all arguments via `this.step()` synchronously at the start
2. Never touch evaluator state (`this.values`, `this.env`, `this.lastResult`) after consumption
3. Use `this.fork()` for child execution contexts if needed
4. Can be async, but only after argument consumption is complete

This ensures no state corruption across async boundaries.

#### 3. Execution Model Clarified
- **Top-level is 100% synchronous**: Fast, predictable execution
- **Dialect words consume incrementally**: Each word calls `this.step()` to pull arguments
- **No arity declarations**: Words consume what they need, when they need it
- **Blocks are just data**: No evaluation semantics until passed to dialect word (like `do`, `seq`)
- **File operations are synchronous**: No await needed (matches REBOL)
- **Async isolation via fork**: `seq` creates child evaluators per statement

### Architecture Decisions

#### Why Synchronous File Operations?
1. **Matches REBOL**: File operations are blocking in REBOL
2. **Simpler mental model**: No await needed for common operations
3. **Top-level stays synchronous**: Keeps execution predictable
4. **Async when needed**: Use `seq` for network/async workflows

#### Why Fork Instead of Shared State?
1. **JavaScript async yields control**: When awaiting, shared state can be corrupted
2. **Complete isolation**: Child's `this.values` is independent
3. **Cheap**: `Object.create()` with prototype chain, only 3 properties
4. **Composable**: Forked evaluators can fork

#### Why Incremental Argument Consumption?
1. **No arity needed**: Words decide what to consume
2. **Variadic support**: Words can consume different amounts conditionally
3. **REBOL-style**: Matches the mental model
4. **Flexible**: Functions control their own evaluation

### Test Coverage
- **25 tests passing** (10 file + 15 async)
- File operations (read, write, exists?, delete, dir?, load)
- Async primitives (await, all, race, any, settled, timeout, background)
- Sequential execution (seq)
- Fork isolation

### Examples Working
- `hello.bl` - Basic print
- `math.bl` - Arithmetic
- `async.bl` - Async primitives
- `files.bl` - File operations (no await!)
- `seq-async.bl` - Sequential async with seq
- `seq-parallel.bl` - Combining seq with parallel primitives
- `counter-setup.bl` - Persistent state in daemon

## Key Files

### `/Users/goose/prg/bassline/packages/lang/src/eval.js`
- **Evaluator class**: Synchronous execution engine
- **`fork()` method**: Creates child evaluator with isolated state
- **Dialect words**: Core language primitives (print, do, seq, fork, file ops, async ops)
- **Execution model**: Single global scope, synchronous stepping, fork-based isolation

### `/Users/goose/prg/bassline/packages/lang/src/parser.js`
- **Parses REBOL-style syntax** to AST
- **File! support**: `%` prefix for file paths
- **Comment support**: `;` for line comments
- **Homoiconic**: Parse tree is data structure

### `/Users/goose/prg/bassline/packages/lang/src/nodes.js`
- **AST node types**: Word, Block, Str, Num, File, etc.
- **File class**: Represents file paths with `path` property

## Design Principles

### 1. Everything is Data Until Given Meaning
```rebol
[print "hello"]          ; Just a block - inert data
do [print "hello"]       ; 'do' gives it meaning
```

### 2. Blocks Don't Create Scope
```rebol
do [x: 5]
print x  ; 5 - x is in global scope
```

### 3. Promises Are First-Class Values
```rebol
p: timeout 100  ; p is a Promise, not auto-awaited
result: await p ; Explicitly await when ready
```

### 4. Synchronous Top-Level, Async When Needed
```rebol
; Synchronous file I/O
write %file.txt "content"
content: read %file.txt

; Async network operations with seq
seq [
    data1: await (fetch "url1")
    data2: await (fetch "url2")
    combine data1 data2
]
```

### 5. Fork for Isolation
```rebol
; Each statement in seq runs in isolated fork
seq [
    print "Step 1"  ; Fork 1
    await (timeout 100)  ; Still in fork 1
    print "Step 2"  ; Fork 2
]

; Explicit fork for parallel work
fork [do-something]
fork [do-something-else]
```

## Current State

### What Works
- ✅ Parsing (REBOL-style syntax, File!, comments)
- ✅ Evaluation (synchronous, fork-based isolation)
- ✅ File operations (synchronous, REBOL-compatible)
- ✅ Async primitives (await, all, race, any, settled, timeout, background)
- ✅ Sequential async (seq)
- ✅ Isolated execution (fork)
- ✅ CLI (local + daemon)
- ✅ Daemon (persistent state via WebSocket)

### What's Next
- Gadget dialect words (gadget, spawn, send, current, tap)
- Path SET operations (`obj/prop: value`)
- Serialization (toScript for round-trip)
- Multi-arg JS interop

## Common Patterns

### File I/O (No Await)
```rebol
write %data.txt "content"
content: read %data.txt
if exists? %data.txt [
    delete %data.txt
]
```

### Sequential Async
```rebol
seq [
    step1: await (async-op-1)
    step2: await (async-op-2)
    combine step1 step2
]
```

### Parallel Async
```rebol
results: await (all [
    async-op-1
    async-op-2
    async-op-3
])
```

### Fire-and-Forget
```rebol
background [
    ; Runs without blocking
    do-work
]

; Or with isolation
fork [do-work]
```

## Debugging Notes

### If seq isn't working:
1. Check that async operations return promises
2. Verify dialect words follow the contract (consume synchronously)
3. Remember: each statement in seq runs in a separate fork

### If variables aren't persisting:
1. Remember: blocks share environment (no new scope)
2. Fork isolates execution but shares `env`
3. Check if code is in daemon (persistent) vs local (one-shot)

### If file operations fail:
1. They're synchronous - no await needed
2. Path is relative to CWD where CLI was run
3. Use `exists?` to check before reading

## Architecture Evolution

### Why We Moved Away From Runtime Value Objects
Initially considered wrapping everything in runtime value types (`IntrinsicValue`, `FunctionValue`, etc.), but realized:
- **Blocks are just data** - no special semantics
- **JavaScript primitives work fine** - numbers, strings, booleans
- **Only special case is Promises** - but they're already objects
- **Simpler is better** - fewer abstractions

### Why We Rejected Arity Declarations
Considered pre-declaring function arity and collecting arguments before calling, but:
- **Incremental consumption is more flexible** - words decide what to consume
- **Matches REBOL** - no arity declarations
- **Supports variadic/conditional** - like `if` consuming 2 or 3 arguments
- **Simpler** - no metadata to maintain

### Why Fork Over Shared State Management
Tried to make `seq` save/restore state, but JavaScript async yields control:
- **Shared state corrupts** - when awaiting, parent continues before restore
- **Fork is cheap** - just prototype chain
- **Complete isolation** - no edge cases
- **Matches mental model** - each statement is independent

The key insight: **Don't fight JavaScript's async model. Embrace isolation.**
