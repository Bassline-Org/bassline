# Bassline Examples

This directory contains comprehensive examples demonstrating the Bassline language and its features.

## Quick Start Examples

### Basic Operations
- **[arithmetic.bl](./arithmetic.bl)** - Math operations: addition, subtraction, multiplication, division, modulo
- **[variables.bl](./variables.bl)** - Variable assignment and retrieval
- **[strings.bl](./strings.bl)** - String operations: concatenation, case conversion, splitting

### Control Flow
- **[conditionals.bl](./conditionals.bl)** - if, either (if-else) statements
- **[loops.bl](./loops.bl)** - foreach, repeat, while loops
- **[functions-demo.bl](./functions-demo.bl)** - Function creation with func, literal vs evaluated arguments

### Data Structures
- **[blocks.bl](./blocks.bl)** - Working with blocks (lists), append, at, slice, length
- **[series-operations.bl](./series-operations.bl)** - Advanced series manipulation

### Documentation & Reflection
- **[documentation-demo.bl](./documentation-demo.bl)** - Using doc, help, describe for self-documenting code
- **[stdlib-docs.bl](./stdlib-docs.bl)** - Complete reference for all built-in functions

## VIEW Dialect (UI Components)

The VIEW dialect provides declarative UI components for building interfaces.

### Component Examples
- **[view-demo.bl](./view-demo.bl)** - Basic components: text, button, badge, separator
- **[table-demo.bl](./table-demo.bl)** - Table component for displaying structured data
- **[code-demo.bl](./code-demo.bl)** - Code block component with syntax highlighting

### Layout Examples
- **view-demo.bl** also demonstrates:
  - Layouts: row, column, panel
  - Dynamic content with foreach
  - Conditional rendering with if/either
  - Combining components

## Advanced Features

### HTTP & JSON
- **[http-examples.bl](./http-examples.bl)** (TODO) - Making HTTP requests, fetching data
- **[json-examples.bl](./json-examples.bl)** (TODO) - Parsing and generating JSON

### Gadgets (Reactive State)
- **[gadget-basics.bl](./gadget-basics.bl)** (TODO) - Introduction to gadgets
- **[gadget-patterns.bl](./gadget-patterns.bl)** (TODO) - Common gadget patterns

## Running Examples

Load any example file in the Bassline REPL:

```bassline
; In the REPL, examples are available as variables
; For instance, from view-demo.bl:
simple-view    ; Display the simple-view
complex-view   ; Display the complex-view
```

Or run them programmatically:

```bassline
; Load and execute an example file
; (when file loading is implemented)
```

## Example Categories

### 1. Language Basics
Learn the fundamentals of Bassline syntax and semantics.

### 2. Standard Library
Explore built-in functions for common operations.

### 3. VIEW Dialect
Build user interfaces with declarative components.

### 4. Documentation System
Use the built-in documentation features for better code.

### 5. Advanced Patterns
Discover powerful patterns and idioms.

## Contributing Examples

When adding new examples:

1. **Keep them focused** - One concept per file
2. **Add comments** - Explain what's happening
3. **Show progression** - Start simple, build complexity
4. **Include output** - Show expected results in comments
5. **Update this README** - Add your example to the appropriate category

## Example Template

```bassline
; Example Title
; Brief description of what this example demonstrates

; Example 1: Basic usage
variable-name: value
; Expected output: ...

; Example 2: More complex usage
; Explanation...
complex-example: [...]

; Example 3: Edge cases
; Show how to handle special cases
```
