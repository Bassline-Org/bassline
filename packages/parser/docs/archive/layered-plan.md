# Aspect-Oriented Architecture Plan for Graph Rewriting System

## Core Philosophy
The core is complete and should remain frozen. All new functionality is added as **aspects** that compose together based on dependencies, not as rigid layers.

```
                    Applications
                    /     |     \
                REPL   Visual  Distributed
                 /  \    /  \    /  \
            Compute  Indexes  Remote
                 \    |    /
              Self-Description
                     |
                Core Runtime

(Aspects form a dependency graph, not layers)
```

## Current State

**Core (FROZEN)**:
- `minimal-graph.js` (~330 lines) - Incremental pattern matching engine
- `pattern-parser.js` (~335 lines) - Pure tokenizer for triples
- `pattern-words.js` (~200 lines) - Runtime bridge

Total: ~865 lines of essential machinery that **must not grow**.

## Implementation Phases

### Phase 1: Self-Description Layer (Foundation)
**Timeline**: Immediate
**Goal**: Make the system fully introspectable by having patterns/rules register as triples

**Tasks**:
1. Modify `pattern-words.js` to register rules/patterns as triples:
   ```javascript
   // When rule is created:
   rule:adult type rule
   rule:adult match "[?p { type person age ?a }]"
   rule:adult produce "[?p stage adult]"
   rule:adult status active
   ```

2. Create `extensions/self-description.js` (~100 lines):
   - `serialize(graph)` - dump all edges as JSON
   - `deserialize(edges)` - reconstruct graph and watchers
   - Introspection is just queries: `query [rule:?r { match ?m status active }]`

**Success Criteria**:
- Can save/load entire graph state
- Can query the graph about its own patterns
- Watchers recreated on load

### Phase 2: Compute Watchers (Critical for Usefulness)
**Timeline**: Immediate after Phase 1
**Goal**: Enable actual computation through pattern-triggered calculations

**Tasks**:
1. Create `extensions/compute.js` (~150 lines):
   ```javascript
   // Watch for compute patterns
   graph.watch([["?c", "op", "?op"]], (bindings) => {
     const op = bindings.get("?op");
     // Perform computation
     const result = computeOps[op](/* extract operands */);
     // Write result back
     graph.add(bindings.get("?c"), "result", result);
   });
   ```

2. Implement basic operations:
   - Arithmetic: add, subtract, multiply, divide
   - Comparison: gt, lt, eq
   - Aggregation: sum, count, avg

3. Create `examples/working-compute-demo.js`:
   - Real calculations that execute
   - Chained computations
   - Working aggregations

**Success Criteria**:
- Can compute `2 + 3 = 5` via patterns
- Can chain calculations
- Can aggregate values

### Phase 3: Basic REPL
**Timeline**: After Phases 1 & 2
**Goal**: Interactive development environment

**Tasks**:
1. Create `flavors/repl/index.js` (~150 lines):
   ```javascript
   class GraphREPL {
     constructor(graph) {
       this.graph = graph;
       this.context = createContext(graph);
     }

     async processCommand(line) {
       // Handle special commands (.save, .load, .inspect)
       // Or parse and execute pattern code
     }
   }
   ```

2. Commands to implement:
   - `.save <file>` - serialize graph
   - `.load <file>` - load graph
   - `.inspect <pattern>` - examine pattern details
   - `.clear` - reset graph
   - `.help` - show commands

**Success Criteria**:
- Interactive prompt works
- Can save/load sessions
- Can inspect patterns
- History and editing work

### Phase 4: Index Patterns (Performance)
**Timeline**: After basic system works
**Goal**: O(1) lookups via incremental indexing

**Tasks**:
1. Create `extensions/indexes.js` (~100 lines):
   ```javascript
   // Auto-index by type
   rule index-by-type [?x type ?t] -> [
     type-idx:?t { contains ?x }
   ]

   // Auto-index by attribute
   rule index-by-attr [?s ?a ?t] -> [
     attr-idx:?a { has ?s }
   ]
   ```

2. Query optimizer that rewrites to use indexes:
   ```javascript
   // Transform: [?x type person]
   // Into: [type-idx:person contains ?x]
   ```

**Success Criteria**:
- Queries on indexed attributes are O(1)
- Benchmarks show speedup on large graphs
- Indexes maintain themselves incrementally

### Phase 5: Remote Protocol (Future)
**Timeline**: Once local system is solid
**Goal**: Distributed graph systems via patterns

**Tasks**:
1. Create `extensions/remote.js` (~200 lines):
   - WebSocket transport
   - Pattern-based protocol
   - Guardian patterns for sandboxing

2. Implement:
   ```javascript
   // Local installs pattern on remote
   rule notify [?x error ?msg] -> [
     message { to "local:123" content ?msg }
   ]

   // Bridge forwards messages
   rule bridge [message { to ?client content ?c }] -> [
     websocket { send ?client data ?c }
   ]
   ```

**Success Criteria**:
- Can connect to remote graph
- Patterns work across network
- Security via guardian patterns

## File Structure

```
packages/parser/
├── src/
│   ├── minimal-graph.js      # FROZEN at ~330 lines
│   ├── pattern-parser.js     # FROZEN at ~335 lines
│   └── pattern-words.js      # Minor updates for registration
├── extensions/
│   ├── self-description.js   # Phase 1: Registration as triples
│   ├── compute.js            # Phase 2: Computation watchers
│   ├── indexes.js            # Phase 4: Index patterns
│   └── remote.js             # Phase 5: Distribution
├── flavors/
│   ├── repl/                 # Phase 3: REPL flavor
│   │   └── index.js
│   ├── distributed/          # Distributed system flavor
│   │   └── index.js
│   └── visual/               # Future: Visual editor
│       └── index.js
└── examples/
    ├── working-compute-demo.js
    └── self-describing-demo.js
```

## Key Principles

1. **Core stays frozen** - No new features in minimal-graph.js
2. **Aspects compose** - Each aspect can depend on others in a graph
3. **Flavors combine aspects** - REPL = core + self-description + compute + UI
4. **Everything is optional** - Core works without any aspects
5. **Patterns all the way down** - Even aspects use patterns to extend
6. **Self-describing** - The aspect graph itself can be described as triples:
   ```
   repl { requires self-description }
   repl { requires compute }
   distributed { requires remote }
   distributed { requires guardian }
   ```

## Success Metrics

- [ ] Core remains under 1000 lines total
- [ ] Each extension under 200 lines
- [ ] Zero dependencies in core
- [ ] REPL works interactively
- [ ] Can perform real computations
- [ ] Can save/load graph state
- [ ] Performance: 1M edges, 1K patterns, sub-second queries

## Today's Implementation Order

1. **Self-description layer** - Make patterns visible as triples
2. **Compute watchers** - Enable actual arithmetic
3. **Working demos** - Show real computation happening
4. **Basic REPL** - Interactive testing environment

## Why This Architecture

This layered approach ensures:
- The core stays simple and correct
- New features don't break existing ones
- Different use cases get different flavors
- The system can extend itself via patterns
- Distribution/remoting is just another layer

The key insight: **computation is just patterns watching patterns**. We don't need to add computation to the core - we just need watchers that perform computation when they see certain patterns. This keeps the core pure while making the system actually useful.