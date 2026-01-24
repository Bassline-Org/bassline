# Core Vocabulary Specification

The minimal foundation. Always available, cannot be modified.

---

## Meta / Vocabulary

| Word | Stack | Description |
|------|-------|-------------|
| `in:` | ( -- ) | Parse vocab name until `;`, set as current |
| `using:` | ( -- ) | Parse vocab names until `;`, import each |
| `:` | ( -- ) | Begin word definition (public) |
| `:_` | ( -- ) | Begin word definition (private) |
| `;` | ( -- ) | End word definition |
| `immediate` | ( -- ) | Mark last word as immediate |

---

## Stack

| Word | Stack | Description |
|------|-------|-------------|
| `dup` | ( a -- a a ) | Duplicate top |
| `drop` | ( a -- ) | Discard top |
| `swap` | ( a b -- b a ) | Swap top two |
| `rot` | ( a b c -- b c a ) | Rotate third to top |
| `over` | ( a b -- a b a ) | Copy second to top |
| `clear` | ( ... -- ) | Clear entire stack |

---

## Arithmetic

| Word | Stack | Description |
|------|-------|-------------|
| `+` | ( a b -- sum ) | Addition |
| `-` | ( a b -- diff ) | Subtraction |
| `*` | ( a b -- prod ) | Multiplication |
| `/` | ( a b -- quot ) | Division |
| `mod` | ( a b -- rem ) | Modulo |

---

## Comparison

Returns proper booleans (`true` / `false`).

| Word | Stack | Description |
|------|-------|-------------|
| `=` | ( a b -- bool ) | Equal |
| `<` | ( a b -- bool ) | Less than |
| `>` | ( a b -- bool ) | Greater than |
| `<=` | ( a b -- bool ) | Less than or equal |
| `>=` | ( a b -- bool ) | Greater than or equal |

---

## Logic

| Word | Stack | Description |
|------|-------|-------------|
| `and` | ( a b -- bool ) | Logical and |
| `or` | ( a b -- bool ) | Logical or |
| `not` | ( a -- bool ) | Logical not |
| `true` | ( -- true ) | Boolean true |
| `false` | ( -- false ) | Boolean false |

---

## Control Flow

| Word | Stack | Description |
|------|-------|-------------|
| `if` | ( bool true false -- result ) | Conditional |
| `when` | ( bool quot -- ) | Execute if true |
| `unless` | ( bool quot -- ) | Execute if false |
| `times` | ( quot n -- ) | Execute quot n times |
| `do` | ( quot -- ... ) | Execute quotation |
| `exit` | ( -- ) | Exit current word |
| `err` | ( msg -- ) | Panic with message |

---

## Streams

The narrow waist. Variables, resources, and externals all conform to Stream.

Convention: subject (stream) first, then value.

| Word | Stack | Description |
|------|-------|-------------|
| `variable` | ( -- ) | Define a variable (parses name) |
| `.write` | ( stream value -- ) | Write value to stream |
| `.read` | ( stream -- value ) | Read from stream |

```borth
variable counter
counter 42 .write      ( write 42 to counter )
counter .read          ( read from counter, pushes 42 )
```

External resources also use `.write` and `.read`:

```borth
some-resource " hello" .write   ( write to resource )
some-resource .read             ( read from resource )
```

---

## Collections

| Word | Stack | Description |
|------|-------|-------------|
| `map` | ( arr quot -- arr' ) | Transform each element |
| `filter` | ( arr quot -- arr' ) | Keep truthy elements |
| `fold` | ( arr quot init -- result ) | Reduce |
| `each` | ( arr quot -- ) | Execute for each |
| `concat` | ( a b -- ab ) | Concatenate |
| `length` | ( coll -- n ) | Length |

---

## Objects

Convention: subject (object) first.

| Word | Stack | Description |
|------|-------|-------------|
| `.get` | ( obj keys -- value ) | Get nested property |
| `.set` | ( obj keys value -- ) | Set nested property |
| `keys` | ( obj -- arr ) | Get keys |
| `values` | ( obj -- arr ) | Get values |

```borth
obj ' name .get              ( get name from obj )
obj ' age 30 .set            ( set age to 30 on obj )
```

---

## Strings

| Word | Stack | Description |
|------|-------|-------------|
| `"` | ( -- str ) | Parse until closing `"` |
| `join` | ( arr sep -- str ) | Join with separator |
| `split` | ( str sep -- arr ) | Split by separator |
| `trim` | ( str -- str' ) | Trim whitespace |

---

## Parsing

| Word | Stack | Description |
|------|-------|-------------|
| `parse` | ( char -- str ) | Parse until stop character is encountered |
| `parse-word` | ( -- str ) | Parse next whitespace-delimited token |
| `'` | ( -- str ) | Parse next token, push as string |

```borth
' hello      ( pushes "hello" )
34 parse     ( parse until " character - ASCII 34 )
```

---

## Utilities

| Word | Stack | Description |
|------|-------|-------------|
| `nil?` | ( a -- bool ) | Is nil/undefined |
| `now` | ( -- timestamp ) | Current ISO timestamp |

---

## What's NOT in Core

Belongs in separate vocabularies:

- **I/O**: `.log`, `.error` → `io`
- **Events**: `emit`, `trigger`, `toast` → `events`
- **Commands**: `cmd`, `key:`, `doc{` → `editor`
- **Reflection**: `words`, `word-name`, `word-attr` → `reflect`
- **Graph**: `<graph>`, `.nodes`, `.connect`, `.traverse` → `graph`
- **Database**: `query` → `db`

Core is just the primitives. Everything else is imported.
