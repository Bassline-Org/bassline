# Type System Implementation

**Status:** In Progress
**Started:** 2025-11-07

## Overview

This document tracks the implementation of a typed value system in Bassline to properly distinguish between words (normalized identifiers) and strings (case-sensitive literals).

## Motivation

### The Problem

The current system conflates two fundamentally different types:
- **Words**: Identifiers that should be case-insensitive (e.g., `alice`, `Alice`, `ALICE` are the same)
- **Strings**: User data that is case-sensitive (e.g., `"Alice"` ≠ `"alice"`)

This creates security issues in distributed systems (e.g., homograph attacks like `alice` vs `AlIce`) and loses important semantic information.

### The Solution

Introduce a minimal type system with classes for special types:

```javascript
// Primitives (no wrapping needed)
"hello"          // string literal
42               // number

// Classes (special handling)
new Word("alice")      // Normalized identifier
new PatternVar("x")    // Pattern variable
WC                     // Wildcard constant
```

## Type Design

### Word

Represents a normalized identifier/symbol.

```javascript
class Word {
  constructor(str) {
    // Normalize and intern as symbol for fast comparison
    this.spelling = Symbol.for(normalize(str.trim()));
  }
}

// Usage
const alice1 = new Word("alice");
const alice2 = new Word("ALICE");
alice1.spelling === alice2.spelling  // true (both Symbol.for("ALICE"))
```

**Properties:**
- Case-insensitive (normalized to uppercase)
- Whitespace-trimmed
- Fast comparison via Symbol interning
- Used for identifiers, attribute names, keywords

### PatternVar

Represents a pattern variable (`?x`).

```javascript
class PatternVar {
  constructor(name) {
    this.name = Symbol.for(normalize(name));
  }
}

// Usage
const var1 = new PatternVar("x");
const var2 = new PatternVar("X");
var1.name === var2.name  // true
```

**Properties:**
- Case-insensitive variable names
- Matches any value type
- Binds matched value in results

### Wildcard

Represents a wildcard (`*`).

```javascript
class Wildcard {}
export const WC = new Wildcard();

// Usage
graph.add(new Word("alice"), new Word("likes"), WC, new Word("ctx"));
// Matches: alice likes <anything> ctx
```

**Properties:**
- Singleton instance
- Matches any value
- Does not bind value

### String

Plain JavaScript string - no wrapping needed.

```javascript
"Hello, World!"  // Case-sensitive literal
```

**Properties:**
- Case-sensitive
- Used for user data, text content
- Native JavaScript type

### Number

Plain JavaScript number - no wrapping needed.

```javascript
42, 3.14, -100  // Numeric literals
```

**Properties:**
- Native JavaScript type
- Used for counts, IDs, measurements

## Matching Semantics

### Type-Strict Matching

Literals only match their exact type and value:

```javascript
new Word("ALICE") matches new Word("alice")  // ✅ (both normalize to ALICE)
new Word("ALICE") matches "ALICE"            // ❌ (type mismatch)
"hello" matches "hello"                      // ✅ (exact match)
"hello" matches "Hello"                      // ❌ (case-sensitive)
42 matches 42                                // ✅ (exact match)
```

### Universal Matching

Pattern variables and wildcards match any type:

```javascript
new PatternVar("x") matches new Word("alice")  // ✅ binds {?X => new Word("alice")}
new PatternVar("x") matches "hello"            // ✅ binds {?X => "hello"}
new PatternVar("x") matches 42                 // ✅ binds {?X => 42}
WC matches <anything>                          // ✅ (no binding)
```

## Implementation Plan

### Phase 1: Core Type System ✅ = Done, 🔄 = In Progress, ⏳ = Pending

- [✅] Create `packages/parser/src/types.js`
  - Word, PatternVar, Wildcard classes
  - Type constructors and type checks
  - Multi-method dispatch utility
  - Serialization functions

- [✅] Update `packages/parser/src/pattern-parser.js`
  - Convert AST to typed values
  - `{word: "X"}` → `new Word("x")`
  - `{string: "x"}` → `"x"`
  - `{number: 42}` → `42`
  - `{patternVar: "X"}` → `new PatternVar("x")`
  - `{wildcard: true}` → `WC`

- [✅] Update `packages/parser/src/minimal-graph.js`
  - Validate types in `add()` method
  - Typed comparison in pattern matching (valuesEqual)
  - Word comparison via `spelling` symbols
  - Store typed values in edges
  - Index normalization for efficient lookup

- [✅] Update `packages/parser/src/pattern-words.js`
  - Made `unwrap()` functions passthroughs (backward compat)
  - Commands work directly with typed values

- [⏳] Update `packages/parser/src/helpers.js`
  - Bindings store and return typed values
  - Update `binding()` function

### Phase 2: Extensions

- [⏳] Update `packages/parser/extensions/io-compute.js`
- [⏳] Update `packages/parser/extensions/io-compute-builtin.js`
- [⏳] Update `packages/parser/extensions/io-effects.js`
- [⏳] Update `packages/parser/extensions/aggregation/*.js`
- [⏳] Update `packages/parser/extensions/reified-rules.js`

### Phase 3: React Integration

- [⏳] Update `packages/bassline-react/src/useQuery.js`
- [⏳] Update `packages/bassline-react/src/useEntity.js`
- [⏳] Update `packages/bassline-react/examples/todo-app.jsx`

### Phase 4: Tests

- [⏳] Update all test files (~14 files, ~188 tests)
  - `minimal-graph.test.js`
  - `pattern-parser.test.js`
  - `interactive-runtime.test.js`
  - And 11 more test files

### Phase 5: Serialization

- [⏳] Implement `serialize()` and `deserialize()`
- [⏳] Update persistence layer

## User-Facing API

### Pattern Language (Most Common)

```javascript
// Parser automatically creates typed values
rt.eval('insert { alice name "Alice" * }')
// alice and name become Words
// "Alice" stays a string literal
```

### JavaScript API (When Needed)

```javascript
import { word, WC } from '@bassline/parser/types';

// Explicit type construction
graph.add(word("alice"), word("age"), 30, WC);
```

### React Bindings

```javascript
// Bindings return typed values
const todo = useEntity(id);
const nameValue = todo.get("name");  // Returns typed value

// Type checking
if (nameValue instanceof Word) {
  console.log(nameValue.spelling.description);  // "ALICE"
}
if (typeof nameValue === 'string') {
  console.log(nameValue);  // "Alice"
}
```

## Migration Guide

### Breaking Changes

1. **Graph values are now typed**
   - Old: `graph.add("alice", "name", "Alice")`
   - New: `graph.add(word("alice"), word("name"), "Alice")`

2. **Bindings return typed values**
   - Old: `binding.get("name")` returns `"ALICE"` (string)
   - New: `binding.get("name")` returns `new Word("alice")` or `"Alice"` (typed)

3. **Type-strict matching**
   - Words only match words
   - Strings only match strings
   - Case sensitivity enforced for strings

### Common Patterns

**Before:**
```javascript
graph.add("alice", "city", "NYC");
const results = graph.query([["?person", "city", "?city"]]);
results[0].get("?person");  // "alice" (string)
```

**After:**
```javascript
graph.add(word("alice"), word("city"), "NYC");
const results = graph.query([[variable("person"), word("city"), variable("city")]]);
results[0].get("?person");  // new Word("alice")
```

## Serialization Format

For network transport and persistence:

```javascript
new Word("ALICE")  → "w:ALICE"
"hello"            → "s:hello"
42                 → "n:42"
new PatternVar("X")→ "v:X"
WC                 → "_"
```

## Implementation Log

### 2025-11-07

#### Session 1: Core Implementation
- Created TYPE-ADDITIONS.md documentation
- Implemented types.js with Word, PatternVar, Wildcard classes
- Updated parser to create typed values
- Updated graph core for typed values
  - Added type validation in add()
  - Implemented valuesEqual for typed comparison
  - Added normalizeIndexKey for efficient symbol-based indexing
  - Updated Pattern class matchField for typed values
- Made unwrap() functions passthroughs (backward compat)
- Updated helpers.js with documentation

#### Test Results After Core Implementation
- **Tests passing: 156/188 (83%)**
- **Tests failing: 32/188 (17%)**

Remaining issues:
- Tests using booleans as values (need to use Words instead)
- Tests using objects as values (need proper types)
- Tests using numbers as contexts (contexts must be Words or strings)

---

**Next Steps:**
1. Fix failing tests (32 tests)
2. Update extensions
3. Update React integration
