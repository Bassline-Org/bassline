# Choreographic Compilation: Always-On, Non-Linear Compilation Networks

## Overview

This document describes a revolutionary compilation system where **choreography specifications are compiled through networks of always-on, collaborating gadgets** rather than traditional linear pipelines. The system implements progressive information sharing, incremental compilation, and non-linear transformation flows.

## Core Philosophy

### Traditional Compilation
```
Source → Parser → Validator → Optimizer → CodeGen → Output
```
*Sequential, blocking, monolithic*

### Choreographic Compilation
```
    Parser ←→ Validator ←→ Optimizer
       ↕         ↕         ↕
  TypeChecker ←→ AST ←→ CodeGen ←→ Materializer
       ↕         ↕         ↕
   Analyzer ←→ Cache ←→ TargetSelector
```
*Concurrent, reactive, collaborative*

## Key Innovations

### 1. Always-On Compilation Network
- **No compilation "phases"** - all gadgets run continuously
- **Instant reactivity** - changes propagate immediately to affected gadgets
- **Progressive convergence** - compilation gradually improves as more information becomes available
- **Incremental everything** - minimal recomputation on changes

### 2. Non-Linear Information Flow
- **Bidirectional communication** between compilation gadgets
- **Shared compilation state** through effect collaboration
- **Parallel processing** of independent compilation concerns
- **Organic collaboration** rather than rigid pipeline ordering

### 3. Progressive Information Sharing
- **Partial results** are immediately shared with interested gadgets
- **Incremental refinement** as more analysis becomes available
- **Dependency-driven updates** - only affected parts recompile
- **Collaborative consensus** on complex compilation decisions

## Architecture

### Compilation AST

The heart of the system is an **incremental, collaborative AST**:

```typescript
interface CompilationAST {
  // Core choreography structure
  roles: Map<string, RoleNode>;
  relationships: Map<string, RelationshipNode>;

  // Compilation metadata
  parseState: Map<string, ParseStatus>;
  validationState: Map<string, ValidationResult>;
  typeState: Map<string, TypeInfo>;
  optimizationState: Map<string, OptimizationResult>;

  // Change tracking
  version: number;
  changeLog: ChangeEvent[];
  dependencies: DependencyGraph;
}

interface ASTNode {
  id: string;
  version: number;
  status: 'parsing' | 'parsed' | 'validating' | 'valid' | 'invalid' | 'optimizing' | 'optimized';
  dependencies: string[];
  dependents: string[];
}
```

### Compilation Effects

Gadgets communicate through **compilation effects**:

```typescript
type CompilationEffect =
  | { astUpdate: { nodeId: string; update: Partial<ASTNode> } }
  | { validationResult: { nodeId: string; errors: ValidationError[]; warnings: Warning[] } }
  | { typeInference: { nodeId: string; type: TypeInfo } }
  | { optimization: { nodeId: string; transform: OptimizationTransform } }
  | { codeGeneration: { targetId: string; artifacts: CodeArtifact[] } }
  | { materialization: { artifacts: MaterializationRequest[] } }
  | { dependencyChange: { from: string; to: string; type: 'added' | 'removed' } };
```

## Core Compilation Gadgets

### Parser Gadget
```typescript
// Continuously parses choreography specs, emitting AST updates
const choreographyParser = createGadget(
  (state, input: { source: string; path?: string }) => ({ action: 'parse', context: input }),
  {
    'parse': (gadget, { source, path }) => {
      const ast = incrementalParse(source, gadget.current().ast, path);
      gadget.update({ ...gadget.current(), ast });

      // Emit AST updates for each changed node
      ast.changedNodes.forEach(node => {
        gadget.emit({ astUpdate: { nodeId: node.id, update: node } });
      });

      return changed(ast);
    }
  }
)({ ast: new Map(), sourceMap: new Map() });
```

### Semantic Validator Gadget
```typescript
// Continuously validates AST nodes as they become available
const semanticValidator = createGadget(
  (state, effect: CompilationEffect) => {
    if (effect.astUpdate) return { action: 'validate', context: effect.astUpdate };
    return null;
  },
  {
    'validate': (gadget, { nodeId, update }) => {
      const validationResult = validateNode(update, gadget.current().ast);

      gadget.emit({
        validationResult: {
          nodeId,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        }
      });

      return changed({ ...gadget.current(), validationResults: new Map([[nodeId, validationResult]]) });
    }
  }
)({ ast: new Map(), validationResults: new Map() });
```

### Code Generator Gadget
```typescript
// Generates code artifacts as AST nodes become validated and optimized
const codeGenerator = createGadget(
  (state, effect: CompilationEffect) => {
    if (effect.validationResult && effect.validationResult.errors.length === 0) {
      return { action: 'generate', context: effect.validationResult };
    }
    if (effect.optimization) {
      return { action: 'regenerate', context: effect.optimization };
    }
    return null;
  },
  {
    'generate': (gadget, { nodeId }) => {
      const artifacts = generateCodeForNode(nodeId, gadget.current());

      gadget.emit({
        codeGeneration: {
          targetId: gadget.current().targetId,
          artifacts
        }
      });

      return changed({ ...gadget.current(), generatedArtifacts: new Map([[nodeId, artifacts]]) });
    }
  }
)({ targetId: 'filesystem', generatedArtifacts: new Map() });
```

## Compilation Targets

### Filesystem Target
Compiles choreographies to executable shell scripts:

```typescript
const filesystemCompiler = createGadget(
  (state, effect: CompilationEffect) => {
    if (effect.codeGeneration && effect.codeGeneration.targetId === 'filesystem') {
      return { action: 'materialize', context: effect.codeGeneration };
    }
    return null;
  },
  {
    'materialize': (gadget, { artifacts }) => {
      artifacts.forEach(artifact => {
        if (artifact.type === 'shell_script') {
          gadget.emit({
            materialization: [{
              type: 'write_file',
              path: artifact.path,
              content: artifact.content,
              permissions: artifact.executable ? 0o755 : 0o644
            }]
          });
        }
      });

      return changed({ ...gadget.current(), materializedArtifacts: artifacts });
    }
  }
)({ materializedArtifacts: [] });
```

### Container Target
Compiles choreographies to Docker containers and Kubernetes manifests:

```typescript
const containerCompiler = createGadget(
  (state, effect: CompilationEffect) => {
    if (effect.codeGeneration && effect.codeGeneration.targetId === 'container') {
      return { action: 'containerize', context: effect.codeGeneration };
    }
    return null;
  },
  {
    'containerize': (gadget, { artifacts }) => {
      const dockerfiles = generateDockerfiles(artifacts);
      const k8sManifests = generateKubernetesManifests(artifacts);

      [...dockerfiles, ...k8sManifests].forEach(artifact => {
        gadget.emit({
          materialization: [{
            type: 'write_file',
            path: artifact.path,
            content: artifact.content
          }]
        });
      });

      return changed({ ...gadget.current(), containerArtifacts: [...dockerfiles, ...k8sManifests] });
    }
  }
)({ containerArtifacts: [] });
```

## Compilation Network Choreography

The compilation gadgets themselves form a choreography:

```typescript
const compilationChoreography = {
  roles: {
    parser: {
      type: 'input_processor',
      gadget: choreographyParser,
      capabilities: ['parse_yaml', 'incremental_parsing']
    },
    validator: {
      type: 'analyzer',
      gadget: semanticValidator,
      capabilities: ['semantic_validation', 'dependency_checking']
    },
    optimizer: {
      type: 'transformer',
      gadget: optimizationGadget,
      capabilities: ['dead_code_elimination', 'constant_folding']
    },
    filesystem_compiler: {
      type: 'target_compiler',
      gadget: filesystemCompiler,
      capabilities: ['shell_script_generation', 'file_materialization']
    },
    container_compiler: {
      type: 'target_compiler',
      gadget: containerCompiler,
      capabilities: ['docker_generation', 'k8s_manifest_generation']
    }
  },
  relationships: [
    { from: 'parser', to: 'validator', protocol: 'ast_updates' },
    { from: 'validator', to: 'optimizer', protocol: 'validation_results' },
    { from: 'optimizer', to: 'filesystem_compiler', protocol: 'optimized_ast' },
    { from: 'optimizer', to: 'container_compiler', protocol: 'optimized_ast' },
    { from: 'validator', to: 'parser', protocol: 'validation_feedback' }
  ]
};
```

## Advanced Features

### Incremental Compilation
Changes to choreography specs trigger minimal recompilation:

1. **Change Detection**: Parser identifies changed nodes in AST
2. **Dependency Analysis**: Only dependent nodes are marked for revalidation
3. **Selective Regeneration**: Code generation occurs only for affected nodes
4. **Incremental Materialization**: Only changed files are written to disk

### Multi-Target Compilation
Same choreography compiles to multiple targets simultaneously:

```typescript
// Single choreography spec
const paymentService = { /* choreography definition */ };

// Multiple target compilers receive the same optimized AST
optimizer.emit({
  optimization: {
    nodeId: 'payment_processor',
    optimizedAST: optimizedNode
  }
});

// Results in parallel compilation to:
// - Shell scripts in /network/payments/
// - Docker containers with K8s manifests
// - AWS Lambda functions with CloudFormation
// - All from the same choreography!
```

### Self-Modifying Compilation
Compilation networks can modify themselves based on performance feedback:

```typescript
const adaptiveCompiler = createGadget(
  (state, metrics: CompilationMetrics) => {
    if (metrics.compilationTime > state.threshold) {
      return { action: 'optimize_pipeline', context: metrics };
    }
    return null;
  },
  {
    'optimize_pipeline': (gadget, metrics) => {
      // Add parallelization gadget to speed up compilation
      gadget.emit({
        choreographyUpdate: {
          addRole: {
            name: 'parallel_optimizer',
            gadget: parallelOptimizationGadget
          }
        }
      });

      return changed({ ...gadget.current(), optimizations: [...gadget.current().optimizations, 'parallelization'] });
    }
  }
)({ threshold: 1000, optimizations: [] });
```

## MCP Integration

### ChoreographyShell Tool
Provides filesystem-like interface to compilation networks:

```typescript
// MCP tool definition
{
  name: "choreography_shell",
  description: "Execute shell-like commands on choreographic compilation networks",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
      cwd: { type: "string", description: "Current working directory in network" }
    }
  }
}

// Example usage:
choreography_shell({
  command: "ls /compilation/payments/",
  cwd: "/compilation"
});
// Returns: parser/ validator/ optimizer/ filesystem_compiler/ container_compiler/

choreography_shell({
  command: "cat /compilation/payments/parser/state.json"
});
// Returns: current AST state for payment service parser

choreography_shell({
  command: "tail -f /compilation/effects"
});
// Returns: live stream of compilation effects
```

## Benefits Over Traditional Compilation

### Performance
- **Instant feedback** on choreography changes
- **Minimal recompilation** through incremental updates
- **Parallel processing** of independent compilation tasks
- **Cached results** persist across compilation sessions

### Flexibility
- **Hot-swappable** compilation passes
- **A/B testing** different optimization strategies
- **Multi-target** compilation without duplication
- **Dynamic reconfiguration** of compilation pipelines

### Observability
- **Live compilation state** inspection
- **Effect tracing** for debugging compilation issues
- **Performance metrics** for compilation optimization
- **Visual compilation networks** showing information flow

### Extensibility
- **Plugin architecture** through gadget composition
- **Custom compilation passes** as new gadgets
- **Domain-specific optimizations** for specific choreography patterns
- **AI-assisted compilation** through ML-powered gadgets

This creates the **first truly reactive, collaborative, and adaptive compilation system** - a living network that continuously refines choreography specifications into deployable artifacts through emergent collaboration between specialized compilation gadgets.