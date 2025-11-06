# IO Contexts Prototype

**Status**: ✅ Complete
**Date Started**: 2025-11-06
**Date Completed**: 2025-11-06
**Goal**: Prototype graph-native IO pattern using system contexts as foundation for full reification approach

**Result**: SUCCESS - All 18 tests passing, pattern validated

## Overview

This prototype explores using `input` and `output` system contexts to create a graph-native IO pattern. Effects and compute operations serve as test cases since they already have IO-like semantics (inputs → execution → outputs).

## Core Design

### Pattern

**Current approach** (implicit activation):
```javascript
// Watcher fires immediately when edges match
graph.watch([["?E", "EFFECT", "?NAME"], ["?E", "INPUT", "?DATA"]], callback);
graph.add("E1", "EFFECT", "FETCH");
graph.add("E1", "INPUT", "http://..."); // Triggers immediately
```

**New approach** (context-based activation):
```javascript
// 1. Define request context with data
group req1 {
  req1 url "http://..."
  req1 method "GET"
}

// 2. Request handling via input context edge
req1 handle FETCH input

// 3. Effect watcher fires on input context
graph.watch([["?ctx", "handle", "FETCH", "input"]], callback);

// 4. Effect writes response to output context
FETCH handled req1 output
req1 result "..." output
req1 status "success" output
```

### Key Concepts

1. **Contexts are units of work**: Each request/computation is a context containing its data
2. **`input`/`output` are coordination layers**: Control flow edges live there, not data
3. **Symmetry**: Request `ctx handle effect input` ↔ Response `effect handled ctx output`
4. **Fully reactive**: Can watch for responses and chain operations
5. **Graph-native**: Everything is edges, queryable and introspectable

## Implementation Log

### Session 1: Initial Design (2025-11-06)

**Design Decisions Made**:
- Use `handle`/`handled` verbs for request/response
- Direction: `ctx handle effect input` (context is subject)
- Results written as edges in context, marked with `output` context
- Effect itself marked in `system` context as `TYPE: EFFECT`

**Questions Validated**:
- ✅ `handle`/`handled` vocabulary works well and is intuitive
- ✅ Results in work context is clean - all data about a request lives together
- ✅ Errors via `ctx ERROR "message" output` works perfectly
- ✅ In-progress state via `effect processing ctx system` (optional but useful)
- ✅ Performance excellent - no context-query overhead, watchers are O(1)

**Critical Discovery - Edge Ordering**:
Found bug where "handled" marker must be written AFTER results, not before. Otherwise chain watchers fire before results are available. This is a general principle: **completion markers must be last**.

## Files Created

### Documentation
- ✅ `packages/parser/docs/IO-CONTEXTS-PROTOTYPE.md` (this file)

### Implementation
- ✅ `packages/parser/extensions/io-effects.js` - IO-based effects (149 lines)
- ✅ `packages/parser/extensions/io-compute.js` - IO-based compute (159 lines)

### Tests
- ✅ `packages/parser/test/io-contexts.test.js` - Comparative tests (18 tests, all passing)

## Test Results

**All 18 tests passing**:
- ✅ 3 effects tests (basic, errors, multiple)
- ✅ 4 compute tests (binary, unary, errors, multiple)
- ✅ 4 introspection tests (list effects/ops, query metadata, find contexts)
- ✅ 2 chaining tests (effects, compute) - **Key demonstration of composability**
- ✅ 4 comparison tests (old vs new patterns)

**Duration**: 151ms for all 18 tests

## Findings

### What Works Extremely Well

1. **Explicit Activation**: Separating data definition from execution is powerful
   - Can prepare contexts without triggering
   - Can inspect pending work before execution
   - Clean separation of concerns

2. **Chaining is Natural**: Watching `output` context to trigger new `input` edges
   - Example: FETCH completes → PARSE starts automatically
   - Example: ADD completes → NEGATE starts automatically
   - No special chaining mechanism needed, just watchers!

3. **Introspection is Built-In**: Everything is queryable
   - `query [?effect TYPE EFFECT system]` → all effects
   - `query [?ctx handle ?effect input]` → pending requests
   - `query [?effect handled ?ctx output]` → completed work
   - No special APIs needed!

4. **Uniform Pattern**: Effects and compute use identical pattern
   - Same request mechanism: `ctx handle op input`
   - Same response mechanism: `op handled ctx output`
   - Easy to understand, easy to extend

5. **Error Handling is Clean**: Errors are just edges in output context
   - `ctx ERROR "message" output`
   - `ctx STATUS "ERROR" output`
   - Can query for failures, watch for errors, etc.

6. **Helper Functions are Simple**: Query wrappers are tiny
   - `getOutput(graph, ctx, attr)` - 2 lines
   - `isHandled(graph, effect, ctx)` - 2 lines
   - `getActiveEffects(graph)` - 2 lines

### What's Awkward

1. **Case Sensitivity**: Had to standardize on uppercase attributes
   - Not a pattern issue, just a consistency requirement
   - Easily solved by convention

2. **Ordering Matters**: Completion marker MUST be written last
   - Otherwise chain watchers see incomplete data
   - This is a general graph principle, not specific to IO pattern
   - Solution: Always write data first, completion marker last

3. **Wildcard Context Matching**: Using `"*"` for null context is implicit
   - Not really awkward, just something to be aware of
   - Graph handles it correctly

### Performance

**Excellent** - No overhead compared to current approach:
- Watchers are O(1) via selective activation
- Context queries are standard graph queries
- No special indexing needed
- All 18 tests run in 151ms

## Comparison: Old vs New

### Code Complexity

**New approach is SIMPLER**:

Old approach (current):
- Special handling for immediate activation
- Complex watcher patterns with multiple quads
- Implicit execution model

New approach (IO contexts):
- Single-quad watchers on input context
- Explicit activation model
- Uniform pattern for all IO operations

**Lines of code**: Similar (~150 lines each), but new approach is more uniform.

### Introspection Capabilities

**New approach is VASTLY SUPERIOR**:

Old approach:
- Can't query pending work
- Can't see what's been handled
- No built-in state tracking

New approach:
- Query pending: `[?ctx handle ?effect input]`
- Query completed: `[?effect handled ?ctx output]`
- Query in-progress: `[?effect processing ?ctx system]`
- Query all effects: `[?effect TYPE EFFECT system]`
- Query all contexts for an effect: `[?effect handled ?ctx output]`

### Composability

**New approach ENABLES COMPOSITION**:

Old approach: Chaining requires custom logic or external orchestration

New approach: Chaining is just watchers!
```javascript
// Chain FETCH → PARSE automatically
graph.watch([["FETCH", "handled", "?ctx", "output"]], (bindings) => {
  const ctx = bindings.get("?ctx");
  const data = getOutput(graph, ctx, "RESULT");

  const parseCtx = `${ctx}:parse`;
  graph.add(parseCtx, "DATA", data, null);
  graph.add(parseCtx, "handle", "PARSE", "input");
});
```

**Enables**:
- Pipelines (A → B → C)
- Fan-out (A → [B, C, D])
- Fan-in ([A, B, C] → D)
- Conditional routing
- Error recovery flows

## Recommendations

### ✅ YES - Extend This Pattern to Rules/Patterns

**Strong recommendation to proceed** because:

1. **Pattern is proven**: 18/18 tests passing, clean implementation
2. **Major benefits**: Introspection, composition, uniformity
3. **No downsides found**: Performance is excellent, code is simpler
4. **Natural extension**: Rules/patterns fit this model perfectly

### How Rules Would Work

```javascript
// 1. Define rule structure as edges
group myRule {
  myRule matches p1
  myRule nac p2
  myRule produces p3
}

// 2. Activate by linking to rule context
myRule memberOf rule system

// 3. Watcher on "rule" context handles activation
graph.watch([["?rule", "memberOf", "rule", "system"]], (bindings) => {
  const ruleId = bindings.get("?rule");

  // Query rule structure
  const matchesQ = graph.query([ruleId, "matches", "?pattern", "*"]);
  const producesQ = graph.query([ruleId, "produces", "?output", "*"]);

  // Look up pattern definitions
  // Install watchers
  // Store unwatch handle
});
```

### Migration Path

1. **Phase 1**: Keep existing implementations, add IO versions alongside
2. **Phase 2**: Migrate extensions one by one (compute, effects, aggregations)
3. **Phase 3**: Implement rules/patterns with new approach
4. **Phase 4**: Deprecate old implementations
5. **Phase 5**: Update parser syntax to support context-based definitions

**Estimated effort**: 2-3 sessions for full migration

### Open Questions - RESOLVED

- ✅ **Vocabulary**: `handle`/`handled` works well
- ✅ **Edge direction**: `ctx handle effect` (context as subject) is natural
- ✅ **Result storage**: In work context is clean
- ✅ **Error representation**: Standard edges in output context
- ✅ **Performance**: No overhead, excellent
- ✅ **Ordering**: Completion marker must be last (documented)

## Key Learnings

1. **System contexts are powerful**: `input`, `output`, `system` provide clean coordination
2. **Contexts as units of work**: Natural way to group related data
3. **Watchers are enough**: No special orchestration needed, just watch for edges
4. **Completion markers last**: General principle for reactive systems
5. **Introspection for free**: Everything is edges, everything is queryable
6. **Chaining is composition**: Watching output and creating input is powerful

## Next Steps

1. ✅ **Prototype complete** - Pattern validated
2. **Recommend**: Implement rules/patterns using this approach
3. **Recommend**: Migrate existing extensions incrementally
4. **Recommend**: Update CLAUDE.md with new architecture
5. **Recommend**: Create examples showing chaining/composition patterns

---

**Conclusion**: IO contexts pattern is a **significant improvement**. Recommend full adoption.
