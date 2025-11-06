# Reified Rules Implementation

**Status**: ✅ Complete
**Date**: 2025-11-06
**Goal**: Implement graph-native rule storage and activation where rules are first-class entities stored as edges

**Result**: SUCCESS - All 13 tests passing, pattern validated

## Overview

Reified rules make rules first-class citizens in the graph. Instead of being external constructs managed by runtime code, rules are stored as edges and activated via system contexts. This enables full introspection, dynamic control, and eliminates special command handling.

## Core Design

### Pattern

**Old approach** (pattern-words.js):
```javascript
// Rules created via command execution
rt.eval('rule adult-check [?p age ?a] -> [?p adult true]');
// Rule stored in context.rules Map (not in graph)
// No introspection, can't query rule structure
```

**New approach** (reified rules):
```javascript
// 1. Define rule structure as edges
graph.add("ADULT-CHECK", "TYPE", "RULE!", "system");
graph.add("ADULT-CHECK", "matches", "?p AGE ?a *", "ADULT-CHECK");
graph.add("ADULT-CHECK", "produces", "?p ADULT TRUE *", "ADULT-CHECK");

// 2. Activate rule via system context
graph.add("ADULT-CHECK", "memberOf", "rule", "system");

// 3. System watcher installs graph.watch() based on stored patterns
// 4. Rule automatically scans existing edges and fires for matches
// 5. Rule continues to watch for new edges reactively
```

### Key Concepts

1. **Rules are edges**: Rule definitions stored as graph data, not runtime state
2. **String-based patterns**: Patterns stored as parseable strings like `"?X TYPE PERSON *"`
3. **System context activation**: `memberOf rule system` triggers installation
4. **Initial scan + reactive**: Rules process existing data on activation, then watch for new data
5. **Full introspection**: Can query rule structure, firings, active status
6. **Dynamic control**: Activate/deactivate by adding edges

## Implementation Details

### Files Created

**Implementation**:
- ✅ `packages/parser/extensions/reified-rules.js` (220 lines)
  - `installReifiedRules()` - Install activation watcher
  - `parseQuadString()` - Parse pattern strings to quads
  - `getActiveRules()` - Query helper for active rules
  - `getRuleDefinition()` - Query helper for rule structure
  - `getRuleFirings()` - Query helper for firing count

**Tests**:
- ✅ `packages/parser/test/reified-rules.test.js` (13 tests, all passing)
  - Basic functionality (7 tests)
  - Complex scenarios (3 tests)
  - Introspection (3 tests)

**Parser Integration**:
- ✅ `packages/parser/src/pattern-parser.js` - Exported `parsePatternQuad()` function

### Architecture

```javascript
// Activation watcher (installed once at startup)
graph.watch([["?rule", "memberOf", "rule", "system"]], (bindings) => {
  const ruleId = bindings.get("?rule");

  // Query rule structure from graph
  const matchQuads = graph.query([ruleId, "matches", "?quadStr", "*"])
    .map(b => parseQuadString(b.get("?quadStr")));

  const produceQuads = graph.query([ruleId, "produces", "?quadStr", "*"])
    .map(b => parseQuadString(b.get("?quadStr")));

  const nacQuads = graph.query([ruleId, "nac", "?quadStr", "*"])
    .map(b => parseQuadString(b.get("?quadStr")));

  // Install watcher for future edges
  const unwatch = graph.watch(matchSpec, fireRule);

  // Scan existing edges (CRITICAL for declarative rules)
  const existingMatches = graph.query(matchSpec);
  for (const matchBindings of existingMatches) {
    fireRule(matchBindings);
  }

  // Store unwatch handle for deactivation
  context.rules.set(ruleId, { unwatch, ... });
});
```

### Design Decisions

#### 1. String-Based Pattern Storage

**Chosen**: Store patterns as strings like `"?X TYPE PERSON *"`

**Alternatives considered**:
- Fully reified (4 edges per quad) - Too verbose
- JSON strings - Unnecessary complexity

**Rationale**:
- Patterns are small, simple strings
- Easy to read, easy to query
- Direct integration with existing parser
- No special quoting/escaping needed

#### 2. Initial Scan on Activation

**Chosen**: When `memberOf rule system` is added, scan existing edges and fire for matches

**Rationale**:
- **Declarative rules**: Order doesn't matter when defining data before activation
- **Reactive updates**: After activation, rule continues to watch for new edges
- **Best of both worlds**: Clean for bulk setup, responsive for incremental changes

**Key insight**: "Rules should run over the edge set when they are setup" - this makes rules truly declarative for initial data.

#### 3. Deactivation via Tombstone

**Chosen**: `rule memberOf rule tombstone` marks rule as inactive

**Implementation**:
- Deactivation watcher calls `unwatch()` to remove pattern watcher
- `getActiveRules()` filters out tombstoned rules
- Append-only: activation edge remains, tombstone marks it superseded

#### 4. Unique Firing IDs

**Chosen**: Each firing gets `RULE:F<timestamp>:<random>` ID

**Problem solved**: Graph deduplicates edges by (s,a,t,c) tuple. Multiple firings with same timestamp would deduplicate.

**Solution**:
```javascript
const firingId = `${ruleId}:F${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
graph.add(ruleId, "FIRED", firingId, "system");
graph.add(firingId, "TIMESTAMP", Date.now(), "system");
```

## Test Results

**All 13 tests passing** (Duration: 9ms):

### Basic Functionality (7 tests)
- ✅ Parse quad strings correctly
- ✅ Activate a simple rule
- ✅ Handle multiple match patterns
- ✅ Handle NAC (Negative Application Condition)
- ✅ Allow deactivation
- ✅ Scan existing edges on activation (order doesn't matter)
- ✅ Query rule definition

### Complex Scenarios (3 tests)
- ✅ Cascading rules (VERIFY → PROCESS → COMPLETE)
- ✅ Multiple produce patterns (one rule produces 3 edges)
- ✅ Variable resolution across patterns (transitive inference)

### Introspection (3 tests)
- ✅ List all active rules
- ✅ Query rules by category/type
- ✅ Track rule firings with timestamps

## What This Enables

### 1. Full Introspection

**Everything is queryable**:
```javascript
// List all rules
const rules = graph.query(["?rule", "TYPE", "RULE!", "system"]);

// Get rule structure
const matches = graph.query(["MY-RULE", "matches", "?pattern", "*"]);
const produces = graph.query(["MY-RULE", "produces", "?pattern", "*"]);
const nacs = graph.query(["MY-RULE", "nac", "?pattern", "*"]);

// Find active rules
const active = graph.query(["?rule", "memberOf", "rule", "system"]);

// Check firing history
const firings = graph.query(["MY-RULE", "FIRED", "?firingId", "system"]);
```

**No special APIs needed** - just graph queries!

### 2. Dynamic Control

**Activate/deactivate at runtime**:
```javascript
// Activate
graph.add("MY-RULE", "memberOf", "rule", "system");

// Deactivate
graph.add("MY-RULE", "memberOf", "rule", "tombstone");

// Conditional activation based on other data
graph.watch([["CONFIG", "ENABLE-VALIDATION", "TRUE", "*"]], () => {
  graph.add("VALIDATION-RULE", "memberOf", "rule", "system");
});
```

### 3. Meta-Programming

**Rules can create rules**:
```javascript
// Rule that generates other rules based on data
graph.watch([["?entity", "NEEDS-VALIDATION", "TRUE", "*"]], (bindings) => {
  const entity = bindings.get("?entity");
  const ruleId = `VALIDATE:${entity}`;

  graph.add(ruleId, "TYPE", "RULE!", "system");
  graph.add(ruleId, "matches", `${entity} ?attr ?val *`, ruleId);
  graph.add(ruleId, "produces", `${entity} VALIDATED TRUE *`, ruleId);
  graph.add(ruleId, "memberOf", "rule", "system");
});
```

### 4. Rule Categories

**Organize rules by type**:
```javascript
// Tag rules
graph.add("AUTH-RULE-1", "CATEGORY", "AUTH", "system");
graph.add("VALIDATION-RULE-1", "CATEGORY", "VALIDATION", "system");

// Query by category
const authRules = graph.query(["?rule", "CATEGORY", "AUTH", "system"]);
```

### 5. Serialization

**Save/load entire rule set**:
```javascript
// Rules are just edges - serialization is automatic
const serialized = JSON.stringify({
  edges: graph.edges.map(e => ({
    source: e.source,
    attr: e.attr,
    target: e.target,
    context: e.context
  }))
});

// Restore - rules reactivate automatically via watchers
for (const edge of data.edges) {
  graph.add(edge.source, edge.attr, edge.target, edge.context);
}
```

## What Can Be Deleted/Deprecated

### Immediate Candidates

1. **Old rule execution in pattern-words.js** (lines 151-196)
   - `executeCommand()` case "rule" branch
   - Can be replaced with reified rules
   - Keep for backward compatibility during migration

2. **Context.rules Map** (if fully migrated)
   - Currently stores `{ match, produce, unwatch }` in memory
   - With reified rules, this becomes internal to reified-rules.js
   - External code queries graph instead of context

3. **Rule firing tracking in pattern-words.js** (line 168)
   - Currently: `graph.add(command.name, "FIRED", Date.now(), "system")`
   - Problem: Deduplicates same-timestamp firings
   - Replaced with unique firing IDs

### Migration Path

**Phase 1: Coexistence** (Current)
- Both systems work side-by-side
- Old: Rules via parser commands
- New: Rules via edge activation
- No breaking changes

**Phase 2: Parser Integration**
- Update parser to emit reified rule edges instead of rule commands
- `rule foo where {...} produce {...}` → edges instead of command object
- Backward compatible: Keep old command format working

**Phase 3: Deprecation**
- Mark old rule execution as deprecated
- Documentation recommends new approach
- Migration guide for existing code

**Phase 4: Removal**
- Remove old rule execution code
- Simplify pattern-words.js
- Clean up redundant tests

## Comparison: Reified Rules vs. Pattern-Words Rules

### Storage

**Old**:
- Rules stored in `context.rules` Map (memory only)
- Rule structure stored as JSON strings in `system` context (for self-description)
- Not queryable except via helper functions

**New**:
- Rules stored as edges (graph-native)
- Pattern strings stored directly, no JSON wrapping
- Fully queryable with standard graph queries

### Activation

**Old**:
- Immediate on command execution
- No initial scan (purely reactive)
- Order matters for all data

**New**:
- Explicit via `memberOf rule system` edge
- Initial scan + reactive
- Order doesn't matter for data defined before activation

### Introspection

**Old**:
```javascript
// Limited introspection
context.rules.size // Count
context.rules.has("MY-RULE") // Check existence
// Can't query structure without parsing JSON
```

**New**:
```javascript
// Full introspection via queries
graph.query(["?rule", "TYPE", "RULE!", "system"]) // List all
graph.query(["?rule", "memberOf", "rule", "system"]) // Active rules
graph.query(["MY-RULE", "matches", "?pattern", "*"]) // Rule structure
graph.query(["MY-RULE", "FIRED", "?firingId", "system"]) // Firing history
```

### Deactivation

**Old**:
- No built-in deactivation
- Would need custom code to call `unwatch()` and remove from Map

**New**:
- Built-in via tombstone: `graph.add(rule, "memberOf", "rule", "tombstone")`
- Automatic unwatching
- Append-only (can query activation history)

## Limitations and Edge Cases

### 1. NAC Timing for Reactive Updates

**Issue**: For data added AFTER rule activation, edge order matters

**Example**:
```javascript
// Rule already active
graph.add("BOB", "TYPE", "PERSON", null);  // Triggers rule immediately
// NAC checks: Does "BOB DELETED TRUE" exist? No → fires
graph.add("BOB", "DELETED", "TRUE", null); // Too late
```

**Solution**: Add NAC-blocking edges before match-triggering edges

**When it doesn't matter**: Data added BEFORE activation (initial scan sees complete state)

### 2. Multiple Activations

**Issue**: Adding `memberOf rule system` multiple times

**Current behavior**: Skip if already active (lines 75-77)

**Alternative**: Could track activation count, allow "re-scan on demand"

### 3. Pattern String Parsing

**Issue**: Pattern strings must be valid syntax

**Error handling**: `parseQuadString()` throws on invalid syntax (line 302)

**Improvement needed**: Better error messages, validation helpers

### 4. Performance with Many Rules

**Current**: O(1) pattern matching via selective activation (unchanged)

**Concern**: Many rules = many watchers

**Future optimization**: Batch watcher registration, shared pattern detection

## Improvements Needed

### High Priority

1. **Parser Integration**
   - Update `rule` command to emit reified edges instead of command object
   - Syntax: `rule foo where {...} produce {...}` → edges
   - Backward compatibility layer

2. **Error Handling**
   - Validate pattern syntax before activation
   - Clear error messages for malformed patterns
   - Graceful degradation on activation failure

3. **Documentation**
   - Update CLAUDE.md with new architecture
   - Migration guide from old to new
   - Examples of dynamic rule creation

### Medium Priority

4. **Helper Functions**
   - `createRule(id, matches, produces, nacs)` - Convenience constructor
   - `validateRuleStructure(ruleId)` - Pre-activation validation
   - `getRuleDependencies(ruleId)` - Analyze rule cascades

5. **Performance Monitoring**
   - Track activation time per rule
   - Monitor firing frequency
   - Detect infinite cascade loops

6. **Rule Priorities**
   - Add `PRIORITY` edge for ordering
   - Fire high-priority rules first
   - Conflict resolution strategies

### Low Priority

7. **Rule Versioning**
   - Track rule definition changes over time
   - Support A/B testing (multiple versions active)
   - Refinement pattern for rule updates

8. **Visual Tooling**
   - Graph visualization of rule structure
   - Rule dependency analyzer
   - Firing trace viewer

## Consistency with IO Contexts Pattern

### Similarities

Both use:
- **System context activation**: `memberOf <type> system`
- **Graph-native storage**: Everything is edges
- **Watcher-based execution**: No special runtime handling
- **Full introspection**: Query-based APIs

### Differences

**IO Contexts**:
- Explicit per-request evaluation: `ctx handle effect input`
- One-shot execution with completion marker
- Clear input/output separation

**Reified Rules**:
- Continuous monitoring: Fires whenever pattern matches
- Ongoing execution (until deactivated)
- Initial scan + reactive behavior

### Complementary Patterns

```javascript
// Rules can trigger IO operations
graph.watch([["ELIGIBILITY", "handled", "?ctx", "output"]], (bindings) => {
  const ctx = bindings.get("?ctx");
  if (getOutput(graph, ctx, "STATUS") === "ERROR") {
    // Error in eligibility check → trigger notification
    const notifyCtx = `${ctx}:notify`;
    graph.add(notifyCtx, "MESSAGE", "Eligibility check failed", null);
    graph.add(notifyCtx, "handle", "SEND-EMAIL", "input");
  }
});
```

## Next Steps

### Immediate (This Session)

1. ✅ **Implementation complete** - All tests passing
2. ✅ **Documentation complete** - This report
3. ⏭️ **Update CLAUDE.md** - Document new architecture

### Short Term (Next Session)

4. **Parser integration** - Emit reified edges from `rule` command
5. **Migrate existing tests** - Use reified rules in existing test suites
6. **Add helper functions** - Convenience APIs for common operations

### Medium Term (Future Sessions)

7. **Deprecate old system** - Mark pattern-words.js rule execution as deprecated
8. **Performance testing** - Benchmark with large rule sets
9. **Advanced features** - Priorities, versioning, conflict resolution

### Long Term (Research)

10. **Distributed rules** - Sync rule definitions across nodes
11. **Rule compilation** - Optimize heavily-used rules
12. **Visual tooling** - Graph explorer with rule visualization

## Key Learnings

1. **Initial scan is essential**: Rules must process existing data on activation to be truly declarative

2. **String-based storage wins**: Simple, readable, directly integrates with parser

3. **Deduplication matters**: Unique firing IDs prevent timestamp collisions

4. **Activation is not evaluation**: For rules, activation means "install watcher", not "run once"

5. **NAC timing is subtle**: Order matters for reactive updates, doesn't matter for initial scan

6. **Introspection for free**: Making rules edges immediately enables full introspection

## Conclusion

Reified rules successfully extend the IO contexts pattern to rule management. The implementation is **clean, well-tested, and enables powerful new capabilities** including full introspection, dynamic control, and meta-programming.

**Recommend**:
- ✅ Proceed with parser integration
- ✅ Begin migration of existing rules
- ✅ Update CLAUDE.md with new architecture
- ✅ Keep old system for backward compatibility during transition

**Status**: Production-ready prototype. Safe to use in new code. Migration path clear for existing code.

---

**Implementation by**: Claude (Sonnet 4.5)
**Date**: 2025-11-06
**Tests**: 13/13 passing
**Lines of code**: ~220 (implementation) + ~320 (tests)
