# NAC (Negative Application Conditions) Implementation

## Overview

We've successfully added NAC support to the pattern DSL, enabling queries and rules that check for the ABSENCE of patterns - a critical feature for practical graph querying.

## What NAC Provides

NAC allows patterns to specify conditions that must NOT match. This enables:

- **Deletion queries** - Find entities that aren't deleted
- **Orphan detection** - Find entities without relationships
- **Uniqueness constraints** - Ensure properties don't already exist
- **Exclusion patterns** - Find entities lacking certain attributes

## Syntax

Use the `not` keyword before a triple pattern to make it a NAC:

```
query [?x type person | not ?x deleted true]
```

This finds all people who DON'T have a `deleted true` edge.

## Examples

### Find Active (Non-Deleted) Entities

```javascript
// Query for people who aren't deleted
query [?x type person | not ?x deleted true]

// Rule that only processes active entities
rule process-active [?e type entity | not ?e deleted true] -> [?e processed true]
```

### Orphan Detection

```javascript
// Find entities with no type
query [?x name ?n | not ?x type ?t]

// Find entities with no parent
query [?x id ?i | not ?x parent ?p]

// Find completely isolated entities (no relationships)
query [?x name ?n | not ?x parent ?p | not ?x child ?c | not ?x type ?t]
```

### Uniqueness Patterns

```javascript
// Process entities that haven't been processed yet
rule process-once [?x needs-processing true | not ?x processed true] -> [?x processed true]

// Find untyped entities and assign default type
rule add-default-type [?e name ?n | not ?e type ?t] -> [?e type "default"]
```

## How It Works

1. **Parser** - The `not` keyword creates NAC triples stored separately from positive patterns
2. **Pattern Matcher** - After finding positive matches, checks that NAC patterns DON'T match
3. **Graph Query** - Filters results to exclude bindings where NAC conditions are satisfied

## Implementation Details

### Parser Changes

Added `nacTriple` parser that recognizes `not` keyword:

```javascript
const nacTriple = sequenceOf([
  str("not"),
  ws1,
  element,
  ws1,
  element,
  ws1,
  element,
]).map(([_, __, source, ___, attr, ____, target]) => ({
  nac: true,
  triple: [source, attr, target]
}));
```

Commands now have `nac` arrays alongside `patterns`:

```javascript
{
  type: "query",
  patterns: [["?X", "TYPE", "PERSON"]],
  nac: [["?X", "DELETED", "TRUE"]]
}
```

### Pattern Class Extension

The `Pattern` class now:
- Accepts `nacSpec` array in constructor
- Has `checkNAC()` method that verifies no NAC patterns match
- Only accepts matches when NAC conditions are satisfied

### Graph API

Query and watch methods accept objects with NAC:

```javascript
graph.query({
  patterns: [["?X", "TYPE", "PERSON"]],
  nac: [["?X", "DELETED", "TRUE"]]
});
```

## Philosophy

NAC maintains the append-only nature of the system:
- Deletion is still done via tombstones
- NAC just filters what matches
- Everything remains monotonic in the log
- Queries become more expressive without changing the core model

## Testing

See `examples/nac-demo.js` for comprehensive examples showing:
- Deletion filtering
- Orphan detection
- NAC in rules
- Complex exclusion patterns

All tests pass, demonstrating that NAC integrates cleanly with the existing pattern matching system.

## Conclusion

NAC was the one critical missing piece for practical pattern matching. With it, the pattern DSL can now express the full range of queries needed for real applications while maintaining the simple, elegant triple-based architecture.