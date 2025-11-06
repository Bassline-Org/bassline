# CLAUDE.md - Bassline Pattern-Matching Graph System

**📝 Note**: Check `.claude/context.md` for recent work context and architectural decisions from previous sessions.

## Project Overview

**Bassline** is a **pattern-matching graph computation system** - think Datalog meets reactive programming, with incremental pattern matching over an append-only triple store.

**Core Philosophy**: Everything is edges in a graph. Patterns watch for matches. Computation is incremental and reactive. All state is queryable.

## Why JavaScript (Not TypeScript)

- Highly dynamic runtime (pattern compilation, incremental matching, meta-programming)
- Static types don't add value for this use case
- Vanilla JS lets us ship source directly (no build step)
- Power comes from runtime flexibility, not compile-time guarantees

## Architecture

```
packages/parser/
├── src/
│   ├── minimal-graph.js         # Core: Graph + Pattern matching (~400 lines)
│   ├── pattern-parser.js        # Parser: Pattern language -> AST
│   ├── pattern-words.js         # Runtime: Execute AST on graph
│   ├── interactive-runtime.js   # Interactive wrapper + REPL
│   └── format-results.js        # Result formatting for display
│
├── extensions/
│   ├── io-compute.js            # IO-based compute framework
│   ├── io-compute-builtin.js    # Built-in compute operations (18 ops)
│   ├── io-effects.js            # IO-based effects framework
│   ├── io-effects-builtin.js    # Built-in browser effects (5 effects)
│   ├── io-effects-node.js       # Built-in Node.js effects (3 filesystem)
│   ├── aggregation/
│   │   ├── core.js              # Refinement & versioning helpers
│   │   ├── definitions.js       # SUM, COUNT, AVG, MIN, MAX
│   │   ├── installer.js         # Generic aggregation installer
│   │   └── index.js             # Public API
│   ├── reified-rules.js         # Graph-native rule storage & activation
│   └── self-description.js      # Meta-circular capabilities
│
├── examples/
│   ├── repl.js                  # Interactive CLI
│   ├── demo.js                  # Basic usage examples
│   └── *.js                     # More examples
│
└── test/
    ├── minimal-graph.test.js    # Core graph tests
    ├── aggregation.test.js      # Aggregation tests (35 tests)
    ├── interactive-runtime.test.js  # Runtime tests (20 tests)
    ├── reified-rules.test.js    # Reified rules tests (13 tests)
    └── *.test.js                # Parser tests

docs/
├── CORE.md                      # Core model philosophy
└── PERFORMANCE.md               # O(1) pattern matching via selective activation
```

## Core Concepts

### 1. The Graph

An **append-only triple store** with incremental pattern matching:

```javascript
import { Graph } from '@bassline/parser/graph';

const graph = new Graph();

// Add edges (triples)
graph.add("alice", "age", 30);
graph.add("alice", "city", "NYC");
graph.add("bob", "age", 25);

// Query with variables
const results = graph.query(["?person", "age", "?age"]);
// Returns: [Map{"?person" => "alice", "?age" => 30}, Map{"?person" => "bob", "?age" => 25}]

// Watch for patterns (reactive)
graph.watch([["?person", "age", "?age"]], (bindings) => {
  console.log(`${bindings.get("?person")} is ${bindings.get("?age")} years old`);
});
```

**Key properties**:
- Append-only (edges never removed, only marked deleted via tombstones)
- Incremental pattern matching (patterns fire as edges accumulate)
- O(1) lookup via selective activation indexes (see PERFORMANCE.md)
- Variables (`?x`), wildcards (`*`), and NAC (Negative Application Conditions)

### 2. Pattern Language

A **declarative language** for graph manipulation:

```javascript
import { Runtime } from '@bassline/parser/interactive';

const rt = new Runtime();

// Add facts
rt.eval('fact [alice age 30 bob age 25]');

// Query
rt.eval('query [?x age ?a]');

// Create reactive rule
rt.eval('rule adult-check [?p age ?a] -> [?p adult true]');

// Single-word shorthand (explore an entity)
rt.eval('alice');  // Expands to: query [alice ?attr ?target]
```

**Command types**:
- `fact [...]` - Add triples
- `query [...]` - Find matches (with optional NAC)
- `rule name [...] -> [...]` - Reactive rewrite rules
- `pattern name [...]` - Named observable patterns
- `watch [...] [...]` - Watch and react
- `delete s a t` - Mark triple as deleted (tombstone)
- `clear-graph` - Reset everything
- `graph-info` - Statistics

### 3. Incremental Aggregations

**Modular, versioned aggregations** with refinement chains:

```javascript
import { installAggregation, builtinAggregations, getCurrentValue } from '@bassline/parser/aggregation';

// Install aggregation system
installAggregation(graph, builtinAggregations);

// Define aggregation
graph.add("AGG1", "AGGREGATE", "SUM");

// Add items (aggregation updates incrementally)
graph.add("AGG1", "ITEM", 10);
graph.add("AGG1", "ITEM", 20);
graph.add("AGG1", "ITEM", 15);

// Get current result (uses NAC to find non-refined version)
getCurrentValue(graph, "AGG1");  // 45
```

**Built-in operations**: SUM, COUNT, AVG, MIN, MAX

**Custom aggregations**:
```javascript
const customAggs = {
  PRODUCT: {
    initialState: { product: 1 },
    accumulate(state, rawValue) {
      const num = parseFloat(rawValue);
      return isNaN(num) ? state : { product: state.product * num };
    },
    reduce(state) {
      return state.product;
    }
  }
};

installAggregation(graph, customAggs);
```

### 4. Refinement Pattern (Append-Only Updates)

**How to "update" in an append-only system**:

```javascript
// Version 1
graph.add("AGG1", "AGG1:RESULT:V1", 10);

// Version 2 (refines V1)
graph.add("AGG1", "AGG1:RESULT:V2", 30);
graph.add("AGG1:RESULT:V2", "REFINES", "AGG1:RESULT:V1");

// Query for current (non-refined) value using NAC
const current = graph.query({
  patterns: [["AGG1", "?key", "?value"]],
  nac: [["?newer", "REFINES", "?key"]]  // No newer version refines this
});
```

This pattern enables:
- Time-travel queries (inspect any version)
- Incremental computation (only recompute what changed)
- Distributed convergence (versions merge naturally)

### 5. Reified Rules (Graph-Native Rule Storage)

**Rules as first-class graph entities** - stored as edges, activated via system contexts:

```javascript
import { installReifiedRules, getActiveRules, getRuleFirings } from '@bassline/parser/extensions/reified-rules';

// Install reified rules system
installReifiedRules(graph, context);

// Define rule structure as edges
graph.add("ADULT-CHECK", "TYPE", "RULE!", "system");
graph.add("ADULT-CHECK", "matches", "?p AGE ?a *", "ADULT-CHECK");
graph.add("ADULT-CHECK", "produces", "?p ADULT TRUE *", "ADULT-CHECK");

// Activate rule via system context
graph.add("ADULT-CHECK", "memberOf", "rule", "system");

// Rule automatically:
// 1. Scans existing edges and fires for matches
// 2. Watches for new edges reactively

// Add data (rule fires automatically)
graph.add("ALICE", "AGE", 30, null);

// Check if rule fired
graph.query(["ALICE", "ADULT", "?v", "*"]);  // TRUE

// Introspection (everything is queryable)
getActiveRules(graph);           // ["ADULT-CHECK"]
getRuleFirings(graph, "ADULT-CHECK");  // 1
```

**Key features**:
- **Graph-native storage**: Rules stored as edges, not runtime state
- **System context activation**: `memberOf rule system` triggers installation
- **Initial scan + reactive**: Processes existing data on activation, then watches for new data
- **Full introspection**: Query rule structure, active status, firing history
- **Dynamic control**: Activate/deactivate at runtime
- **NAC support**: Negative application conditions work on both existing and new data

**Deactivation**:
```javascript
// Deactivate via tombstone (append-only)
graph.add("ADULT-CHECK", "memberOf", "rule", "tombstone");
```

**Pattern strings**: Stored as parseable strings like `"?X TYPE PERSON *"` for simplicity.

See [REIFIED-RULES-IMPLEMENTATION.md](packages/parser/docs/REIFIED-RULES-IMPLEMENTATION.md) for details.

## Interactive Runtime (NEW!)

**Minimal wrapper** for interactive use:

```javascript
import { Runtime } from '@bassline/parser/interactive';
import { formatResults } from '@bassline/parser/format';

const rt = new Runtime();

// Evaluate expressions
const results = rt.eval('fact [alice age 30]');
console.log(formatResults(results));

// Single-word exploration
rt.eval('alice');  // Shows all edges about alice

// Convenience methods
rt.query('?x age ?a');
rt.fact('bob age 25');

// Introspection
rt.getStats();         // {edges: 10, patterns: 2, rules: 3}
rt.getActiveRules();   // ["ADULT-CHECK", "FRIEND-DETECTOR"]
rt.getActivePatterns(); // ["PEOPLE-TRACKER"]

// Serialization
const json = rt.toJSON();
rt.fromJSON(json);

// Reset
rt.reset();
```

**REPL** (Command-line interface):
```bash
node packages/parser/examples/repl.js
```

Commands: `.help`, `.stats`, `.patterns`, `.rules`, `.reset`, `.exit`

## Pattern Matching Performance

**O(1) pattern matching** via selective activation indexes.

Key insight: Don't check every pattern against every edge - **index patterns by their literals**:

```javascript
// When pattern is registered:
graph.watch([["alice", "likes", "?x"]], callback);
// Indexed: sourceIndex.get("alice").add(pattern)

// When edge is added:
graph.add("alice", "likes", "bob");
// Only activates patterns indexed under "alice" (not all patterns!)
```

**Performance**:
- 20,000 patterns + 100,000 edges: **4.4M edges/sec**
- Throughput stays constant regardless of pattern count
- 67-235x faster than naive O(P × E) approach

See [PERFORMANCE.md](packages/parser/docs/PERFORMANCE.md) for details.

## Self-Description

**Rules and patterns describe themselves as edges**:

```javascript
// When you create a rule:
rt.eval('rule my-rule [?x age ?a] -> [?x adult true]');

// The graph automatically contains:
// rule:MY-RULE type "rule"
// rule:MY-RULE match "[["?X","AGE","?A"]]"
// rule:MY-RULE produce "[["?X","ADULT","TRUE"]]"
// rule:MY-RULE status "active"

// You can query this metadata:
rt.eval('rule:MY-RULE');  // Shows all rule metadata
```

This enables:
- Introspection (query what rules/patterns are active)
- Meta-programming (patterns that watch for pattern definitions)
- Serialization (save/load entire runtime state)

## Common Patterns

### Cascading Rules

```javascript
rt.eval('rule step1 [?x type person] -> [?x verified true]');
rt.eval('rule step2 [?x verified true] -> [?x processed true]');
rt.eval('rule step3 [?x processed true] -> [?x complete true]');

rt.eval('fact [alice type person]');
// All three rules fire in sequence!
```

### NAC (Negative Application Conditions)

```javascript
// Find people who are NOT deleted
rt.eval('query [?x type person not ?x deleted true]');

// Rule that only fires if person doesn't have status
rt.eval('rule set-default [?p age ?a not ?p status *] -> [?p status active]');
```

### Aggregation with Rules

```javascript
// Set up aggregation
rt.eval('fact [sales:2024 AGGREGATE SUM]');

// Rule that feeds aggregation
rt.eval('rule track-sales [?order total ?amount] -> [sales:2024 ITEM ?amount]');

// Add orders (aggregation updates automatically)
rt.eval('fact [order:1 total 100 order:2 total 250]');

// Get result
getCurrentValue(graph, "sales:2024");  // 350
```

### Computed Values (IO-Based)

**IO-based compute operations** using handle/handled coordination:

```javascript
import { installBuiltinCompute, getComputeResult, isComputed } from '@bassline/parser/io-compute';

installBuiltinCompute(graph);

// Set up operands
graph.add("calc1", "X", 10, null);
graph.add("calc1", "Y", 20, null);

// Request computation (handle triggers execution)
graph.add("calc1", "handle", "ADD", "input");

// Wait for completion (check handled marker)
const computed = isComputed(graph, "ADD", "calc1");  // true

// Get result from output context
const result = getComputeResult(graph, "calc1");  // 30

// Or query directly
graph.query(["calc1", "RESULT", "?r", "output"]);  // [{?r => 30}]
```

**Built-in operations** (18 total):
- **Binary**: ADD, SUBTRACT, MULTIPLY, DIVIDE, MOD, POW
- **Unary**: SQRT, ABS, FLOOR, CEIL, ROUND, NEGATE
- **Comparison**: GT, LT, GTE, LTE, EQ, NEQ

**Custom operations**:
```javascript
import { installIOCompute } from '@bassline/parser/io-compute';

// Install custom operation
installIOCompute(graph, "DOUBLE", (x) => x * 2, {
  arity: "unary",
  operationType: "arithmetic",
  doc: "Double a number"
});

// Use it
graph.add("calc2", "VALUE", 5, null);
graph.add("calc2", "handle", "DOUBLE", "input");
// Result: graph.query(["calc2", "RESULT", "?r", "output"]) => 10
```

### Effects (IO-Based)

**IO-based effects** for side-effecting operations:

```javascript
import {
  installBuiltinEffects,  // Browser effects
  installNodeEffects,     // Node.js effects
  installAllEffects,      // All effects
  isHandled,
  getOutput
} from '@bassline/parser/io-effects';

// Install browser effects (LOG, ERROR, WARN, HTTP_GET, HTTP_POST)
installBuiltinEffects(graph);

// Or install all (browser + Node.js filesystem)
installAllEffects(graph);

// Console logging
graph.add("req1", "MESSAGE", "Hello World", null);
graph.add("req1", "handle", "LOG", "input");

// Wait for completion
const done = isHandled(graph, "LOG", "req1");  // true

// Get output
const logged = getOutput(graph, "req1", "LOGGED");  // "TRUE"

// HTTP request
graph.add("req2", "URL", "https://api.example.com/data", null);
graph.add("req2", "handle", "HTTP_GET", "input");
// Result: graph.query(["req2", "DATA", "?data", "output"])

// File operations (Node.js only)
graph.add("req3", "PATH", "/tmp/test.txt", null);
graph.add("req3", "CONTENT", "Hello", null);
graph.add("req3", "handle", "WRITE_FILE", "input");
// Result: graph.query(["req3", "SUCCESS", "?s", "output"]) => "TRUE"
```

**Built-in browser effects** (5 total):
- **io**: LOG, ERROR, WARN (console operations)
- **http**: HTTP_GET, HTTP_POST (fetch-based)

**Built-in Node.js effects** (3 total):
- **filesystem**: READ_FILE, WRITE_FILE, APPEND_FILE

**Custom effects**:
```javascript
import { installIOEffect } from '@bassline/parser/io-effects';

// Install custom effect
installIOEffect(graph, "NOTIFY", async (graph, ctx) => {
  // Query inputs from context
  const messageQ = graph.query([ctx, "MESSAGE", "?m", "*"]);
  const message = messageQ[0]?.get("?m");

  // Perform side effect
  await sendNotification(message);

  // Return outputs (written to output context)
  return {
    SENT: "TRUE",
    TIMESTAMP: Date.now()
  };
}, {
  category: "notification",
  doc: "Send notification. Input: MESSAGE"
});

// Use it
graph.add("notify1", "MESSAGE", "Task complete", null);
graph.add("notify1", "handle", "NOTIFY", "input");
// Result: graph.query(["notify1", "SENT", "?s", "output"]) => "TRUE"
```

### Reified Rules (Meta-Programming)

```javascript
import { installReifiedRules, getActiveRules } from '@bassline/parser/extensions/reified-rules';

installReifiedRules(graph, context);

// Define multiple rules as edges
graph.add("VERIFY", "TYPE", "RULE!", "system");
graph.add("VERIFY", "matches", "?p TYPE PERSON *", "VERIFY");
graph.add("VERIFY", "produces", "?p VERIFIED TRUE *", "VERIFY");

graph.add("PROCESS", "TYPE", "RULE!", "system");
graph.add("PROCESS", "matches", "?p VERIFIED TRUE *", "PROCESS");
graph.add("PROCESS", "produces", "?p PROCESSED TRUE *", "PROCESS");

// Activate both (order doesn't matter for data defined before activation)
graph.add("VERIFY", "memberOf", "rule", "system");
graph.add("PROCESS", "memberOf", "rule", "system");

// Add data - rules cascade automatically
graph.add("ALICE", "TYPE", "PERSON", null);
// Result: ALICE gets VERIFIED and PROCESSED markers

// Introspection via queries (no special API)
graph.query(["?rule", "TYPE", "RULE!", "system"]);  // List all rules
graph.query(["?rule", "memberOf", "rule", "system"]);  // Active rules
graph.query(["VERIFY", "matches", "?pattern", "*"]);  // Rule structure

// Conditional activation
graph.watch([["CONFIG", "ENABLE-VALIDATION", "TRUE", "*"]], () => {
  graph.add("VALIDATION-RULE", "memberOf", "rule", "system");
});
```

## Package Exports

```json
{
  ".": "./src/minimal-graph.js",           // Graph class
  "./graph": "./src/minimal-graph.js",     // Graph class
  "./parser": "./src/pattern-parser.js",   // Pattern parser
  "./runtime": "./src/pattern-words.js",   // Runtime executor
  "./interactive": "./src/interactive-runtime.js",  // Interactive wrapper
  "./format": "./src/format-results.js",   // Result formatter
  "./io-compute": "./extensions/io-compute.js",  // IO-based compute operations
  "./io-effects": "./extensions/io-effects.js",  // IO-based effects
  "./aggregation": "./extensions/aggregation/index.js",  // Aggregations
  "./reified-rules": "./extensions/reified-rules.js"  // Graph-native rule storage
}
```

## Test Coverage

**All 160 tests passing**:
- `minimal-graph.test.js` - Core graph & pattern matching (28 tests)
- `contexts.test.js` - Context-based selective activation (40 tests)
- `aggregation.test.js` - Modular aggregations (35 tests)
- `interactive-runtime.test.js` - Runtime & REPL (20 tests)
- `reified-rules.test.js` - Graph-native rules (13 tests)
- `io-contexts.test.js` - IO-based effects and compute (18 tests)
- `context-performance.test.js` - Performance benchmarks (6 tests)

## Design Principles

1. **Append-only** - Never delete, only add (tombstones for deletion)
2. **Incremental** - Patterns fire as edges accumulate (no batch queries needed)
3. **Reactive** - Rules automatically maintain invariants
4. **Queryable** - All state is edges, all edges are queryable
5. **Modular** - Extensions add capabilities without core changes
6. **Self-describing** - Rules/patterns store themselves as edges
7. **O(1) matching** - Selective activation via indexing (not naive O(P × E))

## Debugging Tips

```javascript
// 1. Inspect graph state
rt.eval('graph-info');  // Statistics
rt.getStats();          // {edges, patterns, rules}

// 2. Explore entities
rt.eval('alice');       // All edges about alice
rt.eval('rule:MY-RULE'); // All metadata about rule

// 3. Query patterns
rt.eval('query [?s ?a ?t]');  // All edges

// 4. Check active patterns/rules
rt.getActivePatterns();  // List all patterns
rt.getActiveRules();     // List all rules

// 5. Reset if confused
rt.reset();  // Clear everything
```

## Anti-Patterns

❌ **Don't** mutate graph state outside of `graph.add()`
❌ **Don't** assume pattern firing order (incremental = order depends on edge arrival)
❌ **Don't** create infinite rule cascades (rule A → B → A → ...)
❌ **Don't** use external state in watchers (keeps state in graph)
❌ **Don't** forget NAC can be expensive (check what it filters)

## Philosophy

This system unifies:
- **Datalog** - Logic programming over facts
- **Reactive programming** - Automatic propagation via watchers
- **CQRS/Event Sourcing** - Append-only log with projections
- **Incremental view maintenance** - Update derived state as base data changes

Everything is **edges** (triples). Patterns are **queries** that react. Computation is **incremental** and **observable**.

The goal: **Maximal expressiveness from minimal primitives**.

## What's Next

Current capabilities:
- ✅ Pattern matching with O(1) selective activation
- ✅ Reactive rules and watchers
- ✅ Modular aggregations with refinement
- ✅ Interactive runtime + REPL
- ✅ Self-description and introspection
- ✅ Reified rules (graph-native rule storage & activation)

Future directions:
- Parser integration for reified rules (emit edges from `rule` command)
- Distributed graph (sync across nodes)
- Persistence layer (durability)
- Advanced aggregations (windowing, joins)
- Query optimization (plan generation)
- Visual graph explorer

---

**Remember**: The power is in the **pattern**. Keep the core simple. Build everything as patterns watching edges.
