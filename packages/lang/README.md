# @bassline/lang

REBOL-style homoiconic language for Bassline - the native serialization format
for gadget systems.

## Features

- **Homoiconic**: Code is data, data is code
- **Async-first**: Promises as first-class values with explicit control
- **Dialect system**: Infinitely extensible via GrammarProto
- **No user closures**: Functions see only arguments + globals (fully
  serializable)
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

### Functions

```rebol
add: fn [a b] [a + b]
add 5 10  ; 15
```

**Note**: Functions only see arguments + globals (no closures).

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
- `async.bl` - Async primitives
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
- **Evaluator** (`src/eval.js`): Executes AST with single global scope
- **Nodes** (`src/nodes.js`): AST node types (homoiconic)
- **Daemon** (`src/daemon.js`): WebSocket server for persistent execution
- **CLI** (`src/cli.js`): Local and daemon execution

## What's Next

- [ ] Gadget dialect words (`gadget`, `spawn`, `send`, `current`, `tap`)
- [ ] Path SET operations (`obj/prop: value`)
- [ ] Serialization (`toScript` for gadgets)
- [ ] Multi-arg JS interop (`js func [arg1 arg2 arg3]`)
