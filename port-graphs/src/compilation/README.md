# Choreographic Compilation System

A gadget-based compilation pipeline for transforming choreography specifications into deployable artifacts.

## Overview

The compilation system transforms high-level choreographic descriptions into executable artifacts using a pipeline of functional gadgets. Each gadget follows the universal protocol: receive → consider → act.

## Architecture

```
Parser → Validator → Compiler → Materializer
```

### Gadgets

- **Parser** (`gadgets/parser.ts`): Parses YAML/JSON choreography specifications into AST nodes
- **Validator** (`gadgets/validator.ts`): Validates semantic correctness of the choreography
- **Materializer** (`gadgets/materializer.ts`): Writes generated artifacts to the filesystem

### Compilers

- **Filesystem** (`targets/filesystem.ts`): Generates shell scripts that implement the gadget protocol
- **Container** (`targets/container.ts`): Generates Dockerfiles and Kubernetes manifests

## Usage

```typescript
import {
  createChoreographyParser,
  createSemanticValidator,
  createFilesystemCompiler,
  createFileMaterializer
} from '@bassline/port-graphs/compilation';

// Create gadgets
const parser = createChoreographyParser();
const validator = createSemanticValidator();
const compiler = createFilesystemCompiler({ outputPath: './generated' });
const materializer = createFileMaterializer({ outputPath: './generated' });

// Wire them together
wire(parser, validator);
wire(parser, compiler, effect => 'astUpdate' in effect);
wire(validator, compiler, effect => 'validationResult' in effect);
wire(compiler, materializer, effect => 'materialization' in effect);

// Compile
parser.receive({
  source: choreographyYAML,
  path: 'choreography.yaml',
  format: 'yaml'
});
```

## Choreography Format

```yaml
name: my-app
roles:
  api:
    type: coordinator
    capabilities: [receive, route, emit]
  worker:
    type: processor
    capabilities: [process, compute]
relationships:
  api -> worker: http
```

## Key Concepts

### Progressive Information Sharing
Gadgets share information progressively as they process it. The parser emits AST updates immediately, allowing downstream gadgets to start working before parsing completes.

### Effect-Based Communication
Gadgets communicate through effects:
- `astUpdate`: New or updated AST node
- `validationResult`: Validation outcome for a node
- `materialization`: Request to write files

### Semantic Mapping
The filesystem compiler maps choreographic concepts to filesystem structures:
- Roles → Directories containing gadget scripts
- Relationships → Connection scripts
- Capabilities → Script behaviors

## Example

See `examples/compilation/simple-compiler.ts` for a complete working example of the compilation pipeline.