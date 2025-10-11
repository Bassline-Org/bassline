# @bassline/lang

REBOL-style homoiconic language for Bassline - the native serialization format
for gadget systems.

## Features

- **Homoiconic**: Code is data, data is code
- **Async-first**: Promises as first-class values with explicit control
- **Synchronous file I/O**: REBOL-style file operations (no await needed)
- **File! datatype**: First-class file paths with `%` syntax
- **Dialect system**: Infinitely extensible via GrammarProto
- **Fork isolation**: Safe async execution with isolated contexts
- **No user closures**: Functions see only arguments + globals (fully serializable)
- **Comment support**: `;` for line comments

## CLI Usage

### Local Execution (One-Shot)

Run a script file:

```bash
bassline examples/hello.bl
```

Eval inline code:

```bash
bassline -e "print 5 + 10"
```

### Daemon Mode (Persistent State)

Start the daemon:

```bash
bassline-daemon &
```

Run script in daemon:

```bash
bassline -d examples/counter-setup.bl
```

Eval code in daemon:

```bash
bassline -d -e "counter: 5"
bassline -d -e "print counter"  # 5 (state persists!)
```

## Language Basics

### Values & Variables

```rebol
x: 5          ; Set variable
y: 10
result: x + y ; 15
```

### File Operations (Synchronous)

Files are first-class values with `%` prefix:

```rebol
; Write to file (no await needed!)
write %data.txt "Hello, world!"

; Read from file
content: read %data.txt
print content

; Check existence
exists: exists? %data.txt  ; true

; Check if directory
isDir: dir? %data.txt      ; false

; Delete file
delete %data.txt

; File paths with spaces use quotes
write %"my file.txt" "content"

; Load and execute Bassline code from file
load %script.bl
```

**Key Point**: File operations are synchronous (like REBOL), so they complete immediately. No `await` needed!

### Functions

```rebol
add: fn [a b] [(a + b)]  ; Note: parens needed for infix ops
add 5 10  ; 15
```

**Important Notes**:
- Functions only see arguments + globals (no closures)
- **Infix operators need parens** when used in expressions: `result: (a + b)`
  - Without parens: `result: a + b` only assigns `a` to `result`
  - With parens: `result: (a + b)` evaluates the full expression

### Comments

```rebol
; This is a comment
x: 5  ; Inline comment
```

### Async Primitives

Promises are first-class values - you control when to await:

```rebol
; Start async operations (don't wait yet)
p1: timeout 100
p2: timeout 200

; Wait for all
results: await (all [p1 p2])

; First to complete
winner: await (race [p1 p2])

; First to succeed
data: await (any [primary backup fallback])

; All outcomes (fulfilled/rejected)
outcomes: await (settled [p1 p2 p3])

; Fire and forget
background [
  print "runs without blocking"
]
```

### Sequential Async Execution

Use `seq` when you need async operations to complete in order:

```rebol
seq [
    print "Step 1"
    await (timeout 100)
    print "Step 2"
    await (timeout 100)
    print "Step 3"
]
```

Each item in a `seq` block is executed sequentially, with promises awaited before continuing to the next item.

### Fork (Isolated Execution)

Create isolated execution contexts:

```rebol
; Fire-and-forget with isolation
fork [
    x: 42
    print x
]
```

`fork` creates a child evaluator with its own values stack but shared environment. Useful for parallel execution without state corruption.

### Word Semantics

```rebol
:word    ; GET - returns value without calling
word:    ; SET - assign next value
word     ; EVAL - evaluates (calls if function)
```

### Path Refinement

```rebol
obj/prop         ; Get property
obj/method       ; Get method (bound)
module/parse     ; Access exported functions
```

## Examples

See `examples/` directory:

- `hello.bl` - Simple print
- `math.bl` - Basic arithmetic
- `async.bl` - Async primitives (all, race, timeout)
- `files.bl` - File operations (read, write, exists?, delete)
- `seq-async.bl` - Sequential async execution with seq
- `seq-parallel.bl` - Combining seq with parallel primitives
- `counter-setup.bl` - Persistent state (daemon)

## Development

Run tests:

```bash
pnpm test
```

Start daemon:

```bash
pnpm daemon
```

## Architecture

- **Parser** (`src/parser.js`): REBOL-style syntax → AST
- **Evaluator** (`src/eval.js`): Synchronous execution with fork-based isolation
- **Nodes** (`src/nodes.js`): AST node types (homoiconic)
- **Daemon** (`src/daemon.js`): WebSocket server for persistent execution
- **CLI** (`src/cli.js`): Local and daemon execution

### Execution Model

- **Top-level is synchronous**: Fast, predictable execution
- **Dialect words consume arguments synchronously**: Via `this.step()`
- **Async operations use fork**: `seq` creates child evaluators for isolation
- **File operations are synchronous**: No async/await needed (matches REBOL)
- **Promises are first-class values**: Explicit control via `await`, `all`, etc.

### The Dialect Word Contract

Every dialect word MUST:
1. Consume all arguments via `this.step()` synchronously at the start
2. Never touch evaluator state (`this.values`) after consumption
3. Use `this.fork()` for child execution contexts if needed
4. Can be async, but only after argument consumption is complete

This ensures no state corruption across async boundaries.

## What's Next

- [ ] Gadget dialect words (`gadget`, `spawn`, `send`, `current`, `tap`)
- [ ] Path SET operations (`obj/prop: value`)
- [ ] Serialization (`toScript` for gadgets)
- [ ] Multi-arg JS interop (`js func [arg1 arg2 arg3]`)
