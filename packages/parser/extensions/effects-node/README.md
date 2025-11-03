# Node.js Effects Extension

Filesystem effects for Node.js environments.

## Overview

The `effects-node` extension provides filesystem operations (read, write, append) for the Bassline pattern matching engine. These effects are **opt-in** to maintain browser compatibility of the core system.

## Installation

Import and install explicitly:

```javascript
import { Runtime } from "@bassline/parser";
import { installNodeEffects } from "@bassline/parser/extensions/effects-node";

const rt = new Runtime();
installNodeEffects(rt.graph);  // Opt-in for filesystem effects
```

**Important:** This extension requires Node.js and will not work in browsers. If you need browser compatibility, use only the core effects from `@bassline/parser/extensions/effects`.

## Filesystem Effects

### READ_FILE - Read file contents

```javascript
rt.eval('fact [read1 { EFFECT READ_FILE INPUT "/path/to/file.txt" }]');

// Query result when ready (async)
setTimeout(() => {
  rt.eval('query [read1 RESULT ?r]');
  // → { path: "/path/to/file.txt", content: "...", bytes: 1234 }
}, 100);
```

### WRITE_FILE - Write string to file

```javascript
const input = { path: "/tmp/output.txt", content: "Hello, file!" };
rt.eval(`fact [write1 { EFFECT WRITE_FILE INPUT ${JSON.stringify(input)} }]`);

// Query result
setTimeout(() => {
  rt.eval('query [write1 RESULT ?r]');
  // → { path: "/tmp/output.txt", bytes: 12 }
}, 100);
```

### APPEND_FILE - Append string to file

```javascript
const input = { path: "/tmp/log.txt", content: "Log entry\n" };
rt.eval(`fact [append1 { EFFECT APPEND_FILE INPUT ${JSON.stringify(input)} }]`);
```

## Usage Patterns

### Pipeline: HTTP → Process → File

```javascript
// Rule 1: Fetch data
rt.eval('fact [pipeline-1 { EFFECT HTTP_GET INPUT "https://api.example.com/data" }]');

// Rule 2: When HTTP completes, write to file
rt.eval('rule SAVE_TO_FILE [pipeline-1 RESULT ?data] -> [pipeline-2 EFFECT WRITE_FILE] [pipeline-2 INPUT ?data]');
```

### Logging to File

```javascript
// Rule: Log all temperature readings to file
rt.eval('rule LOG_TEMP_TO_FILE [?sensor temperature ?temp] -> [log-file-1 EFFECT APPEND_FILE] [log-file-1 INPUT "Temperature reading"]');

rt.eval('fact [sensor1 temperature 72]');
// Triggers APPEND_FILE effect
```

### File Processing Loop

```javascript
// 1. Read input file
rt.eval('fact [step1 { EFFECT READ_FILE INPUT "/input/data.txt" }]');

// 2. Process when read completes
rt.eval('rule PROCESS_FILE [step1 RESULT ?r] -> [processed-1 value ?r]');

// 3. Write result when processing completes
rt.eval('rule WRITE_RESULT [processed-1 value ?data] -> [step2 EFFECT WRITE_FILE] [step2 INPUT ?data]');
```

## Error Handling

```javascript
// Attempt to read non-existent file
rt.eval('fact [bad1 { EFFECT READ_FILE INPUT "/does/not/exist.txt" }]');

setTimeout(() => {
  rt.eval('query [bad1 ERROR ?e]');   // → "ENOENT: no such file or directory..."
  rt.eval('query [bad1 STATUS ?s]');  // → "ERROR"
}, 100);
```

## Self-Description

```javascript
// Query filesystem effects
rt.eval('query [?e CATEGORY "filesystem"]');
// → [READ_FILE, WRITE_FILE, APPEND_FILE]

// Get documentation
rt.eval('query [WRITE_FILE DOCS ?d]');
// → ["Write string content to file"]
```

## Architecture

Node.js effects use the same installer as core effects:

```javascript
// In installer.js
export function installNodeEffects(graph, effects = nodeEffects) {
  // Reuse core installer with Node-specific effects
  installEffects(graph, effects);
}
```

This means:
- Same pattern matching: `[?E EFFECT ?NAME]` + `[?E INPUT ?data]`
- Same async handling: Results written when complete
- Same self-description: All effects registered with `TYPE EFFECT!`

## When to Use

**Use Node.js effects when you need:**
- File-based persistence
- Processing local files
- Logging to files
- Data import/export

**Don't use Node.js effects when:**
- You need browser compatibility
- You're building a web application (use HTTP effects instead)
- You want platform-independent code

For browser-compatible effects, use only `@bassline/parser/extensions/effects`.

## Examples

See:
- [examples/test-effects.js](../../examples/test-effects.js) - Full test suite with filesystem effects
- [examples/test-effects-core.js](../../examples/test-effects-core.js) - Browser-compatible examples (no filesystem)
