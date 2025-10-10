# @bassline/builders

Declarative action builders for composing sex gadget pipelines.

## Overview

This package provides functions that generate action arrays for sex gadgets,
making it easy to build complex compositions declaratively instead of manually
constructing spawn/wire commands.

All builder functions return arrays in the format:

```javascript
[
  ["spawn", name, spec],
  ["wire", wireName, source, target, options],
  ...
]
```

These actions can be sent directly to sex gadgets via `receive()` or used as the
initial state when creating new sex gadgets.

## Installation

```bash
pnpm add @bassline/builders
```

## Builders

### pipeline(stages, options)

Create a linear sequence of gadgets with automatic wiring between stages.

**Example:**

```javascript
import { pipeline } from "@bassline/builders";

const actions = pipeline([
  {
    spec: { pkg: "@bassline/functions/math", name: "add", state: { b: 10 } },
    extract: "result",
  },
  {
    spec: {
      pkg: "@bassline/functions/math",
      name: "multiply",
      state: { b: 2 },
    },
    extract: "result",
  },
]);

// Send to existing workspace
workspace.receive(actions);

// Or create new sex gadget with pipeline
const calc = bl().fromSpec({
  pkg: "@bassline/systems",
  name: "sex",
  state: actions,
});
```

**Parameters:**

- `stages` - Array of stage definitions:
  - `spec` - Gadget spec for this stage
  - `extract` - Effect key to extract (e.g., "result", "changed")
  - `name` - Optional custom name (default: stage0, stage1, etc.)
- `options` - Optional configuration:
  - `wirePrefix` - Prefix for wire names (default: "wire")

### fork(branches, options)

Create parallel distribution - one input feeds multiple branches.

**Example:**

```javascript
import { fork } from "@bassline/builders";

const actions = fork([
  { spec: { pkg: "@bassline/functions/math", name: "add", state: { b: 5 } } },
  {
    spec: {
      pkg: "@bassline/functions/math",
      name: "multiply",
      state: { b: 2 },
    },
  },
]);
```

**Parameters:**

- `branches` - Array of branch definitions:
  - `spec` - Gadget spec for this branch
  - `extract` - Effect key to extract before sending
  - `name` - Optional custom name
- `options` - Optional configuration:
  - `inputSpec` - Spec for input gadget (default: cells.last)
  - `inputName` - Name of input gadget (default: "input")

### combine(sources, mergerSpec, options)

Merge multiple sources into a single gadget.

**Example:**

```javascript
import { combine } from "@bassline/builders";

const actions = combine(
  [
    { spec: { pkg: "@bassline/cells/numeric", name: "max", state: 0 } },
    { spec: { pkg: "@bassline/cells/numeric", name: "max", state: 0 } },
  ],
  { pkg: "@bassline/functions/math", name: "add", state: {} },
);
```

**Parameters:**

- `sources` - Array of source definitions:
  - `spec` - Gadget spec for this source
  - `extract` - Effect key to extract
  - `name` - Optional custom name
- `mergerSpec` - Spec for the merger gadget
- `options` - Optional configuration:
  - `mergerName` - Name of merger (default: "merger")

### map(fnSpec, extractKey, emitKey, options)

Simple input → function transformation helper.

**Example:**

```javascript
import { map } from "@bassline/builders";

const actions = map(
  { pkg: "@bassline/functions/math", name: "multiply", state: { b: 1.08 } },
  "changed",
  "result",
);
```

## Wire Options

The `wire()` command in sex gadgets now accepts an options parameter for key
extraction:

```javascript
["wire", "wire1", "source", "target", { keys: ["result"] }];
```

When a single key is specified, the value is extracted automatically:

- Input: `{ result: 42 }`
- Forwarded: `42`

When multiple keys are specified, a filtered object is forwarded:

- Input: `{ result: 42, error: null, timestamp: 123 }`
- Keys: `["result", "timestamp"]`
- Forwarded: `{ result: 42, timestamp: 123 }`

## Usage with Pipeline Builder UI

The Sex Editor includes a visual Pipeline Builder accessible via **Cmd/Ctrl +
P**:

1. Press **Cmd/Ctrl + P** to open Pipeline Builder
2. Click "Add Stage" to add function gadgets
3. Configure extract keys for each stage
4. Click "Add to Canvas" to spawn the pipeline in your workspace

The UI generates action arrays using these builder functions and sends them to
your workspace.

## Patterns

### Tax Calculator

```javascript
const taxCalc = pipeline([
  {
    spec: {
      pkg: "@bassline/functions/math",
      name: "multiply",
      state: { b: 1.08 },
    },
    extract: "result",
  },
  {
    spec: {
      pkg: "@bassline/functions/math",
      name: "round",
      state: { decimals: 2 },
    },
    extract: "result",
  },
]);
```

### Parallel Processing

```javascript
const parallel = fork([
  {
    spec: { pkg: "@bassline/functions/math", name: "add", state: { b: 10 } },
    extract: "changed",
  },
  {
    spec: {
      pkg: "@bassline/functions/math",
      name: "multiply",
      state: { b: 2 },
    },
    extract: "changed",
  },
]);
```

### Data Aggregation

```javascript
const aggregate = combine(
  [
    {
      spec: { pkg: "@bassline/cells/numeric", name: "max", state: 0 },
      extract: "changed",
    },
    {
      spec: { pkg: "@bassline/cells/numeric", name: "max", state: 0 },
      extract: "changed",
    },
  ],
  { pkg: "@bassline/functions/math", name: "add", state: {} },
);
```
